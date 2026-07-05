/* Structured viewings for deal rooms. Type + pure helpers live here (not in
   types.ts — another agent owns that file right now). Persisted inside
   `deal_rooms.payload.viewings`, same pattern as buyer-stage closure metadata. */

export type RoomViewing = {
  id: string;
  /* YYYY-MM-DD — matches <input type="date"> value shape. */
  date: string;
  /* HH:mm — matches <input type="time"> value shape. Optional so a
     date-only viewing is representable. */
  time?: string;
  listingId?: string;
  note?: string;
};

/* Parse viewings out of an arbitrary payload. Tolerates any shape — a bad
   row returns []. Used by both the server row mapper and the client
   optimistic path. */
export function readRoomViewings(payload: unknown): RoomViewing[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const raw = (payload as { viewings?: unknown }).viewings;
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseViewing)
    .filter((v): v is RoomViewing => Boolean(v));
}

function parseViewing(candidate: unknown): RoomViewing | undefined {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
  const c = candidate as Record<string, unknown>;
  const id = typeof c.id === "string" && c.id ? c.id : undefined;
  const date = typeof c.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? c.date : undefined;
  if (!id || !date) return undefined;
  const time = typeof c.time === "string" && /^\d{2}:\d{2}$/.test(c.time) ? c.time : undefined;
  const listingId = typeof c.listingId === "string" && c.listingId ? c.listingId : undefined;
  const note = typeof c.note === "string" && c.note ? c.note : undefined;
  return { id, date, ...(time ? { time } : {}), ...(listingId ? { listingId } : {}), ...(note ? { note } : {}) };
}

/* Sort ascending by date, then time (undefined time sorts before). */
export function sortViewings(viewings: RoomViewing[]): RoomViewing[] {
  return [...viewings].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.time ?? "";
    const bt = b.time ?? "";
    if (at === bt) return 0;
    return at < bt ? -1 : 1;
  });
}

/* True when the viewing lies between "today (local)" and today+withinDays
   (inclusive). Uses new Date() — fine on both client and server. */
export function isUpcoming(v: RoomViewing, withinDays: number, now: Date = new Date()): boolean {
  const todayIso = toIsoDate(now);
  const target = new Date(now.getTime());
  target.setDate(target.getDate() + withinDays);
  const endIso = toIsoDate(target);
  return v.date >= todayIso && v.date <= endIso;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* "Tue 8 Jul · 14:30" — short label for compact surfaces (dashboard row). */
export function formatViewingLabel(v: RoomViewing): string {
  const d = parseIsoDate(v.date);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const base = `${weekday} ${day} ${month}`;
  return v.time ? `${base} · ${v.time}` : base;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
