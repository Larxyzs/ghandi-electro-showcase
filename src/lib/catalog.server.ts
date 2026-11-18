import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_SETTINGS, type SiteData } from "./catalog-types";
import { buildSiteData } from "./catalog-data";

export { DEFAULT_SETTINGS };
export type {
  CatalogNode,
  Product,
  SiteSettings,
  SiteData,
  SiteMode,
  PopularSearch,
  ProductSpec,
  MarketingSection,
} from "./catalog-types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export async function signImagePaths(paths: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (paths.length === 0) return map;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from("product-images")
    .createSignedUrls(paths, 60 * 60 * 24 * 7);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  }
  return map;
}

export async function fetchSiteData(): Promise<SiteData> {
  return buildSiteData(publicClient(), signImagePaths);
}
