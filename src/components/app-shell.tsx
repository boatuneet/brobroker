import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  ChevronRight,
  FileText,
  LibraryBig,
  LayoutDashboard,
  ListChecks,
  Radio,
  ShieldCheck,
  UserCircle2,
  Users,
} from "lucide-react";
import { BrokerSegmentBridge } from "@/components/broker-segment-bridge";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getBrokerSegmentMeta } from "@/lib/broker-segments";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Fraunces } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-fraunces",
});

const navItems: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Knowledge", href: "/knowledge", icon: LibraryBig },
  { label: "Listings", href: "/listings", icon: BriefcaseBusiness },
  { label: "Buyers", href: "/buyers", icon: Users },
  { label: "Voice CRM", href: "/voice-crm", icon: Radio },
  { label: "Matching", href: "/matching", icon: Boxes },
  { label: "Verification", href: "/verification", icon: ShieldCheck },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Deal Rooms", href: "/deal-rooms", icon: FileText },
];

const logoSrc = "/bro-broker-logo.png?v=20260526";

export async function AppShell({
  children,
  active = "Dashboard",
}: {
  children: ReactNode;
  active?: string;
}) {
  let userEmail: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  }
  const userInitial = userEmail?.charAt(0).toUpperCase() ?? "?";
  const segment = await getActiveBrokerSegment();
  const segmentMeta = getBrokerSegmentMeta(segment);

  return (
    <div className="min-h-dvh bg-[#f7f7f9] text-[#17171c]">
      <BrokerSegmentBridge currentSegment={segment} />
      {/* Light sidebar with green reserved for active navigation and broker mode. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#e5e7eb] bg-white text-[#17171c] lg:block">
        <div className="flex h-full flex-col">
          <div className="px-6 pb-6 pt-7">
            <Link aria-label="BroBroker dashboard" className="inline-flex" href="/dashboard">
              <span className={cn(fraunces.className, "text-[2rem] font-bold tracking-tight text-[#17171c]")}>
                Brobroker.
              </span>
            </Link>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#003c33]">
              {segmentMeta.label} workspace
            </p>
          </div>

          <nav aria-label="Primary" className="flex-1 px-3">
            <ul className="grid gap-0.5">
              {navItems.map((item) => {
                const isActive = active === item.label;
                return (
                  <li key={item.label}>
                    <Link
                      className={cn(
                        "group flex min-h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003c33]",
                        isActive
                          ? "bg-[#003c33] text-white shadow-[0_10px_24px_rgba(0,60,51,0.14)]"
                          : "text-[#52525b] hover:bg-[#f7f7f9] hover:text-[#17171c]",
                      )}
                      href={item.href}
                    >
                      <item.icon
                        aria-hidden="true"
                        className={cn(
                          "h-4 w-4",
                          isActive ? "text-white" : "text-[#8a8a95] group-hover:text-[#52525b]",
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="shrink-0 px-4 pb-6 pt-4">
            <div className="relative overflow-hidden rounded-2xl bg-[#17171c] p-5 text-white shadow-[0_18px_45px_rgba(23,23,28,0.16)]">
              {/* Decorative background shapes */}
              <div className="absolute -right-4 -top-4 h-16 w-12 rotate-12 bg-[#003c33] opacity-80" />
              <div className="absolute -right-8 top-6 h-16 w-12 rotate-12 bg-[#003c33] opacity-80" />
              
              <div className="relative z-10">
                <h3 className="text-xl font-bold leading-tight tracking-tight">
                  Loving<br />
                  Brobroker<br />
                  Free?
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[rgba(255,255,255,0.85)]">
                  Go Pro to access priority support, real-time tracking, and full analytics.
                </p>
                <Link
                  href="/pricing"
                  className="mt-5 flex min-h-10 w-full items-center justify-center rounded-xl bg-white px-4 text-[14px] font-semibold text-[#17171c] transition-transform hover:scale-[1.02]"
                >
                  Go Pro Today
                </Link>
              </div>
            </div>

            {/* Profile tile stays visible even while Supabase is still being
                configured. Once signed in, it shows the broker email. */}
            <Link
              aria-label="Open your profile"
              className={cn(
                "group mt-3 flex items-center gap-3 rounded-2xl border p-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003c33]",
                active === "Profile"
                  ? "border-[#003c33] bg-[#003c33]"
                  : "border-[#e5e7eb] bg-white hover:bg-[#f7f7f9]",
              )}
              href="/profile"
              prefetch={false}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-medium",
                  active === "Profile" ? "bg-white text-[#003c33]" : "bg-[#f4f4f5] text-[#3f3f46]",
                )}
              >
                {userInitial}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="bb-mono-label"
                  style={{ color: active === "Profile" ? "rgba(246, 242, 234, 0.62)" : "#75758a" }}
                >
                  Profile
                </p>
                <p
                  className={cn(
                    "truncate text-[13px] font-medium",
                    active === "Profile" ? "text-white" : "text-[#17171c]",
                  )}
                  title={userEmail ?? "Account settings"}
                >
                  {userEmail ?? "Account settings"}
                </p>
              </div>
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 transition-transform group-hover:translate-x-0.5",
                  active === "Profile" ? "text-[rgba(255,255,255,0.55)] group-hover:text-white" : "text-[#a1a1aa] group-hover:text-[#52525b]",
                )}
              />
            </Link>
          </div>
        </div>
      </aside>

      {/* Compact mobile header, hairline rule, single-row icon nav. */}
      <header className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-[#f7f7f9]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link aria-label="BroBroker dashboard" className="inline-flex" href="/dashboard">
            <span className={cn(fraunces.className, "text-2xl font-bold tracking-tight text-[#17171c]")}>
              Brobroker.
            </span>
          </Link>
          {userEmail ? (
            <Link
              aria-label={`Open profile for ${userEmail}`}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium",
                active === "Profile"
                  ? "border-[#003c33] bg-[#003c33] text-white"
                  : "border-[#d9d9dd] bg-white text-[#3f3f46] hover:border-[#17171c]",
              )}
              href="/profile"
            >
              <UserCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
              Profile
            </Link>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#003c33]">
              {segmentMeta.label} workspace
            </p>
          )}
        </div>
        <nav aria-label="Mobile primary" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
                active === item.label
                  ? "border-[#003c33] bg-[#003c33] text-white"
                  : "border-[#d9d9dd] bg-white text-[#3f3f46]",
              )}
              href={item.href}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
