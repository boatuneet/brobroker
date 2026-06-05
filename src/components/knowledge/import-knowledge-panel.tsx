"use client";

import { useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  Cross2Icon,
  MagnifyingGlassIcon,
  UpdateIcon,
  UploadIcon,
} from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { VoiceRecorder } from "../voice-recorder";

/* ============================================================
   Import knowledge panel.

   Paste text or upload a .txt/.md file → "Analyze" (LLM proposes
   a title, summary, tags, and the most likely linked page) →
   review/confirm → save into the vault (memory_chunks). The
   linked page is chosen from the vault's own pages so the note is
   findable in chat and shown on that page's detail.
   ============================================================ */

export interface ImportCandidate {
  id: string;
  title: string;
  category: string;
}

const GENERAL_ID = "general";

function rankCandidates(text: string, candidates: ImportCandidate[]): ImportCandidate[] {
  const terms = new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 3),
  );
  return [...candidates]
    .map((candidate) => {
      const haystack = `${candidate.title} ${candidate.category}`.toLowerCase();
      let score = 0;
      terms.forEach((term) => {
        if (haystack.includes(term)) score += 1;
      });
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate);
}

export function ImportKnowledgePanel({
  candidates,
  defaultEntityId,
  onClose,
  onSaved,
}: {
  candidates: ImportCandidate[];
  defaultEntityId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<"input" | "review">("input");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [selectedId, setSelectedId] = useState(defaultEntityId ?? GENERAL_ID);
  const [pickerQuery, setPickerQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredCandidates = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return candidates.slice(0, 50);
    return candidates.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 50);
  }, [candidates, pickerQuery]);

  const selectedLabel =
    selectedId === GENERAL_ID
      ? "General"
      : candidates.find((c) => c.id === selectedId)?.title ?? "General";

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const analyze = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const shortlist = rankCandidates(text, candidates).slice(0, 30);
      const res = await fetch("/api/knowledge-import/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, fileName, candidates: shortlist }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not analyze the text.");
      setTitle(data.title ?? "");
      setSummary(data.summary ?? "");
      setTagsInput(Array.isArray(data.tags) ? data.tags.join(", ") : "");
      if (data.suggestedId && candidates.some((c) => c.id === data.suggestedId)) {
        setSelectedId(data.suggestedId);
      }
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const entityType = selectedId === GENERAL_ID ? "General" : candidates.find((c) => c.id === selectedId)?.category ?? "General";
      const res = await fetch("/api/knowledge-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary,
          tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
          content: text,
          entityType,
          entityId: selectedId,
          entityLabel: selectedLabel,
          fileName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save the note.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      aria-modal="true"
      className="bb-overlay-enter fixed inset-0 z-[80] bg-[#171719]/30 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="bb-drawer-enter absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[#E7E7E7] bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E7E7E7] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#171719]">Import knowledge</h2>
            <p className="mt-0.5 text-[12px] text-[#8E918B]">
              {step === "input" ? "Paste text or upload a .txt / .md file." : "Review, link it, and save."}
            </p>
          </div>
          <button
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#8E918B] transition-colors hover:bg-[#F1F2EE] hover:text-[#171719]"
            onClick={onClose}
            type="button"
          >
            <Cross2Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "input" ? (
            <div className="space-y-3">
              <textarea
                className="h-56 w-full resize-none rounded-[10px] border border-[#D9DAD4] bg-white p-3.5 text-[13.5px] leading-[1.6] text-[#171719] outline-none transition-colors placeholder:text-[#A9ABA5] focus:border-[#003C33]"
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste a document, email, or notes about a buyer, listing, owner…"
                value={text}
              />
              <div className="flex items-center justify-between gap-3">
                <button
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[12.5px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33]"
                  onClick={() => fileRef.current?.click()}
                  type="button"
                >
                  <UploadIcon className="h-4 w-4" aria-hidden="true" />
                  Upload .txt / .md
                </button>
                {fileName ? <span className="truncate text-[12px] text-[#8E918B]">{fileName}</span> : null}
                <input
                  accept=".txt,.md,.markdown,text/plain,text/markdown"
                  className="hidden"
                  onChange={handleFile}
                  ref={fileRef}
                  type="file"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-[#E7E7E7]" />
                <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#A9ABA5]">
                  or record a voice note
                </span>
                <span className="h-px flex-1 bg-[#E7E7E7]" />
              </div>
              <VoiceRecorder
                onTranscribed={(transcript) =>
                  setText((prev) => (prev.trim() ? `${prev.trim()}\n\n${transcript}` : transcript))
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Title">
                <input
                  className="h-10 w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[13.5px] text-[#171719] outline-none focus:border-[#003C33]"
                  onChange={(event) => setTitle(event.target.value)}
                  value={title}
                />
              </Field>
              <Field label="Summary">
                <textarea
                  className="h-20 w-full resize-none rounded-[8px] border border-[#D9DAD4] bg-white px-3 py-2 text-[13px] leading-[1.55] text-[#171719] outline-none focus:border-[#003C33]"
                  onChange={(event) => setSummary(event.target.value)}
                  value={summary}
                />
              </Field>
              <Field label="Tags (comma separated)">
                <input
                  className="h-10 w-full rounded-[8px] border border-[#D9DAD4] bg-white px-3 text-[13.5px] text-[#171719] outline-none focus:border-[#003C33]"
                  onChange={(event) => setTagsInput(event.target.value)}
                  placeholder="e.g. financing, sea-trial, refit"
                  value={tagsInput}
                />
              </Field>
              <Field label={`Link to a page — currently: ${selectedLabel}`}>
                <div className="rounded-[10px] border border-[#E7E7E7]">
                  <label className="relative block border-b border-[#E7E7E7]">
                    <MagnifyingGlassIcon
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E918B]"
                    />
                    <input
                      className="h-10 w-full rounded-t-[12px] bg-white pl-9 pr-3 text-[13px] text-[#171719] outline-none placeholder:text-[#A9ABA5]"
                      onChange={(event) => setPickerQuery(event.target.value)}
                      placeholder="Search buyers, listings, owners…"
                      value={pickerQuery}
                    />
                  </label>
                  <div className="max-h-44 overflow-y-auto">
                    <PickerRow
                      active={selectedId === GENERAL_ID}
                      label="General"
                      meta="No specific page"
                      onClick={() => setSelectedId(GENERAL_ID)}
                    />
                    {filteredCandidates.map((candidate) => (
                      <PickerRow
                        active={selectedId === candidate.id}
                        key={candidate.id}
                        label={candidate.title}
                        meta={candidate.category}
                        onClick={() => setSelectedId(candidate.id)}
                      />
                    ))}
                  </div>
                </div>
              </Field>
            </div>
          )}

          {error ? (
            <p className="mt-3 rounded-[8px] bg-[#F0DDD0]/60 px-3 py-2 text-[12.5px] text-[#A86642]">{error}</p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E7E7E7] px-5 py-4">
          {step === "review" ? (
            <button
              className="text-[12.5px] font-medium text-[#5F625E] transition-colors hover:text-[#171719]"
              onClick={() => setStep("input")}
              type="button"
            >
              ← Back to text
            </button>
          ) : (
            <span />
          )}
          {step === "input" ? (
            <button
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-[8px] px-4 text-[13.5px] font-medium transition-colors",
                text.trim() && !busy
                  ? "bg-[#003C33] text-white hover:bg-[#0B4A3F]"
                  : "cursor-not-allowed bg-[#EDEEEA] text-[#A9ABA5]",
              )}
              disabled={!text.trim() || busy}
              onClick={analyze}
              type="button"
            >
              {busy ? <UpdateIcon className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Analyze
            </button>
          ) : (
            <button
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-[8px] px-4 text-[13.5px] font-medium transition-colors",
                title.trim() && !busy
                  ? "bg-[#003C33] text-white hover:bg-[#0B4A3F]"
                  : "cursor-not-allowed bg-[#EDEEEA] text-[#A9ABA5]",
              )}
              disabled={!title.trim() || busy}
              onClick={save}
              type="button"
            >
              {busy ? <UpdateIcon className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckIcon className="h-4 w-4" aria-hidden="true" />}
              Save to vault
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#8E918B]">{label}</span>
      {children}
    </label>
  );
}

function PickerRow({
  active,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#F1F2EE]",
        active && "bg-[#F1F2EE]",
      )}
      onClick={onClick}
      type="button"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-[#171719]">{label}</span>
        <span className="block truncate text-[11px] uppercase tracking-[0.1em] text-[#8E918B]">{meta}</span>
      </span>
      {active ? <CheckIcon className="h-4 w-4 shrink-0 text-[#003C33]" aria-hidden="true" /> : null}
    </button>
  );
}
