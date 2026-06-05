"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cross2Icon,
  FileTextIcon,
  PaperPlaneIcon,
  Pencil1Icon,
  PlusIcon,
  ReloadIcon,
  UpdateIcon,
} from "@radix-ui/react-icons";
import { Bot } from "lucide-react";
import type { ChatCitation } from "@/lib/knowledge-chat";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

/* ============================================================
   Knowledge chat pane.

   Scrollable message feed on top, docked composer at the bottom
   (drag-resizable field + attach + send), starter prompts above
   the input while the conversation is empty. Assistant answers are
   markdown-rendered and can carry citations that, when clicked, open
   the matching page in the Pages pane via `onOpenPage`.
   ============================================================ */

interface ChatItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: ChatCitation[];
  mode?: "openai" | "wiki";
  notice?: string;
  isError?: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function KnowledgeChatPane({
  segmentTitle,
  starterPrompts,
  seedPrompt,
  seedNonce = 0,
  onOpenPage,
}: {
  segmentTitle: string;
  starterPrompts: string[];
  seedPrompt?: string;
  seedNonce?: number;
  onOpenPage: (pageId: string) => void;
}) {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [appliedSeed, setAppliedSeed] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll the feed to the newest message / thinking indicator.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  // "Ask about this" handoff from the Pages pane seeds the composer. Sync the
  // input during render when a new seed nonce arrives (React's recommended
  // "adjust state when a prop changes" pattern) — no setState-in-effect.
  if (seedNonce && seedNonce !== appliedSeed) {
    setAppliedSeed(seedNonce);
    setInput(seedPrompt ?? "");
  }

  // Focus the composer after an "Ask about this" seed commits.
  useEffect(() => {
    if (!seedNonce) return;
    textareaRef.current?.focus();
  }, [seedNonce]);

  const send = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed || isThinking) return;

      const content = attachments.length
        ? `${trimmed}\n\n(Attached for context: ${attachments.join(", ")})`
        : trimmed;

      const history = [...messages, { id: uid(), role: "user" as const, content }];
      setMessages(history);
      setInput("");
      setAttachments([]);
      setIsThinking(true);

      try {
        const res = await fetch("/api/knowledge-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Request failed");
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: data.answer ?? "No answer returned.",
            citations: data.citations,
            mode: data.mode,
            notice: data.notice,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: "I couldn't reach the knowledge service just now. Please try again.",
            isError: true,
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [attachments, isThinking, messages],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const names = Array.from(event.target.files ?? []).map((file) => file.name);
    if (names.length) setAttachments((prev) => [...prev, ...names].slice(0, 6));
    event.target.value = "";
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Pane header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E7E7E7] px-5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#003C33] text-[#F2EADC]">
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold leading-tight text-[#171719]">
              Knowledge assistant
            </p>
            <p className="bb-mono-label !text-[10px]">{segmentTitle} vault</p>
          </div>
        </div>
        {!isEmpty ? (
          <button
            className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-2.5 text-[12px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
            onClick={() => setMessages([])}
            type="button"
          >
            <ReloadIcon className="h-3.5 w-3.5" aria-hidden="true" />
            New chat
          </button>
        ) : null}
      </div>

      {/* Message feed */}
      <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#F1F2EE] text-[#003C33]">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="bb-display mt-4 text-[20px] font-medium text-[#171719]">
              Ask the knowledge vault anything
            </h2>
            <p className="mt-2 max-w-xs text-[13px] leading-[1.6] text-[#8E918B]">
              Grounded in your listings, buyers, owners, and deal rooms. Answers link
              back to the pages they came from.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {messages.map((message) => (
              <MessageRow key={message.id} message={message} onOpenPage={onOpenPage} />
            ))}
            {isThinking ? <ThinkingRow /> : null}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-[#E7E7E7] bg-[#FBFBFB] px-4 py-3">
        {isEmpty && starterPrompts.length ? (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                className="rounded-[8px] border border-[#E7E7E7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#5F625E] transition-colors hover:border-[#003C33] hover:text-[#003C33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
                onClick={() => void send(prompt)}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        {attachments.length ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((file, index) => (
              <span
                key={`${file}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#F2EADC]/60 px-2.5 py-1 text-[11.5px] text-[#5F625E]"
              >
                {file}
                <button
                  aria-label={`Remove ${file}`}
                  className="text-[#8E918B] transition-colors hover:text-[#171719]"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  type="button"
                >
                  <Cross2Icon className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {/* The whole field is vertically resizable, so the drag handle sits at
            the bottom-right corner (below the buttons) rather than on the
            textarea between the input and the send row. */}
        <div className="flex h-[140px] min-h-[104px] max-h-[60vh] resize-y flex-col overflow-hidden rounded-[12px] border border-[#D9DAD4] bg-white transition-colors focus-within:border-[#003C33]">
          <textarea
            ref={textareaRef}
            className="min-h-0 w-full flex-1 overflow-y-auto bg-transparent px-4 pt-3 text-[14px] leading-[1.5] text-[#171719] outline-none placeholder:text-[#A9ABA5]"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about a listing, buyer, gap, or source…"
            style={{ resize: "none" }}
            value={input}
          />
          <div className="flex items-center justify-between gap-2 pb-3 pl-2.5 pr-4 pt-1">
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#8E918B] transition-colors hover:bg-[#F1F2EE] hover:text-[#171719] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files for context"
              type="button"
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              ref={fileInputRef}
              className="hidden"
              multiple
              onChange={handleFiles}
              type="file"
            />
            <button
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
                input.trim() && !isThinking
                  ? "bg-[#003C33] text-white hover:bg-[#0B4A3F]"
                  : "cursor-not-allowed bg-[#EDEEEA] text-[#A9ABA5]",
              )}
              disabled={!input.trim() || isThinking}
              onClick={() => void send(input)}
              type="button"
            >
              {isThinking ? (
                <UpdateIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <PaperPlaneIcon className="h-4 w-4" aria-hidden="true" />
              )}
              Send
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10.5px] text-[#A9ABA5]">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}

function MessageRow({
  message,
  onOpenPage,
}: {
  message: ChatItem;
  onOpenPage: (pageId: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[12px] rounded-br-sm bg-[#003C33] px-4 py-2.5 text-[13.5px] leading-[1.55] text-[#F2EADC] whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <span
        className={cn(
          "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          message.isError ? "bg-[#F0DDD0] text-[#A86642]" : "bg-[#F1F2EE] text-[#003C33]",
        )}
      >
        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="rounded-[12px] rounded-tl-sm border border-[#E7E7E7] bg-white px-4 py-3">
          <Markdown text={message.content} />
        </div>

        {message.citations?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.citations.map((citation, index) => {
              const isNote = citation.category === "Note";
              const Icon = isNote ? Pencil1Icon : FileTextIcon;
              // Notes without a linked page render as static chips.
              if (!citation.id) {
                return (
                  <span
                    key={`${citation.title}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-[#F1F2EE] py-1 pl-2 pr-2.5 text-[11.5px] font-medium text-[#3F5249]"
                    title={citation.title}
                  >
                    <Icon className="h-3.5 w-3.5 text-[#5F7A6F]" aria-hidden="true" />
                    <span className="max-w-[180px] truncate">{citation.title}</span>
                  </span>
                );
              }
              return (
                <button
                  key={`${citation.id}-${index}`}
                  className={cn(
                    "group inline-flex items-center gap-1.5 rounded-[8px] border py-1 pl-2 pr-2.5 text-[11.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
                    isNote
                      ? "border-[#E7E7E7] bg-[#F1F2EE] text-[#3F5249] hover:border-[#003C33]"
                      : "border-[#E7E7E7] bg-white text-[#5F625E] hover:border-[#003C33] hover:text-[#003C33]",
                  )}
                  onClick={() => onOpenPage(citation.id)}
                  title={`Open ${citation.title}`}
                  type="button"
                >
                  <Icon className="h-3.5 w-3.5 text-[#8E918B] group-hover:text-[#003C33]" aria-hidden="true" />
                  <span className="max-w-[180px] truncate">{citation.title}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {message.mode === "wiki" && !message.isError ? (
          <p className="mt-1.5 text-[11px] text-[#A9ABA5]">
            {message.notice ?? "Direct vault results — add an OpenAI key for synthesised answers."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ThinkingRow() {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F2EE] text-[#003C33]">
        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="inline-flex items-center gap-2 rounded-[12px] rounded-tl-sm border border-[#E7E7E7] bg-white px-4 py-3 text-[13px] text-[#8E918B]">
        Searching the vault
        <span className="flex gap-1">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#003C33]/60"
              style={{ animationDelay: `${dot * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
