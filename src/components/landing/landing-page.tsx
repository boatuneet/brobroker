"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import {
  ArrowRight,
  BookOpenText,
  FileText,
  LineChart,
  LockKeyhole,
  type LucideIcon,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const display = { fontFamily: "var(--font-display)" } as const;

const FEATURES: Array<{
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
}> = [
  {
    icon: Radio,
    eyebrow: "Voice CRM",
    title: "Turn a call into buyer memory",
    body: "Paste a call or voice note and it becomes a structured buyer profile — budget, taste, must-haves, and next actions — ready to match and follow up.",
  },
  {
    icon: Sparkles,
    eyebrow: "AI + semantic matching",
    title: "Rank the right asset for every buyer",
    body: "Scoring weighs budget, size, brand and location, then reasons over each listing's description and specs to surface true fit — not just keyword overlap.",
  },
  {
    icon: FileText,
    eyebrow: "Listings & instant import",
    title: "Build listings from a PDF or CSV",
    body: "Drop a broker PDF and we read the specs, photos and description into a clean listing. Bulk-import a whole inventory from CSV in one pass.",
  },
  {
    icon: LockKeyhole,
    eyebrow: "Private deal rooms",
    title: "Share a buyer-safe shortlist",
    body: "Curate a private room scoped to one buyer. Only approved listings and documents appear — seller notes and risk scoring stay in your workspace.",
  },
  {
    icon: BookOpenText,
    eyebrow: "Knowledge vault",
    title: "Ask anything, grounded in your data",
    body: "Every listing, buyer, owner and deal room becomes a searchable page. Answers link back to the source so you always know where a fact came from.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "Verification & risk",
    title: "Clear serious buyers before you share",
    body: "Surface trust gaps, missing documents and follow-up risks up front, so rooms only go out once every readiness check has cleared.",
  },
];

const STEPS: Array<{ step: string; title: string; body: string }> = [
  {
    step: "01",
    title: "Capture",
    body: "Log a call, import a listing PDF, or paste a brief. Everything lands as structured, broker-ready memory.",
  },
  {
    step: "02",
    title: "Match",
    body: "Let the engine rank assets against each buyer's stated needs and taste, with an explainable score behind every fit.",
  },
  {
    step: "03",
    title: "Share",
    body: "Open a verified, buyer-safe deal room and move the right two assets to viewing — without leaking anything sensitive.",
  },
];

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

    const ctx = gsap.context(() => {
      ScrollSmoother.create({
        wrapper: "#smooth-wrapper",
        content: "#smooth-content",
        smooth: 1.2,
        effects: true,
      });

      // Hero intro — fade/slide the stacked elements in on load.
      gsap.from(".hero-anim", {
        y: 28,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        stagger: 0.1,
        delay: 0.05,
      });

      // Scroll reveals — set hidden via JS so no-JS still shows content.
      const reveals = gsap.utils.toArray<HTMLElement>(".reveal");
      reveals.forEach((el) => {
        gsap.set(el, { opacity: 0, y: 28 });
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.85,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="bg-white text-[#171719]">
      <SiteNav />

      <div id="smooth-wrapper">
        <div id="smooth-content">
          <Hero />
          <LogosStrip />
          <Features />
          <HowItWorks />
          <CtaBand />
          <Footer />
        </div>
      </div>
    </div>
  );
}

/* ---- Nav (outside the smoother so it stays truly fixed) --------------- */

function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E7E7E7] bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="inline-flex items-baseline" aria-label="Brobroker home">
          <span className="text-[1.45rem] font-bold tracking-tight text-[#171719]" style={display}>
            Brobroker
          </span>
          <span className="text-[#A86642]" style={display}>
            .
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a className="text-[14px] font-medium text-[#5F625E] transition-colors hover:text-[#171719]" href="#features">
            Features
          </a>
          <a className="text-[14px] font-medium text-[#5F625E] transition-colors hover:text-[#171719]" href="#how">
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            className="hidden min-h-9 items-center rounded-[8px] px-3 text-[13px] font-medium text-[#171719] transition-colors hover:bg-[#F1F2EE] sm:inline-flex"
            href="/login"
          >
            Sign in
          </Link>
          <Link
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] bg-[#003C33] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F]"
            href="/signup"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---- Hero -------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-36">
      {/* Soft brand wash behind the hero. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px]"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 0%, #F1F2EE 0%, rgba(241,242,238,0) 70%)",
        }}
      />
      <div className="mx-auto w-full max-w-[1100px] text-center">
        <span className="hero-anim inline-flex items-center gap-2 rounded-full border border-[#E7E7E7] bg-white px-3.5 py-1.5 text-[12px] font-medium text-[#5F625E]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0F8F62]" aria-hidden="true" />
          Deal intelligence for high-ticket brokers
        </span>

        <h1
          className="hero-anim bb-display mx-auto mt-6 max-w-[18ch] text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] text-[#171719] sm:text-[4rem]"
          style={display}
        >
          Close more of the deals you already have.
        </h1>

        <p className="hero-anim mx-auto mt-6 max-w-[58ch] text-[16px] leading-7 text-[#5F625E] sm:text-[18px]">
          Brobroker turns calls, listings and documents into living memory — then matches the
          right asset to the right buyer and shares it in a private, buyer-safe deal room. For
          yachts, cars and real estate.
        </p>

        <div className="hero-anim mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[#003C33] px-6 text-sm font-medium text-white transition-colors hover:bg-[#0B4A3F]"
            href="/signup"
          >
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-[#D9DAD4] bg-white px-6 text-sm font-medium text-[#171719] transition-colors hover:border-[#003C33]"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* Product shot — gentle parallax via ScrollSmoother effects. */}
      <div className="mx-auto mt-14 w-full max-w-[1120px]">
        <div
          className="hero-anim overflow-hidden rounded-[16px] border border-[#E7E7E7] bg-white shadow-[0_40px_120px_-40px_rgba(0,60,51,0.35)]"
          data-speed="0.92"
        >
          <Image
            alt="Brobroker deal rooms — private, buyer-safe shortlists"
            className="h-auto w-full"
            height={1724}
            priority
            sizes="(min-width: 1120px) 1120px, 100vw"
            src="/bro-broker-hero.png"
            width={3024}
          />
        </div>
      </div>
    </section>
  );
}

/* ---- Trust strip ------------------------------------------------------- */

function LogosStrip() {
  return (
    <section className="border-y border-[#E7E7E7] bg-[#FBFBFB]">
      <div className="reveal mx-auto flex w-full max-w-[1100px] flex-col items-center gap-3 px-5 py-10 text-center sm:px-8">
        <p className="bb-mono-label">One workspace, three markets</p>
        <p className="max-w-[52ch] text-[15px] leading-7 text-[#5F625E]">
          Built for brokers who move serious assets — segment-aware for{" "}
          <span className="font-medium text-[#171719]">yachts</span>,{" "}
          <span className="font-medium text-[#171719]">cars</span> and{" "}
          <span className="font-medium text-[#171719]">real estate</span>.
        </p>
      </div>
    </section>
  );
}

/* ---- Features ---------------------------------------------------------- */

function Features() {
  return (
    <section id="features" className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="reveal mx-auto max-w-[42ch] text-center">
          <p className="bb-mono-label">What it does</p>
          <h2
            className="bb-display mt-4 text-[2rem] font-semibold tracking-[-0.02em] text-[#171719] sm:text-[2.75rem]"
            style={display}
          >
            Every stage of the deal, in one place
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  eyebrow,
  title,
  body,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <article className="reveal flex h-full flex-col rounded-[16px] border border-[#E7E7E7] bg-white p-6 transition-colors hover:border-[#003C33]">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#F1F2EE] text-[#003C33]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="bb-mono-label mt-5">{eyebrow}</p>
      <h3 className="mt-2 text-[18px] font-semibold leading-snug text-[#171719]">{title}</h3>
      <p className="mt-2.5 text-[14px] leading-6 text-[#5F625E]">{body}</p>
    </article>
  );
}

/* ---- How it works ------------------------------------------------------ */

function HowItWorks() {
  return (
    <section id="how" className="border-t border-[#E7E7E7] bg-[#FBFBFB] px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="reveal max-w-[42ch]">
          <p className="bb-mono-label">How it works</p>
          <h2
            className="bb-display mt-4 text-[2rem] font-semibold tracking-[-0.02em] text-[#171719] sm:text-[2.75rem]"
            style={display}
          >
            Capture, match, share
          </h2>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((item) => (
            <div
              key={item.step}
              className="reveal rounded-[16px] border border-[#E7E7E7] bg-white p-7"
            >
              <span className="bb-display text-[2.5rem] font-semibold text-[#003C33]/20" style={display}>
                {item.step}
              </span>
              <h3 className="mt-2 text-[20px] font-semibold text-[#171719]">{item.title}</h3>
              <p className="mt-2.5 text-[14px] leading-6 text-[#5F625E]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- CTA band ---------------------------------------------------------- */

function CtaBand() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="reveal mx-auto w-full max-w-[1120px] overflow-hidden rounded-[24px] bg-[#003C33] px-8 py-16 text-center sm:px-16 sm:py-20">
        <h2
          className="bb-display mx-auto max-w-[20ch] text-[2rem] font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-[3rem]"
          style={display}
        >
          Your pipeline already has the next deal in it.
        </h2>
        <p className="mx-auto mt-5 max-w-[52ch] text-[16px] leading-7 text-white/70">
          Bring your buyers and listings into one workspace and let Brobroker surface the match.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-white px-6 text-sm font-medium text-[#003C33] transition-colors hover:bg-[#F2EADC]"
            href="/signup"
          >
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-white/25 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---- Footer ------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="border-t border-[#E7E7E7] px-5 py-12 sm:px-8">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center justify-between gap-6 sm:flex-row">
        <Link href="/" className="inline-flex items-baseline" aria-label="Brobroker home">
          <span className="text-[1.25rem] font-bold tracking-tight text-[#171719]" style={display}>
            Brobroker
          </span>
          <span className="text-[#A86642]" style={display}>
            .
          </span>
        </Link>
        <div className="flex items-center gap-6 text-[13px] text-[#8E918B]">
          <a className="inline-flex items-center gap-1.5 transition-colors hover:text-[#171719]" href="#features">
            <LineChart className="h-3.5 w-3.5" aria-hidden="true" />
            Features
          </a>
          <Link className="transition-colors hover:text-[#171719]" href="/login">
            Sign in
          </Link>
          <Link className="transition-colors hover:text-[#171719]" href="/signup">
            Get started
          </Link>
        </div>
        <p className="text-[12px] text-[#A9ABA5]">© {new Date().getFullYear()} Brobroker</p>
      </div>
    </footer>
  );
}
