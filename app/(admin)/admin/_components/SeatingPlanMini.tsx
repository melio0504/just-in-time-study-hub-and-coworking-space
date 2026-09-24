type SeatStatus = 'available' | 'reserved';

interface Seat {
  id: string;
  status: SeatStatus;
}

interface SeatingPlanMiniProps {
  seats: Seat[];
}

interface MiniSeatProps {
  id: string;
  status: SeatStatus;
}

function MiniSeat({ id, status }: MiniSeatProps) {
  const colors = {
    available: 'bg-[#e8e8e8]',
    reserved: 'bg-[#9ca3af]',
  };

  return (
    <div className={`w-6 h-6 rounded ${colors[status]} text-[6px] flex items-center justify-center`}>
      {id}
    </div>
  );
}

export function SeatingPlanMini({ seats }: SeatingPlanMiniProps) {
  const getSeatStatus = (seatId: string): SeatStatus => {
    return seats.find(s => s.id === seatId)?.status || 'available';
  };

  return (
    <div className="bg-[#f9f9f9] rounded-xl p-4 overflow-x-auto">
      <div className="relative min-w-200">
        {/* Left Area */}
        <div className="absolute left-0 top-0 flex flex-col gap-1">
          <div className="flex gap-1">
            <MiniSeat id="LA01" status={getSeatStatus("LA01")} />
            <MiniSeat id="LA02" status={getSeatStatus("LA02")} />
            <MiniSeat id="LA03" status={getSeatStatus("LA03")} />
            <MiniSeat id="LA04" status={getSeatStatus("LA04")} />
          </div>
          <div className="flex gap-1">
            <MiniSeat id="LA05" status={getSeatStatus("LA05")} />
            <MiniSeat id="LA06" status={getSeatStatus("LA06")} />
            <MiniSeat id="LA07" status={getSeatStatus("LA07")} />
            <MiniSeat id="LA08" status={getSeatStatus("LA08")} />
          </div>
        </div>

        {/* Cashier */}
        <div className="absolute left-37.5 top-0 w-24 h-12 border border-[#6b5e52] rounded-lg flex items-center justify-center">
          <span className="text-[8px] text-[#2d2520]">CASHIER</span>
        </div>

        {/* Upper Area */}
        <div className="absolute left-70 top-0 flex flex-col gap-1">
          <div className="flex gap-1">
            <MiniSeat id="UA01" status={getSeatStatus("UA01")} />
            <MiniSeat id="UA02" status={getSeatStatus("UA02")} />
            <MiniSeat id="UA03" status={getSeatStatus("UA03")} />
            <MiniSeat id="UA04" status={getSeatStatus("UA04")} />
          </div>
          <div className="flex gap-1">
            <MiniSeat id="UA05" status={getSeatStatus("UA05")} />
            <MiniSeat id="UA06" status={getSeatStatus("UA06")} />
            <MiniSeat id="UA07" status={getSeatStatus("UA07")} />
            <MiniSeat id="UA08" status={getSeatStatus("UA08")} />
          </div>
          <div className="flex gap-1 justify-end mt-1">
            <MiniSeat id="UB01" status={getSeatStatus("UB01")} />
            <MiniSeat id="UB02" status={getSeatStatus("UB02")} />
          </div>
        </div>

        {/* Left Bottom */}
        <div className="absolute left-0 top-22.5 flex gap-1">
          <MiniSeat id="LB01" status={getSeatStatus("LB01")} />
          <MiniSeat id="LB02" status={getSeatStatus("LB02")} />
          <MiniSeat id="LB03" status={getSeatStatus("LB03")} />
          <MiniSeat id="LB04" status={getSeatStatus("LB04")} />
        </div>

        {/* Doorway */}
        <div className="absolute left-37.5 top-32.5">
          <div className="w-24 h-6 bg-[#d1d5db] rounded flex items-center justify-center">
            <span className="text-[6px] text-[#2d2520]">DOORWAY</span>
          </div>
        </div>

        {/* Left Wall */}
        <div className="absolute left-85 top-32.5 flex flex-col gap-1.5">
          <MiniSeat id="LW01" status={getSeatStatus("LW01")} />
          <MiniSeat id="LW02" status={getSeatStatus("LW02")} />
          <MiniSeat id="LW03" status={getSeatStatus("LW03")} />
          <MiniSeat id="LW04" status={getSeatStatus("LW04")} />
        </div>

        {/* Right Area */}
        <div className="absolute left-100 top-30 flex gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex gap-1">
              <MiniSeat id="RA01" status={getSeatStatus("RA01")} />
              <MiniSeat id="RA02" status={getSeatStatus("RA02")} />
            </div>
            <div className="flex gap-1">
              <MiniSeat id="RA03" status={getSeatStatus("RA03")} />
              <MiniSeat id="RA04" status={getSeatStatus("RA04")} />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-1">
              <MiniSeat id="RB01" status={getSeatStatus("RB01")} />
              <MiniSeat id="RB02" status={getSeatStatus("RB02")} />
            </div>
            <div className="flex gap-1">
              <MiniSeat id="RB03" status={getSeatStatus("RB03")} />
              <MiniSeat id="RB04" status={getSeatStatus("RB04")} />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-1">
              <MiniSeat id="RC01" status={getSeatStatus("RC01")} />
              <MiniSeat id="RC02" status={getSeatStatus("RC02")} />
            </div>
            <div className="flex gap-1">
              <MiniSeat id="RC03" status={getSeatStatus("RC03")} />
              <MiniSeat id="RC04" status={getSeatStatus("RC04")} />
            </div>
          </div>
        </div>

        {/* Right Wall */}
        <div className="absolute left-170 top-32.5 flex flex-col gap-1.5">
          <MiniSeat id="RW01" status={getSeatStatus("RW01")} />
          <MiniSeat id="RW02" status={getSeatStatus("RW02")} />
          <MiniSeat id="RW03" status={getSeatStatus("RW03")} />
          <MiniSeat id="RW04" status={getSeatStatus("RW04")} />
        </div>

        {/* Bottom Row */}
        <div className="absolute left-100 top-60 flex gap-1">
          <MiniSeat id="BR01" status={getSeatStatus("BR01")} />
          <MiniSeat id="BR02" status={getSeatStatus("BR02")} />
          <MiniSeat id="BR03" status={getSeatStatus("BR03")} />
          <MiniSeat id="BR04" status={getSeatStatus("BR04")} />
          <MiniSeat id="BR05" status={getSeatStatus("BR05")} />
          <MiniSeat id="BR06" status={getSeatStatus("BR06")} />
          <MiniSeat id="BR07" status={getSeatStatus("BR07")} />
          <MiniSeat id="BR08" status={getSeatStatus("BR08")} />
        </div>

        {/* Spacer */}
        <div className="h-62.5"></div>
      </div>
    </div>
  );
}
