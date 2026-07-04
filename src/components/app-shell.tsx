import type { ReactNode } from "react";
import { CompactSidebarShell } from "@/components/compact-sidebar-shell";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getBrokerSegmentMeta } from "@/lib/broker-segments";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function AppShell({
  active = "Today",
  breadcrumb,
  children,
  pageActions,
  pageTitle,
}: {
  active?: string;
  /* Optional breadcrumb that renders inline with the sidebar toggle on
     deeper screens. Pages compose it from breadcrumb primitives and
     pass it here. */
  breadcrumb?: ReactNode;
  children: ReactNode;
  /* Optional top-bar action cluster, right-aligned. */
  pageActions?: ReactNode;
  /* Optional top-bar title — shown only on screens that don't pass a
     breadcrumb (top-level screens like Dashboard). */
  pageTitle?: string;
}) {
  let userEmail: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    // getClaims() verifies the JWT locally (no Supabase Auth round-trip),
    // unlike getUser() which adds a network hop to every navigation. The
    // email rides along in the verified claims, so we read it straight from
    // there to keep the shell render off the network on each page load.
    const { data } = await supabase.auth.getClaims();
    const email = data?.claims?.email;
    userEmail = typeof email === "string" ? email : null;
  }
  const userInitial = userEmail?.charAt(0).toUpperCase() ?? "?";
  const segment = await getActiveBrokerSegment();
  const segmentMeta = getBrokerSegmentMeta(segment);

  return (
    <CompactSidebarShell
      active={active}
      breadcrumb={breadcrumb}
      pageActions={pageActions}
      pageTitle={pageTitle}
      segment={segment}
      segmentLabel={segmentMeta.label}
      userEmail={userEmail}
      userInitial={userInitial}
    >
      {children}
    </CompactSidebarShell>
  );
}
