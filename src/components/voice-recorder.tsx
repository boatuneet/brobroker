"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UpdateIcon } from "@radix-ui/react-icons";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------
   Voice recorder — captures mic audio, sends it to OpenAI Whisper
   (/api/knowledge-transcribe), and returns the transcript via
   onTranscribed. The decorative waveform animates while recording
   (heights are fixed per mount to avoid SSR/lint churn).

   Shared by the Knowledge import drawer and the Voice CRM dictate
   popup so both use the same Whisper-backed recorder.
   ------------------------------------------------------------ */
type RecorderStatus = "idle" | "recording" | "transcribing";

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export function VoiceRecorder({
  onTranscribed,
  className,
  surfaceClassName = "border-[#E7E7E7] bg-[#FBFBFB]",
}: {
  onTranscribed: (text: string) => void;
  className?: string;
  /* Surface (border + background) classes. Pass to override the default —
     cn() here is plain clsx, so the default must be replaced, not appended. */
  surfaceClassName?: string;
}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [time, setTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Deterministic pseudo-random bar heights (pure → stable + lint-safe).
  const bars = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const noise = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        return 20 + noise * 80;
      }),
    [],
  );

  // Tick the timer only while recording (interval callback → not a synchronous
  // setState in the effect body).
  useEffect(() => {
    if (status !== "recording") return;
    const id = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Stop the mic stream if the recorder unmounts mid-recording.
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const transcribe = async () => {
    const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || "audio/webm" });
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (!blob.size) {
      setStatus("idle");
      return;
    }
    setStatus("transcribing");
    try {
      const form = new FormData();
      form.append("file", blob, "voice-note.webm");
      const res = await fetch("/api/knowledge-transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not transcribe the audio.");
      if (data.text) onTranscribed(data.text);
      else setError("Nothing was heard — try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not transcribe the audio.");
    } finally {
      setStatus("idle");
    }
  };

  const start = async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => void transcribe();
      recorderRef.current = recorder;
      setTime(0);
      recorder.start();
      setStatus("recording");
    } catch {
      setError("Microphone access was blocked.");
    }
  };

  const stop = () => recorderRef.current?.stop();

  const onClick = () => {
    if (status === "idle") void start();
    else if (status === "recording") stop();
  };

  const active = status !== "idle";

  return (
    <div className={cn("flex flex-col rounded-[10px] border py-4", surfaceClassName, className)}>
      <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center gap-2">
        <button
          aria-label={status === "recording" ? "Stop recording" : "Start recording"}
          className={cn(
            "group flex h-14 w-14 items-center justify-center rounded-[10px] transition-colors",
            status === "recording" ? "bg-[#003C33]/5" : "hover:bg-[#003C33]/5",
            status === "transcribing" && "cursor-wait",
          )}
          disabled={status === "transcribing"}
          onClick={onClick}
          type="button"
        >
          {status === "recording" ? (
            <span className="h-5 w-5 rounded-[4px] bg-[#003C33]" />
          ) : status === "transcribing" ? (
            <UpdateIcon className="h-6 w-6 animate-spin text-[#003C33]" aria-hidden="true" />
          ) : (
            <Mic className="h-6 w-6 text-[#003C33]" aria-hidden="true" />
          )}
        </button>
        <span className={cn("font-mono text-[13px]", active ? "text-[#5F625E]" : "text-[#A9ABA5]")}>
          {formatTime(time)}
        </span>
        <div className="flex h-4 w-56 items-center justify-center gap-0.5">
          {bars.map((height, index) => (
            <div
              className={cn(
                "w-0.5 rounded-full transition-all duration-300",
                status === "recording" ? "animate-pulse bg-[#003C33]/50" : "h-1 bg-[#003C33]/10",
              )}
              key={index}
              style={
                status === "recording"
                  ? { height: `${height}%`, animationDelay: `${index * 0.05}s` }
                  : undefined
              }
            />
          ))}
        </div>
        <p className="text-[12px] text-[#8E918B]">
          {status === "recording"
            ? "Listening… click to stop"
            : status === "transcribing"
              ? "Transcribing…"
              : "Click to speak"}
        </p>
        {error ? <p className="mt-1 text-[11.5px] text-[#A86642]">{error}</p> : null}
      </div>
    </div>
  );
}
