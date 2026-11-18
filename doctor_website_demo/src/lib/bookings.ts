import { supabase } from "../supabaseClient";

export const CLASS_CANCELLED = "Class Cancelled";
export const SEAT_HOLDING_OR_CLASS_CANCELLED = `holds_seat.is.true,booking_status.eq.${CLASS_CANCELLED}`;

export type SeatBooking = {
  id: string;
  classId: string;
  status: string;
  expiresAt: string | null;
  materialTypeId: string;
  total: number;
};

type BookingRow = {
  id: string;
  course_session_id: string;
  booking_status: string;
  expires_at: string | null;
  material_type_id: string;
  total_amount: number | string;
};

const BOOKING_COLUMNS = "id, course_session_id, booking_status, expires_at, material_type_id, total_amount";

const RESERVE_REFUSALS: [fragment: string, message: string][] = [
  ["is full", "This class is full."],
  ["has already started", "This class has already started."],
  ["is cancelled", "This class was cancelled."],
  ["not open for booking", "This course is not open for booking."],
  ["is not offered", "That material option is no longer offered. Choose another."],
  ["Only active students", "Only active student accounts can book classes."],
];

function toSeatBooking(row: BookingRow): SeatBooking {
  return {
    id: row.id,
    classId: row.course_session_id,
    status: row.booking_status,
    expiresAt: row.expires_at,
    materialTypeId: row.material_type_id,
    total: Number(row.total_amount),
  };
}

function reserveRefusal(message: string): string {
  return RESERVE_REFUSALS.find(([fragment]) => message.includes(fragment))?.[1] ?? message;
}

export async function reserveSeat(
  classId: string,
  materialTypeId: string,
): Promise<{ booking: SeatBooking; error: null } | { booking: null; error: string }> {
  const { data, error } = await supabase.rpc("reserve_seat", { p_course_session_id: classId, p_material_type_id: materialTypeId });
  if (error) return { booking: null, error: reserveRefusal(error.message) };
  return { booking: toSeatBooking(data as BookingRow), error: null };
}

export async function fetchSeatBookings(userId: string, classIds: string[]): Promise<{ bookings: SeatBooking[]; error: string | null }> {
  if (classIds.length === 0) return { bookings: [], error: null };
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("user_id", userId)
    .eq("holds_seat", true)
    .in("course_session_id", classIds);
  if (error) return { bookings: [], error: error.message };
  return { bookings: ((data ?? []) as BookingRow[]).map(toSeatBooking), error: null };
}

export function formatHoldExpiry(expiresAt: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(expiresAt));
}
