import { createClient } from "./client";
import type { Tables } from "./database.types";

type Booking = Tables<"bookings">;

export type CreateBookingInput = {
  guestName: string;
  guestEmail: string;
  bookingDate: string;
  startTime: string;
  durationHours: number;
  space: string;
  seatCodes: string[];
};

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sign in before creating a booking.");
  }

  const { data, error } = await supabase.rpc("create_booking", {
    p_guest_name: input.guestName,
    p_guest_email: input.guestEmail,
    p_booking_date: input.bookingDate,
    p_start_time: input.startTime,
    p_duration_hours: input.durationHours,
    p_space: input.space,
    p_seat_codes: input.seatCodes,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as Booking;
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("cancel_booking", {
    p_booking_id: bookingId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listMyBookings(): Promise<Booking[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select()
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
