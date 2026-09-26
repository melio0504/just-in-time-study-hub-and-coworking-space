"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

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
          <div className="absolute left-[26%] bottom-0 w-[11%] h-1.5 bg-[#d1d5db] rounded-t-sm pointer-events-none" />
        </div>

        {/* Zone: Left Area */}
        <div className="absolute left-[2.5%] top-[4%] flex flex-col gap-2">
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

        {/* Zone: Cashier */}
        <div className="absolute left-[27%] top-[22%] w-[11%] h-[15%] border-2 border-dashed border-[#8b7355]/70 rounded-xl bg-white/50 flex items-center justify-center">
          <span className="text-sm font-medium tracking-wide text-[#6b5e52]">CASHIER</span>
        </div>

        {/* Zone: Upper Area — UA grid with UB under UA07 & UA08 */}
        <div className="absolute left-[38%] top-[4%] grid grid-cols-4 gap-x-2 gap-y-2">
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

        {/* Zone: Left Bottom */}
        <div className="absolute left-[2.5%] top-[38%] flex gap-2">
          {renderSeat("LB01")}
          {renderSeat("LB02")}
          {renderSeat("LB03")}
          {renderSeat("LB04")}
        </div>

        {/* Zone: Entrance */}
        <div className="absolute left-[27%] top-[54%] w-[11%]">
          <div className="h-12 bg-[#d1d5db]/90 border border-[#9ca3af]/50 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-xs font-medium tracking-wider text-[#4b5563]">ENTRANCE</span>
          </div>
        </div>

        {/* Zone: Left Wall */}
        <div className="absolute left-[40%] top-[47%] flex flex-col gap-2.5 pl-2 border-l-2 border-[#c4b5a3]/50">
          {renderSeat("LW01")}
          {renderSeat("LW02")}
          {renderSeat("LW03")}
          {renderSeat("LW04")}
        </div>

        {/* Zone: Right Area — fills space between left wall and right wall */}
        <div className="absolute left-[50%] right-[9%] top-[44%] flex justify-between">
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

        {/* Zone: Right Wall — pinned to the right edge */}
        <div className="absolute right-[2.5%] top-[50%] flex flex-col gap-2.5 pr-2 border-r-2 border-[#c4b5a3]/50">
          {renderSeat("RW01")}
          {renderSeat("RW02")}
          {renderSeat("RW03")}
          {renderSeat("RW04")}
        </div>

          {/* Zone: Bottom Row — spans the main study area width */}
          <div className="absolute left-[47%] right-[3%] top-[82%] flex justify-between pt-2 border-t-2 border-dashed border-[#c4b5a3]/40">
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
