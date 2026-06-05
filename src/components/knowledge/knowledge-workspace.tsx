"use client";

import { useMemo, useState } from "react";
import { ChatBubbleIcon, LayersIcon } from "@radix-ui/react-icons";
import { getBrokerSegmentMeta } from "@/lib/broker-segments";
import type { KnowledgePage, KnowledgeVaultModel } from "@/lib/knowledge-vault";
import { cn } from "@/lib/utils";
import { KnowledgeChatPane } from "./knowledge-chat-pane";
import { KnowledgePagesPane, type VaultNote } from "./knowledge-pages-pane";

/* ============================================================
   Knowledge workspace — full-height, two equal panes.

   Left: the chat assistant (OpenAI + vault retrieval).
   Right: the visual pages browser → object detail.

   The two panes cross-link: a chat citation opens that page in the
   right pane; "Ask about this" on a page seeds the composer on the
   left. On narrow screens the panes collapse to a tab switch.
   ============================================================ */

function buildStarterPrompts(model: KnowledgeVaultModel): string[] {
  const prompts: string[] = ["Give me an overview of this vault."];

  const weakest = [...model.pages]
    .filter((page) => page.category !== "Overview")
    .sort((a, b) => a.confidence - b.confidence)[0];
  if (weakest) prompts.push(`Summarise ${weakest.title} and its open gaps.`);

  const totalGaps = model.pages.reduce((acc, page) => acc + page.openGaps.length, 0);
  if (totalGaps > 0) prompts.push("Which pages have the most open gaps?");

  const hasListings = model.categories.some((cat) => cat.label === "Listing" && cat.count > 0);
  prompts.push(
    hasListings ? "Which listings need stronger documentation?" : "What is this vault most confident about?",
  );

  return Array.from(new Set(prompts)).slice(0, 4);
}

export function KnowledgeWorkspace({
  model,
  notePages,
  notesByPage,
}: {
  model: KnowledgeVaultModel;
  notePages?: KnowledgePage[];
  notesByPage?: Record<string, VaultNote[]>;
}) {
  const segmentTitle = getBrokerSegmentMeta(model.segment).title;
  const starterPrompts = useMemo(() => buildStarterPrompts(model), [model]);

  const [mobileTab, setMobileTab] = useState<"chat" | "pages">("chat");

  // chat citation → open page in the right pane
  const [focusPageId, setFocusPageId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  // "Ask about this" → seed the composer on the left
  const [seedPrompt, setSeedPrompt] = useState<string>("");
  const [seedNonce, setSeedNonce] = useState(0);

  const openPage = (pageId: string) => {
    setFocusPageId(pageId);
    setFocusNonce((n) => n + 1);
    setMobileTab("pages");
  };

  const askAboutPage = (page: KnowledgePage) => {
    setSeedPrompt(`Tell me about "${page.title}" — its core facts, sources, and any open gaps.`);
    setSeedNonce((n) => n + 1);
    setMobileTab("chat");
  };

  return (
    <div className="flex flex-col overflow-hidden lg:h-[calc(100dvh-53px)]">
      {/* Mobile pane switch */}
      <div className="flex shrink-0 gap-1 border-b border-[#E7E7E7] bg-[#FBFBFB] p-1.5 lg:hidden">
        <TabButton
          active={mobileTab === "chat"}
          icon={<ChatBubbleIcon className="h-4 w-4" aria-hidden="true" />}
          label="Assistant"
          onClick={() => setMobileTab("chat")}
        />
        <TabButton
          active={mobileTab === "pages"}
          icon={<LayersIcon className="h-4 w-4" aria-hidden="true" />}
          label="Pages"
          onClick={() => setMobileTab("pages")}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <section
          className={cn(
            "h-[72svh] min-h-0 border-b border-[#E7E7E7] lg:h-full lg:border-b-0 lg:border-r",
            mobileTab !== "chat" && "hidden lg:block",
          )}
        >
          <KnowledgeChatPane
            onOpenPage={openPage}
            seedNonce={seedNonce}
            seedPrompt={seedPrompt}
            segmentTitle={segmentTitle}
            starterPrompts={starterPrompts}
          />
        </section>
        <section
          className={cn(
            "h-[72svh] min-h-0 lg:h-full",
            mobileTab !== "pages" && "hidden lg:block",
          )}
        >
          <KnowledgePagesPane
            focusNonce={focusNonce}
            focusPageId={focusPageId}
            model={model}
            notePages={notePages}
            notesByPage={notesByPage}
            onAskAboutPage={askAboutPage}
          />
        </section>
      </div>
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]",
        active ? "bg-[#003C33] text-white" : "bg-white text-[#5F625E] hover:text-[#171719]",
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}
