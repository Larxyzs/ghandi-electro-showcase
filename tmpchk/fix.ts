import { fetchOfficialPage } from "../src/lib/page-fetch.server";
import { resolveProductGallery } from "../src/lib/product-gallery.server";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
const { data } = await supabaseAdmin.from("products").select("id,name,brand,source_url,gallery");
for (const p of data ?? []) {
  if (!p.source_url) continue;
  try {
    const page = await fetchOfficialPage(p.source_url);
    const g = await resolveProductGallery(page.html, page.finalUrl || p.source_url, { brand: p.brand });
    if (g.images.length > (Array.isArray(p.gallery) ? p.gallery.length : 0)) {
      await supabaseAdmin.from("products").update({ gallery: g.images, image_url: g.images[0] }).eq("id", p.id);
      console.log("fixed", p.name, g.images.length);
    } else console.log("kept", p.name, g.images.length);
  } catch (e) { console.log("err", p.name, String(e).slice(0,80)); }
}
