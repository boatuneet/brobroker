"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  FileDown,
  Mail,
  Minus,
  Send,
  Tag,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import type { BrokerSegment } from "@/lib/broker-segments";
import {
  getEditableSellerReports,
  summarizeReportPerformance,
  type ReportFunnelStage,
  type ReportPerformance,
  type ReportPricePosition,
  type ReportTrendDelta,
} from "@/lib/services";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, CardHeaderIcon, PageHeader, WorkflowState } from "./ui";

export function ReportsWorkspace({
  includeDemo = true,
  segment,
}: {
  includeDemo?: boolean;
  segment?: BrokerSegment;
}) {
  const reports = useMemo(
    () => getEditableSellerReports(segment, { includeDemo }),
    [segment, includeDemo],
  );
  const [selectedReportId, setSelectedReportId] = useState(reports[0]?.input.id ?? "");
  const selected = reports.find((report) => report.input.id === selectedReportId) ?? reports[0];
  const [approvedReportIds, setApprovedReportIds] = useState<string[]>(() =>
    readPersisted<string[]>("brobroker:reports:approved", []),
  );
  const [draftBody, setDraftBody] = useState(() =>
    selected
      ? readPersisted(`brobroker:reports:${selected.input.id}:draft`, selected.editableDraft)
      : "",
  );
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [sentReportIds, setSentReportIds] = useState<string[]>(() =>
    readPersisted<string[]>("brobroker:reports:sent", []),
  );

  const performance = useMemo<ReportPerformance | null>(
    () => (selected ? summarizeReportPerformance(selected.input, selected.listing) : null),
    [selected],
  );

  const dueCount = reports.filter((report) => !approvedReportIds.includes(report.input.id)).length;
  const approvedCount = reports.filter((report) =>
    approvedReportIds.includes(report.input.id),
  ).length;

  function selectReport(reportId: string) {
    const next = reports.find((report) => report.input.id === reportId);
    setSelectedReportId(reportId);
    setShowExportPreview(false);
    setDraftBody(
      next ? readPersisted(`brobroker:reports:${next.input.id}:draft`, next.editableDraft) : "",
    );
  }

  function approveDraft() {
    if (!selected) return;
    setApprovedReportIds((current) => {
      const next = [...new Set([selected.input.id, ...current])];
      writePersisted("brobroker:reports:approved", next);
      return next;
    });
    mirrorWorkflowEvent("seller_report_approved", selected.input.id, {
      reportId: selected.input.id,
      draftBody,
    });
  }

  async function markSent() {
    if (!selected) return;
    const next = [...new Set([selected.input.id, ...sentReportIds])];
    setSentReportIds(next);
    writePersisted("brobroker:reports:sent", next);
    await navigator.clipboard?.writeText(draftBody).catch(() => undefined);
    mirrorWorkflowEvent("seller_report_staged_for_send", selected.input.id, {
      reportId: selected.input.id,
      draftBody,
    });
  }

  useEffect(() => {
    if (!selected) return;
    writePersisted(`brobroker:reports:${selected.input.id}:draft`, draftBody);
  }, [draftBody, selected]);

  const isApproved = selected ? approvedReportIds.includes(selected.input.id) : false;
  const isSent = selected ? sentReportIds.includes(selected.input.id) : false;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <PageHeader
        metrics={[
          { label: "Owner updates", value: `${reports.length}` },
          { label: "Awaiting approval", value: `${dueCount}` },
          { label: "Approved", value: `${approvedCount}` },
        ]}
      />

      {!selected || !performance ? (
        <div className="mt-12">
          <WorkflowState
            title="No owner updates yet"
            description="Add seller context and weekly activity to draft owner updates."
            action={
              <Link
                className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-5 text-sm font-medium text-[#171719] hover:border-[#003C33]"
                href="/listings"
              >
                Open listings
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-12 grid items-start gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* Left rail — report picker. Sticks just under the top bar on wide
              screens while the taller right column scrolls past it. */}
          <Card className="overflow-hidden xl:sticky xl:top-20">
            <CardHeader
              title="Owner updates"
              action={
                <CardHeaderIcon>
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                </CardHeaderIcon>
              }
            />
            <ul className="grid gap-2.5 p-4">
              {reports.map((report) => {
                const isCurrent = selected.input.id === report.input.id;
                const rowApproved = approvedReportIds.includes(report.input.id);
                const rowSent = sentReportIds.includes(report.input.id);

                return (
                  <li key={report.input.id}>
                    <button
                      className={cn(
                        "block w-full rounded-[10px] border p-4 text-left transition-all hover:border-[#003C33] hover:bg-white",
                        isCurrent ? "border-[#003C33] bg-white" : "border-[#E7E7E7] bg-[#F1F2EE]",
                      )}
                      onClick={() => selectReport(report.input.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-[14px] font-medium leading-5 text-[#171719]">
                            {report.report.title}
                          </p>
                          <p className="mt-1.5 text-[12px] leading-5 text-[#8E918B]">
                            {report.seller?.name} · {report.input.period}
                          </p>
                        </div>
                        <Badge tone={rowSent ? "info" : rowApproved ? "success" : "warning"}>
                          {rowSent ? "Sent" : rowApproved ? "Approved" : "Due"}
                        </Badge>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <MiniStat value={report.input.inquiries} label="Inq." />
                        <MiniStat value={report.input.qualifiedLeads} label="Leads" />
                        <MiniStat value={report.input.viewings} label="Views" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="grid gap-8">
            {/* Performance — the visual read of how the listing is doing. */}
            <Card className="overflow-hidden">
              <CardHeader
                title={selected.report.title}
                description={`${selected.seller?.name ?? "Owner"} · ${selected.input.period}`}
                action={
                  <Badge tone={isSent ? "info" : isApproved ? "success" : "warning"}>
                    {isSent ? "Sent" : isApproved ? "Approved" : "Due"}
                  </Badge>
                }
              />
              <div className="grid gap-6 px-6 py-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <Kpi label="Inquiries" value={`${performance.inquiries}`} />
                  <Kpi label="Qualified" value={`${performance.qualifiedLeads}`} />
                  <Kpi label="Viewings" value={`${performance.viewings}`} />
                  <Kpi label="Qualified rate" value={`${Math.round(performance.qualifiedRate * 100)}%`} accent />
                  <Kpi label="Viewing rate" value={`${Math.round(performance.viewingRate * 100)}%`} accent />
                </div>

                <div className="rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-5">
                  <p className="bb-mono-label">Demand funnel</p>
                  <div className="mt-4">
                    <DemandFunnel funnel={performance.funnel} />
                  </div>
                </div>

                {performance.trend ? (
                  <div className="rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="bb-mono-label">Trend</p>
                      <p className="text-[12px] text-[#8E918B]">vs {performance.trend.period}</p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <TrendTile
                        label="Inquiries"
                        delta={performance.trend.inquiries}
                        series={performance.series.inquiries}
                      />
                      <TrendTile
                        label="Qualified leads"
                        delta={performance.trend.qualifiedLeads}
                        series={performance.series.qualifiedLeads}
                      />
                      <TrendTile
                        label="Viewings"
                        delta={performance.trend.viewings}
                        series={performance.series.viewings}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            {/* Price positioning — where the ask sits vs comparable listings. */}
            {performance.price ? (
              <Card className="overflow-hidden">
                <CardHeader
                  title="Price positioning"
                  description="Asking price against comparable listings on file."
                  action={
                    <CardHeaderIcon>
                      <Tag className="h-4 w-4" aria-hidden="true" />
                    </CardHeaderIcon>
                  }
                />
                <div className="px-6 pb-6 pt-14">
                  <PriceScale price={performance.price} />
                  <p className="mt-8 text-[14px] leading-7 text-[#5F625E]">{priceVerdict(performance.price)}</p>
                  <ul className="mt-4 grid gap-2.5">
                    {performance.price.comps.map((comp) => (
                      <li
                        key={comp.name}
                        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-[10px] border border-[#E7E7E7] bg-[#F1F2EE] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-[#171719]">{comp.name}</p>
                          <p className="mt-0.5 text-[12px] leading-5 text-[#8E918B]">{comp.note}</p>
                        </div>
                        <span className="font-mono text-[14px] font-semibold tabular-nums text-[#171719]">
                          {formatCurrency(comp.priceEur)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ) : null}

            {/* The deliverable — editable owner-facing draft + actions. */}
            <Card className="overflow-hidden">
              <CardHeader
                title="Owner update draft"
                description="Edit the narrative, then approve and stage the send."
                action={
                  <CardHeaderIcon>
                    <Mail className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <div className="grid gap-5 px-6 py-5">
                <textarea
                  aria-label="Editable owner update draft"
                  className="min-h-[420px] w-full resize-y rounded-[10px] border border-[#D9DAD4] bg-[#fffefc] p-6 text-[15px] leading-8 text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/10"
                  onChange={(event) => setDraftBody(event.target.value)}
                  value={draftBody}
                />

                <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#E7E7E7] bg-[#F1F2EE] p-3">
                  <Button onClick={approveDraft} type="button">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {isApproved ? "Approved" : "Approve report"}
                  </Button>
                  <Button
                    onClick={() => setShowExportPreview((current) => !current)}
                    type="button"
                    variant="secondary"
                  >
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    Export preview
                  </Button>
                  <Button onClick={markSent} type="button" variant="secondary">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {isSent ? "Staged" : "Stage send"}
                  </Button>
                  <Link
                    className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-5 text-sm font-medium text-[#171719] hover:border-[#003C33]"
                    href={`/sellers/${selected.input.sellerId}`}
                  >
                    Open owner context
                  </Link>
                </div>

                {showExportPreview ? (
                  <div className="rounded-[10px] border border-[#E7E7E7] bg-[#F1F2EE] p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E7E7E7] pb-4">
                      <div>
                        <p className="bb-mono-label">Owner report PDF preview</p>
                        <h3 className="bb-display mt-2 text-xl font-medium text-[#171719]">
                          {selected.report.title}
                        </h3>
                      </div>
                      <Button onClick={() => window.print()} type="button" variant="secondary" size="sm">
                        Print / save PDF
                      </Button>
                    </div>
                    <pre className="mt-5 whitespace-pre-wrap font-sans text-[13px] leading-7 text-[#5F625E]">
                      {draftBody}
                    </pre>
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Presentational pieces -------------------------------------------- */

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[12px] border border-[#E7E7E7] bg-white px-2 py-2">
      <p className="font-mono text-[13px] font-semibold tabular-nums text-[#171719]">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[#8E918B]">{label}</p>
    </div>
  );
}

function Kpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[12px] border px-4 py-3",
        accent ? "border-transparent bg-[#F2EADC]" : "border-[#E7E7E7] bg-white",
      )}
    >
      <p className="bb-mono-label">{label}</p>
      <p className="bb-display mt-2 text-[24px] font-medium leading-none tabular-nums text-[#171719]">
        {value}
      </p>
    </div>
  );
}

const FUNNEL_SHADES = ["#003C33", "#1C5E50", "#3F8472"] as const;

function DemandFunnel({ funnel }: { funnel: ReportFunnelStage[] }) {
  return (
    <div className="grid gap-3.5">
      {funnel.map((stage, index) => {
        const widthPct = Math.max(stage.ofTop * 100, stage.value > 0 ? 5 : 0);
        return (
          <div key={stage.label} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-medium text-[#171719]">{stage.label}</span>
              <span className="font-mono text-[13px] font-semibold tabular-nums text-[#171719]">
                {stage.value}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 flex-1 overflow-hidden rounded-[8px] bg-[#F1F2EE]">
                <div
                  className="h-full rounded-[8px] transition-all"
                  style={{ width: `${widthPct}%`, backgroundColor: FUNNEL_SHADES[index] }}
                />
              </div>
              <span className="w-32 shrink-0 text-right text-[12px] text-[#5F625E]">
                {stage.ofPrevious === null
                  ? "Top of funnel"
                  : `${Math.round(stage.ofPrevious * 100)}% of ${index === 1 ? "inquiries" : "qualified"}`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrendTile({
  label,
  delta,
  series,
}: {
  label: string;
  delta: ReportTrendDelta;
  series: number[];
}) {
  return (
    <div className="rounded-[10px] border border-[#E7E7E7] bg-white p-4">
      <p className="bb-mono-label">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="bb-display text-[26px] font-medium leading-none tabular-nums text-[#171719]">
          {delta.current}
        </span>
        <DeltaBadge delta={delta.delta} pct={delta.pct} />
      </div>
      <div className="mt-3">
        <Sparkline values={series} />
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  // viewBox is stretched to the container width (preserveAspectRatio="none")
  // so the line always fills the tile; a non-scaling stroke keeps the line
  // weight crisp regardless of how wide the tile gets.
  const width = 100;
  const height = 30;
  const pad = 2;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(values.length - 1, 1);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const area = `${line} L${last[0].toFixed(1)} ${height - pad} L${first[0].toFixed(1)} ${height - pad} Z`;

  return (
    <svg
      aria-hidden="true"
      className="h-9 w-full"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
    >
      <path d={area} fill="#003C33" opacity="0.08" />
      <path
        d={line}
        fill="none"
        stroke="#003C33"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function DeltaBadge({ delta, pct }: { delta: number; pct: number | null }) {
  const up = delta > 0;
  const down = delta < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const tone = up
    ? "bg-[#E1F1EA] text-[#0F8F62]"
    : down
      ? "bg-[#F0DDD0] text-[#A86642]"
      : "bg-[#F1F2EE] text-[#5F625E]";
  const sign = delta > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "inline-flex min-w-[58px] items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        tone,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {sign}
      {delta}
      {pct !== null ? ` (${sign}${Math.round(pct * 100)}%)` : ""}
    </span>
  );
}

function PriceScale({ price }: { price: ReportPricePosition }) {
  return (
    <div className="relative h-1.5 rounded-full bg-[#E7E7E7]">
      {/* Comparable-listing ticks sit quietly under the headline marker. */}
      {price.comps.map((comp) => (
        <div
          key={comp.name}
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: `${comp.fraction * 100}%` }}
        >
          <span className="block h-3 w-px -translate-x-1/2 bg-[#A9ABA5]" />
          <span className="absolute top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-[#8E918B]">
            {compactEur(comp.priceEur)}
          </span>
        </div>
      ))}
      {/* Asking price — the marker that matters. */}
      <div
        className="absolute top-1/2 z-10"
        style={{ left: `${price.askFraction * 100}%` }}
      >
        <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[#003C33] px-2 py-0.5 text-[11px] font-semibold text-white">
          Asking {compactEur(price.askingEur)}
        </span>
        <span className="block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#003C33] shadow-[0_1px_4px_rgba(0,0,0,0.2)]" />
      </div>
    </div>
  );
}

/* ---- formatting helpers ----------------------------------------------- */

function compactEur(value: number): string {
  if (value >= 1_000_000) {
    return `€${(value / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  }
  if (value >= 1_000) {
    return `€${Math.round(value / 1_000)}k`;
  }
  return `€${value}`;
}

function priceVerdict(price: ReportPricePosition): string {
  if (price.pctVsMedian === null) {
    return "No comparable listings on file yet — add comps to position the asking price.";
  }
  const pct = Math.round(price.pctVsMedian * 100);
  if (Math.abs(pct) < 3) {
    return `Asking ${compactEur(price.askingEur)} is in line with the comp median of ${compactEur(price.median)}.`;
  }
  const direction = pct > 0 ? "above" : "below";
  return `Asking ${compactEur(price.askingEur)} sits ${Math.abs(pct)}% ${direction} the comp median of ${compactEur(price.median)}.`;
}
