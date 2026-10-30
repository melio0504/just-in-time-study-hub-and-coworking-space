"use client";

import { ChevronDown } from "lucide-react";
import { type CSSProperties, Fragment, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  findEnabledReservationOptionIndex,
  getReservationDropdownLayout,
  startsNextReservationDay,
} from "@/lib/reservation-dropdown";

type ReservationOption = readonly [value: string, label: string, disabled?: boolean];

type ReservationSelectProps = {
  buttonRef?: RefObject<HTMLButtonElement | null>;
  describedBy?: string;
  disabled: boolean;
  emptyMessage: string;
  id: string;
  listboxLabel: string;
  name: string;
  onChange: (value: string) => void;
  options: ReservationOption[];
  placeholder: string;
  portalMenu?: boolean;
  separateNextDay?: boolean;
  value: string;
};

export function ReservationSelect({
  buttonRef,
  describedBy,
  disabled,
  emptyMessage,
  id,
  listboxLabel,
  name,
  onChange,
  options,
  placeholder,
  portalMenu = false,
  separateNextDay = false,
  value,
}: ReservationSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const internalButtonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [opensAbove, setOpensAbove] = useState(false);
  const [menuHeight, setMenuHeight] = useState(240);
  const [portalStyle, setPortalStyle] = useState<CSSProperties>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedIndex = options.findIndex(([optionValue]) => optionValue === value);
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1];
  const triggerRef = buttonRef ?? internalButtonRef;
  const optionsId = `${id}-options`;

  const openMenu = (preferredIndex = Math.max(selectedIndex, 0)) => {
    if (disabled) return;

    const trigger = triggerRef.current;
    if (trigger) {
      const bounds = trigger.getBoundingClientRect();
      const layout = getReservationDropdownLayout({
        optionCount: options.length,
        triggerBottom: bounds.bottom,
        triggerTop: bounds.top,
        viewportHeight: window.innerHeight,
      });

      setOpensAbove(layout.opensAbove);
      setMenuHeight(layout.maxHeight);
      if (portalMenu) {
        setPortalStyle({
          left: bounds.left,
          width: bounds.width,
          ...(layout.opensAbove
            ? { bottom: window.innerHeight - bounds.top + 8 }
            : { top: bounds.bottom + 8 }),
        });
      }
    }

    const preferredOption = options[preferredIndex];
    const nextEnabledIndex = findEnabledReservationOptionIndex(options, preferredIndex, 1);
    const nextActiveIndex = preferredOption?.[2]
      ? nextEnabledIndex >= 0
        ? nextEnabledIndex
        : findEnabledReservationOptionIndex(options, preferredIndex, -1)
      : preferredIndex;
    setActiveIndex(Math.max(nextActiveIndex, 0));
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const focusFrame = window.requestAnimationFrame(() => {
      optionRefs.current[activeIndex]?.focus({ preventScroll: true });
    });
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const closeOnFocusOutside = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("focusin", closeOnFocusOutside);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("focusin", closeOnFocusOutside);
    };
  }, [activeIndex, isOpen]);

  const focusOption = (index: number, direction: 1 | -1) => {
    const nextIndex = findEnabledReservationOptionIndex(options, index, direction);
    if (nextIndex < 0) return;
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus({ preventScroll: true });
  };

  const selectOption = (optionValue: string) => {
    if (options.find(([value]) => value === optionValue)?.[2]) return;
    onChange(optionValue);
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  };

  const menu = isOpen ? (
    <div
      ref={menuRef}
      id={optionsId}
      role="listbox"
      aria-label={listboxLabel}
      className={`${portalMenu ? "fixed z-[45]" : `absolute inset-x-0 z-50 ${opensAbove ? "bottom-full mb-2" : "top-full mt-2"}`} overflow-y-auto overscroll-contain rounded-xl border border-[#e8e0d4] bg-white p-1.5 shadow-2xl [scrollbar-color:#c4b5a3_transparent] [scrollbar-width:thin]`}
      style={{ maxHeight: menuHeight, ...(portalMenu ? portalStyle : {}) }}
    >
      {options.length > 0 ? (
        options.map(([optionValue, label, optionDisabled], index) => {
          const previousValue = options[index - 1]?.[0];
          const showNextDay = Boolean(
            separateNextDay &&
              previousValue &&
              startsNextReservationDay(previousValue, optionValue),
          );

          return (
            <Fragment key={optionValue}>
              {showNextDay && (
                <div aria-hidden="true" className="flex items-center gap-2 px-3 py-2">
                  <span className="h-px flex-1 bg-[#d8cfc2]" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#8b7355]">
                    Next Day
                  </span>
                  <span className="h-px flex-1 bg-[#d8cfc2]" />
                </div>
              )}
              <button
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={optionValue === value}
                aria-disabled={optionDisabled}
                disabled={optionDisabled}
                tabIndex={-1}
                onClick={() => selectOption(optionValue)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusOption(index + 1, 1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    focusOption(index - 1, -1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    focusOption(0, 1);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    focusOption(options.length - 1, -1);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setIsOpen(false);
                    triggerRef.current?.focus({ preventScroll: true });
                  }
                }}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#e5a930] ${optionDisabled ? "cursor-not-allowed bg-[#f3f0eb] text-[#9a8f83]" : optionValue === value ? "bg-[#fef3dc] font-medium text-[#8b6518]" : "text-[#2d2520] hover:bg-[#fff8ed]"}`}
              >
                {label}
              </button>
            </Fragment>
          );
        })
      ) : (
        <p className="px-3 py-3 text-sm text-[#6b5e52]">{emptyMessage}</p>
      )}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        id={id}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-controls={optionsId}
        aria-describedby={describedBy}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const fallbackIndex = event.key === "ArrowDown" ? 0 : options.length - 1;
            openMenu(selectedIndex >= 0 ? selectedIndex : fallbackIndex);
          } else if (event.key === "Escape" && isOpen) {
            event.preventDefault();
            setIsOpen(false);
          }
        }}
        className="flex w-full items-center justify-between rounded-xl border border-[#f3ede4] bg-white px-4 py-3 text-left text-[#2d2520] transition-all focus:outline-none focus:ring-2 focus:ring-[#e5a930] disabled:cursor-not-allowed disabled:bg-[#eee9e2] disabled:opacity-70"
      >
        <span className={selectedLabel ? "text-[#2d2520]" : "text-[#6b5e52]"}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[#6b5e52] transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {portalMenu && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}
