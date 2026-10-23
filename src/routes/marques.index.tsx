import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import type { SiteData } from "@/lib/catalog-types";

export const Route = createFileRoute("/marques/")({
  head: () => ({
    meta: [
      { title: "Nos marques – Électroménager et TV | Ghandi Home Electro" },
      { name: "description", content: "Toutes les marques d'électroménager et de TV disponibles chez Ghandi Home Electro à Casablanca." },
      { property: "og:title", content: "Nos marques | Ghandi Home Electro" },
      { property: "og:description", content: "Toutes les marques disponibles chez Ghandi Home Electro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrandsPage,
});

function BrandsPage() {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const count = (name: string) => data.products.filter((p) => p.brand.toLowerCase() === name.toLowerCase()).length;
  return (
    <SiteLayout>
      <section className="shell py-4">
        <div className="panel px-5 py-4"><h1 className="text-2xl font-bold">Nos marques</h1></div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {(data.brands ?? []).map((b) => (
            <Link key={b.id} to="/marques/$slug" params={{ slug: b.slug }} className="panel flex flex-col items-center gap-2 p-4 hover:border-input hover:shadow-[var(--shadow-hover)]">
              <div className="grid h-16 w-full place-items-center">
                {b.logo ? <img src={b.logo} alt={b.name} loading="lazy" className="max-h-12 w-auto object-contain" /> : <span className="text-lg font-bold">{b.name}</span>}
              </div>
              <p className="text-sm font-medium">{b.name}</p>
              <p className="text-xs text-text-3">{count(b.name)} produit{count(b.name) === 1 ? "" : "s"}</p>
            </Link>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
