"use client";

import { useState, useSyncExternalStore } from "react";
import { Pencil, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui";
import {
  type CriterionWeight,
  type RerankConfig,
  WEIGHT_OPTIONS,
  getRerankConfigServerSnapshot,
  getRerankConfigSnapshot,
  subscribeRerankConfig,
  writeRerankConfig,
} from "@/lib/rerank-config";

const WEIGHT_LABEL: Record<CriterionWeight, string> = {
  off: "Off",
  low: "Low",
  medium: "Med",
  high: "High",
};

function weightBadgeClass(weight: CriterionWeight) {
  if (weight === "high") return "border-[#E1F1EA] bg-[#E1F1EA] text-[#0F8F62]";
  if (weight === "medium") return "border-[#cfdcfa] bg-[#f1f5ff] text-[#1448a8]";
  if (weight === "low") return "border-[#E7E7E7] bg-white text-[#5F625E]";
  return "border-[#E7E7E7] bg-[#F1F2EE] text-[#A9ABA5]";
}

export function RerankConfigCard() {
  const config = useSyncExternalStore(
    subscribeRerankConfig,
    getRerankConfigSnapshot,
    getRerankConfigServerSnapshot,
  );
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader
        eyebrow="Matching"
        title="AI re-rank logic"
        description="How the buyer-match agent weighs criteria when it re-ranks listings. Applies to the 'Re-rank with AI' action on a buyer."
        action={
          <button
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
            onClick={() => setEditing(true)}
            type="button"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
        }
      />

      <div className="grid gap-4 px-6 py-5">
        <ul className="grid gap-2 sm:grid-cols-2">
          {config.criteria.map((criterion) => (
            <li
              className="flex items-center justify-between gap-3 rounded-[8px] border border-[#E7E7E7] bg-white px-3 py-2"
              key={criterion.id}
            >
              <span className="text-[13px] font-medium text-[#171719]">{criterion.label}</span>
              <span
                className={cn(
                  "inline-flex min-h-6 items-center rounded-[8px] border px-2 text-[11px] font-semibold uppercase tracking-[0.08em]",
                  weightBadgeClass(criterion.weight),
                )}
              >
                {WEIGHT_LABEL[criterion.weight]}
              </span>
            </li>
          ))}
        </ul>

        <div className="rounded-[8px] border border-[#E7E7E7] bg-[#FBFBFB] px-3 py-2.5 text-[12.5px] leading-[1.6] text-[#5F625E]">
          <span className="font-semibold text-[#171719]">Deal-breakers: </span>
          {config.hardBlockDealBreakers ? "hard block (ranked last)" : "soft negative signal"}
          {config.guidance.trim() ? (
            <>
              <span className="mt-1.5 block font-semibold text-[#171719]">Guidance</span>
              <span className="block">{config.guidance.trim()}</span>
            </>
          ) : null}
        </div>
      </div>

      {editing ? (
        <RerankConfigDrawer
          config={config}
          onClose={() => setEditing(false)}
          onSave={(next) => {
            writeRerankConfig(next);
            setEditing(false);
          }}
        />
      ) : null}
    </Card>
  );
}

function RerankConfigDrawer({
  config,
  onClose,
  onSave,
}: {
  config: RerankConfig;
  onClose: () => void;
  onSave: (next: RerankConfig) => void;
}) {
  const [draft, setDraft] = useState<RerankConfig>(() => ({
    ...config,
    criteria: config.criteria.map((criterion) => ({ ...criterion })),
  }));

  const setWeight = (id: string, weight: CriterionWeight) =>
    setDraft((current) => ({
      ...current,
      criteria: current.criteria.map((criterion) =>
        criterion.id === id ? { ...criterion, weight } : criterion,
      ),
    }));

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
            <h2 className="text-[15px] font-semibold text-[#171719]">Edit re-rank logic</h2>
            <p className="mt-0.5 text-[12px] text-[#8E918B]">
              Set how the AI agent weighs each signal when ranking matches.
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
          <div className="space-y-2.5">
            {draft.criteria.map((criterion) => (
              <div className="flex items-center justify-between gap-3" key={criterion.id}>
                <span className="text-[13px] font-medium text-[#171719]">{criterion.label}</span>
                <WeightControl onChange={(weight) => setWeight(criterion.id, weight)} value={criterion.weight} />
              </div>
            ))}
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[10px] border border-[#E7E7E7] bg-[#FBFBFB] p-3.5">
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-[#171719]">Hard-block deal-breakers</span>
              <span className="mt-1 block text-[12px] leading-5 text-[#5F625E]">
                When on, any listing that conflicts with a buyer deal-breaker is ranked last.
              </span>
            </span>
            <input
              checked={draft.hardBlockDealBreakers}
              className="peer sr-only"
              onChange={(event) => setDraft((current) => ({ ...current, hardBlockDealBreakers: event.target.checked }))}
              type="checkbox"
            />
            <span
              aria-hidden="true"
              className="relative h-7 w-12 shrink-0 rounded-full bg-[#D9DAD4] transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[#003C33] peer-checked:after:translate-x-5"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8E918B]">
              Additional guidance
            </span>
            <textarea
              className="min-h-28 resize-none rounded-[10px] border border-[#D9DAD4] bg-white px-3 py-2.5 text-[13.5px] leading-[1.55] text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
              onChange={(event) => setDraft((current) => ({ ...current, guidance: event.target.value }))}
              placeholder="e.g. Favour recent build years and EU VAT paid. Treat Monaco berths as a strong plus."
              value={draft.guidance}
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E7E7E7] px-5 py-4">
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13.5px] font-medium text-[#171719] transition-colors hover:border-[#003C33]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cancel
          </button>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#003C33] px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-[#0B4A3F]"
            onClick={() => onSave(draft)}
            type="button"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save logic
          </button>
        </div>
      </div>
    </div>
  );
}

function WeightControl({
  value,
  onChange,
}: {
  value: CriterionWeight;
  onChange: (weight: CriterionWeight) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-[8px] border border-[#D9DAD4]">
      {WEIGHT_OPTIONS.map((weight) => (
        <button
          aria-pressed={value === weight}
          className={cn(
            "min-h-8 border-r border-[#E7E7E7] px-2.5 text-[12px] font-medium transition-colors last:border-r-0",
            value === weight ? "bg-[#003C33] text-white" : "bg-white text-[#5F625E] hover:bg-[#F1F2EE]",
          )}
          key={weight}
          onClick={() => onChange(weight)}
          type="button"
        >
          {WEIGHT_LABEL[weight]}
        </button>
      ))}
    </div>
  );
}
