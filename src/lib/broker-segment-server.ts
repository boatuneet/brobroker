import { cookies } from "next/headers";
import {
  BROKER_SEGMENT_COOKIE,
  type BrokerSegment,
  normalizeBrokerSegment,
} from "./broker-segments";

export async function getActiveBrokerSegment(): Promise<BrokerSegment> {
  const cookieStore = await cookies();
  return normalizeBrokerSegment(cookieStore.get(BROKER_SEGMENT_COOKIE)?.value);
}
