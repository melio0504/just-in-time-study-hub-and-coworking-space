"use client";

import { Suspense, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Shield,
  LogOut,
  BarChart3,
} from 'lucide-react';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (pathname: string, section: string | null) => boolean;
};

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    match: (pathname, section) =>
      pathname === '/admin/dashboard' && (!section || section === 'dashboard'),
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    match: (pathname) => pathname === '/admin/analytics',
  },
  {
    label: 'Reservations',
    href: '/admin/dashboard?section=reservations',
    icon: Calendar,
    match: (pathname, section) =>
      pathname === '/admin/dashboard' && section === 'reservations',
  },
  {
    label: 'Content Management',
    href: '/admin/dashboard?section=content',
    icon: FileText,
    match: (pathname, section) =>
      pathname === '/admin/dashboard' && section === 'content',
  },
  {
    label: 'Access Logs',
    href: '/admin/dashboard?section=logs',
    icon: Shield,
    match: (pathname, section) =>
      pathname === '/admin/dashboard' && section === 'logs',
  },
];

function AdminNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams.get('section');

  return (
    <nav className="flex-1 space-y-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.match(pathname, section);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive
                ? 'bg-[#e5a930] text-white'
                : 'text-[#6b5e52] hover:bg-[#fef3dc]'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const isAdminLoggedIn = localStorage.getItem('isAdminLoggedIn');
    if (isAdminLoggedIn !== 'true') {
      router.replace('/admin');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('isAdminLoggedIn');
    localStorage.removeItem('adminName');
    localStorage.removeItem('adminEmail');
    router.push('/admin');
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-[#fffcf7] to-[#fff8ed]">
      <aside className="fixed left-0 top-0 h-screen w-72 shrink-0 overflow-y-auto bg-white border-r border-[#f3ede4] p-6 flex flex-col">
        <div className="mb-8 flex justify-center">
          <Image
            src="/images/logo.png"
            alt="Just in Time"
            width={128}
            height={128}
            className="block mx-auto"
            style={{ width: '8rem', height: 'auto' }}
          />
        </div>

        <Suspense
          fallback={
            <nav className="flex-1 space-y-2">
              {navItems.map((item) => (
                <div
                  key={item.href}
                  className="w-full h-12 rounded-xl bg-[#f3ede4]/60 animate-pulse"
                />
              ))}
            </nav>
          }
        >
          <AdminNav />
        </Suspense>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all mt-auto pt-4"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </aside>

      <main className="ml-72 p-8">{children}</main>
    </div>
  );
}
