"use client";

import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Clock,
  ArrowRight,
  Coffee,
  Droplet,
  Wifi,
  Check,
  Quote,
  Megaphone,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

export default function Home() {
  const [announcement, setAnnouncement] = useState<Tables<"announcements"> | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const loadLatest = async () => {
      const { data } = await supabase.from("announcements").select().eq("status", "published").order("starts_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setAnnouncement(data);
      setShowAnnouncement(Boolean(data));
    };
    void loadLatest();
    const channel = supabase.channel("public-announcements").on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => void loadLatest()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] to-[#fff8ed]">
      {/* Announcement Banner */}
      <AnimatePresence>
        {showAnnouncement && announcement && (
          <motion.div
          initial={false}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="fixed top-30 right-4 z-40 w-80"
          >
            <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-[#f3ede4]">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#fef3dc] rounded-full flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-4 h-4 text-[#e5a930]" />
                  </div>
                  <h3 className="text-[#2d2520] font-semibold text-sm">{announcement.title}</h3>
                </div>
                <button
                  onClick={() => setShowAnnouncement(false)}
                  className="w-6 h-6 hover:bg-[#f3ede4] rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3 text-[#6b5e52]" />
                </button>
              </div>
              <p className="text-xs text-[#6b5e52] mb-2">{new Date(announcement.starts_at || announcement.created_at).toLocaleDateString("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" })}</p>
              <p className="text-[#2d2520] text-sm leading-relaxed">{announcement.body}</p>
              <Link
                href="/announcements"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#b47b0d] transition-colors hover:text-[#8d5f08]"
              >
                View all announcements
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="relative overflow-hidden px-4 pb-20 sm:px-6 sm:pb-32">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 right-20 w-96 h-96 bg-[#fef3dc] rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-[#fff8ed] rounded-full blur-3xl"></div>
        </div>

        <motion.div
          className="absolute right-0 top-0 hidden h-dvh w-1/2 md:block"
          initial={false}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          <Image
            src="/images/solo-learner.jpg"
            alt="Study Hub Interior"
            fill
            priority
            sizes="50vw"
            className="object-cover object-center"
          />
        </motion.div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="relative isolate -mx-4 mb-16 grid min-h-dvh items-center overflow-hidden px-4 py-24 sm:-mx-6 sm:px-6 md:mx-0 md:grid-cols-2 md:gap-12 md:overflow-visible md:p-0">
            <Image
              src="/images/solo-learner.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 767px) 100vw, 1px"
              className="-z-20 object-cover object-center md:hidden"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#fffcf7]/90 via-[#fffcf7]/80 to-[#fff8ed]/95 md:hidden" />

            <motion.div
              className="md:pr-8"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 text-[#2d2520] leading-[1.1]"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <motion.span
                  className="inline-block"
                  initial={false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  You&apos;re
                </motion.span>{" "}
                <motion.span
                  className="inline-block relative"
                  initial={false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                  <span className="relative z-10 text-[#e5a930]">
                    just in time
                  </span>
                  <motion.div
                    className="absolute -bottom-2 left-0 right-0 h-3 bg-[#e5a930] opacity-20 rounded-full"
                    initial={false}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 1.2 }}
                  />
                </motion.span>
                <br />
                <motion.span
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 1 }}
                >
                  for focused success
                </motion.span>
              </motion.h1>

              <motion.p
                className="text-lg sm:text-xl text-[#6b5e52] mb-8 leading-relaxed"
                initial={false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.4 }}
              >
                Your perfect study sanctuary awaits in the heart of Manila.
                Premium spaces, extended hours, and everything you need to
                excel.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row items-start gap-4"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.6 }}
              >
                <Link
                  href="/reserve"
                  className="inline-flex items-center gap-2 bg-[#e5a930] text-white px-8 py-4 rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105 group"
                >
                  Reserve Your Seat Now
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/virtual-tour"
                  className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm text-[#2d2520] px-8 py-4 rounded-full border border-[#f3ede4] hover:shadow-lg transition-all duration-300 hover:scale-105"
                >
                  Take a Virtual Tour
                </Link>
              </motion.div>
            </motion.div>

            <div className="hidden md:block" aria-hidden="true" />
          </div>

          <motion.div
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
          initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2 }}
          >
            <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-[#f3ede4] hover:border-[#e5a930] transition-colors">
              <div className="w-12 h-12 bg-[#fef3dc] rounded-xl flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-[#e5a930]" />
              </div>
              <h3 className="text-lg mb-2 text-[#2d2520]">Central Location</h3>
              <p className="text-[#6b5e52]">
                Mendiola, Manila · 5 min from campus
              </p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-[#f3ede4] hover:border-[#e5a930] transition-colors">
              <div className="w-12 h-12 bg-[#fef3dc] rounded-xl flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-[#e5a930]" />
              </div>
              <h3 className="text-lg mb-2 text-[#2d2520]">Extended Hours</h3>
              <p className="text-[#6b5e52]">
                Mon-Sat: 8AM - 12AM · Sun: 10AM - 8PM
              </p>
            </div>

            <div className="bg-white/60 backdrop-blur-sm p-8 rounded-2xl border border-[#f3ede4] hover:border-[#e5a930] transition-colors">
              <div className="w-12 h-12 bg-[#fef3dc] rounded-xl flex items-center justify-center mb-4">
                <ArrowRight className="w-6 h-6 text-[#e5a930]" />
              </div>
              <h3 className="text-lg mb-2 text-[#2d2520]">
                Ready When You Are
              </h3>
              <p className="text-[#6b5e52]">Book online · Walk-ins welcome</p>
            </div>
          </motion.div>
        </div>
      </section>

      <section
        id="features"
        className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 bg-white/50"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16 md:mb-20">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-4 sm:mb-6 text-[#2d2520]">
              Everything You <span className="text-[#e5a930]">Need</span>
            </h2>
            <p className="text-xl text-[#6b5e52] max-w-2xl mx-auto">
              All the essentials for productivity, none of the distractions
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {/* Left Container */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#f3ede4] p-6 sm:p-8 md:p-10 hover:border-[#e5a930] transition-all hover:shadow-xl">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">
                      Clean, bright, and very conducive study and work place
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Wifi className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">Free Wifi</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">Sufficient Outlet</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Droplet className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">
                      Unlimited Iced Tea and Red Tea
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Coffee className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">Unlimited Coffee</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">
                      Perfect Lighting for studying, working, or just
                      chillin&apos;
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Container */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#f3ede4] p-6 sm:p-8 md:p-10 hover:border-[#e5a930] transition-all hover:shadow-xl">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">
                      Cozy airconditioned room and accomodating staff
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">Functional comfort room</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">
                      Extensions and adaptors (for borrowing only)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">
                      Printing services (separate rates will apply)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-[#fef3dc] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-[#e5a930]" />
                  </div>
                  <div>
                    <p className="text-[#2d2520]">Very Affordable Rates</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl mb-6 text-[#2d2520]">
              What People Are <span className="text-[#e5a930]">Saying</span>
            </h2>
            <p className="text-xl text-[#6b5e52]">
              Real experiences from our community
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
          initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white/70 backdrop-blur-sm p-8 rounded-3xl border border-[#f3ede4] hover:border-[#e5a930] transition-all"
            >
              <Quote className="w-10 h-10 text-[#e5a930] mb-4" />
              <p className="text-[#2d2520] mb-6 leading-relaxed italic">
                &quot;Best study space in Manila! The quiet zones are absolutely
                perfect for exam prep. Finally found a place where I can
                actually focus.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#fef3dc] rounded-full flex items-center justify-center">
                  <span className="text-[#e5a930]">AS</span>
                </div>
                <div>
                  <p className="text-[#2d2520]">Ana Santos</p>
                  <p className="text-sm text-[#6b5e52]">@anasantos • Twitter</p>
                </div>
              </div>
            </motion.div>

            <motion.div
          initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-white/70 backdrop-blur-sm p-8 rounded-3xl border border-[#f3ede4] hover:border-[#e5a930] transition-all"
            >
              <Quote className="w-10 h-10 text-[#e5a930] mb-4" />
              <p className="text-[#2d2520] mb-6 leading-relaxed italic">
                &quot;The unlimited coffee is a game changer! Great ambiance,
                fast wifi, and super accessible from UST. Highly
                recommend!&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#fef3dc] rounded-full flex items-center justify-center">
                  <span className="text-[#e5a930]">MR</span>
                </div>
                <div>
                  <p className="text-[#2d2520]">Miguel Reyes</p>
                  <p className="text-sm text-[#6b5e52]">
                    @miggy.reyes • Instagram
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
          initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white/70 backdrop-blur-sm p-8 rounded-3xl border border-[#f3ede4] hover:border-[#e5a930] transition-all"
            >
              <Quote className="w-10 h-10 text-[#e5a930] mb-4" />
              <p className="text-[#2d2520] mb-6 leading-relaxed italic">
                &quot;My go-to place for thesis writing. The private pods give
                me the privacy I need, and the environment is so conducive.
                Worth every peso!&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#fef3dc] rounded-full flex items-center justify-center">
                  <span className="text-[#e5a930]">LC</span>
                </div>
                <div>
                  <p className="text-[#2d2520]">Lea Cruz</p>
                  <p className="text-sm text-[#6b5e52]">@leacruz • Facebook</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="spaces" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl mb-6 text-[#2d2520]">
              Experience Our <span className="text-[#e5a930]">Spaces</span>
            </h2>
            <p className="text-xl text-[#6b5e52] max-w-2xl mx-auto">
              From quiet zones to collaborative areas, find the perfect
              environment for your work
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <motion.div
          initial={false}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative group overflow-hidden rounded-3xl shadow-xl"
            >
              <Image
                src="/images/sitting-down.jpg"
                alt="Quiet Zone"
                width={1200}
                height={1600}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="w-full h-96 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-8">
                <div>
                  <h3 className="text-2xl text-white mb-2">Quiet Zones</h3>
                  <p className="text-white/90">
                    Perfect silence for deep focus and concentration
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
          initial={false}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative group overflow-hidden rounded-3xl shadow-xl"
            >
              <Image
                src="/images/public.jpg"
                alt="Open Workspace"
                width={720}
                height={960}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="w-full h-96 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-8">
                <div>
                  <h3 className="text-2xl text-white mb-2">Open Workspace</h3>
                  <p className="text-white/90">
                    Collaborative environment for teamwork and networking
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="location" className="py-20 px-6 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-xl">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3860.975495779928!2d120.98793797510618!3d14.600471785885835!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c9a81a0f8499%3A0x859c0de05fd302ec!2sJUST-IN-TIME%20STUDY%20HUB%20AND%20COWORKING%20SPACE!5e0!3m2!1sen!2sph!4v1790880465851!5m2!1sen!2sph"
                  title="Just-In-Time Study Hub and Coworking Space location"
                  className="h-full w-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
            <div>
              <p className="text-sm text-[#d97757] uppercase tracking-wider mb-4">
                Central Location
              </p>
              <h2 className="text-5xl mb-6 text-[#2d2520]">
                Precision Located.
              </h2>
              <p className="text-lg text-[#6b5e52] mb-8 leading-relaxed">
                Find us at the heart of the city&apos;s academic district.
                Easily accessible by transit, yet tucked away from the noise of
                the streets.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-6 h-6 text-[#e5a930] mt-1" />
                  <div>
                    <p className="text-[#2d2520] mb-1">Address</p>
                    <p className="text-[#6b5e52]">
                      2nd Floor Mendiola Square Bldg., 2138 C.M. Recto Avenue,
                      Quiapo Manila, Philippines
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-6 h-6 text-[#e5a930] mt-1" />
                  <div>
                    <p className="text-[#2d2520] mb-1">Operating Hours</p>
                    <p className="text-[#6b5e52]">Daily - 8:00am - 5:00am</p>
                  </div>
                </div>
              </div>
              <a
                href="https://www.google.com/maps/dir//''/data=!4m7!4m6!1m1!4e2!1m2!1m1!1s0x3397c9a81a0f8499:0x859c0de05fd302ec!3e0?g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAMYASAF"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 flex items-center gap-2 text-[#e5a930] hover:text-[#d69520] transition-colors"
              >
                Get Directions
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Want to Know More */}
      <section className="bg-[#fff8ed] px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl mb-6 text-[#2d2520]">
              Want to Know More About
              <br />
              <span className="text-[#e5a930]">Just In Time Study Hub?</span>
            </h2>
            <p className="text-xl text-[#6b5e52] mb-8 max-w-3xl mx-auto">
              Explore our spaces, learn our story, or book a visit. We&apos;re
              here to help you find your perfect productivity environment.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Link
              href="/about"
              className="group bg-white/80 backdrop-blur-sm p-8 rounded-3xl border border-[#f3ede4] hover:border-[#e5a930] transition-all hover:shadow-xl text-center"
            >
              <div className="w-16 h-16 bg-[#fef3dc] rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <ArrowRight className="w-8 h-8 text-[#e5a930]" />
              </div>
              <h3 className="text-xl mb-2 text-[#2d2520]">Our Story</h3>
              <p className="text-[#6b5e52]">
                Learn about our mission and values
              </p>
            </Link>

            <Link
              href="/virtual-tour"
              className="group bg-white/80 backdrop-blur-sm p-8 rounded-3xl border border-[#f3ede4] hover:border-[#e5a930] transition-all hover:shadow-xl text-center"
            >
              <div className="w-16 h-16 bg-[#fef3dc] rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <ArrowRight className="w-8 h-8 text-[#e5a930]" />
              </div>
              <h3 className="text-xl mb-2 text-[#2d2520]">Take a Tour</h3>
              <p className="text-[#6b5e52]">Explore our spaces virtually</p>
            </Link>

            <Link
              href="/reserve"
              className="group bg-[#e5a930] p-8 rounded-3xl border border-[#e5a930] transition-all hover:shadow-xl text-center hover:scale-105"
            >
              <div className="w-16 h-16 bg-white/30 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <ArrowRight className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl mb-2 text-white">Reserve Now</h3>
              <p className="text-white/90">Book your seat today</p>
            </Link>
          </div>

          <div className="mt-12 text-center">
            <p className="text-[#6b5e52] mb-4">
              Have questions? We&apos;d love to hear from you!
            </p>
            <a
              href="mailto:jit.studyhub@gmail.com"
              className="text-[#e5a930] hover:text-[#d69520] transition-colors"
            >
              jit.studyhub@gmail.com
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
