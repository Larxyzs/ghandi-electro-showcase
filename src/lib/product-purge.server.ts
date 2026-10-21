/**
 * Removes products FOR GOOD: the product rows, their section links, the photos uploaded for them
 * (main photo and gallery) and the extension inbox rows that point to them.
 * Every deletion of products (one product, a whole folder, a replaced duplicate) goes through here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

const storedPath = (v: unknown): v is string => typeof v === "string" && v.length > 0 && !/^https?:\/\//i.test(v);

export async function purgeProducts(db: AnyDb, ids: string[]): Promise<number> {
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (!list.length) return 0;
  const { data: rows } = await db.from("products").select("id, image_url, gallery").in("id", list);
  const paths = new Set<string>();
  for (const r of (rows ?? []) as { image_url: unknown; gallery: unknown }[]) {
    if (storedPath(r.image_url)) paths.add(r.image_url);
    if (Array.isArray(r.gallery)) r.gallery.forEach((g) => storedPath(g) && paths.add(g));
  }
  await db.from("extension_inbox_items").delete().in("product_id", list);
  await db.from("product_nodes").delete().in("product_id", list);
  const { error } = await db.from("products").delete().in("id", list);
  if (error) throw new Error(error.message);
  // a photo still used by another product stays
  if (paths.size) {
    const { data: others } = await db.from("products").select("image_url, gallery");
    const used = new Set<string>();
    for (const o of (others ?? []) as { image_url: unknown; gallery: unknown }[]) {
      if (storedPath(o.image_url)) used.add(o.image_url);
      if (Array.isArray(o.gallery)) o.gallery.forEach((g) => storedPath(g) && used.add(g));
    }
    const gone = [...paths].filter((p) => !used.has(p));
    if (gone.length) await db.storage.from("product-images").remove(gone);
  }
  return (rows ?? []).length;
}
