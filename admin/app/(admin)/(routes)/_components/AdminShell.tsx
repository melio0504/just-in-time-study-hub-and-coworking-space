"use client";

import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  ShieldCheck,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { type AdminAccess, hasAdminAccess, type StaffPermission } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: StaffPermission;
  ownerOnly?: boolean;
};

const AdminAccessContext = createContext<AdminAccess | null>(null);

export function useAdminAccess() {
  const access = useContext(AdminAccessContext);
  if (!access) throw new Error("useAdminAccess must be used inside AdminShell.");
  return access;
}

const navItems: NavItem[] = [
  {
    label: "Live overview",
    description: "Seats and activity",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "seating",
  },
  {
    label: "Walk-ins",
    description: "Sessions and billing",
    href: "/walk-ins",
    icon: UsersRound,
    permission: "seating",
  },
  {
    label: "Reservations",
    description: "Manage bookings",
    href: "/reservations",
    icon: CalendarDays,
    permission: "reservations",
  },
  {
    label: "Content",
    description: "Updates and business settings",
    href: "/cms",
    icon: FileText,
    permission: "announcements",
  },
  {
    label: "Analytics",
    description: "Business performance",
    href: "/analytics",
    icon: BarChart3,
    ownerOnly: true,
  },
  {
    label: "Employee accounts",
    description: "Create staff access",
    href: "/staffs",
    icon: UserCog,
    ownerOnly: true,
  },
  {
    label: "Access logs",
    description: "Staff activity",
    href: "/logs",
    icon: ShieldCheck,
    ownerOnly: true,
  },
];

function AdminNav({
  access,
  collapsed = false,
  onNavigate,
}: {
  access: AdminAccess;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => {
    if (item.ownerOnly) return access.role === "admin";
    return item.permission ? hasAdminAccess(access, item.permission) : true;
  });
  return (
    <nav className="flex-1 space-y-1.5" aria-label="Admin navigation">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? item.label : undefined}
            title={collapsed ? `${item.label} — ${item.description}` : undefined}
            className={`group flex items-center rounded-2xl py-3 transition-all ${collapsed ? "justify-center px-2" : "gap-3 px-3.5"} ${active ? "bg-[#2d2520] text-white shadow-lg shadow-[#2d2520]/15" : "text-[#6b5e52] hover:bg-[#fef3dc] hover:text-[#2d2520]"}`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-[#e5a930]" : "bg-[#f7f1e8] text-[#a27621] group-hover:bg-white"}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span
                    className={`block truncate text-xs ${active ? "text-white/60" : "text-[#6b5e52]"}`}
                  >
                    {item.description}
                  </span>
                </span>
                <ChevronRight
                  className={`h-4 w-4 ${active ? "opacity-70" : "opacity-0 group-hover:opacity-40"}`}
                />
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  children,
  access,
  profile,
}: {
  children: React.ReactNode;
  access: AdminAccess;
  profile: { name: string; email: string };
}) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  const renderSidebar = (collapsed: boolean, mobile = false) => (
    <div className={`flex h-full flex-col ${collapsed ? "p-3" : "p-5"}`}>
      <div className="relative mb-7 flex h-14 items-center justify-center">
        <Image
          src={collapsed ? "/icon.png" : "/images/logo.png"}
          alt="Just In Time Study Hub and Coworking Space"
          width={collapsed ? 720 : 245}
          height={collapsed ? 720 : 118}
          priority
          className={collapsed ? "h-11 w-11 rounded-xl object-contain" : "h-auto w-28"}
        />
        {mobile && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="absolute right-0 rounded-xl p-2 text-[#6b5e52] hover:bg-[#f7f1e8]"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      {collapsed ? (
        <div
          className="mb-5 flex h-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700"
          aria-label="Realtime operations connected"
          title="Realtime operations connected"
        >
          <Radio className="h-4 w-4 animate-pulse" />
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          <Radio className="h-3.5 w-3.5 animate-pulse" />
          Realtime operations connected
        </div>
      )}
      <AdminNav
        access={access}
        collapsed={collapsed}
        onNavigate={mobile ? () => setMobileOpen(false) : undefined}
      />
      <div className="mt-5 border-t border-[#eee5da] pt-5">
        {collapsed ? (
          <div
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#fffbf5] text-sm font-bold text-[#a27621]"
            title={`${profile.name} · ${access.role === "admin" ? "Owner" : "Employee"}`}
            aria-label={`${profile.name}, ${access.role === "admin" ? "Owner" : "Employee"}`}
          >
            {profile.name.trim().charAt(0).toUpperCase() || "A"}
          </div>
        ) : (
          <div className="mb-3 rounded-2xl bg-[#fffbf5] p-3">
            <p className="truncate text-sm font-semibold text-[#2d2520]">{profile.name}</p>
            <p className="truncate text-xs text-[#5f5248]">{profile.email}</p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[#a27621]">
              {access.role === "admin" ? "Owner" : "Employee"}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={handleLogout}
          aria-label={collapsed ? "Sign out" : undefined}
          title={collapsed ? "Sign out" : undefined}
          className={`flex w-full cursor-pointer items-center rounded-xl py-3 text-sm font-medium text-red-600 hover:bg-red-50 ${collapsed ? "justify-center px-2" : "gap-3 px-4"}`}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <AdminAccessContext.Provider value={access}>
      <div className="min-h-screen bg-[#f8f5f0]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 hidden border-r border-[#eee5da] bg-white transition-[width] duration-300 ease-out lg:block ${desktopCollapsed ? "w-24" : "w-72"}`}
        >
          {renderSidebar(desktopCollapsed)}
          <button
            type="button"
            onClick={() => setDesktopCollapsed((current) => !current)}
            aria-label={desktopCollapsed ? "Expand sidebar" : "Minimize sidebar"}
            title={desktopCollapsed ? "Expand sidebar" : "Minimize sidebar"}
            aria-expanded={!desktopCollapsed}
            className="absolute -right-4 top-7 flex h-8 w-8 items-center justify-center rounded-full border border-[#e7dccf] bg-white text-[#6b5e52] shadow-md transition-colors hover:border-[#e5a930] hover:bg-[#fff8ed] hover:text-[#9b6810] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5a930]"
          >
            {desktopCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </aside>
        {mobileOpen && (
          <>
            <button
              aria-label="Close navigation"
              className="fixed inset-0 z-40 bg-[#2d2520]/35 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[min(19rem,88vw)] bg-white shadow-2xl lg:hidden">
              {renderSidebar(false, true)}
            </aside>
          </>
        )}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#eee5da] bg-white/90 px-4 text-[#2d2520] backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl border border-[#eee5da] p-2.5"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">Operations Console</span>
          <span className="h-10 w-10" />
        </header>
        <main
          className={`min-w-0 p-4 transition-[margin] duration-300 ease-out sm:p-6 lg:p-8 xl:p-10 ${desktopCollapsed ? "lg:ml-24" : "lg:ml-72"}`}
        >
          {children}
        </main>
      </div>
    </AdminAccessContext.Provider>
  );
}
