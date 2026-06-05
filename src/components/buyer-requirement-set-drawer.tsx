"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { RequirementSet } from "@/lib/buyer-requirement-sets";
import type { BuyerProfile } from "@/lib/types";

type AskDefaults = Pick<
  RequirementSet,
  | "budgetMinEur"
  | "budgetMaxEur"
  | "sizeRangeFt"
  | "preferredBrands"
  | "preferredLocations"
  | "mustHaves"
  | "dealBreakers"
  | "urgency"
>;

const URGENCY_OPTIONS: BuyerProfile["urgency"][] = [
  "Immediate",
  "This Quarter",
  "This Season",
  "Exploratory",
];

const fieldClass =
  "min-h-10 w-full rounded-[10px] border border-[#D9DAD4] bg-white px-3 text-[14px] text-[#171719] outline-none placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15";
const labelClass = "block text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]";

function toList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Digits only in state; displayed grouped (e.g. 3,500,000) like the main budget.
function groupDigits(digits: string): string {
  return digits ? Number(digits).toLocaleString("en-GB") : "";
}

/* Mounted only while open (parent conditionally renders it), so the form
   initialises fresh each time it's opened — from the set being edited if any,
   otherwise from the buyer's current ask (defaults). */
export function RequirementSetDrawer({
  defaults,
  editing,
  onClose,
  onSave,
}: {
  defaults: AskDefaults;
  editing?: RequirementSet;
  onClose: () => void;
  onSave: (set: RequirementSet) => void;
}) {
  const seed = editing ?? defaults;
  const [label, setLabel] = useState(editing?.label ?? "");
  const [budgetMin, setBudgetMin] = useState(seed.budgetMinEur ? String(seed.budgetMinEur) : "");
  const [budgetMax, setBudgetMax] = useState(seed.budgetMaxEur ? String(seed.budgetMaxEur) : "");
  const [sizeMin, setSizeMin] = useState(seed.sizeRangeFt?.[0] ? String(seed.sizeRangeFt[0]) : "");
  const [sizeMax, setSizeMax] = useState(seed.sizeRangeFt?.[1] ? String(seed.sizeRangeFt[1]) : "");
  const [brands, setBrands] = useState(seed.preferredBrands.join(", "));
  const [locations, setLocations] = useState(seed.preferredLocations.join(", "));
  const [mustHaves, setMustHaves] = useState(seed.mustHaves.join(", "));
  const [dealBreakers, setDealBreakers] = useState(seed.dealBreakers.join(", "));
  const [urgency, setUrgency] = useState<BuyerProfile["urgency"]>(seed.urgency ?? "Exploratory");

  const canSave = label.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    onSave({
      id: editing?.id ?? `reqset-${Date.now()}`,
      label: label.trim(),
      budgetMinEur: Number(budgetMin) || 0,
      budgetMaxEur: Number(budgetMax) || 0,
      sizeRangeFt: [Number(sizeMin) || 0, Number(sizeMax) || 0],
      preferredBrands: toList(brands),
      preferredLocations: toList(locations),
      mustHaves: toList(mustHaves),
      dealBreakers: toList(dealBreakers),
      urgency,
      active: editing?.active,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <div
      aria-modal="true"
      className="bb-overlay-enter fixed inset-0 z-[90] flex justify-end bg-[#171719]/30 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="bb-drawer-enter flex h-full w-full max-w-md flex-col bg-white shadow-[0_24px_64px_rgba(23,31,25,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#E7E7E7] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#171719]">
              {editing ? "Edit requirement set" : "New requirement set"}
            </h2>
            <p className="mt-0.5 text-[12px] text-[#8E918B]">
              {editing
                ? "Update this ask — matches re-run against it."
                : "A second ask to match this buyer against — pre-filled from their current brief."}
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
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <label className="grid gap-1.5">
            <span className={labelClass}>Set name</span>
            <input
              autoFocus
              className={fieldClass}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Summer charter boat"
              value={label}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className={labelClass}>Budget min (EUR)</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                onChange={(event) => setBudgetMin(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                value={groupDigits(budgetMin)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Budget max (EUR)</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                onChange={(event) => setBudgetMax(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="Any"
                value={groupDigits(budgetMax)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Size min (ft)</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                onChange={(event) => setSizeMin(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                value={sizeMin}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Size max (ft)</span>
              <input
                className={fieldClass}
                inputMode="numeric"
                onChange={(event) => setSizeMax(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="Any"
                value={sizeMax}
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className={labelClass}>Preferred brands</span>
            <input
              className={fieldClass}
              onChange={(event) => setBrands(event.target.value)}
              placeholder="Princess, Sunseeker, Azimut"
              value={brands}
            />
          </label>

          <label className="grid gap-1.5">
            <span className={labelClass}>Preferred locations</span>
            <input
              className={fieldClass}
              onChange={(event) => setLocations(event.target.value)}
              placeholder="Mallorca, Monaco"
              value={locations}
            />
          </label>

          <label className="grid gap-1.5">
            <span className={labelClass}>Must-haves</span>
            <input
              className={fieldClass}
              onChange={(event) => setMustHaves(event.target.value)}
              placeholder="3 cabins, EU VAT paid"
              value={mustHaves}
            />
          </label>

          <label className="grid gap-1.5">
            <span className={labelClass}>Deal-breakers</span>
            <input
              className={fieldClass}
              onChange={(event) => setDealBreakers(event.target.value)}
              placeholder="Commercial registration, dark interior"
              value={dealBreakers}
            />
          </label>

          <label className="grid gap-1.5">
            <span className={labelClass}>Urgency</span>
            <select
              className={fieldClass}
              onChange={(event) => setUrgency(event.target.value as BuyerProfile["urgency"])}
              value={urgency}
            >
              {URGENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[12px] leading-5 text-[#8E918B]">
            Tip: leave a budget or size field empty to mean &ldquo;no limit&rdquo; on that side.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#E7E7E7] px-5 py-4">
          <button
            className="inline-flex min-h-10 items-center rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33]"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#003C33] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0a4a3f] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSave}
            onClick={handleSave}
            type="button"
          >
            {editing ? "Save changes" : "Save requirement set"}
          </button>
        </footer>
      </div>
    </div>
  );
}
