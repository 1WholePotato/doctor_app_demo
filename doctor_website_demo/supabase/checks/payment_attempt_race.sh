#!/usr/bin/env bash
set -euo pipefail

class=b1100000-0000-4000-8000-0000000000c1
booking=b1100000-0000-4000-8000-0000000000c2
student=b0100000-0000-4000-8000-000000000014
course=b0100000-0000-4000-8000-000000000023
location=b0100000-0000-4000-8000-000000000022
electronic=b0100000-0000-4000-8000-000000000033
clicks=12
out="$(mktemp -d)"

sql() { psql -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
cleanup() {
  sql "delete from public.payment_attempts where booking_id = '$booking';
       delete from public.bookings where id = '$booking';
       delete from public.course_sessions where id = '$class';" >/dev/null
  rm -rf "$out"
}
trap cleanup EXIT

sql "insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
     values ('$class', '$course', '$location', current_date + 92, current_date + 92, '09:00', '12:00', 5);
     insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
     values ('$booking', '$student', '$class', '$electronic', 'Pending');" >/dev/null

psql -XAtq -v ON_ERROR_STOP=1 -c "begin;
  select 1 from public.bookings where id = '$booking' for update;
  select pg_sleep(2); commit;" >/dev/null &
sleep 0.5
for n in $(seq 1 "$clicks"); do
  { psql -XAtq -v ON_ERROR_STOP=1 -c "set role service_role; select (public.begin_payment_attempt('$booking', '$student')).id;" \
      >"$out/click-$n.out" 2>&1 && echo ok >"$out/click-$n.status" || echo refused >"$out/click-$n.status"; } &
done
wait

ids="$(sort -u "$out"/click-*.out)"
rows="$(sql "select count(*) from public.payment_attempts where booking_id = '$booking';")"
if [[ "$(cat "$out"/click-*.status | sort -u)" != ok || "$(wc -l <<<"$ids")" != 1 || "$rows" != 1 ]]; then
  echo "FAIL: $clicks parallel payment clicks gave attempts [$ids] and $rows rows" >&2
  exit 1
fi
echo "ok: $clicks parallel payment clicks on one held booking all return the same attempt"
