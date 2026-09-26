import Link from "next/link";
import { ArrowLeft, CalendarDays, Home, MapPin, Search, Sparkles } from "lucide-react";

const quickLinks = [
  { href: "/", label: "Go home", icon: Home },
  { href: "/reserve", label: "Reserve a seat", icon: CalendarDays },
  { href: "/pricing", label: "View pricing", icon: Sparkles },
  { href: "/virtual-tour", label: "Take a virtual tour", icon: Search },
];

export default function NotFound() {
  return (
    <main className="relative overflow-hidden bg-linear-to-b from-[#fffcf7] via-[#fff8ed] to-[#fff4e3]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-[#fef3dc] blur-3xl opacity-80" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-[#fff1d6] blur-3xl opacity-70" />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-7xl items-center px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f3ede4] bg-white/80 px-4 py-2 text-sm text-[#6b5e52] shadow-sm backdrop-blur-sm">
              <MapPin className="h-4 w-4 text-[#e5a930]" />
              You&apos;ve wandered off the study route
            </div>

            <h1 className="text-5xl font-semibold tracking-tight text-[#2d2520] sm:text-6xl lg:text-7xl">
              404
            </h1>

            <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#6b5e52] sm:text-xl">
              The page you&apos;re looking for isn&apos;t here, but your next productive session still is.
              Head back to the homepage or jump straight to the space you need.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e5a930] px-6 py-3 text-white transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                <Home className="h-4 w-4" />
                Back to home
              </Link>
              <Link
                href="/reserve"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#f3ede4] bg-white/80 px-6 py-3 text-[#2d2520] transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Reserve now
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {quickLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 rounded-2xl border border-[#f3ede4] bg-white/75 p-4 text-[#2d2520] shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#e5a930] hover:shadow-xl"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fef3dc] text-[#e5a930] transition-colors group-hover:bg-[#e5a930] group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium sm:text-base">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-0 rounded-4xl bg-[#e5a930]/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-4xl border border-[#f3ede4] bg-white/85 p-8 shadow-2xl backdrop-blur-sm sm:p-10">
              <div className="flex items-center justify-between text-sm text-[#6b5e52]">
                <span className="rounded-full bg-[#fef3dc] px-3 py-1 text-[#8a6510]">Lost page</span>
                <span>Just in Time Study Hub</span>
              </div>

              <div className="mt-8 rounded-[1.75rem] border border-dashed border-[#f3ede4] bg-[#fffcf7] p-8 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#fef3dc] text-[#e5a930] shadow-sm">
                  <Search className="h-11 w-11" />
                </div>
                <p className="mt-6 text-2xl font-semibold text-[#2d2520]">Nothing to see here</p>
                <p className="mt-3 text-sm leading-relaxed text-[#6b5e52]">
                  Try one of the quick links, or return to the homepage to continue browsing the study spaces,
                  pricing, and reservations.
                </p>
              </div>

              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#fffcf7] px-4 py-3 text-sm text-[#6b5e52]">
                <CalendarDays className="h-4 w-4 text-[#e5a930]" />
                Open daily for your next focused session
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}