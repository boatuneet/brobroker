import type { ComponentPropsWithoutRef, ReactNode } from "react";
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
      ? "border-[#E1F1EA] bg-[#E1F1EA] text-[#0F8F62]"
      : tone === "warning"
        ? "border-[#F0DDD0] bg-[#F0DDD0] text-[#A86642]"
        : tone === "error"
          ? "border-[#F0DDD0] bg-[#F0DDD0] text-[#A86642]"
          : tone === "info"
            ? "border-[#cfdcfa] bg-[#f1f5ff] text-[#1448a8]"
            : tone === "coral"
              ? "border-[#ffd6cc] bg-white text-[#c64a31]"
              : tone === "ink"
                ? "border-[#171719] bg-[#171719] text-white"
            : "border-[#E7E7E7] bg-white text-[#5F625E]";

  return (
    <span
      className={cn(
        "inline-flex min-h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-0.5 text-[11px] font-medium leading-[1.6] tracking-[0.01em]",
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
        "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6] disabled:pointer-events-none disabled:opacity-50",
        sizing,
        variant === "primary" &&
          "bg-[#003C33] text-white hover:bg-[#0B4A3F]",
        variant === "secondary" &&
          "border border-[#D9DAD4] bg-white text-[#171719] hover:border-[#003C33]",
        variant === "ghost" &&
          "text-[#5F625E] hover:bg-[#F1F2EE]",
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
        "min-w-0 rounded-[12px] border border-[#E7E7E7] bg-white",
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
    <div className="grid grid-cols-1 items-start gap-4 border-b border-[#E7E7E7] px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        {eyebrow ? <p className="bb-mono-label">{eyebrow}</p> : null}
        <h2 className="mt-2 text-xl font-semibold text-[#171719]">{title}</h2>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#5F625E]">{description}</p>
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
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F1F2EE] text-[#003C33]",
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
  /* Eyebrow chip is optional. Most workspace screens omit it now — only the
     dashboard's custom header keeps a segment chip + date. */
  eyebrow?: string;
  eyebrowActions?: ReactNode;
  /* Title is optional now — the sticky top bar renders the page title for
     top-level screens, so workspaces that only need the metric strip can
     drop the redundant in-content heading. */
  title?: string;
  description?: string;
  metrics?: Array<{ label: string; value: string }>;
  actions?: ReactNode;
}) {
  const hasEyebrowRow = Boolean(eyebrow || eyebrowActions);
  const hasTitleRow = Boolean(title || description || actions || hasEyebrowRow);
  return (
    <header className="grid gap-5">
      {hasTitleRow ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            {hasEyebrowRow ? (
              <div className="flex flex-wrap items-center gap-2">
                {eyebrow ? (
                  <p className="inline-flex min-h-7 items-center rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8E918B]">
                    {eyebrow}
                  </p>
                ) : null}
                {eyebrowActions}
              </div>
            ) : null}
            {title ? (
              <h1
                className={cn(
                  "max-w-[860px] text-[1.75rem] font-bold leading-[1.12] tracking-normal text-[#171719] sm:text-[1.95rem]",
                  hasEyebrowRow ? "mt-4" : "",
                )}
              >
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-3xl text-[15px] leading-6 text-[#5F625E]">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {metrics?.length ? (
        /* KPI tile band — same shape Buyers/Listings use. White surface
           with eyebrow label + big number. First tile gets the cream accent
           so the row reads as one editorial cluster. */
        <dl
          className={cn(
            "mt-2 grid gap-3",
            metrics.length === 1 && "grid-cols-1",
            metrics.length === 2 && "grid-cols-1 sm:grid-cols-2",
            metrics.length === 3 && "grid-cols-2 md:grid-cols-3",
            metrics.length >= 4 && "grid-cols-2 md:grid-cols-4",
          )}
        >
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={cn(
                "rounded-[12px] border p-5",
                index === 0
                  ? "border-transparent bg-[#F2EADC] text-[#171719]"
                  : "border-[#E7E7E7] bg-white text-[#171719]",
              )}
            >
              <dt className="bb-mono-label">{metric.label}</dt>
              <dd className="bb-display mt-3 text-[28px] font-medium leading-none tabular-nums">
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
        <p className="bb-display text-3xl font-medium text-[#171719]">{value}</p>
        <Badge tone="neutral">{trend}</Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#5F625E]">{detail}</p>
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
      ? "bg-[#003C33]"
      : tone === "coral"
        ? "bg-[#A86642]"
        : "bg-[#171719]";

  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-[#F2EADC]", className)}>
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
      ? "border-[#E1F1EA] bg-[#E1F1EA] text-[#0F8F62]"
      : tone === "warning"
        ? "border-[#F0DDD0] bg-[#F0DDD0] text-[#A86642]"
        : tone === "error"
          ? "border-[#F0DDD0] bg-[#F0DDD0] text-[#A86642]"
          : tone === "loading"
            ? "border-[#cfdcfa] bg-[#f1f5ff] text-[#0e2a66]"
            : "border-[#E7E7E7] bg-white text-[#171719]";

  return (
    <div className={cn("rounded-[12px] border p-5", toneClass)}>
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
      <p className="bb-display text-[15px] font-medium text-[#171719]">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#8E918B]">
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
  inputClassName,
  ...props
}: ComponentPropsWithoutRef<"input"> & {
  label: string;
  helper?: string;
  inputClassName?: string;
}) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8E918B]">
        {label}
      </span>
      <input
        className={cn(
          "min-h-11 rounded-[10px] border border-[#D9DAD4] bg-white px-3 text-[15px] text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33] focus:ring-2 focus:ring-[#003C33]/15",
          inputClassName,
        )}
        {...props}
      />
      {helper ? <span className="text-xs font-normal text-[#8E918B]">{helper}</span> : null}
    </label>
  );
}

/* SelectInput was a native-<select> wrapper. It's been removed in favor of
   the custom SelectMenu component (src/components/select-menu.tsx), which
   provides a styled popover instead of the OS native dropdown. */

export function TabList({
  items,
  active,
}: {
  items: string[];
  active: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-[8px] border border-[#D9DAD4] bg-white p-1">
      {items.map((item) => (
        <button
          key={item}
          className={cn(
            "min-h-8 rounded-[8px] px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6ee6]",
            active === item
              ? "bg-[#171719] text-white"
              : "text-[#5F625E] hover:bg-[#F1F2EE]",
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
      className="rounded-[12px] border border-[#E7E7E7] bg-white p-6"
      role="dialog"
    >
      <div className="border-b border-[#E7E7E7] pb-4">
        <h3 id="dialog-preview-title" className="bb-display text-lg font-medium text-[#171719]">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#5F625E]">{description}</p>
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
      <p className="mt-2 text-lg font-medium tracking-[-0.01em] text-[#171719]">{value}</p>
      {detail ? <p className="mt-1 text-sm leading-6 text-[#5F625E]">{detail}</p> : null}
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
    <section className={cn("border-t border-[#E7E7E7] pt-8", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="bb-mono-label">{eyebrow}</p> : null}
          <h2 className="mt-2 text-[22px] font-semibold text-[#171719]">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F625E]">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
