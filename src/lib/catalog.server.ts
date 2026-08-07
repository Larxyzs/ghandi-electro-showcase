import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_SETTINGS, type SiteData } from "./catalog-types";

export { DEFAULT_SETTINGS };
export type { Category, Product, SiteSettings, SiteData } from "./catalog-types";

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
  const supabase = publicClient();

  const [settingsRes, categoriesRes, productsRes] = await Promise.all([
    supabase
      .from("site_settings")
      .select("primary_color, secondary_color, text_color")
      .eq("id", "default")
      .maybeSingle(),
    supabase.from("categories").select("id, name, slug, sort_order").order("sort_order").order("name"),
    supabase
      .from("products")
      .select("id, category_id, name, serial_number, stock, price, image_url, description, sort_order")
      .order("sort_order")
      .order("created_at"),
  ]);

  const rawProducts = productsRes.data ?? [];
  const paths = rawProducts.map((p) => p.image_url).filter((p): p is string => Boolean(p));
  const signed = await signImagePaths(paths);

  return {
    settings: settingsRes.data ?? DEFAULT_SETTINGS,
    categories: categoriesRes.data ?? [],
    products: rawProducts.map((p) => ({
      ...p,
      price: p.price === null ? null : Number(p.price),
      image_path: p.image_url ?? null,
      image_url: p.image_url ? (signed[p.image_url] ?? null) : null,
    })),
  };
}