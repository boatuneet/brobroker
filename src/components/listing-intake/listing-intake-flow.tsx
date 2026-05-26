"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ImagePlus, MapPin, Save, Sparkles, X } from "lucide-react";
import { type BrokerSegment, brokerSegments } from "@/lib/broker-segments";
import {
  filterLocationOptions,
  findLocationOption,
  type LocationOption,
} from "@/lib/location-options";
import {
  generateDraftName,
  generateSpecSummary,
  getInitialDraftValues,
  getListingIntakeConfig,
  getSegmentLabel,
  readNumber,
  readText,
  type ListingDraftValue,
  type ListingDraftValues,
  type ListingField,
  type ListingRangeValue,
} from "@/lib/listing-intake-config";
import { saveSessionAsset } from "@/lib/browser-persistence";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";
import type {
  DocumentAsset,
  ListingFact,
  ListingPhoto,
  ListingStatus,
  SellerProfile,
  VatStatus,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, TextInput } from "@/components/ui";
import { SelectMenu } from "@/components/select-menu";
import { ToastViewport } from "@/components/app-feedback";

type DraftPhoto = ListingPhoto & {
  file?: File;
  size: number;
};

type SaveResult = {
  id: string;
  status: ListingStatus;
  storage: "database" | "local";
  savedAt: string;
};

export function ListingIntakeFlow({ initialSegment }: { initialSegment: BrokerSegment }) {
  const router = useRouter();
  const segment = initialSegment;
  const [values, setValues] = useState<ListingDraftValues>(() => getInitialDraftValues(initialSegment));
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [selectedLocationOverride, setSelectedLocationOverride] = useState<LocationOption | null>(null);
  const [saveAsDraft, setSaveAsDraft] = useState(true);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const config = getListingIntakeConfig(segment);
  const segmentMeta = brokerSegments.find((item) => item.id === segment) ?? brokerSegments[0];
  const requiredFields = config.sections.flatMap((section) =>
    section.fields.filter((field) => field.required),
  );
  const completedRequired = requiredFields.filter((field) => Boolean(readText(values, field.id))).length;
  const completion = requiredFields.length
    ? Math.round((completedRequired / requiredFields.length) * 100)
    : 100;
  const draftName = generateDraftName(segment, values);
  const specSummary = generateSpecSummary(segment, values);
  const price = readNumber(values, "priceEur");

  function updateField(id: string, value: ListingDraftValue) {
    setValues((current) => ({ ...current, [id]: value }));
  }

  const locationFieldId =
    segment === "Real Estate" ? "address" : segment === "Car" ? "city" : "location";
  const locationValue = readText(values, locationFieldId);
  const selectedLocation =
    selectedLocationOverride?.segment === segment && selectedLocationOverride.label === locationValue
      ? selectedLocationOverride
      : findLocationOption(segment, locationValue);

  async function saveListing() {
    setIsSaving(true);
    setSaveError(null);
    setSaveResult(null);

    const builder =
      segment === "Car"
        ? readText(values, "make")
        : segment === "Real Estate"
          ? readText(values, "location") || "Private market"
          : readText(values, "builder");
    const model =
      segment === "Real Estate"
        ? readText(values, "objectType")
        : readText(values, "model");
    const location =
      selectedLocation?.label ||
      readText(values, "location") ||
      readText(values, "city") ||
      readText(values, "address") ||
      readText(values, "country") ||
      "Private location";

    const createdAt = new Date().toISOString();
    const assetId = `listing-${segment.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID()}`;
    const status: ListingStatus = saveAsDraft ? "Draft" : "Active";
    const coreFacts = buildCoreFacts(segment, values, selectedLocation?.label ?? location);
    const documents = buildListingDocuments(values, assetId, createdAt);
    const missingInfo = parseLines(readText(values, "missingInfo"));
    const ownerNotes = parseLines(readText(values, "ownerNotes"));
    const brokerOnlyNotes = [
      ...parseLines(readText(values, "brokerOnlyNotes")),
      ...parseLines(readText(values, "ownerBrokerOnlyNotes")),
      saveAsDraft
        ? "Saved from intake as an internal draft."
        : "Created from intake as an active listing.",
    ];
    const marketSignals = parseLines(readText(values, "marketSignals"));
    const ownerProfile = buildOwnerProfile({
      assetId,
      createdAt,
      draftName,
      values,
    });
    const refitHistory = buildHistory(segment, values);
    const highlights = buildHighlights(values, coreFacts);
    const weaknesses = parseLines(readText(values, "knownWeaknesses"));
    const idealBuyer =
      readText(values, "idealBuyer") ||
      "Qualified buyer to confirm after broker review.";

    const sessionAsset = {
      id: assetId,
      assetType: segment,
      name: draftName,
      builder: builder || getSegmentLabel(segment),
      model: model || "Configuration to confirm",
      location,
      address: readText(values, "address") || undefined,
      locationLabel: selectedLocation?.label ?? location,
      locationPrecision: selectedLocation?.precision,
      coordinates: selectedLocation?.coordinates,
      priceEur: price,
      status: "Session draft",
      summary: `${draftName} draft captured from the ${getSegmentLabel(segment).toLowerCase()} intake flow.`,
      specSummary,
      photos: photos.map((photo) => ({
        id: photo.id,
        src: photo.src,
        alt: photo.alt,
        name: photo.name,
      })),
      segmentPayload: {
        ...values,
        coreFacts,
        documents,
        missingInfo,
        ownerNotes,
        brokerOnlyNotes,
        marketSignals,
        ownerProfile,
      },
      createdAt,
    };

    try {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Sign in before saving this listing to your workspace.");
        }

        const storedPhotos = await uploadListingPhotos({
          assetId,
          photos,
          supabase,
          userId: user.id,
        });

        const { error } = await supabase.from("assets").insert({
          id: assetId,
          asset_type: segment,
          name: draftName,
          builder: builder || getSegmentLabel(segment),
          model: model || "Configuration to confirm",
          year: readNumber(values, "year") || null,
          price_eur: price || 0,
          metric_value: getMetricValue(segment, values),
          metric_label: getMetricLabel(segment),
          location,
          vat_status: getVatStatus(values),
          status,
          seller_id: ownerProfile?.id ?? null,
          spec_summary: specSummary || null,
          documents,
          missing_info: missingInfo,
          owner_notes: ownerNotes,
          broker_only_notes: brokerOnlyNotes,
          market_signals: marketSignals,
          payload: {
            address: readText(values, "address") || undefined,
            locationLabel: selectedLocation?.label ?? location,
            locationPrecision: selectedLocation?.precision,
            coordinates: selectedLocation?.coordinates,
            availability: readText(values, "availability") || undefined,
            exteriorTone: readText(values, "exteriorTone") || readText(values, "condition") || undefined,
            interiorStyle: readText(values, "interiorStyle") || readText(values, "interior") || undefined,
            refitHistory,
            highlights,
            weaknesses,
            idealBuyer,
            coreFacts,
            photos: storedPhotos,
            ownerProfile,
            fields: values,
          },
        });

        if (error) throw new Error(error.message);

        setSaveResult({ id: assetId, status, storage: "database", savedAt: new Date().toISOString() });
        router.refresh();
        return;
      }

      saveSessionAsset(sessionAsset);
      setSaveResult({ id: assetId, status, storage: "local", savedAt: new Date().toISOString() });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save this listing.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <ToastViewport
        action={
          saveResult ? (
            <Link className="font-semibold text-[#003c33] underline underline-offset-4" href={`/listings/${saveResult.id}`}>
              Open listing
            </Link>
          ) : null
        }
        message={
          saveResult
            ? saveResult.storage === "database"
              ? saveResult.status === "Draft"
                ? "Listing draft saved."
                : "Listing created."
              : `${saveResult.status} saved on this device. Sign in to keep it with your workspace.`
            : null
        }
        onDismiss={() => setSaveResult(null)}
      />
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-[#3f3f46] hover:text-[#17171c]"
        href="/listings"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to listings
      </Link>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="grid gap-8">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="bb-mono-label">Listing intake</p>
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
                  Creating a {segmentMeta.title.toLowerCase()} listing
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#616161]">
                  This intake follows your active broker segment from Profile, so you do not need to
                  choose the category again.
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
                {section.fields
                  .filter((field) => isFieldVisible(field, values))
                  .map((field) => (
                    <FieldControl
                      field={field}
                      key={field.id}
                      onChange={(value) => updateField(field.id, value)}
                      onLocationSelect={(option) => {
                        if (field.id === locationFieldId) setSelectedLocationOverride(option);
                      }}
                      segment={segment}
                      value={values[field.id]}
                    />
                  ))}
              </div>
            </Card>
          ))}

          <Card>
            <CardHeader
              eyebrow="Media"
              title="Attach listing photos"
              description="Add owner-approved photos now so the listing draft already has a buyer-ready visual set."
            />
            <div className="px-6 py-5">
              <PhotoAttachmentField photos={photos} setPhotos={setPhotos} />
            </div>
          </Card>
        </div>

        <aside className="sticky top-8 grid gap-5">
          <Card className="p-6">
            <p className="bb-mono-label">Listing summary</p>
            <h2 className="bb-display mt-3 text-2xl font-medium leading-tight text-[#17171c]">
              {draftName}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#616161]">
              {specSummary || "Complete core fields to generate a broker-ready summary."}
            </p>
            <dl className="mt-5 grid gap-3 border-y border-[#f2f2f2] py-5">
              <SummaryLine label="Segment" value={getSegmentLabel(segment)} />
              <SummaryLine label="Price" value={price ? formatCurrency(price) : "To confirm"} />
              <SummaryLine
                label="Location"
                value={selectedLocation?.label ?? (locationValue || "To confirm")}
              />
              <SummaryLine label="Photos" value={`${photos.length}`} />
              <SummaryLine label="Save mode" value={saveAsDraft ? "Draft" : "Active listing"} />
              <SummaryLine label="Required fields" value={`${completedRequired}/${requiredFields.length}`} />
            </dl>
            {photos.length ? (
              <div className="mt-5 grid grid-cols-3 gap-2">
                {photos.slice(0, 3).map((photo) => (
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-[#f5f4ef]" key={photo.id}>
                    <Image alt={photo.alt} className="object-cover" fill sizes="90px" src={photo.src} />
                  </div>
                ))}
              </div>
            ) : null}
            <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[#e5e7eb] bg-[#fbfbfa] p-4">
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[#17171c]">Save as draft</span>
                <span className="mt-1 block text-[12px] leading-5 text-[#616161]">
                  Drafts stay internal; turn this off to create a live listing item.
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
            <Button className="mt-4 w-full" disabled={isSaving} onClick={saveListing} type="button">
              <Save className="h-4 w-4" aria-hidden="true" />
              {isSaving ? "Saving..." : saveAsDraft ? "Save draft" : "Create listing"}
            </Button>
            {saveError ? (
              <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-[13px] leading-6 text-red-700">
                {saveError}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-[#f7f7f9] px-4 py-3 text-[13px] leading-6 text-[#616161]">
                <Sparkles className="mr-1 inline h-4 w-4 align-[-3px] text-[#003c33]" aria-hidden="true" />
                Saved listings become real listing records. Draft mode keeps the item internal.
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
  segment,
  value,
  onChange,
  onLocationSelect,
}: {
  field: ListingField;
  segment: BrokerSegment;
  value: ListingDraftValue | undefined;
  onChange: (value: ListingDraftValue) => void;
  onLocationSelect?: (option: LocationOption | null) => void;
}) {
  const stringValue = typeof value === "string" ? value : "";

  if (field.kind === "range") {
    const rangeValue = isRangeValue(value) ? value : { from: "", to: "" };

    return (
      <fieldset className="grid gap-1.5">
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
      </fieldset>
    );
  }

  if (field.kind === "segmented") {
    return (
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-medium text-[#212121]">{field.label}</legend>
        <div className="flex overflow-hidden rounded-xl border border-[#d9d9dd] bg-white">
          {field.options?.map((option) => (
            <button
              className={cn(
                "min-h-11 flex-1 border-r border-[#e5e7eb] px-3 text-sm font-medium last:border-r-0",
                stringValue === option.value
                  ? "bg-[#17171c] text-white"
                  : "text-[#17171c] hover:bg-[#f7f7f9]",
              )}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.kind === "select") {
    return (
      <SelectMenu
        label={field.label}
        onChange={onChange}
        options={field.options ?? []}
        value={stringValue || field.options?.[0]?.value || ""}
      />
    );
  }

  if (field.kind === "location") {
    return (
      <LocationAutocomplete
        field={field}
        onChange={(optionOrValue, option) => {
          onChange(optionOrValue);
          onLocationSelect?.(option ?? null);
        }}
        segment={segment}
        value={stringValue}
      />
    );
  }

  if (field.kind === "textarea") {
    return (
      <label className="grid gap-1.5 text-sm font-medium text-[#212121] lg:col-span-3">
        <span>{field.label}</span>
        <textarea
          className="min-h-28 rounded-xl border border-[#d9d9dd] bg-white px-3.5 py-3 text-[15px] text-[#17171c] outline-none transition-colors placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          value={stringValue}
        />
      </label>
    );
  }

  if (field.kind === "checkbox") {
    return (
      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#d9d9dd] bg-white px-3.5 text-sm font-medium text-[#212121]">
        <input
          checked={value === true}
          className="h-4 w-4"
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        {field.label}
      </label>
    );
  }

  if (field.kind === "multi") {
    const values = Array.isArray(value) ? value : [];
    return (
      <fieldset className="grid gap-3 lg:col-span-3">
        <legend className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#777888]">
          {field.label}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {field.options?.map((option) => (
            <label
              className="flex min-h-11 items-center gap-3 rounded-xl border border-[#d9d9dd] bg-white px-3.5 text-sm font-medium text-[#212121]"
              key={option.value}
            >
              <input
                checked={values.includes(option.value)}
                className="h-4 w-4"
                onChange={(event) => {
                  onChange(
                    event.target.checked
                      ? [...values, option.value]
                      : values.filter((item) => item !== option.value),
                  );
                }}
                type="checkbox"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.kind === "color") {
    return (
      <fieldset className="grid gap-3 lg:col-span-3">
        <legend className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#777888]">
          {field.label}
        </legend>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {field.options?.map((option) => (
            <button
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl border bg-white px-3 text-left text-sm font-medium transition-colors",
                value === option.value ? "border-[#17171c]" : "border-[#d9d9dd] hover:border-[#17171c]",
              )}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              <span
                className="h-5 w-5 rounded border border-[#b8b8be]"
                style={{ background: option.swatch }}
                aria-hidden="true"
              />
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <TextInput
      inputMode={field.kind === "number" ? "numeric" : undefined}
      label={field.label}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      value={stringValue}
    />
  );
}

function LocationAutocomplete({
  field,
  segment,
  value,
  onChange,
}: {
  field: ListingField;
  segment: BrokerSegment;
  value: string;
  onChange: (value: string, option?: LocationOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState<LocationOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const normalizedValue = value.trim();
  const localSuggestions = filterLocationOptions(segment, value, 4);
  const mergedSuggestions = mergeLocationOptions([
    ...localSuggestions,
    ...(normalizedValue.length >= 3 ? remoteSuggestions : []),
  ]);
  const exactMatch = mergedSuggestions.some(
    (option) => option.label.toLowerCase() === normalizedValue.toLowerCase(),
  );
  const customSuggestion =
    normalizedValue && !exactMatch ? createCustomLocationOption(segment, normalizedValue) : null;
  const suggestions = [...mergedSuggestions, ...(customSuggestion ? [customSuggestion] : [])].slice(0, 7);

  useEffect(() => {
    if (normalizedValue.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsSearching(true);
      fetchPhotonLocationOptions(segment, normalizedValue, controller.signal)
        .then((options) => {
          setRemoteSuggestions(options);
        })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            setRemoteSuggestions([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 260);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [normalizedValue, segment]);

  function selectOption(option: LocationOption) {
    onChange(option.label, option);
    setOpen(false);
  }

  return (
    <div className="relative grid gap-1.5 text-sm font-medium text-[#212121]">
      <label htmlFor={`location-${field.id}`}>{field.label}</label>
      <div className="relative">
        <MapPin
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#75758a]"
        />
        <input
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-[#d9d9dd] bg-white pl-10 pr-3.5 text-[15px] text-[#17171c] outline-none transition-colors placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
          id={`location-${field.id}`}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onClick={() => setOpen(true)}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (nextValue.trim().length < 3) {
              setRemoteSuggestions([]);
              setIsSearching(false);
            }
            onChange(nextValue, null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onMouseDown={() => setOpen(true)}
          placeholder={field.placeholder}
          value={value}
        />
      </div>
      {open && (suggestions.length || isSearching) ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-y-auto rounded-xl border border-[#e1e1e5] bg-white shadow-[0_18px_45px_rgba(23,23,28,0.14)]">
          {suggestions.map((option) => (
            <button
              className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[#f7f7f9] focus:bg-[#f7f7f9] focus:outline-none"
              key={option.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
              type="button"
            >
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf7f4] text-[#003c33]">
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[#17171c]">{option.label}</span>
                <span className="mt-0.5 block text-[12px] leading-5 text-[#75758a]">
                  {option.secondaryLabel} ·{" "}
                  {option.coordinates ? `${option.precision.toLowerCase()} map pin` : "private label"}
                </span>
              </span>
            </button>
          ))}
          {isSearching ? (
            <div className="border-t border-[#f2f2f2] px-3.5 py-3 text-[12px] font-medium text-[#75758a]">
              Searching address matches...
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function mergeLocationOptions(options: LocationOption[]) {
  const seen = new Set<string>();

  return options.filter((option) => {
    const key = option.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function createCustomLocationOption(segment: BrokerSegment, label: string): LocationOption {
  return {
    id: `custom-location-${segment}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    segment,
    label,
    secondaryLabel: "Use as private location label",
    searchText: label,
    precision: "Private",
  };
}

type PhotonFeature = {
  properties?: {
    osm_id?: number;
    osm_type?: string;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  geometry?: {
    coordinates?: [number, number];
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

async function fetchPhotonLocationOptions(
  segment: BrokerSegment,
  query: string,
  signal: AbortSignal,
): Promise<LocationOption[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "5",
    lang: "en",
  });
  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, { signal });

  if (!response.ok) return [];

  const payload = (await response.json()) as PhotonResponse;

  return mergeLocationOptions(
    (payload.features ?? [])
      .map((feature) => mapPhotonFeatureToLocationOption(segment, feature))
      .filter((option): option is LocationOption => Boolean(option)),
  );
}

function mapPhotonFeatureToLocationOption(
  segment: BrokerSegment,
  feature: PhotonFeature,
): LocationOption | null {
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const properties = feature.properties ?? {};
  const streetAddress = [properties.street, properties.housenumber].filter(Boolean).join(" ");
  const primary =
    streetAddress ||
    properties.name ||
    properties.city ||
    properties.county ||
    properties.state ||
    properties.country;
  if (!primary) return null;

  const placeParts = [
    properties.locality,
    properties.district,
    properties.city,
    properties.county,
    properties.country,
  ].filter((part): part is string => Boolean(part));
  const place = Array.from(new Set(placeParts.filter((part) => !primary.includes(part)))).slice(0, 2);
  const label = [primary, ...place].join(", ");
  const detailParts = [
    properties.postcode,
    properties.state,
    properties.country,
  ].filter((part): part is string => Boolean(part));
  const secondaryLabel = Array.from(new Set(detailParts)).join(" / ") || "Address result";

  return {
    id: `photon-${properties.osm_type ?? "place"}-${properties.osm_id ?? label}`,
    segment,
    label,
    secondaryLabel,
    searchText: label,
    coordinates: { lat, lng },
    precision: properties.type === "city" ? "Area" : segment === "Real Estate" ? "Private" : "Area",
  };
}

async function uploadListingPhotos({
  assetId,
  photos,
  supabase,
  userId,
}: {
  assetId: string;
  photos: DraftPhoto[];
  supabase: ReturnType<typeof createClient>;
  userId: string;
}): Promise<ListingPhoto[]> {
  const uploaded: ListingPhoto[] = [];

  for (const photo of photos) {
    if (!photo.file) {
      uploaded.push(photo);
      continue;
    }

    const path = `${userId}/listing-photos/${assetId}/${photo.id}-${safeStorageName(photo.file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("broker-documents")
      .upload(path, photo.file, {
        contentType: photo.file.type,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Photo upload failed: ${uploadError.message}`);
    }

    const { data } = await supabase.storage
      .from("broker-documents")
      .createSignedUrl(path, 60 * 60);

    uploaded.push({
      id: photo.id,
      src: data?.signedUrl ?? photo.src,
      alt: photo.alt,
      name: photo.name,
      storagePath: path,
    });
  }

  return uploaded;
}

function safeStorageName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
}

function getVatStatus(values: ListingDraftValues): VatStatus {
  const raw = readText(values, "vatStatus").toLowerCase();

  if (raw === "eu vat paid" || raw.includes("paid")) return "EU VAT Paid";
  if (raw.includes("commercial")) return "Commercial";
  if (raw.includes("not")) return "Not Paid";
  return "Unknown";
}

function getMetricValue(segment: BrokerSegment, values: ListingDraftValues) {
  if (segment === "Real Estate") return readNumber(values, "areaSqm") || null;
  if (segment === "Car") return readNumber(values, "mileageKm") || null;
  return readNumber(values, "lengthFt") || null;
}

function getMetricLabel(segment: BrokerSegment) {
  if (segment === "Real Estate") return "sqm";
  if (segment === "Car") return "km";
  return "ft";
}

function parseLines(value: string) {
  return value
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildListingDocuments(
  values: ListingDraftValues,
  assetId: string,
  createdAt: string,
): DocumentAsset[] {
  const updatedAt = createdAt.slice(0, 10);
  const approved = parseLines(readText(values, "approvedDocuments")).map((title, index) =>
    buildDocument(assetId, title, "Approved", updatedAt, index),
  );
  const restricted = parseLines(readText(values, "restrictedDocuments")).map((title, index) =>
    buildDocument(assetId, title, inferRestrictedStatus(title), updatedAt, approved.length + index),
  );

  return [...approved, ...restricted];
}

function buildDocument(
  assetId: string,
  title: string,
  status: DocumentAsset["status"],
  updatedAt: string,
  index: number,
): DocumentAsset {
  return {
    id: `doc-${assetId}-${index + 1}`,
    title,
    category: inferDocumentCategory(title),
    status,
    updatedAt,
  };
}

function inferRestrictedStatus(title: string): DocumentAsset["status"] {
  const normalized = title.toLowerCase();
  return normalized.includes("restricted") || normalized.includes("private") ? "Restricted" : "Internal";
}

function inferDocumentCategory(title: string): DocumentAsset["category"] {
  const normalized = title.toLowerCase();

  if (normalized.includes("survey") || normalized.includes("inspection")) return "Survey";
  if (normalized.includes("vat") || normalized.includes("tax")) return "VAT";
  if (normalized.includes("service") || normalized.includes("maintenance") || normalized.includes("invoice")) {
    return "Maintenance";
  }
  if (normalized.includes("photo") || normalized.includes("image") || normalized.includes("drone") || normalized.includes("media")) {
    return "Media";
  }
  if (normalized.includes("title") || normalized.includes("ownership") || normalized.includes("registry")) return "Title";
  if (normalized.includes("finance") || normalized.includes("pof") || normalized.includes("proof")) return "Finance";
  return "Specs";
}

function buildOwnerProfile({
  assetId,
  createdAt,
  draftName,
  values,
}: {
  assetId: string;
  createdAt: string;
  draftName: string;
  values: ListingDraftValues;
}): SellerProfile | undefined {
  const name = readText(values, "sellerName");
  const motivation = readText(values, "sellerMotivation");
  const communicationExpectation = readText(values, "communicationExpectation");
  const pricingSensitivity = readText(values, "pricingSensitivity");
  const reportingCadence = readText(values, "reportingCadence");
  const nextOwnerUpdateDueAt = readText(values, "nextOwnerUpdateDueAt");
  const feedbackHistory = parseLines(readText(values, "ownerNotes"));

  const hasOwnerContext = [
    name,
    motivation,
    communicationExpectation,
    pricingSensitivity,
    reportingCadence,
    nextOwnerUpdateDueAt,
    ...feedbackHistory,
  ].some(Boolean);

  if (!hasOwnerContext) return undefined;

  return {
    id: `seller-${assetId}`,
    name: name || `${draftName} owner`,
    assetIds: [assetId],
    motivation: motivation || "Seller motivation to confirm.",
    communicationExpectation:
      communicationExpectation || "Owner reporting expectations to confirm.",
    pricingSensitivity: pricingSensitivity || "Pricing posture to confirm.",
    feedbackHistory,
    reportingCadence: reportingCadence || "Cadence to confirm",
    nextOwnerUpdateDueAt: nextOwnerUpdateDueAt || createdAt.slice(0, 10),
  };
}

function buildHistory(segment: BrokerSegment, values: ListingDraftValues) {
  if (segment === "Car") {
    return parseLines(readText(values, "serviceHistory"));
  }

  if (segment === "Real Estate") {
    return [
      ...parseLines(readText(values, "agencyMandate")),
      ...parseLines(readText(values, "viewingPrivacy")),
    ];
  }

  return parseLines(readText(values, "refitHistory"));
}

function buildHighlights(values: ListingDraftValues, coreFacts: ListingFact[]) {
  const explicitHighlights = parseLines(readText(values, "buyerSafeHighlights"));
  if (explicitHighlights.length) return explicitHighlights;
  return coreFacts.map((fact) => fact.value).filter(Boolean).slice(0, 3);
}

function buildCoreFacts(
  segment: BrokerSegment,
  values: ListingDraftValues,
  location: string,
): ListingFact[] {
  const facts: ListingFact[] = [];
  const add = (label: string, value?: string | number) => {
    const normalized = String(value ?? "").trim();
    if (normalized && normalized !== "0") facts.push({ label, value: normalized });
  };

  if (segment === "Car") {
    add("Make", readText(values, "make"));
    add("Model", readText(values, "model"));
    add("First registration", readText(values, "registrationFrom"));
    add("Mileage", readText(values, "mileageKm") ? `${readText(values, "mileageKm")} km` : "");
    add("Power", readText(values, "powerKw") ? `${readText(values, "powerKw")} kW` : "");
    add("Location", location);
    return facts;
  }

  if (segment === "Real Estate") {
    add("Object type", readText(values, "objectType"));
    add("Area", readText(values, "areaSqm") ? `${readText(values, "areaSqm")} sqm` : "");
    add("Rooms", readText(values, "rooms"));
    add("Floor", readText(values, "floor"));
    add("Location", location);
    add("Heating", readText(values, "heating"));
    return facts;
  }

  add("Builder", readText(values, "builder"));
  add("Model", readText(values, "model"));
  add("Year", readText(values, "year"));
  add("Length", readText(values, "lengthFt") ? `${readText(values, "lengthFt")} ft` : "");
  add("Cabins", readText(values, "cabins"));
  add("Engines", readText(values, "engines"));
  add("Engine hours", readText(values, "engineHours"));
  add("Location", location);
  return facts;
}

function PhotoAttachmentField({
  photos,
  setPhotos,
}: {
  photos: DraftPhoto[];
  setPhotos: (photos: DraftPhoto[] | ((current: DraftPhoto[]) => DraftPhoto[])) => void;
}) {
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;

    const imageFiles = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, 8 - photos.length));
    const loaded = await Promise.all(
      imageFiles.map(async (file) => ({
        id: `photo-${crypto.randomUUID()}`,
        file,
        src: await readFileAsDataUrl(file),
        alt: file.name.replace(/\.[^.]+$/, ""),
        name: file.name,
        size: file.size,
      })),
    );

    setPhotos((current) => [...current, ...loaded].slice(0, 8));
  }

  return (
    <div className="grid gap-4">
      <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfd3d8] bg-[#fbfbfa] px-5 py-8 text-center transition-colors hover:border-[#003c33] hover:bg-[#f7fbf8]">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#003c33] shadow-[0_8px_24px_rgba(23,23,28,0.08)]">
          <ImagePlus className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="mt-4 text-sm font-medium text-[#17171c]">Upload owner-approved photos</span>
        <span className="mt-1 text-[13px] leading-6 text-[#616161]">
          JPG, PNG, or WebP. Up to 8 photos are stored with this browser draft.
        </span>
        <input
          accept="image/*"
          className="sr-only"
          multiple
          onChange={(event) => {
            void addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
          type="file"
        />
      </label>
      {photos.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {photos.map((photo) => (
            <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white" key={photo.id}>
              <div className="relative aspect-[4/3] bg-[#f5f4ef]">
                <Image alt={photo.alt} className="object-cover" fill sizes="240px" src={photo.src} />
                <button
                  aria-label={`Remove ${photo.name ?? "photo"}`}
                  className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#17171c] shadow-[0_8px_20px_rgba(23,23,28,0.12)] backdrop-blur hover:bg-white"
                  onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))}
                  type="button"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="px-3 py-2">
                <p className="truncate text-[12px] font-medium text-[#17171c]">{photo.name}</p>
                <p className="mt-0.5 text-[11px] text-[#75758a]">{Math.round(photo.size / 1024)} KB</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function isRangeValue(value: ListingDraftValue | undefined): value is ListingRangeValue {
  return typeof value === "object" && !Array.isArray(value) && value !== null && "from" in value && "to" in value;
}

function isFieldVisible(field: ListingField, values: ListingDraftValues) {
  if (!field.showWhen) return true;

  const current = readText(values, field.showWhen.fieldId);
  return Array.isArray(field.showWhen.value)
    ? field.showWhen.value.includes(current)
    : current === field.showWhen.value;
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="bb-mono-label">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-[#17171c]">{value}</dd>
    </div>
  );
}
