"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ActivityLogIcon,
  BackpackIcon,
  BarChartIcon,
  CalendarIcon,
  CaretSortIcon,
  CardStackIcon,
  ChatBubbleIcon,
  CheckCircledIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  CrossCircledIcon,
  DashboardIcon,
  ExclamationTriangleIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HomeIcon,
  InfoCircledIcon,
  MagnifyingGlassIcon,
  Pencil1Icon,
  PersonIcon,
  StackIcon,
  UploadIcon,
} from "@radix-ui/react-icons";
import type {
  KnowledgeHealthCheck,
  KnowledgePage,
  KnowledgePageCategory,
  KnowledgeVaultModel,
} from "@/lib/knowledge-vault";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "../ui";
import { FitRing } from "../dashboard/visuals";
import { IMPORT_EVENT } from "./import-knowledge-button";
import { ImportKnowledgePanel, type ImportCandidate } from "./import-knowledge-panel";

/* A user-imported note attached to a vault page (subset of the
   server-side KnowledgeNote — only the fields the UI renders). */
export interface VaultNote {
  groupId: string;
  title: string;
  summary: string;
  tags: string[];
  entityLabel: string;
  createdAt: string;
}

const LINKABLE_CATEGORIES: KnowledgePageCategory[] = [
  "Listing",
  "Buyer",
  "Owner",
  "Deal Room",
  "Market Note",
];

/* ============================================================
   Knowledge pages pane — the "visual" half.

   Overview mode: a slim health strip, search + category chips, and
   a compact card list. Selecting a card (or a chat citation) drops
   into detail mode: core facts, sources, and relations, with an
   "Ask about this" handoff back to the chat pane.
   ============================================================ */

const CATEGORY_ICON = {
  Overview: HomeIcon,
  Listing: CardStackIcon,
  Buyer: PersonIcon,
  Owner: BackpackIcon,
  "Deal Room": FileTextIcon,
  "Market Note": BarChartIcon,
  "Open Gaps": ExclamationTriangleIcon,
  "Source Log": StackIcon,
  Note: Pencil1Icon,
} satisfies Record<KnowledgePageCategory, typeof HomeIcon>;

const HEALTH_ICON = {
  success: CheckCircledIcon,
  warning: ExclamationTriangleIcon,
  error: CrossCircledIcon,
  info: InfoCircledIcon,
} satisfies Record<KnowledgeHealthCheck["tone"], typeof CheckCircledIcon>;

const HEALTH_COLOR = {
  success: "text-[#0F8F62]",
  warning: "text-[#A86642]",
  error: "text-[#A86642]",
  info: "text-[#1863dc]",
} satisfies Record<KnowledgeHealthCheck["tone"], string>;

function confidenceColor(value: number) {
  if (value >= 86) return "text-[#0F8F62]";
  if (value >= 72) return "text-[#171719]";
  return "text-[#c64a31]";
}

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

function matchesQuery(page: KnowledgePage, query: string) {
  if (!query) return true;
  const haystack = [
    page.title,
    page.category,
    page.summary,
    page.tags.join(" "),
    page.openGaps.join(" "),
  ]
    .join(" ")
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function KnowledgePagesPane({
  model,
  focusPageId,
  focusNonce = 0,
  notePages,
  notesByPage,
  onAskAboutPage,
}: {
  model: KnowledgeVaultModel;
  focusPageId?: string | null;
  focusNonce?: number;
  notePages?: KnowledgePage[];
  notesByPage?: Record<string, VaultNote[]>;
  onAskAboutPage: (page: KnowledgePage) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<KnowledgePageCategory | "All">("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [appliedFocus, setAppliedFocus] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importDefaultId, setImportDefaultId] = useState<string | null>(null);

  // A chat citation focuses a specific page → jump straight to its detail.
  // Synced during render when a new focus nonce arrives (no setState-in-effect).
  if (focusNonce && focusNonce !== appliedFocus) {
    setAppliedFocus(focusNonce);
    if (focusPageId) setSelectedId(focusPageId);
  }

  // The "Import knowledge" button in the top bar lives outside this tree,
  // so it asks us to open the drawer via a window event.
  useEffect(() => {
    const handler = () => {
      setImportDefaultId(null);
      setImportOpen(true);
    };
    window.addEventListener(IMPORT_EVENT, handler);
    return () => window.removeEventListener(IMPORT_EVENT, handler);
  }, []);

  // Imported notes appear as their own browsable "Note" pages alongside the
  // generated vault pages.
  const allPages = useMemo(
    () => [...model.pages, ...(notePages ?? [])],
    [model.pages, notePages],
  );

  const categories = useMemo(
    () =>
      notePages?.length
        ? [...model.categories, { label: "Note" as const, count: notePages.length }]
        : model.categories,
    [model.categories, notePages],
  );

  const filtered = useMemo(
    () =>
      allPages.filter(
        (page) =>
          (category === "All" || page.category === category) && matchesQuery(page, query),
      ),
    [allPages, category, query],
  );

  const selectedPage = useMemo(
    () => (selectedId ? allPages.find((page) => page.id === selectedId) ?? null : null),
    [allPages, selectedId],
  );

  const importCandidates = useMemo<ImportCandidate[]>(
    () =>
      model.pages
        .filter((page) => LINKABLE_CATEGORIES.includes(page.category))
        .map((page) => ({ id: page.id, title: page.title, category: page.category })),
    [model.pages],
  );

  const openImport = (defaultId: string | null) => {
    setImportDefaultId(defaultId);
    setImportOpen(true);
  };

  const importModal = importOpen ? (
    <ImportKnowledgePanel
      candidates={importCandidates}
      defaultEntityId={importDefaultId}
      onClose={() => setImportOpen(false)}
      onSaved={() => router.refresh()}
    />
  ) : null;

  if (selectedPage) {
    return (
      <>
        <PageDetail
          notes={notesByPage?.[selectedPage.id] ?? []}
          onAddNote={(p) => openImport(p.id)}
          onAskAboutPage={onAskAboutPage}
          onBack={() => setSelectedId(null)}
          page={selectedPage}
        />
        {importModal}
      </>
    );
  }

  const avgConfidence = Math.round(
    model.pages.reduce((acc, page) => acc + page.confidence, 0) / Math.max(model.pages.length, 1),
  );
  const pagesControls = (
    <div className="grid gap-3">
      <div className="flex h-12 items-center gap-3 rounded-[10px] border border-[#E7E7E7] bg-white px-4">
        <MagnifyingGlassIcon aria-hidden="true" className="size-4 shrink-0 text-[#8E918B]" />
        <input
          className="w-full bg-transparent text-[14px] text-[#171719] outline-none placeholder:text-[#A9ABA5]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages..."
          type="search"
          value={query}
        />
      </div>

      <div className="-mx-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2">
          <FilterButton
            active={category === "All"}
            count={allPages.length}
            icon={DashboardIcon}
            label="All"
            onClick={() => setCategory("All")}
          />
          {categories.map((cat) => (
            <FilterButton
              active={category === cat.label}
              count={cat.count}
              icon={CATEGORY_ICON[cat.label]}
              key={cat.label}
              label={cat.label}
              onClick={() => setCategory(cat.label)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FBFBFB]">
      {/* @container so the panel reflows to the pane width, not the viewport. */}
      <div className="@container min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <VaultHealthCard avg={avgConfidence} model={model} />

        {/* Pages table */}
        <KnowledgePagesTable
          controls={pagesControls}
          filterKey={`${category}|${query}`}
          onSelect={setSelectedId}
          pages={filtered}
        />
      </div>
      {importModal}
    </div>
  );
}

function FilterButton({
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  icon: typeof HomeIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-[8px] border px-3.5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
        active
          ? "border-[#003C33] bg-[#003C33] text-white"
          : "border-[#E7E7E7] bg-white text-[#5F625E] hover:border-[#003C33]/40 hover:bg-[#F1F2EE]",
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      <span className={active ? "text-white/70" : "text-[#A9ABA5]"}>· {count}</span>
    </button>
  );
}

/* Conic-gradient health ring — solid brand fill on a pale-green track. */
function HealthRing({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  const degrees = safe * 3.6;
  return (
    <div
      className="relative flex size-28 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#003C33 0deg ${degrees}deg, #F1F2EE ${degrees}deg 360deg)` }}
    >
      <div className="absolute inset-[10px] rounded-full bg-white" />
      <div className="relative text-center">
        <p className="bb-display text-[26px] font-semibold leading-none tracking-[-0.03em] text-[#171719]">
          {safe}%
        </p>
        <p className="mt-1 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#8E918B]">Health</p>
      </div>
    </div>
  );
}

function VaultHealthCard({ avg, model }: { avg: number; model: KnowledgeVaultModel }) {
  return (
    <article className="overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-white">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-[#E7E7E7] px-5 py-4 @md:flex-row @md:items-center @md:justify-between">
        <div className="flex items-center gap-2.5">
          <ActivityLogIcon aria-hidden="true" className="size-4 text-[#5F625E]" />
          <h2 className="text-[12px] font-bold uppercase tracking-[0.22em] text-[#171719]">Vault Health</h2>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E918B]">
          <CalendarIcon aria-hidden="true" className="size-4" />
          <span>Generated {formatDate(model.generatedAt)}</span>
        </div>
      </div>

      {/* Ring + metrics */}
      <div className="flex flex-col @lg:flex-row">
        <div className="flex items-center justify-center border-b border-[#E7E7E7] p-6 @lg:w-[200px] @lg:border-b-0 @lg:border-r">
          <HealthRing value={avg} />
        </div>
        <div className="grid flex-1 grid-cols-2">
          {model.metrics.map((metric, index) => (
            <div
              className={cn(
                "px-5 py-4",
                index % 2 === 0 && "border-r border-[#E7E7E7]",
                index < model.metrics.length - 2 && "border-b border-[#E7E7E7]",
              )}
              key={metric.label}
            >
              <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#8E918B]">
                {metric.label}
              </p>
              <p className="bb-display mt-2.5 text-[30px] font-semibold leading-none tracking-[-0.04em] text-[#171719]">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Status row */}
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 border-t border-[#E7E7E7] px-5 py-4 @sm:grid-cols-2">
        {model.healthChecks.map((check) => {
          const Icon = HEALTH_ICON[check.tone];
          return (
            <div className="flex items-center gap-2.5" key={check.id}>
              <Icon aria-hidden="true" className={cn("size-4 shrink-0", HEALTH_COLOR[check.tone])} />
              <p className="text-[12.5px] text-[#5F625E]">
                {check.label}{" "}
                <span className={cn("font-bold", HEALTH_COLOR[check.tone])}>{check.count}</span>
              </p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------
   Pages table — sortable columns + minimal pagination. Replaces
   the card list. Columns collapse with the pane width via the
   @container variants (gaps hide first, then updated).
   ------------------------------------------------------------ */
type SortColumn = "title" | "confidence" | "gaps" | "updated";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 10;

function ConfidenceBadge({ value }: { value: number }) {
  const tone = confidenceTone(value);
  const dot = tone === "green" ? "bg-[#0F8F62]" : tone === "coral" ? "bg-[#A86642]" : "bg-[#5F625E]";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-[#E7E7E7] bg-white px-2 py-0.5 text-[11px] font-semibold">
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      <span className={confidenceColor(value)}>{value}%</span>
    </span>
  );
}

function SortableTh({
  className,
  column,
  label,
  onSort,
  sortColumn,
  sortDirection,
}: {
  className?: string;
  column: SortColumn;
  label: string;
  onSort: (column: SortColumn) => void;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}) {
  const active = sortColumn === column;
  return (
    <th className={cn("px-3 py-2.5 first:pl-5", className)} scope="col">
      <button
        className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8E918B] transition-colors hover:text-[#171719]"
        onClick={() => onSort(column)}
        type="button"
      >
        {label}
        {active ? (
          sortDirection === "asc" ? (
            <ChevronUpIcon className="size-3.5 text-[#171719]" aria-hidden="true" />
          ) : (
            <ChevronDownIcon className="size-3.5 text-[#171719]" aria-hidden="true" />
          )
        ) : (
          <CaretSortIcon className="size-3.5 text-[#C4C7C0]" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

function KnowledgePagesTable({
  controls,
  pages,
  filterKey,
  onSelect,
}: {
  controls: ReactNode;
  pages: KnowledgePage[];
  filterKey: string;
  onSelect: (id: string) => void;
}) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("confidence");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);

  // Reset to page 1 when the filter/search changes (render-time sync).
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const sorted = useMemo(() => {
    const copy = [...pages];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "title") cmp = a.title.localeCompare(b.title);
      else if (sortColumn === "confidence") cmp = a.confidence - b.confidence;
      else if (sortColumn === "gaps") cmp = a.openGaps.length - b.openGaps.length;
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDirection === "desc" ? -cmp : cmp;
    });
    return copy;
  }, [pages, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const onSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection(column === "title" ? "asc" : "desc");
    }
  };

  if (!pages.length) {
    return (
      <div className="overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-white">
        <div className="flex items-center gap-2.5 border-b border-[#E7E7E7] px-5 py-4">
          <h3 className="text-[14px] font-semibold text-[#171719]">Pages</h3>
          <Badge tone="neutral">{pages.length}</Badge>
        </div>
        <div className="border-b border-[#E7E7E7] bg-white px-5 py-4">
          {controls}
        </div>
        <div className="px-6 py-12 text-center">
          <p className="bb-display text-[15px] font-medium text-[#171719]">No pages match.</p>
          <p className="mx-auto mt-1.5 max-w-[15rem] text-[12.5px] leading-6 text-[#8E918B]">
            Try a different keyword or category.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#E7E7E7] px-5 py-4">
        <h3 className="text-[14px] font-semibold text-[#171719]">Pages</h3>
        <Badge tone="neutral">{pages.length}</Badge>
      </div>
      <div className="border-b border-[#E7E7E7] bg-white px-5 py-4">
        {controls}
      </div>

      <div className="overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-[#E7E7E7]">
              <SortableTh className="w-[49%]" column="title" label="Page" onSort={onSort} sortColumn={sortColumn} sortDirection={sortDirection} />
              <SortableTh className="w-[25%]" column="confidence" label="Confidence" onSort={onSort} sortColumn={sortColumn} sortDirection={sortDirection} />
              <SortableTh className="hidden w-[13%] @md:table-cell" column="gaps" label="Gaps" onSort={onSort} sortColumn={sortColumn} sortDirection={sortDirection} />
              <SortableTh className="hidden w-[13%] @lg:table-cell" column="updated" label="Updated" onSort={onSort} sortColumn={sortColumn} sortDirection={sortDirection} />
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const Icon = CATEGORY_ICON[item.category];
              return (
                <tr
                  className="group cursor-pointer border-b border-[#E7E7E7] align-middle transition-colors last:border-b-0 hover:bg-[#F1F2EE]"
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                >
                  <td className="h-[68px] py-2 pl-5 pr-2 align-middle">
                    <div className="flex h-full min-w-0 items-center gap-2.5">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F2EE] text-[#003C33]">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[#171719]" title={item.title}>
                          {item.title}
                        </p>
                        <p className="truncate text-[11px] text-[#8E918B]">{item.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="h-[68px] px-2 py-2 align-middle">
                    <div className="flex h-full items-center">
                      <ConfidenceBadge value={item.confidence} />
                    </div>
                  </td>
                  <td className="hidden h-[68px] px-2 py-2 align-middle @md:table-cell">
                    <div className="flex h-full items-center">
                      {item.openGaps.length ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-[#A86642]">
                          <ExclamationTriangleIcon className="size-3.5" aria-hidden="true" />
                          {item.openGaps.length}
                        </span>
                      ) : (
                        <span className="text-[12px] text-[#A9ABA5]">—</span>
                      )}
                    </div>
                  </td>
                  <td className="hidden h-[68px] whitespace-nowrap px-2 py-2 align-middle text-[12px] text-[#5F625E] @lg:table-cell">
                    <div className="flex h-full items-center">
                      {formatDate(item.updatedAt)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#E7E7E7] px-4 py-3">
        <button
          className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E7E7E7] disabled:hover:text-[#5F625E]"
          disabled={currentPage <= 1}
          onClick={() => setPage(currentPage - 1)}
          type="button"
        >
          Previous
        </button>
        <span className="text-[12px] text-[#8E918B]">
          Page <span className="font-semibold text-[#171719]">{currentPage}</span> of {totalPages}
        </span>
        <button
          className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E7E7E7] disabled:hover:text-[#5F625E]"
          disabled={currentPage >= totalPages}
          onClick={() => setPage(currentPage + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function PageDetail({
  page,
  notes,
  onBack,
  onAskAboutPage,
  onAddNote,
}: {
  page: KnowledgePage;
  notes: VaultNote[];
  onBack: () => void;
  onAskAboutPage: (page: KnowledgePage) => void;
  onAddNote: (page: KnowledgePage) => void;
}) {
  const Icon = CATEGORY_ICON[page.category];
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FBFBFB]">
      {/* Detail top bar */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E7E7E7] bg-white px-5 py-3">
        <button
          className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-2.5 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
          onClick={onBack}
          type="button"
        >
          <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
          All pages
        </button>
        <div className="flex items-center gap-2">
          {page.category !== "Note" ? (
            <button
              className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-2.5 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
              onClick={() => onAddNote(page)}
              type="button"
            >
              <UploadIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Add note
            </button>
          ) : null}
          <button
            className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] bg-[#003C33] px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-[#0B4A3F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
            onClick={() => onAskAboutPage(page)}
            type="button"
          >
            <ChatBubbleIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Ask about this
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="grid gap-4">
          {/* Header */}
          <div className="rounded-[12px] border border-[#E7E7E7] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F2EE] text-[#003C33]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <Badge tone="neutral">{page.category}</Badge>
                  <Badge tone="neutral">{page.visibility}</Badge>
                </div>
                <h2 className="bb-display mt-3 text-[22px] font-medium leading-[1.15] text-[#171719]">
                  {page.title}
                </h2>
                <p className="mt-2 text-[13px] leading-[1.65] text-[#5F625E]">{page.summary}</p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#A9ABA5]">
                  Updated {formatDate(page.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <FitRing
                  label={`${page.confidence}%`}
                  size={66}
                  stroke={6}
                  tone={confidenceTone(page.confidence)}
                  value={page.confidence}
                />
                <span className={cn("text-[10.5px] font-medium uppercase tracking-[0.12em]", confidenceColor(page.confidence))}>
                  {confidenceLabel(page.confidence)}
                </span>
              </div>
            </div>
            {page.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {page.tags.slice(0, 8).map((tag) => (
                  <Badge key={tag} tone="neutral">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          {/* Open gaps */}
          {page.openGaps.length ? (
            <div className="rounded-[12px] border border-[#F0DDD0] bg-[#F0DDD0]/50 p-4">
              <p className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[#A86642]">
                <ExclamationTriangleIcon className="h-4 w-4" aria-hidden="true" />
                {page.openGaps.length} open {page.openGaps.length === 1 ? "gap" : "gaps"} to close
              </p>
              <ul className="mt-2.5 grid gap-1.5">
                {page.openGaps.map((gap, index) => (
                  <li className="flex gap-2 text-[12px] leading-[1.55] text-[#A86642]/90" key={`${gap}-${index}`}>
                    <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#A86642]" />
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Added knowledge — user-imported notes linked to this page. */}
          {notes.length ? (
            <section className="rounded-[12px] border border-[#E7E7E7] bg-[#F1F2EE] p-5">
              <div className="flex items-center gap-2">
                <Pencil1Icon className="size-4 text-[#003C33]" aria-hidden="true" />
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3F5249]">
                  Added knowledge
                </p>
                <span className="font-mono text-[11px] font-semibold text-[#5F7A6F]">{notes.length}</span>
              </div>
              <ul className="mt-3 grid gap-3">
                {notes.map((note) => (
                  <li className="rounded-[10px] border border-[#E7E7E7] bg-white p-3.5" key={note.groupId}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13px] font-semibold text-[#171719]">{note.title}</p>
                      <span className="shrink-0 text-[10.5px] uppercase tracking-[0.12em] text-[#A9ABA5]">
                        {formatDate(note.createdAt)}
                      </span>
                    </div>
                    {note.summary ? (
                      <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[#5F625E]">{note.summary}</p>
                    ) : null}
                    {note.tags.length ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {note.tags.slice(0, 6).map((tag) => (
                          <Badge key={tag} tone="neutral">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Core facts */}
          <section className="rounded-[12px] border border-[#E7E7E7] bg-white p-5">
            <p className="bb-mono-label">Core facts</p>
            <div className="mt-3 grid gap-5">
              {page.sections.map((section) => (
                <div key={section.title}>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#171719]">
                    {section.title}
                  </p>
                  {section.body ? (
                    <p className="mt-2 text-[13px] leading-[1.7] text-[#5F625E]">{section.body}</p>
                  ) : null}
                  {section.stats?.length ? (
                    <dl className="mt-2.5 grid grid-cols-2 gap-2">
                      {section.stats.map((stat) => (
                        <div className="rounded-[10px] border border-[#E7E7E7] bg-[#FBFBFB] px-3 py-2" key={`${section.title}-${stat.label}`}>
                          <dt className="bb-mono-label !text-[9.5px]">{stat.label}</dt>
                          <dd className="mt-0.5 text-[15px] font-semibold leading-tight text-[#171719]">
                            {stat.value}
                          </dd>
                          {stat.detail ? (
                            <p className="mt-0.5 text-[11px] leading-[1.4] text-[#8E918B]">{stat.detail}</p>
                          ) : null}
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {section.bullets?.length ? (
                    <ul className="mt-2.5 grid gap-1.5">
                      {section.bullets.map((bullet, index) => (
                        <li className="flex gap-2 text-[12.5px] leading-[1.6] text-[#5F625E]" key={`${section.title}-${index}`}>
                          <span aria-hidden="true" className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#003C33]" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {/* Sources + Relations */}
          <div className="grid gap-4">
            <MetaList
              emptyText="No source records linked yet."
              items={page.sources.map((src) => ({
                key: `${src.type}:${src.id}`,
                label: src.label,
                sub: src.type.replace("-", " "),
                href: src.href,
              }))}
              title="Sources"
            />
            <MetaList
              emptyText="No related pages linked yet."
              items={page.related.map((rel) => ({
                key: `${rel.type}:${rel.id}`,
                label: rel.label,
                sub: rel.note,
                href: rel.href,
              }))}
              title="Relations"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<{ key: string; label: string; sub?: string; href?: string }>;
  emptyText: string;
}) {
  return (
    <section className="rounded-[12px] border border-[#E7E7E7] bg-white">
      <div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
        <p className="bb-mono-label">{title}</p>
        <span className="font-mono text-[11px] font-semibold tabular-nums text-[#8E918B]">{items.length}</span>
      </div>
      {items.length ? (
        <ul className="divide-y divide-[#E7E7E7]">
          {items.slice(0, 12).map((item) => {
            const body = (
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-[#171719]" title={item.label}>
                    {item.label}
                  </span>
                  {item.sub ? (
                    <span className="mt-0.5 block truncate text-[10.5px] uppercase tracking-[0.1em] text-[#8E918B]">
                      {item.sub}
                    </span>
                  ) : null}
                </span>
                {item.href ? (
                  <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0 text-[#A9ABA5] group-hover:text-[#003C33]" aria-hidden="true" />
                ) : null}
              </span>
            );
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    className="group block px-4 py-2.5 transition-colors hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#003C33]"
                    href={item.href}
                  >
                    {body}
                  </Link>
                ) : (
                  <span className="block px-4 py-2.5">{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-[12px] leading-[1.6] text-[#8E918B]">{emptyText}</p>
      )}
    </section>
  );
}
