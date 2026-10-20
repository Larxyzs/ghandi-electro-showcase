/**
 * Bulk import of "ghandi-products/v1" files into the existing products table.
 * Uses the same table, folders (catalog_nodes), product_nodes links and
 * product-images bucket as the regular "add product" form.
 */
import type { Json } from "@/integrations/supabase/types";
import { adminDb } from "./admin.server";
import type { BulkItem, BulkOptions, BulkRowResult, PreviewRow } from "./bulk-import-types";
import { runIsolated } from "./batch-runner";

type Db = Awaited<ReturnType<typeof adminDb>>;

const norm = (v: string) => v.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");

async function loadFolders(db: Db) {
  const { data } = await db.from("catalog_nodes").select("id, parent_id, name, level, slug");
  return data ?? [];
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
      const existing = await findExisting(db, item);
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

      const foreign = item.currency && item.currency !== "MAD";
      const price = foreign && opts.dropForeignPrice ? null : item.priceValue;

      const full = {
        name: item.name,
        brand: item.brand,
        model: item.model,
        serial_number: item.model,
        price,
        price_text: item.priceText,
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
        else {
          patch = { imported_at: full.imported_at };
          for (const [k, v] of Object.entries(full)) {
            if (k === "imported_at") continue;
            if (isEmpty((existing as Record<string, unknown>)[k]) && !isEmpty(v)) patch[k] = v;
          }
        }
        const { error } = await db.from("products").update(patch as never).eq("id", existing.id);
        if (error) throw new Error(error.message);
        const link = await db.from("product_nodes").upsert({ product_id: existing.id, node_id: nodeId }, { onConflict: "product_id,node_id", ignoreDuplicates: true });
        if (link.error) throw new Error(link.error.message);
        return { key: item.key, outcome: "updated", productId: existing.id, warnings };
      }

      const { data, error } = await db
        .from("products")
        .insert({ ...full, node_id: nodeId, stock: 0, characteristics: "" })
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
        await db.from("product_nodes").delete().eq("product_id", createdId);
        await db.from("products").delete().eq("id", createdId);
      }
      if (uploaded.length) await db.storage.from("product-images").remove(uploaded);
      return { key: item.key, outcome: "problem", error: error instanceof Error ? error.message : "Erreur" };
    } finally {
      release();
    }
  }, { concurrency: 3 });
  return outcomes.map((r) => r.ok ? r.value : { key: items[r.index]?.key ?? "", outcome: "problem", error: r.error });
}
