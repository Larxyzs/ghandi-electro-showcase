import { createFileRoute, Link, notFound, useLoaderData } from "@tanstack/react-router";
import { ContentPage, RichText } from "@/components/ContentPage";
import { splatOf } from "@/components/HeaderSearch";
import { getGuide } from "@/lib/content.functions";
import type { SiteData } from "@/lib/catalog-types";

export const Route = createFileRoute("/conseils/$slug")({
  loader: async ({ params }) => {
    const g = await getGuide({ data: { slug: params.slug } });
    if (!g) throw notFound();
    return g;
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.title} | Conseils Ghandi Home Electro` : "Conseil introuvable | Ghandi Home Electro";
    const d = loaderData?.summary || "Guide d'achat Ghandi Home Electro.";
    const img = loaderData?.cover_url?.startsWith("https://") ? loaderData.cover_url : null;
    return {
      meta: [
        { title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d },
        { property: "og:type", content: "article" }, { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  component: GuidePage,
});

function GuidePage() {
  const g = Route.useLoaderData();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const node = g.node_id ? data.nodes.find((n) => n.id === g.node_id) : undefined;
  return (
    <ContentPage title={g.title} crumbs={[{ label: "Conseils", to: "/conseils" }]}>
      <article className="panel mt-3 overflow-hidden">
        {g.cover_url && <img src={g.cover_url} alt="" className="aspect-[16/7] w-full object-cover" />}
        <div className="p-5 sm:p-8">
          <p className="text-xs text-text-3">{new Date(g.published_at).toLocaleDateString("fr-MA")}</p>
          <h1 className="mt-1 text-2xl font-bold">{g.title}</h1>
          {g.summary && <p className="mt-2 font-medium text-text-2">{g.summary}</p>}
          <div className="mt-5"><RichText text={g.body} /></div>
          {node && (
            <Link to="/produits/$" params={{ _splat: splatOf(data.nodes, node.id) }} className="mt-6 inline-block rounded-md bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground">Voir les produits</Link>
          )}
        </div>
      </article>
    </ContentPage>
  );
}
