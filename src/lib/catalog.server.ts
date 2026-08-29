import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_SETTINGS,
  type MarketingSection,
  type ProductSpec,
  type SiteData,
  type SiteMode,
} from "./catalog-types";

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
  const supabase = publicClient();

  const [settingsRes, nodesRes, productsRes, searchesRes] = await Promise.all([
    supabase
      .from("site_settings")
      .select("primary_color, secondary_color, text_color, site_mode")
      .eq("id", "default")
      .maybeSingle(),
    supabase
      .from("catalog_nodes")
      .select("id, parent_id, name, slug, level, sort_order, image_url")
      .order("sort_order")
      .order("name"),
    supabase
      .from("products")
      .select(
        "id, node_id, name, brand, serial_number, stock, price, image_url, characteristics, specifications, gallery, marketing_sections, source_url, source_name, sort_order, featured",
      )
      .order("sort_order")
      .order("created_at"),
    supabase.from("popular_searches").select("id, term, sort_order").order("sort_order"),
  ]);

  const linksRes = await supabase.from("product_nodes").select("product_id, node_id");
  const linksByProduct = new Map<string, string[]>();
  for (const link of linksRes.data ?? []) {
    const list = linksByProduct.get(link.product_id) ?? [];
    list.push(link.node_id);
    linksByProduct.set(link.product_id, list);
  }

  const rawProducts = productsRes.data ?? [];
  const rawNodes = nodesRes.data ?? [];
  const isPath = (value: string | null): value is string =>
    Boolean(value) && !value!.startsWith("http");
  const galleryOf = (p: { gallery: unknown }) =>
    Array.isArray(p.gallery) ? (p.gallery as string[]) : [];
  const paths = Array.from(
    new Set([
      ...rawProducts.map((p) => p.image_url).filter(isPath),
      ...rawProducts.flatMap((p) => galleryOf(p)).filter(isPath),
      ...rawNodes.map((n) => n.image_url).filter(isPath),
    ]),
  );
  const signed = await signImagePaths(paths);
  const resolve = (value: string | null) =>
    value ? (value.startsWith("http") ? value : (signed[value] ?? null)) : null;

  return {
    settings: settingsRes.data
      ? { ...settingsRes.data, site_mode: (settingsRes.data.site_mode ?? "online") as SiteMode }
      : DEFAULT_SETTINGS,
    nodes: rawNodes.map((n) => ({
      ...n,
      level: n.level as 1 | 2 | 3 | 4,
      image_path: n.image_url ?? null,
      image_url: resolve(n.image_url),
    })),
    products: rawProducts.map((p) => ({
      ...p,
      node_ids: Array.from(new Set([p.node_id, ...(linksByProduct.get(p.id) ?? [])])),
      price: p.price === null ? null : Number(p.price),
      image_path: p.image_url ?? null,
      image_url: resolve(p.image_url),
      specifications: Array.isArray(p.specifications) ? (p.specifications as ProductSpec[]) : [],
      gallery_paths: galleryOf(p),
      gallery: galleryOf(p)
        .map((value) => resolve(value))
        .filter((value): value is string => Boolean(value)),
      marketing_sections: Array.isArray(p.marketing_sections)
        ? (p.marketing_sections as MarketingSection[])
        : [],
    })),
    popularSearches: searchesRes.data ?? [],
  };
}