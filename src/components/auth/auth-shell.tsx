import Link from "next/link";
import type { ReactNode } from "react";
import { BriefcaseBusiness } from "lucide-react";

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
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      {/* Brand panel — deep green, mirrors the app sidebar. */}
      <aside className="relative hidden bg-[#003c33] text-[#f6f2ea] lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-14">
        <Link className="inline-flex items-center gap-2" href="/dashboard">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#003c33]"
          >
            <BriefcaseBusiness className="h-3.5 w-3.5" />
          </span>
          <span className="bb-display text-base font-medium tracking-[-0.01em] text-[#f6f2ea]">
            BroBroker
          </span>
        </Link>

        <div className="grid gap-6">
          <p
            className="bb-mono-label"
            style={{ color: "rgba(246, 242, 234, 0.62)" }}
          >
            AI deal brain
          </p>
          <p className="bb-display text-2xl font-medium leading-snug text-[#f6f2ea]">
            One private workspace for every asset, buyer, and conversation —
            broker-controlled end to end.
          </p>
          <p
            className="text-sm leading-7"
            style={{ color: "rgba(246, 242, 234, 0.72)" }}
          >
            Voice-to-CRM, listing brains, buyer memory, matching, deal rooms,
            verification, and seller reports — all in one place.
          </p>
        </div>

        <p
          className="text-[12px] uppercase tracking-[0.14em]"
          style={{ color: "rgba(246, 242, 234, 0.45)" }}
        >
          7-day prototype · Seeded assets · Broker approval throughout
        </p>
      </aside>

      {/* Form panel. */}
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[#f7f7f9] px-6 py-12 sm:px-12">
        <div className="w-full max-w-[420px]">
          <Link
            className="mb-12 inline-flex items-center gap-2 lg:hidden"
            href="/dashboard"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#003c33] text-white"
            >
              <BriefcaseBusiness className="h-3.5 w-3.5" />
            </span>
            <span className="bb-display text-base font-medium tracking-[-0.01em] text-[#17171c]">
              BroBroker
            </span>
          </Link>

          <p className="bb-mono-label">{eyebrow}</p>
          <h1 className="bb-display mt-3 text-3xl font-medium leading-tight tracking-[-0.01em] text-[#17171c]">
            {title}
          </h1>
          <p className="mt-3 text-[14px] leading-7 text-[#616161]">
            {description}
          </p>

          <div className="mt-10">{children}</div>

          <div className="mt-8 text-[13px] leading-6 text-[#616161]">
            {footer}
          </div>
        </div>
      </main>
    </div>
  );
}
