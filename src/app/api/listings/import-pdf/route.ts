import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { chatComplete, hasOpenAI } from "@/lib/openai-server";
import {
  extractPdfJpegs,
  mapYachtPdfText,
  type ParsedYachtFields,
} from "@/lib/yacht-pdf-import";
import type { ListingPhoto, ListingStatus, VatStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
// Photos are processed in-memory and uploaded to storage; allow generous time.
export const maxDuration = 60;

const VAT_VALUES: VatStatus[] = ["EU VAT Paid", "Not Paid", "Unknown", "Commercial"];
const PHOTO_SIGNED_URL_SECONDS = 60 * 60;

async function extractFromPdf(bytes: Uint8Array) {
  // pdf.js (inside unpdf) detaches the typed array it receives, so each
  // consumer gets its own copy of the bytes.
  const images = extractPdfJpegs(Uint8Array.from(bytes));
  const pdf = await getDocumentProxy(Uint8Array.from(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  const parsed = mapYachtPdfText(text);
  return { parsed, images };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Sign in before importing a listing PDF." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a PDF file to import." }, { status: 400 });
  }
  if (file.type && !file.type.includes("pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mode = String(form.get("mode") ?? "parse");

  let extracted;
  try {
    extracted = await extractFromPdf(bytes);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? `Could not read the PDF: ${error.message}` : "Could not read the PDF." },
      { status: 422 },
    );
  }
  const { parsed, images } = extracted;

  /* ---- Parse mode: return prefill fields + photo previews -------------- */
  if (mode !== "commit") {
    // Reformat the raw specs/equipment into clean markdown so the review form
    // (and the saved listing) reads as a tidy spec sheet. Best-effort: falls
    // back to the raw text if there's no OpenAI key or the call fails.
    const formattedSpecs = await formatSpecsWithAI(parsed.fields.equipment, parsed.fields.description);
    const fields: ParsedYachtFields = { ...parsed.fields, equipment: formattedSpecs };

    const photos = images.map((image, index) => ({
      name: `Photo ${index + 1}`,
      bytes: image.bytes,
      dataUrl: `data:image/jpeg;base64,${Buffer.from(image.data).toString("base64")}`,
    }));
    return NextResponse.json({
      fields,
      warnings: parsed.warnings,
      photos,
      imageCount: images.length,
    });
  }

  /* ---- Commit mode: persist the (possibly edited) listing -------------- */
  const editedRaw = form.get("fields");
  const edited = parseEditedFields(typeof editedRaw === "string" ? editedRaw : "", parsed.fields);
  const saveActive = String(form.get("saveMode") ?? "draft") === "active";
  const status: ListingStatus = saveActive ? "Active" : "Draft";

  const assetId = `imported-pdf-yacht-${user.id}-${crypto.randomUUID()}`;
  const builder = edited.builder.trim() || "Unknown builder";
  const model = edited.model.trim() || "Model to confirm";
  const year = toInt(edited.year);
  const name = [year, builder, model].filter(Boolean).join(" ").trim() || `${builder} ${model}`;
  const priceEur = toInt(edited.priceEur) ?? 0;
  const lengthFt = toNumber(edited.lengthFt);
  const vatStatus: VatStatus = VAT_VALUES.includes(edited.vatStatus as VatStatus)
    ? (edited.vatStatus as VatStatus)
    : "Unknown";
  const specSummary = buildSpecSummary(edited);
  const coreFacts = buildCoreFacts(edited);
  const highlights = buildHighlights(edited);

  // Upload extracted photos to the broker-documents bucket (same convention
  // as the manual intake + CSV importer).
  const storedPhotos: ListingPhoto[] = [];
  let photosFailed = 0;
  for (let index = 0; index < images.length; index += 1) {
    const path = `${user.id}/listing-photos/${assetId}/pdf-${index + 1}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("broker-documents")
      .upload(path, Buffer.from(images[index].data), { contentType: "image/jpeg", upsert: true });
    if (uploadError) {
      photosFailed += 1;
      continue;
    }
    const { data } = await supabase.storage
      .from("broker-documents")
      .createSignedUrl(path, PHOTO_SIGNED_URL_SECONDS);
    storedPhotos.push({
      id: `${assetId}-photo-${index + 1}`,
      src: data?.signedUrl ?? "",
      alt: `${name} photo ${index + 1}`,
      name: `Photo ${index + 1}`,
      storagePath: path,
    });
  }

  const brokerOnlyNotes = ["Imported from a listing PDF; review before sharing."];
  if (edited.equipment.trim()) {
    brokerOnlyNotes.push("Specs & equipment captured from the PDF are stored on this listing.");
  }

  const { error: insertError } = await supabase.from("assets").insert({
    id: assetId,
    owner_user_id: user.id,
    asset_type: "Yacht",
    name,
    builder,
    model,
    year: year ?? null,
    price_eur: priceEur,
    metric_value: lengthFt ?? null,
    metric_label: "ft",
    location: edited.location.trim() || "Location to confirm",
    vat_status: vatStatus,
    status,
    seller_id: null,
    spec_summary: specSummary || null,
    description: edited.description.trim() || null,
    specifications: edited.equipment.trim() || null,
    documents: [],
    comps: [],
    faqs: [],
    objections: [],
    missing_info: [],
    owner_notes: [],
    broker_only_notes: brokerOnlyNotes,
    market_signals: [],
    payload: {
      availability: "To confirm",
      highlights,
      coreFacts,
      photos: storedPhotos,
      description: edited.description.trim() || undefined,
      importSource: { kind: "pdf", fileName: file.name },
      fields: {
        ...edited,
        propulsion: edited.propulsion,
        condition: edited.condition,
      },
    },
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: assetId,
    status,
    photosStored: storedPhotos.length,
    photosFailed,
  });
}

/* Reformat the raw, run-on specs text into clean markdown (## sections, "- "
   bullets). Reconciles missing numbers from the description when present, and
   is instructed never to invent values. Returns the raw text unchanged when
   OpenAI isn't configured or the call fails. */
async function formatSpecsWithAI(rawSpecs: string, description: string): Promise<string> {
  const specs = rawSpecs.trim();
  if (!specs || !hasOpenAI()) return specs;

  const result = await chatComplete(
    [
      {
        role: "system",
        content:
          "You format raw boat-listing specifications into clean Markdown for a brokerage listing. " +
          "Use '## Section' headings (e.g. Engines, Dimensions, Tanks, Electronics, Inside equipment, " +
          "Deck, Helm station, Cockpit, Cabins, Electrical system, Water system, Fuel system, Safety, Colors) " +
          "and '- ' bullets for individual items. For spec values use '- Label: Value'. " +
          "CRITICAL: only use facts present in the provided text — never invent or guess values. " +
          "If a spec's number is missing but clearly stated in the DESCRIPTION, you may fill it in from there. " +
          "Drop empty/unknown fields and legal disclaimers. Keep wording concise. " +
          "Output ONLY the Markdown, with no preamble or commentary.",
      },
      {
        role: "user",
        content: `DESCRIPTION (context for missing numbers):\n${description.slice(0, 2500)}\n\nRAW SPECIFICATIONS TO FORMAT:\n${specs.slice(0, 6000)}`,
      },
    ],
    { temperature: 0.1, maxTokens: 1200 },
  );

  const formatted = result?.trim();
  // Sanity-check the model actually returned structured markdown.
  return formatted && /(^|\n)\s*(#{1,3}\s|-\s)/.test(formatted) ? formatted : specs;
}

function parseEditedFields(raw: string, fallback: ParsedYachtFields): ParsedYachtFields {
  let parsed: Partial<Record<keyof ParsedYachtFields, unknown>> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as typeof parsed) : {};
  } catch {
    parsed = {};
  }
  const read = (key: keyof ParsedYachtFields) =>
    typeof parsed[key] === "string" ? (parsed[key] as string) : fallback[key];
  return {
    builder: read("builder"),
    model: read("model"),
    year: read("year"),
    lengthFt: read("lengthFt"),
    cabins: read("cabins"),
    engines: read("engines"),
    propulsion: read("propulsion"),
    condition: read("condition"),
    engineHours: read("engineHours"),
    vatStatus: read("vatStatus"),
    priceEur: read("priceEur"),
    location: read("location"),
    description: read("description"),
    equipment: read("equipment"),
  };
}

function buildSpecSummary(f: ParsedYachtFields): string {
  return [
    f.lengthFt ? `${f.lengthFt}ft` : "",
    f.cabins ? `${f.cabins} cabins` : "",
    f.engineHours ? `${f.engineHours}h` : "",
    f.location,
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildCoreFacts(f: ParsedYachtFields): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: string) => {
    if (value.trim()) facts.push({ label, value: value.trim() });
  };
  add("Builder", f.builder);
  add("Model", f.model);
  add("Year", f.year);
  add("Length", f.lengthFt ? `${f.lengthFt} ft` : "");
  add("Cabins", f.cabins);
  add("Engines", f.engines);
  add("Propulsion", f.propulsion);
  add("Condition", f.condition);
  return facts;
}

function buildHighlights(f: ParsedYachtFields): string[] {
  return [
    f.condition,
    f.propulsion,
    f.cabins ? `${f.cabins} cabins` : "",
    f.vatStatus && f.vatStatus !== "Unknown" ? f.vatStatus : "",
  ].filter((value): value is string => Boolean(value && value.trim()));
}

function toInt(value: string): number | undefined {
  const n = Number(String(value).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function toNumber(value: string): number | undefined {
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
