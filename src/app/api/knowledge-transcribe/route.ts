import { NextResponse } from "next/server";

/* Transcribe a recorded voice note via OpenAI Whisper. The audio blob is
   forwarded as multipart/form-data; the key stays server-side. */
export const dynamic = "force-dynamic";

const WHISPER_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "Voice notes need an OpenAI key. Add OPENAI_API_KEY to .env.local." },
      { status: 400 },
    );
  }

  const inForm = await request.formData().catch(() => null);
  const file = inForm?.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No audio was provided." }, { status: 400 });
  }

  try {
    const outForm = new FormData();
    outForm.append("file", file, "voice-note.webm");
    outForm.append("model", process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "whisper-1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    const res = await fetch(WHISPER_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: outForm,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Whisper failed", res.status, detail.slice(0, 300));
      return NextResponse.json({ error: "Could not transcribe the audio." }, { status: 502 });
    }

    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ text: (data.text ?? "").trim() });
  } catch (error) {
    console.error("Transcription error", error);
    return NextResponse.json({ error: "Could not transcribe the audio." }, { status: 500 });
  }
}
