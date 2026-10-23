import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageMeta } from "@/components/ContentPage";
import { EditablePage } from "@/components/EditablePage";
import type { SiteData } from "@/lib/catalog-types";

export const Route = createFileRoute("/mre")({
  beforeLoad: ({ matches }) => {
    const root = matches[0]?.loaderData as SiteData | undefined;
    if (root && !root.settings.content?.pages?.["mre"]?.enabled) throw notFound();
  },
  head: () => pageMeta("Marocains résidant à l'étranger | Ghandi Home Electro", "Vous êtes un Marocain résidant à l'étranger ? Commandez chez Ghandi Home Electro."),
  component: () => <EditablePage pageKey="mre" title="Vous êtes un Marocain résidant à l'étranger ?" />,
});
