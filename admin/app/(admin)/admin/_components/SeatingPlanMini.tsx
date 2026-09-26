"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SeatStatus = "available" | "reserved";

interface Seat {
  id: string;
  status: SeatStatus;
}

interface SeatingPlanMiniProps {
  seats: Seat[];
}

const DESIGN_WIDTH = 1100;
const DESIGN_HEIGHT = 560;
const MIN_MOBILE_SCALE = 0.8;

export function SeatingPlanMini({ seats }: SeatingPlanMiniProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MIN_MOBILE_SCALE);
  const seatStatuses = useMemo(
    () => new Map(seats.map((seat) => [seat.id, seat.status])),
    [seats],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateScale = () => {
      setScale(Math.max(element.clientWidth / DESIGN_WIDTH, MIN_MOBILE_SCALE));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const renderSeat = (id: string) => {
    const status = seatStatuses.get(id) ?? "available";
    const colors = {
      available: "bg-[#e8e8e8] text-[#2d2520]",
      reserved: "bg-[#9ca3af] text-white",
    };

    return (
      <div
        key={id}
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xs font-medium ${colors[status]}`}
        aria-label={`${id}, ${status}`}
        title={`${id} — ${status}`}
      >
        {id}
      </div>
    );
  };

  const scaledHeight = DESIGN_HEIGHT * scale;
  const scaledWidth = DESIGN_WIDTH * scale;

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto overscroll-x-contain pb-2 [scrollbar-color:#c4b5a3_transparent] [scrollbar-width:thin]"
      style={{ height: scaledHeight + 8 }}
      role="region"
      aria-label="Current seating plan"
      tabIndex={0}
    >
      <div className="relative" style={{ width: scaledWidth, height: scaledHeight }}>
        <div
          className="relative origin-top-left"
          style={{
            width: DESIGN_WIDTH,
            height: DESIGN_HEIGHT,
            transform: `scale(${scale})`,
          }}
        >
          <div
            className="absolute inset-2 rounded-2xl border-[3px] border-[#8b7355] bg-linear-to-br from-[#faf8f5] via-[#f5f0e8] to-[#ebe4d8] shadow-[inset_0_2px_12px_rgba(45,37,32,0.06)]"
            aria-hidden
          >
            <div className="pointer-events-none absolute inset-1.5 rounded-xl border border-[#c4b5a3]/60" />
            <div className="pointer-events-none absolute top-2 left-2 h-7 w-7 rounded-tl-sm border-t-2 border-l-2 border-[#6b5e52]/40" />
            <div className="pointer-events-none absolute top-2 right-2 h-7 w-7 rounded-tr-sm border-t-2 border-r-2 border-[#6b5e52]/40" />
            <div className="pointer-events-none absolute bottom-2 left-2 h-7 w-7 rounded-bl-sm border-b-2 border-l-2 border-[#6b5e52]/40" />
            <div className="pointer-events-none absolute right-2 bottom-2 h-7 w-7 rounded-br-sm border-r-2 border-b-2 border-[#6b5e52]/40" />
            <div className="pointer-events-none absolute bottom-0 left-[26%] h-1.5 w-[11%] rounded-t-sm bg-[#d1d5db]" />
          </div>

          <div className="absolute top-[4%] left-[2.5%] flex flex-col gap-2">
            <div className="flex gap-2">
              {renderSeat("LA01")}
              {renderSeat("LA02")}
              {renderSeat("LA03")}
              {renderSeat("LA04")}
            </div>
            <div className="flex gap-2">
              {renderSeat("LA05")}
              {renderSeat("LA06")}
              {renderSeat("LA07")}
              {renderSeat("LA08")}
            </div>
          </div>

          <div className="absolute top-[22%] left-[27%] flex h-[15%] w-[11%] items-center justify-center rounded-xl border-2 border-dashed border-[#8b7355]/70 bg-white/50">
            <span className="text-sm font-medium tracking-wide text-[#6b5e52]">CASHIER</span>
          </div>

          <div className="absolute top-[4%] left-[38%] grid grid-cols-4 gap-x-2 gap-y-2">
            {renderSeat("UA01")}
            {renderSeat("UA02")}
            {renderSeat("UA03")}
            {renderSeat("UA04")}
            {renderSeat("UA05")}
            {renderSeat("UA06")}
            {renderSeat("UA07")}
            {renderSeat("UA08")}
            <div className="col-start-3">{renderSeat("UB01")}</div>
            <div className="col-start-4">{renderSeat("UB02")}</div>
          </div>

          <div className="absolute top-[38%] left-[2.5%] flex gap-2">
            {renderSeat("LB01")}
            {renderSeat("LB02")}
            {renderSeat("LB03")}
            {renderSeat("LB04")}
          </div>

          <div className="absolute top-[54%] left-[27%] w-[11%]">
            <div className="flex h-12 items-center justify-center rounded-lg border border-[#9ca3af]/50 bg-[#d1d5db]/90 shadow-sm">
              <span className="text-xs font-medium tracking-wider text-[#4b5563]">ENTRANCE</span>
            </div>
          </div>

          <div className="absolute top-[47%] left-[40%] flex flex-col gap-2.5 border-l-2 border-[#c4b5a3]/50 pl-2">
            {renderSeat("LW01")}
            {renderSeat("LW02")}
            {renderSeat("LW03")}
            {renderSeat("LW04")}
          </div>

          <div className="absolute top-[44%] right-[9%] left-[50%] flex justify-between">
            <div className="flex flex-col gap-5">
              <div className="flex gap-2">
                {renderSeat("RA01")}
                {renderSeat("RA02")}
              </div>
              <div className="flex gap-2">
                {renderSeat("RA03")}
                {renderSeat("RA04")}
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex gap-2">
                {renderSeat("RB01")}
                {renderSeat("RB02")}
              </div>
              <div className="flex gap-2">
                {renderSeat("RB03")}
                {renderSeat("RB04")}
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex gap-2">
                {renderSeat("RC01")}
                {renderSeat("RC02")}
              </div>
              <div className="flex gap-2">
                {renderSeat("RC03")}
                {renderSeat("RC04")}
              </div>
            </div>
          </div>

          <div className="absolute top-[50%] right-[2.5%] flex flex-col gap-2.5 border-r-2 border-[#c4b5a3]/50 pr-2">
            {renderSeat("RW01")}
            {renderSeat("RW02")}
            {renderSeat("RW03")}
            {renderSeat("RW04")}
          </div>

          <div className="absolute top-[82%] right-[3%] left-[47%] flex justify-between border-t-2 border-dashed border-[#c4b5a3]/40 pt-2">
            {renderSeat("BR01")}
            {renderSeat("BR02")}
            {renderSeat("BR03")}
            {renderSeat("BR04")}
            {renderSeat("BR05")}
            {renderSeat("BR06")}
            {renderSeat("BR07")}
            {renderSeat("BR08")}
          </div>
        </div>
      </div>
    </div>
  );
}
