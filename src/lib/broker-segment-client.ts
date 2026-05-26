"use client";

import {
  BROKER_SEGMENT_COOKIE,
  BROKER_SEGMENT_STORAGE_KEY,
  type BrokerSegment,
} from "@/lib/broker-segments";

export async function persistBrokerSegment(segment: BrokerSegment) {
  window.localStorage.setItem(BROKER_SEGMENT_STORAGE_KEY, segment);
  document.cookie = `${BROKER_SEGMENT_COOKIE}=${encodeURIComponent(segment)}; path=/; max-age=31536000; SameSite=Lax`;

  try {
    await fetch("/api/broker-segment", {
      body: JSON.stringify({ segment }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    // The client cookie above is enough for the next refresh if the route is temporarily unavailable.
  }
}
