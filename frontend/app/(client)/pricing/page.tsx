"use client";

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Check, Calendar, CalendarOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

export default function Pricing() {
  const [hourlyRates, setHourlyRates] = useState<Tables<'service_rate_plans'>[]>([]);
  const [packageRates, setPackageRates] = useState<Tables<'package_rate_plans'>[]>([]);
  const [closures, setClosures] = useState<Tables<'business_closures'>[]>([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadPricing = async () => {
      try {
        const supabase = createClient();
        const [hourlyResult, packageResult, closureResult] = await Promise.all([
          supabase.from('service_rate_plans').select().eq('is_active', true).order('sort_order'),
          supabase.from('package_rate_plans').select().eq('is_active', true).order('sort_order'),
          supabase.from('business_closures').select().eq('is_active', true).gte('ends_on', new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })).order('starts_on').limit(6),
        ]);
        if (cancelled) return;

        const firstError = hourlyResult.error || packageResult.error || closureResult.error;
        setPricingError(firstError ? 'Some current pricing or closure information could not be loaded. Please try again shortly.' : '');
        setHourlyRates(hourlyResult.data ?? []);
        setPackageRates(packageResult.data ?? []);
        setClosures(closureResult.data ?? []);
      } catch {
        if (!cancelled) {
          setPricingError('Current pricing is temporarily unavailable. Please try again shortly.');
          setHourlyRates([]);
          setPackageRates([]);
          setClosures([]);
        }
      } finally {
        if (!cancelled) setPricingLoading(false);
      }
    };
    void loadPricing();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] to-[#fff8ed] pt-24">
      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
          initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-block bg-[#fef3dc] px-4 py-2 rounded-full mb-6">
              <p className="text-sm text-[#e5a930] uppercase tracking-wider">Transparent Pricing</p>
            </div>
            <h1 className="text-5xl md:text-6xl mb-6 text-[#2d2520]">
              Simple, <span className="text-[#e5a930]">Affordable</span> Rates
            </h1>
            <p className="text-xl text-[#6b5e52] leading-relaxed">
              Choose the plan that works best for your study schedule
            </p>
          </motion.div>
        </div>
      </section>

      {pricingError && (
        <section className="px-6 pb-8">
          <div role="alert" className="mx-auto flex max-w-4xl items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">We couldn&apos;t load all current pricing information.</p>
              <p className="mt-1 text-sm">{pricingError}</p>
            </div>
          </div>
        </section>
      )}

      {closures.length > 0 && <section className="px-6 pb-8"><div className="mx-auto max-w-4xl rounded-3xl border border-amber-200 bg-[#fff8e8] p-6"><div className="flex items-start gap-3"><CalendarOff className="mt-0.5 h-6 w-6 shrink-0 text-[#b47b0d]" /><div><h3 className="text-xl text-[#2d2520]">Upcoming closures</h3><div className="mt-3 space-y-2">{closures.map((closure) => <p key={closure.id} className="text-sm text-[#6b5e52]"><span className="font-semibold text-[#2d2520]">{closure.name}</span> · {closure.starts_on === closure.ends_on ? closure.starts_on : `${closure.starts_on}–${closure.ends_on}`}</p>)}</div></div></div></div></section>}

      {/* Hourly Rates */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl mb-4 text-[#2d2520]">Hourly Rates</h2>
            <p className="text-xl text-[#6b5e52]">Pay only for the time you need</p>
          </div>

          <motion.div
          initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white/70 backdrop-blur-sm rounded-3xl border border-[#f3ede4] overflow-hidden shadow-lg"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f3ede4]">
                    <th className="text-left p-6 text-[#2d2520]">Duration</th>
                    <th className="text-right p-6 text-[#2d2520]">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingLoading && (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-[#6b5e52]">
                        <span role="status" className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading current hourly rates…
                        </span>
                      </td>
                    </tr>
                  )}
                  {hourlyRates.map((rate) => (
                    <tr
                      key={rate.id}
                      className={`border-b border-[#f3ede4] transition-colors hover:bg-[#fef3dc]/30 ${
                        rate.code === 'whole-day' ? 'bg-[#fef3dc]/50' : ''
                      }`}
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <span className="text-[#2d2520] text-lg">{rate.name}</span>
                          {rate.code === 'whole-day' && (
                            <span className="bg-[#e5a930] text-[#2d2520] px-3 py-1 rounded-full text-xs">
                              Most Popular
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <span className="text-2xl text-[#2d2520]">₱{(rate.price_cents / 100).toLocaleString('en-PH')}</span>
                      </td>
                    </tr>
                  ))}
                  {!pricingLoading && hourlyRates.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-[#6b5e52]">
                        No hourly rates are currently available. Please contact us for assistance.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Package Rates */}
      <section className="py-16 px-6 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl mb-4 text-[#2d2520]">Package Deals</h2>
            <p className="text-xl text-[#6b5e52]">Save more with our multi-day packages</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingLoading && (
              <div role="status" className="col-span-full flex min-h-48 items-center justify-center gap-2 rounded-3xl border border-[#f3ede4] bg-white/70 text-[#6b5e52]">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading current package deals…
              </div>
            )}
            {packageRates.map((pkg, index) => (
              <motion.div
                key={pkg.id}
          initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative bg-white/70 backdrop-blur-sm p-8 rounded-3xl border transition-all hover:shadow-xl ${
                  pkg.is_popular
                    ? 'border-[#e5a930] shadow-lg scale-105'
                    : 'border-[#f3ede4] hover:border-[#e5a930]'
                }`}
              >
                {pkg.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#e5a930] text-[#2d2520] px-4 py-1 rounded-full text-sm">
                    Best Value
                  </div>
                )}
                <div className="text-center">
                  <Calendar className="w-10 h-10 text-[#e5a930] mx-auto mb-4" />
                  <p className="text-xl text-[#2d2520] mb-2">{pkg.name}</p>
                  <p className="text-4xl text-[#2d2520] mb-3">
                    ₱{(pkg.price_cents / 100).toLocaleString('en-PH')}
                  </p>
                  <p className="text-sm text-[#6b5e52] italic">valid within {pkg.validity_days} days</p>
                </div>
              </motion.div>
            ))}
            {!pricingLoading && packageRates.length === 0 && (
              <div className="col-span-full flex min-h-48 items-center justify-center rounded-3xl border border-[#f3ede4] bg-white/70 px-6 text-center text-[#6b5e52]">
                No package deals are currently available. Please contact us for assistance.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl mb-4 text-[#2d2520]">Your Money&apos;s Worth</h2>
            <p className="text-xl text-[#6b5e52]">Premium spaces at affordable prices</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <motion.div
          initial={false}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative group overflow-hidden rounded-3xl shadow-lg"
            >
              <Image
                src="/images/individual.jpg"
                alt="Private Study Pods"
                width={1200}
                height={1600}
                sizes="(min-width: 768px) 33vw, 100vw"
                className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6">
                <div>
                  <h3 className="text-xl text-white mb-1">Private Pods</h3>
                  <p className="text-white/90 text-sm">Individual focus spaces</p>
                </div>
              </div>
            </motion.div>

            <motion.div
          initial={false}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative group overflow-hidden rounded-3xl shadow-lg"
            >
              <Image
                src="/images/sitting-down.jpg"
                alt="Quiet Zones"
                width={1200}
                height={1600}
                sizes="(min-width: 768px) 33vw, 100vw"
                className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6">
                <div>
                  <h3 className="text-xl text-white mb-1">Quiet Zones</h3>
                  <p className="text-white/90 text-sm">Silent study areas</p>
                </div>
              </div>
            </motion.div>

            <motion.div
          initial={false}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative group overflow-hidden rounded-3xl shadow-lg"
            >
              <Image
                src="/images/public.jpg"
                alt="Open Workspace"
                width={720}
                height={960}
                sizes="(min-width: 768px) 33vw, 100vw"
                className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6">
                <div>
                  <h3 className="text-xl text-white mb-1">Open Workspace</h3>
                  <p className="text-white/90 text-sm">Collaborative areas</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="py-16 px-6 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl mb-4 text-[#2d2520]">What&apos;s Included</h2>
            <p className="text-xl text-[#6b5e52]">Just In Time Study Hub And Coworking Space</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              'Clean, bright, and very conducive study and work place',
              'Free Wifi',
              'Sufficient Outlet',
              'Unlimited Iced Tea and Red Tea',
              'Unlimited Coffee',
              'Perfect Lighting for studying, working, or just chillin',
              'Cozy airconditioned room and accomodating staff',
              'Functional comfort room',
              'Extensions and adaptors (for borrowing only)',
              'Printing services (separate rates will apply)',
              'Very Affordable Rates',
            ].map((item, index) => (
              <motion.div
                key={index}
          initial={false}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="flex items-start gap-3"
              >
                <div className="w-6 h-6 bg-[#fef3dc] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Check className="w-4 h-4 text-[#e5a930]" />
                </div>
                <p className="text-[#2d2520]">{item}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
          initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl mb-6 text-[#2d2520]">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-[#6b5e52] mb-8">
              Reserve your seat now and experience productivity like never before
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/reserve"
                className="inline-flex items-center justify-center gap-2 bg-[#e5a930] text-white px-8 py-4 rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                Reserve Your Seat
              </Link>
              <Link
                href="/virtual-tour"
                className="inline-flex items-center justify-center gap-2 bg-white text-[#2d2520] px-8 py-4 rounded-full border border-[#f3ede4] hover:shadow-lg transition-all duration-300 hover:scale-105"
              >
                Take a Tour First
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
