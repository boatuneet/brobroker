"use client";

import { useEffect, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ToastViewport({
  action,
  message,
  tone = "success",
  onDismiss,
}: {
  action?: ReactNode;
  message: ReactNode | null;
  tone?: "success" | "error";
  onDismiss?: () => void;
}) {
  const Icon = tone === "error" ? XCircle : CheckCircle2;

  useEffect(() => {
    if (!message || !onDismiss) return;

    const timeoutId = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="bb-toast-enter fixed right-5 top-5 z-50 max-w-[360px]">
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 text-[13px] leading-6 text-[#17171c] shadow-[0_18px_55px_rgba(23,23,28,0.14)]",
          tone === "error" ? "border-rose-200" : "border-[#dce9df]",
        )}
        role="status"
      >
        <span
          className={cn(
            "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            tone === "error" ? "bg-rose-50 text-rose-700" : "bg-[#f4fbf5] text-[#003c33]",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div>{message}</div>
          {action ? <div className="mt-1.5">{action}</div> : null}
        </div>
        {onDismiss ? (
          <button
            aria-label="Dismiss notification"
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#75758a] transition hover:bg-[#f7f7f9] hover:text-[#17171c]"
            onClick={onDismiss}
            type="button"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  cancelLabel?: string;
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#17171c]/32 px-5 backdrop-blur-sm">
      <div
        aria-modal="true"
        className="bb-toast-enter w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0_24px_80px_rgba(23,23,28,0.22)]"
        role="dialog"
      >
        <div className="flex items-start gap-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff7ed] text-[#b45309]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="bb-display text-xl font-medium text-[#17171c]">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[#616161]">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d9d9dd] bg-white px-5 text-sm font-medium text-[#17171c] hover:border-[#17171c]"
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#17171c] px-5 text-sm font-medium text-white hover:bg-[#2a2a32]"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
