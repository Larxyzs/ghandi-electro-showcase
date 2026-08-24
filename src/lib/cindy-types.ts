import type { MarketingSection, ProductSpec } from "./catalog-types";

export type CindyActivityKind = "search" | "open" | "read" | "images" | "extract" | "compare" | "cache";

export type CindyActivityStatus = "running" | "done" | "error";

export type CindySource = {
  url: string;
  domain: string;
  title: string;
  official: boolean;
  status: string;
};

/** Normalized, store-agnostic product data researched by Cindy. */
export type ResearchedProduct = {
  brand: string;
  name: string;
  model: string;
  characteristics: string;
  specifications: ProductSpec[];
  images: string[];
  marketing_sections: MarketingSection[];
  sources: { name: string; url: string; official: boolean }[];
  confidence: "high" | "medium" | "low";
  notes: string;
};

/** One line of a bulk (multi-reference) research run. */
export type CindyBulkItem = {
  index: number;
  ref: string;
  status: "pending" | "running" | "done" | "error";
  cached?: boolean;
  product?: ResearchedProduct;
  message?: string;
};

export type CindyEvent =
  | { type: "message"; text: string }
  | {
      type: "activity";
      id: string;
      kind: CindyActivityKind;
      label: string;
      detail?: string;
      status: CindyActivityStatus;
    }
  | { type: "source"; source: CindySource }
  | { type: "checklist"; label: string; done: boolean }
  | { type: "result"; product: ResearchedProduct; cached?: boolean }
  | { type: "bulk_item"; item: CindyBulkItem }
  | { type: "bulk_summary"; total: number; ok: number; failed: number }
  | { type: "error"; message: string }
  | { type: "done" };


export type CindySessionSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type CindySessionRecord = CindySessionSummary & {
  events: CindyEvent[];
  query: string;
};

export const ACTIVITY_LABELS: Record<CindyActivityKind, string> = {
  search: "Recherche",
  open: "Ouverture",
  read: "Lecture",
  images: "Images",
  extract: "Extraction",
  compare: "Comparaison",
  cache: "Mémoire",
};
