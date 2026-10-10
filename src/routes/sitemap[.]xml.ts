import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { fetchSiteData } = await import("@/lib/catalog.server");
        const { pathOf } = await import("@/lib/catalog-types");
        const base = "https://ghandihomeelectro.com";
        const data = await fetchSiteData();
        const urls = [
          "/",
          "/produits",
          "/contact",
          "/a-propos",
          "/livraison",
          ...data.nodes.map((n) => `/produits/${pathOf(data.nodes, n.id).map((p) => p.slug).join("/")}`),
          ...data.products.map((p) => `/produits/article/${p.id}`),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((u) => `  <url><loc>${base}${encodeURI(u)}</loc></url>`)
          .join("\n")}\n</urlset>`;
        return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
      },
    },
  },
});
