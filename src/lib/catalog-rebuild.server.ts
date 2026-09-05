/**
 * Catalogue rebuild — persistence and resumable batches.
 *
 *   freeze references → (optionally) delete products → rebuild queue →
 *   exact official URL → official page → identity → extraction → gallery →
 *   AI interpretation → verified / needs_review
 *
 * References are frozen BEFORE anything is deleted and are never removed.
 * Work is done in bounded chunks so a 1 000–3 000 product rebuild resumes from
 * the database instead of restarting.
 */
import { runIsolated } from "./batch-runner";
import { freezeReferences, listReferences, markReferenceStatus } from "./catalog-references.server";
import { referenceLabel, type CatalogReference } from "./catalog-references";
import { rebuildReference, type RebuildDeps, type RebuildOutcome } from "./catalog-rebuild";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type RebuildJob = {
  id: string;
  state: "running" | "paused" | "done" | "failed";
  references_preserved: number;
  total: number;
  processed: number;
  verified: number;
  needs_review: number;
  failed: number;
  remaining: number;
  current_label: string;
  products_deleted: number;
  error: string;
};

/* --------------------------- folder resolution --------------------------- */

const norm = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Folder the rebuilt product belongs to: stored node, else its saved path. */
async function resolveNodeForReference(ref: CatalogReference): Promise<string> {
  const client = await db();
  if (ref.node_id) {
    const { data } = await client.from("catalog_nodes").select("id").eq("id", ref.node_id).maybeSingle();
    if (data?.id) return data.id;
  }
  const segments = (ref.node_path || ref.product_type)
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length === 0) throw new Error("NODE_UNRESOLVED");

  const { createNode } = await import("./admin.server");
  let parentId: string | null = null;
  let currentId = "";
  for (const segment of segments.slice(0, 4)) {
    const { data: rows } = await client.from("catalog_nodes").select("id, name, parent_id");
    const found = (rows ?? []).find(
      (row) => (row.parent_id ?? null) === parentId && norm(row.name ?? "") === norm(segment),
    );
    if (found) {
      currentId = found.id;
      parentId = found.id;
      continue;
    }
    const created = await createNode(parentId, segment);
    currentId = created.id;
    parentId = created.id;
  }
  if (!currentId) throw new Error("NODE_UNRESOLVED");
  return currentId;
}

/* ------------------------------ deps wiring ------------------------------ */

export async function rebuildDeps(signal?: AbortSignal): Promise<RebuildDeps> {
  const { importFromUrl } = await import("./import-url.server");
  const { saveProduct } = await import("./admin.server");
  return {
    // One import call per reference: its own page, its own AI context.
    importUrl: async (url) =>
      (await importFromUrl(url, {
        ...(signal ? { signal } : {}),
        persist: true,
      })) as never,
    resolveNode: resolveNodeForReference,
    saveProduct: async (payload) => {
      const saved = await saveProduct({
        node_id: payload.node_id,
        name: payload.name,
        brand: payload.brand,
        serial_number: payload.serial_number,
        stock: payload.stock,
        price: payload.price,
        characteristics: payload.characteristics,
        specifications: payload.specifications,
        gallery: payload.gallery,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        source_url: payload.source_url,
        source_name: payload.source_name,
        review_state: payload.review_state,
        extraction_evidence: payload.extraction_evidence as never,
        featured: false,
      } as never);
      return { id: (saved as { id: string }).id };
    },
  };
}

/* --------------------------------- job ---------------------------------- */

/**
 * Starts a rebuild: freezes the master references first, then (optionally)
 * deletes the product rows, then queues one item per reference.
 */
export async function startRebuild(options: {
  deleteProducts?: boolean;
  createdBy?: string;
  label?: string;
  onlyStatus?: "pending" | "failed" | "needs_review" | "official_page_inaccessible";
}): Promise<RebuildJob & { references_frozen: Awaited<ReturnType<typeof freezeReferences>> }> {
  const client = await db();

  // Step 1 — freeze the references BEFORE touching any product.
  const frozen = await freezeReferences({ source: "rebuild_snapshot" });
  const references = (await listReferences({ activeOnly: true })).filter((ref) =>
    options.onlyStatus ? ref.last_status === options.onlyStatus : true,
  );
  if (references.length === 0) throw new Error("NO_REFERENCES");

  const { data: job, error } = await client
    .from("catalog_rebuild_jobs")
    .insert({
      label: options.label ?? "Reconstruction du catalogue",
      created_by: options.createdBy ?? "",
      state: "running",
      references_preserved: frozen.total,
      total: references.length,
      delete_products: options.deleteProducts !== false,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const jobId = job.id as string;

  // Step 2/3 — the references are safe, so product rows may now be removed.
  let productsDeleted = 0;
  if (options.deleteProducts !== false) {
    const { count } = await client.from("products").select("id", { count: "exact", head: true });
    await client.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    productsDeleted = count ?? 0;
    await client.from("catalog_rebuild_jobs").update({ products_deleted: productsDeleted }).eq("id", jobId);
  }

  await client.from("catalog_rebuild_items").insert(
    references.map((ref, index) => ({
      job_id: jobId,
      reference_id: ref.id,
      position: index,
      status: "pending",
      label: referenceLabel(ref),
    })) as never,
  );

  return {
    id: jobId,
    state: "running",
    references_preserved: frozen.total,
    total: references.length,
    processed: 0,
    verified: 0,
    needs_review: 0,
    failed: 0,
    remaining: references.length,
    current_label: "",
    products_deleted: productsDeleted,
    error: "",
    references_frozen: frozen,
  };
}

/** Live counters of a rebuild, read from the database (resume-safe). */
export async function rebuildProgress(jobId: string): Promise<RebuildJob> {
  const client = await db();
  const { data } = await client
    .from("catalog_rebuild_jobs")
    .select(
      "id, state, references_preserved, total, processed, verified, needs_review, failed, current_label, products_deleted, error",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (!data) throw new Error("JOB_NOT_FOUND");
  return {
    id: data.id as string,
    state: data.state as RebuildJob["state"],
    references_preserved: data.references_preserved ?? 0,
    total: data.total ?? 0,
    processed: data.processed ?? 0,
    verified: data.verified ?? 0,
    needs_review: data.needs_review ?? 0,
    failed: data.failed ?? 0,
    remaining: Math.max(0, (data.total ?? 0) - (data.processed ?? 0)),
    current_label: data.current_label ?? "",
    products_deleted: data.products_deleted ?? 0,
    error: data.error ?? "",
  };
}

export async function latestRebuild(): Promise<RebuildJob | null> {
  const client = await db();
  const { data } = await client
    .from("catalog_rebuild_jobs")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ? rebuildProgress(data.id as string) : null;
}

export async function setRebuildState(jobId: string, state: RebuildJob["state"]) {
  const client = await db();
  await client.from("catalog_rebuild_jobs").update({ state }).eq("id", jobId);
  return rebuildProgress(jobId);
}

/**
 * Processes ONE chunk of the queue. Called repeatedly (by Cindy or the admin
 * panel) so a very large catalogue never runs in a single request, and a crash
 * loses at most the current chunk.
 */
export async function runRebuildChunk(
  jobId: string,
  options: { size?: number; concurrency?: number; signal?: AbortSignal } = {},
): Promise<RebuildJob & { done: boolean; outcomes: { label: string; status: string; error: string }[] }> {
  const client = await db();
  const job = await rebuildProgress(jobId);
  if (job.state === "paused") return { ...job, done: false, outcomes: [] };

  const size = Math.max(1, Math.min(options.size ?? 25, 100));
  const { data: items } = await client
    .from("catalog_rebuild_items")
    .select("id, reference_id, label, attempts")
    .eq("job_id", jobId)
    .in("status", ["pending", "processing"])
    .order("position")
    .limit(size);

  const queue = items ?? [];
  if (queue.length === 0) {
    await client.from("catalog_rebuild_jobs").update({ state: "done", current_label: "" }).eq("id", jobId);
    return { ...(await rebuildProgress(jobId)), done: true, outcomes: [] };
  }

  const references = await listReferences({ activeOnly: false });
  const refById = new Map(references.map((ref) => [ref.id, ref]));
  const deps = await rebuildDeps(options.signal);
  const outcomes: { label: string; status: string; error: string }[] = [];

  await runIsolated(
    queue,
    async (item) => {
      const ref = refById.get(item.reference_id as string);
      if (!ref) {
        await client
          .from("catalog_rebuild_items")
          .update({ status: "failed", error: "REFERENCE_MISSING" })
          .eq("id", item.id);
        return;
      }
      await client
        .from("catalog_rebuild_items")
        .update({ status: "processing", attempts: (item.attempts ?? 0) + 1 })
        .eq("id", item.id);
      await client
        .from("catalog_rebuild_jobs")
        .update({ current_label: referenceLabel(ref) })
        .eq("id", jobId);

      // Full isolation: this outcome is built only from this reference's page.
      const outcome: RebuildOutcome = await rebuildReference(ref, deps);

      await client
        .from("catalog_rebuild_items")
        .update({
          status: outcome.status,
          error: outcome.error,
          product_id: outcome.productId,
          label: outcome.label,
          detail: outcome.detail as never,
        })
        .eq("id", item.id);
      await markReferenceStatus(ref.id, outcome.status, {
        error: outcome.error,
        product_id: outcome.productId,
      });

      const counters = await client
        .from("catalog_rebuild_items")
        .select("status")
        .eq("job_id", jobId);
      const rows = counters.data ?? [];
      const processed = rows.filter((row) => row.status !== "pending" && row.status !== "processing").length;
      await client
        .from("catalog_rebuild_jobs")
        .update({
          processed,
          verified: rows.filter((row) => row.status === "verified").length,
          needs_review: rows.filter((row) => row.status === "needs_review").length,
          failed: rows.filter(
            (row) =>
              row.status === "failed" ||
              row.status === "official_page_inaccessible" ||
              row.status === "identity_mismatch",
          ).length,
        })
        .eq("id", jobId);

      outcomes.push({ label: outcome.label, status: outcome.status, error: outcome.error });
    },
    {
      concurrency: Math.max(1, Math.min(options.concurrency ?? 3, 6)),
      ...(options.signal ? { signal: options.signal } : {}),
    },
  );

  const progress = await rebuildProgress(jobId);
  const done = progress.processed >= progress.total;
  if (done) await client.from("catalog_rebuild_jobs").update({ state: "done" }).eq("id", jobId);
  return { ...progress, state: done ? "done" : progress.state, done, outcomes };
}
