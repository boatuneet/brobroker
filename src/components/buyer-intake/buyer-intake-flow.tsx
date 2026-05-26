"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save, Sparkles, UserRound } from "lucide-react";
import { type BrokerSegment, brokerSegments } from "@/lib/broker-segments";
import {
  generateBuyerSummary,
  getBuyerIntakeConfig,
  getInitialBuyerDraftValues,
  getSegmentLabel,
  normalizeBuyerStage,
  normalizeBuyerUrgency,
  readList,
  readRange,
  readRangeNumbers,
  readText,
  type BuyerDraftValue,
  type BuyerDraftValues,
  type BuyerField,
} from "@/lib/buyer-intake-config";
import { saveSessionBuyer } from "@/lib/browser-persistence";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { BuyerProfile } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { ToastViewport } from "@/components/app-feedback";
import { SelectMenu } from "@/components/select-menu";
import { Badge, Button, Card, CardHeader, TextInput } from "@/components/ui";

type SaveResult = {
  id: string;
  storage: "database" | "local";
  isDraft: boolean;
  savedAt: string;
};

export function BuyerIntakeFlow({ initialSegment }: { initialSegment: BrokerSegment }) {
  const router = useRouter();
  const segment = initialSegment;
  const [values, setValues] = useState<BuyerDraftValues>(() => getInitialBuyerDraftValues(segment));
  const [saveAsDraft, setSaveAsDraft] = useState(true);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const config = getBuyerIntakeConfig(segment);
  const segmentMeta = brokerSegments.find((item) => item.id === segment) ?? brokerSegments[0];
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

    const buyerId = `buyer-${segment.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
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

        const { error } = await supabase.from("buyers").insert({
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
            <Link className="font-semibold text-[#003c33] underline underline-offset-4" href={`/buyers/${saveResult.id}`}>
              Open buyer memory
            </Link>
          ) : (
            <Link className="font-semibold text-[#003c33] underline underline-offset-4" href="/buyers">
              Back to buyers
            </Link>
          )
        }
        message={
          saveResult
            ? saveResult.storage === "database"
              ? saveResult.isDraft
                ? "Buyer draft saved."
                : "Buyer created."
              : "Buyer saved on this device. Sign in to keep it with your workspace."
            : null
        }
        onDismiss={() => setSaveResult(null)}
      />

      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-[#3f3f46] hover:text-[#17171c]"
        href="/buyers"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to buyers
      </Link>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="grid gap-8">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="bb-mono-label">Buyer intake</p>
                <h1 className="bb-display mt-3 text-[2.2rem] font-medium leading-[1.05] text-[#17171c]">
                  {config.title}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[#616161]">{config.description}</p>
              </div>
              <Badge tone="info">{completion}% complete</Badge>
            </div>

            <div className="mt-6 grid gap-4 rounded-2xl border border-[#e5e7eb] bg-[#fbfbfa] p-3 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-center">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#edeae3]">
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="220px"
                  src={segmentMeta.imageSrc}
                />
              </div>
              <div className="min-w-0 px-1">
                <p className="bb-mono-label">{segmentMeta.label} workspace</p>
                <h2 className="bb-display mt-2 text-xl font-medium text-[#17171c]">
                  Creating a {segmentMeta.title.toLowerCase()} buyer
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#616161]">
                  This follows the active segment from Profile, so buyer criteria match the inventory model.
                </p>
              </div>
              <Link
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d9d9dd] bg-white px-4 text-sm font-medium text-[#17171c] hover:border-[#17171c]"
                href="/profile"
              >
                Change segment
              </Link>
            </div>
          </Card>

          {config.sections.map((section) => (
            <Card key={section.id}>
              <CardHeader
                eyebrow={section.eyebrow}
                title={section.title}
                description={section.description}
              />
              <div className="grid gap-5 px-6 py-5 lg:grid-cols-3">
                {section.fields.map((field) => (
                  <FieldControl
                    field={field}
                    key={field.id}
                    onChange={(value) => updateField(field.id, value)}
                    value={values[field.id]}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>

        <aside className="sticky top-8 grid gap-5">
          <Card className="p-6">
            <p className="bb-mono-label">Buyer summary</p>
            <div className="mt-4 flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#003c33] text-white shadow-[0_10px_24px_rgba(0,60,51,0.18)]">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="bb-display text-2xl font-medium leading-tight text-[#17171c]">
                  {buyerName}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#616161]">
                  {summary || "Complete core fields to generate a buyer-ready memory summary."}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 border-y border-[#f2f2f2] py-5">
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
            <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#e5e7eb] bg-[#fbfbfa] p-4">
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[#17171c]">Save as draft</span>
                <span className="mt-1 block text-[12px] leading-5 text-[#616161]">
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
                className="relative h-7 w-12 shrink-0 rounded-full bg-[#d9d9dd] transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-[#003c33] peer-checked:after:translate-x-5"
              />
            </label>
            <Button className="mt-4 w-full" disabled={isSaving} onClick={saveBuyer} type="button">
              <Save className="h-4 w-4" aria-hidden="true" />
              {isSaving ? "Saving..." : saveAsDraft ? "Save buyer draft" : "Create buyer"}
            </Button>
            {saveError ? (
              <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-[13px] leading-6 text-red-700">
                {saveError}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-[#f7f7f9] px-4 py-3 text-[13px] leading-6 text-[#616161]">
                <Sparkles className="mr-1 inline h-4 w-4 align-[-3px] text-[#003c33]" aria-hidden="true" />
                Saved buyers become rich cards and memory pages for this broker account.
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: BuyerField;
  value: BuyerDraftValue | undefined;
  onChange: (value: BuyerDraftValue) => void;
}) {
  const stringValue = typeof value === "string" ? value : "";

  if (field.kind === "range") {
    const rangeValue = readRange({ [field.id]: value ?? { from: "", to: "" } }, field.id);

    return (
      <fieldset className={cn("grid gap-1.5", field.wide && "lg:col-span-3")}>
        <legend className="text-sm font-medium text-[#212121]">{field.label}</legend>
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-[#d9d9dd] bg-white">
          <input
            className="min-h-11 min-w-0 border-r border-[#e5e7eb] px-3.5 text-[15px] text-[#17171c] outline-none placeholder:text-[#9b9ba6]"
            inputMode="numeric"
            onChange={(event) => onChange({ ...rangeValue, from: event.target.value })}
            placeholder={field.fromPlaceholder ?? "From"}
            value={rangeValue.from}
          />
          <input
            className="min-h-11 min-w-0 px-3.5 text-[15px] text-[#17171c] outline-none placeholder:text-[#9b9ba6]"
            inputMode="numeric"
            onChange={(event) => onChange({ ...rangeValue, to: event.target.value })}
            placeholder={field.toPlaceholder ?? "To"}
            value={rangeValue.to}
          />
        </div>
        {field.helper ? <p className="text-xs font-normal text-[#75758a]">{field.helper}</p> : null}
      </fieldset>
    );
  }

  if (field.kind === "select") {
    return (
      <SelectMenu
        className={field.wide ? "lg:col-span-3" : undefined}
        label={field.label}
        onChange={(nextValue) => onChange(nextValue)}
        options={field.options ?? []}
        value={stringValue || field.options?.[0]?.value || ""}
      />
    );
  }

  if (field.kind === "textarea") {
    return (
      <label className={cn("grid gap-1.5 text-sm font-medium text-[#212121]", field.wide && "lg:col-span-3")}>
        <span>{field.label}</span>
        <textarea
          className="min-h-28 rounded-xl border border-[#d9d9dd] bg-white px-3.5 py-3 text-[15px] text-[#17171c] outline-none transition-colors placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          value={stringValue}
        />
        {field.helper ? <span className="text-xs font-normal text-[#75758a]">{field.helper}</span> : null}
      </label>
    );
  }

  return (
    <TextInput
      className={field.wide ? "lg:col-span-3" : undefined}
      helper={field.helper}
      inputMode={field.kind === "number" ? "numeric" : undefined}
      label={field.label}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      type={field.kind === "date" ? "date" : "text"}
      value={stringValue}
    />
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 text-sm">
      <dt className="text-[#75758a]">{label}</dt>
      <dd className="min-w-0 font-medium text-[#17171c]">{value}</dd>
    </div>
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
  };
}
