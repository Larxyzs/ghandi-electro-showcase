/**
 * Catalogue checkup — orchestration and persistence.
 *
 * Deterministic code does the checking (stored data, master references,
 * official pages through the existing retrieval/extraction pipeline). The AI is
 * only asked to word the conclusions; it never invents or "corrects" a
 * manufacturer value, and it never sees two products in the same context.
 */
import { runIsolated } from "./batch-runner";
import {
  auditAgainstOfficial,
  auditStoredCatalog,
  formatAuditReport,
  summarizeFindings,
  type AuditFinding,
  type AuditProduct,
  type AuditSummary,
  type OfficialSnapshot,
} from "./catalog-audit";
import { listReferences } from "./catalog-references.server";
import { referenceKey, usableOfficialUrl, type CatalogReference } from "./catalog-references";
import { auditGallery, dedupeGallery, type ProductSpec } from "./catalog-types";
import { pathOf } from "./catalog-types";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const codeOf = (value: string) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function loadAuditProducts(limit = 3000): Promise<AuditProduct[]> {
  const client = await db();
  const [{ data: products }, { data: nodes }] = await Promise.all([
    client
      .from("products")
      .select(
        "id, name, brand, serial_number, node_id, source_url, source_name, review_state, price, specifications, gallery, image_url, extraction_evidence",
      )
      .limit(limit),
    client.from("catalog_nodes").select("id, parent_id, name, slug, level, sort_order, image_url"),
  ]);
  const nodeList = (nodes ?? []) as never;
  return (products ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? "",
    brand: row.brand ?? "",
    serial_number: row.serial_number ?? "",
    node_id: row.node_id ?? "",
    node_path: pathOf(nodeList, row.node_id ?? null)
      .map((node) => node.name)
      .join(" / "),
    source_url: row.source_url ?? null,
    source_name: row.source_name ?? null,
    review_state: row.review_state ?? "verified",
    price: row.price ?? null,
    specifications: (row.specifications ?? []) as ProductSpec[],
    gallery: (row.gallery ?? []) as string[],
    image_url: row.image_url ?? null,
    extraction_evidence: (row.extraction_evidence ?? []) as AuditProduct["extraction_evidence"],
  }));
}

/** Reads ONE official page for ONE product; a failure is data, never a throw. */
async function officialSnapshot(url: string, signal?: AbortSignal): Promise<OfficialSnapshot> {
  const { importFromUrl } = await import("./import-url.server");
  const result = await importFromUrl(url, { ...(signal ? { signal } : {}), persist: false });
  return {
    status: result.status,
    error: result.error,
    canonicalUrl: result.canonicalUrl,
    identity: {
      brand: result.identity.brand,
      name: result.identity.name,
      model: result.identity.model,
    },
    gallery: result.gallery,
    specifications: result.specifications,
    conflicts: result.conflicts,
    missing: result.missing,
  };
}

export type AuditRun = {
  id: string;
  summary: AuditSummary;
  findings: AuditFinding[];
  report: string;
  deep_checked: number;
  explanation: string;
};

/**
 * Full checkup. `deep` compares each product with its own official page using
 * the existing retrieval/extraction architecture, in isolation.
 */
export async function runCatalogAudit(
  options: {
    deep?: boolean;
    deepLimit?: number;
    createdBy?: string;
    signal?: AbortSignal;
    concurrency?: number;
    explain?: boolean;
    onProgress?: (progress: { checked: number; total: number; current: string }) => void;
  } = {},
): Promise<AuditRun> {
  const client = await db();
  const products = await loadAuditProducts();
  const references = await listReferences({ activeOnly: true });

  const findings: AuditFinding[] = auditStoredCatalog(products, references);

  const refByProduct = new Map<string, CatalogReference>();
  for (const ref of references) {
    if (ref.product_id) refByProduct.set(ref.product_id, ref);
    const model = codeOf(ref.model);
    const match = products.find((product) => codeOf(product.serial_number) === model);
    if (match && !refByProduct.has(match.id)) refByProduct.set(match.id, ref);
  }

  let deepChecked = 0;
  if (options.deep) {
    const targets = products
      .filter((product) => usableOfficialUrl(product.source_url))
      .slice(0, Math.max(1, Math.min(options.deepLimit ?? 40, 300)));

    await runIsolated(
      targets,
      async (product) => {
        options.onProgress?.({
          checked: deepChecked,
          total: targets.length,
          current: [product.brand, product.serial_number].filter(Boolean).join(" "),
        });
        const url = usableOfficialUrl(product.source_url)!;
        const snapshot = await officialSnapshot(url, options.signal);
        findings.push(
          ...auditAgainstOfficial(product, snapshot, refByProduct.get(product.id)?.id ?? null),
        );
        deepChecked += 1;
      },
      {
        concurrency: Math.max(1, Math.min(options.concurrency ?? 3, 5)),
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
  }

  const summary = summarizeFindings(products.length, findings);
  const report = formatAuditReport(summary, findings);

  const { data: run } = await client
    .from("catalog_audit_runs")
    .insert({
      created_by: options.createdBy ?? "",
      deep: Boolean(options.deep),
      state: "done",
      checked: products.length,
      verified: summary.verified,
      needs_review: summary.needs_review,
      incorrect: summary.incorrect,
      summary: { ...summary, deep_checked: deepChecked } as never,
    })
    .select("id")
    .single();
  const runId = (run?.id as string) ?? "";

  if (runId && findings.length) {
    for (let index = 0; index < findings.length; index += 200) {
      await client.from("catalog_audit_findings").insert(
        findings.slice(index, index + 200).map((item) => ({ run_id: runId, ...item })) as never,
      );
    }
  }

  let explanation = "";
  if (options.explain !== false && findings.length) {
    explanation = await explainAudit(summary, findings, options.signal).catch(() => "");
  }

  return { id: runId, summary, findings, report, deep_checked: deepChecked, explanation };
}

/**
 * One AI call, wording only: it explains the deterministic findings in plain
 * words. It is explicitly forbidden to add, guess or correct any value.
 */
async function explainAudit(
  summary: AuditSummary,
  findings: AuditFinding[],
  signal?: AbortSignal,
): Promise<string> {
  const { aiSetup, aiFailure, aiFetchWithRetry } = await import("./ai-config.server");
  const ai = await aiSetup();
  const body = {
    model: ai.model,
    messages: [
      {
        role: "system",
        content:
          "Tu expliques à un administrateur marocain le résultat d'un contrôle de catalogue déjà effectué par du code. " +
          "Tu n'ajoutes AUCUNE donnée technique, tu ne corriges AUCUNE valeur fabricant, tu n'utilises pas tes connaissances générales : " +
          "tu reformules seulement les constats fournis, en français simple, en priorisant ce qui est grave. Maximum 12 lignes.",
      },
      {
        role: "user",
        content: JSON.stringify({
          totaux: summary,
          constats: findings.slice(0, 60).map((item) => ({
            article: item.product_label,
            probleme: item.problem,
            preuve: item.evidence,
            gravite: item.severity,
            action: item.action,
          })),
        }).slice(0, 12000),
      },
    ],
  };
  const res = await aiFetchWithRetry(
    ai.url,
    { method: "POST", headers: ai.headers, body: JSON.stringify(body) },
    signal ? { signal } : {},
  );
  if (!res.ok) throw await aiFailure(res);
  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (payload.choices?.[0]?.message?.content ?? "").trim();
}

export async function listAuditRuns(limit = 10) {
  const client = await db();
  const { data } = await client
    .from("catalog_audit_runs")
    .select("id, created_at, deep, checked, verified, needs_review, incorrect, summary")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function listAuditFindings(runId: string, limit = 200) {
  const client = await db();
  const { data } = await client
    .from("catalog_audit_findings")
    .select("*")
    .eq("run_id", runId)
    .order("severity")
    .limit(limit);
  return data ?? [];
}

/* ------------------------------- repairs -------------------------------- */

const GALLERY_CLEAN_CODES = new Set([
  "duplicate_images",
  "invalid_gallery_entries",
  "main_image_outside_gallery",
]);
const REIMPORT_CODES = new Set([
  "invalid_gallery",
  "stale_gallery",
  "missing_gallery",
  "non_official_images",
  "stale_data",
  "missing_specifications",
  "reference_without_product",
]);

/**
 * Applies ONLY the repairs the audit marked as safe. Anything ambiguous stays
 * needs_review: no value is ever guessed, no source is ever substituted.
 */
export async function repairAuditFindings(
  runId: string,
  options: { ids?: string[]; limit?: number; signal?: AbortSignal } = {},
): Promise<{ repaired: number; skipped: number; details: string[] }> {
  const client = await db();
  let query = client
    .from("catalog_audit_findings")
    .select("*")
    .eq("run_id", runId)
    .eq("auto_repair_safe", true)
    .is("repaired_at", null);
  if (options.ids?.length) query = query.in("id", options.ids);
  const { data } = await query.limit(Math.min(options.limit ?? 100, 300));

  const details: string[] = [];
  let repaired = 0;
  let skipped = 0;

  for (const item of data ?? []) {
    const code = item.problem_code as string;
    try {
      if (GALLERY_CLEAN_CODES.has(code) && item.product_id) {
        const { data: row } = await client
          .from("products")
          .select("gallery, image_url")
          .eq("id", item.product_id)
          .maybeSingle();
        const audit = auditGallery((row?.gallery ?? []) as string[], row?.image_url ?? null);
        const gallery = dedupeGallery(audit.kept);
        await client
          .from("products")
          .update({ gallery: gallery as never, image_url: gallery[0] ?? null })
          .eq("id", item.product_id);
        details.push(`${item.product_label} : diaporama nettoyé (${gallery.length} photos).`);
        repaired += 1;
      } else if (code === "duplicate_canonical_url" && item.product_id) {
        const { deleteProduct } = await import("./admin.server");
        await deleteProduct(item.product_id as string);
        details.push(`${item.product_label} : doublon supprimé.`);
        repaired += 1;
      } else if (REIMPORT_CODES.has(code)) {
        const url = usableOfficialUrl(item.source_url as string | null);
        const ref = item.reference_id
          ? (await listReferences({ activeOnly: false })).find((r) => r.id === item.reference_id)
          : undefined;
        const target = url ?? usableOfficialUrl(ref?.official_url ?? null);
        if (!target) {
          skipped += 1;
          continue;
        }
        const { rebuildDeps } = await import("./catalog-rebuild.server");
        const { rebuildReference } = await import("./catalog-rebuild");
        const reference: CatalogReference =
          ref ??
          ({
            id: "",
            manufacturer: item.product_label as string,
            brand: (item.product_label as string).split(" ")[0] ?? "",
            model: (item.model as string) ?? "",
            reference: (item.model as string) ?? "",
            official_url: target,
            canonical_url: target,
            region: "ma",
            product_type: "",
            node_path: "",
            node_id: null,
            product_id: (item.product_id as string | null) ?? null,
            name: item.product_label as string,
            requires_discovery: false,
            active: true,
            source: "audit_repair",
            last_status: "pending",
            last_error: "",
            last_verified_at: null,
          } satisfies CatalogReference);
        if (!reference.node_id && item.product_id) {
          const { data: row } = await client
            .from("products")
            .select("node_id")
            .eq("id", item.product_id)
            .maybeSingle();
          if (row?.node_id) reference.node_id = row.node_id;
        }
        const outcome = await rebuildReference(reference, await rebuildDeps(options.signal));
        if (outcome.status === "verified" || outcome.status === "needs_review") {
          details.push(`${outcome.label} : réimporté depuis la page officielle (${outcome.status}).`);
          repaired += 1;
        } else {
          details.push(`${outcome.label} : non réparé (${outcome.error}).`);
          skipped += 1;
          continue;
        }
      } else {
        skipped += 1;
        continue;
      }
      await client
        .from("catalog_audit_findings")
        .update({ repaired_at: new Date().toISOString() })
        .eq("id", item.id);
    } catch (error) {
      skipped += 1;
      details.push(
        `${item.product_label} : réparation impossible (${error instanceof Error ? error.message : "ERREUR"}).`,
      );
    }
  }

  return { repaired, skipped, details };
}

export { referenceKey };
