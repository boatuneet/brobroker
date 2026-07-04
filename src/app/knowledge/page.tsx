import { AppShell } from "@/components/app-shell";
import { ImportKnowledgeButton } from "@/components/knowledge/import-knowledge-button";
import { KnowledgeWorkspace } from "@/components/knowledge/knowledge-workspace";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { isDemoModeEnabled } from "@/lib/demo-mode-server";
import { getNotesForOwner, notesByPageId, notesToPages } from "@/lib/knowledge-notes";
import { buildKnowledgeVault, findKnowledgePage } from "@/lib/knowledge-vault";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

export const metadata = {
  title: "Knowledge Vault · BroBroker",
  description: "Inspect generated broker knowledge pages with source lineage and open gaps.",
};

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const segment = await getActiveBrokerSegment();
  const includeDemo = await isDemoModeEnabled();
  const [storedListings, storedBuyers, notes, params] = await Promise.all([
    getStoredListingsForSegment(segment),
    getStoredBuyersForSegment(segment),
    getNotesForOwner(),
    searchParams,
  ]);
  const model = buildKnowledgeVault(segment, {
    storedListings,
    storedBuyers,
    includeDemo,
  });
  const notesByPage = notesByPageId(notes);
  const notePages = notesToPages(notes, segment);

  // Deep-link support: ?page=<id|slug>. findKnowledgePage falls back to the
  // overview page if the id is unknown, so we only seed when it resolves to
  // a non-overview page.
  const requestedPageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const resolvedPage = requestedPageParam ? findKnowledgePage(model, requestedPageParam) : undefined;
  const initialPageId =
    resolvedPage && resolvedPage.id !== model.selectedPage.id ? resolvedPage.id : undefined;

  return (
    <AppShell active="Knowledge" pageActions={<ImportKnowledgeButton />} pageTitle="Knowledge">
      <KnowledgeWorkspace
        initialPageId={initialPageId}
        model={model}
        notePages={notePages}
        notesByPage={notesByPage}
      />
    </AppShell>
  );
}
