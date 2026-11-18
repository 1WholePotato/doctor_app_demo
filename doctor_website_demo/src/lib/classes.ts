import { supabase } from "../supabaseClient";

export type ClassStatus = "scheduled" | "cancelled";

export type ClassSchedule = {
  locationId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  maxStudents: number;
};

export function scheduleProblem(schedule: ClassSchedule): string | null {
  if (!schedule.locationId) return "Choose a location.";
  if (!schedule.startDate || !schedule.endDate) return "Choose a start and end date.";
  if (schedule.endDate < schedule.startDate) return "The end date must be on or after the start date.";
  if (!schedule.startTime || !schedule.endTime || schedule.endTime <= schedule.startTime) return "The end time must be after the start time.";
  if (!Number.isInteger(schedule.maxStudents) || schedule.maxStudents < 1) return "Capacity must be a whole number of at least 1.";
  return null;
}

function scheduleArgs(schedule: ClassSchedule) {
  return {
    p_location_id: schedule.locationId,
    p_start_date: schedule.startDate,
    p_end_date: schedule.endDate,
    p_start_time: schedule.startTime,
    p_end_time: schedule.endTime,
    p_max_students: schedule.maxStudents,
  };
}

export async function scheduleClass(courseId: string, schedule: ClassSchedule, instructorIds: string[]): Promise<string | null> {
  const { error } = await supabase.rpc("schedule_class", {
    p_course_id: courseId,
    ...scheduleArgs(schedule),
    p_instructor_ids: instructorIds,
  });
  return error?.message ?? null;
}

export async function rescheduleClass(classId: string, schedule: ClassSchedule): Promise<string | null> {
  const { error } = await supabase.rpc("reschedule_class", { p_course_session_id: classId, ...scheduleArgs(schedule) });
  return error?.message ?? null;
}

export async function cancelClass(classId: string, reason: string): Promise<string | null> {
  const { error } = await supabase.rpc("cancel_class", { p_course_session_id: classId, p_reason: reason });
  return error?.message ?? null;
}
