#!/usr/bin/env bash
set -euo pipefail

class=b1400000-0000-4000-8000-0000000000c1
split=b1400000-0000-4000-8000-0000000000c2
repeat=b1400000-0000-4000-8000-0000000000c3
student=b0100000-0000-4000-8000-000000000012
second=b0100000-0000-4000-8000-000000000014
admin=b0100000-0000-4000-8000-000000000011
course=b0100000-0000-4000-8000-000000000023
location=b0100000-0000-4000-8000-000000000022
printed=b0100000-0000-4000-8000-000000000061
admins=8
out="$(mktemp -d)"

sql() { psql -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
as_admin() {
  psql -XAtq -v ON_ERROR_STOP=1 -c "set role authenticated;
    set request.jwt.claims to '{\"sub\":\"$admin\",\"role\":\"authenticated\"}';" -c "$1"
}
cleanup() {
  sql "set session_replication_role = replica;
       delete from public.admin_audit_log where booking_id in ('$split', '$repeat');
       delete from public.refunds where booking_id in ('$split', '$repeat');
       delete from public.payments where booking_id in ('$split', '$repeat');
       delete from public.bookings where id in ('$split', '$repeat');
       delete from public.course_sessions where id = '$class';" >/dev/null
  rm -rf "$out"
}
trap cleanup EXIT

sql "insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
     values ('$class', '$course', '$location', current_date + 93, current_date + 93, '09:00', '12:00', 5);
     insert into public.bookings (id, user_id, course_session_id, material_type_id, booking_status)
     values ('$split', '$student', '$class', '$printed', 'Confirmed'), ('$repeat', '$second', '$class', '$printed', 'Confirmed');
     insert into public.payments (booking_id, amount, payment_date, payment_status_id)
     select b.id, b.total_amount, now(), ps.id from public.bookings b, public.payment_statuses ps
     where b.id in ('$split', '$repeat') and ps.name = 'Paid';" >/dev/null

payment_of() { sql "select p.id from public.payments p join public.payment_statuses ps on ps.id = p.payment_status_id where p.booking_id = '$1' and ps.name = 'Paid';"; }
split_payment="$(payment_of "$split")"
repeat_payment="$(payment_of "$repeat")"

psql -XAtq -v ON_ERROR_STOP=1 -c "begin;
  select 1 from public.bookings where id in ('$split', '$repeat') for update;
  select pg_sleep(2); commit;" >/dev/null &
sleep 0.5
for n in $(seq 1 "$admins"); do
  { as_admin "select (public.record_refund('$split_payment', 100, 'Race $n', 'RACE-SPLIT-$n', true)).id;" \
      >"$out/split-$n.out" 2>&1 && echo ok >"$out/split-$n.status" || echo refused >"$out/split-$n.status"; } &
  { as_admin "select (public.record_refund('$repeat_payment', 250, 'Student withdrew', 'RACE-REPEAT', false)).id;" \
      >"$out/repeat-$n.out" 2>&1 && echo ok >"$out/repeat-$n.status" || echo refused >"$out/repeat-$n.status"; } &
done
wait

accepted="$(cat "$out"/split-*.status | grep -cx ok || true)"
over="$(cat "$out"/split-*.out | grep -c 'still refundable' || true)"
refunded="$(sql "select coalesce(sum(amount), 0) from public.refunds where booking_id = '$split';")"
if [[ "$accepted" != 2 || "$over" != $((admins - 2)) || "$refunded" != 200.00 ]]; then
  echo "FAIL: $admins admins refunding R100 of a R250 payment at once: $accepted accepted, $over refused as over-refund, R$refunded refunded" >&2
  exit 1
fi
echo "ok: $admins admins refunding R100 of a R250 payment at once record exactly 2 refunds and refuse the rest"

ids="$(sort -u "$out"/repeat-*.out)"
rows="$(sql "select count(*) from public.refunds where booking_id = '$repeat';")"
ledger="$(sql "select count(*) from public.payments p join public.payment_statuses ps on ps.id = p.payment_status_id where p.booking_id = '$repeat' and ps.name = 'Refunded';")"
status="$(sql "select booking_status from public.bookings where id = '$repeat';")"
if [[ "$(cat "$out"/repeat-*.status | sort -u)" != ok || "$(wc -l <<<"$ids")" != 1 || "$rows" != 1 || "$ledger" != 1 || "$status" != Cancelled ]]; then
  echo "FAIL: $admins parallel submissions of one refund gave refunds [$ids], $rows refund rows, $ledger Refunded payments, booking $status" >&2
  exit 1
fi
echo "ok: $admins parallel submissions of one refund reference all return the same refund and cancel the booking once"
