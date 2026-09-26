import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Bus,
  CalendarDays,
  Clock3,
  CloudRain,
  Coffee,
  Construction,
  Megaphone,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Announcements | Just In Time Study Hub',
  description: 'Current notices, schedule changes, closures, and past updates from Just In Time Study Hub.',
};

const currentAnnouncements = [
  {
    title: 'Extended study hours for exam season',
    date: 'September 21 – October 11, 2026',
    label: 'Current',
    category: 'Hours',
    icon: Clock3,
    featured: true,
    body: 'Finals are around the corner, so we are keeping the lights on longer. The hub is open from 8:00 AM to 5:00 AM daily throughout exam season. Walk-ins are welcome, subject to seat availability.',
  },
  {
    title: 'Delayed opening for air-conditioning maintenance',
    date: 'September 29, 2026',
    label: 'Upcoming',
    category: 'Maintenance',
    icon: Wrench,
    body: 'We will open at 10:00 AM while our cooling system receives scheduled preventive maintenance. Regular operating hours resume immediately after opening. Thank you for bearing with us while we keep the space comfortable.',
  },
  {
    title: 'All Saints’ weekend schedule',
    date: 'October 31 – November 2, 2026',
    label: 'Upcoming',
    category: 'Holiday',
    icon: CalendarDays,
    body: 'The study hub will close at 10:00 PM on October 31 and remain closed on November 1. We reopen at 12:00 noon on November 2. Please plan longer study sessions and reservations ahead of time.',
  },
] as const;

const pastAnnouncements = [
  {
    title: 'Transport strike advisory',
    date: 'September 22, 2026',
    category: 'Advisory',
    icon: Bus,
    body: 'The hub remained open on its regular schedule during the announced transport strike. Guests were advised to allow extra travel time and message the front desk if a reservation needed to be moved.',
  },
  {
    title: 'Deep-cleaning morning',
    date: 'August 30, 2026',
    category: 'Maintenance',
    icon: Sparkles,
    body: 'We opened at 11:00 AM after a scheduled deep clean and sanitation of shared desks, private pods, pantry surfaces, and air-conditioning units.',
  },
  {
    title: 'Severe weather closure',
    date: 'July 24, 2026',
    category: 'Closure',
    icon: CloudRain,
    body: 'For the safety of guests and staff, the hub closed early at 6:00 PM because of heavy rainfall and flooding around parts of Metro Manila. Affected reservations were moved at no extra charge.',
  },
  {
    title: 'Independence Day operating hours',
    date: 'June 12, 2026',
    category: 'Holiday',
    icon: PartyPopper,
    body: 'We welcomed guests from 10:00 AM to 10:00 PM on Independence Day. Regular extended hours resumed the following morning.',
  },
  {
    title: 'Power interruption notice',
    date: 'May 17, 2026',
    category: 'Maintenance',
    icon: Construction,
    body: 'The building completed scheduled electrical work from 8:00 AM to 1:00 PM. The hub opened at 2:00 PM after power, internet, and cooling systems were checked.',
  },
  {
    title: 'Holy Week closure',
    date: 'April 2 – 4, 2026',
    category: 'Holiday',
    icon: CalendarDays,
    body: 'The hub was closed from Maundy Thursday through Black Saturday. Regular operations resumed on Easter Sunday at 12:00 noon.',
  },
  {
    title: 'New Year reopening',
    date: 'January 2, 2026',
    category: 'Holiday',
    icon: Coffee,
    body: 'We reopened for the new year at 12:00 noon, with regular hours returning on January 3. Fresh coffee and quiet desks were ready for everyone starting the year in focus mode.',
  },
] as const;

function AnnouncementMeta({ date, category }: { date: string; category: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#76685c]">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        {date}
      </span>
      <span className="rounded-full bg-[#f7f1e8] px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-[#8a7040]">
        {category}
      </span>
    </div>
  );
}

export default function AnnouncementsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] via-[#fffaf2] to-[#fff8ed] pt-24 text-[#2d2520]">
      <section className="relative overflow-hidden px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
        <div className="absolute -right-32 top-6 h-96 w-96 rounded-full bg-[#f6dfae]/35 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-white/80 blur-3xl" aria-hidden="true" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f1dfbc] bg-[#fef3dc] px-4 py-2 text-sm font-medium uppercase tracking-[0.16em] text-[#b47b0d]">
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            Hub updates
          </div>
          <h1 className="text-4xl leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Plan your study day <span className="text-[#e5a930]">with confidence.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#6b5e52] sm:text-xl">
            Find the latest operating hours, closures, maintenance notices, and important updates before heading to the hub.
          </p>
          <p className="mt-5 text-sm text-[#8b7b6c]">Last updated September 27, 2026</p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6" aria-labelledby="current-announcements">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.16em] text-[#b47b0d]">Right now</p>
              <h2 id="current-announcements" className="text-3xl tracking-tight sm:text-4xl">Current announcements</h2>
            </div>
            <p className="text-sm text-[#76685c]">{currentAnnouncements.length} active notices</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {currentAnnouncements.map((announcement) => {
              const Icon = announcement.icon;
              return (
                <article
                  key={announcement.title}
                  className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 shadow-[0_18px_50px_rgba(95,72,39,0.08)] sm:p-8 ${
                    'featured' in announcement && announcement.featured
                      ? 'border-[#e8bd61] bg-[#fffaf0] lg:col-span-2'
                      : 'border-[#eee4d7] bg-white/80'
                  }`}
                >
                  {'featured' in announcement && announcement.featured && (
                    <div className="absolute inset-x-0 top-0 h-1 bg-[#e5a930]" aria-hidden="true" />
                  )}
                  <div className="mb-7 flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fef0cf] text-[#c98d17]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#eef8ef] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#3f7947]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#5a9a62]" aria-hidden="true" />
                      {announcement.label}
                    </span>
                  </div>
                  <AnnouncementMeta date={announcement.date} category={announcement.category} />
                  <h3 className="mt-5 text-2xl font-medium tracking-tight sm:text-[1.65rem]">{announcement.title}</h3>
                  <p className="mt-4 leading-7 text-[#6b5e52]">{announcement.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-[#eee4d7] bg-white/45 px-4 py-20 sm:px-6" aria-labelledby="past-announcements">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.16em] text-[#9a8876]">Archive</p>
            <h2 id="past-announcements" className="text-3xl tracking-tight sm:text-4xl">Past announcements</h2>
          </div>

          <div className="divide-y divide-[#eee4d7] overflow-hidden rounded-3xl border border-[#eee4d7] bg-[#fffcf8] shadow-[0_16px_45px_rgba(95,72,39,0.06)]">
            {pastAnnouncements.map((announcement) => {
              const Icon = announcement.icon;
              return (
                <article key={announcement.title} className="grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7f1e8] text-[#927d67]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <AnnouncementMeta date={announcement.date} category={announcement.category} />
                    <h3 className="mt-4 text-xl font-medium tracking-tight sm:text-2xl">{announcement.title}</h3>
                    <p className="mt-3 max-w-4xl leading-7 text-[#6b5e52]">{announcement.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 rounded-3xl bg-[#2d2520] p-8 text-white shadow-xl sm:p-10 md:flex-row md:items-center">
          <div className="flex max-w-2xl items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 sm:flex">
              <ShieldCheck className="h-6 w-6 text-[#f2c86f]" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-2xl tracking-tight sm:text-3xl">Still planning your visit?</h2>
              <p className="mt-3 leading-7 text-[#d7cec5]">
                Reserve ahead for busy exam weeks, or contact the front desk to confirm same-day seat availability.
              </p>
            </div>
          </div>
          <Link
            href="/reserve"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#e5a930] px-6 py-3.5 font-medium text-white transition-all hover:scale-105 hover:bg-[#d69b27]"
          >
            Reserve a seat
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
