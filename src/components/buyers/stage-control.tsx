"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { BUYER_STAGES, type BuyerProfile, type BuyerStage } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

/* Explicit stage selector on the buyer header. Persists to Supabase for stored
   buyers via the small `updateBuyerStage` helper below. Demo buyers (ids not in
   the buyers table) get optimistic local-only updates with a subtle warning
   that changes reset on reload. */

type CloseValues = { closedValueEur?: number; closedReason?: string };

export function StageControl({
  buyer,
  isStored,
  onLocalChange,
}: {
  buyer: BuyerProfile;
  isStored: boolean;
  onLocalChange?: (next: BuyerProfile) => void;
}) {
  const [stage, setStage] = useState<BuyerStage>(buyer.currentStage);
  const [open, setOpen] = useState(false);
  const [pendingCloseStage, setPendingCloseStage] = useState<
    "Closed Won" | "Closed Lost" | null
  >(null);
  const [saving, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStage(buyer.currentStage);
  }, [buyer.currentStage]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function persist(next: BuyerStage, close?: CloseValues) {
    if (isStored) {
      startTransition(async () => {
        const { updateBuyerStage } = await import("@/lib/buyer-stage");
        const result = await updateBuyerStage(buyer.id, next, close);
        if (!result.ok) {
          setNote(result.error);
          return;
        }
        setNote(null);
      });
    } else {
      // Demo/session buyer — surface that changes are ephemeral.
      setNote("Demo buyer — stage change is session-only.");
      onLocalChange?.({
        ...buyer,
        currentStage: next,
        closedAt: close ? new Date().toISOString() : buyer.closedAt,
        closedReason: close?.closedReason,
        closedValueEur: close?.closedValueEur,
      });
    }
  }

  function selectStage(next: BuyerStage) {
    setOpen(false);
    if (next === stage) return;
    if (next === "Closed Won" || next === "Closed Lost") {
      setPendingCloseStage(next);
      setStage(next); // optimistic UI badge
      return;
    }
    setStage(next);
    persist(next);
  }

  function confirmClose(values: CloseValues) {
    if (!pendingCloseStage) return;
    persist(pendingCloseStage, values);
    setPendingCloseStage(null);
  }

  return (
    <div className="relative inline-flex flex-col" ref={containerRef}>
      {/* Reads as a real control: deep-green fill + white text like the
          Capture button, matched height, and an explicit "Stage" label so the
          broker knows the pill is editable. */}
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Deal stage: ${stage}. Change stage`}
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-[8px] px-4 text-[13px] font-medium text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
          "bg-[#003C33] hover:bg-[#0B4A3F] disabled:opacity-60",
        )}
        disabled={saving}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Stage
        </span>
        <span>{stage}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-white/70" />
      </button>
      {open ? (
        <ul
          className="absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-[8px] border border-[#E7E7E7] bg-white p-1 shadow-[0_10px_28px_rgba(23,31,25,0.08)]"
          role="listbox"
        >
          {BUYER_STAGES.map((option) => (
            <li key={option}>
              <button
                aria-selected={option === stage}
                className={cn(
                  "flex w-full min-h-8 items-center rounded-[6px] px-2.5 text-left text-[12.5px] font-medium",
                  option === stage
                    ? "bg-[#F1F2EE] text-[#171719]"
                    : "text-[#5F625E] hover:bg-[#F1F2EE] hover:text-[#171719]",
                )}
                onClick={() => selectStage(option)}
                role="option"
                type="button"
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {pendingCloseStage ? (
        <ClosePopover
          buyer={buyer}
          stage={pendingCloseStage}
          onCancel={() => {
            setPendingCloseStage(null);
            setStage(buyer.currentStage);
          }}
          onConfirm={confirmClose}
        />
      ) : null}
      {note ? (
        <p className="mt-1.5 text-[11px] text-[#A86642]">{note}</p>
      ) : null}
    </div>
  );
}

function ClosePopover({
  buyer,
  stage,
  onCancel,
  onConfirm,
}: {
  buyer: BuyerProfile;
  stage: "Closed Won" | "Closed Lost";
  onCancel: () => void;
  onConfirm: (values: CloseValues) => void;
}) {
  const [value, setValue] = useState<string>(
    stage === "Closed Won" ? String(buyer.budgetMaxEur || "") : "",
  );
  const [reason, setReason] = useState<string>("");

  return (
    <div
      className="absolute left-0 top-full z-40 mt-1 w-72 rounded-[10px] border border-[#E7E7E7] bg-white p-3.5 shadow-[0_12px_32px_rgba(23,31,25,0.12)]"
      role="dialog"
    >
      <p className="text-[12px] font-semibold text-[#171719]">
        {stage === "Closed Won" ? "Mark as Closed Won" : "Mark as Closed Lost"}
      </p>
      {stage === "Closed Won" ? (
        <label className="mt-2.5 block">
          <span className="bb-mono-label">Closed value (EUR)</span>
          <input
            className="mt-1.5 h-9 w-full rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[13px] text-[#171719] outline-none focus:border-[#003C33]"
            inputMode="numeric"
            onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
            placeholder="e.g. 2500000"
            type="text"
            value={value}
          />
          {value ? (
            <p className="mt-1 text-[11px] text-[#8E918B]">
              {formatCurrency(Number(value))}
            </p>
          ) : null}
        </label>
      ) : (
        <label className="mt-2.5 block">
          <span className="bb-mono-label">Reason</span>
          <input
            className="mt-1.5 h-9 w-full rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[13px] text-[#171719] outline-none focus:border-[#003C33]"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Chose another broker"
            type="text"
            value={reason}
          />
        </label>
      )}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          className="inline-flex min-h-8 items-center rounded-[8px] px-3 text-[12.5px] font-medium text-[#5F625E] hover:bg-[#F1F2EE]"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="inline-flex min-h-8 items-center rounded-[8px] bg-[#003C33] px-3 text-[12.5px] font-medium text-white hover:bg-[#0B4A3F] disabled:opacity-50"
          disabled={stage === "Closed Won" ? !value : !reason.trim()}
          onClick={() =>
            onConfirm(
              stage === "Closed Won"
                ? { closedValueEur: Number(value) || undefined }
                : { closedReason: reason.trim() },
            )
          }
          type="button"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

/* Centered close-deal dialog — the Close workflow step opens this so the
   broker can record the outcome without hunting for the Stage control.
   Persists exactly like StageControl: updateBuyerStage for stored buyers,
   optimistic local overlay for demo ones. */
export function CloseDealDialog({
  buyer,
  isStored,
  onClose,
  onLocalChange,
  onSaved,
}: {
  buyer: BuyerProfile;
  isStored: boolean;
  onClose: () => void;
  onLocalChange?: (next: BuyerProfile) => void;
  /* Called after a successful stored save so the caller can refresh. */
  onSaved?: () => void;
}) {
  const [outcome, setOutcome] = useState<"Closed Won" | "Closed Lost">("Closed Won");
  const [value, setValue] = useState<string>(String(buyer.budgetMaxEur || ""));
  const [reason, setReason] = useState("");
  const [saving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canConfirm = outcome === "Closed Won" ? Boolean(value) : Boolean(reason.trim());

  function confirm() {
    const close: CloseValues =
      outcome === "Closed Won"
        ? { closedValueEur: Number(value) || undefined }
        : { closedReason: reason.trim() };
    if (isStored) {
      startTransition(async () => {
        const { updateBuyerStage } = await import("@/lib/buyer-stage");
        const result = await updateBuyerStage(buyer.id, outcome, close);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onLocalChange?.({
          ...buyer,
          currentStage: outcome,
          closedAt: new Date().toISOString(),
          closedReason: close.closedReason,
          closedValueEur: close.closedValueEur,
        });
        onSaved?.();
        onClose();
      });
    } else {
      onLocalChange?.({
        ...buyer,
        currentStage: outcome,
        closedAt: new Date().toISOString(),
        closedReason: close.closedReason,
        closedValueEur: close.closedValueEur,
      });
      onClose();
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#171719]/40 p-6"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="w-full max-w-md rounded-[12px] border border-[#E7E7E7] bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="bb-display text-lg font-medium text-[#171719]">Close this deal</h3>
        <p className="mt-1.5 text-[13px] leading-6 text-[#5F625E]">
          Record the outcome for {buyer.name}. This moves the deal out of the live pipeline.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            aria-pressed={outcome === "Closed Won"}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border text-[13px] font-semibold transition-colors",
              outcome === "Closed Won"
                ? "border-[#0F8F62] bg-[#E1F1EA] text-[#0F8F62]"
                : "border-[#E7E7E7] bg-white text-[#5F625E] hover:border-[#0F8F62]",
            )}
            onClick={() => setOutcome("Closed Won")}
            type="button"
          >
            Closed Won
          </button>
          <button
            aria-pressed={outcome === "Closed Lost"}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border text-[13px] font-semibold transition-colors",
              outcome === "Closed Lost"
                ? "border-[#A86642] bg-[#F0DDD0] text-[#A86642]"
                : "border-[#E7E7E7] bg-white text-[#5F625E] hover:border-[#A86642]",
            )}
            onClick={() => setOutcome("Closed Lost")}
            type="button"
          >
            Closed Lost
          </button>
        </div>

        {outcome === "Closed Won" ? (
          <label className="mt-4 block">
            <span className="bb-mono-label">Closed value (EUR)</span>
            <input
              className="mt-1.5 h-10 w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[13px] text-[#171719] outline-none focus:border-[#003C33]"
              inputMode="numeric"
              onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="e.g. 2500000"
              type="text"
              value={value}
            />
            {value ? (
              <p className="mt-1 text-[11px] text-[#8E918B]">{formatCurrency(Number(value))}</p>
            ) : null}
          </label>
        ) : (
          <label className="mt-4 block">
            <span className="bb-mono-label">Reason</span>
            <input
              className="mt-1.5 h-10 w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[13px] text-[#171719] outline-none focus:border-[#003C33]"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Chose another broker"
              type="text"
              value={reason}
            />
          </label>
        )}

        {error ? <p className="mt-3 text-[12px] text-[#A86642]">{error}</p> : null}
        {!isStored ? (
          <p className="mt-3 text-[11.5px] text-[#8E918B]">
            Demo buyer — the outcome is session-only.
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="inline-flex min-h-9 items-center rounded-[8px] px-4 text-[13px] font-medium text-[#5F625E] hover:bg-[#F1F2EE]"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex min-h-9 items-center rounded-[8px] bg-[#003C33] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F] disabled:opacity-50"
            disabled={!canConfirm || saving}
            onClick={confirm}
            type="button"
          >
            {saving ? "Saving…" : "Confirm outcome"}
          </button>
        </div>
      </div>
    </div>
  );
}
