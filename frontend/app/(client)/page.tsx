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
import { useState } from "react";

export default function Home() {
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] to-[#fff8ed]">
      {/* Announcement Banner */}
      <AnimatePresence>
        {showAnnouncement && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
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
                  <h3 className="text-[#2d2520] font-semibold text-sm">
                    Announcement
                  </h3>
                </div>
                <button
                  onClick={() => setShowAnnouncement(false)}
                  className="w-6 h-6 hover:bg-[#f3ede4] rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3 text-[#6b5e52]" />
                </button>
              </div>
              <p className="text-xs text-[#6b5e52] mb-2">{today}</p>
              <p className="text-[#2d2520] text-sm leading-relaxed">
                We are open during the holiday season! Enjoy extended hours from
                8:00 AM to 5:00 AM, 7 days a week.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="pt-24 sm:pt-32 pb-20 sm:pb-32 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 right-20 w-96 h-96 bg-[#fef3dc] rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-[#fff8ed] rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.h1
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 text-[#2d2520] leading-[1.1]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <motion.span
                  className="inline-block"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  You&apos;re
                </motion.span>{" "}
                <motion.span
                  className="inline-block relative"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                  <span className="relative z-10 text-[#e5a930]">
                    just in time
                  </span>
                  <motion.div
                    className="absolute -bottom-2 left-0 right-0 h-3 bg-[#e5a930] opacity-20 rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.8, delay: 1.2 }}
                  />
                </motion.span>
                <br />
                <motion.span
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 1 }}
                >
                  for focused success
                </motion.span>
              </motion.h1>

              <motion.p
                className="text-lg sm:text-xl text-[#6b5e52] mb-8 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.4 }}
              >
                Your perfect study sanctuary awaits in the heart of Manila.
                Premium spaces, extended hours, and everything you need to
                excel.
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row items-start gap-4"
                initial={{ opacity: 0, y: 20 }}
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

            <motion.div
              className="relative flex items-center justify-center mt-12 md:mt-0"
              initial={{ x: 200, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              <div className="w-80 h-80 sm:w-96 sm:h-96 md:w-[500px] md:h-[500px] lg:w-[600px] lg:h-[600px] rounded-3xl overflow-hidden shadow-2xl">
                <Image
                  src="/images/solo-learner.jpg"
                  alt="Study Hub Interior"
                  width={1024}
                  height={768}
                  priority
                  sizes="(min-width: 1024px) 600px, (min-width: 768px) 500px, 384px"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          </div>

          <motion.div
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
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
              initial={{ opacity: 0, y: 30 }}
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
              initial={{ opacity: 0, y: 30 }}
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
              initial={{ opacity: 0, y: 30 }}
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
              initial={{ opacity: 0, scale: 0.95 }}
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
              initial={{ opacity: 0, scale: 0.95 }}
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
                <Image
                  src="/images/maps.png"
                  alt="Location Map"
                  width={957}
                  height={730}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="w-full h-full object-cover"
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
                    <p className="text-[#6b5e52]">
                      Mon - Sat: 08:00 AM - 12:00 AM
                    </p>
                    <p className="text-[#6b5e52]">Sun: 10:00 AM - 08:00 PM</p>
                  </div>
                </div>
              </div>
              <button className="mt-8 flex items-center gap-2 text-[#e5a930] hover:text-[#d69520] transition-colors">
                Get Directions
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Want to Know More */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#fef3dc] via-[#fff8ed] to-[#fffcf7]">
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
