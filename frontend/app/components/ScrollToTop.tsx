"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUp } from 'lucide-react';

import { Button } from './button';
import { cn } from './utils';

export function ScrollToTop() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const scrollAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (scrollAnimationRef.current !== null) {
        window.cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
      }
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(window.scrollY > 320);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateVisibility);
    };
  }, []);

  useEffect(() => {
    const cancelScrollAnimation = () => {
      if (scrollAnimationRef.current === null) return;
      window.cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
    };

    window.addEventListener('wheel', cancelScrollAnimation, { passive: true });
    window.addEventListener('touchstart', cancelScrollAnimation, { passive: true });

    return () => {
      cancelScrollAnimation();
      window.removeEventListener('wheel', cancelScrollAnimation);
      window.removeEventListener('touchstart', cancelScrollAnimation);
    };
  }, []);

  const handleClick = () => {
    const scrollRoot = document.scrollingElement ?? document.documentElement;
    const startY = scrollRoot.scrollTop;
    if (startY <= 0) return;

    if (scrollAnimationRef.current !== null) {
      window.cancelAnimationFrame(scrollAnimationRef.current);
    }

    const startedAt = performance.now();
    const duration = Math.min(1400, Math.max(1000, startY * 0.4));
    const animateScroll = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const easedProgress = progress < 0.5
        ? 4 * progress ** 3
        : 1 - (-2 * progress + 2) ** 3 / 2;

      scrollRoot.scrollTop = Math.round(startY * (1 - easedProgress));
      if (progress < 1) {
        scrollAnimationRef.current = window.requestAnimationFrame(animateScroll);
      } else {
        scrollRoot.scrollTop = 0;
        scrollAnimationRef.current = null;
      }
    };

    scrollAnimationRef.current = window.requestAnimationFrame(animateScroll);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={handleClick}
      aria-label="Scroll to top"
      className={cn(
        'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full border-yellow-300 bg-yellow-100 text-yellow-700 shadow-lg shadow-yellow-900/15 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-yellow-200 hover:text-yellow-800',
        isVisible
          ? 'pointer-events-auto translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <ArrowUp className="size-6" />
    </Button>
  );
}
