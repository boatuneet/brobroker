import { readPersisted, writePersisted } from "./browser-persistence";

/* ============================================================
   Re-rank agent configuration.

   The broker tunes how the AI buyer-match agent ranks listings:
   the relative importance of each criterion, a freeform house-style
   instruction, and whether deal-breakers are a hard block. Stored
   locally (per browser) and sent to /api/buyer-match, which folds it
   into the model prompt via buildRerankGuidance().
   ============================================================ */

export type CriterionWeight = "off" | "low" | "medium" | "high";

export const WEIGHT_OPTIONS: CriterionWeight[] = ["off", "low", "medium", "high"];

export interface RerankCriterion {
  id: string;
  label: string;
  weight: CriterionWeight;
}

export interface RerankConfig {
  criteria: RerankCriterion[];
  guidance: string;
  hardBlockDealBreakers: boolean;
}

/* Canonical criteria + their default importance. */
const CRITERIA_DEFS: Array<{ id: string; label: string; weight: CriterionWeight }> = [
  { id: "budget", label: "Budget fit", weight: "high" },
  { id: "size", label: "Size range", weight: "high" },
  { id: "brand", label: "Preferred brand", weight: "medium" },
  { id: "location", label: "Preferred location", weight: "medium" },
  { id: "vat", label: "VAT status", weight: "medium" },
  { id: "cabins", label: "Cabins", weight: "low" },
  { id: "condition", label: "Condition / build year", weight: "low" },
  { id: "lifestyle", label: "Lifestyle & taste", weight: "low" },
];

export const DEFAULT_RERANK_CONFIG: RerankConfig = {
  criteria: CRITERIA_DEFS.map((def) => ({ ...def })),
  guidance: "",
  hardBlockDealBreakers: true,
};

const STORAGE_KEY = "brobroker:rerank-config";
export const RERANK_CONFIG_CHANGED = "brobroker:rerank-config:changed";

/* Merge a stored/partial config with the defaults so a changed criteria list
   (or hand-edited storage) can't break the shape. */
export function normalizeRerankConfig(raw: unknown): RerankConfig {
  const partial = (raw && typeof raw === "object" ? raw : {}) as Partial<RerankConfig>;
  const storedById = new Map<string, CriterionWeight>(
    Array.isArray(partial.criteria)
      ? partial.criteria
          .filter((c): c is RerankCriterion => !!c && typeof c.id === "string")
          .map((c) => [c.id, WEIGHT_OPTIONS.includes(c.weight) ? c.weight : "medium"])
      : [],
  );

  return {
    criteria: CRITERIA_DEFS.map((def) => ({
      ...def,
      weight: storedById.get(def.id) ?? def.weight,
    })),
    guidance: typeof partial.guidance === "string" ? partial.guidance : "",
    hardBlockDealBreakers:
      typeof partial.hardBlockDealBreakers === "boolean" ? partial.hardBlockDealBreakers : true,
  };
}

/* ---- Prompt formatter (server-safe; no browser APIs) ---- */
export function buildRerankGuidance(config: RerankConfig): string {
  const active = config.criteria.filter((c) => c.weight !== "off");
  const ignored = config.criteria.filter((c) => c.weight === "off");
  const lines: string[] = [];

  if (active.length) {
    lines.push("Weight these criteria by the broker's stated importance:");
    for (const c of active) lines.push(`- ${c.label}: ${c.weight} importance`);
  }
  if (ignored.length) {
    lines.push(`Ignore these criteria entirely: ${ignored.map((c) => c.label).join(", ")}.`);
  }
  lines.push(
    config.hardBlockDealBreakers
      ? "If a listing conflicts with any buyer deal-breaker, rank it last (near-zero fit)."
      : "Treat deal-breakers as a soft negative signal, not an automatic disqualifier.",
  );
  if (config.guidance.trim()) {
    lines.push(`Broker guidance: ${config.guidance.trim()}`);
  }
  return lines.join("\n");
}

/* ---- Client store (localStorage + change event) ---- */
export function readRerankConfig(): RerankConfig {
  return normalizeRerankConfig(readPersisted<RerankConfig | null>(STORAGE_KEY, null));
}

export function writeRerankConfig(config: RerankConfig): void {
  writePersisted(STORAGE_KEY, config);
  if (typeof window !== "undefined") {
    cachedRaw = null; // force the next snapshot to re-read
    window.dispatchEvent(new Event(RERANK_CONFIG_CHANGED));
  }
}

/* useSyncExternalStore plumbing — stable snapshot reference while the stored
   string is unchanged (mirrors the session-buyer store). */
let cachedRaw: string | null = null;
let cachedSnapshot: RerankConfig = DEFAULT_RERANK_CONFIG;

export function subscribeRerankConfig(notify: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", notify);
  window.addEventListener(RERANK_CONFIG_CHANGED, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(RERANK_CONFIG_CHANGED, notify);
  };
}

export function getRerankConfigSnapshot(): RerankConfig {
  if (typeof window === "undefined") return DEFAULT_RERANK_CONFIG;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = readRerankConfig();
  return cachedSnapshot;
}

export function getRerankConfigServerSnapshot(): RerankConfig {
  return DEFAULT_RERANK_CONFIG;
}
