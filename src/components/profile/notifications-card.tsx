"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MailWarning, X } from "lucide-react";

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
        setMessage({ tone: "err", text: friendlyDigestError(data.error) });
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
      </div>
      {message ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#171719]/40 p-6"
          onClick={() => setMessage(null)}
          role="dialog"
        >
          <div
            className="w-full max-w-md rounded-[12px] border border-[#E7E7E7] bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {message.tone === "ok" ? (
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-[#0F8F62]" />
                ) : (
                  <MailWarning aria-hidden="true" className="h-5 w-5 text-[#A86642]" />
                )}
                <h3 className="bb-display text-lg font-medium text-[#171719]">
                  {message.tone === "ok" ? "Digest sent" : "Digest not sent"}
                </h3>
              </div>
              <button
                aria-label="Close"
                className="rounded-[8px] p-1 text-[#8E918B] transition-colors hover:bg-[#F1F2EE] hover:text-[#171719]"
                onClick={() => setMessage(null)}
                type="button"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-[13px] leading-6 text-[#5F625E]">{message.text}</p>
            <div className="mt-5 flex justify-end">
              <button
                className="inline-flex min-h-9 items-center rounded-[8px] bg-[#003C33] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#0B4A3F]"
                onClick={() => setMessage(null)}
                type="button"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* Translate raw provider errors into something a broker can act on. Resend's
   test mode returns a 403 JSON blob until a sending domain is verified. */
function friendlyDigestError(error: string | undefined): string {
  if (!error) return "Could not send the digest. Please try again.";
  if (error.includes("verify a domain") || error.includes("testing emails")) {
    const own = error.match(/\(([^)]+@[^)]+)\)/)?.[1];
    return `Resend is in test mode: until a sending domain is verified, digests can only go to the Resend account owner's email${own ? ` (${own})` : ""}. Everything else works — verify a domain at resend.com/domains when you're ready for real delivery.`;
  }
  if (error.includes("RESEND_API_KEY")) {
    return "Email sending isn't configured yet — add RESEND_API_KEY to the environment and try again.";
  }
  return error;
}
