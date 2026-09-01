"use client";

import { motion } from 'motion/react';
import { Clock, Check, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function Pricing() {
  const hourlyRates = [
    { hours: '1 hour', price: 80 },
    { hours: '2 hours', price: 120 },
    { hours: '3 hours', price: 150 },
    { hours: '4 hours', price: 170 },
    { hours: '5 hours', price: 200 },
    { hours: '6 hours', price: 230 },
    { hours: '7-8 hours', price: 270 },
    { hours: '9-10 hours', price: 320 },
    { hours: 'Whole day (11hrs & up)', price: 370, popular: true },
  ];

  const packageRates = [
    { duration: '3 days', price: 900, validity: 'valid within 6 days' },
    { duration: '7 days', price: 1800, validity: 'valid within 14 days' },
    { duration: '15 days', price: 3000, validity: 'valid within one month' },
    { duration: '30 days', price: 5000, validity: 'valid within two months', popular: true },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] to-[#fff8ed] pt-24">
      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
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

      {/* Operating Hours */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 border border-[#e5a930] text-center"
          >
            <Clock className="w-12 h-12 text-[#e5a930] mx-auto mb-4" />
            <h3 className="text-2xl mb-4 text-[#2d2520]">Operating Hours</h3>
            <p className="text-3xl text-[#e5a930] mb-2">8:00 AM - 5:00 AM</p>
            <p className="text-[#6b5e52]">Monday to Sunday</p>
          </motion.div>
        </div>
      </section>

      {/* Hourly Rates */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl mb-4 text-[#2d2520]">Hourly Rates</h2>
            <p className="text-xl text-[#6b5e52]">Pay only for the time you need</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
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
                  {hourlyRates.map((rate, index) => (
                    <tr
                      key={index}
                      className={`border-b border-[#f3ede4] transition-colors hover:bg-[#fef3dc]/30 ${
                        rate.popular ? 'bg-[#fef3dc]/50' : ''
                      }`}
                    >
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <span className="text-[#2d2520] text-lg">{rate.hours}</span>
                          {rate.popular && (
                            <span className="bg-[#e5a930] text-[#2d2520] px-3 py-1 rounded-full text-xs">
                              Most Popular
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <span className="text-2xl text-[#2d2520]">₱{rate.price}</span>
                      </td>
                    </tr>
                  ))}
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
            {packageRates.map((pkg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative bg-white/70 backdrop-blur-sm p-8 rounded-3xl border transition-all hover:shadow-xl ${
                  pkg.popular
                    ? 'border-[#e5a930] shadow-lg scale-105'
                    : 'border-[#f3ede4] hover:border-[#e5a930]'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#e5a930] text-[#2d2520] px-4 py-1 rounded-full text-sm">
                    Best Value
                  </div>
                )}
                <div className="text-center">
                  <Calendar className="w-10 h-10 text-[#e5a930] mx-auto mb-4" />
                  <p className="text-xl text-[#2d2520] mb-2">{pkg.duration}</p>
                  <p className="text-4xl text-[#2d2520] mb-3">
                    ₱{pkg.price.toLocaleString()}
                  </p>
                  <p className="text-sm text-[#6b5e52] italic">{pkg.validity}</p>
                </div>
              </motion.div>
            ))}
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
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative group overflow-hidden rounded-3xl shadow-lg"
            >
              <img
                src="/images/individual.jpg"
                alt="Private Study Pods"
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
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative group overflow-hidden rounded-3xl shadow-lg"
            >
              <img
                src="/images/sitting-down.jpg"
                alt="Quiet Zones"
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
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative group overflow-hidden rounded-3xl shadow-lg"
            >
              <img
                src="/images/public.jpg"
                alt="Open Workspace"
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
                initial={{ opacity: 0, x: -20 }}
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
            initial={{ opacity: 0, y: 30 }}
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
