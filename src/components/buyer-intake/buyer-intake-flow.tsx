"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FilePlusIcon, MagicWandIcon, PersonIcon } from "@radix-ui/react-icons";
import { type BrokerSegment } from "@/lib/broker-segments";
import {
  generateBuyerSummary,
  getBuyerDraftValuesFromProfile,
  getBuyerIntakeConfig,
  getInitialBuyerDraftValues,
  getSegmentLabel,
  normalizeBuyerSource,
  normalizeBuyerStage,
  normalizeBuyerUrgency,
  readList,
  readRange,
  readRangeNumbers,
  readText,
  type BuyerDraftValue,
  type BuyerDraftValues,
  type BuyerField,
  type BuyerIntakeSection,
} from "@/lib/buyer-intake-config";
import { saveSessionBuyer } from "@/lib/browser-persistence";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { BuyerProfile } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { ToastViewport } from "@/components/app-feedback";
import { DatePicker } from "@/components/date-picker";
import { SelectMenu } from "@/components/select-menu";
import { Badge, Button, Card, CardHeader, TextInput } from "@/components/ui";

type SaveResult = {
  id: string;
  storage: "database" | "local";
  isDraft: boolean;
  savedAt: string;
};

export function BuyerIntakeFlow({
  initialSegment,
  editingBuyer,
}: {
  initialSegment: BrokerSegment;
  editingBuyer?: BuyerProfile;
}) {
  const router = useRouter();
  const segment = initialSegment;
  const isEditing = Boolean(editingBuyer);
  const [values, setValues] = useState<BuyerDraftValues>(() =>
    editingBuyer
      ? getBuyerDraftValuesFromProfile(segment, editingBuyer)
      : getInitialBuyerDraftValues(segment),
  );
  // When editing an active buyer, default to saving as an active update — not a
  // draft. New buyers still start as drafts.
  const [saveAsDraft, setSaveAsDraft] = useState(
    editingBuyer ? editingBuyer.currentStage === "New Inquiry" && editingBuyer.tags.includes("draft") : true,
  );
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const config = getBuyerIntakeConfig(segment);
  const [activeTab, setActiveTab] = useState(config.sections[0]?.id ?? "");
  const activeSection =
    config.sections.find((section) => section.id === activeTab) ?? config.sections[0];
  const requiredFields = config.sections.flatMap((section) =>
    section.fields.filter((field) => field.required),
  );
  const completedRequired = requiredFields.filter((field) => isFieldComplete(values, field)).length;
  const completion = requiredFields.length
    ? Math.round((completedRequired / requiredFields.length) * 100)
    : 100;
  const [budgetMin, budgetMax] = readRangeNumbers(values, "budgetRange");
  const [metricMin, metricMax] = readRangeNumbers(values, "metricRange");
  const summary = generateBuyerSummary(segment, values);
  const buyerName = readText(values, "name") || "New buyer";

  function updateField(id: string, value: BuyerDraftValue) {
    setValues((current) => ({ ...current, [id]: value }));
  }

  async function saveBuyer() {
    setIsSaving(true);
    setSaveError(null);
    setSaveResult(null);

    const buyerId =
      editingBuyer?.id ??
      `buyer-${segment.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID()}`;
    const createdAt = editingBuyer?.lastContactedAt
      ? new Date(editingBuyer.lastContactedAt).toISOString()
      : new Date().toISOString();
    const relationshipNotes = readList(values, "relationshipNotes");
    const buyer = buildBuyerProfile({
      id: buyerId,
      segment,
      values,
      isDraft: saveAsDraft,
      createdAt,
    });

    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Sign in before saving this buyer to your workspace.");
        }

        // upsert works for both create (new buyer) and edit (existing id).
        const { error } = await supabase.from("buyers").upsert({
          id: buyerId,
          owner_user_id: user.id,
          name: buyer.name,
          company: buyer.company ?? null,
          country: buyer.country,
          budget_min_eur: buyer.budgetMinEur,
          budget_max_eur: buyer.budgetMaxEur,
          stage: buyer.currentStage,
          urgency: buyer.urgency,
          verification_case_id: buyer.verificationCaseId || null,
          next_action_due_at: buyer.nextActionDueAt,
          tags: buyer.tags,
          source: buyer.source ?? null,
          preferences: {
            assetTypes: buyer.assetTypes,
            metricLabel: config.metricLabel,
            metricTitle: config.metricTitle,
            sizeRangeFt: buyer.sizeRangeFt,
            preferredBrands: buyer.preferredBrands,
            preferredLocations: buyer.preferredLocations,
            lifestylePreferences: buyer.lifestylePreferences,
            mustHaves: buyer.mustHaves,
            dealBreakers: buyer.dealBreakers,
            objections: buyer.objections,
            decisionTimeline: buyer.decisionTimeline,
            communicationStyle: buyer.communicationStyle,
            lastContactedAt: buyer.lastContactedAt,
          },
          rejected_assets: buyer.rejectedAssets,
          relationship_notes: buyer.relationshipNotes,
          payload: {
            source: "buyer-intake",
            segment,
            isDraft: saveAsDraft,
            summary,
            fields: values,
          },
        });

        if (error) throw new Error(error.message);

        setSaveResult({ id: buyerId, storage: "database", isDraft: saveAsDraft, savedAt: createdAt });
        router.refresh();
        if (isEditing) {
          router.push(`/buyers/${buyerId}`);
        }
        return;
      }

      saveSessionBuyer({
        id: buyerId,
        name: buyer.name,
        source: "Manual",
        summary: relationshipNotes[0] || `${buyer.name} captured with ${buyer.preferredBrands.length + buyer.preferredLocations.length + buyer.mustHaves.length} remembered criteria.`,
        budgetLabel: budgetMax ? `Budget up to ${formatCurrency(budgetMax)}` : "Budget to confirm",
        urgency: buyer.urgency,
        createdAt,
      });
      setSaveResult({ id: buyerId, storage: "local", isDraft: saveAsDraft, savedAt: createdAt });
      if (isEditing) {
        router.push(`/buyers/${buyerId}`);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save this buyer.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <ToastViewport
        action={
          saveResult?.storage === "database" ? (
            <Link className="font-semibold text-[#003C33] underline underline-offset-4" href={`/buyers/${saveResult.id}`}>
              Open buyer memory
            </Link>
          ) : (
            <Link className="font-semibold text-[#003C33] underline underline-offset-4" href="/buyers">
              Back to buyers
            </Link>
          )
        }
        message={
          saveResult
            ? saveResult.storage === "database"
              ? isEditing
                ? "Buyer updated."
                : saveResult.isDraft
                  ? "Buyer draft saved."
                  : "Buyer created."
              : isEditing
                ? "Buyer changes saved on this device. Sign in to sync with your workspace."
                : "Buyer saved on this device. Sign in to keep it with your workspace."
            : null
        }
        onDismiss={() => setSaveResult(null)}
      />

      {/* Back-link removed — breadcrumb in the top bar covers navigation. */}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="grid gap-6">
          <Card>
            <div className="border-b border-[#E7E7E7] px-6 py-5">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold leading-tight text-[#171719]">
                  {isEditing && editingBuyer ? `Edit ${editingBuyer.name}` : config.title}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#5F625E]">
                  {isEditing
                    ? "Update criteria, urgency, or relationship memory. Saved changes overwrite the existing profile."
                    : config.description}
                </p>
              </div>

              <div className="mt-5">
                <BuyerIntakeTabs
                  activeTab={activeTab}
                  onChange={setActiveTab}
                  sections={config.sections}
                />
              </div>
            </div>

            {activeSection ? (
              <>
                <CardHeader
                  eyebrow={activeSection.eyebrow}
                  title={activeSection.title}
                  description={activeSection.description}
                />
                <div
                  className={cn(
                    "grid gap-5 px-6 py-5",
                    activeSection.id === "criteria" ? "lg:grid-cols-2" : "lg:grid-cols-3",
                  )}
                >
                  {activeSection.fields.map((field) => (
                    <FieldControl
                      columnCount={activeSection.id === "criteria" ? 2 : 3}
                      field={field}
                      key={field.id}
                      onChange={(value) => updateField(field.id, value)}
                      value={values[field.id]}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </Card>
        </div>

        <aside className="grid gap-5 xl:sticky xl:top-28">
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <p className="bb-mono-label">Buyer summary</p>
              <Badge tone={completion === 100 ? "success" : "info"}>{completion}% complete</Badge>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#003C33] text-white">
                <PersonIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="bb-display text-2xl font-medium leading-tight text-[#171719]">
                  {buyerName}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#5F625E]">
                  {summary || "Complete core fields to generate a buyer-ready memory summary."}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 border-y border-[#E7E7E7] py-5">
              <SummaryLine label="Segment" value={getSegmentLabel(segment)} />
              <SummaryLine
                label="Budget"
                value={budgetMax ? `${formatCurrency(budgetMin)} - ${formatCurrency(budgetMax)}` : "To confirm"}
              />
              <SummaryLine
                label={config.metricTitle}
                value={metricMax ? `${metricMin}-${metricMax} ${config.metricLabel}` : "To confirm"}
              />
              <SummaryLine label="Urgency" value={readText(values, "urgency") || "To confirm"} />
              <SummaryLine label="Save mode" value={saveAsDraft ? "Draft" : "Active buyer"} />
              <SummaryLine label="Required fields" value={`${completedRequired}/${requiredFields.length}`} />
            </dl>
            <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-[8px] border border-[#E7E7E7] bg-[#F1F2EE] p-4">
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[#171719]">Save as draft</span>
                <span className="mt-1 block text-[12px] leading-5 text-[#5F625E]">
                  Drafts stay internal; turn this off to create an active buyer memory.
                </span>
              </span>
              <input
                checked={saveAsDraft}
                className="peer sr-only"
                onChange={(event) => setSaveAsDraft(event.target.checked)}
                type="checkbox"
              />
              <span
                aria-hidden="true"
                className="relative h-7 w-12 shrink-0 rounded-full bg-[#D9DAD4] transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[#003C33] peer-checked:after:translate-x-5"
              />
            </label>
            <Button className="mt-4 w-full" disabled={isSaving} onClick={saveBuyer} type="button">
              <FilePlusIcon className="h-4 w-4" aria-hidden="true" />
              {isSaving
                ? "Saving..."
                : isEditing
                  ? "Save changes"
                  : saveAsDraft
                    ? "Save buyer draft"
                    : "Create buyer"}
            </Button>
            {saveError ? (
              <div className="mt-4 rounded-[8px] bg-red-50 px-4 py-3 text-[13px] leading-6 text-red-700">
                {saveError}
              </div>
            ) : (
              <div className="mt-4 flex gap-2 rounded-[8px] border border-[#E7E7E7] bg-[#FBFBFB] px-4 py-3 text-[13px] leading-6 text-[#5F625E]">
                <MagicWandIcon className="mt-1 h-4 w-4 shrink-0 text-[#003C33]" aria-hidden="true" />
                <span>Saved buyers become rich cards and memory pages for this broker account.</span>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function FieldControl({
  columnCount,
  field,
  value,
  onChange,
}: {
  columnCount: 2 | 3;
  field: BuyerField;
  value: BuyerDraftValue | undefined;
  onChange: (value: BuyerDraftValue) => void;
}) {
  const stringValue = typeof value === "string" ? value : "";
  const wideClassName = columnCount === 2 ? "lg:col-span-2" : "lg:col-span-3";

  if (field.kind === "range") {
    const rangeValue = readRange({ [field.id]: value ?? { from: "", to: "" } }, field.id);
    const isCurrencyRange = field.id === "budgetRange";

    return (
      <fieldset className={cn("grid", field.wide && wideClassName)}>
        <legend className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">{field.label}</legend>
        <div className="mt-2 grid h-10 grid-cols-2 overflow-hidden rounded-[8px] border border-[#D9DAD4] bg-white">
          <input
            className="h-10 min-h-0 min-w-0 border-r border-[#E7E7E7] px-3 text-[14px] leading-none text-[#171719] outline-none placeholder:text-[#A9ABA5]"
            inputMode={isCurrencyRange ? "decimal" : "numeric"}
            onChange={(event) => onChange({ ...rangeValue, from: formatIntakeNumber(event.target.value, isCurrencyRange) })}
            placeholder={formatIntakeNumber(field.fromPlaceholder ?? "From", isCurrencyRange)}
            value={formatIntakeNumber(rangeValue.from, isCurrencyRange)}
          />
          <input
            className="h-10 min-h-0 min-w-0 px-3 text-[14px] leading-none text-[#171719] outline-none placeholder:text-[#A9ABA5]"
            inputMode={isCurrencyRange ? "decimal" : "numeric"}
            onChange={(event) => onChange({ ...rangeValue, to: formatIntakeNumber(event.target.value, isCurrencyRange) })}
            placeholder={formatIntakeNumber(field.toPlaceholder ?? "To", isCurrencyRange)}
            value={formatIntakeNumber(rangeValue.to, isCurrencyRange)}
          />
        </div>
        {field.helper ? <p className="mt-1.5 text-xs font-normal text-[#8E918B]">{field.helper}</p> : null}
      </fieldset>
    );
  }

  if (field.kind === "select") {
    return (
      <SelectMenu
        className={field.wide ? wideClassName : undefined}
        buttonClassName="!h-10 !min-h-10 !rounded-[8px] !px-3 !py-0 !text-[14px]"
        label={field.label}
        onChange={(nextValue) => onChange(nextValue)}
        options={field.options ?? []}
        value={stringValue || field.options?.[0]?.value || ""}
      />
    );
  }

  if (field.kind === "textarea") {
    return (
      <label className={cn("grid gap-1.5", field.wide && wideClassName)}>
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">{field.label}</span>
        <textarea
          className="min-h-24 rounded-[8px] border border-[#D9DAD4] bg-white px-3 py-2.5 text-[14px] text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          value={stringValue}
        />
        {field.helper ? <span className="text-xs font-normal text-[#8E918B]">{field.helper}</span> : null}
      </label>
    );
  }

  if (field.kind === "date") {
    return (
      <DatePicker
        className={cn("text-[13px]", field.wide && wideClassName)}
        label={field.label}
        onChange={onChange}
        value={stringValue}
      />
    );
  }

  return (
    <TextInput
      className={cn("text-[13px]", field.wide && wideClassName)}
      helper={field.helper}
      inputMode={field.kind === "number" ? "numeric" : undefined}
      inputClassName="!h-10 !min-h-10 !rounded-[8px] !px-3 !text-[14px] !leading-none"
      label={field.label}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      type="text"
      value={stringValue}
    />
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="bb-mono-label">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-[#171719]">{value}</dd>
    </div>
  );
}

function formatIntakeNumber(value: string, shouldFormat: boolean) {
  if (!shouldFormat) return value;
  const normalized = value.replace(/[^\d.]/g, "");
  if (!normalized) return "";
  const [integer = "", ...decimalParts] = normalized.split(".");
  const formattedInteger = integer.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimal = decimalParts.join("");
  return decimalParts.length ? `${formattedInteger || "0"}.${decimal}` : formattedInteger;
}

const BUYER_TAB_LABELS: Record<string, string> = {
  identity: "Identity",
  criteria: "Criteria",
  relationship: "Relationship",
};

function BuyerIntakeTabs({
  activeTab,
  onChange,
  sections,
}: {
  activeTab: string;
  onChange: (next: string) => void;
  sections: BuyerIntakeSection[];
}) {
  return (
    <nav
      aria-label="Buyer intake section"
      className="grid w-full max-w-full gap-1 rounded-[8px] border border-[#D9DAD4] bg-white p-1"
      style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}
    >
      {sections.map((section) => {
        const active = activeTab === section.id;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "inline-flex min-h-9 min-w-0 items-center justify-center rounded-[8px] px-2 py-1.5 text-center text-[12.5px] font-medium leading-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]",
              active ? "bg-[#171719] text-white" : "text-[#5F625E] hover:bg-[#F1F2EE]",
            )}
            key={section.id}
            onClick={() => onChange(section.id)}
            type="button"
          >
            {BUYER_TAB_LABELS[section.id] ?? section.title}
          </button>
        );
      })}
    </nav>
  );
}

function isFieldComplete(values: BuyerDraftValues, field: BuyerField) {
  if (field.kind === "range") {
    const range = readRange(values, field.id);
    return Boolean(range.from.trim() && range.to.trim());
  }

  return Boolean(readText(values, field.id));
}

function buildBuyerProfile({
  id,
  segment,
  values,
  isDraft,
  createdAt,
}: {
  id: string;
  segment: BrokerSegment;
  values: BuyerDraftValues;
  isDraft: boolean;
  createdAt: string;
}): BuyerProfile {
  const [budgetMinEur, budgetMaxEur] = readRangeNumbers(values, "budgetRange");
  const sizeRangeFt = readRangeNumbers(values, "metricRange");
  const relationshipNotes = readList(values, "relationshipNotes");
  const preferredBrands = readList(values, "preferredBrands");
  const preferredLocations = readList(values, "preferredLocations");
  const lifestylePreferences = readList(values, "lifestylePreferences");
  const mustHaves = readList(values, "mustHaves");
  const dealBreakers = readList(values, "dealBreakers");
  const objections = readList(values, "objections");
  const createdDate = createdAt.slice(0, 10);
  const tags = Array.from(new Set([
    segment.toLowerCase(),
    isDraft ? "draft" : "active",
    ...preferredLocations.slice(0, 2).map((item) => item.toLowerCase()),
    ...lifestylePreferences.slice(0, 2).map((item) => item.toLowerCase()),
  ])).filter(Boolean);

  return {
    id,
    assetTypes: [segment],
    name: readText(values, "name") || "New buyer",
    company: readText(values, "company") || undefined,
    country: readText(values, "country") || "International",
    budgetMinEur,
    budgetMaxEur,
    sizeRangeFt,
    preferredBrands,
    preferredLocations,
    lifestylePreferences,
    mustHaves,
    dealBreakers,
    objections,
    rejectedAssets: [],
    urgency: normalizeBuyerUrgency(readText(values, "urgency")),
    decisionTimeline: readText(values, "decisionTimeline") || "Timeline to confirm with buyer.",
    communicationStyle: readText(values, "communicationStyle") || "Broker to confirm preferred cadence.",
    relationshipNotes: relationshipNotes.length
      ? relationshipNotes
      : ["Buyer created from manual intake; enrich after the next conversation."],
    currentStage: isDraft ? "New Inquiry" : normalizeBuyerStage(readText(values, "stage")),
    lastContactedAt: createdDate,
    nextActionDueAt: readText(values, "nextActionDueAt") || createdDate,
    verificationCaseId: "",
    tags,
    source: normalizeBuyerSource(readText(values, "source")),
  };
}
