import { createServerFn } from "@tanstack/react-start";
import type { SiteContent } from "./catalog-types";

type Table = "brands" | "faq_items" | "guides" | "newsletter_subscribers" | "contact_messages";
const TABLES: Table[] = ["brands", "faq_items", "guides", "newsletter_subscribers", "contact_messages"];
const table = (t: unknown): Table => {
  if (!TABLES.includes(t as Table)) throw new Error("INVALID_TABLE");
  return t as Table;
};

export const adminSaveContent = createServerFn({ method: "POST" })
  .inputValidator((d: { patch: SiteContent }) => ({ patch: (d.patch ?? {}) as SiteContent }))
  .handler(async ({ data }) => (await import("./content-admin.server")).saveContent(data.patch));

export const adminUploadImage = createServerFn({ method: "POST" })
  .inputValidator((d: { dataUrl: string; name: string }) => ({ dataUrl: String(d.dataUrl), name: String(d.name ?? "image.jpg").slice(0, 120) }))
  .handler(async ({ data }) => (await import("./content-admin.server")).uploadImage(data.dataUrl, data.name));

export const adminListRows = createServerFn({ method: "POST" })
  .inputValidator((d: { table: Table }) => ({ table: table(d.table) }))
  .handler(async ({ data }) => (await import("./content-admin.server")).listRows(data.table) as Promise<Record<string, string | number | boolean | null>[]>);

export const adminSaveRow = createServerFn({ method: "POST" })
  .inputValidator((d: { table: Table; row: Record<string, unknown> }) => ({ table: table(d.table), row: (d.row ?? {}) as Record<string, string | number | boolean | null> }))
  .handler(async ({ data }) => (await import("./content-admin.server")).saveRow(data.table, data.row));

export const adminDeleteRow = createServerFn({ method: "POST" })
  .inputValidator((d: { table: Table; id: string }) => ({ table: table(d.table), id: String(d.id) }))
  .handler(async ({ data }) => (await import("./content-admin.server")).deleteRow(data.table, data.id));

export const adminSaveNodeMeta = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; meta: Record<string, string | boolean> }) => ({ id: String(d.id), meta: d.meta ?? {} }))
  .handler(async ({ data }) => (await import("./content-admin.server")).saveNodeMeta(data.id, data.meta));
