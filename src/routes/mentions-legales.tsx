import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales | Ghandi Home Electro" },
      { name: "description", content: "Mentions légales du site Ghandi Home Electro, Casablanca." },
      { property: "og:title", content: "Mentions légales | Ghandi Home Electro" },
      { property: "og:description", content: "Informations légales sur Ghandi Home Electro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl space-y-4 px-5 py-12">
        <h1 className="text-2xl font-bold">Mentions légales</h1>
        <p><strong>{COMPANY.name}</strong> — {COMPANY.address}</p>
        <p>Responsable : {COMPANY.founder}</p>
        <p>Téléphone : {COMPANY.phone}</p>
        <p>Les photos et caractéristiques des produits proviennent des sites officiels des fabricants.</p>
      </section>
    </SiteLayout>
  );
}
