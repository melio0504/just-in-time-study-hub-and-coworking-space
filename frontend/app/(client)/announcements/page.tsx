import Link from 'next/link';
import { ArrowRight, CalendarDays, Megaphone, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({
  title: 'Announcements & Updates',
  description: 'See current hours, closures, maintenance notices, and important customer updates from Just In Time Study Hub in Manila.',
  path: '/announcements',
});

const announcementsPerPage = 8;

function getPageNumber(value: string | string[] | undefined) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const supabase = await createClient();
  const requestedPage = getPageNumber((await searchParams).page);
  const { count } = await supabase
    .from('announcements')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');
  const announcementCount = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(announcementCount / announcementsPerPage));
  const currentPage = Math.min(requestedPage, pageCount);
  const firstRow = (currentPage - 1) * announcementsPerPage;
  const { data: announcements } = await supabase
    .from('announcements')
    .select()
    .eq('status', 'published')
    .order('starts_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(firstRow, firstRow + announcementsPerPage - 1);
  const latest = currentPage === 1 ? announcements?.[0] : null;

  return <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] via-[#fffaf2] to-[#fff8ed] pt-24 text-[#2d2520]">
    <section className="px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-24"><div className="mx-auto max-w-5xl"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f1dfbc] bg-[#fef3dc] px-4 py-2 text-sm font-medium uppercase tracking-[0.16em] text-[#b47b0d]"><Megaphone className="h-4 w-4" />Hub updates</div><h1 className="text-4xl leading-tight tracking-tight sm:text-5xl md:text-6xl">Plan your study day <span className="text-[#e5a930]">with confidence.</span></h1><p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#6b5e52] sm:text-xl">The latest hours, closures, maintenance notices, and important updates published directly by our team.</p>{latest && <p className="mt-5 text-sm text-[#8b7b6c]">Last updated {new Date(latest.updated_at).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })}</p>}</div></section>
    <section className="px-4 pb-20 sm:px-6"><div className="mx-auto max-w-6xl"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="mb-2 text-sm font-medium uppercase tracking-[0.16em] text-[#b47b0d]">From the hub</p><h2 className="text-3xl tracking-tight sm:text-4xl">Announcements</h2></div><p className="text-sm text-[#76685c]">{announcementCount} published</p></div>
      <div className="grid gap-6 lg:grid-cols-2">{announcements?.map((announcement, index) => {
        const isLatest = currentPage === 1 && index === 0;
        return <article key={announcement.id} className={`relative overflow-hidden rounded-3xl border p-7 shadow-[0_18px_50px_rgba(95,72,39,0.08)] ${isLatest ? 'border-[#e8bd61] bg-[#fffaf0] lg:col-span-2' : 'border-[#eee4d7] bg-white/80'}`}>{isLatest && <div className="absolute inset-x-0 top-0 h-1 bg-[#e5a930]" />}<div className="mb-5 flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fef0cf] text-[#c98d17]"><Megaphone className="h-6 w-6" /></span>{isLatest && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">Latest</span>}</div><p className="flex items-center gap-2 text-sm text-[#76685c]"><CalendarDays className="h-4 w-4" />{new Date(announcement.starts_at || announcement.created_at).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' })}</p><h3 className="mt-4 text-2xl font-semibold tracking-tight">{announcement.title}</h3><p className="mt-3 whitespace-pre-line leading-7 text-[#6b5e52]">{announcement.body}</p></article>;
      })}</div>
      {!announcements?.length && <div className="rounded-3xl border border-[#eee4d7] bg-white p-12 text-center text-[#76685c]"><Megaphone className="mx-auto mb-3 h-8 w-8" /><p>No active announcements right now.</p></div>}
      {pageCount > 1 && <nav aria-label="Announcement pages" className="mt-10 flex flex-wrap items-center justify-center gap-2"><Link href={`/announcements?page=${Math.max(1, currentPage - 1)}`} aria-disabled={currentPage === 1} tabIndex={currentPage === 1 ? -1 : undefined} className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${currentPage === 1 ? 'pointer-events-none border-[#e5ddd3] text-[#a89c90]' : 'border-[#d8c9b9] bg-white text-[#4f443c] hover:bg-[#fff4dc]'}`}>Previous</Link>{Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => <Link key={page} href={`/announcements?page=${page}`} aria-label={`Go to announcement page ${page}`} aria-current={page === currentPage ? 'page' : undefined} className={`flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-semibold transition ${page === currentPage ? 'border-[#2d2520] bg-[#2d2520] text-white' : 'border-[#d8c9b9] bg-white text-[#4f443c] hover:bg-[#fff4dc]'}`}>{page}</Link>)}<Link href={`/announcements?page=${Math.min(pageCount, currentPage + 1)}`} aria-disabled={currentPage === pageCount} tabIndex={currentPage === pageCount ? -1 : undefined} className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${currentPage === pageCount ? 'pointer-events-none border-[#e5ddd3] text-[#a89c90]' : 'border-[#d8c9b9] bg-white text-[#4f443c] hover:bg-[#fff4dc]'}`}>Next</Link></nav>}
      {pageCount > 1 && <p className="mt-4 text-center text-sm text-[#76685c]">Page {currentPage} of {pageCount}</p>}
    </div></section>
    <section className="px-4 py-20 sm:px-6"><div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 rounded-3xl bg-[#2d2520] p-8 text-white shadow-xl sm:p-10 md:flex-row md:items-center"><div className="flex max-w-2xl items-start gap-4"><span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 sm:flex"><ShieldCheck className="h-6 w-6 text-[#f2c86f]" /></span><div><h2 className="text-2xl tracking-tight sm:text-3xl">Ready to plan your visit?</h2><p className="mt-3 leading-7 text-[#d7cec5]">Reserve ahead for busy weeks, or contact the front desk for same-day availability.</p></div></div><Link href="/reserve" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#e5a930] px-6 py-3.5 font-medium transition hover:bg-[#d69b27]">Reserve a seat<ArrowRight className="h-4 w-4" /></Link></div></section>
  </div>;
}
