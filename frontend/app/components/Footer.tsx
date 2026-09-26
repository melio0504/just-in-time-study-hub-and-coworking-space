"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Instagram, Mail, Phone, MapPin, Clock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#fffcf7] border-t border-[#f3ede4]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12">
          <div className="col-span-1 sm:col-span-2">
            <Image
              src="/images/logo.png"
              alt="Study Hub Logo"
              width={245}
              height={118}
              className="h-10 sm:h-12 w-auto mb-4"
            />
            <p className="text-[#6b5e52] max-w-md leading-relaxed mb-6">
              Clean, bright, and very conducive study and work place in the heart of Manila.
              All the essentials for productivity, none of the distractions.
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#e5a930] mt-1 flex-shrink-0" />
                <p className="text-[#6b5e52] text-sm">
                  2nd Floor Mendiola Square Bldg., 2138 C.M. Recto Avenue, Quiapo Manila, Philippines
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#e5a930] flex-shrink-0" />
                <a href="mailto:jit.studyhub@gmail.com" className="text-[#6b5e52] text-sm hover:text-[#e5a930] transition-colors">
                  jit.studyhub@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#e5a930] flex-shrink-0" />
                <a href="tel:09062885570" className="text-[#6b5e52] text-sm hover:text-[#e5a930] transition-colors">
                  09062885570
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#e5a930] flex-shrink-0" />
                <p className="text-[#6b5e52] text-sm">8:00 AM - 5:00 AM Daily</p>
              </div>
              <div className="flex mt-6 gap-4">
                <a
                  href="https://www.facebook.com/jit.studyhub/"
                  className="text-[#6b5e52] hover:text-[#e5a930] transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="w-5 h-5" />
                </a>
                <a
                  href="https://www.instagram.com/jitstudyhub/"
                  className="text-[#6b5e52] hover:text-[#e5a930] transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://www.tiktok.com/@jitstudyhubandcoworking"
                  className="text-[#6b5e52] hover:text-[#e5a930] transition-colors"
                  aria-label="TikTok"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[#3d3329] mb-4">Explore</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/pricing" className="text-[#6b5e52] hover:text-[#e5a930] transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/virtual-tour" className="text-[#6b5e52] hover:text-[#e5a930] transition-colors">
                  Virtual Tour
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="text-[#6b5e52] hover:text-[#e5a930] transition-colors">
                  Gallery
                </Link>
              </li>
              <li>
                <Link href="/reserve" className="text-[#6b5e52] hover:text-[#e5a930] transition-colors">
                  Reserve Now
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[#3d3329] mb-4">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-[#6b5e52] hover:text-[#e5a930] transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/register" className="text-[#6b5e52] hover:text-[#e5a930] transition-colors">
                  Register
                </Link>
              </li>
              <li>
                <a href="#" className="text-[#6b5e52] hover:text-[#e5a930] transition-colors">
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#f3ede4] mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[#6b5e52] text-sm">
            © 2026 Just In Time Study Hub and Coworking Space. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
