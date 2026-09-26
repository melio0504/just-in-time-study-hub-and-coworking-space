"use client";

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    <Link
      href={href}
      className="group px-1 py-2 text-[#6b5e52] hover:text-[#3d3329] focus-visible:text-[#3d3329]"
    >
      <span className="relative inline-block">
        <span className="relative z-10">{children}</span>
        <span
          className="absolute -bottom-1 left-0 h-1 w-0 rounded-full bg-[#e5a930]/35 transition-[width] group-hover:w-full group-focus-visible:w-full"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const closeMenuAndRestoreFocus = useCallback(() => {
    closeMenu();
    menuButtonRef.current?.focus();
  }, [closeMenu]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(Boolean(data.user));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.user));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenuAndRestoreFocus();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = mobileNavRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        );

        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    const handleDesktopResize = (event: MediaQueryListEvent) => {
      if (event.matches) {
        closeMenu();
      }
    };

    const desktopQuery = window.matchMedia('(min-width: 1024px)');

    window.addEventListener('keydown', handleKeyDown);
    desktopQuery.addEventListener('change', handleDesktopResize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      desktopQuery.removeEventListener('change', handleDesktopResize);
    };
  }, [isMenuOpen, closeMenu, closeMenuAndRestoreFocus]);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 border-b border-[#f3ede4] bg-[#fffcf7]/90 backdrop-blur-md transition-all duration-300 ${isScrolled
        ? 'mx-3 mt-1.5 rounded-2xl border border-[#f3ede4] shadow-lg sm:mx-6 sm:rounded-3xl xl:mx-auto xl:w-[calc(100%-3rem)] xl:max-w-7xl'
        : ''
        }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link href="/" className="flex items-center" onClick={closeMenu}>
              <Image
                src="/images/logo.png"
                alt="Study Hub Logo"
                width={245}
                height={118}
                priority
                className="h-9 w-auto max-w-35 shrink-0 object-contain sm:h-12 sm:max-w-45"
              />
            </Link>
          </div>

          <nav className="hidden items-center gap-6 lg:flex xl:gap-8">
            <DesktopNavLink href="/pricing">Pricing</DesktopNavLink>
            <DesktopNavLink href="/virtual-tour">Virtual Tour</DesktopNavLink>
            <DesktopNavLink href="/gallery">Gallery</DesktopNavLink>
            <DesktopNavLink href="/announcements">Announcements</DesktopNavLink>
            <DesktopNavLink href="/about">About Us</DesktopNavLink>
            <DesktopNavLink href={isLoggedIn ? '/account' : '/register'}>Account</DesktopNavLink>
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/reserve"
              className="hidden rounded-full bg-[#e5a930] px-4 py-2 text-sm text-white transition-all duration-300 hover:scale-105 hover:shadow-lg sm:inline-block sm:px-6 sm:py-2.5 sm:text-base"
            >
              Reserve
            </Link>

            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#f3ede4] bg-white/80 p-2 text-[#6b5e52] transition-colors hover:border-[#e5a930] hover:text-[#3d3329] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5a930] lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <nav
        ref={mobileNavRef}
        id="mobile-navigation"
        className={`fixed inset-0 z-[60] min-h-dvh transition-[visibility] duration-300 lg:hidden ${isMenuOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
          }`}
        aria-label="Mobile navigation"
        aria-hidden={!isMenuOpen}
        inert={isMenuOpen ? undefined : true}
      >
        <div
          className={`absolute inset-0 bg-[#2d2520]/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none ${isMenuOpen ? 'opacity-100' : 'opacity-0'
            }`}
          onClick={closeMenuAndRestoreFocus}
          aria-hidden
        />

        <div
          className={`absolute bottom-0 right-0 top-0 flex min-h-dvh w-full max-w-md flex-col bg-gradient-to-b from-[#fffcf7] via-[#fff8ed] to-[#fef3dc] shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          <div className="flex items-center justify-between border-b border-[#f3ede4]/80 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
            <Link href="/" onClick={closeMenu} className="shrink-0">
              <Image
                src="/images/logo.png"
                alt="Study Hub Logo"
                width={245}
                height={118}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMenuAndRestoreFocus}
              aria-label="Close navigation menu"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#f3ede4] bg-white/90 p-2.5 text-[#6b5e52] transition-colors hover:border-[#e5a930] hover:text-[#3d3329] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5a930]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto px-5 py-8 sm:px-6 sm:py-10">
            <p
              className={`mb-6 text-xs font-medium uppercase tracking-[0.2em] text-[#6b5e52] transition-all duration-500 ease-in-out ${isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
            >
              Menu
            </p>

            <ul className="space-y-1">
              {MOBILE_NAV_LINKS.map((item, index) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    className={`group flex items-center justify-between border-b border-[#f3ede4]/60 py-4 transition-all duration-500 ease-in-out active:bg-[#fef3dc]/50 ${isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                      }`}
                    style={{
                      transitionDelay: isMenuOpen ? `${50 + index * 50}ms` : '0ms',
                    }}
                  >
                    <span className="text-xl font-medium tracking-tight text-[#2d2520] transition-colors duration-500 group-hover:text-[#e5a930] sm:text-2xl">
                      {item.label}
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[#e5a930]/0 transition-all duration-500 group-hover:translate-x-0.5 group-hover:text-[#e5a930]/80" />
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={isLoggedIn ? '/account' : '/register'}
                  onClick={closeMenu}
                  className={`group flex items-center justify-between py-4 transition-all duration-500 ease-in-out active:bg-[#fef3dc]/50 ${isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                    }`}
                  style={{
                    transitionDelay: isMenuOpen ? `${50 + MOBILE_NAV_LINKS.length * 50}ms` : '0ms',
                  }}
                >
                  <span className="text-xl font-medium tracking-tight text-[#6b5e52] transition-colors duration-500 group-hover:text-[#3d3329] sm:text-2xl">
                    Account
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[#6b5e52]/40 transition-all duration-500 group-hover:translate-x-0.5 group-hover:text-[#6b5e52]" />
                </Link>
              </li>
            </ul>
          </div>

          <div
            className={`border-t border-[#f3ede4]/80 bg-[#fffcf7]/80 px-5 py-5 backdrop-blur-sm transition-all duration-500 ease-in-out sm:px-6 sm:py-6 ${isMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
            style={{ transitionDelay: isMenuOpen ? '300ms' : '0ms' }}
          >
            <Link
              href="/reserve"
              onClick={closeMenu}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#e5a930] px-6 py-3.5 text-base font-medium text-white shadow-[0_8px_24px_rgba(229,169,48,0.35)] transition-all duration-500 hover:bg-[#d49a28] active:scale-[0.99]"
            >
              Reserve a desk
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
