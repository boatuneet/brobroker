import "server-only";
import type { BrokerDigest } from "./digest";

/* Resend REST via plain fetch — no npm package. If RESEND_API_KEY is unset we
   return { ok: false, error } instead of throwing so the test button in
   Settings can surface a helpful message ("RESEND_API_KEY not set") instead
   of a 500.

   ponytail: no batching, no retry, no domain verification handling here.
   `onboarding@resend.dev` works while shipping to the account owner only;
   once a domain is verified set DIGEST_FROM_EMAIL to override. */

type SendResult = { ok: true } | { ok: false; error: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSubject(digest: BrokerDigest): string {
  if (!digest.hasAnything) return "Your BroBroker morning digest — nothing needs you today";
  const parts: string[] = [];
  if (digest.overdue) parts.push(`${digest.overdue} overdue`);
  if (digest.dueToday) parts.push(`${digest.dueToday} due today`);
  if (digest.openQuestions) parts.push(`${digest.openQuestions} buyer question${digest.openQuestions === 1 ? "" : "s"}`);
  if (digest.goingCold.length) parts.push(`${digest.goingCold.length} going cold`);
  return `Your BroBroker morning digest — ${parts.join(", ")}`;
}

function buildHtml(digest: BrokerDigest): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dashboardUrl = `${appUrl.replace(/\/$/, "")}/dashboard`;

  const line = (label: string, count: number) =>
    count > 0
      ? `<p style="margin:6px 0;font-size:15px;color:#171719;"><strong style="color:#003C33;">${count}</strong> ${escapeHtml(label)}</p>`
      : "";

  const coldSection = digest.goingCold.length
    ? `
      <p style="margin:18px 0 6px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5F625E;">Going cold</p>
      <ul style="margin:0;padding-left:18px;font-size:14px;color:#171719;line-height:1.6;">
        ${digest.goingCold
          .slice(0, 10)
          .map((b) => `<li>${escapeHtml(b.name)}</li>`)
          .join("")}
      </ul>`
    : "";

  const body = digest.hasAnything
    ? `
      ${line("overdue task" + (digest.overdue === 1 ? "" : "s"), digest.overdue)}
      ${line("due today", digest.dueToday)}
      ${line("open buyer question" + (digest.openQuestions === 1 ? "" : "s"), digest.openQuestions)}
      ${coldSection}`
    : `<p style="margin:6px 0;font-size:15px;color:#171719;">Nothing needs you today. Enjoy the quiet.</p>`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F1F2EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E7E7E7;border-radius:12px;padding:28px;">
      <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5F625E;">BroBroker</p>
      <h1 style="margin:6px 0 18px 0;font-size:20px;font-weight:500;color:#003C33;">Your morning digest</h1>
      ${body}
      <p style="margin:24px 0 0 0;">
        <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#003C33;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;">Open dashboard</a>
      </p>
    </div>
  </body>
</html>`;
}

export async function sendDigestEmail(to: string, digest: BrokerDigest): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  const from = process.env.DIGEST_FROM_EMAIL ?? "BroBroker <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: buildSubject(digest),
        html: buildHtml(digest),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 200) || res.statusText}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown send error" };
  }
}
