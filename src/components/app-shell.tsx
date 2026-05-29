import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
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
import { GoProButton } from "@/components/go-pro-button";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getBrokerSegmentMeta } from "@/lib/broker-segments";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/* Fraunces is loaded once at the root layout and exposed as
   var(--font-fraunces). Reference the variable directly so we don't
   double-load the font. */
const fraunces = { className: "font-display" } as const;

const navItems: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
}> = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Knowledge", href: "/knowledge", icon: LibraryBig },
  { label: "Listings", href: "/listings", icon: BriefcaseBusiness },
  { label: "Buyers", href: "/buyers", icon: Users },
  { label: "Pulse", href: "/pulse", icon: Activity },
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
    <div className="min-h-dvh bg-[#F6F6F3] text-[#171719]">
      <BrokerSegmentBridge currentSegment={segment} />
      {/* Light sidebar with green reserved for active navigation and broker mode. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-[#E7E7E2] bg-white text-[#171719] lg:block">
        <div className="flex h-full flex-col">
          <div className="px-6 pb-6 pt-7">
            <Link aria-label="BroBroker dashboard" className="inline-flex" href="/dashboard">
              <span className={cn(fraunces.className, "text-[1.85rem] font-bold tracking-tight text-[#171719]")}>
                Brobroker.
              </span>
            </Link>
            <span className="mt-1 inline-flex items-center bg-[#003C33] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
              {segmentMeta.label} workspace
            </span>
          </div>

          <nav aria-label="Primary" className="flex-1 px-3">
            <ul className="grid gap-0.5">
              {navItems.map((item) => {
                const isActive = active === item.label;
                return (
                  <li key={item.label}>
                    <Link
                      className={cn(
                        "group flex min-h-11 items-center gap-3 rounded-[10px] px-4 text-[14px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
                        isActive
                          ? "bg-[#003C33] text-white shadow-[0_10px_24px_rgba(0,60,51,0.14)]"
                          : "text-[#5F625E] hover:bg-[#E7EFEA] hover:text-[#003C33]",
                      )}
                      href={item.href}
                    >
                      <item.icon
                        aria-hidden="true"
                        className={cn(
                          "h-[18px] w-[18px]",
                          isActive ? "text-white" : "text-[#8E918B] group-hover:text-[#003C33]",
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="shrink-0 px-3 pb-5 pt-2">
            {/* Compact promo strip — slim enough to leave room for the
                Profile entry below. Pro tier isn't shipped yet so this is a
                client-side toast trigger, not a 404 link. */}
            <GoProButton />

            {/* Profile entry — styled to match the nav-item shape (44px pill,
                brand-pale hover) so it feels like a continuation of the
                navigation rather than a separate card. */}
            <Link
              aria-label="Open your profile"
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
                active === "Profile"
                  ? "bg-[#003C33] text-white shadow-[0_10px_24px_rgba(0,60,51,0.14)]"
                  : "text-[#5F625E] hover:bg-[#E7EFEA] hover:text-[#003C33]",
              )}
              href="/profile"
              prefetch={false}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                  active === "Profile"
                    ? "bg-white/15 text-white"
                    : "bg-[#F1F2EE] text-[#5F625E] group-hover:bg-white group-hover:text-[#003C33]",
                )}
              >
                {userInitial}
              </span>
              <span className="min-w-0 flex-1 truncate" title={userEmail ?? "Profile"}>
                {userEmail ? userEmail.split("@")[0] : "Profile"}
              </span>
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 transition-transform group-hover:translate-x-0.5",
                  active === "Profile" ? "text-white/55 group-hover:text-white" : "text-[#A9ABA5] group-hover:text-[#003C33]",
                )}
              />
            </Link>
          </div>
        </div>
      </aside>

      {/* Compact mobile header, hairline rule, single-row icon nav. */}
      <header className="sticky top-0 z-10 border-b border-[#E7E7E2] bg-[#F6F6F3]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link aria-label="BroBroker dashboard" className="inline-flex" href="/dashboard">
            <span className={cn(fraunces.className, "text-2xl font-bold tracking-tight text-[#171719]")}>
              Brobroker.
            </span>
          </Link>
          {userEmail ? (
            <Link
              aria-label={`Open profile for ${userEmail}`}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium",
                active === "Profile"
                  ? "border-[#003C33] bg-[#003C33] text-white"
                  : "border-[#D9DAD4] bg-white text-[#5F625E] hover:border-[#003C33]",
              )}
              href="/profile"
            >
              <UserCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
              Profile
            </Link>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#003C33]">
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
                  ? "border-[#003C33] bg-[#003C33] text-white"
                  : "border-[#D9DAD4] bg-white text-[#5F625E]",
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
