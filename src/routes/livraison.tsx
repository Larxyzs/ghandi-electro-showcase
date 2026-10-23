import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ContentPage, RichText, pageMeta } from "@/components/ContentPage";
import { useCompany } from "@/lib/company";
import type { SiteData } from "@/lib/catalog-types";

export const Route = createFileRoute("/livraison")({
  head: () => pageMeta("Livraison et retrait | Ghandi Home Electro", "Livraison gratuite à Casablanca, Mohammedia et Dar Bouazza, retrait au magasin et paiement à la livraison."),
  component: DeliveryPage,
});

function DeliveryPage() {
  const c = useCompany();
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const custom = data.settings.content?.pages?.["livraison"]?.body?.trim();
  return (
    <ContentPage title="Livraison et retrait" crumbs={[{ label: "Besoin d'aide ?", to: "/besoin-aide" }]}>
      <div className="panel mt-3 space-y-4 p-5 text-sm sm:p-7">
        <h1 className="text-2xl font-bold">Livraison et retrait</h1>
        {custom ? <RichText text={custom} /> : (
          <>
            <p>Nous livrons gratuitement à Casablanca, Mohammedia et Dar Bouazza. Pour les autres villes, le délai et les frais sont confirmés par téléphone au moment de la commande.</p>
            <p>Paiement à la livraison : vous payez à la réception de votre appareil.</p>
            <p>Vous pouvez aussi retirer votre commande au magasin : {c.address}. <Link to="/magasin" className="font-bold underline">Voir le magasin</Link></p>
          </>
        )}
        <p>Une question ? Appelez-nous au <a className="font-bold underline" href={c.phoneHref}>{c.phone}</a>.</p>
      </div>
    </ContentPage>
  );
}
