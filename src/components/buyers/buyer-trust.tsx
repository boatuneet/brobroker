import Link from "next/link";
import { CheckCircle2, CircleAlert, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui";
import type { VerificationCase, VerificationSignal } from "@/lib/types";
import { cn } from "@/lib/utils";

/* Plain-language verification for the broker. Evidence (signals) before verdict
   (recommendation), because a numeric 0-100 score is easy to skim past without
   understanding what actually failed. */

const STATUS_COPY: Record<VerificationCase["status"], { headline: string; tone: "success" | "warning" | "error" }> = {
  Verified: { headline: "Cleared to share", tone: "success" },
  "Needs Review": { headline: "Needs your review", tone: "warning" },
  "High Risk": { headline: "Hold access", tone: "error" },
};

export function BuyerTrust({ verification }: { verification?: VerificationCase }) {
  if (!verification) {
    return (
      <div className="grid gap-4 px-6 py-8 text-center">
        <ShieldCheck className="mx-auto h-6 w-6 text-[#A9ABA5]" aria-hidden="true" />
        <div className="mx-auto max-w-md">
          <p className="text-[14px] font-semibold text-[#171719]">No verification case yet</p>
          <p className="mt-2 text-[13px] leading-[1.55] text-[#5F625E]">
            Verification runs before sensitive materials (survey, contract, owner introduction)
            are shared. Open the queue to start a case for this buyer.
          </p>
        </div>
        <div>
          <Link
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#D9DAD4] bg-white px-4 text-[13px] font-medium text-[#171719] hover:border-[#003C33]"
            href="/verification"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Open verification queue
          </Link>
        </div>
      </div>
    );
  }

  const copy = STATUS_COPY[verification.status];
  return (
    <div className="grid gap-5 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="bb-mono-label">Verification status</p>
          <p className="mt-2 bb-display text-[1.4rem] font-medium leading-[1.1] text-[#171719]">
            {copy.headline}
          </p>
        </div>
        <Badge tone={copy.tone}>{verification.status}</Badge>
      </div>

      <section aria-label="Signals">
        <p className="bb-mono-label">Signals</p>
        <ul className="mt-3 divide-y divide-[#E7E7E7] rounded-[12px] border border-[#E7E7E7] bg-white">
          {verification.signals.map((signal, index) => (
            <SignalRow key={`${signal.label}-${index}`} signal={signal} />
          ))}
        </ul>
      </section>

      <section aria-label="Recommended action">
        <p className="bb-mono-label">Recommended action</p>
        <p className="mt-2 rounded-[10px] border border-[#E7E7E7] bg-[#FBFBFB] p-3.5 text-[13px] leading-[1.6] text-[#5F625E]">
          {verification.recommendedAction}
        </p>
      </section>

      <div>
        <Link
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#003C33] hover:underline"
          href="/verification"
        >
          Open full verification queue →
        </Link>
      </div>
    </div>
  );
}

function SignalRow({ signal }: { signal: VerificationSignal }) {
  const Icon = signal.state === "Pass" ? CheckCircle2 : signal.state === "Fail" ? XCircle : CircleAlert;
  const iconColor =
    signal.state === "Pass"
      ? "text-[#0F8F62]"
      : signal.state === "Fail"
        ? "text-[#A86642]"
        : "text-[#A86642]";
  const stateBadgeTone: "success" | "warning" | "error" =
    signal.state === "Pass" ? "success" : signal.state === "Fail" ? "error" : "warning";

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium text-[#171719]">{signal.label}</p>
          <Badge tone={stateBadgeTone}>{signal.state}</Badge>
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.55] text-[#5F625E]">{signal.detail}</p>
      </div>
    </li>
  );
}
