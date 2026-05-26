import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
   Cohere-inspired primitives.
   - Pill primary CTA (near-black, full radius), text-link secondary.
   - White cards with hairline borders, 8/22px radii.
   - Mono-eyebrow uppercase labels, restrained type.
   ============================================================ */

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "success" | "warning" | "error" | "info" | "coral" | "ink";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : tone === "info"
            ? "border-[#cfdcfa] bg-[#f1f5ff] text-[#1448a8]"
            : tone === "coral"
              ? "border-[#ffd6cc] bg-white text-[#c64a31]"
              : tone === "ink"
                ? "border-[#17171c] bg-[#17171c] text-white"
                : "border-[#e5e7eb] bg-white text-[#3f3f46]";

  return (
    <span
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-[1.6] tracking-[0.01em]",
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "link";
  size?: "md" | "sm";
}) {
  const sizing =
    size === "sm"
      ? "min-h-9 px-4 text-[13px]"
      : "min-h-10 px-5 text-sm";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6] disabled:pointer-events-none disabled:opacity-50",
        sizing,
        variant === "primary" &&
          "bg-[#17171c] text-white hover:bg-[#2a2a32]",
        variant === "secondary" &&
          "border border-[#d9d9dd] bg-white text-[#17171c] hover:border-[#17171c]",
        variant === "ghost" &&
          "text-[#3f3f46] hover:bg-[#f5f4ef]",
        variant === "danger" &&
          "bg-[#b30000] text-white hover:bg-[#8d0000]",
        variant === "link" &&
          "min-h-0 rounded-none px-0 text-[#1863dc] underline-offset-4 hover:underline",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ children, className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-[#e5e7eb] bg-white",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 border-b border-[#f2f2f2] px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        {eyebrow ? <p className="bb-mono-label">{eyebrow}</p> : null}
        <h2 className="bb-display mt-2 text-xl font-medium text-[#17171c]">{title}</h2>
        {description ? (
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#616161]">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="shrink-0 justify-self-start pt-0.5 sm:justify-self-end">{action}</div>
      ) : null}
    </div>
  );
}

export function CardHeaderIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4fbf5] text-[#003c33]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* PageHeader is a re-usable hero for top of every workspace.
   Consistent rhythm: eyebrow → headline → 1-line description → optional metrics. */
export function PageHeader({
  eyebrow,
  eyebrowActions,
  title,
  description,
  metrics,
  actions,
}: {
  eyebrow: string;
  eyebrowActions?: ReactNode;
  title: string;
  description?: string;
  metrics?: Array<{ label: string; value: string }>;
  actions?: ReactNode;
}) {
  return (
    <header className="grid gap-5 border-b border-[#e1e1e5] pb-7">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="inline-flex min-h-7 items-center rounded-full border border-[#dedee3] bg-white px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#6f7080]">
              {eyebrow}
            </p>
            {eyebrowActions}
          </div>
          <h1 className="bb-display mt-4 max-w-[860px] text-[2rem] font-medium leading-[1.08] text-[#17171c] sm:text-[2.35rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-3xl text-[14px] leading-7 text-[#54545f]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:pt-9">
            {actions}
          </div>
        ) : null}
      </div>
      {metrics?.length ? (
        <dl className="flex flex-wrap gap-2.5">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="inline-flex min-h-11 items-center gap-3 rounded-full border border-[#dedee3] bg-white px-4 py-2"
            >
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#777888]">
                {metric.label}
              </dt>
              <dd className="font-mono text-[15px] font-semibold text-[#17171c]">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  trend,
  className,
}: {
  label: string;
  value: string;
  detail: string;
  trend: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-6", className)}>
      <p className="bb-mono-label">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="bb-display text-3xl font-medium text-[#17171c]">{value}</p>
        <Badge tone="neutral">{trend}</Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#616161]">{detail}</p>
    </Card>
  );
}

export function ProgressBar({
  value,
  className,
  tone = "ink",
}: {
  value: number;
  className?: string;
  tone?: "ink" | "green" | "coral";
}) {
  const bar =
    tone === "green"
      ? "bg-[#003c33]"
      : tone === "coral"
        ? "bg-[#ff7759]"
        : "bg-[#17171c]";

  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-[#eeece7]", className)}>
      <div
        className={cn("h-full rounded-full transition-all", bar)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function WorkflowState({
  tone = "empty",
  title,
  description,
  action,
}: {
  tone?: "empty" | "loading" | "approval" | "warning" | "error";
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const toneClass =
    tone === "approval"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-950"
          : tone === "loading"
            ? "border-[#cfdcfa] bg-[#f1f5ff] text-[#0e2a66]"
            : "border-[#e5e7eb] bg-white text-[#17171c]";

  return (
    <div className={cn("rounded-xl border p-5", toneClass)}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 opacity-80">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* Quiet empty state for use INSIDE a Card.
   No second border / nested box — typography and a subtle action only,
   so cards don't read as box-in-box on a fresh install. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-10 text-center", className)}>
      <p className="bb-display text-[15px] font-medium text-[#17171c]">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#75758a]">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function TextInput({
  label,
  helper,
  className,
  ...props
}: ComponentPropsWithoutRef<"input"> & {
  label: string;
  helper?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-medium text-[#212121]", className)}>
      <span>{label}</span>
      <input
        className="min-h-11 rounded-lg border border-[#d9d9dd] bg-white px-3 text-[15px] text-[#17171c] outline-none transition-colors placeholder:text-[#9b9ba6] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
        {...props}
      />
      {helper ? <span className="text-xs font-normal text-[#75758a]">{helper}</span> : null}
    </label>
  );
}

export function SelectInput({
  label,
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"select"> & {
  label: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-medium text-[#212121]", className)}>
      <span>{label}</span>
      <span className="relative">
        <select
          className="min-h-11 w-full appearance-none rounded-xl border border-[#d9d9dd] bg-white px-3.5 py-2 pr-10 text-[15px] text-[#17171c] outline-none transition-colors hover:border-[#bfc0c8] focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777888]"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}

export function TabList({
  items,
  active,
}: {
  items: string[];
  active: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[#d9d9dd] bg-white p-1">
      {items.map((item) => (
        <button
          key={item}
          className={cn(
            "min-h-8 rounded-full px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]",
            active === item
              ? "bg-[#17171c] text-white"
              : "text-[#3f3f46] hover:bg-[#f5f4ef]",
          )}
          type="button"
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function DialogShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-labelledby="dialog-preview-title"
      aria-modal="true"
      className="rounded-2xl border border-[#e5e7eb] bg-white p-6"
      role="dialog"
    >
      <div className="border-b border-[#f2f2f2] pb-4">
        <h3 id="dialog-preview-title" className="bb-display text-lg font-medium text-[#17171c]">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#616161]">{description}</p>
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}

export function StatusDot({ className }: { className?: string }) {
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", className)} aria-hidden="true" />;
}

/* Stat — compact inline stat (mono-label + display number).
   Used for hero metric rows and sidebar summaries. */
export function Stat({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="bb-mono-label">{label}</p>
      <p className="mt-2 text-lg font-medium tracking-[-0.01em] text-[#17171c]">{value}</p>
      {detail ? <p className="mt-1 text-sm leading-6 text-[#616161]">{detail}</p> : null}
    </div>
  );
}

/* Section — light-weight container with simple top rule + eyebrow + title.
   Use instead of nested Card-in-Card to avoid box-in-box clutter. */
export function Section({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-[#e5e7eb] pt-8", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="bb-mono-label">{eyebrow}</p> : null}
          <h2 className="bb-display mt-2 text-[22px] font-medium text-[#17171c]">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#616161]">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
