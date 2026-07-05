import { redirect } from "next/navigation";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";
import { getActiveBrokerSegment } from "@/lib/broker-segment-server";
import { hasCompletedOnboarding } from "@/lib/onboarding-server";
import { getStoredTasks } from "@/lib/supabase/broker-tasks";
import { getStoredBuyersForSegment } from "@/lib/supabase/buyers";
import { getStoredListingsForSegment } from "@/lib/supabase/listings";

export const metadata = {
  title: "Welcome · BroBroker",
  description: "Set up your broker workspace in two quick steps.",
};

export const dynamic = "force-dynamic";

/* Focused onboarding for a fresh broker — no sidebar, no workspace chrome,
   just the two decisions that shape the workspace. Brokers with real data
   (or who already finished/skipped) bounce straight to Today. */
export default async function WelcomePage() {
  const [segment, done, buyers, tasks, listings] = await Promise.all([
    getActiveBrokerSegment(),
    hasCompletedOnboarding(),
    getStoredBuyersForSegment(undefined),
    getStoredTasks(),
    getStoredListingsForSegment(undefined),
  ]);

  if (done || buyers.length > 0 || tasks.length > 0 || listings.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#FBFBFB] text-[#171719]">
      <header className="border-b border-[#E7E7E7] bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center px-6 py-4">
          <span className="font-display text-2xl font-bold tracking-tight">
            Brobroker<span className="text-[#A86642]">.</span>
          </span>
        </div>
      </header>
      <main className="flex-1">
        <WelcomeFlow initialSegment={segment} />
      </main>
    </div>
  );
}
