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
import { formatDate } from "@/lib/utils";
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
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
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
        "grid w-full gap-3 border-b border-[#f2f2f2] px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-[#fafafa]",
        active ? "bg-[#f8faf9]" : "bg-white",
      ].join(" ")}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4fbf5] text-[#003c33]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[#17171c]">{page.title}</p>
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

function SectionBlock({ section }: { section: KnowledgeSection }) {
  return (
    <section className="border-t border-[#f2f2f2] px-6 py-5">
      <h3 className="bb-mono-label">{section.title}</h3>
      {section.body ? (
        <p className="mt-3 max-w-4xl text-[15px] leading-7 text-[#3f3f46]">{section.body}</p>
      ) : null}
      {section.stats?.length ? (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {section.stats.map((stat) => (
            <div key={`${section.title}-${stat.label}`} className="rounded-xl bg-[#f7f7f8] px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#777888]">
                {stat.label}
              </dt>
              <dd className="mt-2 text-[18px] font-semibold text-[#17171c]">{stat.value}</dd>
              {stat.detail ? <p className="mt-1 text-[12px] leading-5 text-[#616161]">{stat.detail}</p> : null}
            </div>
          ))}
        </dl>
      ) : null}
      {section.bullets?.length ? (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {section.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2 text-[14px] leading-6 text-[#4b4b55]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#003c33]" aria-hidden="true" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
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
    <Card>
      <CardHeader
        eyebrow={page.category}
        title={page.title}
        description={page.summary}
        action={
          <CardHeaderIcon>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </CardHeaderIcon>
        }
      />
      <div className="grid gap-5 px-6 py-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge tone={categoryTone[page.category]}>{page.category}</Badge>
              <Badge tone={confidenceTone(page.confidence)}>{page.confidence}% confidence</Badge>
              <Badge tone="neutral">{page.visibility}</Badge>
              <Badge tone="neutral">Updated {formatDate(page.updatedAt)}</Badge>
            </div>
            <div className="mt-4">
              <ProgressBar value={page.confidence} tone={page.confidence >= 86 ? "green" : "ink"} />
            </div>
          </div>

          <div className="rounded-xl bg-[#f7f7f8] p-4">
            <p className="bb-mono-label">Lineage</p>
            <p className="mt-2 text-[13px] leading-6 text-[#616161]">
              {page.sources.length} sources · {page.related.length} links · {page.openGaps.length} gaps
            </p>
          </div>
        </div>

        {page.openGaps.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-amber-950">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Open intelligence gaps
            </div>
            <ul className="mt-2 grid gap-1 text-[13px] leading-6 text-amber-950/85">
              {page.openGaps.slice(0, 6).map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {page.sections.map((section) => (
        <SectionBlock key={section.title} section={section} />
      ))}

      <section className="grid gap-5 border-t border-[#f2f2f2] px-6 py-5 xl:grid-cols-2">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#003c33]" aria-hidden="true" />
            <h3 className="bb-mono-label">Source References</h3>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {page.sources.slice(0, 18).map((item) => (
              <SourceChip key={sourceLabel(item)} source={item} />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-[#003c33]" aria-hidden="true" />
            <h3 className="bb-mono-label">Related Pages</h3>
          </div>
          <div className="mt-4 grid gap-2">
            {page.related.length ? (
              page.related.slice(0, 8).map((item) => {
                const row = (
                  <>
                    <span className="font-medium text-[#17171c]">{item.label}</span>
                    {item.note ? <span className="text-[#777888]">{item.note}</span> : null}
                  </>
                );

                return item.href ? (
                  <Link
                    className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-white px-3 text-[13px] transition-colors hover:border-[#003c33]"
                    href={item.href}
                    key={`${item.type}-${item.id}`}
                  >
                    {row}
                  </Link>
                ) : (
                  <div
                    className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-white px-3 text-[13px]"
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
        </div>
      </section>
    </Card>
  );
}

function HealthCheckCard({ check }: { check: KnowledgeHealthCheck }) {
  const Icon = healthIcon[check.tone];

  return (
    <div className="rounded-xl border border-[#ececf0] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="bb-mono-label">{check.label}</p>
          <p className="mt-3 text-3xl font-semibold text-[#17171c]">{check.count}</p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4fbf5] text-[#003c33]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-6 text-[#616161]">{check.detail}</p>
      {check.items.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {check.items.slice(0, 4).map((item) => (
            <Badge key={item} tone={healthTone[check.tone]}>{item}</Badge>
          ))}
        </div>
      ) : null}
    </div>
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

      <section className="mt-10 grid gap-8 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="self-start overflow-hidden">
          <CardHeader
            eyebrow="Compiled index"
            title="Workspace pages"
            description="Search generated pages, source logs, and open intelligence gaps."
            action={
              <CardHeaderIcon>
                <BookOpenText className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <div className="border-b border-[#f2f2f2] px-5 py-4">
            <label className="relative block">
              <span className="sr-only">Search knowledge vault pages</span>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777888]"
                aria-hidden="true"
              />
              <input
                className="h-11 w-full rounded-full border border-[#d9d9dd] bg-white pl-11 pr-4 text-sm text-[#17171c] outline-none placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search source, buyer, listing, gap..."
                type="search"
                value={query}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
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
          <div className="max-h-[760px] overflow-y-auto">
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

      <section className="mt-8">
        <Card>
          <CardHeader
            eyebrow="Vault health"
            title="Source coverage and broker review signals"
            description="These checks help prevent generated memory from drifting away from real source records."
            action={
              <CardHeaderIcon>
                <Layers3 className="h-4 w-4" aria-hidden="true" />
              </CardHeaderIcon>
            }
          />
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            {model.healthChecks.map((check) => (
              <HealthCheckCard key={check.id} check={check} />
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
