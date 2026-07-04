import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, ChevronRight } from "lucide-react";
import type {
  KnowledgePage,
  KnowledgeVaultModel,
} from "@/lib/knowledge-vault";
import { formatDate } from "@/lib/utils";
import { Badge, Card, CardHeader } from "../ui";

/* Reusable, server-rendered "Knowledge" card that surfaces the slice of the
   knowledge vault relevant to one entity (listing or buyer). Renders nothing
   when there are no open gaps AND no vault pages for the entity, so it can
   be dropped into a listing/buyer page without a stale shell. */

export type ContextualEntityType = "listing" | "buyer";

export interface ContextualKnowledgeCardProps {
  entityType: ContextualEntityType;
  entityId: string;
  model: KnowledgeVaultModel;
  /* Optional overrides: e.g. listing owner id for buyer-facts fix-link. */
  ownerId?: string;
  className?: string;
}

/* Heuristic map from a gap string to a place where the broker could go fix
   it. Kept intentionally simple — the vault gap strings are hand-authored,
   so a substring test is enough to catch the common cases. Returning null
   leaves the row un-linked, which is fine. */
function fixLinkFor(
  gap: string,
  entityType: ContextualEntityType,
  entityId: string,
  ownerId?: string,
): { href: string; label: string } | null {
  const lower = gap.toLowerCase();

  if (entityType === "listing") {
    if (
      lower.includes("document") ||
      lower.includes("survey") ||
      lower.includes("certificate") ||
      lower.includes("registration") ||
      lower.includes("title") ||
      lower.includes("mot") ||
      lower.includes("epc") ||
      lower.includes("vat")
    ) {
      return { href: `/listings/${entityId}?tab=docs`, label: "Open docs" };
    }
    if (lower.includes("owner") || lower.includes("seller") || lower.includes("motivation")) {
      const href = ownerId ? `/sellers/${ownerId}` : `/listings/${entityId}?tab=owner`;
      return { href, label: "Open owner" };
    }
    return { href: `/listings/${entityId}/edit`, label: "Edit listing" };
  }

  // buyer
  if (lower.includes("verification")) {
    return { href: `/verification`, label: "Open verification" };
  }
  return { href: `/buyers/${entityId}/edit`, label: "Edit buyer" };
}

/* A vault page is relevant to an entity if any of its sources reference that
   entity by (type, id). This matches how knowledge-vault.ts wires cross-
   references — e.g. a deal-room page sources the listing, an owner page
   sources every listing it holds, and the entity's own page always sources
   itself. */
function pagesForEntity(
  model: KnowledgeVaultModel,
  entityType: ContextualEntityType,
  entityId: string,
): KnowledgePage[] {
  const matches = model.pages.filter((page) =>
    page.sources.some((src) => src.type === entityType && src.id === entityId),
  );

  // Rank: the entity's own page first (id starts with "<type>-<id>"), then
  // deal-room pages (most useful cross-context), then everything else by
  // recency. Cap at 3 — this is a contextual peek, not the vault index.
  const own = matches.filter((page) => page.id === `${entityType}-${entityId}`);
  const rooms = matches.filter((page) => page.category === "Deal Room");
  const rest = matches
    .filter((page) => !own.includes(page) && !rooms.includes(page))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

  return [...own, ...rooms, ...rest].slice(0, 3);
}

export function ContextualKnowledgeCard({
  entityType,
  entityId,
  model,
  ownerId,
  className,
}: ContextualKnowledgeCardProps) {
  const ownPage = model.pages.find((page) => page.id === `${entityType}-${entityId}`);
  const gaps = ownPage?.openGaps ?? [];
  const relatedPages = pagesForEntity(model, entityType, entityId);

  if (gaps.length === 0 && relatedPages.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader
        eyebrow="Knowledge"
        title="What the vault knows about this"
        description="Open gaps and compiled pages assembled from source records."
      />

      {gaps.length ? (
        <section className="border-b border-[#E7E7E7] px-6 py-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-[#A86642]" aria-hidden="true" />
            <p className="bb-mono-label">Open gaps</p>
            <Badge tone="warning">{gaps.length}</Badge>
          </div>
          <ul className="mt-3 grid gap-2">
            {gaps.map((gap, index) => {
              const fix = fixLinkFor(gap, entityType, entityId, ownerId);
              return (
                <li
                  className="flex items-start gap-3 rounded-[12px] bg-[#F0DDD0] px-3 py-2.5 text-[13px] leading-6 text-[#5F625E]"
                  key={`${gap}-${index}`}
                >
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A86642]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">{gap}</span>
                  {fix ? (
                    <Link
                      className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#003C33] hover:underline"
                      href={fix.href}
                    >
                      {fix.label}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {relatedPages.length ? (
        <section className="px-6 py-5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-[#003C33]" aria-hidden="true" />
            <p className="bb-mono-label">From the knowledge vault</p>
          </div>
          <ul className="mt-3 grid gap-2">
            {relatedPages.map((page) => (
              <li key={page.id}>
                <Link
                  className="group flex items-center gap-3 rounded-[12px] border border-[#E7E7E7] bg-white px-4 py-3 hover:border-[#003C33] hover:bg-[#F1F2EE]"
                  href={`/knowledge?page=${encodeURIComponent(page.id)}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[#171719]">{page.title}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#8E918B]">
                      {page.category} · Updated {formatDate(page.updatedAt)}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-[#8E918B] group-hover:text-[#003C33]"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Card>
  );
}
