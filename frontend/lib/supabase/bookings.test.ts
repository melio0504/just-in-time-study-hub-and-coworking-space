import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "./client";
import { cancelBooking, createBooking, listMyBookings, type CreateBookingInput } from "./bookings";

vi.mock("./client", () => ({ createClient: vi.fn() }));

const createClientMock = vi.mocked(createClient);
const bookingInput: CreateBookingInput = {
  guestName: "Maria Santos",
  guestEmail: "maria@example.test",
  bookingDate: "2026-10-20",
  startTime: "09:00",
  durationHours: 2,
  space: "study-seat",
  seatCodes: ["SO01", "SO02"],
};

beforeEach(() => {
  createClientMock.mockReset();
});

describe("createBooking", () => {
  it("requires an authenticated user before calling the RPC", async () => {
    const rpc = vi.fn();
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      rpc,
    } as never);

    await expect(createBooking(bookingInput)).rejects.toThrow(
      "Sign in before creating a booking.",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps application input to the atomic booking RPC", async () => {
    const booking = { id: "booking-1", reservation_code: "JIT-TEST" };
    const rpc = vi.fn().mockResolvedValue({ data: booking, error: null });
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      rpc,
    } as never);

    await expect(createBooking(bookingInput)).resolves.toBe(booking);
    expect(rpc).toHaveBeenCalledWith("create_booking", {
      p_guest_name: "Maria Santos",
      p_guest_email: "maria@example.test",
      p_booking_date: "2026-10-20",
      p_start_time: "09:00",
      p_duration_hours: 2,
      p_space: "study-seat",
      p_seat_codes: ["SO01", "SO02"],
    });
  });

  it("surfaces database errors", async () => {
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) },
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "Seat unavailable" } }),
    } as never);

    await expect(createBooking(bookingInput)).rejects.toThrow("Seat unavailable");
  });
});

describe("cancelBooking", () => {
  it("calls the customer cancellation RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockReturnValue({ rpc } as never);

    await expect(cancelBooking("booking-1")).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("cancel_booking", {
      p_booking_id: "booking-1",
    });
  });

  it("surfaces cancellation errors", async () => {
    createClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ error: { message: "Booking cannot be cancelled" } }),
    } as never);

    await expect(cancelBooking("booking-1")).rejects.toThrow("Booking cannot be cancelled");
  });
});

describe("listMyBookings", () => {
  it("orders bookings by newest date and start time", async () => {
    const bookings = [{ id: "booking-1" }];
    const secondOrder = vi.fn().mockResolvedValue({ data: bookings, error: null });
    const firstOrder = vi.fn().mockReturnValue({ order: secondOrder });
    const select = vi.fn().mockReturnValue({ order: firstOrder });
    const from = vi.fn().mockReturnValue({ select });
    createClientMock.mockReturnValue({ from } as never);

    await expect(listMyBookings()).resolves.toBe(bookings);
    expect(from).toHaveBeenCalledWith("bookings");
    expect(select).toHaveBeenCalledWith();
    expect(firstOrder).toHaveBeenCalledWith("booking_date", { ascending: false });
    expect(secondOrder).toHaveBeenCalledWith("start_time", { ascending: false });
  });

  it("surfaces query errors", async () => {
    const secondOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "Query failed" } });
    const firstOrder = vi.fn().mockReturnValue({ order: secondOrder });
    const select = vi.fn().mockReturnValue({ order: firstOrder });
    createClientMock.mockReturnValue({ from: vi.fn().mockReturnValue({ select }) } as never);

    await expect(listMyBookings()).rejects.toThrow("Query failed");
  });
});
