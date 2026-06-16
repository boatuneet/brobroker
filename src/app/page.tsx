import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Brobroker — Deal intelligence for high-ticket brokers",
  description:
    "Brobroker turns calls, listings and documents into living memory, matches the right asset to the right buyer, and shares it in a private, buyer-safe deal room.",
};

/* Public marketing landing. The proxy lets anonymous visitors reach "/" and
   bounces signed-in users to /dashboard, so this renders for logged-out
   visitors (and after sign-out). */
export default function Index() {
  return <LandingPage />;
}
