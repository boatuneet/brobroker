import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildImportedPhoto,
  clean,
  normalizeYachtImageRows,
  normalizeYachtImport,
  type YachtCsvRow,
  type YachtImageCsvRow,
} from "@/lib/yacht-csv-import";

export const dynamic = "force-dynamic";

const IMAGE_CONCURRENCY = 3;
const MAX_YACHTS_PER_REQUEST = 20;

type ImportRequestBody = {
  yachts?: YachtCsvRow[];
  images?: YachtImageCsvRow[];
};

type ImportFailure = {
  id: string;
  reason: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Sign in before importing yacht listings." }, { status: 401 });
  }

  let body: ImportRequestBody;
  try {
    body = (await request.json()) as ImportRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid import payload." }, { status: 400 });
  }

  const yachtRows = Array.isArray(body.yachts) ? body.yachts.slice(0, MAX_YACHTS_PER_REQUEST) : [];
  const imageRows = Array.isArray(body.images) ? body.images : [];

  if (!yachtRows.length) {
    return NextResponse.json({ error: "No yacht rows supplied for this batch." }, { status: 400 });
  }

  const imagesByYachtId = normalizeYachtImageRows(imageRows);
  const failures: ImportFailure[] = [];
  let imported = 0;
  let imagesCopied = 0;
  let imagesFailed = 0;

  for (const row of yachtRows) {
    const normalized = normalizeYachtImport(row);
    if (!normalized) {
      failures.push({ id: clean(row.id) || "unknown-row", reason: "Missing yacht id." });
      continue;
    }

    const sourceImages = imagesByYachtId.get(normalized.sourceId) ?? [];
    const photoResults = await mapWithConcurrency(sourceImages, IMAGE_CONCURRENCY, (image) =>
      copyImportedImage({
        assetId: normalized.assetId,
        image,
        supabase,
        userId: user.id,
      }),
    );
    const photos = photoResults.flatMap((result) => {
      if (result.ok) {
        imagesCopied += 1;
        return [result.photo];
      }
      imagesFailed += 1;
      failures.push({ id: normalized.sourceId, reason: result.reason });
      return [];
    });

    const highlights = [
      normalized.condition,
      normalized.propulsion,
      normalized.location,
    ].filter(Boolean);

    const { error } = await supabase.from("assets").upsert(
      {
        id: normalized.assetId,
        owner_user_id: user.id,
        asset_type: "Yacht",
        name: normalized.name,
        builder: normalized.builder,
        model: normalized.model,
        year: normalized.year,
        price_eur: normalized.priceEur,
        metric_value: normalized.lengthFt,
        metric_label: "ft",
        location: normalized.location,
        vat_status: normalized.vatStatus,
        status: "Active",
        seller_id: null,
        spec_summary: normalized.specSummary,
        documents: [],
        comps: [],
        faqs: [],
        objections: [],
        missing_info: [],
        owner_notes: [],
        broker_only_notes: ["Imported from CSV for broker review."],
        market_signals: [],
        payload: {
          availability: "To confirm",
          exteriorTone: normalized.condition || undefined,
          interiorStyle: "To confirm",
          refitHistory: [],
          highlights,
          weaknesses: [],
          idealBuyer: "Qualified buyer to confirm after broker review.",
          coreFacts: normalized.coreFacts,
          photos,
          fields: normalized.fields,
          importSource: normalized.importSource,
        },
      },
      { onConflict: "id" },
    );

    if (error) {
      failures.push({ id: normalized.sourceId, reason: error.message });
      continue;
    }

    imported += 1;
  }

  return NextResponse.json({
    imported,
    requested: yachtRows.length,
    imagesCopied,
    imagesFailed,
    failures: failures.slice(0, 25),
    failureCount: failures.length,
  });
}

async function copyImportedImage({
  assetId,
  image,
  supabase,
  userId,
}: {
  assetId: string;
  image: YachtImageCsvRow;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}) {
  const imageUrl = clean(image.image_url);
  if (!imageUrl) return { ok: false as const, reason: "Image row has no URL." };

  try {
    const response = await fetchWithTimeout(imageUrl);
    if (!response.ok) {
      return { ok: false as const, reason: `Image fetch failed: ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || inferContentType(imageUrl);
    const bytes = await response.arrayBuffer();
    const storagePath = `${userId}/listing-photos/${assetId}/${buildImageFileName(image)}`;
    const { error } = await supabase.storage.from("broker-documents").upload(storagePath, bytes, {
      contentType,
      upsert: true,
    });

    if (error) return { ok: false as const, reason: `Image upload failed: ${error.message}` };

    return {
      ok: true as const,
      photo: buildImportedPhoto(image, imageUrl, storagePath),
    };
  } catch (error) {
    return {
      ok: false as const,
      reason: error instanceof Error ? error.message : "Image copy failed.",
    };
  }
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function buildImageFileName(image: YachtImageCsvRow) {
  const position = clean(image.position) || "0";
  const sourceName = clean(image.storage_path).split("/").pop() || clean(image.image_url).split("/").pop() || "image.jpg";
  const extension = sourceName.match(/\.[a-z0-9]+$/i)?.[0] ?? ".jpg";
  const id = clean(image.id) || crypto.randomUUID();
  return `${id}-${position}${extension}`.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
}

function inferContentType(url: string) {
  if (/\.webp($|\?)/i.test(url)) return "image/webp";
  if (/\.png($|\?)/i.test(url)) return "image/png";
  return "image/jpeg";
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
