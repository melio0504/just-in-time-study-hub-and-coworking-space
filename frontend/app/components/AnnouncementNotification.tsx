"use client";

import { ArrowRight, Megaphone, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

export function AnnouncementNotification() {
  const [announcement, setAnnouncement] = useState<Tables<"announcements"> | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const loadLatest = async () => {
      const { data } = await supabase
        .from("announcements")
        .select()
        .eq("status", "published")
        .order("starts_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setAnnouncement(data);
      setIsVisible(Boolean(data));
    };

    void loadLatest();

    const channel = supabase
      .channel("public-announcements")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => void loadLatest(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && announcement && (
        <motion.aside
          key={announcement.id}
          initial={{ opacity: 0, x: "calc(100% + 1rem)" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "calc(100% + 1rem)" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          aria-label="Latest announcement"
          aria-live="polite"
          style={{ top: "calc(var(--site-header-bottom, 6rem) + 1rem)" }}
          className="fixed right-4 z-40 w-[calc(100%-2rem)] max-w-80">
          <div className="rounded-xl border border-[#f3ede4] bg-white/90 p-4 shadow-lg backdrop-blur-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fef3dc]">
                  <Megaphone className="h-4 w-4 text-[#e5a930]" />
                </div>
                <p className="text-sm font-semibold text-[#2d2520]">{announcement.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsVisible(false)}
                aria-label="Dismiss announcement"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#f3ede4]">
                <X className="h-3 w-3 text-[#6b5e52]" />
              </button>
            </div>
            <p className="mb-2 text-xs text-[#6b5e52]">
              {new Date(announcement.starts_at || announcement.created_at).toLocaleDateString(
                "en-PH",
                {
                  dateStyle: "long",
                  timeZone: "Asia/Manila",
                },
              )}
            </p>
            <p className="text-sm leading-relaxed text-[#2d2520]">{announcement.body}</p>
            <Link
              href="/announcements"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#b47b0d] transition-colors hover:text-[#8d5f08]">
              View all announcements
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
