import { clsx, type ClassValue } from "clsx";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function daysUntil(value: string, now = new Date()) {
  const then = new Date(value).getTime();
  return Math.ceil((then - now.getTime()) / 86_400_000);
}

/* Compact money for KPI tiles and summary rows: €3.8M, €750K, €900.
   Full-precision formatCurrency stays for record-level detail — raw sums
   of many budgets read as noise (€3,800,003) at dashboard altitude. */
export function formatCurrencyCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    return `€${millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10}M`;
  }
  if (abs >= 1_000) return `€${Math.round(value / 1_000)}K`;
  return formatCurrency(value);
}

export function percentage(value: number) {
  return `${Math.round(value)}%`;
}
