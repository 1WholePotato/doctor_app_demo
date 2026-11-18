#!/usr/bin/env bash
set -euo pipefail

class=b0700000-0000-4000-8000-0000000000c1
cancelled_class=b0700000-0000-4000-8000-0000000000c2
admin=b0100000-0000-4000-8000-000000000011
student=b0100000-0000-4000-8000-000000000012
instructor=b0100000-0000-4000-8000-000000000013

sql() { psql -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
book() { echo "insert into public.bookings (user_id, course_session_id, total_amount) values ('$1', '$class', 100);"; }

expect_blocked_failure() {
  local holder="$1" contender="$2" expected="$3" label="$4"
  PGAPPNAME=race_holder psql -XAtq -v ON_ERROR_STOP=1 -c "begin; $holder select pg_sleep(2); commit;" >/dev/null &
  local holder_pid=$!
  until [[ "$(sql "select count(*) from pg_stat_activity where application_name = 'race_holder' and wait_event = 'PgSleep';")" == 1 ]]; do
    if ! kill -0 "$holder_pid" 2>/dev/null; then
      echo "FAIL: $label: the holding transaction ended before it held its lock" >&2
      exit 1
    fi
    sleep 0.05
  done
  local output
  if output="$(psql -XAtq -v ON_ERROR_STOP=1 -c "$contender" 2>&1)"; then
    echo "FAIL: $label succeeded" >&2
    exit 1
  fi
  wait "$holder_pid"
  if [[ "$output" != *"$expected"* ]]; then
    echo "FAIL: $label failed for the wrong reason: $output" >&2
    exit 1
  fi
  echo "ok: $label"
}

sql "insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
     values ('$class', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 90, current_date + 90, '09:00', '12:00', 1);"

expect_blocked_failure "$(book "$admin")" "$(book "$student")" "is full" \
  "a second booking for the last seat waits for the first and is rejected"

sql "update public.course_sessions set max_students = 2 where id = '$class';"
expect_blocked_failure "$(book "$student")" "update public.course_sessions set max_students = 1 where id = '$class';" "below the 2 active bookings" \
  "a capacity cut waits for an in-flight booking and is rejected"

sql "update public.course_sessions set max_students = 3 where id = '$class';"
expect_blocked_failure "update public.course_sessions set max_students = 2 where id = '$class';" "$(book "$instructor")" "is full" \
  "a booking waits for an in-flight capacity cut and is rejected"

result="$(sql "select max_students || '|' || (select count(*) from public.bookings where course_session_id = '$class') from public.course_sessions where id = '$class';")"
sql "delete from public.bookings where course_session_id = '$class'; delete from public.course_sessions where id = '$class';"
test "$result" = '2|2' || { echo "FAIL: expected capacity 2 with 2 bookings, got $result" >&2; exit 1; }
echo "ok: occupancy never exceeded capacity"

sql "insert into public.course_sessions (id, course_id, location_id, start_date, end_date, start_time, end_time, max_students)
     values ('$cancelled_class', 'b0100000-0000-4000-8000-000000000023', 'b0100000-0000-4000-8000-000000000022', current_date + 90, current_date + 90, '09:00', '12:00', 1);"
expect_blocked_failure "update public.course_sessions set status = 'cancelled', cancelled_at = now() where id = '$cancelled_class';" \
  "insert into public.session_instructors (course_session_id, instructor_id) values ('$cancelled_class', 'b0100000-0000-4000-8000-000000000021');" \
  "its teachers cannot be changed" \
  "a teacher added while the class is being cancelled waits and is rejected"
sql "delete from public.course_sessions where id = '$cancelled_class';"
