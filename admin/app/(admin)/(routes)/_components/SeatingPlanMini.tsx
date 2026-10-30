"use client";

import { useMemo } from "react";

type SeatStatus = "available" | "reserved" | "occupied" | "maintenance";

interface Seat {
  id: string;
  status: SeatStatus;
}

interface SeatingPlanMiniProps {
  seats: Seat[];
  onSeatClick?: (seatId: string) => void;
  busySeatId?: string | null;
}

export function SeatingPlanMini({ seats, onSeatClick, busySeatId }: SeatingPlanMiniProps) {
  const seatStatuses = useMemo(() => new Map(seats.map((seat) => [seat.id, seat.status])), [seats]);

  const renderSeat = (id: string) => {
    const status = seatStatuses.get(id) ?? "available";
    const colors = {
      available: "bg-[#e8e8e8] text-[#2d2520]",
      reserved: "bg-[#9ca3af] text-white",
      occupied: "bg-[#e5a930] text-white shadow-md ring-2 ring-[#e5a930]/25",
      maintenance: "bg-red-100 text-red-700",
    };

    return (
      <button
        type="button"
        key={id}
        onClick={() => onSeatClick?.(id)}
        disabled={
          !onSeatClick || status === "reserved" || status === "maintenance" || busySeatId === id
        }
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xs font-medium transition-all ${colors[status]} ${onSeatClick && status !== "reserved" && status !== "maintenance" ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg" : "cursor-default"}`}
        aria-label={`${id}, ${status}`}
        title={`${id} — ${status}`}>
        {busySeatId === id ? "…" : id}
      </button>
    );
  };

  return (
    <div className="seating-plan-shell">
      <div
        className="seating-plan-viewport w-full overflow-x-auto overscroll-x-contain pb-2 [scrollbar-color:#c4b5a3_transparent] [scrollbar-width:thin]"
        role="region"
        aria-label="Current seating plan"
        tabIndex={0}>
        <div className="seating-plan-sizer relative mx-auto">
          <div className="seating-plan-canvas relative origin-top-left">
            <div
              className="absolute inset-2 rounded-2xl border-[3px] border-[#8b7355] bg-linear-to-br from-[#faf8f5] via-[#f5f0e8] to-[#ebe4d8] shadow-[inset_0_2px_12px_rgba(45,37,32,0.06)]"
              aria-hidden>
              <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-[#c4b5a3]/60" />
              <div className="pointer-events-none absolute top-2 left-2 h-7 w-7 rounded-tl-sm border-t-2 border-l-2 border-[#6b5e52]/40" />
              <div className="pointer-events-none absolute top-2 right-2 h-7 w-7 rounded-tr-sm border-t-2 border-r-2 border-[#6b5e52]/40" />
              <div className="pointer-events-none absolute bottom-2 left-2 h-7 w-7 rounded-bl-sm border-b-2 border-l-2 border-[#6b5e52]/40" />
              <div className="pointer-events-none absolute right-2 bottom-2 h-7 w-7 rounded-br-sm border-r-2 border-b-2 border-[#6b5e52]/40" />
              <div className="pointer-events-none absolute bottom-0 left-[26%] h-1.5 w-[11%] rounded-t-sm bg-[#d1d5db]" />
            </div>

            <div className="absolute top-[4%] left-[2.5%] flex flex-col gap-2">
              <div className="flex gap-2">
                {renderSeat("SO01")}
                {renderSeat("SO02")}
                {renderSeat("SO03")}
                {renderSeat("SO04")}
              </div>
              <div className="flex gap-2">
                {renderSeat("SO05")}
                {renderSeat("SO06")}
                {renderSeat("SO07")}
                {renderSeat("SO08")}
              </div>
            </div>

            <div className="absolute top-[22%] left-[27%] flex h-[15%] w-[11%] items-center justify-center rounded-xl border-2 border-dashed border-[#8b7355]/70 bg-white/50">
              <span className="text-sm font-medium tracking-wide text-[#6b5e52]">FRONT DESK</span>
            </div>

            <div className="absolute top-[4%] left-[38%] grid grid-cols-4 gap-x-2 gap-y-2">
              {renderSeat("FD01")}
              {renderSeat("FD02")}
              {renderSeat("FD03")}
              {renderSeat("FD04")}
              {renderSeat("FD05")}
              {renderSeat("FD06")}
              {renderSeat("FD07")}
              {renderSeat("FD08")}
              <div className="col-start-3">{renderSeat("FD09")}</div>
              <div className="col-start-4">{renderSeat("FD10")}</div>
            </div>

            <div className="absolute top-[38%] left-[2.5%] flex gap-2">
              {renderSeat("SO09")}
              {renderSeat("SO10")}
              {renderSeat("SO11")}
              {renderSeat("SO12")}
            </div>

            <div className="absolute top-[54%] left-[27%] w-[11%]">
              <div className="flex h-12 items-center justify-center rounded-lg border border-[#9ca3af]/50 bg-[#d1d5db]/90 shadow-sm">
                <span className="text-xs font-medium tracking-wider text-[#4b5563]">ENTRANCE</span>
              </div>
            </div>

            <div className="absolute top-[47%] left-[40%] flex flex-col gap-2.5 border-l-2 border-[#c4b5a3]/50 pl-2">
              {renderSeat("HC01")}
              {renderSeat("HC02")}
              {renderSeat("HC03")}
              {renderSeat("HC04")}
            </div>

            <div className="absolute top-[44%] right-[9%] left-[50%] flex justify-between">
              <div className="flex flex-col gap-5">
                <div className="flex gap-2">
                  {renderSeat("GS01")}
                  {renderSeat("GS02")}
                </div>
                <div className="flex gap-2">
                  {renderSeat("GS03")}
                  {renderSeat("GS04")}
                </div>
              </div>
              <div className="flex flex-col gap-5">
                <div className="flex gap-2">
                  {renderSeat("GS05")}
                  {renderSeat("GS06")}
                </div>
                <div className="flex gap-2">
                  {renderSeat("GS07")}
                  {renderSeat("GS08")}
                </div>
              </div>
              <div className="flex flex-col gap-5">
                <div className="flex gap-2">
                  {renderSeat("GS09")}
                  {renderSeat("GS10")}
                </div>
                <div className="flex gap-2">
                  {renderSeat("GS11")}
                  {renderSeat("GS12")}
                </div>
              </div>
            </div>

            <div className="absolute top-[47%] right-[2.5%] flex flex-col gap-2.5 border-r-2 border-[#c4b5a3]/50 pr-2">
              {renderSeat("HC15")}
              {renderSeat("HC14")}
              {renderSeat("HC13")}
              {renderSeat("HC16")}
            </div>

            <div className="absolute top-[81%] right-[3%] left-[47%] flex justify-between border-t-2 border-dashed border-[#c4b5a3]/40 pt-2">
              {renderSeat("HC05")}
              {renderSeat("HC06")}
              {renderSeat("HC07")}
              {renderSeat("HC08")}
              {renderSeat("HC09")}
              {renderSeat("HC10")}
              {renderSeat("HC11")}
              {renderSeat("HC12")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
