import { cache } from "react";
import { getCurrentUser } from "./current-user";
import { createClient } from "./server";
import { isUpcoming, readRoomViewings, sortViewings, type RoomViewing } from "@/lib/viewings";

/* Server-side aggregation: every upcoming viewing (next N days) across all
   deal rooms owned by the signed-in broker. Powers the Today "Viewings"
   risk-signal row.

   Each item carries its roomId + buyerId so the dashboard can deep-link
   and resolve the buyer name from its already-loaded pool — no extra
   round-trips. */

export type UpcomingViewing = RoomViewing & {
  roomId: string;
  buyerId: string;
  roomTitle: string;
};

export const getUpcomingViewings = cache(
  async (withinDays: number = 7): Promise<UpcomingViewing[]> => {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("deal_rooms")
      .select("id, title, buyer_id, payload")
      .eq("owner_user_id", user.id);

    if (error) {
      console.warn("Could not load room viewings", error.message);
      return [];
    }

    const now = new Date();
    const items: UpcomingViewing[] = [];
    for (const row of data ?? []) {
      const viewings = readRoomViewings(row.payload);
      for (const v of viewings) {
        if (!isUpcoming(v, withinDays, now)) continue;
        items.push({
          ...v,
          roomId: String(row.id),
          buyerId: row.buyer_id ? String(row.buyer_id) : "",
          roomTitle: row.title ?? "Buyer room",
        });
      }
    }
    return sortViewings(items) as UpcomingViewing[];
  },
);
