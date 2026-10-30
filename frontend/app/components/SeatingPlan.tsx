"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/** Canonical layout size — scaled to fill wide containers and remain tappable on mobile. */
const DESIGN_WIDTH = 1100;
const DESIGN_HEIGHT = 560;
const MIN_MOBILE_SCALE = 0.8;

interface SeatingPlanProps {
  renderSeat: (id: string) => ReactNode;
}

export function SeatingPlan({ renderSeat }: SeatingPlanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MIN_MOBILE_SCALE);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const available = el.clientWidth;
      setScale(Math.max(available / DESIGN_WIDTH, MIN_MOBILE_SCALE));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scaledHeight = DESIGN_HEIGHT * scale;
  const scaledWidth = DESIGN_WIDTH * scale;

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto overscroll-x-contain pb-2 [scrollbar-color:#c4b5a3_transparent] [scrollbar-width:thin]"
      style={{ height: scaledHeight + 8 }}
      role="region"
      aria-label="Interactive seating plan"
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
          {/* Floor shell — outer walls */}
          <div
            className="absolute inset-2 rounded-2xl border-[3px] border-[#8b7355] bg-gradient-to-br from-[#faf8f5] via-[#f5f0e8] to-[#ebe4d8] shadow-[inset_0_2px_12px_rgba(45,37,32,0.06)]"
            aria-hidden
          >
            <div className="absolute inset-1.5 rounded-xl border border-[#c4b5a3]/60 pointer-events-none" />
            <div className="absolute top-2 left-2 w-7 h-7 border-t-2 border-l-2 border-[#6b5e52]/40 rounded-tl-sm pointer-events-none" />
            <div className="absolute top-2 right-2 w-7 h-7 border-t-2 border-r-2 border-[#6b5e52]/40 rounded-tr-sm pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-7 h-7 border-b-2 border-l-2 border-[#6b5e52]/40 rounded-bl-sm pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-7 h-7 border-b-2 border-r-2 border-[#6b5e52]/40 rounded-br-sm pointer-events-none" />
          </div>

          {/* Solo Learner/Worker — first divider bank */}
          <div className="absolute left-[2.5%] top-[4%] flex flex-col gap-2">
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

          {/* Zone: Cashier */}
          <div className="absolute left-[27%] top-[22%] w-[11%] h-[15%] border-2 border-dashed border-[#8b7355]/70 rounded-xl bg-white/50 flex items-center justify-center">
            <span className="text-sm font-medium tracking-wide text-[#6b5e52]">FRONT DESK</span>
          </div>

          {/* Floor Desk Setup */}
          <div className="absolute left-[38%] top-[4%] grid grid-cols-4 gap-x-2 gap-y-2">
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

          {/* Solo Learner/Worker — second divider bank */}
          <div className="absolute left-[2.5%] top-[38%] flex gap-2">
            {renderSeat("SO09")}
            {renderSeat("SO10")}
            {renderSeat("SO11")}
            {renderSeat("SO12")}
          </div>

          {/* Zone: Entrance */}
          <div className="absolute left-[27%] top-[54%] w-[11%]">
            <div className="h-12 bg-[#d1d5db]/90 border border-[#9ca3af]/50 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-xs font-medium tracking-wider text-[#4b5563]">ENTRANCE</span>
            </div>
          </div>

          {/* High Chair — left bank */}
          <div className="absolute left-[40%] top-[47%] flex flex-col gap-2.5 pl-2 border-l-2 border-[#c4b5a3]/50">
            {renderSeat("HC01")}
            {renderSeat("HC02")}
            {renderSeat("HC03")}
            {renderSeat("HC04")}
          </div>

          {/* Group Study — three large tables */}
          <div className="absolute left-[50%] right-[9%] top-[44%] flex justify-between">
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

          {/* High Chair — right bank */}
          <div className="absolute right-[2.5%] top-[47%] flex flex-col gap-2.5 pr-2 border-r-2 border-[#c4b5a3]/50">
            {renderSeat("HC15")}
            {renderSeat("HC14")}
            {renderSeat("HC13")}
            {renderSeat("HC16")}
          </div>

          {/* High Chair — bottom bank */}
          <div className="absolute left-[47%] right-[3%] top-[81%] flex justify-between pt-2 border-t-2 border-dashed border-[#c4b5a3]/40">
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
  );
}
