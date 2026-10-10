import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/livraison")({
  head: () => ({
    meta: [
      { title: "Livraison et paiement | Ghandi Home Electro" },
      { name: "description", content: "Livraison à Casablanca et partout au Maroc, paiement à la livraison chez Ghandi Home Electro." },
      { property: "og:title", content: "Livraison et paiement | Ghandi Home Electro" },
      { property: "og:description", content: "Livraison partout au Maroc et paiement à la livraison." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeliveryPage,
});

function DeliveryPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl space-y-5 px-5 py-12">
        <h1 className="text-2xl font-bold">Livraison et paiement</h1>
        <p>Nous livrons à Casablanca et partout au Maroc. Les délais et frais sont confirmés par téléphone au moment de la commande.</p>
        <p>Paiement à la livraison : vous payez à la réception de votre appareil.</p>
        <p>Vous pouvez aussi retirer votre commande au magasin : {COMPANY.address}.</p>
        <p>Une question ? Appelez-nous au <a className="font-semibold text-brand" href={COMPANY.phoneHref}>{COMPANY.phone}</a>.</p>
      </section>
    </SiteLayout>
  );
}
