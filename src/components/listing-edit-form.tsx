"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import type { BrokerSegment } from "@/lib/broker-segments";
import {
  getListingIntakeConfig,
  readText,
  type ListingDraftValue,
  type ListingDraftValues,
  type ListingField,
} from "@/lib/listing-intake-config";
import {
  buildEditableListingPayload,
  getEditableValuesFromListing,
} from "@/lib/listing-edit";
import type { YachtListing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, TextInput } from "@/components/ui";
import { SelectMenu } from "@/components/select-menu";

export function ListingEditForm({
  listing,
  segment,
}: {
  listing: YachtListing;
  segment: BrokerSegment;
}) {
  const router = useRouter();
  const config = useMemo(() => getListingIntakeConfig(segment), [segment]);
  const [values, setValues] = useState<ListingDraftValues>(() => getEditableValuesFromListing(listing));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(id: string, value: ListingDraftValue) {
    setValues((current) => ({ ...current, [id]: value }));
  }

  async function saveListing() {
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        ...buildEditableListingPayload(listing.id, segment, values),
        photos: listing.photos,
      };
      const response = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing: payload }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Could not save listing changes.");
      }

      router.refresh();
      router.push(`/listings/${listing.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save listing changes.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <Link
        className="inline-flex items-center gap-2 text-sm font-medium text-[#5F625E] hover:text-[#171719]"
        href={`/listings/${listing.id}`}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to listing
      </Link>

      <div className="mt-8 rounded-[24px] border border-[#E7E7E2] bg-white p-6 shadow-[0_24px_80px_rgba(23,23,28,0.06)]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">{segment}</Badge>
              <Badge tone="neutral">Editing active listing</Badge>
            </div>
            <h1 className="bb-display mt-4 text-[2.2rem] font-medium leading-[1.04] text-[#171719]">
              Edit {listing.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5F625E]">
              Update the information brokers and buyers see in the listing brain. Saved changes become a stored workspace record.
            </p>
          </div>
          <Button disabled={isSaving} onClick={() => void saveListing()} type="button">
            <Save className="h-4 w-4" aria-hidden="true" />
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
        {error ? (
          <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-[13px] leading-6 text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid gap-8">
        {config.sections.map((section) => (
          <Card key={section.id}>
            <CardHeader eyebrow={section.eyebrow} title={section.title} description={section.description} />
            <div className="grid gap-5 px-6 py-5 lg:grid-cols-3">
              {section.fields
                .filter((field) => isFieldVisible(field, values))
                .map((field) => (
                  <EditFieldControl
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
    </div>
  );
}

function EditFieldControl({
  field,
  value,
  onChange,
}: {
  field: ListingField;
  value: ListingDraftValue | undefined;
  onChange: (value: ListingDraftValue) => void;
}) {
  const stringValue = typeof value === "string" ? value : "";

  if (field.kind === "textarea") {
    return (
      <label className="grid gap-1.5 text-sm font-medium text-[#171719] lg:col-span-3">
        <span>{field.label}</span>
        <textarea
          className="min-h-28 rounded-xl border border-[#D9DAD4] bg-white px-3.5 py-3 text-[15px] text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          value={stringValue}
        />
      </label>
    );
  }

  if (field.kind === "select") {
    return (
      <SelectMenu
        label={field.label}
        onChange={(value) => onChange(value)}
        options={field.options ?? []}
        value={stringValue || field.options?.[0]?.value || ""}
      />
    );
  }

  if (field.kind === "segmented") {
    return (
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-medium text-[#171719]">{field.label}</legend>
        <div className="flex overflow-hidden rounded-xl border border-[#D9DAD4] bg-white">
          {field.options?.map((option) => (
            <button
              className={cn(
                "min-h-11 flex-1 border-r border-[#E7E7E2] px-3 text-sm font-medium last:border-r-0",
                stringValue === option.value ? "bg-[#171719] text-white" : "text-[#171719] hover:bg-[#F6F6F3]",
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

  if (field.kind === "multi") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="grid gap-3 lg:col-span-3">
        <legend className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
          {field.label}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {field.options?.map((option) => (
            <label
              className="flex min-h-11 items-center gap-3 rounded-xl border border-[#D9DAD4] bg-white px-3.5 text-sm font-medium text-[#171719]"
              key={option.value}
            >
              <input
                checked={selected.includes(option.value)}
                className="h-4 w-4"
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value),
                  )
                }
                type="checkbox"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.kind === "checkbox") {
    return (
      <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#D9DAD4] bg-white px-3.5 text-sm font-medium text-[#171719]">
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

function isFieldVisible(field: ListingField, values: ListingDraftValues) {
  if (!field.showWhen) return true;

  const current = readText(values, field.showWhen.fieldId);
  return Array.isArray(field.showWhen.value)
    ? field.showWhen.value.includes(current)
    : current === field.showWhen.value;
}
