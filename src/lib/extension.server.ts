import { adminDb } from "./admin.server";
import { runIsolated } from "./batch-runner";

async function sha256(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listKeys() {
  const db = await adminDb();
  const { data } = await db.from("extension_keys").select("id, label, created_at, last_used_at, revoked").order("created_at", { ascending: false });
  return data ?? [];
}

export async function createKey(label: string) {
  const db = await adminDb();
  const abc = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  const key = "gk_" + [...bytes].map((b) => abc[b % abc.length]).join("");
  const { error } = await db.from("extension_keys").insert({ label, key_hash: await sha256(key) });
  if (error) throw new Error(error.message);
  return { key };
}

export async function revokeKey(id: string) {
  const db = await adminDb();
  await db.from("extension_keys").update({ revoked: true }).eq("id", id);
}

export type InboxBatch = {
  id: string; label: string; note: string; status: string; product_count: number; pending: number;
  brands: string; created_at: string; updated_at: string; suggested_section_text: string; suggested_category_id: string | null; incomplete: boolean;
};

export async function listBatches(): Promise<InboxBatch[]> {
  const db = await adminDb();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await db.from("extension_batches").select("*").neq("status", "cancelled").gte("updated_at", since).order("created_at", { ascending: false });
  const batches = data ?? [];
  if (!batches.length) return [];
  const { data: items } = await db.from("extension_inbox_items").select("batch_id, status, payload->brand").in("batch_id", batches.map((b) => b.id));
  return batches.map((b) => {
    const mine = (items ?? []).filter((i) => i.batch_id === b.id);
    const brands = [...new Set(mine.map((i) => String((i as { brand?: unknown }).brand ?? "")).filter(Boolean))].join(", ");
    return {
      ...b,
      pending: mine.filter((i) => i.status === "pending").length,
      product_count: b.product_count || mine.length,
      brands,
      incomplete: b.status === "receiving" && Date.now() - new Date(b.updated_at).getTime() > 864e5,
    };
  });
}

export async function readyCount() {
  const db = await adminDb();
  const { data } = await db.from("extension_batches").select("id, label, product_count").eq("status", "ready").order("created_at", { ascending: false });
  return data ?? [];
}

export async function cancelBatch(id: string) {
  const db = await adminDb();
  await db.from("extension_batches").delete().eq("id", id);
}

export async function getBatch(id: string) {
  const db = await adminDb();
  const { data: batch } = await db.from("extension_batches").select("*").eq("id", id).maybeSingle();
  if (!batch) return null;
  const { data: items } = await db.from("extension_inbox_items").select("id, source_url, payload, suggested_category_id, status").eq("batch_id", id).eq("status", "pending").order("created_at");
  return { batch, items: items ?? [] };
}

export async function markItems(batchId: string, rows: { id: string; status: "imported" | "skipped"; productId?: string | null }[]) {
  const db = await adminDb();
  const groups = new Map<string, { status: "imported" | "skipped"; productId: string | null; ids: string[] }>();
  for (const row of rows) {
    const key = `${row.status}:${row.productId ?? ""}`;
    const group = groups.get(key) ?? { status: row.status, productId: row.productId ?? null, ids: [] };
    group.ids.push(row.id);
    groups.set(key, group);
  }
  const outcomes = await runIsolated([...groups.values()], async (group) => {
    const { error } = await db.from("extension_inbox_items").update({ status: group.status, product_id: group.productId }).in("id", group.ids).eq("batch_id", batchId);
    if (error) throw new Error(error.message);
  }, { concurrency: 6 });
  const failed = outcomes.find((r) => !r.ok);
  if (failed && !failed.ok) throw new Error(failed.error);
  const { count, error } = await db.from("extension_inbox_items").select("id", { count: "exact", head: true }).eq("batch_id", batchId).eq("status", "pending");
  if (error) throw new Error(error.message);
  if (count === 0) {
    const { error: doneError } = await db.from("extension_batches").update({ status: "done" }).eq("id", batchId);
    if (doneError) throw new Error(doneError.message);
  }
  return { pending: count ?? 0 };
}
