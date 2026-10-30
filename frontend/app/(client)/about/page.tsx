"use client";

import { Award, Eye, Heart, Lightbulb, Target, Users } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";

export default function About() {
  const values = [
    {
      icon: Lightbulb,
      title: "Focus First",
      description: "We create environments engineered for deep work and concentration.",
    },
    {
      icon: Users,
      title: "Community",
      description: "Building a network of ambitious learners and professionals.",
    },
    {
      icon: Heart,
      title: "Excellence",
      description: "Premium amenities and service that elevate your productivity.",
    },
    {
      icon: Award,
      title: "Accessibility",
      description: "Quality study spaces that are welcoming and affordable for all.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] to-[#fff8ed] pt-24">
      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-block bg-[#fef3dc] px-4 py-2 rounded-full mb-6">
              <p className="text-sm text-[#e5a930] uppercase tracking-wider">About Us</p>
            </div>
            <h1 className="text-5xl md:text-6xl mb-6 text-[#2d2520]">
              Where Time Meets <span className="text-[#e5a930]">Purpose</span>
            </h1>
            <p className="text-xl text-[#6b5e52] leading-relaxed max-w-3xl mx-auto">
              Just In Time Study Hub is more than a workspace. We&apos;re dedicated to helping you
              reclaim focus in an age of distraction.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 px-6 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={false}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}>
              <h2 className="text-5xl md:text-4xl mb-6 text-[#2d2520]">Our Story</h2>
              <div className="space-y-4 text-lg md:text-lg text-[#6b5e52] leading-relaxed">
                <p>
                  Founded in 2019, Just In Time Study Hub emerged from a simple observation.
                  Students and professionals needed more than just a desk. They needed an
                  environment designed for success.
                </p>
                <p>
                  Located in the heart of Manila&apos;s academic district, we&apos;ve created a
                  sanctuary where focus is engineered into every detail. From our acoustically
                  optimized quiet zones to our ergonomic workstations, everything is designed with
                  productivity in mind.
                </p>
                <p>
                  Today, we serve hundreds of students, freelancers, and professionals who&apos;ve
                  discovered that the right environment is essential for achieving their goals.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={false}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative">
              <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl">
                <Image
                  src="/images/desk-help.jpg"
                  alt="Just In Time Study Hub Reception"
                  width={1200}
                  height={1600}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="w-full h-full object-cover"
                  draggable="false"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-white/70 backdrop-blur-sm p-10 rounded-3xl border border-[#f3ede4] hover:border-[#e5a930] transition-colors">
              <div className="w-16 h-16 bg-[#fef3dc] rounded-2xl flex items-center justify-center mb-6">
                <Target className="w-8 h-8 text-[#e5a930]" />
              </div>
              <h3 className="text-3xl mb-4 text-[#2d2520]">Our Mission</h3>
              <p className="text-[#6b5e52] leading-relaxed">
                To provide accessible, premium study and coworking spaces that empower individuals
                to achieve their academic and professional goals through environments designed for
                deep focus and collaboration.
              </p>
            </motion.div>

            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-white/70 backdrop-blur-sm p-10 rounded-3xl border border-[#f3ede4] hover:border-[#e5a930] transition-colors">
              <div className="w-16 h-16 bg-[#fef3dc] rounded-2xl flex items-center justify-center mb-6">
                <Eye className="w-8 h-8 text-[#e5a930]" />
              </div>
              <h3 className="text-3xl mb-4 text-[#2d2520]">Our Vision</h3>
              <p className="text-[#6b5e52] leading-relaxed">
                To become Metro Manila&apos;s premier destination for focused learning and
                professional growth, where every member discovers their optimal productivity
                environment and reaches their full potential.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 px-6 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl mb-6 text-[#2d2520]">Our Core Values</h2>
            <p className="text-xl text-[#6b5e52] max-w-3xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white/70 backdrop-blur-sm p-8 rounded-2xl border border-[#f3ede4] hover:border-[#e5a930] transition-all hover:shadow-lg group">
                <div className="w-14 h-14 bg-[#fef3dc] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <value.icon className="w-7 h-7 text-[#e5a930]" />
                </div>
                <h4 className="text-xl mb-3 text-[#2d2520]">{value.title}</h4>
                <p className="text-[#6b5e52] leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl mb-6 text-[#2d2520]">Why Choose Just In Time?</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center">
              <div className="text-5xl mb-4 text-[#e5a930]">98%</div>
              <h4 className="text-xl mb-2 text-[#2d2520]">Quiet Score</h4>
              <p className="text-[#6b5e52]">
                Acoustically optimized spaces for distraction-free focus
              </p>
            </motion.div>

            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-center">
              <div className="text-5xl mb-4 text-[#e5a930]">16hrs</div>
              <h4 className="text-xl mb-2 text-[#2d2520]">Daily Operations</h4>
              <p className="text-[#6b5e52]">Extended hours to match your schedule, not ours</p>
            </motion.div>

            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center">
              <div className="text-5xl mb-4 text-[#e5a930]">5min</div>
              <h4 className="text-xl mb-2 text-[#2d2520]">From Campus</h4>
              <p className="text-[#6b5e52]">
                Prime location in the heart of Manila&apos;s academic district
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Our Spaces */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl mb-6 text-[#2d2520]">Our Spaces</h2>
            <p className="text-xl text-[#6b5e52] max-w-3xl mx-auto">
              Thoughtfully designed environments for every type of work and study
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="group relative overflow-hidden rounded-3xl shadow-lg">
              <Image
                src="/images/individual.jpg"
                alt="Individual Study Pods"
                width={1200}
                height={1600}
                sizes="(min-width: 768px) 33vw, 100vw"
                className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-8">
                <div>
                  <h3 className="text-2xl text-white mb-2">Individual Pods</h3>
                  <p className="text-white/90">Private focus zones for deep concentration</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="group relative overflow-hidden rounded-3xl shadow-lg">
              <Image
                src="/images/public.jpg"
                alt="Public Workspace"
                width={720}
                height={960}
                sizes="(min-width: 768px) 33vw, 100vw"
                className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-8">
                <div>
                  <h3 className="text-2xl text-white mb-2">Open Workspace</h3>
                  <p className="text-white/90">Collaborative areas for teamwork and networking</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="group relative overflow-hidden rounded-3xl shadow-lg">
              <Image
                src="/images/sitting-down.jpg"
                alt="Quiet Zone"
                width={1200}
                height={1600}
                sizes="(min-width: 768px) 33vw, 100vw"
                className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-8">
                <div>
                  <h3 className="text-2xl text-white mb-2">Quiet Zones</h3>
                  <p className="text-white/90">Ultimate silence for exam preparation</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="group relative overflow-hidden rounded-3xl shadow-lg">
              <div className="w-full h-80 bg-gradient-to-br from-[#fef3dc] to-[#fff8ed] flex items-center justify-center border-4 border-[#e5a930]">
                <div className="text-center p-8">
                  <h3 className="text-2xl text-[#2d2520] mb-2">More Spaces</h3>
                  <p className="text-[#6b5e52]">Explore all our facilities in person</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-[#fef3dc] to-[#fff8ed]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}>
            <h2 className="text-4xl md:text-5xl mb-6 text-[#2d2520]">Ready to Find Your Focus?</h2>
            <p className="text-xl text-[#6b5e52] mb-8">
              Join hundreds of students and professionals who&apos;ve made Just In Time their
              productivity home.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/reserve"
                className="inline-flex items-center justify-center gap-2 bg-[#e5a930] text-white px-8 py-4 rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105">
                Reserve Your Seat
              </a>
              <a
                href="/virtual-tour"
                className="inline-flex items-center justify-center gap-2 bg-white text-[#2d2520] px-8 py-4 rounded-full border border-[#f3ede4] hover:shadow-lg transition-all duration-300 hover:scale-105">
                Take a Tour
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
