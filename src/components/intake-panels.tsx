"use client";

import { useState } from "react";
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
        <div className="grid gap-4 border-b border-[#f2f2f2] px-6 py-5 lg:grid-cols-3">
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
        <ul className="divide-y divide-[#f2f2f2]">
          {assets.slice(0, 4).map((asset) => (
            <li key={asset.id} className="grid gap-3 px-6 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] font-medium text-[#17171c]">{asset.name}</p>
                  <Badge tone="success">Saved draft</Badge>
                  <Badge tone="neutral">{asset.assetType}</Badge>
                </div>
                <p className="mt-1 text-[13px] leading-6 text-[#616161]">
                  {asset.builder} {asset.model} · {asset.location}
                </p>
              </div>
              <p className="font-mono text-[13px] font-medium text-[#17171c]">
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
  const [buyers, setBuyers] = useState<SessionBuyer[]>(() =>
    readPersisted<SessionBuyer[]>("brobroker:buyers:session", []),
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
    setBuyers(saveSessionBuyer({
      ...draft,
      name: draft.name.trim() || "New buyer",
      summary: draft.summary.trim() || "Buyer memory captured locally.",
      budgetLabel: draft.budgetLabel?.trim() || "Budget to confirm",
    }));
    cancelEdit();
  }

  function removeBuyer(id: string) {
    setBuyers(deleteSessionBuyer(id));
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
      <ul className="divide-y divide-[#f2f2f2]">
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
                      <p className="text-[14px] font-medium text-[#17171c]">{buyer.name}</p>
                      <Badge tone="success">Saved memory</Badge>
                      <Badge tone="neutral">{buyer.source}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] leading-6 text-[#616161]">{buyer.summary}</p>
                    <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
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
