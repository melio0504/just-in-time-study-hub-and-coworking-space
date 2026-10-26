import { Info } from "lucide-react";

export function CapstoneNotice() {
  return (
    <aside
      id="capstone-notice"
      aria-label="Capstone project disclaimer"
      className="relative z-[60] border-b border-amber-300/70 bg-[#fff3cf] px-4 py-2.5 text-[#5b461d] shadow-[0_1px_0_rgba(120,86,20,0.08)] sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl items-start justify-center gap-2.5 text-center text-xs leading-5 sm:items-center sm:text-sm">
        <p>
          <strong className="font-semibold">Made by students for Capstone Project:</strong>{" "}
          This is not the official Just In Time Study Hub and Coworking Space website. Applications,
          reservations, and payments made here are still not official. For real bookings,
          please contact the study hub's Facebook page directly.
        </p>
      </div>
    </aside>
  );
}
