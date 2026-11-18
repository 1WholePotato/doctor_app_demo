#!/usr/bin/env bash
set -euo pipefail

course=b0100000-0000-4000-8000-000000000023
location=b0100000-0000-4000-8000-000000000022
electronic=b0100000-0000-4000-8000-000000000033
student=b0100000-0000-4000-8000-000000000012
admin=b0100000-0000-4000-8000-000000000011
held_class=b1200000-0000-4000-8000-0000000000e1
held_booking=b1200000-0000-4000-8000-0000000000e2
last_seat_class=b1200000-0000-4000-8000-0000000000e3
expiring_booking=b1200000-0000-4000-8000-0000000000e4
cancelled_class=b1200000-0000-4000-8000-0000000000e5
cancelled_booking=b1200000-0000-4000-8000-0000000000e6
taken_seat_class=b1200000-0000-4000-8000-0000000000e7
lapsed_booking=b1200000-0000-4000-8000-0000000000e8
classes="'$held_class', '$last_seat_class', '$cancelled_class', '$taken_seat_class'"
racers=6
duplicates=12
out="$(mktemp -d)"

sql() { psql -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
racer_id() { printf 'b1200000-0000-4000-8000-0000000001%02d' "$1"; }
settle() {
  printf "set role service_role; select public.settle_payment_attempt('pay-%s', '[{\"id\":\"%s\",\"merchantReference\":\"%s\",\"amount\":{\"currency\":\"ZAR\",\"value\":100},\"status\":\"Successful\"}]');" "$1" "$2" "$3"
}
cleanup() {
  sql "delete from public.payments where booking_id in (select id from public.bookings where course_session_id in ($classes));
       delete from public.booking_review_flags where booking_id in (select id from public.bookings where course_session_id in ($classes));
       alter table public.payment_events disable trigger forbid_payment_event_change;
       delete from public.payment_events where payment_attempt_id in (
         select a.id from public.payment_attempts a join public.bookings b on b.id = a.booking_id where b.course_session_id in ($classes));
       alter table public.payment_events enable trigger forbid_payment_event_change;
       delete from public.payment_attempts where booking_id in (select id from public.bookings where course_session_id in ($classes));
       delete from public.bookings where course_session_id in ($classes);
       delete from public.users where id::text like 'b1200000-0000-4000-8000-0000000001%';
       delete from auth.users where id::text like 'b1200000-0000-4000-8000-0000000001%';
       delete from public.course_session_changes where course_session_id in ($classes);
       delete from public.course_sessions where id in ($classes);" >/dev/null
  rm -rf "$out"
}
trap cleanup EXIT

sql "insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
     values ('$held_class', '$course', '$location', current_date + 93, current_date + 93, '09:00', '12:00', 5),
            ('$last_seat_class', '$course', '$location', current_date + 94, current_date + 94, '09:00', '12:00', 1),
            ('$cancelled_class', '$course', '$location', current_date + 95, current_date + 95, '09:00', '12:00', 5),
            ('$taken_seat_class', '$course', '$location', current_date + 96, current_date + 96, '09:00', '12:00', 1);
     insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
     values ('$held_booking', '$student', '$held_class', '$electronic', 'Pending'),
            ('$expiring_booking', '$student', '$last_seat_class', '$electronic', 'Pending'),
            ('$cancelled_booking', '$student', '$cancelled_class', '$electronic', 'Pending'),
            ('$lapsed_booking', '$student', '$taken_seat_class', '$electronic', 'Pending');
     insert into public.payment_attempts (booking_id, reference, amount, expires_at, ozow_payment_id, redirect_url)
     select id, 'DARACE' || upper(right(id::text, 2)), total_amount, expires_at, 'pay-' || id, 'https://pay.example.test/' || id
     from public.bookings where course_session_id in ($classes);" >/dev/null

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
  psql -XAtq -v ON_ERROR_STOP=1 -c "$(settle "$held_booking" tx-race-held DARACEE2)" >"$out/duplicate-$n.out" 2>&1 &
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

reserve_racers() {
  for n in $(seq 1 "$racers"); do
    id="$(racer_id "$n")"
    { psql -XAtq -v ON_ERROR_STOP=1 -c "begin; set local role authenticated;
        select set_config('request.jwt.claims', '{\"sub\":\"$id\",\"role\":\"authenticated\"}', true);
        select public.reserve_seat('$1', '$electronic'); commit;" >/dev/null 2>&1 \
      && echo booked || echo refused; } >"$out/$2-racer-$n.status" &
  done
}

expiry_race() {
  local class=$1 booking=$2 reference=$3 order=$4
  sql "update public.bookings set expires_at = clock_timestamp() + interval '1 second' where id = '$booking';
       update public.payment_attempts a set expires_at = b.expires_at from public.bookings b
       where b.id = '$booking' and a.booking_id = b.id;" >/dev/null
  psql -XAtq -v ON_ERROR_STOP=1 -c "begin;
    select 1 from public.course_sessions where id = '$class' for update;
    select pg_sleep(2.5); commit;" >/dev/null &
  if [[ "$order" == payment-first ]]; then
    sleep 0.5
    psql -XAtq -v ON_ERROR_STOP=1 -c "$(settle "$booking" "tx-$booking" "$reference")" >"$out/$booking.out" 2>&1 &
    sleep 0.2
    reserve_racers "$class" "$booking"
  else
    sleep 1.3
    reserve_racers "$class" "$booking"
    sleep 0.3
    psql -XAtq -v ON_ERROR_STOP=1 -c "$(settle "$booking" "tx-$booking" "$reference")" >"$out/$booking.out" 2>&1 &
  fi
  wait

  local outcome booked seats paid flag
  outcome="$(cat "$out/$booking.out")"
  booked="$(cat "$out/$booking"-racer-*.status | grep -c booked || true)"
  seats="$(sql "select public.seats_taken(cs) from public.course_sessions cs where id = '$class';")"
  paid="$(sql "select count(*) from public.payments where booking_id = '$booking';")"
  flag="$(sql "select count(*) from public.booking_review_flags where booking_id = '$booking' and reason = 'late_payment';")"
  local want="late_paid 0 0"
  [[ "$order" == students-first ]] && want="review 1 1"
  if [[ "$seats" != 1 || "$paid" != 1 || "$outcome $booked $flag" != "$want" ]]; then
    echo "FAIL: $order, payment confirmed as its hold expired [$outcome] raced $racers students for 1 seat: $booked booked, $seats seats taken, $paid payments, $flag review flags" >&2
    exit 1
  fi
  echo "ok: $order, a payment confirmed as its hold expired raced $racers students for the last seat: outcome $outcome, $booked students booked, 1 seat taken, money recorded once"
}

expiry_race "$last_seat_class" "$expiring_booking" DARACEE4 payment-first
expiry_race "$taken_seat_class" "$lapsed_booking" DARACEE8 students-first

psql -XAtq -v ON_ERROR_STOP=1 -c "begin;
  select 1 from public.bookings where id = '$cancelled_booking' for update;
  select pg_sleep(2); commit;" >/dev/null &
sleep 0.5
psql -XAtq -v ON_ERROR_STOP=1 -c "$(settle "$cancelled_booking" tx-race-cancel DARACEE6)" >"$out/cancel-settle.out" 2>&1 &
sleep 0.3
psql -XAtq -v ON_ERROR_STOP=1 -c "begin; set local role authenticated;
  select set_config('request.jwt.claims', '{\"sub\":\"$admin\",\"role\":\"authenticated\"}', true);
  select public.cancel_class('$cancelled_class', 'Race check'); commit;" >"$out/cancel-class.out" 2>&1 &
wait

settled="$(cat "$out/cancel-settle.out")"
cancelled="$(sql "select status from public.course_sessions where id = '$cancelled_class';")"
booking="$(sql "select booking_status from public.bookings where id = '$cancelled_booking';")"
paid="$(sql "select count(*) from public.payments where booking_id = '$cancelled_booking';")"
if [[ "$settled" != paid || "$cancelled" != cancelled || "$booking" != "Class Cancelled" || "$paid" != 1 ]]; then
  echo "FAIL: confirming a payment while its class was cancelled gave settle [$settled], cancel [$(tr '\n' ' ' <"$out/cancel-class.out")], class $cancelled, booking $booking, $paid payments" >&2
  exit 1
fi
echo "ok: a payment confirmed while its class was being cancelled settles first, then the cancellation takes the paid booking, no deadlock"
