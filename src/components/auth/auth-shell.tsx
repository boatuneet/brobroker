import Link from "next/link";
import type { ReactNode } from "react";

/* Shared chrome for /login and /signup. Mirrors the deep-green sidebar
   on the left for brand continuity, and isolates the form to a clean
   white card on the right so credential entry feels focused. */
export function AuthShell({
  children,
  eyebrow,
  title,
  description,
  footer,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      {/* Brand panel — deep green, mirrors the app sidebar.
          Wider than before (440 → 560) so the editorial pitch breathes. */}
      <aside className="relative hidden bg-[#003C33] text-[#F4ECD8] lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <Link className="inline-flex items-baseline" href="/dashboard">
          {/* Logotype matches the sidebar Brobroker. wordmark — Fraunces
              display font, period included. */}
          <span className="font-display text-[2rem] font-bold tracking-tight text-white">
            Brobroker.
          </span>
        </Link>

        <div className="grid gap-6">
          <p className="bb-mono-label !text-[rgba(244,236,216,0.62)]">
            AI deal brain
          </p>
          <p className="bb-display text-[1.85rem] font-medium leading-[1.18] text-white">
            One private workspace for every asset, buyer, and conversation —
            broker-controlled end to end.
          </p>
          <p className="max-w-md text-[14px] leading-7 text-[rgba(244,236,216,0.72)]">
            Voice-to-CRM, listing brains, buyer memory, matching, deal rooms,
            verification, and seller reports — all in one place.
          </p>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(244,236,216,0.45)]">
          7-day prototype · Seeded assets · Broker approval throughout
        </p>
      </aside>

      {/* Form panel. */}
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#FBFBFB] px-6 py-12 sm:px-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile-only logo — uses the same Fraunces wordmark, just dark. */}
          <Link
            className="mb-12 inline-flex items-baseline lg:hidden"
            href="/dashboard"
          >
            <span className="font-display text-[1.75rem] font-bold tracking-tight text-[#171719]">
              Brobroker.
            </span>
          </Link>

          <p className="bb-mono-label">{eyebrow}</p>
          <h1 className="bb-display mt-3 text-3xl font-medium leading-tight tracking-[-0.01em] text-[#171719]">
            {title}
          </h1>
          <p className="mt-3 text-[14px] leading-7 text-[#5F625E]">
            {description}
          </p>

          <div className="mt-10">{children}</div>

          <div className="mt-8 text-[13px] leading-6 text-[#5F625E]">
            {footer}
          </div>
        </div>
      </main>
    </div>
  );
}
