import { adminDb, uploadImageFromDataUrl } from "./admin.server";
import type { SiteContent } from "./catalog-types";

/** Merges a partial update into site_settings.content. */
export async function saveContent(patch: SiteContent) {
  const db = await adminDb();
  const { data } = await db.from("site_settings").select("content").eq("id", "default").maybeSingle();
  const current = ((data?.content ?? {}) as SiteContent) || {};
  const next = { ...current, ...patch };
  if (next.shortcuts) next.shortcuts = next.shortcuts.slice(0, 3);
  const { error } = await db.from("site_settings").update({ content: next as never }).eq("id", "default");
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function uploadImage(dataUrl: string, name: string) {
  const db = await adminDb();
  if (!/^data:image\/(png|jpe?g|webp|avif);base64,/.test(dataUrl)) throw new Error("INVALID_IMAGE");
  return { path: await uploadImageFromDataUrl(db, dataUrl, name) };
}

/* ---- generic rows ---- */
type Table = "brands" | "faq_items" | "guides" | "newsletter_subscribers" | "contact_messages";
const FIELDS: Record<Table, string[]> = {
  brands: ["name", "slug", "logo_url", "description", "sort_order", "visible"],
  faq_items: ["category", "question", "answer", "sort_order", "published"],
  guides: ["title", "slug", "cover_url", "node_id", "summary", "body", "published", "published_at"],
  newsletter_subscribers: [],
  contact_messages: ["read"],
};
const ORDER: Record<Table, [string, boolean]> = {
  brands: ["sort_order", true],
  faq_items: ["sort_order", true],
  guides: ["published_at", false],
  newsletter_subscribers: ["created_at", false],
  contact_messages: ["created_at", false],
};

export async function listRows(table: Table) {
  const db = await adminDb();
  const [col, asc] = ORDER[table];
  const { data, error } = await db.from(table).select("*").order(col, { ascending: asc }).limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

export async function saveRow(table: Table, row: Record<string, unknown>) {
  const db = await adminDb();
  const clean: Record<string, unknown> = {};
  for (const f of FIELDS[table]) if (f in row) clean[f] = row[f] === "" && f === "node_id" ? null : row[f];
  const id = typeof row["id"] === "string" && row["id"] ? row["id"] : null;
  const q = id ? db.from(table).update(clean as never).eq("id", id) : db.from(table).insert(clean as never);
  const { error } = await q;
  if (error) throw new Error(error.code === "23505" ? "Ce nom ou cette adresse existe déjà." : error.message);
  return { ok: true as const };
}

export async function deleteRow(table: Table, id: string) {
  const db = await adminDb();
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/** Category extras (menu visibility, short name, SEO, intro). */
export async function saveNodeMeta(id: string, meta: Record<string, unknown>) {
  const db = await adminDb();
  const allowed = ["show_in_menu", "menu_label", "seo_title", "seo_description", "intro_text", "seo_text"];
  const clean: Record<string, unknown> = {};
  for (const k of allowed) if (k in meta) clean[k] = k === "show_in_menu" ? Boolean(meta[k]) : String(meta[k] ?? "").slice(0, 5000);
  const { error } = await db.from("catalog_nodes").update(clean as never).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export type { Table as ContentTable };
