"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, FileDown, FilePenLine, FileText, Mail, Send, X } from "lucide-react";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import type { BrokerSegment } from "@/lib/broker-segments";
import { getEditableSellerReports, nowIso } from "@/lib/services";
import type { AuditEvent } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, CardHeaderIcon, PageHeader, WorkflowState } from "./ui";
import { cn } from "@/lib/utils";

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
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() =>
    selected
      ? readPersisted<AuditEvent[]>(`brobroker:reports:${selected.input.id}:audit`, selected.auditTrail)
      : [],
  );
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [sentReportIds, setSentReportIds] = useState<string[]>(() =>
    readPersisted<string[]>("brobroker:reports:sent", []),
  );
  const [pendingAuditRemoval, setPendingAuditRemoval] = useState<AuditEvent | null>(null);

  function createAuditId(reportId: string, action: string) {
    return `audit-${reportId}-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function selectReport(reportId: string) {
    const next = reports.find((report) => report.input.id === reportId);
    setSelectedReportId(reportId);
    setDraftBody(
      next ? readPersisted(`brobroker:reports:${next.input.id}:draft`, next.editableDraft) : "",
    );
    setAuditEvents(
      next
        ? readPersisted<AuditEvent[]>(`brobroker:reports:${next.input.id}:audit`, next.auditTrail)
        : [],
    );
  }

  function editDraft(value: string) {
    if (!selected) return;
    setDraftBody(value);
    setAuditEvents((current) =>
      current.some((event) => event.id === `audit-${selected.input.id}-edited`)
        ? current
        : [
            {
              id: `audit-${selected.input.id}-edited`,
              actor: "Broker",
              label: "Seller report edited",
              detail: "Broker changed the generated owner update before approval.",
              occurredAt: nowIso,
            },
            ...current,
          ],
    );
  }

  function approveDraft() {
    if (!selected) return;
    setApprovedReportIds((current) => {
      const next = [...new Set([selected.input.id, ...current])];
      writePersisted("brobroker:reports:approved", next);
      return next;
    });
    setAuditEvents((current) => [
      {
        id: createAuditId(selected.input.id, "approved"),
        actor: "Broker",
        label: "Seller report approved",
        detail: `${selected.report.title} approved for owner review. No external send is simulated.`,
        occurredAt: nowIso,
      },
      ...current,
    ]);
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
    setAuditEvents((current) => [
      {
        id: createAuditId(selected.input.id, "sent"),
        actor: "Broker",
        label: "Owner update staged for send",
        detail: `${selected.report.title} copied/staged for owner delivery. External sending is still outside the prototype.`,
        occurredAt: nowIso,
      },
      ...current,
    ]);
    mirrorWorkflowEvent("seller_report_staged_for_send", selected.input.id, {
      reportId: selected.input.id,
      draftBody,
    });
  }

  function removeAuditEvent(eventId: string) {
    setAuditEvents((current) => current.filter((event) => event.id !== eventId));
    setPendingAuditRemoval(null);
  }

  useEffect(() => {
    if (!selected) return;
    writePersisted(`brobroker:reports:${selected.input.id}:draft`, draftBody);
    writePersisted(`brobroker:reports:${selected.input.id}:audit`, auditEvents);
  }, [auditEvents, draftBody, selected]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
      <PageHeader
        metrics={[
          { label: "Inquiries", value: selected ? `${selected.input.inquiries}` : "—" },
          { label: "Qualified leads", value: selected ? `${selected.input.qualifiedLeads}` : "—" },
          { label: "Viewings", value: selected ? `${selected.input.viewings}` : "—" },
        ]}
      />

      {!selected ? (
        <div className="mt-12">
          <WorkflowState
            title="No seller reports yet"
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
        <>
          <div className="mt-12 grid items-start gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="grid gap-8">
              <Card className="overflow-hidden">
                <CardHeader
                  title="Reports due"
                  action={
                    <CardHeaderIcon>
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                    </CardHeaderIcon>
                  }
                />
                <ul className="grid gap-2.5 p-4">
                  {reports.map((report) => {
                    const isSelected = selected.input.id === report.input.id;
                    const isApproved = approvedReportIds.includes(report.input.id);

                    return (
                      <li key={report.input.id}>
                        <button
                          className={cn(
                            "block w-full rounded-[10px] border p-4 text-left transition-all hover:border-[#003C33] hover:bg-white",
                            isSelected
                              ? "border-[#003C33] bg-white"
                              : "border-[#E7E7E7] bg-[#F1F2EE]",
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
                            <Badge tone={isApproved ? "success" : "warning"}>
                              {isApproved ? "Approved" : "Due"}
                            </Badge>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-[12px] border border-[#E7E7E7] bg-white px-2 py-2">
                              <p className="font-mono text-[13px] font-semibold text-[#171719]">
                                {report.input.inquiries}
                              </p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[#8E918B]">
                                Inq.
                              </p>
                            </div>
                            <div className="rounded-[12px] border border-[#E7E7E7] bg-white px-2 py-2">
                              <p className="font-mono text-[13px] font-semibold text-[#171719]">
                                {report.input.qualifiedLeads}
                              </p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[#8E918B]">
                                Leads
                              </p>
                            </div>
                            <div className="rounded-[12px] border border-[#E7E7E7] bg-white px-2 py-2">
                              <p className="font-mono text-[13px] font-semibold text-[#171719]">
                                {report.input.viewings}
                              </p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[#8E918B]">
                                Views
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card>
                <div className="border-b border-[#E7E7E7] px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="bb-mono-label">Audit trail</p>
                      <h2 className="bb-display mt-2 text-xl font-medium leading-tight text-[#171719]">
                        Report generation and approval
                      </h2>
                    </div>
                    <CardHeaderIcon>
                      <FilePenLine className="h-4 w-4" aria-hidden="true" />
                    </CardHeaderIcon>
                  </div>
                  {pendingAuditRemoval ? (
                    <div className="mt-4 rounded-[10px] border border-[#F0DDD0] bg-[#F0DDD0] px-4 py-3 text-[13px] leading-6 text-[#A86642]">
                      <p className="font-medium text-[#A86642]">
                        Remove “{pendingAuditRemoval.label}” from the audit trail?
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="inline-flex min-h-8 items-center justify-center rounded-[8px] bg-[#003C33] px-3 text-[12px] font-medium text-white hover:bg-[#0B4A3F]"
                          onClick={() => removeAuditEvent(pendingAuditRemoval.id)}
                          type="button"
                        >
                          Remove entry
                        </button>
                        <button
                          className="inline-flex min-h-8 items-center justify-center rounded-[8px] border border-[#F0DDD0] bg-white px-3 text-[12px] font-medium text-[#A86642] hover:border-[#A86642]"
                          onClick={() => setPendingAuditRemoval(null)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <ul className="grid gap-0 divide-y divide-[#E7E7E7]">
                  {auditEvents.map((event) => (
                    <li key={event.id} className="grid gap-3 px-6 py-5 sm:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={event.actor === "Broker" ? "success" : "neutral"}>
                            {event.actor}
                          </Badge>
                          <span className="text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                            {formatDate(event.occurredAt)}
                          </span>
                        </div>
                        <h2 className="mt-2 text-[14px] font-medium text-[#171719]">{event.label}</h2>
                        <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">{event.detail}</p>
                      </div>
                      <button
                        aria-label={`Remove audit entry: ${event.label}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#A9ABA5] transition-colors hover:bg-[#FBFBFB] hover:text-[#171719]"
                        onClick={() => setPendingAuditRemoval(event)}
                        type="button"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="grid gap-8">
              <Card className="overflow-hidden">
              <CardHeader
                title={selected.report.title}
                description={`${selected.seller?.name ?? "Owner"} · ${selected.input.period}`}
                action={
                  <CardHeaderIcon>
                    <Mail className="h-4 w-4" aria-hidden="true" />
                  </CardHeaderIcon>
                }
              />
              <div className="grid gap-5 px-6 py-5">
                <div className="grid gap-3 rounded-[10px] border border-[#E7E7E7] bg-[#F1F2EE] p-4 sm:grid-cols-3">
                  <ReportStat label="Inquiries" value={`${selected.input.inquiries}`} />
                  <ReportStat label="Qualified" value={`${selected.input.qualifiedLeads}`} />
                  <ReportStat label="Viewings" value={`${selected.input.viewings}`} />
                </div>

                <textarea
                  aria-label="Editable seller report draft"
                  className="min-h-[460px] w-full resize-y rounded-[10px] border border-[#D9DAD4] bg-[#fffefc] p-6 text-[15px] leading-8 text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/10"
                  onChange={(event) => editDraft(event.target.value)}
                  value={draftBody}
                />

                <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#E7E7E7] bg-[#F1F2EE] p-3">
                  <Button onClick={approveDraft} type="button">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {approvedReportIds.includes(selected.input.id) ? "Approved" : "Approve report"}
                  </Button>
                  <Button onClick={() => setShowExportPreview((current) => !current)} type="button" variant="secondary">
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    Export preview
                  </Button>
                  <Button onClick={markSent} type="button" variant="secondary">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {sentReportIds.includes(selected.input.id) ? "Staged" : "Stage send"}
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

              <Card>
                <CardHeader
                  title="Source activity and plan"
                  action={
                    <CardHeaderIcon>
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    </CardHeaderIcon>
                  }
                />
                <div className="grid gap-4 p-6 sm:grid-cols-2">
                  {selected.report.sections.map((section) => (
                    <div key={section.label} className="rounded-[10px] border border-[#E7E7E7] bg-[#F1F2EE] p-5">
                      <p className="bb-mono-label">{section.label}</p>
                      <p className="mt-3 text-[14px] leading-7 text-[#5F625E]">{section.value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[#E7E7E7] bg-white px-4 py-3">
      <p className="bb-mono-label">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold text-[#171719]">{value}</p>
    </div>
  );
}
