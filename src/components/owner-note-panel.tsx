"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import { Badge, Button, Card, CardHeader } from "./ui";

type OwnerNote = {
  id: string;
  detail: string;
  createdAt: string;
};

export function OwnerNotePanel({ sellerId }: { sellerId: string }) {
  const storageKey = `brobroker:sellers:${sellerId}:notes`;
  const [notes, setNotes] = useState<OwnerNote[]>(() =>
    readPersisted<OwnerNote[]>(storageKey, []),
  );
  const [detail, setDetail] = useState("Owner asked for a tighter next update with qualified lead quality only.");

  function saveNote() {
    const note = {
      id: `owner-note-${Date.now()}`,
      detail: detail.trim(),
      createdAt: new Date().toISOString(),
    };
    if (!note.detail) return;

    const next = [note, ...notes].slice(0, 10);
    setNotes(next);
    writePersisted(storageKey, next);
    mirrorWorkflowEvent("seller_owner_note_saved", note.id, { sellerId, note });
  }

  return (
    <Card>
      <CardHeader eyebrow="Manual owner memory" title="Capture owner update note" />
      <div className="grid gap-4 px-6 py-5">
        <textarea
          aria-label="Owner note"
          className="min-h-28 rounded-xl border border-[#d9d9dd] bg-white p-3 text-[14px] leading-7 text-[#17171c] outline-none focus:border-[#9b60aa] focus:ring-2 focus:ring-[#9b60aa]/15"
          onChange={(event) => setDetail(event.target.value)}
          value={detail}
        />
        <div>
          <Button onClick={saveNote} type="button" variant="secondary">
            <Save className="h-4 w-4" aria-hidden="true" />
            Save owner note
          </Button>
        </div>
      </div>
      {notes.length ? (
        <ul className="divide-y divide-[#f2f2f2] border-t border-[#f2f2f2]">
          {notes.slice(0, 3).map((note) => (
            <li key={note.id} className="px-6 py-4">
              <Badge tone="success">Saved</Badge>
              <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">{note.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
