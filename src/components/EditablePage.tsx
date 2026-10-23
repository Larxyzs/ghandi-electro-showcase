import { useLoaderData } from "@tanstack/react-router";
import { ContentPage, RichText } from "@/components/ContentPage";
import { useLiveEdit } from "@/lib/live-edit";
import type { SiteData } from "@/lib/catalog-types";

/** Page whose text is written only by the owner in the admin (never invented). */
export function EditablePage({ pageKey, title }: { pageKey: string; title: string }) {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const { admin } = useLiveEdit();
  const page = data.settings.content?.pages?.[pageKey];
  const body = page?.body?.trim();
  return (
    <ContentPage title={page?.title?.trim() || title}>
      <div className="panel mt-3 p-5 sm:p-8">
        <h1 className="text-2xl font-bold">{page?.title?.trim() || title}</h1>
        <div className="mt-4">
          {body ? <RichText text={body} /> : <p className="text-sm text-text-2">{admin ? "Texte à compléter (Administration › Contenu du site › Pages)." : "Contenu bientôt disponible."}</p>}
        </div>
      </div>
    </ContentPage>
  );
}
