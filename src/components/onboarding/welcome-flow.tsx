"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CarFront,
  Check,
  Compass,
  Radio,
  Ship,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { persistBrokerSegment } from "@/lib/broker-segment-client";
import type { BrokerSegment } from "@/lib/broker-segments";
import { persistDemoMode } from "@/lib/demo-mode-client";
import { ONBOARDING_DONE_COOKIE, serializeOnboardingDone } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { upsertOwnProfile } from "@/lib/supabase/profiles";
import { cn } from "@/lib/utils";

/* Two-step welcome wizard for a fresh broker:
   1. What do you sell? (workspace segment)
   2. How do you want to start? (capture a call / add a listing / explore demo)
   Completing or skipping sets the onboarding cookie so /dashboard stops
   redirecting here. Deliberately small: two decisions, no forms. */

const SEGMENTS: Array<{
  id: BrokerSegment;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: "Yacht", label: "Yachts", description: "Motor and sailing yachts, tenders, charters.", icon: Ship },
  { id: "Car", label: "Cars", description: "Exotic, classic, and collector vehicles.", icon: CarFront },
  { id: "Real Estate", label: "Real estate", description: "Villas, penthouses, estates.", icon: Building2 },
];

async function markOnboardingDone() {
  /* Cookie = fast-path cache for this browser; profiles.onboarded_at = the
     durable truth across devices. Best-effort on the DB write — the cookie
     alone keeps this session moving if the network hiccups. */
  document.cookie = `${ONBOARDING_DONE_COOKIE}=${serializeOnboardingDone()}; path=/; max-age=31536000; SameSite=Lax`;
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await upsertOwnProfile(supabase, user.id, {
        onboarded_at: new Date().toISOString(),
      });
    }
  } catch {
    // Cookie covers this browser; the column syncs next time.
  }
}

export function WelcomeFlow({ initialSegment }: { initialSegment: BrokerSegment }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [segment, setSegment] = useState<BrokerSegment>(initialSegment);
  const [busy, startTransition] = useTransition();

  async function chooseSegment(next: BrokerSegment) {
    setSegment(next);
    await persistBrokerSegment(next).catch(() => undefined);
    setStep(2);
  }

  function finish(destination: string, options?: { enableDemo?: boolean }) {
    startTransition(async () => {
      await markOnboardingDone();
      if (options?.enableDemo) {
        await persistDemoMode(true).catch(() => undefined);
      }
      router.push(destination);
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-14 sm:py-20">
      {/* Step indicator */}
      <p className="bb-mono-label">
        {step === 1 ? "Step 1 of 2" : "Step 2 of 2"}
      </p>

      {step === 1 ? (
        <section aria-label="Choose your market">
          <h1 className="bb-display mt-3 text-[2rem] font-medium leading-[1.1] text-[#171719] sm:text-[2.5rem]">
            Welcome. What do you sell?
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#5F625E]">
            Your workspace shapes itself around one market — listings, buyers,
            matching, and deal rooms all speak its language. You can switch
            anytime in Settings.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {SEGMENTS.map((option) => {
              const Icon = option.icon;
              const selected = segment === option.id;
              return (
                <button
                  key={option.id}
                  className={cn(
                    "group flex flex-col items-start gap-4 rounded-[12px] border bg-white p-5 text-left transition-all",
                    selected
                      ? "border-[#003C33] ring-2 ring-[#003C33] ring-offset-1"
                      : "border-[#E7E7E7] hover:border-[#003C33] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(23,31,25,0.07)]",
                  )}
                  onClick={() => void chooseSegment(option.id)}
                  type="button"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#003C33] text-[#F2EADC]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-[16px] font-semibold text-[#171719]">
                      {option.label}
                      {selected ? (
                        <Check className="h-4 w-4 text-[#003C33]" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[13px] leading-5 text-[#5F625E]">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section aria-label="Choose how to start">
          <h1 className="bb-display mt-3 text-[2rem] font-medium leading-[1.1] text-[#171719] sm:text-[2.5rem]">
            How do you want to start?
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#5F625E]">
            Each path takes under a minute. Everything you add builds the memory
            your matches, rooms, and follow-ups run on.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StartCard
              busy={busy}
              description="Paste or dictate a call — we extract the buyer, tasks, and a draft follow-up."
              icon={Radio}
              label="Capture a call"
              onClick={() => finish("/voice-crm")}
              recommended
            />
            <StartCard
              busy={busy}
              description="Add inventory by hand, or import a PDF / CSV you already have."
              icon={Compass}
              label="Add a listing"
              onClick={() => finish("/listings/new")}
            />
            <StartCard
              busy={busy}
              description="Look around a fully seeded workspace first — flip it off in Settings anytime."
              icon={Sparkles}
              label="Explore with demo data"
              onClick={() => finish("/dashboard", { enableDemo: true })}
            />
          </div>
          <button
            className="mt-8 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#8E918B] transition-colors hover:text-[#003C33]"
            onClick={() => setStep(1)}
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </button>
        </section>
      )}

      <div className="mt-12 border-t border-[#E7E7E7] pt-5">
        <button
          className="text-[13px] font-medium text-[#8E918B] underline-offset-4 transition-colors hover:text-[#003C33] hover:underline"
          disabled={busy}
          onClick={() => finish("/dashboard")}
          type="button"
        >
          Skip for now — take me to my workspace
        </button>
      </div>
    </div>
  );
}

function StartCard({
  busy,
  description,
  icon: Icon,
  label,
  onClick,
  recommended = false,
}: {
  busy: boolean;
  description: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      className="group relative flex h-full flex-col items-start gap-4 rounded-[12px] border border-[#E7E7E7] bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#003C33] hover:shadow-[0_8px_20px_rgba(23,31,25,0.07)] disabled:pointer-events-none disabled:opacity-60"
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      {recommended ? (
        <span className="absolute right-4 top-4 rounded-full bg-[#E1F1EA] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#0F8F62]">
          Fastest
        </span>
      ) : null}
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#003C33] text-[#F2EADC]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex-1">
        <span className="block text-[16px] font-semibold text-[#171719]">{label}</span>
        <span className="mt-1 block text-[13px] leading-5 text-[#5F625E]">{description}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#003C33]">
        Get started
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}
