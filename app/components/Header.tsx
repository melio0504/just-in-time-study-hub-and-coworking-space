"use client";

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

const MOBILE_NAV_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/virtual-tour', label: 'Virtual Tour' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/about', label: 'About Us' },
] as const;

const MOBILE_MENU_TRANSITION_MS = 500;

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMenuMounted, setIsMenuMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const toggleMenu = () => {
    if (!isMenuOpen) {
      // ensure menu is mounted before opening so transitions run correctly
      setIsMenuMounted(true);
      setIsMenuOpen(true);
      return;
    }

    setIsMenuOpen(false);
  };
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    const checkLoginStatus = () => {
      setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true');
    };
    checkLoginStatus();
    window.addEventListener('storage', checkLoginStatus);
    return () => window.removeEventListener('storage', checkLoginStatus);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (isMenuOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsMenuMounted(false);
    }, MOBILE_MENU_TRANSITION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isMenuOpen]);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 border-b border-[#f3ede4] bg-[#fffcf7]/90 backdrop-blur-md transition-all duration-300 ${isScrolled
        ? 'mx-3 mt-1.5 rounded-2xl border border-[#f3ede4] shadow-lg sm:mx-50 sm:mt-1.5 sm:top-1.5 sm:rounded-3xl sm:border sm:shadow-lg'
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

          <nav className="hidden items-center gap-8 lg:flex">
            <Link href="/pricing" className="text-[#6b5e52] transition-colors hover:text-[#3d3329]">
              Pricing
            </Link>
            <Link href="/virtual-tour" className="text-[#6b5e52] transition-colors hover:text-[#3d3329]">
              Virtual Tour
            </Link>
            <Link href="/gallery" className="text-[#6b5e52] transition-colors hover:text-[#3d3329]">
              Gallery
            </Link>
            <Link href="/about" className="text-[#6b5e52] transition-colors hover:text-[#3d3329]">
              About Us
            </Link>
            <Link href={isLoggedIn ? '/account' : '/register'} className="text-[#6b5e52] transition-colors hover:text-[#3d3329]">
              Account
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/reserve"
              className="hidden rounded-full bg-[#e5a930] px-4 py-2 text-sm text-white transition-all duration-300 hover:scale-105 hover:shadow-lg sm:inline-block sm:px-6 sm:py-2.5 sm:text-base"
            >
              Reserve
            </Link>

            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center rounded-full border border-[#f3ede4] bg-white/80 p-2 text-[#6b5e52] transition-colors hover:text-[#3d3329] lg:hidden"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {isMenuMounted && (
        <nav
          id="mobile-navigation"
          className={`fixed inset-0 z-[60] min-h-dvh lg:hidden ${isMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          aria-hidden={!isMenuOpen}
        >
          <div
            className={`absolute inset-0 bg-[#2d2520]/20 backdrop-blur-[2px] transition-opacity duration-500 ease-in-out ${isMenuOpen ? 'opacity-100' : 'opacity-0'
              }`}
            onClick={closeMenu}
            aria-hidden
          />

          <div
            className={`absolute inset-x-0 bottom-0 top-0 flex min-h-dvh flex-col bg-gradient-to-b from-[#fffcf7] via-[#fff8ed] to-[#fef3dc] transition-transform duration-500 ease-in-out ${isMenuOpen ? 'translate-y-0' : '-translate-y-4'
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
                type="button"
                onClick={closeMenu}
                aria-label="Close navigation menu"
                className="inline-flex items-center justify-center rounded-full border border-[#f3ede4] bg-white/90 p-2.5 text-[#6b5e52] transition-colors duration-500 hover:border-[#e5a930] hover:text-[#3d3329]"
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
                        transitionDelay: isMenuOpen ? `${80 + index * 60}ms` : '0ms',
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
                      transitionDelay: isMenuOpen ? `${80 + MOBILE_NAV_LINKS.length * 60}ms` : '0ms',
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
              style={{ transitionDelay: isMenuOpen ? '380ms' : '0ms' }}
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
      )}
    </>
  );
}
