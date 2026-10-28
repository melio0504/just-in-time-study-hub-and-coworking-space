"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Check, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`,
      );
    }

    const error = new URLSearchParams(window.location.search).get('error');
    if (!error) return;

    const timer = window.setTimeout(() => setErrorMessage(error), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMessage('Supabase is not configured. Add your project values to .env.');
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.username,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (!data.session) {
      setSuccessMessage(`Your account was created. We sent a welcome email to ${formData.email}. Open it to confirm your address and activate your account.`);
      setFormData({ username: '', email: '', password: '', confirmPassword: '' });
      return;
    }

    router.replace('/account');
    router.refresh();
  };

  const handleGoogleSignUp = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!isSupabaseConfigured) {
      setErrorMessage('Supabase is not configured. Add your project values to .env.');
      return;
    }

    setIsGoogleSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsGoogleSubmitting(false);
    }
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
              <p className="text-sm text-[#6b5e52] uppercase tracking-wider mb-2">Make Every Session Count</p>
              <p className="text-2xl text-[#2d2520] mb-2">Plan your study time with ease</p>
              <p className="text-[#6b5e52]">Manage bookings, review your sessions, and keep your study routine organized in one place.</p>
            </div>
          </div>

          {/* Registration Form */}
          <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-[#f3ede4]">
            <h2 className="text-3xl mb-6 text-[#2d2520]">Create Account</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}
              {successMessage && (
                <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <p className="font-semibold">Check your inbox</p>
                  <p className="mt-1 leading-6">{successMessage}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={isSubmitting || isGoogleSubmitting}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-[#d8d0c5] bg-white px-8 py-4 font-medium text-[#2d2520] transition-colors hover:bg-[#fffcf7] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e5a930] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
                  <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
                  <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
                  <path fill="#FBBC05" d="M6.39 13.86A6.02 6.02 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z" />
                  <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.82 1.5l2.88-2.88A9.66 9.66 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
                </svg>
                {isGoogleSubmitting ? 'Redirecting to Google…' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-4" aria-hidden="true">
                <div className="h-px flex-1 bg-[#e8e1d8]" />
                <span className="text-xs uppercase tracking-wider text-[#8a7c70]">or continue with email</span>
                <div className="h-px flex-1 bg-[#e8e1d8]" />
              </div>

              <div>
                <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                  <User className="inline w-4 h-4 mr-1" />
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="nickname"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all placeholder:text-[#2d2520]/80 text-[#2d2520]"
                  placeholder="Enter a username"
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
                  <Lock className="inline w-4 h-4 mr-1" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all placeholder:text-[#2d2520]/80 text-[#2d2520]"
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6b5e52] transition-colors hover:text-[#e5a930] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e5a930] rounded-r-xl cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                  <Lock className="inline w-4 h-4 mr-1" />
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all placeholder:text-[#2d2520]/80 text-[#2d2520]"
                    placeholder="Re-enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                    aria-pressed={showConfirmPassword}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6b5e52] transition-colors hover:text-[#e5a930] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e5a930] rounded-r-xl"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isGoogleSubmitting}
                className="w-full bg-[#e5a930] text-white px-8 py-4 rounded-full hover:shadow-xl cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Creating Account…' : 'Create Account'}
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
