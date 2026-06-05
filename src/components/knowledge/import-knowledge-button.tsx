"use client";

import { UploadIcon } from "@radix-ui/react-icons";

/* Lives in the AppShell top bar (pageActions). It signals the pages pane —
   which owns the drawer + candidate list — to open the import drawer, via a
   window event so the two can sit in separate parts of the layout. */
export const IMPORT_EVENT = "bb:knowledge-import";

export function ImportKnowledgeButton() {
  return (
    <button
      className="inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-[#E7E7E7] bg-white px-3 text-[13px] font-medium text-[#171719] transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#003C33]"
      onClick={() => window.dispatchEvent(new CustomEvent(IMPORT_EVENT))}
      type="button"
    >
      <UploadIcon className="h-4 w-4" aria-hidden="true" />
      Import knowledge
    </button>
  );
}
