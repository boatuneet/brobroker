import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { BuyerProfile } from "@/lib/types";
import { formatCurrencyCompact } from "@/lib/utils";

/* Stages in pipeline order: progressively narrower commitment from
   inquiry → negotiation. Labels match the stage names used on buyer
   records and Pulse events — one vocabulary everywhere. Closed outcomes
   render in a separate strip below the live funnel. */
const FUNNEL_STAGES: ReadonlyArray<{
  key: BuyerProfile["currentStage"];
  label: string;
}> = [
  { key: "New Inquiry", label: "New inquiry" },
  { key: "Qualified", label: "Qualified" },
  { key: "Shortlist Sent", label: "Shortlist sent" },
  { key: "Viewing Planned", label: "Viewing planned" },
  { key: "Negotiation", label: "Negotiation" },
];

/* Sums a buyer's "deal value" using their budget max — that's the most
   realistic ceiling for a high-ticket broker dashboard. Falls back to
   budget min if max is unset, then 0. */
function buyerDealValue(buyer: BuyerProfile): number {
  return buyer.budgetMaxEur || buyer.budgetMinEur || 0;
}

/* Compact stage-flow strip designed to live INSIDE the dashboard's green
   hero banner: one slim white tile per stage with chevrons between them so
   the row reads as a left-to-right pipeline. Each tile still links to the
   stage-filtered buyers list — the whole card is the affordance, no extra
   "View buyers" chrome. */
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
  const closedWon = byStage.get("Closed Won") ?? [];
  const closedLost = byStage.get("Closed Lost") ?? [];
  const closedWonValue = closedWon.reduce(
    (sum, b) => sum + (b.closedValueEur || buyerDealValue(b)),
    0,
  );

  return (
    <section aria-label="Pipeline funnel" className={className}>
      <ul className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
        {FUNNEL_STAGES.map((stage, index) => {
          const list = byStage.get(stage.key) ?? [];
          const total = list.reduce((sum, b) => sum + buyerDealValue(b), 0);
          return (
            <li className="flex min-w-0 flex-1 items-center" key={stage.key}>
              <Link
                aria-label={`View ${stage.label} buyers`}
                className="min-w-0 flex-1 rounded-[10px] bg-white p-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                href={`/buyers?stage=${encodeURIComponent(stage.key)}`}
                title={`View ${stage.label} buyers`}
              >
                <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8E918B]">
                  {stage.label}
                </p>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-[1.25rem] font-semibold leading-none tabular-nums text-[#171719]">
                    {list.length}
                  </span>
                  <span className="truncate text-[11.5px] text-[#5F625E]">
                    {list.length ? formatCurrencyCompact(total) : "—"}
                  </span>
                </div>
              </Link>
              {index < FUNNEL_STAGES.length - 1 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="hidden h-4 w-4 shrink-0 text-white/40 sm:block"
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {closedWon.length || closedLost.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#E9F2EC] px-3 py-1.5 text-[12px] font-medium text-[#0F8F62] transition-colors hover:bg-[#DCEBE1]"
            href={`/buyers?stage=${encodeURIComponent("Closed Won")}`}
          >
            <span className="font-semibold tabular-nums">{closedWon.length}</span>
            won · {formatCurrencyCompact(closedWonValue)}
          </Link>
          <Link
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#F1F2EE] px-3 py-1.5 text-[12px] font-medium text-[#5F625E] transition-colors hover:bg-[#E7E7E7]"
            href={`/buyers?stage=${encodeURIComponent("Closed Lost")}`}
          >
            <span className="font-semibold tabular-nums">{closedLost.length}</span>
            lost
          </Link>
        </div>
      ) : null}
    </section>
  );
}
