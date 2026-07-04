import { redirect } from "next/navigation";

/* Pulse was folded into the app's other surfaces: the activity feed lives
   on Today, and the per-buyer timeline lives on each buyer's detail page.
   Old bookmarks land on Today instead of a 404. */
export default function PulsePage() {
  redirect("/dashboard");
}
