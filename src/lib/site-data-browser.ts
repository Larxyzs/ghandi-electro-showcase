import { supabase } from "@/integrations/supabase/client";
import type { SiteData } from "./catalog-types";
import { buildSiteData } from "./catalog-data";

/** The catalog, read straight from Supabase by the visitor's browser (the photo bucket is public). */
export function fetchSiteDataInBrowser(): Promise<SiteData> {
  return buildSiteData(supabase, async (paths) => {
    const map: Record<string, string> = {};
    for (const p of paths) map[p] = supabase.storage.from("product-images").getPublicUrl(p).data.publicUrl;
    return map;
  });
}
