"use client";

import { useMemo, useState } from "react";
import { Plus, UserRoundCheck } from "lucide-react";
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

  function addObjection() {
    if (!label.trim() || !detail.trim()) {
      return;
    }

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
      const next = [
        objection,
        ...current,
      ];
      writePersisted(storageKey, next.filter((objection) => objection.source === "Session capture"));
      mirrorWorkflowEvent("listing_objection_recorded", objection.id, { listingId, objection });
      return next;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-[#17171c]">
          <UserRoundCheck className="h-3.5 w-3.5 text-[#003c33]" aria-hidden="true" />
          Record buyer objection
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
            value={label}
          />

          <label className="grid gap-1.5 text-[13px] font-medium text-[#212121]">
            <span className="bb-mono-label">Broker note</span>
            <textarea
              aria-label="Broker note"
              className="min-h-28 rounded-lg border border-[#d9d9dd] bg-white px-3 py-2 text-[14px] leading-6 text-[#17171c] outline-none placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
              onChange={(event) => setDetail(event.target.value)}
              value={detail}
            />
          </label>

          <div>
            <Button onClick={addObjection} type="button">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add objection
            </Button>
          </div>
        </div>

        {selectedBuyer ? (
          <p className="mt-4 text-[13px] leading-6 text-[#75758a]">
            Buyer memory impact: {selectedBuyer.memoryNote}
          </p>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="bb-mono-label">Listing intelligence and buyer memory</p>
        <ul className="mt-3 grid gap-0 divide-y divide-[#f2f2f2] border-t border-[#f2f2f2]">
          {objections.map((objection) => (
            <li key={objection.id} className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">{objection.label}</Badge>
                <span className="text-[12px] uppercase tracking-[0.14em] text-[#75758a]">
                  {objection.source}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">{objection.detail}</p>
              <p className="mt-2 text-[12px] text-[#75758a]">
                {[objection.buyerName, objection.raisedAt].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
