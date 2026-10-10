import type { Json } from "@/integrations/supabase/types";
import { adminDb, uploadImageFromDataUrl } from "./admin.server";
import type { HomeBanner } from "./catalog-types";

export type BannerInput = HomeBanner & { imageData?: string | null; imageName?: string | null };

export async function saveBanners(banners: BannerInput[]) {
  const db = await adminDb();
  const out: HomeBanner[] = [];
  for (const b of banners.slice(0, 6)) {
    let image = (b.image ?? "").trim();
    if (b.imageData && b.imageName) image = await uploadImageFromDataUrl(db, b.imageData, b.imageName);
    if (!image && !b.title) continue;
    out.push({
      image,
      title: (b.title ?? "").trim().slice(0, 120),
      button: (b.button ?? "").trim().slice(0, 40),
      link: (b.link ?? "").trim().slice(0, 300),
    });
  }
  const { error } = await db
    .from("site_settings")
    .update({ home_banners: out as unknown as Json })
    .eq("id", "default");
  if (error) throw new Error(error.message);
  return out;
}

export async function savePrices(rows: { id: string; price: number | null }[]) {
  const db = await adminDb();
  let saved = 0;
  for (const r of rows) {
    const price = r.price === null || !Number.isFinite(r.price) ? null : Math.max(0, Math.round(r.price * 100) / 100);
    const { error } = await db.from("products").update({ price }).eq("id", r.id);
    if (!error) saved++;
  }
  return { saved };
}
