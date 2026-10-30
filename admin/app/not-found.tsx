import { MonitorCog } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-linear-to-b from-[#fffcf7] to-[#fff8ed] px-6">
      <section className="w-full max-w-xl rounded-3xl border border-[#f3ede4] bg-white p-8 text-center shadow-xl sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#e5a930]">
          Facility operations
        </p>
        <h1 className="mt-4 text-5xl font-semibold text-[#2d2520]">Page not found</h1>
        <p className="mt-4 text-[#6b5e52]">Return to the administrator sign-in page.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e5a930] px-6 py-3 text-white transition hover:shadow-lg"
          >
            <MonitorCog className="h-4 w-4" />
            Admin
          </Link>
        </div>
      </section>
    </main>
  );
}
