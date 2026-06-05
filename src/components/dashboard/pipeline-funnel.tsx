import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { BuyerProfile } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

/* Stages in pipeline order, matching the funnel in the Russian-CRM
   reference dashboard the broker liked: progressively narrower
   commitment from inquiry → negotiation. "Closed" outcomes live in a
   separate strip below the main funnel. */
const FUNNEL_STAGES: ReadonlyArray<{
  key: BuyerProfile["currentStage"];
  label: string;
  /* Brand-aligned accent color for the stage indicator bar. */
  accent: string;
}> = [
  { key: "New Inquiry", label: "Initial contact", accent: "#3D6F8F" },
  { key: "Qualified", label: "Qualified", accent: "#8ABDA6" },
  { key: "Shortlist Sent", label: "Shortlist sent", accent: "#A86642" },
  { key: "Viewing Planned", label: "Viewing planned", accent: "#0F8F62" },
  { key: "Negotiation", label: "Negotiation", accent: "#003C33" },
];

/* Sums a buyer's "deal value" using their budget max — that's the most
   realistic ceiling for a high-ticket broker dashboard. Falls back to
   budget min if max is unset, then 0. */
function buyerDealValue(buyer: BuyerProfile): number {
  return buyer.budgetMaxEur || buyer.budgetMinEur || 0;
}

/* The hero band that shows count + euro total per pipeline stage. Visually
   modeled on the AmoCRM-style funnel: each stage is a tile with a colored
   ribbon at the top, the count as the big number, and the rolled-up
   commercial value as the secondary line. Tiles link to the buyers list
   pre-filtered by stage so the broker can drill in with one click. */
export function PipelineFunnel({
  buyers,
  className,
}: {
  buyers: BuyerProfile[];
  className?: string;
}) {
  const byStage = new Map<BuyerProfile["currentStage"], BuyerProfile[]>();
  for (const buyer of buyers) {
    const list = byStage.get(buyer.currentStage) ?? [];
    list.push(buyer);
    byStage.set(buyer.currentStage, list);
  }

  return (
    <section
      aria-label="Pipeline funnel"
      className={cn(
        "rounded-[12px] border border-[#E7E7E7] bg-white p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E918B]">
            Pipeline by stage
          </p>
          <h2 className="bb-display mt-1.5 text-[1.35rem] font-medium text-[#171719]">
            Where every deal stands
          </h2>
        </div>
        <Link
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#171719] hover:underline"
          href="/buyers"
        >
          Open buyers
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {FUNNEL_STAGES.map((stage) => {
          const list = byStage.get(stage.key) ?? [];
          const total = list.reduce((sum, b) => sum + buyerDealValue(b), 0);
          return (
            <li key={stage.key}>
              <Link
                className="group flex h-full flex-col rounded-[10px] border border-[#E7E7E7] bg-[#FBFBFB] p-3.5 transition-colors hover:border-[#003C33] hover:bg-white"
                href={`/buyers?stage=${encodeURIComponent(stage.key)}`}
              >
                {/* Stage accent ribbon — same colour language as the funnel
                    we're replicating, kept thin so the tile stays calm. */}
                <span
                  aria-hidden="true"
                  className="h-1 w-10 rounded-full"
                  style={{ backgroundColor: stage.accent }}
                />
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E918B]">
                  {stage.label}
                </p>
                <p className="mt-2 text-[1.75rem] font-semibold leading-none tabular-nums text-[#171719]">
                  {list.length}
                </p>
                <p className="mt-1 text-[12px] text-[#5F625E]">
                  {list.length
                    ? formatCurrency(total)
                    : <span className="text-[#A9ABA5]">No deals yet</span>}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
