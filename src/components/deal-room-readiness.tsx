import { CheckCircle2, Circle } from "lucide-react";
import type { DealRoomReadinessCheck } from "@/lib/services";
import { cn } from "@/lib/utils";

/* Readiness check pills shared by the deal rooms list and the New room
   flow — green when done, muted while pending. */
export function DealRoomReadinessPills({ checks }: { checks: DealRoomReadinessCheck[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {checks.map((check) => (
        <span
          key={check.label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium",
            check.done
              ? "border-[#CDE7DC] bg-[#E1F1EA] text-[#0F8F62]"
              : "border-[#E7E7E7] bg-[#F1F2EE] text-[#8E918B]",
          )}
        >
          {check.done ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Circle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {check.label}
        </span>
      ))}
    </div>
  );
}
