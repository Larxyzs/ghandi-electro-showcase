/**
 * Master references — persistence.
 *
 * The reference list is permanent: it is upserted from the catalogue, never
 * deleted when products are deleted, and is the queue used by rebuilds and the
 * baseline used by the checkup.
 */
import {
  dedupeReferences,
  referenceFromProduct,
  referenceKey,
  type CatalogReference,
  type CatalogReferenceDraft,
  type ReferenceStatus,
} from "./catalog-references";
import { pathOf } from "./catalog-types";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const REF_COLUMNS =
  "id, manufacturer, brand, model, reference, official_url, canonical_url, region, product_type, node_path, node_id, product_id, name, requires_discovery, active, source, last_status, last_error, last_verified_at";

function rowToReference(row: Record<string, unknown>): CatalogReference {
  return {
    id: String(row["id"]),
    manufacturer: String(row["manufacturer"] ?? ""),
    brand: String(row["brand"] ?? ""),
    model: String(row["model"] ?? ""),
    reference: String(row["reference"] ?? ""),
    official_url: (row["official_url"] as string | null) ?? null,
    canonical_url: (row["canonical_url"] as string | null) ?? null,
    region: String(row["region"] ?? ""),
    product_type: String(row["product_type"] ?? ""),
    node_path: String(row["node_path"] ?? ""),
    node_id: (row["node_id"] as string | null) ?? null,
    product_id: (row["product_id"] as string | null) ?? null,
    name: String(row["name"] ?? ""),
    requires_discovery: Boolean(row["requires_discovery"]),
    active: row["active"] !== false,
    source: String(row["source"] ?? ""),
    last_status: (String(row["last_status"] ?? "pending") as ReferenceStatus) ?? "pending",
    last_error: String(row["last_error"] ?? ""),
    last_verified_at: (row["last_verified_at"] as string | null) ?? null,
  };
}

/**
 * Freezes the current catalogue into the master reference list. Existing
 * references are updated (never removed), new products are added.
 */
export async function freezeReferences(options: { source?: string } = {}): Promise<{
  products: number;
  created: number;
  updated: number;
  total: number;
  without_official_url: number;
}> {
  const client = await db();
  const [{ data: products }, { data: nodes }] = await Promise.all([
    client.from("products").select("id, name, brand, serial_number, node_id, source_url"),
    client.from("catalog_nodes").select("id, parent_id, name, slug, level, sort_order, image_url"),
  ]);

  const nodeList = (nodes ?? []) as never[];
  const drafts: CatalogReferenceDraft[] = (products ?? []).map((product) =>
    referenceFromProduct(
      {
        id: product.id,
        name: product.name ?? "",
        brand: product.brand ?? "",
        serial_number: product.serial_number ?? "",
        node_id: product.node_id ?? "",
        source_url: product.source_url ?? null,
        node_path: pathOf(nodeList as never, product.node_id ?? null)
          .map((node) => node.name)
          .join(" / "),
      },
      options.source ? { source: options.source } : {},
    ),
  );
  const unique = dedupeReferences(drafts);

  const { data: existingRows } = await client.from("catalog_references").select(REF_COLUMNS);
  const existing = (existingRows ?? []).map((row) => rowToReference(row as never));
  const byKey = new Map(existing.map((ref) => [referenceKey(ref), ref]));

  let created = 0;
  let updated = 0;
  for (const draft of unique) {
    const key = referenceKey(draft);
    const match = byKey.get(key);
    if (match) {
      await client
        .from("catalog_references")
        .update({
          // The reference definition is refreshed, never downgraded: an
          // official URL already stored is kept when the product has none.
          manufacturer: draft.manufacturer || match.manufacturer,
          brand: draft.brand || match.brand,
          model: draft.model || match.model,
          reference: draft.reference || match.reference,
          official_url: draft.official_url ?? match.official_url,
          canonical_url: draft.canonical_url ?? match.canonical_url,
          product_type: draft.product_type || match.product_type,
          node_path: draft.node_path || match.node_path,
          node_id: draft.node_id ?? match.node_id,
          product_id: draft.product_id ?? match.product_id,
          name: draft.name || match.name,
          requires_discovery: !(draft.official_url ?? match.official_url),
          active: true,
        })
        .eq("id", match.id);
      updated += 1;
      continue;
    }
    const { error } = await client.from("catalog_references").insert(draft as never);
    if (!error) created += 1;
  }

  const { count } = await client
    .from("catalog_references")
    .select("id", { count: "exact", head: true })
    .eq("active", true);

  return {
    products: (products ?? []).length,
    created,
    updated,
    total: count ?? existing.length + created,
    without_official_url: unique.filter((draft) => !draft.official_url).length,
  };
}

export async function listReferences(
  options: { activeOnly?: boolean; limit?: number; status?: ReferenceStatus } = {},
): Promise<CatalogReference[]> {
  const client = await db();
  let query = client.from("catalog_references").select(REF_COLUMNS).order("created_at");
  if (options.activeOnly !== false) query = query.eq("active", true);
  if (options.status) query = query.eq("last_status", options.status);
  const { data } = await query.limit(Math.min(options.limit ?? 5000, 5000));
  return (data ?? []).map((row) => rowToReference(row as never));
}

export async function upsertReference(draft: Partial<CatalogReferenceDraft>) {
  const client = await db();
  const key = referenceKey({
    official_url: draft.official_url ?? null,
    brand: draft.brand ?? "",
    model: draft.model ?? "",
  });
  const existing = (await listReferences({ activeOnly: false })).find((ref) => referenceKey(ref) === key);
  if (existing) {
    await client.from("catalog_references").update(draft as never).eq("id", existing.id);
    return { id: existing.id, created: false as const };
  }
  const { data, error } = await client
    .from("catalog_references")
    .insert({
      manufacturer: draft.brand ?? "",
      region: "ma",
      source: "manual",
      ...draft,
      requires_discovery: !draft.official_url,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, created: true as const };
}

/** References are only ever deactivated by an administrator, never cascade-deleted. */
export async function setReferenceActive(id: string, active: boolean) {
  const client = await db();
  const { error } = await client.from("catalog_references").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function markReferenceStatus(
  id: string,
  status: ReferenceStatus,
  extra: { error?: string; product_id?: string | null } = {},
) {
  const client = await db();
  await client
    .from("catalog_references")
    .update({
      last_status: status,
      last_error: extra.error ?? "",
      ...(extra.product_id !== undefined ? { product_id: extra.product_id } : {}),
      ...(status === "verified" ? { last_verified_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);
}
