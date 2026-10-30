import { ArrowLeft, Database, LockKeyhole, Mail, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "How Just In Time Study Hub collects, uses, protects, and manages personal information.",
  path: "/privacy-policy",
});

const sections = [
  {
    title: "Information we collect",
    icon: Database,
    content: (
      <>
        <p>Depending on how you use our website and facility, we may collect:</p>
        <ul>
          <li>
            Account information, including your name, email address, phone number, and profile
            details.
          </li>
          <li>
            Reservation information, including selected seats, visit date and time, duration,
            reservation status, and cancellation details.
          </li>
          <li>
            Payment records, such as the amount, payment status, method, and transaction references.
            We do not ask you to place payment-account passwords or wallet credentials in your
            profile.
          </li>
          <li>
            Facility access information, including reservation QR passes, check-in and check-out
            times, and verified access records.
          </li>
          <li>
            Technical and usage information needed for authentication, security, troubleshooting,
            and service analytics.
          </li>
          <li>Messages or requests you send to our team.</li>
        </ul>
      </>
    ),
  },
  {
    title: "How we use your information",
    icon: UserCheck,
    content: (
      <ul>
        <li>Create and maintain your account.</li>
        <li>Process reservations, payments, cancellations, and facility check-ins.</li>
        <li>Show accurate seat availability and prevent overlapping reservations.</li>
        <li>Send service-related confirmations, updates, and important facility notices.</li>
        <li>
          Protect customers, employees, accounts, and business systems from misuse or unauthorized
          access.
        </li>
        <li>Understand service performance and improve our spaces and customer experience.</li>
        <li>Meet applicable legal, accounting, and regulatory requirements.</li>
      </ul>
    ),
  },
  {
    title: "How information is shared",
    icon: ShieldCheck,
    content: (
      <>
        <p>
          We do not sell your personal information. We may disclose limited information to service
          providers that help us operate authentication, database hosting, payment processing, email
          delivery, analytics, and website infrastructure. They may process information only for the
          services they provide to us and subject to appropriate safeguards.
        </p>
        <p>
          We may also disclose information when required by law, to respond to lawful government
          requests, to enforce our agreements, or to protect the rights, safety, and security of our
          customers, staff, and business.
        </p>
      </>
    ),
  },
  {
    title: "Retention and security",
    icon: LockKeyhole,
    content: (
      <>
        <p>
          We retain personal information only for as long as it is reasonably needed for the
          purposes described here, including providing your account and reservations, resolving
          disputes, maintaining business and payment records, preventing fraud, and satisfying legal
          obligations. Retention periods may differ depending on the type of record and applicable
          requirements.
        </p>
        <p>
          We use reasonable organizational, physical, and technical safeguards designed to protect
          personal information. Access to administrative records is restricted to authorized
          personnel and important staff actions are logged. No online service can guarantee absolute
          security, so please use a strong password and contact us if you suspect unauthorized
          account activity.
        </p>
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#fffaf2] pt-24 text-[#2d2520]">
      <header className="border-b border-[#eadfce] bg-[#fffcf7] px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-[#8a671a] transition-colors hover:text-[#684b0c]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fef0cf] text-[#b47b0d]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#9b6810]">
            Your information matters
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Privacy Policy
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5f5248]">
            This policy explains how Just In Time Study Hub and Coworking Space collects, uses,
            shares, retains, and protects personal information when you use our website, reservation
            services, and facility.
          </p>
          <p className="mt-5 text-sm font-medium text-[#5f5248]">Last updated: October 2, 2026</p>
        </div>
      </header>

      <main className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-3xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold">Our privacy commitment</h2>
            <p className="mt-4 leading-7 text-[#51463e]">
              We process personal information in accordance with applicable Philippine privacy
              requirements and the principles of transparency, legitimate purpose, and
              proportionality. We aim to collect only information that is relevant to operating our
              services and communicating with you clearly about its use.
            </p>
          </section>

          {sections.map(({ title, icon: Icon, content }) => (
            <section
              key={title}
              className="rounded-3xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8"
            >
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
            <h2 className="text-2xl font-semibold">Cookies and session storage</h2>
            <p className="mt-4 leading-7 text-[#51463e]">
              Our website uses essential browser storage and cookies to keep you signed in, protect
              account sessions, preserve an unfinished reservation, and remember necessary interface
              state. Disabling essential storage may prevent account or reservation features from
              working correctly.
            </p>
          </section>

          <section className="rounded-3xl border border-[#eadfce] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-semibold">Your privacy rights</h2>
            <p className="mt-4 leading-7 text-[#51463e]">
              Subject to applicable law and valid limitations, you may ask to be informed about our
              processing, access your information, correct inaccurate information, object to certain
              processing, request erasure or blocking, request data portability, or raise a
              complaint. We may need to verify your identity before acting on a request.
            </p>
            <p className="mt-4 leading-7 text-[#51463e]">
              You may also learn more about data-subject rights or submit a complaint through the{" "}
              <a
                href="https://privacy.gov.ph/data-subject-rights/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#8a671a] underline decoration-[#d7b36a] underline-offset-4 hover:text-[#684b0c]"
              >
                National Privacy Commission
              </a>
              .
            </p>
          </section>

          <section className="rounded-3xl bg-[#2d2520] p-6 text-white shadow-xl sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#f2c86f]">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold">Questions or privacy requests</h2>
                <p className="mt-3 leading-7 text-[#e4ddd6]">
                  Contact Just In Time Study Hub and Coworking Space and include enough information
                  for us to understand and respond to your request.
                </p>
                <a
                  href="mailto:jit.studyhub@gmail.com"
                  className="mt-4 inline-flex rounded-full bg-[#e5a930] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#cf9220]"
                >
                  jit.studyhub@gmail.com
                </a>
              </div>
            </div>
          </section>

          <p className="px-2 text-sm leading-6 text-[#5f5248]">
            We may update this policy when our practices, services, or legal obligations change. The
            updated date above will reflect the latest revision.
          </p>
        </div>
      </main>
    </div>
  );
}
