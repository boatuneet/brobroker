"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BROKER_SEGMENT_COOKIE,
  BROKER_SEGMENT_STORAGE_KEY,
  type BrokerSegment,
  normalizeBrokerSegment,
} from "@/lib/broker-segments";
import { persistBrokerSegment } from "@/lib/broker-segment-client";

function cookieValue(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function BrokerSegmentBridge({ currentSegment }: { currentSegment: BrokerSegment }) {
  const router = useRouter();

  useEffect(() => {
    const stored = window.localStorage.getItem(BROKER_SEGMENT_STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(BROKER_SEGMENT_STORAGE_KEY, currentSegment);
      return;
    }

    const normalized = normalizeBrokerSegment(stored);
    const currentCookie = normalizeBrokerSegment(decodeURIComponent(cookieValue(BROKER_SEGMENT_COOKIE) ?? ""));

    if (normalized !== currentSegment || normalized !== currentCookie) {
      let cancelled = false;

      void persistBrokerSegment(normalized).finally(() => {
        if (!cancelled) router.refresh();
      });

      return () => {
        cancelled = true;
      };
    }
  }, [currentSegment, router]);

  return null;
}
