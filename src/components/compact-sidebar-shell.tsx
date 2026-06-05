"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ActivityLogIcon,
  ArchiveIcon,
  BackpackIcon,
  BarChartIcon,
  BadgeIcon,
  ChevronRightIcon,
  DashboardIcon,
  FileTextIcon,
  GroupIcon,
  MixIcon,
  PersonIcon,
  SpeakerLoudIcon,
  ViewVerticalIcon,
} from "@radix-ui/react-icons";
import { BrokerSegmentBridge } from "@/components/broker-segment-bridge";
import { GoProButton } from "@/components/go-pro-button";
import type { BrokerSegment } from "@/lib/broker-segments";
import { cn } from "@/lib/utils";

const fraunces = { className: "font-display" } as const;

const SIDEBAR_OPEN_KEY = "brobroker:sidebar:open";
const EXPANDED_WIDTH = 205;
const COLLAPSED_WIDTH = 60;

type SidebarIcon = typeof DashboardIcon;

const navItems: Array<{
  label: string;
  href: string;
  icon: SidebarIcon;
}> = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { label: "Knowledge", href: "/knowledge", icon: ArchiveIcon },
  { label: "Listings", href: "/listings", icon: BackpackIcon },
  { label: "Buyers", href: "/buyers", icon: GroupIcon },
  { label: "Pulse", href: "/pulse", icon: ActivityLogIcon },
  { label: "Voice CRM", href: "/voice-crm", icon: SpeakerLoudIcon },
  { label: "Matching", href: "/matching", icon: MixIcon },
  { label: "Verification", href: "/verification", icon: BadgeIcon },
  { label: "Reports", href: "/reports", icon: BarChartIcon },
  { label: "Deal Rooms", href: "/deal-rooms", icon: FileTextIcon },
];

export function CompactSidebarShell({
  active,
  breadcrumb,
  children,
  pageActions,
  pageTitle,
  segment,
  segmentLabel,
  userEmail,
  userInitial,
}: {
  active: string;
  /* Optional breadcrumb that renders inline with the sidebar toggle
     button at the top of the content area. Pages on deeper screens
     (buyer detail, listing intake, etc.) pass this. Leave undefined on
     top-level screens that pass pageTitle instead. */
  breadcrumb?: ReactNode;
  children: ReactNode;
  /* Right-aligned action cluster for the top bar (e.g. dashboard's
     Voice note / Add inquiry / New deal room). Pages compose these as
     a JSX fragment. */
  pageActions?: ReactNode;
  /* Top-level page title shown in the top bar when no breadcrumb is
     provided. Breadcrumb already shows the page title as its last
     crumb, so we don't render both. */
  pageTitle?: string;
  segment: BrokerSegment;
  segmentLabel: string;
  userEmail: string | null;
  userInitial: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      const storedOpen = window.localStorage.getItem(SIDEBAR_OPEN_KEY);

      if (storedOpen === "false") {
        setIsOpen(false);
      }
    });

    return () => window.cancelAnimationFrame(restoreFrame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_OPEN_KEY, String(isOpen));
  }, [isOpen]);

  const toggleSidebar = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const desktopSidebarWidth = isOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <div className="min-h-dvh bg-white text-[#171719]">
      <BrokerSegmentBridge currentSegment={segment} />

      <aside
        className="fixed inset-y-0 left-0 z-20 hidden border-r border-[#E7E7E7] bg-[#FBFBFB] text-[#171719] transition-[width] lg:flex"
        style={{ width: desktopSidebarWidth }}
      >
        <div className="relative flex h-full min-w-0 flex-1 flex-col">
          {/* Header block: logo + workspace badge.
              - pt-4 keeps a comfortable top inset.
              - pb-7 pushes the nav further down, giving the brand stamp room
                to breathe before the action list begins.
              - `-mt-3` on the badge pulls it tight against the wordmark
                baseline so the two read as one stamp. */}
          <div className={cn("px-3 pb-7 pt-4", !isOpen && "px-2")}>
            <div className={cn("flex min-h-10 items-start", isOpen ? "justify-between" : "justify-center")}>
              <Link
                aria-label="BroBroker dashboard"
                className={cn(
                  "inline-flex min-w-0 overflow-hidden",
                  isOpen ? "items-baseline" : "h-8 items-center justify-center text-[#171719]",
                  !isOpen && "justify-center",
                )}
                href="/dashboard"
                title="BroBroker dashboard"
              >
                <span
                  className={cn(
                    fraunces.className,
                    "font-bold tracking-tight",
                    isOpen ? "text-[1.65rem] text-[#171719]" : "text-[1rem] text-[#171719]",
                  )}
                >
                  {isOpen ? "Brobroker." : "BB"}
                </span>
              </Link>
            </div>
            {isOpen ? (
              <span className="-mt-3 inline-flex items-center rounded-[4px] bg-[#003C33] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white">
                {segmentLabel} workspace
              </span>
            ) : null}
          </div>

          <nav aria-label="Primary" className={cn("min-h-0 flex-1 overflow-y-auto px-2", !isOpen && "px-1.5")}>
            <ul className="grid gap-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.label;
                return (
                  <li key={item.label}>
                    <Link
                      aria-label={!isOpen ? item.label : undefined}
                      className={cn(
                        "group flex min-h-9 items-center rounded-[8px] text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
                        isOpen ? "gap-2.5 px-2.5" : "justify-center px-2",
                        isActive
                          ? "bg-[#003C33] text-white"
                          : "text-[#5F625E] hover:bg-[#F1F2EE] hover:text-[#003C33]",
                      )}
                      href={item.href}
                      title={!isOpen ? item.label : undefined}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cn(
                          "size-[15px] shrink-0",
                          isActive ? "text-white" : "text-[#8E918B] group-hover:text-[#003C33]",
                        )}
                      />
                      {isOpen ? <span className="min-w-0 truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={cn("shrink-0 px-2 pb-3 pt-2", !isOpen && "px-1.5")}>
            <GoProButton compact={!isOpen} />

            <Link
              aria-label="Open your profile"
              className={cn(
                "group flex min-h-9 items-center rounded-[8px] text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
                isOpen ? "gap-2.5 px-2.5" : "justify-center px-2",
                active === "Profile"
                  ? "bg-[#003C33] text-white"
                  : "text-[#5F625E] hover:bg-[#F1F2EE] hover:text-[#003C33]",
              )}
              href="/profile"
              prefetch={false}
              title={!isOpen ? userEmail ?? "Profile" : undefined}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  active === "Profile"
                    ? "bg-white/15 text-white"
                    : "bg-[#F1F2EE] text-[#5F625E] group-hover:bg-white group-hover:text-[#003C33]",
                )}
              >
                {userEmail ? userInitial : <PersonIcon className="size-[15px]" />}
              </span>
              {isOpen ? (
                <>
                  <span className="min-w-0 flex-1 truncate" title={userEmail ?? "Profile"}>
                    {userEmail ? userEmail.split("@")[0] : "Profile"}
                  </span>
                  <ChevronRightIcon
                    aria-hidden="true"
                    className={cn(
                      "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                      active === "Profile" ? "text-white/55 group-hover:text-white" : "text-[#A9ABA5] group-hover:text-[#003C33]",
                    )}
                  />
                </>
              ) : null}
            </Link>
          </div>
        </div>
      </aside>


      <header className="sticky top-0 z-10 border-b border-[#E7E7E7] bg-[#FBFBFB]/95 px-4 py-3 backdrop-blur lg:hidden">
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
                "inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border px-3 text-[12px] font-medium",
                active === "Profile"
                  ? "border-[#003C33] bg-[#003C33] text-white"
                  : "border-[#D9DAD4] bg-white text-[#5F625E] hover:border-[#003C33]",
              )}
              href="/profile"
            >
              <PersonIcon aria-hidden="true" className="size-[15px]" />
              Profile
            </Link>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#003C33]">
              {segmentLabel} workspace
            </p>
          )}
        </div>
        <nav aria-label="Mobile primary" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium",
                  active === item.label
                    ? "border-[#003C33] bg-[#003C33] text-white"
                    : "border-[#D9DAD4] bg-white text-[#5F625E]",
                )}
                href={item.href}
              >
                <Icon className="size-[15px]" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main
        className="min-w-0 lg:pl-[var(--sidebar-current-width)] lg:transition-[padding-left]"
        style={{ "--sidebar-current-width": `${desktopSidebarWidth}px` } as CSSProperties}
      >
        {/* Desktop top bar — toggle + breadcrumb-or-title on the left,
            optional action cluster pinned right. Sticky so it stays in
            view while the broker scrolls. Background + bottom border
            match the sidebar's chrome so the two read as one unified
            panel ringing the content area. */}
        <div className="sticky top-0 z-20 hidden min-h-14 items-center gap-3 border-b border-[#E7E7E7] bg-[#FBFBFB] px-4 py-2.5 lg:flex">
          <button
            aria-label="Toggle sidebar"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-[#E7E7E7] bg-white text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] hover:text-[#003C33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
            onClick={toggleSidebar}
            title="Toggle Sidebar ⌘+b"
            type="button"
          >
            <ViewVerticalIcon aria-hidden="true" className="size-[15px]" />
          </button>
          <div className="min-w-0 flex-1">
            {breadcrumb ? (
              breadcrumb
            ) : pageTitle ? (
              <h1 className="truncate text-[18px] font-semibold leading-none text-[#171719]">
                {pageTitle}
              </h1>
            ) : null}
          </div>
          {pageActions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {pageActions}
            </div>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  );
}
