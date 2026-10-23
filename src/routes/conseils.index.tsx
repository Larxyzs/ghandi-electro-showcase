import { useState } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ContentPage, pageMeta } from "@/components/ContentPage";
import { getGuides } from "@/lib/content.functions";
import type { SiteData } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/conseils/")({
  loader: () => getGuides(),
  head: () => pageMeta("Conseils et guides d'achat | Ghandi Home Electro", "Nos guides pour bien choisir votre électroménager et votre TV."),
  component: GuidesPage,
});

function GuidesPage() {
  const guides = Route.useLoaderData();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const [cat, setCat] = useState<string | null>(null);
  const cats = [...new Set(guides.map((g) => g.node_id).filter(Boolean))] as string[];
  const list = guides.filter((g) => !cat || g.node_id === cat);
  return (
    <ContentPage title="Conseils" wide>
      <div className="panel mt-3 px-5 py-4"><h1 className="text-2xl font-bold">Conseils et guides d'achat</h1></div>
      {cats.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[null, ...cats].map((c) => (
            <button key={c ?? "all"} type="button" onClick={() => setCat(c)} className={cn("rounded-full border px-4 py-1.5 text-sm", cat === c ? "border-brand bg-brand font-bold text-brand-foreground" : "border-border bg-card")}>
              {c ? (data.nodes.find((n) => n.id === c)?.name ?? "Autre") : "Tous"}
            </button>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <p className="panel mt-3 p-8 text-center text-sm text-text-2">Nos guides arrivent bientôt.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => <GuideCard key={g.id} guide={g} />)}
        </div>
      )}
    </ContentPage>
  );
}

export function GuideCard({ guide }: { guide: { slug: string; title: string; summary: string; cover_url: string; published_at: string } }) {
  return (
    <Link to="/conseils/$slug" params={{ slug: guide.slug }} className="panel overflow-hidden hover:border-input hover:shadow-[var(--shadow-hover)]">
      {guide.cover_url && <img src={guide.cover_url} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />}
      <div className="p-4">
        <p className="text-xs text-text-3">{new Date(guide.published_at).toLocaleDateString("fr-MA")}</p>
        <h2 className="mt-1 font-bold">{guide.title}</h2>
        {guide.summary && <p className="mt-1 line-clamp-3 text-sm text-text-2">{guide.summary}</p>}
      </div>
    </Link>
  );
}
