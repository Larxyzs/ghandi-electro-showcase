import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/ContentPage";
import { useCompany } from "@/lib/company";

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
  const COMPANY = useCompany();
  return (
    <ContentPage title="Mentions légales">
      <section className="panel mt-3 space-y-3 p-5 text-sm sm:p-8">
        <h1 className="text-2xl font-bold">Mentions légales</h1>
        <p><strong>{COMPANY.name}</strong> — {COMPANY.address}</p>
        <p>Responsable : {COMPANY.founder}</p>
        <p>Téléphone : {COMPANY.phone}</p>
        <p>Les photos et caractéristiques des produits proviennent des sites officiels des fabricants.</p>
      </section>
    </ContentPage>
  );
}
