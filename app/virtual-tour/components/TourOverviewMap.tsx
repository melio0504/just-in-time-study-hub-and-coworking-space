"use client";

import { SeatingPlan } from '@/app/components/SeatingPlan';
import { getReservedSeatsForDate } from '@/app/admin/lib/seats';

interface TourOverviewMapProps {
  activeSeatId: string;
  date: string;
  onSelectSeat: (seatId: string) => void;
}

export function TourOverviewMap({ activeSeatId, date, onSelectSeat }: TourOverviewMapProps) {
  const reserved = new Set(getReservedSeatsForDate(date));

  return (
    <div className="pointer-events-auto w-full max-w-[320px] rounded-2xl border border-white/20 bg-black/50 p-2 backdrop-blur-md shadow-lg">
      <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#f5cf82]">
        Floor overview
      </p>
      <div className="rounded-2xl border border-[#e8e0d4] bg-[#f3f0eb] p-2">
        <div className="overflow-visible">
          <SeatingPlan
            renderSeat={(id) => {
              const isActive = id === activeSeatId;
              const isReserved = reserved.has(id);

              return (
                <button
                  type="button"
                  onClick={() => onSelectSeat(id)}
                  title={`${id} — ${isReserved ? 'Not available' : 'Available'}`}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-[7px] font-semibold leading-none transition ${
                    isActive
                      ? 'z-10 border-[#e5a930] bg-[#e5a930] text-[#241b0f] ring-2 ring-[#e5a930]/50 scale-110'
                      : isReserved
                        ? 'border-[#9ca3af] bg-[#d1d5db] text-[#4b5563] hover:border-[#6b7280]'
                        : 'border-[#c4b5a3] bg-white text-[#6b5e52] hover:border-[#e5a930] hover:bg-[#fff8ed]'
                  }`}
                >
                  {id.slice(2)}
                </button>
              );
            }}
          />
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-3 px-1 text-[10px] text-white/70">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm border border-[#c4b5a3] bg-white" />
          Available
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[#d1d5db]" />
          Not available
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[#e5a930]" />
          You are here
        </span>
      </div>
    </div>
  );
}
