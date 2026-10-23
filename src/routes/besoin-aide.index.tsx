import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, HelpCircle, ListChecks, Mail, PackageSearch, Truck } from "lucide-react";
import { ContentPage, pageMeta } from "@/components/ContentPage";

export const Route = createFileRoute("/besoin-aide/")({
  head: () => pageMeta("Besoin d'aide ? | Ghandi Home Electro", "Questions fréquentes, contact, suivi de commande, livraison et paiement chez Ghandi Home Electro."),
  component: HelpPage,
});

const CARDS = [
  { to: "/besoin-aide/faq", Icon: HelpCircle, t: "Questions fréquentes", s: "Les réponses aux questions les plus posées" },
  { to: "/besoin-aide/nous-contacter", Icon: Mail, t: "Nous contacter", s: "Écrivez-nous, nous vous répondons" },
  { to: "/suivi-commande", Icon: PackageSearch, t: "Suivre ma commande", s: "Avec votre numéro et votre téléphone" },
  { to: "/comment-commander", Icon: ListChecks, t: "Comment commander", s: "Les étapes d'une commande" },
  { to: "/livraison", Icon: Truck, t: "Livraison et retrait", s: "Gratuite à Casablanca, Mohammedia et Dar Bouazza" },
  { to: "/besoin-aide/faq", Icon: Banknote, t: "Paiement", s: "Paiement à la livraison" },
] as const;

function HelpPage() {
  return (
    <ContentPage title="Besoin d'aide ?" wide>
      <div className="panel mt-3 px-5 py-4"><h1 className="text-2xl font-bold">Besoin d'aide ?</h1></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(({ to, Icon, t, s }) => (
          <Link key={t} to={to} className="panel flex items-start gap-4 p-5 hover:border-input hover:shadow-[var(--shadow-hover)]">
            <Icon className="h-8 w-8 shrink-0 text-brand" strokeWidth={1.6} />
            <span><span className="block font-bold">{t}</span><span className="text-sm text-text-2">{s}</span></span>
          </Link>
        ))}
      </div>
    </ContentPage>
  );
}
