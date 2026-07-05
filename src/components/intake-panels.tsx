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
import { Badge, Button, Card, CardHeader, TextInput } from "./ui";
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
        <div className="grid gap-4 border-b border-[#E7E7E7] px-6 py-5 lg:grid-cols-3">
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
        <ul className="divide-y divide-[#E7E7E7]">
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

/* Shared hook for the local (session) buyer captures — SSR + first client
   render emit an empty list, then useSyncExternalStore swaps in the
   persisted one. Exposed so the Buyers index can show the tab count. */
export function useSessionBuyers(): SessionBuyer[] {
  return useSyncExternalStore(
    subscribeBuyers,
    getBuyersClientSnapshot,
    getBuyersServerSnapshot,
  );
}

/* `bare` renders just the capture list (+ empty state + edit drawer) with no
   card/header chrome — used inside the Buyers-index tab, which supplies its
   own heading. Standalone (default) keeps the framed card and returns null
   when there are no captures. */
export function SessionBuyerQueue({ bare = false }: { bare?: boolean }) {
  const buyers = useSessionBuyers();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SessionBuyer | null>(null);

  if (!bare && !buyers.length) {
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

  const list = buyers.length ? (
    <ul className="divide-y divide-[#E7E7E7]">
        {buyers.slice(0, 6).map((buyer) => (
          <li key={buyer.id} className="px-5 py-4">
            {/* Title + badges on the left; compact icon actions pinned top-right. */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-[17px] font-semibold tracking-[-0.02em] text-[#171719]">
                  {buyer.name}
                </h4>
                <span className="inline-flex items-center rounded-[8px] bg-[#E1F1EA] px-2.5 py-1 text-[12px] font-semibold text-[#0F8F62]">
                  Saved memory
                </span>
                <span className="inline-flex items-center rounded-[8px] border border-[#E7E7E7] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#5F625E]">
                  {buyer.source}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  aria-label={`Edit ${buyer.name}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-[#E7E7E7] bg-white text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
                  onClick={() => beginEdit(buyer)}
                  title="Edit"
                  type="button"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  aria-label={`Remove ${buyer.name}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#b30000] text-white transition-colors hover:bg-[#8d0000] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b30000]"
                  onClick={() => removeBuyer(buyer.id)}
                  title="Remove"
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[#5F625E]">
              {buyer.summary}
            </p>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8E918B]">
              {[buyer.budgetLabel, buyer.urgency].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
  ) : (
    <div className="px-5 py-14 text-center">
      <p className="text-[14px] font-semibold text-[#171719]">No local captures yet</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-6 text-[#8E918B]">
        Drafts created from Voice CRM or matching land here before they become full buyer
        profiles.
      </p>
    </div>
  );

  const drawer =
    editingId && draft ? (
      <EditCaptureDrawer
        draft={draft}
        onChange={updateDraft}
        onClose={cancelEdit}
        onSave={saveDraft}
      />
    ) : null;

  // Bare: list only, for embedding inside the Buyers-index tab.
  if (bare) {
    return (
      <>
        {list}
        {drawer}
      </>
    );
  }

  return (
    <article className="mt-8 overflow-hidden rounded-[12px] border border-[#E7E7E7] bg-white text-[#171719] shadow-[0_14px_38px_rgba(23,31,25,0.05)]">
      {/* Header — icon + eyebrow + title on the left, descriptor on the right. */}
      <div className="flex flex-col gap-4 border-b border-[#E7E7E7] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[8px] bg-[#F1F2EE] text-[#003C33]">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#8E918B]">
              Captured memory
            </p>
            <h3 className="bb-display mt-1 truncate text-[24px] font-semibold tracking-[-0.03em] text-[#171719]">
              Local CRM captures
            </h3>
          </div>
        </div>
        <p className="max-w-xl text-[13px] leading-6 text-[#5F625E] lg:text-right">
          Drafts created from Voice CRM or matching before they become full buyer profiles.
        </p>
      </div>
      {list}
      {drawer}
    </article>
  );
}

/* Right-side drawer for editing a capture — the dimmed overlay makes it
   unambiguous which record is being edited. Fields use the 16px-radius
   inputs (TextInput / SelectMenu / textarea), not pill shapes. */
function EditCaptureDrawer({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: SessionBuyer;
  onChange: (key: keyof SessionBuyer, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div
      aria-modal="true"
      className="bb-overlay-enter fixed inset-0 z-[80] bg-[#171719]/30 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="bb-drawer-enter absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[#E7E7E7] bg-white shadow-[0_0_64px_rgba(23,31,25,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E7E7E7] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#171719]">Edit capture</h2>
            <p className="mt-0.5 text-[12px] text-[#8E918B]">
              Update this local memory before it becomes a full buyer.
            </p>
          </div>
          <button
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#8E918B] transition-colors hover:bg-[#F1F2EE] hover:text-[#171719]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <TextInput
            label="Buyer name"
            onChange={(event) => onChange("name", event.target.value)}
            value={draft.name}
          />
          <TextInput
            label="Budget memory"
            onChange={(event) => onChange("budgetLabel", event.target.value)}
            value={draft.budgetLabel ?? ""}
          />
          <SelectMenu
            label="Urgency"
            onChange={(value) => onChange("urgency", value)}
            options={[
              { label: "High", value: "High" },
              { label: "Medium", value: "Medium" },
              { label: "Low", value: "Low" },
            ]}
            value={draft.urgency ?? "Medium"}
          />
          <label className="grid gap-1.5 text-sm font-medium text-[#171719]">
            <span>Summary</span>
            <textarea
              className="min-h-28 resize-none rounded-[10px] border border-[#D9DAD4] bg-white px-3 py-2.5 text-[14px] leading-[1.55] text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
              onChange={(event) => onChange("summary", event.target.value)}
              value={draft.summary}
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E7E7E7] px-5 py-4">
          <Button onClick={onClose} type="button" variant="secondary">
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
          <Button onClick={onSave} type="button">
            <Save className="h-4 w-4" aria-hidden="true" />
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

export function BuyerIntakePanel() {
  return <SessionBuyerQueue />;
}
