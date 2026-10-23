import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { createClient } = await import("@supabase/supabase-js");
        const { pathOf } = await import("@/lib/catalog-types");
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const origin = process.env["SUPABASE_URL"];
        if (!key || !origin) throw new Error("Sitemap configuration unavailable");
        const db = createClient(origin, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });
        type T = "catalog_nodes" | "products" | "product_nodes" | "brands" | "guides";
        const readAll = async (table: T) => {
          const rows: Record<string, unknown>[] = [];
          for (let offset = 0; ; offset += 500) {
            const query = table === "products"
              ? db.from("products").select("id,node_id")
              : table === "product_nodes"
                ? db.from("product_nodes").select("product_id,node_id")
                : table === "brands"
                  ? db.from("brands").select("id,slug")
                  : table === "guides"
                    ? db.from("guides").select("id,slug")
                    : db.from("catalog_nodes").select("id,parent_id,name,slug,level,sort_order,image_url");
            const { data, error } = await query.order("id").range(offset, offset + 499);
            if (error) throw new Error(`Sitemap query failed: ${table}`);
            if (!data) throw new Error(`Sitemap data unavailable: ${table}`);
            rows.push(...data);
            if (data.length < 500) return rows;
          }
        };
        const [nodeRows, products, links, brands, guides] = await Promise.all([
          readAll("catalog_nodes"), readAll("products"), readAll("product_nodes"), readAll("brands"), readAll("guides"),
        ]);
        const nodes = nodeRows as unknown as import("@/lib/catalog-types").CatalogNode[];
        // only categories that contain at least one product (directly or below)
        const filled = new Set<string>();
        for (const id of [...products.map((p) => String(p["node_id"])), ...links.map((l) => String(l["node_id"]))]) {
          for (const n of pathOf(nodes, id)) filled.add(n.id);
        }
        const base = "https://ghandihomeelectro.com";
        const urls = [
          "/",
          "/produits",
          "/livraison",
          "/mentions-legales",
          "/magasin",
          "/services",
          "/besoin-aide",
          "/besoin-aide/faq",
          "/besoin-aide/nous-contacter",
          "/comment-commander",
          "/qui-sommes-nous",
          "/suivi-commande",
          "/marques",
          ...brands.map((b) => `/marques/${encodeURIComponent(String(b["slug"]))}`),
          ...(guides.length ? ["/conseils", ...guides.map((g) => `/conseils/${encodeURIComponent(String(g["slug"]))}`)] : []),
          ...nodes.filter((n) => filled.has(n.id)).map((n) => `/produits/${pathOf(nodes, n.id).map((p) => encodeURIComponent(p.slug)).join("/")}`),
          ...products.map((p) => `/produits/article/${encodeURIComponent(String(p["id"]))}`),
        ];
        const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Array.from(new Set(urls))
          .map((u) => `  <url><loc>${escapeXml(`${base}${u}`)}</loc></url>`)
          .join("\n")}\n</urlset>`;
        return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
      },
    },
  },
});
