"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenText,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Database,
  FileSearch,
  FileText,
  Network,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { getBrokerSegmentMeta } from "@/lib/broker-segments";
import type {
  KnowledgeHealthCheck,
  KnowledgePage,
  KnowledgePageCategory,
  KnowledgeSource,
  KnowledgeVaultModel,
} from "@/lib/knowledge-vault";
import { formatDate, cn } from "@/lib/utils";
import { Badge, Button } from "./ui";
import {
  BubbleCluster,
  FitRing,
  Sparkbars,
  StatBadge,
  Tile,
} from "./dashboard/visuals";

/* ============================================================
   Knowledge Vault — editorial cockpit redesign.
   Layout reads top-to-bottom:
     1. Anchor tile: most actionable single thing (top open gap
        or lowest-confidence page) on ink-green ground.
     2. KPI band: confidence distribution + category composition
        + freshness + health signal strip.
     3. Workspace: sticky page browser + knowledge-brief detail.
   ============================================================ */

const CATEGORY_ICONS = {
  Overview: BookOpenText,
  Listing: BriefcaseBusiness,
  Buyer: Users,
  Owner: ShieldCheck,
  "Deal Room": FileText,
  "Market Note": Network,
  "Open Gaps": AlertTriangle,
  "Source Log": Database,
} satisfies Record<KnowledgePageCategory, typeof BookOpenText>;

const CATEGORY_TONE = {
  Overview: "ink",
  Listing: "info",
  Buyer: "success",
  Owner: "warning",
  "Deal Room": "neutral",
  "Market Note": "coral",
  "Open Gaps": "warning",
  "Source Log": "neutral",
} satisfies Record<KnowledgePageCategory, "neutral" | "success" | "warning" | "error" | "info" | "coral" | "ink">;

const HEALTH_ICON = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: CircleAlert,
  info: FileSearch,
} satisfies Record<KnowledgeHealthCheck["tone"], typeof CheckCircle2>;

const HEALTH_TEXT_TONE = {
  success: "text-[#0F8F62]",
  warning: "text-[#A86642]",
  error: "text-[#A86642]",
  info: "text-[#1448a8]",
} satisfies Record<KnowledgeHealthCheck["tone"], string>;

const HEALTH_DOT_TONE = {
  success: "bg-[#0F8F62]",
  warning: "bg-[#A86642]",
  error: "bg-[#A86642]",
  info: "bg-[#1863dc]",
} satisfies Record<KnowledgeHealthCheck["tone"], string>;

function confidenceTone(value: number): "green" | "ink" | "coral" {
  if (value >= 86) return "green";
  if (value >= 72) return "ink";
  return "coral";
}

function confidenceLabel(value: number) {
  if (value >= 86) return "High";
  if (value >= 72) return "Medium";
  return "Low";
}

function includesQuery(page: KnowledgePage, query: string) {
  const haystack = [
    page.title,
    page.category,
    page.summary,
    page.tags.join(" "),
    page.openGaps.join(" "),
    page.sections
      .map((section) => [section.title, section.body, section.bullets?.join(" ")].join(" "))
      .join(" "),
    page.sources.map((src) => [src.label, src.excerpt].join(" ")).join(" "),
    page.related.map((rel) => [rel.label, rel.note].join(" ")).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  return terms.every((term) => haystack.includes(term));
}

function sourceKey(src: KnowledgeSource) {
  return `${src.type}:${src.id}`;
}

/* ------------------------------------------------------------
   Anchor tile — surfaces the single most-actionable thing in
   the vault. Picks the lowest-confidence page; if everything is
   strong, surfaces the page with the most open gaps.
   ------------------------------------------------------------ */
function pickAnchorPage(pages: KnowledgePage[]) {
  const candidates = pages.filter((p) => p.category !== "Overview");
  if (!candidates.length) return pages[0];
  // Score: low confidence + many gaps wins.
  const scored = candidates
    .map((p) => ({
      page: p,
      score: (100 - p.confidence) * 1.5 + p.openGaps.length * 8,
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0].page;
}

function AnchorTile({
  segmentTitle,
  anchorPage,
  totalGaps,
  generatedAt,
  onJumpTo,
}: {
  segmentTitle: string;
  anchorPage: KnowledgePage;
  totalGaps: number;
  generatedAt: string;
  onJumpTo: () => void;
}) {
  return (
    <article className="relative overflow-hidden rounded-[28px] bg-[#003C33] px-7 py-8 text-[#F2EADC] shadow-[0_30px_80px_-30px_rgba(0,60,51,0.5)] sm:px-10 sm:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(244,234,213,0.45), transparent 50%), radial-gradient(circle at 85% 70%, rgba(159,79,46,0.4), transparent 55%)",
        }}
      />
      <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-[#F2EADC]/85">
            <span className="h-1.5 w-1.5 rounded-full bg-[#A86642]" aria-hidden="true" />
            {segmentTitle} knowledge vault
          </p>
          <h1 className="bb-display mt-5 max-w-[680px] text-[2rem] font-medium leading-[1.06] text-[#F2EADC] sm:text-[2.4rem]">
            What this vault knows — and where it&apos;s thin.
          </h1>
          <p className="mt-4 max-w-[640px] text-[14.5px] leading-[1.65] text-[#F2EADC]/80">
            Generated workspace pages compile operational records into
            source-linked broker memory. The weakest page right now is{" "}
            <span className="font-medium text-[#F2EADC]">{anchorPage.title}</span>{" "}
            — {confidenceLabel(anchorPage.confidence).toLowerCase()} confidence
            ({anchorPage.confidence}%) with {anchorPage.openGaps.length} open{" "}
            {anchorPage.openGaps.length === 1 ? "gap" : "gaps"}. Fix that first.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <StatBadge label="Pages" value={`${anchorPage.category}`} tone="outline" />
            <StatBadge
              label="Confidence"
              value={`${anchorPage.confidence}%`}
              tone="outline"
            />
            <StatBadge label="Total gaps" value={`${totalGaps}`} tone="outline" />
            <StatBadge
              label="Generated"
              value={formatDate(generatedAt)}
              tone="outline"
            />
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#F2EADC] px-5 text-[13.5px] font-medium text-[#003C33] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A86642]"
              onClick={onJumpTo}
              type="button"
            >
              Jump to {anchorPage.title}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 px-5 text-[13.5px] font-medium text-[#F2EADC]/90 transition-colors hover:border-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A86642]"
              href="/dashboard"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-center lg:justify-end">
          <div className="rounded-[24px] border border-white/15 bg-white/[0.04] px-7 py-6 text-center backdrop-blur-sm">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.18em] text-[#F2EADC]/70">
              Anchor page
            </p>
            <div className="mt-4 flex items-center justify-center">
              <FitRing
                value={anchorPage.confidence}
                size={104}
                stroke={8}
                tone="ivory"
                label={`${anchorPage.confidence}%`}
              />
            </div>
            <p className="mt-4 text-[13px] font-medium text-[#F2EADC]">
              {anchorPage.title}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#F2EADC]/65">
              {confidenceLabel(anchorPage.confidence)} confidence
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------
   KPI band — three Tiles + a thin signal strip.
   ------------------------------------------------------------ */
function KpiBand({
  pages,
  categories,
  healthChecks,
}: {
  pages: KnowledgePage[];
  categories: Array<{ label: KnowledgePageCategory; count: number }>;
  healthChecks: KnowledgeHealthCheck[];
}) {
  const low = pages.filter((p) => p.confidence < 72).length;
  const med = pages.filter((p) => p.confidence >= 72 && p.confidence < 86).length;
  const high = pages.filter((p) => p.confidence >= 86).length;
  const avg = Math.round(
    pages.reduce((acc, p) => acc + p.confidence, 0) / Math.max(pages.length, 1),
  );

  // Choose top-3 categories by count for the BubbleCluster (it expects ~3 slots).
  const topCategories = [...categories]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Tile 1 — confidence distribution */}
      <Tile className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="bb-mono-label">Confidence spread</p>
            <p className="bb-display mt-2 text-[26px] font-medium leading-tight text-[#171719]">
              {high} strong · {med} mid · {low} thin
            </p>
          </div>
          <FitRing
            value={avg}
            size={64}
            stroke={6}
            tone={low > 0 ? "coral" : "green"}
            label={`${avg}%`}
          />
        </div>
        <Sparkbars
          data={[
            { label: "Low", value: low },
            { label: "Med", value: med },
            { label: "High", value: high },
          ]}
          highlightIndex={low > 0 ? 0 : 2}
          height={64}
        />
        <p className="text-[12px] leading-[1.6] text-[#5F625E]">
          Avg confidence {avg}% across {pages.length} compiled pages. Low-band
          pages need stronger source coverage before external use.
        </p>
      </Tile>

      {/* Tile 2 — category composition */}
      <Tile className="flex flex-col gap-5">
        <div>
          <p className="bb-mono-label">Composition</p>
          <p className="bb-display mt-2 text-[26px] font-medium leading-tight text-[#171719]">
            What the vault is mostly about
          </p>
        </div>
        {topCategories.length ? (
          <BubbleCluster
            items={topCategories.map((cat, i) => ({
              label: cat.label,
              value: cat.count,
              tone: i === 0 ? "green" : i === 1 ? "ink" : "coral",
            }))}
          />
        ) : null}
        <p className="text-[12px] leading-[1.6] text-[#5F625E]">
          {categories.length} record type{categories.length === 1 ? "" : "s"}{" "}
          represented across the vault. Bigger circle = more compiled pages.
        </p>
      </Tile>

      {/* Tile 3 — vault freshness + signal strip */}
      <Tile tone="cream" className="flex flex-col gap-5">
        <div>
          <p className="bb-mono-label">Vault signals</p>
          <p className="bb-display mt-2 text-[26px] font-medium leading-tight text-[#171719]">
            Health at a glance
          </p>
        </div>
        <ul className="divide-y divide-[#171719]/10">
          {healthChecks.map((check) => {
            const Icon = HEALTH_ICON[check.tone];
            return (
              <li
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                key={check.id}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                      HEALTH_DOT_TONE[check.tone],
                    )}
                  />
                  <span className="truncate text-[12.5px] font-medium text-[#171719]">
                    {check.label}
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold tabular-nums",
                    HEALTH_TEXT_TONE[check.tone],
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {check.count}
                </span>
              </li>
            );
          })}
        </ul>
      </Tile>
    </div>
  );
}

/* ------------------------------------------------------------
   Page browser — sticky rail with real search + chip filters.
   ------------------------------------------------------------ */
function PageBrowserRow({
  active,
  page,
  onSelect,
}: {
  active: boolean;
  page: KnowledgePage;
  onSelect: () => void;
}) {
  const Icon = CATEGORY_ICONS[page.category];
  return (
    <button
      aria-current={active ? "true" : undefined}
      className={cn(
        "relative grid w-full gap-2 border-b border-[#E7E7E2] px-4 py-3.5 text-left transition-colors last:border-b-0",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1863dc]",
        active
          ? "bg-[#003C33]/[0.04] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:bg-[#003C33]"
          : "bg-white hover:bg-[#F1F2EE]",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4fbf5] text-[#003C33]">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium text-[#171719]">{page.title}</p>
            <p className="bb-mono-label mt-0.5">{page.category}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 font-mono text-[11.5px] font-semibold tabular-nums",
            page.confidence >= 86
              ? "text-[#0F8F62]"
              : page.confidence >= 72
                ? "text-[#171719]"
                : "text-[#c64a31]",
          )}
        >
          {page.confidence}%
        </span>
      </div>
      {page.openGaps.length ? (
        <p className="ml-[42px] inline-flex items-center gap-1.5 text-[11px] font-medium text-[#A86642]">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          {page.openGaps.length} open {page.openGaps.length === 1 ? "gap" : "gaps"}
        </p>
      ) : null}
    </button>
  );
}

function PageBrowser({
  pages,
  filteredPages,
  selectedPageId,
  query,
  category,
  categories,
  dynamicCategoryCounts,
  dynamicTotalCount,
  onQueryChange,
  onCategoryChange,
  onSelect,
  onClearFilters,
}: {
  pages: KnowledgePage[];
  filteredPages: KnowledgePage[];
  selectedPageId: string;
  query: string;
  category: KnowledgePageCategory | "All";
  categories: Array<{ label: KnowledgePageCategory; count: number }>;
  dynamicCategoryCounts: Map<KnowledgePageCategory, number>;
  dynamicTotalCount: number;
  onQueryChange: (next: string) => void;
  onCategoryChange: (next: KnowledgePageCategory | "All") => void;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}) {
  const hasFilters = query.trim() !== "" || category !== "All";
  const searching = query.trim() !== "";
  return (
    <aside className="2xl:sticky 2xl:top-8">
      <Tile className="flex h-[720px] max-h-[calc(100dvh-7rem)] min-h-[480px] flex-col gap-0 p-0">
        <div className="border-b border-[#E7E7E2] px-4 pb-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="bb-mono-label">Pages</p>
            <span className="font-mono text-[11.5px] font-semibold tabular-nums text-[#5F625E]">
              {filteredPages.length}/{pages.length}
            </span>
          </div>
          <label className="relative mt-3 block">
            <span className="sr-only">Search knowledge vault</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E918B]"
            />
            <input
              autoComplete="off"
              className="h-11 w-full rounded-full border border-[#D9DAD4] bg-white pl-10 pr-9 text-[13.5px] text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#1863dc] focus:ring-2 focus:ring-[#1863dc]/15"
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search title, gap, source, tag…"
              type="search"
              value={query}
            />
            {query ? (
              <button
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#8E918B] transition-colors hover:bg-[#F2EADC]/40 hover:text-[#171719] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1863dc]"
                onClick={() => onQueryChange("")}
                type="button"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(() => {
              const allCount = searching ? dynamicTotalCount : pages.length;
              return (
                <button
                  aria-pressed={category === "All"}
                  className={cn(
                    "min-h-7 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1863dc]",
                    category === "All"
                      ? "border-[#171719] bg-[#171719] text-white"
                      : "border-[#E7E7E2] bg-white text-[#5F625E] hover:border-[#003C33]",
                  )}
                  onClick={() => onCategoryChange("All")}
                  type="button"
                >
                  All · {allCount}
                </button>
              );
            })()}
            {categories.map((cat) => {
              const count = searching
                ? (dynamicCategoryCounts.get(cat.label) ?? 0)
                : cat.count;
              const isActive = category === cat.label;
              const isEmpty = count === 0 && !isActive;
              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    "min-h-7 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1863dc]",
                    isActive
                      ? "border-[#171719] bg-[#171719] text-white"
                      : isEmpty
                        ? "cursor-not-allowed border-[#E7E7E2] bg-white text-[#A9ABA5] opacity-50"
                        : "border-[#E7E7E2] bg-white text-[#5F625E] hover:border-[#003C33]",
                  )}
                  disabled={isEmpty}
                  key={cat.label}
                  onClick={() => onCategoryChange(cat.label)}
                  type="button"
                >
                  {cat.label} · {count}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredPages.length ? (
            filteredPages.map((page) => (
              <PageBrowserRow
                active={page.id === selectedPageId}
                key={page.id}
                onSelect={() => onSelect(page.id)}
                page={page}
              />
            ))
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
              <p className="bb-display text-[15px] font-medium text-[#171719]">
                Nothing matches that filter.
              </p>
              <p className="mt-2 max-w-[18rem] text-[12.5px] leading-6 text-[#8E918B]">
                Try a different keyword or category. Clearing the filter brings
                back all {pages.length} pages.
              </p>
              {hasFilters ? (
                <Button
                  className="mt-4"
                  onClick={onClearFilters}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Clear filter
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </Tile>
    </aside>
  );
}

/* ------------------------------------------------------------
   Page brief detail — reads top-to-bottom like a knowledge brief.
     Hero (title + category + visibility + FitRing)
     Open gaps strip (only when present)
     2-col body: sections (wide) + meta (sources/related)
   ------------------------------------------------------------ */
function PageBrief({ page }: { page: KnowledgePage }) {
  const Icon = CATEGORY_ICONS[page.category];
  return (
    <div className="grid gap-5">
      {/* Hero */}
      <Tile className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4fbf5] text-[#003C33]">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <Badge tone={CATEGORY_TONE[page.category]}>{page.category}</Badge>
            <Badge tone="neutral">{page.visibility}</Badge>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8E918B]">
              Updated {formatDate(page.updatedAt)}
            </span>
          </div>
          <h2 className="bb-display mt-4 text-[1.75rem] font-medium leading-[1.1] text-[#171719] sm:text-[2rem]">
            {page.title}
          </h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-[1.7] text-[#5F625E]">
            {page.summary}
          </p>
          {page.tags.length ? (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {page.tags.slice(0, 8).map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2 rounded-[20px] border border-[#E7E7E2] bg-[#F1F2EE] px-6 py-5 sm:min-w-[180px]">
          <p className="bb-mono-label">Confidence</p>
          <FitRing
            value={page.confidence}
            size={88}
            stroke={7}
            tone={confidenceTone(page.confidence)}
            label={`${page.confidence}%`}
          />
          <p
            className={cn(
              "text-[11px] font-medium uppercase tracking-[0.14em]",
              page.confidence >= 86
                ? "text-[#0F8F62]"
                : page.confidence >= 72
                  ? "text-[#171719]"
                  : "text-[#c64a31]",
            )}
          >
            {confidenceLabel(page.confidence)}
          </p>
        </div>
      </Tile>

      {/* Open gaps signal strip */}
      {page.openGaps.length ? (
        <Tile className="border-[#F0DDD0]/70 bg-[#F0DDD0]/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-[#A86642]">
              <AlertTriangle className="h-4 w-4 text-[#A86642]" aria-hidden="true" />
              <p className="text-[13px] font-semibold">
                {page.openGaps.length} open{" "}
                {page.openGaps.length === 1 ? "gap" : "gaps"} to close
              </p>
            </div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#A86642]/70">
              Resolve before confident external use
            </p>
          </div>
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {page.openGaps.map((gap, index) => (
              <li
                className="flex gap-2.5 text-[12.5px] leading-[1.6] text-[#A86642]/85"
                key={`${gap}-${index}`}
              >
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A86642]"
                />
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </Tile>
      ) : null}

      {/* Body: sections + meta column */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5">
          {page.sections.map((section) => (
            <Tile className="flex flex-col gap-4" key={section.title}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="bb-mono-label">{section.title}</p>
              </div>
              {section.body ? (
                <p className="text-[14px] leading-[1.75] text-[#5F625E]">
                  {section.body}
                </p>
              ) : null}
              {section.stats?.length ? (
                <dl
                  className={cn(
                    "grid gap-3",
                    section.stats.length === 1
                      ? "grid-cols-1"
                      : section.stats.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-2 sm:grid-cols-4",
                  )}
                >
                  {section.stats.map((stat) => (
                    <div
                      className="rounded-[14px] border border-[#E7E7E2] bg-[#F1F2EE] px-3.5 py-3"
                      key={`${section.title}-${stat.label}`}
                    >
                      <dt className="bb-mono-label">{stat.label}</dt>
                      <dd className="mt-1.5 text-[18px] font-semibold leading-tight text-[#171719]">
                        {stat.value}
                      </dd>
                      {stat.detail ? (
                        <p className="mt-1 text-[11.5px] leading-[1.5] text-[#8E918B]">
                          {stat.detail}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </dl>
              ) : null}
              {section.bullets?.length ? (
                <ul className="grid gap-2.5">
                  {section.bullets.map((bullet, i) => (
                    <li
                      className="flex gap-2.5 text-[13px] leading-[1.65] text-[#5F625E]"
                      key={`${section.title}-${i}-${bullet.slice(0, 24)}`}
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#003C33]"
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Tile>
          ))}
        </div>

        {/* Meta column — compact, divided lists. No nested borders.
            Single-line truncation with native title for overflow. */}
        <div className="grid gap-5">
          <Tile className="flex flex-col gap-0 !p-0">
            <div className="flex items-baseline justify-between gap-3 px-4 pb-3 pt-4">
              <p className="bb-mono-label">Sources</p>
              <span className="font-mono text-[11.5px] font-semibold tabular-nums text-[#5F625E]">
                {page.sources.length}
              </span>
            </div>
            {page.sources.length ? (
              <ul className="divide-y divide-[#E7E7E2]">
                {page.sources.slice(0, 14).map((src) => {
                  const titleAttr = `${src.label} · ${src.type.replace("-", " ")}`;
                  const row = (
                    <span className="flex items-center gap-2.5">
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-[12.5px] font-medium leading-[1.35] text-[#171719]"
                          title={src.label}
                        >
                          {src.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
                          {src.type.replace("-", " ")}
                        </span>
                      </span>
                      {src.href ? (
                        <ArrowUpRight
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 text-[#A9ABA5] transition-colors group-hover:text-[#003C33]"
                        />
                      ) : null}
                    </span>
                  );
                  return (
                    <li key={sourceKey(src)}>
                      {src.href ? (
                        <Link
                          className="group block px-4 py-2.5 transition-colors hover:bg-[#f4fbf5] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1863dc]"
                          href={src.href}
                          title={titleAttr}
                        >
                          {row}
                        </Link>
                      ) : (
                        <span className="block px-4 py-2.5" title={titleAttr}>
                          {row}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 pb-4 text-[12.5px] leading-[1.6] text-[#8E918B]">
                No source records linked yet.
              </p>
            )}
            {page.sources.length > 14 ? (
              <p className="border-t border-[#E7E7E2] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
                + {page.sources.length - 14} more references
              </p>
            ) : null}
          </Tile>

          <Tile className="flex flex-col gap-0 !p-0">
            <div className="flex items-baseline justify-between gap-3 px-4 pb-3 pt-4">
              <p className="bb-mono-label">Related</p>
              <span className="font-mono text-[11.5px] font-semibold tabular-nums text-[#5F625E]">
                {page.related.length}
              </span>
            </div>
            {page.related.length ? (
              <ul className="divide-y divide-[#E7E7E2]">
                {page.related.slice(0, 8).map((rel) => {
                  const titleAttr = rel.note ? `${rel.label} · ${rel.note}` : rel.label;
                  const row = (
                    <span className="flex items-center gap-2.5">
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-[12.5px] font-medium leading-[1.35] text-[#171719]"
                          title={rel.label}
                        >
                          {rel.label}
                        </span>
                        {rel.note ? (
                          <span
                            className="mt-0.5 block truncate text-[11px] leading-[1.4] text-[#8E918B]"
                            title={rel.note}
                          >
                            {rel.note}
                          </span>
                        ) : null}
                      </span>
                      {rel.href ? (
                        <ArrowUpRight
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 text-[#A9ABA5] transition-colors group-hover:text-[#003C33]"
                        />
                      ) : null}
                    </span>
                  );
                  return (
                    <li key={`${rel.type}-${rel.id}`}>
                      {rel.href ? (
                        <Link
                          className="group block px-4 py-2.5 transition-colors hover:bg-[#f4fbf5] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1863dc]"
                          href={rel.href}
                          title={titleAttr}
                        >
                          {row}
                        </Link>
                      ) : (
                        <span className="block px-4 py-2.5" title={titleAttr}>
                          {row}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 pb-4 text-[12.5px] leading-[1.6] text-[#8E918B]">
                No related pages linked yet.
              </p>
            )}
          </Tile>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Workspace shell — derives selection from URL-free state.
   Selected page persists if it's still in the filtered set;
   otherwise we transparently fall back to the first match so
   the brief panel is never empty when the rail still has rows.
   ------------------------------------------------------------ */
export function KnowledgeVaultWorkspace({ model }: { model: KnowledgeVaultModel }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<KnowledgePageCategory | "All">("All");
  const [selectedPageId, setSelectedPageId] = useState(model.selectedPage.id);
  const segmentMeta = getBrokerSegmentMeta(model.segment);
  const normalizedQuery = query.trim().toLowerCase();

  // Search-only filter — ignores active category. Drives chip counts so
  // each chip reflects "if I switched to this category right now, how many
  // pages would match my current search?".
  const queryFilteredPages = useMemo(
    () =>
      normalizedQuery
        ? model.pages.filter((page) => includesQuery(page, normalizedQuery))
        : model.pages,
    [model.pages, normalizedQuery],
  );

  const dynamicCategoryCounts = useMemo(() => {
    const map = new Map<KnowledgePageCategory, number>();
    for (const page of queryFilteredPages) {
      map.set(page.category, (map.get(page.category) ?? 0) + 1);
    }
    return map;
  }, [queryFilteredPages]);

  const filteredPages = useMemo(
    () =>
      queryFilteredPages.filter(
        (page) => category === "All" || page.category === category,
      ),
    [category, queryFilteredPages],
  );

  // Selection persistence — keep current selection if it's still visible,
  // otherwise pick the first filtered row. Falls back to model default
  // when the filter empties out.
  const selectedPage = useMemo(() => {
    const inFiltered = filteredPages.find((p) => p.id === selectedPageId);
    if (inFiltered) return inFiltered;
    if (filteredPages.length) return filteredPages[0];
    return (
      model.pages.find((p) => p.id === selectedPageId) ?? model.selectedPage
    );
  }, [filteredPages, model.pages, model.selectedPage, selectedPageId]);

  const anchorPage = useMemo(() => pickAnchorPage(model.pages), [model.pages]);
  const totalGaps = useMemo(
    () => model.pages.reduce((acc, p) => acc + p.openGaps.length, 0),
    [model.pages],
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <AnchorTile
        anchorPage={anchorPage}
        generatedAt={model.generatedAt}
        onJumpTo={() => setSelectedPageId(anchorPage.id)}
        segmentTitle={segmentMeta.title}
        totalGaps={totalGaps}
      />

      <div className="mt-8">
        <KpiBand
          categories={model.categories}
          healthChecks={model.healthChecks}
          pages={model.pages}
        />
      </div>

      <section className="mt-10 grid gap-6 2xl:grid-cols-[340px_minmax(0,1fr)]">
        <PageBrowser
          categories={model.categories}
          category={category}
          dynamicCategoryCounts={dynamicCategoryCounts}
          dynamicTotalCount={queryFilteredPages.length}
          filteredPages={filteredPages}
          onCategoryChange={setCategory}
          onClearFilters={() => {
            setQuery("");
            setCategory("All");
          }}
          onQueryChange={setQuery}
          onSelect={setSelectedPageId}
          pages={model.pages}
          query={query}
          selectedPageId={selectedPage.id}
        />
        <PageBrief page={selectedPage} />
      </section>
    </div>
  );
}
