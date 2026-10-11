import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "./client";
import { createBooking, listMyBookings, type CreateBookingInput } from "./bookings";

vi.mock("./client", () => ({ createClient: vi.fn() }));

const createClientMock = vi.mocked(createClient);
const bookingInput: CreateBookingInput = {
  guestName: "Andrea Lim",
  guestEmail: "andrea@example.test",
  bookingDate: "2026-11-20",
  startTime: "13:00",
  durationHours: 3,
  space: "study-seat",
  seatCodes: ["UA01"],
};

beforeEach(() => {
  createClientMock.mockReset();
});

describe("admin createBooking", () => {
  it("does not invoke the booking RPC for an unauthenticated operator", async () => {
    const rpc = vi.fn();
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "expired" } }),
      },
      rpc,
    } as never);

    await expect(createBooking(bookingInput)).rejects.toThrow("Sign in before creating a booking.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps booking details to the atomic database RPC", async () => {
    const booking = { id: "booking-admin-1", reservation_code: "JIT-ADMIN" };
    const rpc = vi.fn().mockResolvedValue({ data: booking, error: null });
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-1" } }, error: null }) },
      rpc,
    } as never);

    await expect(createBooking(bookingInput)).resolves.toBe(booking);
    expect(rpc).toHaveBeenCalledWith("create_booking", {
      p_guest_name: "Andrea Lim",
      p_guest_email: "andrea@example.test",
      p_booking_date: "2026-11-20",
      p_start_time: "13:00",
      p_duration_hours: 3,
      p_space: "study-seat",
      p_seat_codes: ["UA01"],
    });
  });

  it("surfaces an RPC failure", async () => {
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-1" } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "Seat unavailable" } }),
    } as never);

    await expect(createBooking(bookingInput)).rejects.toThrow("Seat unavailable");
  });
});

describe("admin listMyBookings", () => {
  it("loads newest bookings first", async () => {
    const bookings = [{ id: "booking-admin-1" }];
    const secondOrder = vi.fn().mockResolvedValue({ data: bookings, error: null });
    const firstOrder = vi.fn().mockReturnValue({ order: secondOrder });
    const select = vi.fn().mockReturnValue({ order: firstOrder });
    const from = vi.fn().mockReturnValue({ select });
    createClientMock.mockReturnValue({ from } as never);

    await expect(listMyBookings()).resolves.toBe(bookings);
    expect(from).toHaveBeenCalledWith("bookings");
    expect(firstOrder).toHaveBeenCalledWith("booking_date", { ascending: false });
    expect(secondOrder).toHaveBeenCalledWith("start_time", { ascending: false });
  });

  it("surfaces a query failure", async () => {
    const secondOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "Query failed" } });
    const firstOrder = vi.fn().mockReturnValue({ order: secondOrder });
    const select = vi.fn().mockReturnValue({ order: firstOrder });
    createClientMock.mockReturnValue({ from: vi.fn().mockReturnValue({ select }) } as never);

    await expect(listMyBookings()).rejects.toThrow("Query failed");
  });
});
