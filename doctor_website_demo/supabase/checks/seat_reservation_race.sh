#!/usr/bin/env bash
set -euo pipefail

contended=b1000000-0000-4000-8000-0000000000c1
repeated=b1000000-0000-4000-8000-0000000000c2
late_confirm=b1000000-0000-4000-8000-0000000000c3
early_confirm=b1000000-0000-4000-8000-0000000000c4
course=b0100000-0000-4000-8000-000000000023
location=b0100000-0000-4000-8000-000000000022
electronic=b0100000-0000-4000-8000-000000000033
student_role=4fd9e72e-f94b-4222-b5c1-95b447088d4d
capacity=5
contenders=24
duplicates=12
out="$(mktemp -d)"

sql() { psql -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
student() { printf 'b1000000-0000-4000-8000-%012d' "$((100 + $1))"; }
reserve_as() {
  psql -XAtq -v ON_ERROR_STOP=1 -c "set role authenticated;
    set request.jwt.claims = '{\"sub\":\"$1\",\"role\":\"authenticated\"}';
    select (public.reserve_seat('$2', '$electronic')).id;"
}
cleanup() {
  sql "delete from public.bookings where course_session_id in ('$contended', '$repeated', '$late_confirm', '$early_confirm');
       delete from public.course_sessions where id in ('$contended', '$repeated', '$late_confirm', '$early_confirm');
       delete from public.users where id::text like 'b1000000-0000-4000-8000-0000000001%';
       delete from auth.users where id::text like 'b1000000-0000-4000-8000-0000000001%';" >/dev/null
  rm -rf "$out"
}
trap cleanup EXIT

sql "insert into auth.users (instance_id, id, aud, role, email)
     select '00000000-0000-0000-0000-000000000000', ('b1000000-0000-4000-8000-' || lpad((100 + n)::text, 12, '0'))::uuid,
            'authenticated', 'authenticated', 'b10-race-' || n || '@example.test'
     from generate_series(0, $contenders) n;
     insert into public.users (id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email, sanc_num)
     select id, '$student_role', 'Race', 'Student', '1990-01-01', email, '0000000000', email, email
     from auth.users where email like 'b10-race-%@example.test';
     insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
     values ('$contended', '$course', '$location', current_date + 90, current_date + 90, '09:00', '12:00', $capacity),
            ('$repeated', '$course', '$location', current_date + 91, current_date + 91, '09:00', '12:00', $capacity),
            ('$late_confirm', '$course', '$location', current_date + 92, current_date + 92, '09:00', '12:00', 1),
            ('$early_confirm', '$course', '$location', current_date + 93, current_date + 93, '09:00', '12:00', 1);" >/dev/null

reserve_as "$(student 0)" "$contended" >/dev/null
sql "update public.bookings set expires_at = now() - interval '1 minute' where course_session_id = '$contended';"

psql -XAtq -v ON_ERROR_STOP=1 -c "begin;
  select 1 from public.course_sessions where id in ('$contended', '$repeated') for update;
  select pg_sleep(2); commit;" >/dev/null &
sleep 0.5
for n in $(seq 1 "$contenders"); do
  { reserve_as "$(student "$n")" "$contended" >"$out/contender-$n.out" 2>&1 && echo ok >"$out/contender-$n.status" || echo refused >"$out/contender-$n.status"; } &
done
for n in $(seq 1 "$duplicates"); do
  { reserve_as "$(student 0)" "$repeated" >"$out/duplicate-$n.out" 2>&1 && echo ok >"$out/duplicate-$n.status" || echo refused >"$out/duplicate-$n.status"; } &
done
wait

booked="$(cat "$out"/contender-*.status | grep -c '^ok$' || true)"
full="$(cat "$out"/contender-*.out | grep -c 'is full' || true)"
held="$(sql "select count(*) from public.bookings b where b.course_session_id = '$contended' and public.holds_seat(b);")"
if [[ "$booked" != "$capacity" || "$held" != "$capacity" || "$full" != "$((contenders - capacity))" ]]; then
  echo "FAIL: $contenders students raced for $capacity seats behind a lapsed hold: $booked booked, $held seats held, $full refused as full" >&2
  head -n 3 "$out"/contender-*.out >&2
  exit 1
fi
echo "ok: $contenders parallel reservations for $capacity seats behind a lapsed hold book exactly $capacity, the rest are refused as full"

ids="$(sort -u "$out"/duplicate-*.out)"
rows="$(sql "select count(*) from public.bookings where course_session_id = '$repeated';")"
if [[ "$(cat "$out"/duplicate-*.status | sort -u)" != ok || "$(wc -l <<<"$ids")" != 1 || "$rows" != 1 ]]; then
  echo "FAIL: $duplicates parallel duplicate submissions gave ids [$ids] and $rows bookings" >&2
  exit 1
fi
echo "ok: $duplicates parallel duplicate submissions from one student all return the same booking"

confirm_at_expiry() {
  local class="$1" holder="$2" rival="$3" order="$4" expected="$5" label="$6"
  local hold confirm pause steps confirm_pid confirm_status rival_status held
  hold="$(reserve_as "$holder" "$class")"
  sql "update public.bookings set expires_at = now() + interval '1 second' where id = '$hold';"
  confirm="update public.bookings set booking_status = 'Confirmed' where id = '$hold';"
  pause="select pg_sleep(3);"
  if [[ "$order" == late ]]; then steps="$pause $confirm"; else steps="$confirm $pause"; fi
  psql -XAtq -v ON_ERROR_STOP=1 -c "begin;" -c "select now() < expires_at from public.bookings where id = '$hold';" \
    -c "$steps" -c "commit;" >"$out/confirm-$class.out" 2>&1 &
  confirm_pid=$!
  until [[ "$(sql "select clock_timestamp() > expires_at from public.bookings where id = '$hold';")" == t ]]; do sleep 0.05; done
  reserve_as "$rival" "$class" >"$out/rival-$class.out" 2>&1 && rival_status=ok || rival_status=refused
  wait "$confirm_pid" && confirm_status=ok || confirm_status=refused
  held="$(sql "select count(*) from public.bookings b where b.course_session_id = '$class' and public.holds_seat(b);")"
  if [[ "$(head -n 1 "$out/confirm-$class.out")" != t ]]; then
    echo "FAIL: $label: the confirmation did not start before the hold lapsed" >&2
    exit 1
  fi
  if [[ "$held" != 1 || "$confirm_status $rival_status" != "$expected" ]]; then
    echo "FAIL: $label: confirmation $confirm_status, rival reservation $rival_status, $held seats held in a 1-seat class" >&2
    cat "$out/confirm-$class.out" "$out/rival-$class.out" >&2
    exit 1
  fi
  if ! grep -q 'is full' "$out/confirm-$class.out" "$out/rival-$class.out"; then
    echo "FAIL: $label: the losing side was not refused as full" >&2
    exit 1
  fi
  echo "ok: $label"
}

confirm_at_expiry "$late_confirm" "$(student 1)" "$(student 2)" late "refused ok" \
  "a confirmation that began before its hold lapsed but writes after is refused once another student takes the seat"
confirm_at_expiry "$early_confirm" "$(student 3)" "$(student 4)" early "ok refused" \
  "a confirmation written before its hold lapses keeps the seat and the reservation waiting on it is refused"
