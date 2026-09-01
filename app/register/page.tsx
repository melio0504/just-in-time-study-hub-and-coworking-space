"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Phone, Check } from 'lucide-react';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userName', formData.fullName);
    localStorage.setItem('userEmail', formData.email);
    router.push('/account');
  };

  const benefits = [
    'View all your past bookings in one place',
    'Track your study hours with visual dashboard',
    'Earn loyalty points with every visit',
    'Get exclusive member-only promotions',
    'Priority booking for your favorite seats',
    'Personalized study insights and analytics',
  ];

  return (
    <div className="min-h-screen bg-linear-to-b from-[#fffcf7] to-[#fff8ed] pt-24">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Marketing Section */}
          <div className="md:sticky md:top-32">
            <h1 className="text-5xl md:text-6xl mb-6 text-[#2d2520]">
              Join Our Community
            </h1>
            <p className="text-xl text-[#6b5e52] mb-8 leading-relaxed">
              Create an account to unlock exclusive features and make the most of your study sessions.
            </p>

            <div className="space-y-4 mb-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#e5a930] rounded-full flex items-center justify-center shrink-0 mt-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-[#2d2520]">{benefit}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#fef3dc] rounded-2xl p-6 border border-[#e5a930]">
              <p className="text-sm text-[#6b5e52] uppercase tracking-wider mb-2">Member Exclusive</p>
              <p className="text-2xl text-[#2d2520] mb-2">Get 10% off your first booking</p>
              <p className="text-[#6b5e52]">Plus earn 100 welcome points when you sign up today</p>
            </div>
          </div>

          {/* Registration Form */}
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-[#f3ede4]">
            <h2 className="text-3xl mb-6 text-[#2d2520]">Create Account</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                  <User className="inline w-4 h-4 mr-1" />
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all placeholder:text-[#2d2520]/80 text-[#2d2520]"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                  <Mail className="inline w-4 h-4 mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all placeholder:text-[#2d2520]/80 text-[#2d2520]"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                  <Phone className="inline w-4 h-4 mr-1" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all placeholder:text-[#2d2520]/80 text-[#2d2520]"
                  placeholder="09XX XXX XXXX"
                />
              </div>

              <div>
                <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                  <Lock className="inline w-4 h-4 mr-1" />
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all placeholder:text-[#2d2520]/80 text-[#2d2520]"
                  placeholder="Create a strong password"
                />
              </div>

              <div>
                <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                  <Lock className="inline w-4 h-4 mr-1" />
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all placeholder:text-[#2d2520]/80 text-[#2d2520]"
                  placeholder="Re-enter your password"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#e5a930] text-white px-8 py-4 rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                Create Account
              </button>

              <p className="text-sm text-[#6b5e52] text-center mt-4">
                Already have an account?{' '}
                <Link href="/login" className="text-[#e5a930] hover:underline">
                  Login
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
