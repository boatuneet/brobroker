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

export function daysUntil(value: string, now = new Date("2026-05-24T09:00:00+03:00")) {
  const then = new Date(value).getTime();
  return Math.ceil((then - now.getTime()) / 86_400_000);
}

export function percentage(value: number) {
  return `${Math.round(value)}%`;
}
