"use client";

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Shield, Check } from 'lucide-react';
import { defaultAdminPath, hasAdminAccess, type AdminAccess, type StaffPermission } from '@/lib/admin-access';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export default function AdminLogin() {
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
    const { data, error } = await supabase.auth.signInWithPassword(formData);

    if (error || !data.user) {
      setIsSubmitting(false);
      setErrorMessage(error?.message ?? 'Unable to sign in.');
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active, must_change_password, staff_permissions')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile || !profile.is_active || !['admin', 'staff'].includes(profile.role)) {
      await supabase.auth.signOut({ scope: 'local' });
      setIsSubmitting(false);
      setErrorMessage('This account does not have administrator access.');
      return;
    }

    if (profile.must_change_password) {
      const requestedPath = new URLSearchParams(window.location.search).get('next');
      router.push(requestedPath === '/kiosk' ? '/admin/change-password?next=%2Fkiosk' : '/admin/change-password');
      router.refresh();
      return;
    }

    await supabase.rpc('log_admin_access', { p_action: 'Signed in to admin dashboard' });
    const access: AdminAccess = {
      role: profile.role as AdminAccess['role'],
      permissions: profile.staff_permissions as StaffPermission[],
    };
    const requestedPath = new URLSearchParams(window.location.search).get('next');
    if (requestedPath === '/kiosk') {
      if (!hasAdminAccess(access, 'seating')) {
        await supabase.auth.signOut({ scope: 'local' });
        setIsSubmitting(false);
        setErrorMessage('This account does not have seating access. Sign in with an authorized kiosk account.');
        return;
      }
      router.push('/kiosk');
      router.refresh();
      return;
    }

    router.push(defaultAdminPath(access));
    router.refresh();
  };

  const adminBenefits = [
    'Manage all facility bookings',
    'View real-time analytics and reports',
    'Monitor user accounts and activity',
    'Configure system settings and preferences',
  ];

  return (
    <div className="min-h-screen bg-linear-to-b from-[#fffcf7] to-[#fff8ed]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Marketing Section */}
          <div className="md:sticky md:top-32">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#e5a930] rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm text-[#e5a930] uppercase tracking-wider">Admin Portal</span>
            </div>

            <h1 className="text-5xl md:text-6xl mb-6 text-[#2d2520]">
              Administrator Access
            </h1>
            <p className="text-xl text-[#6b5e52] mb-8 leading-relaxed">
              Sign in to manage your facility and monitor operations.
            </p>

            <div className="space-y-4 mb-8">
              {adminBenefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-[#e5a930] rounded-full flex items-center justify-center shrink-0 mt-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-[#2d2520]">{benefit}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#fef3dc] rounded-2xl p-6 border border-[#e5a930]">
              <p className="text-sm text-[#6b5e52] uppercase tracking-wider mb-2">Secure Access</p>
              <p className="text-2xl text-[#2d2520] mb-2">Protected Dashboard</p>
              <p className="text-[#6b5e52]">Your admin credentials are encrypted and secure</p>
            </div>
          </div>

          {/* Admin Login Form */}
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-[#f3ede4]">
            <Image src="/images/logo.png" alt="Just in Time" width={245} height={118} loading="eager" className="mb-4" style={{ width: '6rem', height: 'auto' }} />
            <h2 className="text-3xl text-[#2d2520] mb-6">Admin Sign In</h2>

            <div className="bg-[#fef3dc] rounded-xl p-4 mb-6 border border-[#e5a930]/30">
              <p className="text-sm text-[#6b5e52]">
                <strong>Note:</strong> This portal is for authorized administrators only. All access attempts are logged.
              </p>
              <p className="mt-2 text-sm text-[#6b5e52]">
                Need an employee account? Contact your manager so they can create and authorize one for you.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {errorMessage && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}
              <div>
                <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                  <Mail className="inline w-4 h-4 mr-1" />
                  Admin Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] placeholder:text-[#6b5e52] focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                  <Lock className="inline w-4 h-4 mr-1" />
                  Admin Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] placeholder:text-[#6b5e52] focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all"
                  placeholder="Enter your secure password"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#e5a930] text-white px-8 py-4 rounded-full hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? 'Signing In…' : 'Sign In to Admin Portal'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
