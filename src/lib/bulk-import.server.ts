/**
 * Bulk import of "ghandi-products/v1" files into the existing products table.
 * Uses the same table, folders (catalog_nodes), product_nodes links and
 * product-images bucket as the regular "add product" form.
 */
import type { Json } from "@/integrations/supabase/types";
import { adminDb } from "./admin.server";
import type { BulkItem, BulkOptions, BulkRowResult, PreviewRow } from "./bulk-import-types";
import { runIsolated } from "./batch-runner";
import { purgeProducts } from "./product-purge.server";

type Db = Awaited<ReturnType<typeof adminDb>>;

const norm = (v: string) => v.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");

async function loadFolders(db: Db) {
  const { data } = await db.from("catalog_nodes").select("id, parent_id, name, level, slug");
  return data ?? [];
}

/** Every copy of this product already on the site (same brand page, or same brand + model). */
async function findAllExisting(db: Db, item: BulkItem) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = new Map<string, any>();
  if (item.sourceUrl) {
    const { data } = await db.from("products").select("*").eq("source_url", item.sourceUrl);
    for (const p of data ?? []) found.set(p.id, p);
  }
  if (item.brand && item.model) {
    const m = item.model.replace(/[,()]/g, "");
    const { data } = await db.from("products").select("*").ilike("brand", item.brand).or(`model.ilike.${m},serial_number.ilike.${m}`);
    for (const p of data ?? []) found.set(p.id, p);
  }
  return [...found.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

async function findExisting(db: Db, item: BulkItem) {
  if (item.sourceUrl) {
    const { data } = await db.from("products").select("*").eq("source_url", item.sourceUrl).maybeSingle();
    if (data) return data;
  }
  if (item.brand && item.model) {
    const { data } = await db
      .from("products")
      .select("*")
      .ilike("brand", item.brand)
      .or(`model.ilike.${item.model.replace(/[,()]/g, "")},serial_number.ilike.${item.model.replace(/[,()]/g, "")}`)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

function resolveFolder(
  folders: Awaited<ReturnType<typeof loadFolders>>,
  item: BulkItem,
  opts: Pick<BulkOptions, "folderId" | "fallbackId" | "createMissing">,
): { id?: string; create?: { name: string; parentId: string | null; level: number }; problem?: string } {
  if (item.nodeId && folders.some((f) => f.id === item.nodeId)) return { id: item.nodeId };
  if (opts.folderId) return { id: opts.folderId };
  const holders = folders;
  if (item.category) {
    const hit = holders.find((f) => norm(f.name) === norm(item.category));
    if (hit) return { id: hit.id };
    if (opts.createMissing) {
      const fb = folders.find((f) => f.id === opts.fallbackId);
      if (fb) return { create: { name: item.category, parentId: fb.parent_id, level: fb.level } };
      return { problem: `Catégorie « ${item.category} » introuvable (choisissez un dossier par défaut pour la créer)` };
    }
    if (opts.fallbackId) return { id: opts.fallbackId };
    return { problem: `Catégorie « ${item.category} » introuvable` };
  }
  if (opts.fallbackId) return { id: opts.fallbackId };
  return { problem: "Aucune catégorie" };
}

export async function previewBulk(items: BulkItem[], opts: BulkOptions): Promise<PreviewRow[]> {
  const db = await adminDb();
  const folders = await loadFolders(db);
  const outcomes = await runIsolated(items, async (item): Promise<PreviewRow> => {
    if (!item.name) {
      return { key: item.key, status: "problem", reason: "Nom vide" };
    }
    const existing = await findExisting(db, item);
    const folder = resolveFolder(folders, item, opts);
    if (folder.problem) return { key: item.key, status: "problem", reason: folder.problem };
    return { key: item.key, status: existing ? "exists" : "new", ...(existing ? { existingId: existing.id } : {}) };
  }, { concurrency: 6 });
  return outcomes.map((r) => r.ok ? r.value : { key: items[r.index]?.key ?? "", status: "problem", reason: r.error });
}

async function copyImage(db: Db, url: string): Promise<{ value: string; copied: boolean }> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 GhandiImporter" },
    });
    if (!res.ok) throw new Error(String(res.status));
    const type = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!type.startsWith("image/")) throw new Error("not image");
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("too large");
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("avif") ? "avif" : "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await db.storage.from("product-images").upload(path, bytes, { contentType: type, upsert: false });
    if (error) throw new Error(error.message);
    return { value: path, copied: true };
  } catch {
    return { value: url, copied: false };
  }
}

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

export async function importBulkBatch(items: BulkItem[], opts: BulkOptions, dbOverride?: Db): Promise<BulkRowResult[]> {
  const db = dbOverride ?? (await adminDb());
  const folders = await loadFolders(db);
  // Serialize overlapping identities, but allow independent products in parallel.
  const identityLocks = new Map<string, Promise<void>>();
  const folderLocks = new Map<string, Promise<void>>();
  const outcomes = await runIsolated(items, async (item): Promise<BulkRowResult> => {
    const identities = [item.sourceUrl ? `url:${item.sourceUrl}` : "", item.brand && item.model ? `model:${norm(item.brand)}:${norm(item.model)}` : ""].filter(Boolean);
    const previous = identities.map((key) => identityLocks.get(key));
    let release = () => {};
    const lock = new Promise<void>((resolve) => { release = resolve; });
    identities.forEach((key) => identityLocks.set(key, lock));
    await Promise.all(previous);
    const uploaded: string[] = [];
    let createdId: string | null = null;
    try {
      if (!item.name) throw new Error("Nom vide");
      const replacing = opts.mode === "replace" || opts.mode === "refresh";
      let existing = replacing ? null : await findExisting(db, item);
      if (replacing) {
        // keep ONE copy (its page address stays the same) and remove the others for good
        const all = await findAllExisting(db, item);
        existing = all[0] ?? null;
        if (all.length > 1) await purgeProducts(db, all.slice(1).map((p) => p.id));
      }
      if (existing && opts.mode === "skip") {
        return { key: item.key, outcome: "skipped", productId: existing.id };
      }

      let folder = resolveFolder(folders, item, opts);
      if (folder.problem) throw new Error(folder.problem);
      if (folder.create) {
        const create = folder.create;
        const folderKey = norm(create.name);
        const previousFolder = folderLocks.get(folderKey);
        let releaseFolder = () => {};
        const folderLock = new Promise<void>((resolve) => { releaseFolder = resolve; });
        folderLocks.set(folderKey, folderLock);
        await previousFolder;
        try {
        const again = folders.find((f) => norm(f.name) === folderKey);
        if (again) folder = { id: again.id };
        else {
          const slug = `${norm(folder.create.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "dossier"}-${Math.random().toString(36).slice(2, 6)}`;
          const { data: node, error } = await db
            .from("catalog_nodes")
            .insert({ name: folder.create.name, parent_id: folder.create.parentId, level: folder.create.level, slug, sort_order: 999 })
            .select("id, parent_id, name, level, slug")
            .single();
          if (error) throw new Error(error.message);
          folders.push(node);
          folder = { id: node.id };
        }
        } finally { releaseFolder(); }
      }
      const nodeId = folder.id;
      if (!nodeId) throw new Error("Aucune catégorie");

      // Pictures
      const warnings: string[] = [];
      const urls = Array.from(new Set(item.images.filter((u) => /^https?:\/\//i.test(u))));
      const gallery: string[] = [];
      const images = await runIsolated(urls, async (url) => {
        if (opts.copyImages) {
          const r = await copyImage(db, url);
          if (r.copied) uploaded.push(r.value);
          else warnings.push(`Image non copiée : ${url}`);
          return r.value;
        }
        return url;
      }, { concurrency: 2 });
      images.forEach((r) => { if (r.ok) gallery.push(r.value); });

      const full = {
        name: item.name,
        brand: item.brand,
        model: item.model,
        serial_number: item.model,
        image_url: gallery[0] ?? null,
        gallery: gallery as Json,
        specifications: item.specs as Json,
        spec_groups: item.specGroups as Json,
        needs_review: false,
        review_state: "verified",
        source_url: item.sourceUrl || null,
        source_name: item.brand || null,
        imported_at: new Date().toISOString(),
      };

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let patch: Record<string, any>;
        if (opts.mode === "all") patch = { ...full, node_id: nodeId };
        else if (replacing) {
          // the new version replaces the old one completely, in the section it was sent to.
          // Shop-managed values are never imported.
          patch = { ...full, node_id: nodeId };
        } else {
          patch = { imported_at: full.imported_at };
          for (const [k, v] of Object.entries(full)) {
            if (k === "imported_at") continue;
            if (isEmpty((existing as Record<string, unknown>)[k]) && !isEmpty(v)) patch[k] = v;
          }
        }
        if (existing.name_edited_by_hand) delete patch['name'];
        const { error } = await db.from("products").update(patch as never).eq("id", existing.id);
        if (error) throw new Error(error.message);
        if (replacing) {
          // photos the old version had uploaded and the new one does not use: removed for good
          const ex = existing as Record<string, unknown>;
          const keep = new Set<string>([String(patch["image_url"] ?? ""), ...gallery]);
          const old = [ex["image_url"], ...(Array.isArray(ex["gallery"]) ? (ex["gallery"] as unknown[]) : [])]
            .filter((v): v is string => typeof v === "string" && v.length > 0 && !/^https?:\/\//i.test(v) && !keep.has(v));
          if (old.length) await db.storage.from("product-images").remove(old);
          // only the new section: the old version's sections go away with it
          const unlink = await db.from("product_nodes").delete().eq("product_id", existing.id).neq("node_id", nodeId);
          if (unlink.error) throw new Error(unlink.error.message);
        }
        const link = await db.from("product_nodes").upsert({ product_id: existing.id, node_id: nodeId }, { onConflict: "product_id,node_id", ignoreDuplicates: true });
        if (link.error) throw new Error(link.error.message);
        return { key: item.key, outcome: "updated", productId: existing.id, warnings };
      }

      const { data, error } = await db
        .from("products")
        .insert({ ...full, node_id: nodeId, price: 0, availability: 'out_of_stock', stock: 0, characteristics: "" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      createdId = data.id;
      const link = await db.from("product_nodes").insert({ product_id: data.id, node_id: nodeId });
      if (link.error) throw new Error(link.error.message);
      return { key: item.key, outcome: "created", productId: data.id, warnings };
    } catch (error) {
      // never leave half a product behind
      if (createdId) {
        await purgeProducts(db, [createdId]);
      }
      if (uploaded.length) await db.storage.from("product-images").remove(uploaded);
      return { key: item.key, outcome: "problem", error: error instanceof Error ? error.message : "Erreur" };
    } finally {
      release();
    }
  }, { concurrency: 3 });
  return outcomes.map((r) => r.ok ? r.value : { key: items[r.index]?.key ?? "", outcome: "problem", error: r.error });
}

/**
 * FAST path of importBulkBatch (mode "replace", no photo copy) for the Chrome extension: a whole chunk in about
 * 10 database calls, because Cloudflare's free plan allows only 50 outside calls per request.
 * Same rules: one copy per product (same brand page, or same brand + model), the new version replaces the old one
 * in the section it was sent to, prices/stock and hand-edited names are kept, pictures stay on the brand addresses.
 */

type Row = { id: string; brand: string | null; model: string | null; serial_number: string | null; source_url: string | null; created_at: string; name: string; name_edited_by_hand: boolean; node_id: string | null };

const low = (v: unknown) => String(v ?? "").normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
const COLS = "id, brand, model, serial_number, source_url, created_at, name, name_edited_by_hand, node_id";

export async function importBulkChunkFast(db: Db, items: BulkItem[], nodeId: string | null): Promise<BulkRowResult[]> {
  const results: BulkRowResult[] = [];
  const good = items.filter((it) => {
    if (!it.name) results.push({ key: it.key, outcome: "problem", error: "Nom vide" });
    else if (!nodeId && !it.nodeId) results.push({ key: it.key, outcome: "problem", error: "Aucune catégorie" });
    else return true;
    return false;
  });
  if (!good.length) return results;

  // 1) every copy already on the site, in 3 calls
  const urls = Array.from(new Set(good.map((it) => it.sourceUrl).filter(Boolean)));
  const models = Array.from(new Set(good.flatMap((it) => (it.model ? [it.model, it.model.toUpperCase(), it.model.toLowerCase()] : []))));
  const found = new Map<string, Row>();
  const qs = [
    urls.length ? db.from("products").select(COLS).in("source_url", urls) : null,
    models.length ? db.from("products").select(COLS).in("model", models) : null,
    models.length ? db.from("products").select(COLS).in("serial_number", models) : null,
  ].filter((q) => q !== null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (await Promise.all(qs)) as any[]) {
    if (r.error) throw new Error(r.error.message);
    for (const p of (r.data ?? []) as Row[]) found.set(p.id, p);
  }
  const rows = [...found.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const copiesOf = (it: BulkItem) =>
    rows.filter((p) =>
      (it.sourceUrl && p.source_url === it.sourceUrl) ||
      (it.brand && it.model && low(p.brand) === low(it.brand) && (low(p.model) === low(it.model) || low(p.serial_number) === low(it.model))),
    );

  // 2) decide per product: replace the oldest copy, remove the others for good
  const extra = new Set<string>();
  const taken = new Set<string>();
  const now = new Date().toISOString();
  const plan = good.map((it) => {
    const all = copiesOf(it).filter((p) => !taken.has(p.id));
    const keep = all[0] ?? null;
    if (keep) taken.add(keep.id);
    all.slice(1).forEach((p) => extra.add(p.id));
    const images = Array.from(new Set(it.images.filter((u) => /^https?:\/\//i.test(u))));
    const target = (it.nodeId as string | undefined) || nodeId!;
    const full = {
      name: keep && keep.name_edited_by_hand ? keep.name : it.name,
      brand: it.brand,
      model: it.model,
      serial_number: it.model,
      image_url: images[0] ?? null,
      gallery: images as Json,
      specifications: it.specs as Json,
      spec_groups: it.specGroups as Json,
      needs_review: false,
      review_state: "verified",
      source_url: it.sourceUrl || null,
      source_name: it.brand || null,
      imported_at: now,
      node_id: target,
    };
    return { it, keep, full, target };
  });
  taken.forEach((id) => extra.delete(id));
  if (extra.size) await purgeProducts(db, [...extra]);

  // 3) replace the old copies (1 call) and add the new ones (1 call)
  const upd = plan.filter((p) => p.keep);
  const add = plan.filter((p) => !p.keep);
  const ids = new Map<BulkItem, string>();
  if (upd.length) {
    const { error } = await db.from("products").upsert(upd.map((p) => ({ id: p.keep!.id, ...p.full })), { onConflict: "id", defaultToNull: false });
    if (error) throw new Error(error.message);
    upd.forEach((p) => ids.set(p.it, p.keep!.id));
  }
  if (add.length) {
    const { data, error } = await db
      .from("products")
      .insert(add.map((p) => ({ ...p.full, price: 0, availability: "out_of_stock", stock: 0, characteristics: "" })))
      .select("id, source_url, name");
    if (error) throw new Error(error.message);
    // rows come back in the same order as sent
    (data ?? []).forEach((d: { id: string }, i: number) => add[i] && ids.set(add[i].it, d.id));
  }

  // 4) sections: only the new one (2 calls)
  const all = plan.filter((p) => ids.has(p.it));
  const byTarget = new Map<string, string[]>();
  all.forEach((p) => byTarget.set(p.target, [...(byTarget.get(p.target) ?? []), ids.get(p.it)!]));
  for (const [target, pids] of byTarget) {
    const replaced = pids.filter((id) => upd.some((p) => p.keep!.id === id));
    if (replaced.length) await db.from("product_nodes").delete().in("product_id", replaced).neq("node_id", target);
  }
  if (all.length) {
    const { error } = await db
      .from("product_nodes")
      .upsert(all.map((p) => ({ product_id: ids.get(p.it)!, node_id: p.target })), { onConflict: "product_id,node_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  for (const p of plan) {
    const id = ids.get(p.it);
    results.push(id ? { key: p.it.key, outcome: p.keep ? "updated" : "created", productId: id } : { key: p.it.key, outcome: "problem", error: "Non enregistré" });
  }
  return results;
}
