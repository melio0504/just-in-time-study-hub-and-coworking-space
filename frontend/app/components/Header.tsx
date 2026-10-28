"use client";

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

const MOBILE_NAV_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/virtual-tour', label: 'Virtual Tour' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/about', label: 'About Us' },
] as const;

function DesktopNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group px-1 py-2 text-[#6b5e52] hover:text-[#3d3329] focus-visible:text-[#3d3329]">
      <span className="relative inline-block">
        <span className="relative z-10">{children}</span>
        <span className="absolute -bottom-1 left-0 h-1 w-0 rounded-full bg-[#e5a930]/35 transition-[width] group-hover:w-full group-focus-visible:w-full" aria-hidden="true" />
      </span>
    </Link>
  );
}

export function Header() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const headerAnchorRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);

  const closeMobileMenu = () => mobileMenuRef.current?.removeAttribute('open');

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setIsLoggedIn(Boolean(data.user)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    let displayedProgress = 0;
    let targetProgress = 0;
    let animationFrame = 0;
    let previousTime = performance.now();
    let previousScrollY = window.scrollY;
    let isScrollingUp = false;

    const draw = (progress: number) => {
      const viewportWidth = document.documentElement.clientWidth;
      const sideGap = viewportWidth >= 640 ? 48 : 24;
      const finalWidth = Math.min(viewportWidth - sideGap, 1280);
      const finalRadius = viewportWidth >= 640 ? 24 : 16;
      const noticeBottom = Math.max(
        document.getElementById('capstone-notice')?.getBoundingClientRect().bottom ?? 0,
        0,
      );
      const anchorTop = Math.max(headerAnchorRef.current?.getBoundingClientRect().top ?? 0, 0);

      header.style.width = `${viewportWidth + (finalWidth - viewportWidth) * progress}px`;
      const headerViewportTop = Math.max(noticeBottom, 6 * progress);
      header.style.top = `${Math.max(headerViewportTop - anchorTop, 0)}px`;
      header.style.borderRadius = `${finalRadius * progress}px`;
      header.dataset.scrolled = progress > 0.01 ? 'true' : 'false';
      document.documentElement.style.setProperty(
        '--site-header-bottom',
        `${header.getBoundingClientRect().bottom}px`,
      );
    };

    const animate = (time: number) => {
      const elapsed = Math.min(time - previousTime, 64);
      previousTime = time;
      const responseTime = isScrollingUp ? 120 : 210;
      const smoothing = 1 - Math.exp(-elapsed / responseTime);
      displayedProgress += (targetProgress - displayedProgress) * smoothing;

      if (Math.abs(targetProgress - displayedProgress) < 0.001) {
        displayedProgress = targetProgress;
      }
      draw(displayedProgress);

      if (displayedProgress !== targetProgress) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        animationFrame = 0;
      }
    };

    const updateTarget = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY !== previousScrollY) {
        isScrollingUp = currentScrollY < previousScrollY;
        previousScrollY = currentScrollY;
      }
      targetProgress = Math.min(Math.max(currentScrollY / 160, 0), 1);
      if (!animationFrame) {
        previousTime = performance.now();
        animationFrame = requestAnimationFrame(animate);
      }
    };

    draw(0);
    updateTarget();
    window.addEventListener('scroll', updateTarget, { passive: true });
    window.addEventListener('resize', updateTarget);
    return () => {
      window.removeEventListener('scroll', updateTarget);
      window.removeEventListener('resize', updateTarget);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      document.documentElement.style.removeProperty('--site-header-bottom');
    };
  }, []);

  return (
    <div ref={headerAnchorRef} className="sticky top-0 z-50 h-0 w-full">
      <header ref={headerRef} className="site-header absolute z-50 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="flex min-w-0 items-center" onClick={closeMobileMenu}>
            <Image src="/images/logo.png" alt="Study Hub Logo" width={245} height={118} priority loading="eager" className="h-9 w-auto max-w-35 shrink-0 object-contain sm:h-12 sm:max-w-45" draggable="false" />
          </Link>

          <nav className="hidden items-center gap-6 lg:flex xl:gap-8">
            <DesktopNavLink href="/pricing">Pricing</DesktopNavLink>
            <DesktopNavLink href="/virtual-tour">Virtual Tour</DesktopNavLink>
            <DesktopNavLink href="/gallery">Gallery</DesktopNavLink>
            <DesktopNavLink href="/announcements">Announcements</DesktopNavLink>
            <DesktopNavLink href="/about">About Us</DesktopNavLink>
            <DesktopNavLink href={isLoggedIn ? '/account' : '/register'}>Account</DesktopNavLink>
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/reserve" className="hidden rounded-full bg-[#e5a930] px-4 py-2 text-sm text-white hover:shadow-lg sm:inline-block sm:px-6 sm:py-2.5 sm:text-base">
              Reserve
            </Link>

            <details ref={mobileMenuRef} className="group lg:hidden">
              <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full border border-[#f3ede4] bg-white/80 p-2 text-[#6b5e52] hover:border-[#e5a930] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5a930] [&::-webkit-details-marker]:hidden" aria-label="Toggle navigation menu">
                <Menu className="h-6 w-6 group-open:hidden" />
                <X className="hidden h-6 w-6 group-open:block" />
              </summary>

              <nav id="mobile-navigation" aria-label="Mobile navigation" className="mobile-navigation-menu absolute left-1/2 top-[calc(100%+0.5rem)] z-[70] max-h-[calc(100dvh-6rem)] w-[80vw] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 overscroll-contain overflow-y-auto rounded-3xl border border-[#f3ede4] p-5 shadow-2xl sm:p-6">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#6b5e52]">Menu</p>
                <ul className="space-y-1">
                  {MOBILE_NAV_LINKS.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} onClick={closeMobileMenu} className="group/link flex items-center justify-between border-b border-[#f3ede4]/60 py-3.5 active:bg-[#fef3dc]/50">
                        <span className="text-xl font-medium tracking-tight text-[#2d2520] group-hover/link:text-[#e5a930]">{item.label}</span>
                        <ArrowRight className="h-5 w-5 shrink-0 text-[#e5a930]" />
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link href={isLoggedIn ? '/account' : '/register'} onClick={closeMobileMenu} className="flex items-center justify-between py-3.5 text-xl font-medium tracking-tight text-[#2d2520]">
                      Account
                      <ArrowRight className="h-5 w-5 shrink-0 text-[#e5a930]" />
                    </Link>
                  </li>
                </ul>
                <Link href="/reserve" onClick={closeMobileMenu} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#e5a930] px-6 py-3.5 text-base font-medium text-white shadow-[0_8px_24px_rgba(229,169,48,0.35)]">
                  Reserve a desk
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </nav>
            </details>
          </div>
        </div>
      </header>
    </div>
  );
}
