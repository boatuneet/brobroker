"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/* "Send me a test digest" button. Hits POST /api/digest which builds the
   signed-in broker's digest and sends it to their own email (regardless of
   whether hasAnything — test always sends). Surfaces missing keys inline
   instead of hiding them behind a 500. */
export function NotificationsCard() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function onSend() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/digest", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        sentTo?: string;
      };
      if (data.ok) {
        setMessage({ tone: "ok", text: `Sent to ${data.sentTo ?? "your email"}` });
      } else {
        setMessage({ tone: "err", text: data.error ?? "Could not send digest" });
      }
    } catch (err) {
      setMessage({
        tone: "err",
        text: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0">
      <p className="bb-mono-label">Notifications</p>
      <h2 className="bb-display mt-1.5 text-lg font-medium text-[#171719]">Morning digest</h2>
      <p className="mt-2 max-w-xl text-[13px] leading-6 text-[#5F625E]">
        A morning email with what needs you: overdue tasks, buyer questions, deals going cold.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#D9DAD4] bg-white px-5 text-[13px] font-semibold text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] disabled:opacity-60"
          disabled={pending}
          onClick={onSend}
          type="button"
        >
          {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          Send me a test digest
        </button>
        {message ? (
          <p
            className={`text-[12px] leading-5 ${
              message.tone === "ok" ? "text-[#0F8F62]" : "text-[#A86642]"
            }`}
            role="status"
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
