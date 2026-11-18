#!/usr/bin/env bash
set -euo pipefail

course=b0100000-0000-4000-8000-000000000023
location=b0100000-0000-4000-8000-000000000022
electronic=b0100000-0000-4000-8000-000000000033
student=b0100000-0000-4000-8000-000000000012
held_class=b1200000-0000-4000-8000-0000000000e1
held_booking=b1200000-0000-4000-8000-0000000000e2
last_seat_class=b1200000-0000-4000-8000-0000000000e3
late_booking=b1200000-0000-4000-8000-0000000000e4
racers=6
duplicates=12
out="$(mktemp -d)"

sql() { psql -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
racer_id() { printf 'b1200000-0000-4000-8000-0000000001%02d' "$1"; }
cleanup() {
  sql "delete from public.payments where booking_id in (select id from public.bookings where course_session_id in ('$held_class', '$last_seat_class'));
       delete from public.booking_review_flags where booking_id in (select id from public.bookings where course_session_id in ('$held_class', '$last_seat_class'));
       alter table public.payment_events disable trigger forbid_payment_event_change;
       delete from public.payment_events where payment_attempt_id in (select a.id from public.payment_attempts a join public.bookings b on b.id = a.booking_id where b.course_session_id in ('$held_class', '$last_seat_class'));
       alter table public.payment_events enable trigger forbid_payment_event_change;
       delete from public.payment_attempts where booking_id in (select id from public.bookings where course_session_id in ('$held_class', '$last_seat_class'));
       delete from public.bookings where course_session_id in ('$held_class', '$last_seat_class');
       delete from public.users where id::text like 'b1200000-0000-4000-8000-0000000001%';
       delete from auth.users where id::text like 'b1200000-0000-4000-8000-0000000001%';
       delete from public.course_sessions where id in ('$held_class', '$last_seat_class');" >/dev/null
  rm -rf "$out"
}
trap cleanup EXIT

tx() {
  printf '[{"id":"%s","merchantReference":"%s","amount":{"currency":"ZAR","value":100},"status":"Successful","siteCode":"MCK-MCK-001"}]' "$1" "$2"
}

sql "insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
     values ('$held_class', '$course', '$location', current_date + 93, current_date + 93, '09:00', '12:00', 5),
            ('$last_seat_class', '$course', '$location', current_date + 94, current_date + 94, '09:00', '12:00', 1);
     insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
     values ('$held_booking', '$student', '$held_class', '$electronic', 'Pending'),
            ('$late_booking', '$student', '$last_seat_class', '$electronic', 'Pending');
     update public.bookings set expires_at = now() - interval '1 minute' where id = '$late_booking';
     insert into public.payment_attempts (booking_id, reference, amount, expires_at, ozow_payment_id, redirect_url)
     select id, case id when '$held_booking' then 'DARACEHELD' else 'DARACELATE' end, total_amount, expires_at,
            'pay-' || id, 'https://pay.example.test/' || id
     from public.bookings where id in ('$held_booking', '$late_booking');" >/dev/null

for n in $(seq 1 "$racers"); do
  id="$(racer_id "$n")"
  sql "insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', '$id', 'authenticated', 'authenticated', 'racer-$n@example.test', '', now(), '{}', '{}', now(), now());
       insert into public.users (id, role_id, first_name, last_name, birth_date, passport_num, cell_num, email, sanc_num)
       values ('$id', '4fd9e72e-f94b-4222-b5c1-95b447088d4d', 'Racer', '$n', '1990-01-01', 'RACE-$n', '0000000$n', 'racer-$n@example.test', 'RACE-$n');" >/dev/null
done

psql -XAtq -v ON_ERROR_STOP=1 -c "begin;
  select 1 from public.payment_attempts where ozow_payment_id = 'pay-$held_booking' for update;
  select pg_sleep(2); commit;" >/dev/null &
sleep 0.5
for n in $(seq 1 "$duplicates"); do
  psql -XAtq -v ON_ERROR_STOP=1 -c "set role service_role; select public.settle_payment_attempt('pay-$held_booking', '$(tx tx-race-held DARACEHELD)');" \
    >"$out/duplicate-$n.out" 2>&1 &
done
wait

outcomes="$(cat "$out"/duplicate-*.out | sort | uniq -c | sort -n | awk '{printf "%s %s ", $1, $2}')"
state="$(sql "select b.booking_status || ' ' || (select count(*) from public.payments p where p.booking_id = b.id) || ' ' ||
              (select count(*) from public.payment_events e join public.payment_attempts a on a.id = e.payment_attempt_id where a.booking_id = b.id)
              from public.bookings b where b.id = '$held_booking';")"
if [[ "$outcomes" != "1 paid 11 unchanged " || "$state" != "Confirmed 1 1" ]]; then
  echo "FAIL: $duplicates parallel duplicate notifications gave outcomes [$outcomes] and booking, payments, events [$state]" >&2
  exit 1
fi
echo "ok: $duplicates parallel duplicate notifications confirm the booking once, with one payment and one event"

psql -XAtq -v ON_ERROR_STOP=1 -c "begin;
  select 1 from public.course_sessions where id = '$last_seat_class' for update;
  select pg_sleep(2); commit;" >/dev/null &
sleep 0.5
psql -XAtq -v ON_ERROR_STOP=1 -c "set role service_role; select public.settle_payment_attempt('pay-$late_booking', '$(tx tx-race-late DARACELATE)');" \
  >"$out/late.out" 2>&1 &
for n in $(seq 1 "$racers"); do
  id="$(racer_id "$n")"
  { psql -XAtq -v ON_ERROR_STOP=1 -c "begin; set local role authenticated;
      select set_config('request.jwt.claims', '{\"sub\":\"$id\",\"role\":\"authenticated\"}', true);
      select public.reserve_seat('$last_seat_class', '$electronic'); commit;" >/dev/null 2>&1 \
    && echo booked || echo refused; } >"$out/racer-$n.status" &
done
wait

late="$(cat "$out/late.out")"
booked="$(cat "$out"/racer-*.status | grep -c booked || true)"
seats="$(sql "select public.seats_taken(cs) from public.course_sessions cs where id = '$last_seat_class';")"
paid="$(sql "select count(*) from public.payments where booking_id = '$late_booking';")"
flag="$(sql "select count(*) from public.booking_review_flags where booking_id = '$late_booking' and reason = 'late_payment';")"
if [[ "$seats" != 1 || "$paid" != 1 ]] \
   || ! { [[ "$late" == late_paid && "$booked" == 0 && "$flag" == 0 ]] || [[ "$late" == review && "$booked" == 1 && "$flag" == 1 ]]; }; then
  echo "FAIL: late payment [$late] raced $racers students for 1 seat: $booked booked, $seats seats taken, $paid payments, $flag review flags" >&2
  exit 1
fi
echo "ok: a late payment raced $racers students for the last seat: payment outcome $late, $booked students booked, 1 seat taken, money recorded once"
