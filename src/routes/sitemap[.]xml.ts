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
        const readAll = async (table: "catalog_nodes" | "products") => {
          const rows: Record<string, unknown>[] = [];
          for (let offset = 0; ; offset += 500) {
            const { data, error } = await db.from(table).select(table === "products" ? "id" : "id,parent_id,name,slug,level,sort_order,image_url").order("id").range(offset, offset + 499);
            if (error) throw new Error(`Sitemap query failed: ${table}`);
            if (!data) throw new Error(`Sitemap data unavailable: ${table}`);
            rows.push(...data);
            if (data.length < 500) return rows;
          }
        };
        const [nodeRows, products] = await Promise.all([readAll("catalog_nodes"), readAll("products")]);
        const nodes = nodeRows as unknown as import("@/lib/catalog-types").CatalogNode[];
        const base = "https://ghandihomeelectro.com";
        const urls = [
          "/",
          "/produits",
          "/contact",
          "/a-propos",
          "/livraison",
          "/mentions-legales",
          ...nodes.map((n) => `/produits/${pathOf(nodes, n.id).map((p) => encodeURIComponent(p.slug)).join("/")}`),
          ...products.map((p) => `/produits/article/${encodeURIComponent(String(p.id))}`),
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
