import { AppShell } from "@/components/app-shell";
import { VerificationWorkspace, type StoredInboxItem } from "@/components/verification-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { readSavedVerification } from "@/lib/buyer-verification";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import {
  getStoredBuyerSegment,
  mapStoredBuyerToProfile,
  type StoredBuyerRow,
} from "@/lib/stored-buyers";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Verification · BroBroker",
  description: "Review buyer access before sensitive sharing.",
};

/* Force dynamic so cookies + Supabase resolve at request time. Without this
   the page can 500 on Vercel when the runtime tries to statically pre-render. */
export const dynamic = "force-dynamic";

async function loadStoredInbox(segment: string | undefined): Promise<StoredInboxItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buyers")
    .select("*")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("verification: could not read Supabase buyers", error.message);
    return [];
  }

  const rows = ((data ?? []) as StoredBuyerRow[]).filter((row) =>
    segment ? getStoredBuyerSegment(row) === segment : true,
  );

  return rows.map<StoredInboxItem>((row) => {
    const buyer = mapStoredBuyerToProfile(row);
    const saved = readSavedVerification(row.payload);
    return {
      origin: "stored",
      id: `stored-${row.id}`,
      buyer,
      hasSavedDecision: Boolean(saved),
      saved,
      status: saved ? saved.status : "Not started",
      updatedAt: row.updated_at,
    };
  });
}

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ buyer?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawBuyer = Array.isArray(query.buyer) ? query.buyer[0] : query.buyer;
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const storedInbox = await loadStoredInbox(segment);

  return (
    <AppShell active="Verification" pageTitle="Verification">
      <VerificationWorkspace
        key={segment}
        includeDemo={includeDemo}
        initialSelectedId={rawBuyer}
        segment={segment}
        storedInbox={storedInbox}
      />
    </AppShell>
  );
}
