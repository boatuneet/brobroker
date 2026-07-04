"use client";

import { useMemo, useState } from "react";
import { Inbox, Lightbulb, Plus, UserRoundCheck } from "lucide-react";
import { mirrorWorkflowEvent, mergeById, readPersisted, writePersisted } from "@/lib/browser-persistence";
import { Badge, Button, TextInput } from "./ui";
import { SelectMenu } from "./select-menu";

export interface BuyerOption {
  id: string;
  name: string;
  memoryNote: string;
}

export interface RecordedObjection {
  id: string;
  buyerId?: string;
  buyerName?: string;
  label: string;
  detail: string;
  raisedAt: string;
  source: string;
}

export function ObjectionRecorder({
  buyers,
  initialObjections,
  listingId,
}: {
  buyers: BuyerOption[];
  initialObjections: RecordedObjection[];
  listingId: string;
}) {
  const storageKey = `brobroker:objections:${listingId}`;
  const [buyerId, setBuyerId] = useState(buyers[0]?.id ?? "");
  const [label, setLabel] = useState("Interior concern");
  const [detail, setDetail] = useState(
    "Buyer asked whether the interior will feel dated in person.",
  );
  const [objections, setObjections] = useState(() =>
    mergeById(initialObjections, readPersisted<RecordedObjection[]>(storageKey, [])),
  );

  const selectedBuyer = useMemo(
    () => buyers.find((buyer) => buyer.id === buyerId),
    [buyerId, buyers],
  );
  const canAdd = Boolean(label.trim() && detail.trim());

  function addObjection() {
    if (!canAdd) return;

    const today = new Intl.DateTimeFormat("en-CA").format(new Date());

    setObjections((current) => {
      const objection = {
        id: `local-${Date.now()}`,
        buyerId,
        buyerName: selectedBuyer?.name,
        label: label.trim(),
        detail: detail.trim(),
        raisedAt: today,
        source: "Session capture",
      };
      const next = [objection, ...current];
      writePersisted(storageKey, next.filter((entry) => entry.source === "Session capture"));
      mirrorWorkflowEvent("listing_objection_recorded", objection.id, { listingId, objection });
      return next;
    });
    setLabel("");
    setDetail("");
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      {/* Capture form — on a soft surface so it reads as one task block. */}
      <div className="min-w-0 rounded-[12px] border border-[#E7E7E7] bg-[#FBFBFB] p-5">
        <div className="flex items-center gap-2">
          <UserRoundCheck className="h-4 w-4 text-[#003C33]" aria-hidden="true" />
          <p className="bb-mono-label">Record buyer objection</p>
        </div>

        <div className="mt-4 grid gap-4">
          <SelectMenu
            label="Buyer memory"
            onChange={setBuyerId}
            options={buyers.map((buyer) => ({
              label: buyer.name,
              value: buyer.id,
              meta: buyer.memoryNote,
            }))}
            value={buyerId}
          />

          <TextInput
            label="Objection label"
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Interior concern"
            value={label}
          />

          <label className="grid gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
              Broker note
            </span>
            <textarea
              aria-label="Broker note"
              className="min-h-28 rounded-[8px] border border-[#D9DAD4] bg-white px-3 py-2.5 text-[14px] leading-6 text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15"
              onChange={(event) => setDetail(event.target.value)}
              placeholder="What the buyer raised, in their words."
              value={detail}
            />
          </label>

          <div>
            <Button disabled={!canAdd} onClick={addObjection} type="button" variant="secondary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add objection
            </Button>
          </div>
        </div>

        {selectedBuyer?.memoryNote ? (
          <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-[#E7E7E7] bg-white px-3 py-2.5">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A86642]" aria-hidden="true" />
            <p className="text-[12px] leading-5 text-[#5F625E]">
              <span className="font-medium text-[#171719]">Buyer memory:</span> {selectedBuyer.memoryNote}
            </p>
          </div>
        ) : null}
      </div>

      {/* Recorded objections list. */}
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p className="bb-mono-label">Recorded objections</p>
          <span className="text-[12px] tabular-nums text-[#8E918B]">
            {objections.length} total
          </span>
        </div>

        {objections.length === 0 ? (
          <div className="mt-3 grid place-items-center rounded-[12px] border border-dashed border-[#D9DAD4] bg-[#FBFBFB] px-6 py-10 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#8E918B]">
              <Inbox className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-[14px] font-medium text-[#171719]">No objections recorded yet</p>
            <p className="mt-1 max-w-xs text-[13px] leading-6 text-[#8E918B]">
              Capture what buyers raise on the left — they appear here and feed buyer memory.
            </p>
          </div>
        ) : (
          <ul className="mt-3 grid gap-3">
            {objections.map((objection) => (
              <li
                key={objection.id}
                className="rounded-[12px] border border-[#E7E7E7] bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="warning">{objection.label}</Badge>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[#A9ABA5]">
                    {objection.source}
                  </span>
                </div>
                <p className="mt-2.5 text-[13px] leading-6 text-[#5F625E]">{objection.detail}</p>
                {objection.buyerName || objection.raisedAt ? (
                  <p className="mt-2.5 border-t border-[#F1F2EE] pt-2.5 text-[12px] text-[#8E918B]">
                    {[objection.buyerName, objection.raisedAt].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
