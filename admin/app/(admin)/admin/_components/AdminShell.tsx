"use client";

import { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutDashboard, CalendarDays, FileText, ShieldCheck, LogOut, BarChart3, Menu, X, ChevronRight, Radio } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type NavItem = { label: string; description: string; href: string; icon: React.ComponentType<{ className?: string }>; match: (pathname: string, section: string | null) => boolean };

const navItems: NavItem[] = [
  { label: 'Live overview', description: 'Seats and activity', href: '/admin/dashboard', icon: LayoutDashboard, match: (p, s) => p === '/admin/dashboard' && (!s || s === 'dashboard') },
  { label: 'Analytics', description: 'Business performance', href: '/admin/analytics', icon: BarChart3, match: (p) => p === '/admin/analytics' },
  { label: 'Reservations', description: 'Manage bookings', href: '/admin/dashboard?section=reservations', icon: CalendarDays, match: (p, s) => p === '/admin/dashboard' && s === 'reservations' },
  { label: 'Content', description: 'Announcements', href: '/admin/dashboard?section=content', icon: FileText, match: (p, s) => p === '/admin/dashboard' && s === 'content' },
  { label: 'Access logs', description: 'Staff activity', href: '/admin/dashboard?section=logs', icon: ShieldCheck, match: (p, s) => p === '/admin/dashboard' && s === 'logs' },
];

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const section = useSearchParams().get('section');
  return <nav className="flex-1 space-y-1.5" aria-label="Admin navigation">{navItems.map((item) => {
    const Icon = item.icon;
    const active = item.match(pathname, section);
    return <Link key={item.href} href={item.href} onClick={onNavigate} className={`group flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-all ${active ? 'bg-[#2d2520] text-white shadow-lg shadow-[#2d2520]/15' : 'text-[#6b5e52] hover:bg-[#fef3dc] hover:text-[#2d2520]'}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-[#e5a930]' : 'bg-[#f7f1e8] text-[#a27621] group-hover:bg-white'}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className={`block truncate text-xs ${active ? 'text-white/60' : 'text-[#6b5e52]'}`}>{item.description}</span></span>
      <ChevronRight className={`h-4 w-4 ${active ? 'opacity-70' : 'opacity-0 group-hover:opacity-40'}`} />
    </Link>;
  })}</nav>;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState({ name: 'Staff member', email: '' });

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: account } = await supabase.from('profiles').select('full_name, email').eq('id', data.user.id).single();
      setProfile({ name: account?.full_name || 'Staff member', email: account?.email || data.user.email || '' });
    });
  }, []);

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push('/admin');
    router.refresh();
  };

  const sidebar = <div className="flex h-full flex-col p-5">
    <div className="mb-7 flex items-center justify-between px-2"><Image src="/images/logo.png" alt="Just in Time" width={245} height={118} priority className="h-auto w-28 mx-auto" /><button type="button" onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-[#6b5e52] hover:bg-[#f7f1e8] lg:hidden"><X className="h-5 w-5" /></button></div>
    <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"><Radio className="h-3.5 w-3.5 animate-pulse" />Realtime operations connected</div>
    <Suspense fallback={<div className="flex-1 animate-pulse rounded-2xl bg-[#f7f1e8]" />}><AdminNav onNavigate={() => setMobileOpen(false)} /></Suspense>
    <div className="mt-5 border-t border-[#eee5da] pt-5"><div className="mb-3 rounded-2xl bg-[#fffbf5] p-3"><p className="truncate text-sm font-semibold text-[#2d2520]">{profile.name}</p><p className="truncate text-xs text-[#5f5248]">{profile.email}</p></div><button type="button" onClick={handleLogout} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Sign out</button></div>
  </div>;

  return <div className="min-h-screen bg-[#f8f5f0]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-[#eee5da] bg-white lg:block">{sidebar}</aside>
    {mobileOpen && <><button aria-label="Close navigation" className="fixed inset-0 z-40 bg-[#2d2520]/35 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} /><aside className="fixed inset-y-0 left-0 z-50 w-[min(19rem,88vw)] bg-white shadow-2xl lg:hidden">{sidebar}</aside></>}
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#eee5da] bg-white/90 px-4 backdrop-blur lg:hidden"><button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl border border-[#eee5da] p-2.5"><Menu className="h-5 w-5" /></button><span className="text-sm font-semibold">Operations Console</span><span className="h-10 w-10" /></header>
    <main className="min-w-0 p-4 sm:p-6 lg:ml-72 lg:p-8 xl:p-10">{children}</main>
  </div>;
}
