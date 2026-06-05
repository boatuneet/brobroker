import type { ReactNode } from "react";
import { CompactSidebarShell } from "@/components/compact-sidebar-shell";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { getBrokerSegmentMeta } from "@/lib/broker-segments";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function AppShell({
  active = "Dashboard",
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
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
