"use client";

import { useState, useSyncExternalStore } from "react";
import { Clock3, Pencil, PlusCircle, Save, Trash2, X } from "lucide-react";
import {
  deleteSessionBuyer,
  readPersisted,
  saveSessionAsset,
  saveSessionBuyer,
  type SessionAsset,
  type SessionBuyer,
} from "@/lib/browser-persistence";
import { formatCurrency } from "@/lib/utils";
import { Badge, Button, Card, CardHeader, CardHeaderIcon, TextInput } from "./ui";
import { SelectMenu } from "./select-menu";

// Session buyer store — SSR + first client render must agree, so we emit a
// stable empty snapshot on the server and switch to the persisted list once
// useSyncExternalStore subscribes on the client. Mutations dispatch a custom
// event so every mounted subscriber re-reads localStorage.
const BUYERS_KEY = "brobroker:buyers:session";
const BUYERS_CHANGED = "brobroker:buyers:session:changed";
const EMPTY_BUYERS: SessionBuyer[] = [];

let cachedBuyersRaw: string | null = null;
let cachedBuyersSnapshot: SessionBuyer[] = EMPTY_BUYERS;

function subscribeBuyers(notify: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", notify);
  window.addEventListener(BUYERS_CHANGED, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(BUYERS_CHANGED, notify);
  };
}

function getBuyersClientSnapshot(): SessionBuyer[] {
  if (typeof window === "undefined") return EMPTY_BUYERS;
  const raw = window.localStorage.getItem(BUYERS_KEY);
  if (raw === cachedBuyersRaw) return cachedBuyersSnapshot;
  cachedBuyersRaw = raw;
  cachedBuyersSnapshot = readPersisted<SessionBuyer[]>(BUYERS_KEY, EMPTY_BUYERS);
  return cachedBuyersSnapshot;
}

function getBuyersServerSnapshot(): SessionBuyer[] {
  return EMPTY_BUYERS;
}

function notifyBuyersChanged() {
  if (typeof window === "undefined") return;
  // Reset cache so the next snapshot read parses fresh localStorage.
  cachedBuyersRaw = null;
  window.dispatchEvent(new Event(BUYERS_CHANGED));
}

export function AssetIntakePanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [assets, setAssets] = useState<SessionAsset[]>(() =>
    readPersisted<SessionAsset[]>("brobroker:assets:session", []),
  );
  const [assetType, setAssetType] = useState<SessionAsset["assetType"]>("Yacht");
  const [name, setName] = useState("New private listing");
  const [builder, setBuilder] = useState("Builder / marque");
  const [model, setModel] = useState("Model / configuration");
  const [location, setLocation] = useState("Private location");
  const [price, setPrice] = useState("1250000");

  function saveAsset() {
    const parsedPrice = Number(price.replace(/[^\d.]/g, ""));
    const asset = {
      id: `session-asset-${Date.now()}`,
      assetType,
      name: name.trim() || "Untitled asset",
      builder: builder.trim() || "Unknown",
      model: model.trim() || "Unknown",
      location: location.trim() || "Unspecified",
      priceEur: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      status: "Session draft",
      summary: `${assetType} captured manually for broker review.`,
      createdAt: new Date().toISOString(),
    } satisfies SessionAsset;

    setAssets(saveSessionAsset(asset));
    setIsOpen(false);
  }

  return (
    <Card className="mt-8">
      <CardHeader
        eyebrow="Manual intake"
        title="Add listing draft"
        description="Create a durable draft before the full listing brain is ready."
        action={
          <Button onClick={() => setIsOpen((current) => !current)} type="button" variant="secondary">
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {isOpen ? "Close" : "Add listing"}
          </Button>
        }
      />

      {isOpen ? (
        <div className="grid gap-4 border-b border-[#E7E7E2] px-6 py-5 lg:grid-cols-3">
          <SelectMenu
            label="Asset type"
            onChange={(nextValue) => setAssetType(nextValue as SessionAsset["assetType"])}
            options={[
              { label: "Yacht", value: "Yacht" },
              { label: "Car", value: "Car" },
              { label: "Real Estate", value: "Real Estate" },
            ]}
            value={assetType}
          />
          <TextInput label="Listing name" onChange={(event) => setName(event.target.value)} value={name} />
          <TextInput label="Builder / market" onChange={(event) => setBuilder(event.target.value)} value={builder} />
          <TextInput label="Model / configuration" onChange={(event) => setModel(event.target.value)} value={model} />
          <TextInput label="Location" onChange={(event) => setLocation(event.target.value)} value={location} />
          <TextInput label="Price EUR" inputMode="numeric" onChange={(event) => setPrice(event.target.value)} value={price} />
          <div className="flex items-end lg:col-span-3">
            <Button onClick={saveAsset} type="button">
              <Save className="h-4 w-4" aria-hidden="true" />
              Save listing draft
            </Button>
          </div>
        </div>
      ) : null}

      {assets.length ? (
        <ul className="divide-y divide-[#E7E7E2]">
          {assets.slice(0, 4).map((asset) => (
            <li key={asset.id} className="grid gap-3 px-6 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-medium text-[#171719]">{asset.name}</p>
                  <Badge tone="success">Saved draft</Badge>
                  <Badge tone="neutral">{asset.assetType}</Badge>
                </div>
                <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">
                  {asset.builder} {asset.model} · {asset.location}
                </p>
              </div>
              <p className="font-mono text-[13px] font-medium text-[#171719]">
                {formatCurrency(asset.priceEur)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export function SessionBuyerQueue() {
  // SSR + first client render → EMPTY_BUYERS so the rendered tree matches.
  // Once mounted, useSyncExternalStore swaps in the persisted list.
  const buyers = useSyncExternalStore(
    subscribeBuyers,
    getBuyersClientSnapshot,
    getBuyersServerSnapshot,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SessionBuyer | null>(null);

  if (!buyers.length) {
    return null;
  }

  function beginEdit(buyer: SessionBuyer) {
    setEditingId(buyer.id);
    setDraft({ ...buyer });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function updateDraft(key: keyof SessionBuyer, value: string) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function saveDraft() {
    if (!draft) return;
    saveSessionBuyer({
      ...draft,
      name: draft.name.trim() || "New buyer",
      summary: draft.summary.trim() || "Buyer memory captured locally.",
      budgetLabel: draft.budgetLabel?.trim() || "Budget to confirm",
    });
    notifyBuyersChanged();
    cancelEdit();
  }

  function removeBuyer(id: string) {
    deleteSessionBuyer(id);
    notifyBuyersChanged();
    if (editingId === id) cancelEdit();
  }

  return (
    <Card className="mt-8">
      <CardHeader
        eyebrow="Captured memory"
        title="Local CRM captures"
        description="Drafts created from Voice CRM or matching before they become full buyer profiles."
        action={
          <CardHeaderIcon>
            <Clock3 className="h-4 w-4" aria-hidden="true" />
          </CardHeaderIcon>
        }
      />
      <ul className="divide-y divide-[#E7E7E2]">
        {buyers.slice(0, 6).map((buyer) => {
          const isEditing = editingId === buyer.id && draft;

          return (
            <li key={buyer.id} className="px-6 py-4">
              {isEditing ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <TextInput
                    label="Buyer name"
                    onChange={(event) => updateDraft("name", event.target.value)}
                    value={draft.name}
                  />
                  <TextInput
                    label="Budget memory"
                    onChange={(event) => updateDraft("budgetLabel", event.target.value)}
                    value={draft.budgetLabel ?? ""}
                  />
                  <SelectMenu
                    label="Urgency"
                    onChange={(value) => updateDraft("urgency", value)}
                    options={[
                      { label: "High", value: "High" },
                      { label: "Medium", value: "Medium" },
                      { label: "Low", value: "Low" },
                    ]}
                    value={draft.urgency ?? "Medium"}
                  />
                  <TextInput
                    label="Summary"
                    onChange={(event) => updateDraft("summary", event.target.value)}
                    value={draft.summary}
                  />
                  <div className="flex flex-wrap gap-2 lg:col-span-2">
                    <Button onClick={saveDraft} size="sm" type="button">
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Save changes
                    </Button>
                    <Button onClick={cancelEdit} size="sm" type="button" variant="secondary">
                      <X className="h-4 w-4" aria-hidden="true" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-medium text-[#171719]">{buyer.name}</p>
                      <Badge tone="success">Saved memory</Badge>
                      <Badge tone="neutral">{buyer.source}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] leading-6 text-[#5F625E]">{buyer.summary}</p>
                    <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-[#8E918B]">
                      {[buyer.budgetLabel, buyer.urgency].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => beginEdit(buyer)} size="sm" type="button" variant="secondary">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button onClick={() => removeBuyer(buyer.id)} size="sm" type="button" variant="danger">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function BuyerIntakePanel() {
  return <SessionBuyerQueue />;
}
