import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EditableListingPayload } from "@/lib/listing-edit";
import type { ListingPhoto } from "@/lib/types";

type UpdateRequest = {
  listing: EditableListingPayload;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Sign in before editing this listing." }, { status: 401 });
  }

  let body: UpdateRequest;
  try {
    body = (await request.json()) as UpdateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid listing update payload." }, { status: 400 });
  }

  const listing = body.listing;
  if (!listing || listing.id !== id) {
    return NextResponse.json({ error: "Listing update id mismatch." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("assets")
    .select("payload, documents, comps, faqs, objections, missing_info, owner_notes, broker_only_notes, market_signals, seller_id")
    .eq("id", id)
    .maybeSingle();
  const existingPayload = asRecord(existing?.payload);
  const existingFields = asRecord(existingPayload.fields);
  const existingPhotos = Array.isArray(existingPayload.photos) ? (existingPayload.photos as ListingPhoto[]) : [];
  const incomingPhotos = Array.isArray(listing.photos) ? listing.photos : [];

  const { error } = await supabase.from("assets").upsert(
    {
      id,
      owner_user_id: user.id,
      asset_type: listing.segment,
      name: listing.name,
      builder: listing.builder,
      model: listing.model,
      year: listing.year,
      price_eur: listing.priceEur,
      metric_value: listing.metricValue,
      metric_label: listing.metricLabel,
      location: listing.location,
      vat_status: listing.vatStatus,
      status: "Active",
      seller_id: existing?.seller_id ?? null,
      spec_summary: listing.specSummary,
      documents: existing?.documents ?? [],
      comps: existing?.comps ?? [],
      faqs: existing?.faqs ?? [],
      objections: existing?.objections ?? [],
      missing_info: existing?.missing_info ?? [],
      owner_notes: existing?.owner_notes ?? [],
      broker_only_notes: existing?.broker_only_notes ?? [],
      market_signals: existing?.market_signals ?? [],
      payload: {
        ...existingPayload,
        fields: {
          ...existingFields,
          ...listing.fields,
        },
        coreFacts: listing.coreFacts,
        photos: existingPhotos.length ? existingPhotos : incomingPhotos,
        highlights: splitLines(listing.fields.buyerSafeHighlights) ?? existingPayload.highlights ?? [],
        weaknesses: splitLines(listing.fields.knownWeaknesses) ?? existingPayload.weaknesses ?? [],
        idealBuyer: stringField(listing.fields.idealBuyer) || existingPayload.idealBuyer || "Qualified buyer to confirm after broker review.",
      },
    },
    { onConflict: "id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function splitLines(value: unknown) {
  const text = stringField(value);
  if (!text) return undefined;
  return text
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}
