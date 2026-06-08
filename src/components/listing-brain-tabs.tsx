"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Gauge,
  ListChecks,
  MessageSquareText,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { BrokerTask, SellerProfile, YachtListing } from "@/lib/types";
import { formatSpecSheet } from "@/lib/spec-format";
import { cn, formatDate, percentage } from "@/lib/utils";
import { Badge, CardHeader, EmptyState, ProgressBar } from "./ui";

export type ListingBrainTab = "Overview" | "Docs" | "Owner";

const listingBrainTabs: Array<{ label: ListingBrainTab; value: string }> = [
  { label: "Overview", value: "overview" },
  { label: "Docs", value: "docs" },
  { label: "Owner", value: "owner" },
];

type DocumentCompleteness = {
  approved: number;
  total: number;
  percent: number;
  missingCount: number;
};

export function resolveListingBrainTab(value?: string): ListingBrainTab {
  const normalized = value?.toLowerCase();
  return listingBrainTabs.find((tab) => tab.value === normalized)?.label ?? "Overview";
}

export function ListingBrainTabs({
  coreFacts,
  documentCompleteness,
  initialTab,
  listing,
  ownerTasks,
  seller,
}: {
  coreFacts: Array<[string, string]>;
  documentCompleteness: DocumentCompleteness;
  initialTab?: string;
  listing: YachtListing;
  ownerTasks: BrokerTask[];
  seller?: SellerProfile;
}) {
  const [activeTab, setActiveTab] = useState<ListingBrainTab>(() => resolveListingBrainTab(initialTab));
  const activeTabValue = listingBrainTabs.find((tab) => tab.label === activeTab)?.value ?? "overview";

  useEffect(() => {
    const handlePopState = () => {
      const tab = new URLSearchParams(window.location.search).get("tab") ?? undefined;
      setActiveTab(resolveListingBrainTab(tab));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function switchTab(nextTab: ListingBrainTab) {
    if (nextTab === activeTab) return;

    setActiveTab(nextTab);

    const nextValue = listingBrainTabs.find((tab) => tab.label === nextTab)?.value ?? "overview";
    const url = new URL(window.location.href);
    if (nextValue === "overview") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", nextValue);
    }
    window.history.pushState({ listingBrainTab: nextValue }, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const content = useMemo(() => {
    if (activeTab === "Docs") {
      return <ListingDocsPanel documentCompleteness={documentCompleteness} listing={listing} />;
    }

    if (activeTab === "Owner") {
      return <ListingOwnerPanel listing={listing} ownerTasks={ownerTasks} seller={seller} />;
    }

    return <ListingOverviewPanel coreFacts={coreFacts} listing={listing} seller={seller} />;
  }, [activeTab, coreFacts, documentCompleteness, listing, ownerTasks, seller]);

  return (
    <>
      <CardHeader
        eyebrow="Listing brain"
        title="Facts, documents, and missing intelligence"
        action={<ListingBrainTabNav active={activeTab} onChange={switchTab} />}
      />
      <AnimatedTabPanel panelKey={activeTabValue}>{content}</AnimatedTabPanel>
    </>
  );
}

function ListingBrainTabNav({
  active,
  onChange,
}: {
  active: ListingBrainTab;
  onChange: (tab: ListingBrainTab) => void;
}) {
  return (
    <div
      aria-label="Listing brain sections"
      className="inline-flex items-center gap-1 rounded-[8px] border border-[#D9DAD4] bg-white p-1"
      role="tablist"
    >
      {listingBrainTabs.map((tab) => {
        const isActive = active === tab.label;

        return (
          <button
            aria-selected={isActive}
            className={cn(
              "min-h-8 rounded-[8px] px-3 text-[13px] font-medium transition-[background-color,color,transform] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]",
              isActive
                ? "bg-[#171719] text-white"
                : "text-[#5F625E] hover:bg-[#F1F2EE] hover:text-[#171719]",
            )}
            key={tab.value}
            onClick={() => onChange(tab.label)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function AnimatedTabPanel({
  children,
  panelKey,
}: {
  children: ReactNode;
  panelKey: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;

    const updateHeight = () => setHeight(panel.scrollHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [panelKey]);

  return (
    <div
      className="overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      style={height ? { height } : undefined}
    >
      <div className="bb-tab-panel-enter" key={panelKey} ref={panelRef}>
        {children}
      </div>
    </div>
  );
}

function ListingOverviewPanel({
  coreFacts,
  listing,
  seller,
}: {
  coreFacts: Array<[string, string]>;
  listing: YachtListing;
  seller?: SellerProfile;
}) {
  const approvedDocuments = listing.documents.filter((document) => document.status === "Approved");

  return (
    <div className="grid gap-0">
      <div className="grid gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="min-w-0">
          <PanelKicker icon={Gauge} title="Core specs" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {coreFacts.slice(0, 6).map(([label, value]) => (
              <FactTile key={label} label={label} value={value} />
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-[12px] bg-[#FBFBFB] p-4">
          <PanelKicker icon={MessageSquareText} title="Owner snapshot" />
          <h3 className="mt-3 text-[16px] font-semibold text-[#171719]">
            {seller?.name ?? "Owner not recorded"}
          </h3>
          <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">
            {seller?.motivation ?? "Connect this listing to a seller profile to add motivation and cadence."}
          </p>
          <div className="mt-4 grid gap-2">
            <MiniRow label="Cadence" value={seller?.reportingCadence ?? "Not recorded"} />
            <MiniRow label="Ideal buyer" value={listing.idealBuyer} />
          </div>
        </section>
      </div>

      {listing.description || listing.specifications ? (
        <div className="grid gap-5 border-t border-[#E7E7E7] px-6 py-5 lg:grid-cols-2">
          {listing.description ? (
            <ProseBlock icon={ScrollText} text={listing.description} title="Description" />
          ) : null}
          {listing.specifications ? (
            <SpecSheet
              icon={ListChecks}
              text={listing.specifications}
              title="Specifications & equipment"
            />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 border-t border-[#E7E7E7] px-6 py-5 lg:grid-cols-3">
        <CompactSignalCard
          icon={FileText}
          items={approvedDocuments.map((document) => document.title)}
          title="Approved documents"
        />
        <CompactSignalCard icon={Sparkles} items={listing.refitHistory} title="History and upgrades" />
        <CompactSignalCard
          icon={AlertTriangle}
          items={listing.missingInfo.length ? listing.missingInfo : ["No gaps flagged"]}
          title="Missing intelligence"
          tone="warning"
        />
      </div>
    </div>
  );
}

function ListingDocsPanel({
  documentCompleteness,
  listing,
}: {
  documentCompleteness: DocumentCompleteness;
  listing: YachtListing;
}) {
  const approvedDocuments = listing.documents.filter((document) => document.status === "Approved");
  const restrictedDocuments = listing.documents.filter(
    (document) => document.status === "Internal" || document.status === "Restricted",
  );

  return (
    <div className="grid gap-6 px-6 py-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
      <section className="min-w-0">
        <div className="rounded-[12px] bg-[#FBFBFB] p-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(130px,0.55fr)_minmax(0,1fr)] sm:items-center">
            <div>
              <p className="bb-mono-label">Readiness</p>
              <p className="mt-2 font-mono text-[2rem] font-semibold leading-none text-[#171719]">
                {percentage(documentCompleteness.percent)}
              </p>
              <p className="mt-2 text-[12px] leading-5 text-[#8E918B]">
                {documentCompleteness.approved} ready · {documentCompleteness.missingCount} gaps
              </p>
            </div>
            <div className="min-w-0">
              <ProgressBar className="h-2" value={documentCompleteness.percent} />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <ReadinessStat label="Ready docs" value={`${documentCompleteness.approved}/${listing.documents.length}`} />
                <ReadinessStat label="Open gaps" value={`${documentCompleteness.missingCount}`} />
                <ReadinessStat label="Total inputs" value={`${documentCompleteness.total}`} />
              </div>
            </div>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-[#E7E7E7] rounded-[12px] border border-[#E7E7E7] bg-white">
          {listing.documents.map((document) => (
            <li
              className="grid gap-3 px-4 py-4 sm:grid-cols-[36px_minmax(0,1fr)_auto] sm:items-center"
              key={document.id}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F1F2EE] text-[#003C33]">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[14px] font-medium text-[#171719]">{document.title}</h3>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#8E918B]">
                  {document.category} · {formatDate(document.updatedAt)}
                </p>
              </div>
              <Badge tone={documentTone(document.status)}>{document.status}</Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid content-start gap-4">
        <DocumentSection
          icon={AlertTriangle}
          items={listing.missingInfo.length ? listing.missingInfo : ["No missing facts flagged"]}
          title="Missing facts"
          tone="warning"
        />
        <DocumentSection
          icon={CheckCircle2}
          items={approvedDocuments.length ? approvedDocuments.map((document) => document.title) : ["No approved share documents yet"]}
          title="Buyer-safe share set"
          tone="success"
        />
        <DocumentSection
          icon={ShieldCheck}
          items={restrictedDocuments.length ? restrictedDocuments.map((document) => `${document.title} · ${document.status}`) : ["No restricted documents marked"]}
          title="Restricted or internal"
          tone="info"
        />
      </section>
    </div>
  );
}

function ListingOwnerPanel({
  listing,
  ownerTasks,
  seller,
}: {
  listing: YachtListing;
  ownerTasks: BrokerTask[];
  seller?: SellerProfile;
}) {
  if (!seller) {
    return (
      <div className="px-6 py-5">
        <EmptyState
          title="Owner not recorded"
          description="Connect this listing to a seller profile to unlock owner cadence, reporting, and private notes."
        />
      </div>
    );
  }

  const hasOwnerRoute = !seller.id.startsWith("seller-listing-");

  return (
    <div className="grid gap-0">
      <div className="grid gap-5 px-6 py-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="min-w-0">
          <PanelKicker icon={MessageSquareText} title="Owner profile" />
          <h3 className="mt-3 text-[18px] font-semibold text-[#171719]">{seller.name}</h3>
          <div className="mt-4 grid gap-2">
            <MiniRow label="Motivation" value={seller.motivation} />
            <MiniRow label="Pricing posture" value={seller.pricingSensitivity} />
            <MiniRow label="Next update" value={formatDate(seller.nextOwnerUpdateDueAt)} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {hasOwnerRoute ? (
              <Link
                className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#171719] bg-[#003C33] px-4 text-[13px] font-medium text-white hover:bg-[#0B4A3F]"
                href={`/sellers/${seller.id}`}
              >
                Open owner context
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
            <Link
              className="inline-flex min-h-9 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] hover:border-[#003C33]"
              href="/reports"
            >
              Open owner reports
            </Link>
          </div>
        </section>

        <section className="min-w-0 rounded-[12px] bg-[#FBFBFB] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <PanelKicker icon={Gauge} title="Communication expectation" />
            <Badge tone={ownerTasks.length ? "warning" : "success"}>
              {ownerTasks.length ? `${ownerTasks.length} open tasks` : "Cadence clear"}
            </Badge>
          </div>
          <p className="mt-3 text-[14px] leading-7 text-[#5F625E]">{seller.communicationExpectation}</p>
          <p className="mt-4 text-[13px] leading-6 text-[#8E918B]">
            Review this before owner reporting so buyer names, price sensitivity, and private context stay controlled.
          </p>
        </section>
      </div>

      <div className="grid gap-4 border-t border-[#E7E7E7] px-6 py-5 lg:grid-cols-3">
        <CompactSignalCard icon={MessageSquareText} items={listing.ownerNotes} title="Owner notes" />
        <CompactSignalCard icon={ShieldCheck} items={listing.brokerOnlyNotes} title="Broker-only notes" />
        <CompactSignalCard icon={Gauge} items={listing.marketSignals} title="Market signals" />
      </div>

      <div className="grid gap-4 border-t border-[#E7E7E7] px-6 py-5 lg:grid-cols-2">
        <CompactSignalCard icon={FileText} items={seller.feedbackHistory} title="Owner feedback history" />
        <CompactSignalCard
          icon={AlertTriangle}
          items={ownerTasks.length ? ownerTasks.map((task) => `${task.title} · ${task.priority}`) : ["No open owner tasks for this listing"]}
          title="Open owner tasks"
          tone={ownerTasks.length ? "warning" : "neutral"}
        />
      </div>
    </div>
  );
}

function PanelKicker({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-[#003C33]" aria-hidden="true" />
      <p className="bb-mono-label">{title}</p>
    </div>
  );
}

/* Long free-text block (description). Preserves the source line breaks and
   stays scannable with a soft surface + capped height. */
function ProseBlock({ icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <section className="min-w-0 rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-4">
      <PanelKicker icon={icon} title={title} />
      <p className="mt-3 max-h-72 overflow-y-auto whitespace-pre-line text-[13px] leading-6 text-[#5F625E]">
        {text}
      </p>
    </section>
  );
}

/* Structured spec/equipment sheet — turns the raw PDF specs text into headed
   sections with key/value rows and bullet lists. Same surface + height as the
   description block so the two read as a pair. */
function SpecSheet({ icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  const sections = formatSpecSheet(text);

  return (
    <section className="min-w-0 rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-4">
      <PanelKicker icon={icon} title={title} />
      <div className="mt-3 max-h-72 space-y-4 overflow-y-auto pr-1">
        {sections.length === 0 ? (
          <p className="whitespace-pre-line text-[13px] leading-6 text-[#5F625E]">{text}</p>
        ) : (
          sections.map((section, index) => (
            <div key={`${section.title}-${index}`}>
              {section.title ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#171719]">
                  {section.title}
                </p>
              ) : null}
              {section.rows.length ? (
                <dl className="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1">
                  {section.rows.map((row, rowIndex) => (
                    <Fragment key={`${row.label}-${rowIndex}`}>
                      <dt className="text-[13px] text-[#8E918B]">{row.label}</dt>
                      <dd className="text-[13px] font-medium text-[#2f2f37]">{row.value}</dd>
                    </Fragment>
                  ))}
                </dl>
              ) : null}
              {section.bullets.length ? (
                <ul className="mt-2 grid gap-1.5">
                  {section.bullets.map((bullet, bulletIndex) => (
                    <li
                      key={`${bullet}-${bulletIndex}`}
                      className="flex gap-2 text-[13px] leading-6 text-[#5F625E]"
                    >
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#A9ABA5]" />
                      <span className="min-w-0">{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.paragraph ? (
                <p className="mt-2 text-[13px] leading-6 text-[#5F625E]">{section.paragraph}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[#E7E7E7] bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">{label}</p>
      <p className="mt-2 line-clamp-3 text-[14px] font-medium leading-6 text-[#2f2f37]">{value}</p>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 text-[13px] sm:grid-cols-[120px_minmax(0,1fr)]">
      <span className="text-[#8E918B]">{label}</span>
      <span className="leading-6 text-[#5F625E]">{value}</span>
    </div>
  );
}

function CompactSignalCard({
  icon: Icon,
  items,
  title,
  tone = "neutral",
}: {
  icon: LucideIcon;
  items: string[];
  title: string;
  tone?: "neutral" | "warning";
}) {
  const visibleItems = items.length ? items.slice(0, 3) : ["Nothing recorded yet"];
  const remainingCount = Math.max(0, items.length - visibleItems.length);

  return (
    <section className="min-w-0 rounded-[12px] border border-[#E7E7E7] bg-white p-4">
      <PanelKicker icon={Icon} title={title} />
      <ul className="mt-3 grid gap-2">
        {visibleItems.map((item) => (
          <li
            className={cn(
              "rounded-[12px] px-3 py-2 text-[13px] leading-6 text-[#5F625E]",
              tone === "warning" ? "bg-[#F0DDD0]" : "bg-[#F1F2EE]",
            )}
            key={item}
          >
            {item}
          </li>
        ))}
      </ul>
      {remainingCount ? (
        <p className="mt-3 text-[12px] font-medium text-[#8E918B]">+{remainingCount} more</p>
      ) : null}
    </section>
  );
}

function ReadinessStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-white px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">{label}</p>
      <p className="mt-1 font-mono text-[14px] font-semibold text-[#171719]">{value}</p>
    </div>
  );
}

function DocumentSection({
  icon: Icon,
  items,
  title,
  tone,
}: {
  icon: LucideIcon;
  items: string[];
  title: string;
  tone: "success" | "warning" | "info";
}) {
  const iconColor =
    tone === "success" ? "text-[#0F8F62]" : tone === "warning" ? "text-[#A86642]" : "text-[#003C33]";

  return (
    <section className="min-w-0 rounded-[12px] border border-[#E7E7E7] bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} aria-hidden="true" />
        <p className="bb-mono-label">{title}</p>
      </div>
      <ul className="mt-3 grid gap-2">
        {items.slice(0, 4).map((item) => (
          <li className="rounded-[12px] bg-[#F1F2EE] px-3 py-2 text-[13px] leading-6 text-[#5F625E]" key={item}>
            {item}
          </li>
        ))}
      </ul>
      {items.length > 4 ? (
        <p className="mt-3 text-[12px] font-medium text-[#8E918B]">+{items.length - 4} more</p>
      ) : null}
    </section>
  );
}

function documentTone(
  status: YachtListing["documents"][number]["status"],
): "success" | "warning" | "error" | "info" | "neutral" {
  if (status === "Approved") return "success";
  if (status === "Missing") return "error";
  if (status === "Restricted") return "warning";
  if (status === "Internal") return "info";
  return "neutral";
}
