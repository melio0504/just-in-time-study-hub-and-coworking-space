"use client";

import { useState } from "react";
import { FileText, SlidersHorizontal } from "lucide-react";

import { hasAdminAccess } from "@/lib/admin-access";
import { useAdminAccess } from "../../../_components/AdminShell";
import { AdminOperationsPage } from "../_components/AdminOperationsPage";
import { BusinessSettingsManager } from "./BusinessSettingsManager";

type CmsView = "announcements" | "business";

export default function CmsPage() {
  const access = useAdminAccess();
  const [view, setView] = useState<CmsView>("announcements");

  if (!hasAdminAccess(access, "announcements")) {
    return <AdminOperationsPage section="announcements" />;
  }

  return (
    <div>
      <div className="mx-auto mb-7 flex max-w-[1500px] justify-center sm:justify-start">
        <div className="inline-flex w-full rounded-2xl border border-[#ded3c6] bg-white p-1.5 shadow-sm sm:w-auto" role="tablist" aria-label="Content management section">
          <CmsTab active={view === "announcements"} onClick={() => setView("announcements")} icon={FileText}>
            Announcements
          </CmsTab>
          <CmsTab active={view === "business"} onClick={() => setView("business")} icon={SlidersHorizontal}>
            Business settings
          </CmsTab>
        </div>
      </div>
      {view === "announcements"
        ? <AdminOperationsPage section="announcements" />
        : <BusinessSettingsManager />}
    </div>
  );
}

function CmsTab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${active
        ? "bg-[#2d2520] text-white shadow-sm"
        : "text-[#6b5e52] hover:bg-[#fff8e8] hover:text-[#2d2520]"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
