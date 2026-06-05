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
    <div className="bb-toast-enter-br fixed bottom-5 right-5 z-[90] max-w-[360px]">
      <div
        className={cn(
          "flex items-start gap-3 rounded-[12px] border bg-white px-4 py-3 text-[13px] leading-6 text-[#171719] shadow-[0_12px_32px_rgba(23,31,25,0.14)]",
          tone === "error" ? "border-[#F0DDD0]" : "border-[#E7E7E7]",
        )}
        role="status"
      >
        <span
          className={cn(
            "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            tone === "error" ? "bg-[#F0DDD0] text-[#A86642]" : "bg-[#F1F2EE] text-[#003C33]",
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
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8E918B] transition hover:bg-[#FBFBFB] hover:text-[#171719]"
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
  confirmDisabled = false,
  confirmLabel,
  confirmTone = "neutral",
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  cancelLabel?: string;
  confirmDisabled?: boolean;
  confirmLabel: string;
  confirmTone?: "neutral" | "destructive";
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  if (!open) return null;

  const isDestructive = confirmTone === "destructive";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#171719]/32 px-5 backdrop-blur-sm">
      <div
        aria-modal="true"
        className="bb-toast-enter w-full max-w-md rounded-[12px] border border-[#E7E7E7] bg-white p-6"
        role="dialog"
      >
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              isDestructive ? "bg-[#F0DDD0] text-[#A86642]" : "bg-[#fff7ed] text-[#b45309]",
            )}
          >
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="bb-display text-xl font-medium text-[#171719]">{title}</p>
            <p className="mt-2 text-sm leading-6 text-[#5F625E]">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-[8px] border border-[#D9DAD4] bg-white px-5 text-sm font-medium text-[#171719] hover:border-[#003C33] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={confirmDisabled}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={cn(
              "inline-flex min-h-10 items-center justify-center rounded-[8px] px-5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60",
              isDestructive
                ? "bg-[#A86642] hover:bg-[#A86642]"
                : "bg-[#003C33] hover:bg-[#0B4A3F]",
            )}
            disabled={confirmDisabled}
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
