"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, TextInput } from "@/components/ui";
import { SelectMenu } from "@/components/select-menu";

/* Field ids mirror src/lib/yacht-pdf-import.ts ParsedYachtFields. */
type PdfFields = {
  builder: string;
  model: string;
  year: string;
  lengthFt: string;
  cabins: string;
  engines: string;
  propulsion: string;
  condition: string;
  engineHours: string;
  vatStatus: string;
  priceEur: string;
  location: string;
  description: string;
  equipment: string;
};

type PdfPhoto = { name: string; dataUrl: string; bytes: number };

type ParseResponse = {
  fields: PdfFields;
  warnings: string[];
  photos: PdfPhoto[];
  imageCount: number;
};

const PROPULSION_OPTIONS = [
  "",
  "Motor",
  "Twin diesel",
  "Diesel",
  "Hybrid",
  "Electric",
  "Sail",
  "Other",
].map((value) => ({ label: value || "Select propulsion", value }));

const CONDITION_OPTIONS = ["", "New", "Used", "Refit", "Project / needs work"].map((value) => ({
  label: value || "Select condition",
  value,
}));

const VAT_OPTIONS = ["EU VAT Paid", "Not Paid", "Unknown", "Commercial"].map((value) => ({
  label: value,
  value,
}));

export function YachtPdfImportPanel() {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<PdfFields | null>(null);
  const [photos, setPhotos] = useState<PdfPhoto[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveActive, setSaveActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{ id: string; status: string } | null>(null);
  // Remount the file input to clear the native selection on reset.
  const [inputKey, setInputKey] = useState(0);

  async function handleFile(selected: File | null) {
    setError(null);
    if (!selected) return;
    setFile(selected);
    setFileName(selected.name);
    setIsParsing(true);
    setFields(null);
    setPhotos([]);
    setWarnings([]);

    try {
      const body = new FormData();
      body.append("file", selected);
      body.append("mode", "parse");
      const response = await fetch("/api/listings/import-pdf", { method: "POST", body });
      const payload = (await response.json()) as Partial<ParseResponse> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not read the PDF.");
      setFields(payload.fields ?? null);
      setPhotos(payload.photos ?? []);
      setWarnings(payload.warnings ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read the PDF.");
      setFile(null);
      setFileName(null);
    } finally {
      setIsParsing(false);
    }
  }

  function updateField(key: keyof PdfFields, value: string) {
    setFields((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveListing() {
    if (!file || !fields || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("mode", "commit");
      body.append("fields", JSON.stringify(fields));
      body.append("saveMode", saveActive ? "active" : "draft");
      const response = await fetch("/api/listings/import-pdf", { method: "POST", body });
      const payload = (await response.json()) as { id?: string; status?: string; error?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error ?? "Could not save the listing.");
      router.refresh();
      setCompletion({ id: payload.id, status: payload.status ?? "Draft" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the listing.");
    } finally {
      setIsSaving(false);
    }
  }

  function reset() {
    setFile(null);
    setFileName(null);
    setFields(null);
    setPhotos([]);
    setWarnings([]);
    setError(null);
    setCompletion(null);
    setSaveActive(false);
    setInputKey((key) => key + 1);
  }

  return (
    <Card>
      <CardHeader
        eyebrow="PDF import"
        title="Import a listing from a PDF"
        description="Upload a single boat's detail PDF (e.g. a boats.com / YachtWorld export). We read the specs and photos, you review and edit, then save it as a listing."
        action={<Badge tone="info">Yachts · one at a time</Badge>}
      />

      <div className="grid gap-5 px-6 py-5">
        <PdfFileInput
          key={inputKey}
          disabled={isParsing}
          fileName={fileName}
          isParsing={isParsing}
          onChange={(selected) => void handleFile(selected)}
        />

        {error ? (
          <div className="flex items-start gap-2 rounded-[12px] bg-[#F0DDD0] px-4 py-3 text-[#A86642]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-[13px] leading-6">{error}</p>
          </div>
        ) : null}

        {warnings.length ? (
          <div className="rounded-[12px] border border-[#F0DDD0] bg-[#FBF3EC] px-4 py-3">
            <p className="bb-mono-label text-[#A86642]">Check before saving</p>
            <ul className="mt-2 grid gap-1 text-[13px] leading-6 text-[#A86642]">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {fields ? (
          <>
            <div className="rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#003C33]" aria-hidden="true" />
                <p className="bb-mono-label">Review extracted details</p>
              </div>
              <p className="mt-1.5 text-[13px] leading-6 text-[#5F625E]">
                Prefilled from the PDF. Correct anything before saving — these map to the same fields
                as creating a listing manually.
              </p>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <TextInput
                  label="Builder / shipyard"
                  onChange={(event) => updateField("builder", event.target.value)}
                  placeholder="SACS"
                  value={fields.builder}
                />
                <TextInput
                  label="Model"
                  onChange={(event) => updateField("model", event.target.value)}
                  placeholder="Rebel 47"
                  value={fields.model}
                />
                <TextInput
                  inputMode="numeric"
                  label="Year"
                  onChange={(event) => updateField("year", event.target.value)}
                  placeholder="2025"
                  value={fields.year}
                />
                <TextInput
                  inputMode="numeric"
                  label="Length overall (ft)"
                  onChange={(event) => updateField("lengthFt", event.target.value)}
                  placeholder="46"
                  value={fields.lengthFt}
                />
                <TextInput
                  inputMode="numeric"
                  label="Cabins"
                  onChange={(event) => updateField("cabins", event.target.value)}
                  placeholder="2"
                  value={fields.cabins}
                />
                <TextInput
                  label="Engines"
                  onChange={(event) => updateField("engines", event.target.value)}
                  placeholder="2× Volvo Penta D6-440"
                  value={fields.engines}
                />
                <LabeledSelect
                  label="Propulsion"
                  onChange={(value) => updateField("propulsion", value)}
                  options={PROPULSION_OPTIONS}
                  value={fields.propulsion}
                />
                <LabeledSelect
                  label="Condition"
                  onChange={(value) => updateField("condition", value)}
                  options={CONDITION_OPTIONS}
                  value={fields.condition}
                />
                <TextInput
                  inputMode="numeric"
                  label="Engine hours"
                  onChange={(event) => updateField("engineHours", event.target.value)}
                  placeholder="690"
                  value={fields.engineHours}
                />
                <LabeledSelect
                  label="VAT status"
                  onChange={(value) => updateField("vatStatus", value)}
                  options={VAT_OPTIONS}
                  value={fields.vatStatus || "Unknown"}
                />
                <TextInput
                  inputMode="numeric"
                  label="Asking price EUR"
                  onChange={(event) => updateField("priceEur", event.target.value)}
                  placeholder="1020000"
                  value={fields.priceEur}
                />
                <TextInput
                  label="Location / marina"
                  onChange={(event) => updateField("location", event.target.value)}
                  placeholder="Le Barcarès, FR"
                  value={fields.location}
                />
              </div>

              <div className="mt-4 grid gap-4">
                <LabeledTextarea
                  label="Description"
                  onChange={(value) => updateField("description", value)}
                  rows={6}
                  value={fields.description}
                />
                <LabeledTextarea
                  helper="Specs and equipment captured from the PDF. Saved with the listing for reference."
                  label="Specs & equipment"
                  onChange={(value) => updateField("equipment", value)}
                  rows={5}
                  value={fields.equipment}
                />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="bb-mono-label">Photos from PDF</p>
                <span className="text-[12px] text-[#8E918B]">
                  {photos.length} image{photos.length === 1 ? "" : "s"} · saved to your storage on import
                </span>
              </div>
              {photos.length ? (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((photo, index) => (
                    <div
                      className="relative aspect-[3/2] overflow-hidden rounded-[10px] border border-[#E7E7E7] bg-[#F1F2EE]"
                      key={`${photo.name}-${index}`}
                    >
                      {/* Data-URL preview; next/image isn't needed for in-memory base64. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={photo.name} className="h-full w-full object-cover" src={photo.dataUrl} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-[#8E918B]">
                  No photos were found in this PDF. You can add photos after creating the listing.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E7E7E7] pt-5">
              <SaveModeToggle active={saveActive} onChange={setSaveActive} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={reset} type="button" variant="secondary">
                  Clear
                </Button>
                <Button disabled={isSaving} onClick={() => void saveListing()} type="button">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isSaving ? "Saving…" : saveActive ? "Create active listing" : "Save as draft"}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {completion ? (
        <PdfImportCompleteDialog
          listingId={completion.id}
          onClose={() => setCompletion(null)}
          onNewImport={reset}
          onSeeListing={() => router.push(`/listings/${completion.id}`)}
          status={completion.status}
        />
      ) : null}
    </Card>
  );
}

function PdfFileInput({
  disabled,
  fileName,
  isParsing,
  onChange,
}: {
  disabled: boolean;
  fileName: string | null;
  isParsing: boolean;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="grid cursor-pointer gap-3 rounded-[12px] border border-dashed border-[#D9DAD4] bg-[#F1F2EE] p-5 transition-colors hover:border-[#003C33]">
      <span className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#003C33]">
          {isParsing ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="h-5 w-5" aria-hidden="true" />
          )}
        </span>
        <span>
          <span className="block text-sm font-semibold text-[#171719]">Listing PDF</span>
          <span className="mt-0.5 block text-[12px] text-[#8E918B]">
            One boat per PDF · we read specs and photos
          </span>
        </span>
      </span>
      <span className="rounded-[12px] border border-[#E7E7E7] bg-white px-3 py-2 text-[13px] font-medium text-[#5F625E]">
        {isParsing ? "Reading PDF…" : fileName ?? "No file selected"}
      </span>
      <input
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        type="file"
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">{label}</span>
      <SelectMenu onChange={onChange} options={options} value={value} />
    </div>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  rows = 4,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  helper?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">{label}</span>
      <textarea
        className="w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 py-2.5 text-[14px] leading-6 text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
      {helper ? <span className="text-xs text-[#8E918B]">{helper}</span> : null}
    </label>
  );
}

function SaveModeToggle({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="bb-mono-label">Save as</span>
      <div className="grid h-9 grid-cols-2 overflow-hidden rounded-[8px] border border-[#D9DAD4] bg-white">
        <button
          className={
            !active
              ? "bg-[#003C33] px-4 text-[13px] font-medium text-white"
              : "px-4 text-[13px] font-medium text-[#5F625E]"
          }
          onClick={() => onChange(false)}
          type="button"
        >
          Draft
        </button>
        <button
          className={
            active
              ? "bg-[#003C33] px-4 text-[13px] font-medium text-white"
              : "px-4 text-[13px] font-medium text-[#5F625E]"
          }
          onClick={() => onChange(true)}
          type="button"
        >
          Active
        </button>
      </div>
    </div>
  );
}

function PdfImportCompleteDialog({
  listingId,
  onClose,
  onNewImport,
  onSeeListing,
  status,
}: {
  listingId: string;
  onClose: () => void;
  onNewImport: () => void;
  onSeeListing: () => void;
  status: string;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      aria-labelledby="pdf-import-complete-title"
      aria-modal="true"
      className="bb-overlay-enter fixed inset-0 z-[80] flex items-center justify-center bg-[#171719]/30 p-5 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="bb-dialog-enter w-full max-w-md rounded-[16px] border border-[#E7E7E7] bg-white p-7 shadow-[0_24px_64px_rgba(23,25,28,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#E1F1EA] text-[#0F8F62]">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3
          id="pdf-import-complete-title"
          className="bb-display mt-5 text-xl font-medium text-[#171719]"
        >
          Listing created
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#5F625E]">
          The listing was saved as a {status === "Active" ? "live listing" : "draft"} with its photos
          stored to your workspace. {listingId ? "" : ""}Review it before sharing.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
          <Button className="sm:flex-1" onClick={onSeeListing} type="button">
            See listing
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button className="sm:flex-1" onClick={onNewImport} type="button" variant="secondary">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            New PDF import
          </Button>
        </div>
      </div>
    </div>
  );
}
