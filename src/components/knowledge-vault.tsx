"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpenText,
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Database,
  FileSearch,
  FileText,
  Layers3,
  Link2,
  Network,
  Search,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";
import { getBrokerSegmentMeta } from "@/lib/broker-segments";
import type {
  KnowledgeHealthCheck,
  KnowledgePage,
  KnowledgePageCategory,
  KnowledgeSection,
  KnowledgeSource,
  KnowledgeVaultModel,
} from "@/lib/knowledge-vault";
import { formatDate, cn } from "@/lib/utils";
import { Badge, Card, CardHeader, CardHeaderIcon, PageHeader, ProgressBar } from "./ui";

const categoryIcons = {
  Overview: BookOpenText,
  Listing: BriefcaseBusiness,
  Buyer: Users,
  Owner: ShieldCheck,
  "Deal Room": FileText,
  "Market Note": Network,
  "Open Gaps": AlertTriangle,
  "Source Log": Database,
} satisfies Record<KnowledgePageCategory, typeof BookOpenText>;

const categoryTone = {
  Overview: "ink",
  Listing: "info",
  Buyer: "success",
  Owner: "warning",
  "Deal Room": "neutral",
  "Market Note": "coral",
  "Open Gaps": "warning",
  "Source Log": "neutral",
} satisfies Record<KnowledgePageCategory, "neutral" | "success" | "warning" | "error" | "info" | "coral" | "ink">;

const healthIcon = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: CircleAlert,
  info: FileSearch,
} satisfies Record<KnowledgeHealthCheck["tone"], typeof CheckCircle2>;

const healthTone = {
  success: "success",
  warning: "warning",
  error: "error",
  info: "info",
} satisfies Record<KnowledgeHealthCheck["tone"], "success" | "warning" | "error" | "info">;

function includesQuery(page: KnowledgePage, query: string) {
  const haystack = [
    page.title,
    page.category,
    page.summary,
    page.tags.join(" "),
    page.openGaps.join(" "),
    page.sections.map((section) => [section.title, section.body, section.bullets?.join(" ")].join(" ")).join(" "),
    page.sources.map((source) => [source.label, source.excerpt].join(" ")).join(" "),
    page.related.map((relation) => [relation.label, relation.note].join(" ")).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  // Split query into terms and ensure all terms are found (AND search)
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  
  return terms.every((term) => haystack.includes(term));
}

function confidenceTone(confidence: number) {
  if (confidence >= 86) return "success";
  if (confidence >= 72) return "info";
  return "warning";
}

function sourceLabel(source: KnowledgeSource) {
  return `${source.type.replace("-", " ")} · ${source.id}`;
}

function PageListItem({
  active,
  page,
  onSelect,
}: {
  active: boolean;
  page: KnowledgePage;
  onSelect: () => void;
}) {
  const Icon = categoryIcons[page.category];

  return (
    <button
      className={[
        "relative grid w-full gap-3 border-b border-[#f2f2f2] px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-[#fafafa]",
        active ? "bg-[#f4fbf5] before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:bg-[#003c33]" : "bg-white",
      ].join(" ")}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#003c33] shadow-sm ring-1 ring-black/5">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-[#17171c]">{page.title}</p>
            <p className="bb-mono-label mt-1">{page.category}</p>
          </div>
        </div>
        <Badge tone={confidenceTone(page.confidence)}>{page.confidence}%</Badge>
      </div>
      <p className="line-clamp-2 text-[13px] leading-6 text-[#616161]">{page.summary}</p>
      <div className="flex flex-wrap gap-2">
        {page.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} tone="neutral">{tag}</Badge>
        ))}
      </div>
    </button>
  );
}

function SourceChip({ source }: { source: KnowledgeSource }) {
  const content = (
    <>
      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{source.label}</span>
    </>
  );

  if (source.href) {
    return (
      <Link
        className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 text-[12px] font-medium text-[#3f3f46] transition-colors hover:border-[#003c33] hover:text-[#003c33]"
        href={source.href}
      >
        {content}
      </Link>
    );
  }

  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 text-[12px] font-medium text-[#3f3f46]">
      {content}
    </span>
  );
}

function PageDetail({ page }: { page: KnowledgePage }) {
  const Icon = categoryIcons[page.category];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3 auto-rows-max">
      {/* Main Header Card */}
      <Card className="col-span-1 flex flex-col justify-center p-6 lg:col-span-2 2xl:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={categoryTone[page.category]}>{page.category}</Badge>
              <Badge tone="neutral">{page.visibility}</Badge>
            </div>
            <h2 className="bb-display text-2xl font-medium text-[#17171c] sm:text-3xl">{page.title}</h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#616161]">{page.summary}</p>
          </div>
          <CardHeaderIcon className="h-12 w-12 shrink-0 bg-[#f4fbf5] text-[#003c33] sm:h-14 sm:w-14">
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </CardHeaderIcon>
        </div>
      </Card>

      {/* Confidence Score Card */}
      <Card className="col-span-1 flex flex-col justify-between bg-gradient-to-br from-[#f8faf9] to-white p-6">
        <div>
          <p className="bb-mono-label text-[#616161]">Confidence Score</p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="bb-display text-4xl font-medium text-[#17171c]">{page.confidence}%</span>
            <Badge tone={confidenceTone(page.confidence)}>
              {page.confidence >= 86 ? "High" : page.confidence >= 72 ? "Medium" : "Low"}
            </Badge>
          </div>
        </div>
        <div className="mt-8">
          <ProgressBar value={page.confidence} tone={page.confidence >= 86 ? "green" : "ink"} />
          <p className="mt-3 text-[12px] font-medium text-[#777888]">Updated {formatDate(page.updatedAt)}</p>
        </div>
      </Card>

      {/* Open Gaps Card */}
      {page.openGaps.length ? (
        <Card className="col-span-1 border-amber-200 bg-amber-50/50 p-6 lg:col-span-2 2xl:col-span-3">
          <div className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-amber-950">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            Open Intelligence Gaps
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {page.openGaps.map((gap, index) => (
              <li key={`${gap}-${index}`} className="flex gap-3 text-[13px] leading-6 text-amber-900/80">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Sections */}
      {page.sections.map((section) => {
        // Sections with lots of text or stats span wider
        const isLarge = (section.body && section.body.length > 180) || (section.stats && section.stats.length > 2);
        const spanClass = isLarge ? "col-span-1 lg:col-span-2 2xl:col-span-2" : "col-span-1";

        return (
          <Card key={section.title} className={cn("p-6", spanClass)}>
            <h3 className="bb-mono-label text-[#17171c]">{section.title}</h3>
            {section.body ? (
              <p className="mt-4 text-[14px] leading-7 text-[#3f3f46]">{section.body}</p>
            ) : null}

            {section.stats?.length ? (
              <dl className={cn("mt-5 grid gap-3", section.stats.length > 1 ? "sm:grid-cols-2" : "grid-cols-1")}>
                {section.stats.map((stat) => (
                  <div key={`${section.title}-${stat.label}`} className="rounded-xl bg-[#f7f7f8] p-4">
                    <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#777888]">
                      {stat.label}
                    </dt>
                    <dd className="mt-2 text-xl font-semibold text-[#17171c]">{stat.value}</dd>
                    {stat.detail ? <p className="mt-1 text-[12px] leading-5 text-[#616161]">{stat.detail}</p> : null}
                  </div>
                ))}
              </dl>
            ) : null}

            {section.bullets?.length ? (
              <ul className="mt-5 grid gap-3">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-[13px] leading-6 text-[#4b4b55]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#003c33]" aria-hidden="true" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        );
      })}

      {/* Sources & Lineage */}
      <Card className="col-span-1 p-6 lg:col-span-2 2xl:col-span-2">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#003c33]" aria-hidden="true" />
            <h3 className="bb-mono-label text-[#17171c]">Source References</h3>
          </div>
          <Badge tone="neutral">{page.sources.length} sources</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {page.sources.slice(0, 18).map((item) => (
            <SourceChip key={sourceLabel(item)} source={item} />
          ))}
        </div>
      </Card>

      {/* Related Pages */}
      <Card className="col-span-1 p-6 lg:col-span-2 2xl:col-span-1">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-[#003c33]" aria-hidden="true" />
            <h3 className="bb-mono-label text-[#17171c]">Related</h3>
          </div>
          <Badge tone="neutral">{page.related.length} links</Badge>
        </div>
        <div className="grid gap-2">
          {page.related.length ? (
            page.related.slice(0, 5).map((item) => {
              const row = (
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#17171c]">{item.label}</p>
                  {item.note ? <p className="truncate text-[12px] text-[#777888]">{item.note}</p> : null}
                </div>
              );

              return item.href ? (
                <Link
                  className="flex items-center gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3 transition-colors hover:border-[#003c33] hover:bg-[#f4fbf5]"
                  href={item.href}
                  key={`${item.type}-${item.id}`}
                >
                  {row}
                </Link>
              ) : (
                <div
                  className="flex items-center gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3"
                  key={`${item.type}-${item.id}`}
                >
                  {row}
                </div>
              );
            })
          ) : (
            <p className="text-[13px] leading-6 text-[#616161]">No related pages linked yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

function HealthCheckCard({ check }: { check: KnowledgeHealthCheck }) {
  const Icon = healthIcon[check.tone];

  return (
    <Card className="flex flex-col justify-between p-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="bb-mono-label">{check.label}</p>
            <p className="bb-display mt-3 text-4xl font-medium text-[#17171c]">{check.count}</p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4fbf5] text-[#003c33]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-4 text-[13px] leading-6 text-[#616161]">{check.detail}</p>
      </div>
      {check.items.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {check.items.slice(0, 4).map((item, index) => (
            <Badge key={`${item}-${index}`} tone={healthTone[check.tone]} className="max-w-full">
              <span className="truncate">{item}</span>
            </Badge>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

export function KnowledgeVaultWorkspace({ model }: { model: KnowledgeVaultModel }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<KnowledgePageCategory | "All">("All");
  const [selectedPageId, setSelectedPageId] = useState(model.selectedPage.id);
  const segmentMeta = getBrokerSegmentMeta(model.segment);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPages = useMemo(
    () =>
      model.pages.filter((page) => {
        const matchesCategory = category === "All" || page.category === category;
        const matchesQuery = !normalizedQuery || includesQuery(page, normalizedQuery);
        return matchesCategory && matchesQuery;
      }),
    [category, model.pages, normalizedQuery],
  );
  const selectedPage =
    model.pages.find((page) => page.id === selectedPageId) ?? filteredPages[0] ?? model.selectedPage;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <PageHeader
        eyebrow="Knowledge vault"
        title={`${segmentMeta.title} knowledge vault`}
        description="Generated workspace pages compile operational records into source-linked broker memory. Use it to inspect what the app knows, where that knowledge came from, and what is still missing."
        metrics={model.metrics}
      />

      <section className="mt-10 grid items-start gap-6 2xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="flex h-[680px] max-h-[calc(100dvh-8rem)] min-h-[420px] flex-col overflow-hidden 2xl:sticky 2xl:top-8">
          <div className="border-b border-[#f2f2f2] bg-[#fcfcfc] px-5 py-5">
            <div className="mb-4 flex items-center gap-2">
              <BookOpenText className="h-5 w-5 text-[#17171c]" aria-hidden="true" />
              <h2 className="bb-display text-lg font-medium text-[#17171c]">Workspace Pages</h2>
            </div>
            <label className="relative block">
              <span className="sr-only">Search knowledge vault pages</span>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777888]"
                aria-hidden="true"
              />
              <input
                className="h-11 w-full rounded-full border border-[#d9d9dd] bg-white pl-11 pr-4 text-sm text-[#17171c] outline-none transition-colors placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search source, buyer, listing, gap..."
                type="search"
                value={query}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={[
                  "min-h-8 rounded-full border px-3 text-[12px] font-medium transition-colors",
                  category === "All"
                    ? "border-[#17171c] bg-[#17171c] text-white"
                    : "border-[#e5e7eb] bg-white text-[#4b4b55] hover:border-[#17171c]",
                ].join(" ")}
                onClick={() => setCategory("All")}
                type="button"
              >
                All
              </button>
              {model.categories.map((item) => (
                <button
                  className={[
                    "min-h-8 rounded-full border px-3 text-[12px] font-medium transition-colors",
                    category === item.label
                      ? "border-[#17171c] bg-[#17171c] text-white"
                      : "border-[#e5e7eb] bg-white text-[#4b4b55] hover:border-[#17171c]",
                  ].join(" ")}
                  key={item.label}
                  onClick={() => setCategory(item.label)}
                  type="button"
                >
                  {item.label} · {item.count}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredPages.length ? (
              filteredPages.map((page) => (
                <PageListItem
                  active={page.id === selectedPage.id}
                  key={page.id}
                  onSelect={() => setSelectedPageId(page.id)}
                  page={page}
                />
              ))
            ) : (
              <div className="px-6 py-10 text-center">
                <Tags className="mx-auto h-6 w-6 text-[#777888]" aria-hidden="true" />
                <p className="mt-3 text-[14px] font-medium text-[#17171c]">No generated pages match this filter.</p>
                <p className="mt-2 text-[13px] leading-6 text-[#616161]">Try a broader source, buyer, listing, or gap term.</p>
              </div>
            )}
          </div>
        </Card>

        <PageDetail page={selectedPage} />
      </section>

      <section className="mt-12 border-t border-[#e5e7eb] pt-10">
        <div className="mb-6">
          <p className="bb-mono-label">Vault health</p>
          <h2 className="bb-display mt-2 text-2xl font-medium text-[#17171c]">Source coverage & signals</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#616161]">
            These checks help prevent generated memory from drifting away from real source records.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {model.healthChecks.map((check) => (
            <HealthCheckCard key={check.id} check={check} />
          ))}
        </div>
      </section>
    </div>
  );
}
