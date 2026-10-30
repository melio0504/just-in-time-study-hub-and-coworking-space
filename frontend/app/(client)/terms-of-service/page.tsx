import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  CircleDollarSign,
  KeyRound,
  Mail,
  Scale,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Terms of Service",
  description:
    "Terms for using the Just In Time Study Hub website, reservation services, and facility.",
  path: "/terms-of-service",
});

const sections = [
  {
    title: "Accounts and eligibility",
    icon: UserRoundCheck,
    content: (
      <>
        <p>
          You must provide accurate, current information when creating an account or reservation.
          You are responsible for activity under your account and for keeping your sign-in details
          secure.
        </p>
        <p>
          If you are under the age of legal majority, you may use our services only with the
          involvement and consent of a parent or legal guardian. We may refuse, suspend, or close an
          account when reasonably necessary to protect customers, staff, or our services.
        </p>
      </>
    ),
  },
  {
    title: "Reservations and access",
    icon: CalendarCheck,
    content: (
      <ul>
        <li>
          A reservation is subject to seat availability and is confirmed only after any required
          payment is successfully completed.
        </li>
        <li>
          You must review the selected date, time, duration, seats, and contact details before
          completing a reservation.
        </li>
        <li>
          Your reservation and QR access pass are personal to you. Do not share, duplicate, resell,
          or misuse them.
        </li>
        <li>
          Please arrive and leave within your reserved schedule. Continued use may require an
          extension or an additional fee and remains subject to availability.
        </li>
        <li>
          We may verify your reservation, account information, or identity before granting access to
          the facility.
        </li>
      </ul>
    ),
  },
  {
    title: "Prices, payments, and cancellations",
    icon: CircleDollarSign,
    content: (
      <>
        <p>
          Prices are shown in Philippine pesos and may change from time to time. The amount
          presented for confirmation when you place a reservation is the amount that applies to that
          transaction, unless there is an obvious pricing or technical error.
        </p>
        <p>
          Payments may be processed by third-party payment providers under their own terms. If a
          payment fails, expires, is reversed, or cannot be verified, the reservation may remain
          unconfirmed or be released.
        </p>
        <p>
          Cancellation, rescheduling, credit, and refund requests are subject to the policy
          communicated for the applicable reservation or package and to applicable law. Contact us
          promptly if you believe a charge or reservation is incorrect.
        </p>
      </>
    ),
  },
  {
    title: "Facility conduct",
    icon: BadgeCheck,
    content: (
      <>
        <p>
          Please use the facility in a considerate way that supports a safe and productive
          environment. You agree to follow posted notices and reasonable instructions from our
          staff.
        </p>
        <ul>
          <li>Respect other customers, employees, shared spaces, and quiet areas.</li>
          <li>
            Use furniture, equipment, internet access, refreshments, and other amenities
            responsibly.
          </li>
          <li>
            Do not engage in unlawful, dangerous, disruptive, abusive, or fraudulent activity.
          </li>
          <li>
            Do not damage property, interfere with security or network systems, or access restricted
            areas.
          </li>
          <li>Keep your belongings with you and leave your space reasonably clean.</li>
        </ul>
        <p>
          We may ask anyone who creates a safety risk, materially disrupts others, or violates these
          Terms to leave the facility. Serious or repeated violations may result in suspended access
          without limiting any other remedies available to us.
        </p>
      </>
    ),
  },
  {
    title: "Acceptable use of our website",
    icon: ShieldAlert,
    content: (
      <p>
        You may use our website only for lawful personal or business purposes related to our
        services. You must not attempt to bypass security, access another person&apos;s account,
        submit false information, scrape or overload the service, introduce malicious code, reverse
        engineer protected parts of the service, or use automated means that interfere with normal
        operation.
      </p>
    ),
  },
  {
    title: "Service availability",
    icon: KeyRound,
    content: (
      <p>
        We work to keep our website, reservations, internet connection, utilities, and facility
        amenities available, but uninterrupted service cannot be guaranteed. Hours, seating,
        features, and amenities may change because of maintenance, emergencies, safety concerns,
        events beyond our reasonable control, or other operational needs. When practical, we will
        provide notice and reasonable assistance for materially affected reservations.
      </p>
    ),
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#fffaf2] pt-24 text-[#2d2520]">
      <header className="border-b border-[#eadfce] bg-[#fffcf7] px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#8a671a] transition-colors hover:text-[#684b0c]">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fef0cf] text-[#b47b0d]">
            <Scale className="h-7 w-7" />
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#9b6810]">
            Using our space and services
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Terms of Service
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5f5248]">
            These Terms explain the rules that apply when you use the Just In Time Study Hub and
            Coworking Space website, reservation services, access passes, amenities, and facility.
          </p>
          <p className="mt-5 text-sm font-medium text-[#5f5248]">Last updated: October 13, 2026</p>
        </div>
      </header>

      <main className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-3xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold">Agreement to these Terms</h2>
            <div className="mt-4 space-y-4 leading-7 text-[#51463e]">
              <p>
                By accessing our website, creating an account, making a reservation, purchasing a
                package, or using our facility, you agree to these Terms and our{" "}
                <Link
                  href="/privacy-policy"
                  className="font-semibold text-[#8a671a] underline decoration-[#d7b36a] underline-offset-4 hover:text-[#684b0c]">
                  Privacy Policy
                </Link>
                .
              </p>
              <p>
                If you do not agree, please do not use our website or services. These Terms form an
                agreement between you and Just In Time Study Hub and Coworking Space.
              </p>
            </div>
          </section>

          {sections.map(({ title, icon: Icon, content }) => (
            <section
              key={title}
              className="rounded-3xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fef3dc] text-[#9b6810]">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="text-2xl font-semibold">{title}</h2>
              </div>
              <div className="mt-5 space-y-4 leading-7 text-[#51463e] [&_li]:pl-1 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
                {content}
              </div>
            </section>
          ))}

          <section className="rounded-3xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold">Ownership and third-party services</h2>
            <div className="mt-4 space-y-4 leading-7 text-[#51463e]">
              <p>
                Our website, branding, text, graphics, and original content are owned by or licensed
                to Just In Time Study Hub and Coworking Space and are protected by applicable
                intellectual-property laws. These Terms do not transfer ownership rights to you.
              </p>
              <p>
                Our services may rely on or link to third-party services, including authentication,
                payment, email, maps, and social platforms. We are not responsible for third-party
                services that we do not control, and your use of them may be governed by separate
                terms.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold">Responsibility and limitations</h2>
            <div className="mt-4 space-y-4 leading-7 text-[#51463e]">
              <p>
                You are responsible for your personal belongings and for loss or damage caused by
                your misuse of the facility or services. To the extent permitted by law, our
                services are provided as available, and we are not liable for indirect, incidental,
                or consequential losses arising from their use.
              </p>
              <p>
                Nothing in these Terms excludes or limits rights, warranties, or liabilities that
                cannot lawfully be excluded or limited, including applicable consumer rights. Our
                responsibility for any claim will be determined under Philippine law based on the
                circumstances of that claim.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold">Changes and governing law</h2>
            <div className="mt-4 space-y-4 leading-7 text-[#51463e]">
              <p>
                We may update these Terms to reflect changes to our services, operations, or legal
                obligations. The updated date above will show the latest revision. If a change is
                material, we will take reasonable steps to notify you where appropriate.
              </p>
              <p>
                These Terms are governed by the laws of the Republic of the Philippines. We
                encourage you to contact us first so we can try to resolve any concern promptly. Any
                dispute that cannot be resolved informally will be handled by the courts or other
                authorities with jurisdiction under applicable law.
              </p>
            </div>
          </section>

          <section className="rounded-3xl bg-[#2d2520] p-6 text-white shadow-xl sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#f2c86f]">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold">Questions about these Terms?</h2>
                <p className="mt-3 leading-7 text-[#e4ddd6]">
                  Contact Just In Time Study Hub and Coworking Space if you have a question about a
                  reservation, payment, facility rule, or these Terms.
                </p>
                <a
                  href="mailto:jit.studyhub@gmail.com"
                  className="mt-4 inline-flex rounded-full bg-[#e5a930] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#cf9220]">
                  jit.studyhub@gmail.com
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
