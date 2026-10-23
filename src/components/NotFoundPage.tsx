import { Link, useLoaderData } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { HeaderSearch, splatOf } from "@/components/HeaderSearch";
import { CatalogTile } from "@/components/CatalogTile";
import { visibleChildren, type SiteData } from "@/lib/catalog-types";

export function FrenchNotFound() {
  const data = useLoaderData({ from: "__root__" }) as SiteData | undefined;
  const tops = data ? visibleChildren(data.nodes, data.products, null) : [];
  return (
    <SiteLayout>
      <section className="shell max-w-4xl py-10">
        <div className="panel px-5 py-12 text-center">
          <p className="text-5xl font-bold text-brand">404</p>
          <h1 className="mt-3 text-2xl font-bold">Oups, cette page n'existe pas.</h1>
          <div className="mx-auto mt-6 max-w-xl text-start"><HeaderSearch className="relative" /></div>
          <Link to="/" className="mt-6 inline-block rounded-md bg-brand px-6 py-2.5 text-sm font-bold text-brand-foreground">Retour à l'accueil</Link>
        </div>
        {tops.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {tops.map((n) => <CatalogTile key={n.id} node={n} splat={splatOf(data!.nodes, n.id)} />)}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
