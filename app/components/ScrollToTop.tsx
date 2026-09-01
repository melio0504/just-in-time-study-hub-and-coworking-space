"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUp } from 'lucide-react';

import { Button } from './button';
import { cn } from './utils';

export function ScrollToTop() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
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

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
