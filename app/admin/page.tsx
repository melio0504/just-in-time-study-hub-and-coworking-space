"use client";

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Shield, Check } from 'lucide-react';

export default function AdminLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check credentials
    if (formData.email === 'jit@admin.com' && formData.password === 'adminpassword') {
      localStorage.setItem('isAdminLoggedIn', 'true');
      localStorage.setItem('adminName', 'Admin User');
      localStorage.setItem('adminEmail', formData.email);
      router.push('/admin/dashboard');
    } else {
      alert('Invalid credentials. Please use jit@admin.com / adminpassword');
    }
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
            <Image src="/images/logo.png" alt="Just in Time" width={96} height={96} className="mb-4" style={{ width: '6rem', height: 'auto' }} />
            <h2 className="text-3xl text-[#2d2520] mb-6">Admin Sign In</h2>

            <div className="bg-[#fef3dc] rounded-xl p-4 mb-6 border border-[#e5a930]/30">
              <p className="text-sm text-[#6b5e52]">
                <strong>Note:</strong> This portal is for authorized administrators only. All access attempts are logged.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full bg-[#e5a930] text-white px-8 py-4 rounded-full hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                Sign In to Admin Portal
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
