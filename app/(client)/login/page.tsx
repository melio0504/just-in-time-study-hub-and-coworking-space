"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export default function Login() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isSupabaseConfigured) {
      setErrorMessage('Supabase is not configured. Add your project values to .env.');
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(formData);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.push('/account');
    router.refresh();
  };

  const benefits = [
    'Access your booking history instantly',
    'View your study analytics dashboard',
    'Redeem your loyalty points',
    'Manage your account preferences',
  ];

  return (
    <div className="min-h-screen bg-linear-to-b from-[#fffcf7] to-[#fff8ed] pt-24">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Marketing Section */}
          <div className="md:sticky md:top-32">
            <h1 className="text-5xl md:text-6xl mb-6 text-[#2d2520]">
              Welcome Back
            </h1>
            <p className="text-xl text-[#6b5e52] mb-8 leading-relaxed">
              Sign in to continue your productivity journey with us.
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
              <p className="text-sm text-[#6b5e52] uppercase tracking-wider mb-2">Your Stats Await</p>
              <p className="text-2xl text-[#2d2520] mb-2">Track Your Progress</p>
              <p className="text-[#6b5e52]">See your study hours, loyalty points, and upcoming bookings</p>
            </div>
          </div>

          {/* Login Form */}
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-[#f3ede4]">
            <h2 className="text-3xl mb-6 text-[#2d2520]">Sign In</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}
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
                    placeholder="Enter your password"
                  />
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-[#f3ede4] text-[#e5a930] focus:ring-[#e5a930]" />
                  <span className="text-[#6b5e52]">Remember me</span>
                </label>
                <button type="button" className="text-[#e5a930] hover:underline">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#e5a930] text-white px-8 py-4 rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Signing In…' : 'Sign In'}
              </button>

              <p className="text-sm text-[#6b5e52] text-center mt-4">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-[#e5a930] hover:underline">
                  Create account
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
