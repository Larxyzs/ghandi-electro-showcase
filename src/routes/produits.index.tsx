import { createFileRoute, redirect, useLoaderData } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { CatalogTile } from "@/components/CatalogTile";
import { splatOf } from "@/components/HeaderSearch";
import { useLiveEdit } from "@/lib/live-edit";
import { productsIn, visibleChildren, type SiteData } from "@/lib/catalog-types";

export const Route = createFileRoute("/produits/")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s["q"] === "string" && s["q"] ? { q: s["q"] } : {}),
  beforeLoad: ({ search }) => {
    if (search.q) throw redirect({ to: "/recherche", search: { q: search.q }, statusCode: 301 });
  },
  head: () => ({
    meta: [
      { title: "Tous nos rayons | Ghandi Home Electro" },
      { name: "description", content: "Tous les rayons de Ghandi Home Electro : gros électroménager, TV - Son, confort de la maison et plus, à Casablanca." },
      { property: "og:title", content: "Tous nos rayons | Ghandi Home Electro" },
      { property: "og:description", content: "Tous les rayons de Ghandi Home Electro à Casablanca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AllPage,
});

function AllPage() {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const admin = Boolean(useLiveEdit().admin);
  const tops = visibleChildren(data.nodes, data.products, null, admin);
  return (
    <SiteLayout>
      <section className="shell py-6">
        <div className="panel px-5 py-4"><h1 className="text-2xl font-bold">Tous nos rayons</h1></div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tops.map((n) => <CatalogTile key={n.id} node={n} splat={splatOf(data.nodes, n.id)} count={productsIn(data.nodes, data.products, n.id).length} />)}
        </div>
      </section>
    </SiteLayout>
  );
}
