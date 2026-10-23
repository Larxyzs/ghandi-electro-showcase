import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ShoppingCart, Truck } from "lucide-react";
import { ContentPage, pageMeta } from "@/components/ContentPage";
import { WaIcon } from "@/components/SiteLayout";
import { useCompany, whatsappLinkTo } from "@/lib/company";

export const Route = createFileRoute("/comment-commander")({
  head: () => pageMeta("Comment commander | Ghandi Home Electro", "Commander en 3 étapes : panier, livraison ou retrait au magasin, confirmation. Paiement à la livraison."),
  component: HowPage,
});

const STEPS = [
  { Icon: ShoppingCart, t: "1. Panier", s: "Ajoutez vos produits au panier puis cliquez sur « Passer la commande »." },
  { Icon: Truck, t: "2. Livraison", s: "Choisissez la livraison à domicile ou le retrait au magasin, puis indiquez vos coordonnées." },
  { Icon: CheckCircle2, t: "3. Confirmation", s: "Vérifiez et validez. Nous vous appelons pour confirmer la commande. Paiement à la livraison." },
];

function HowPage() {
  const c = useCompany();
  return (
    <ContentPage title="Comment commander" crumbs={[{ label: "Besoin d'aide ?", to: "/besoin-aide" }]}>
      <div className="panel mt-3 p-5 sm:p-7">
        <h1 className="text-2xl font-bold">Comment commander</h1>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ Icon, t, s }) => (
            <div key={t} className="rounded-lg bg-page p-4"><Icon className="h-8 w-8 text-brand" strokeWidth={1.6} /><p className="mt-2 font-bold">{t}</p><p className="mt-1 text-sm text-text-2">{s}</p></div>
          ))}
        </div>
        <p className="mt-6 text-sm">Vous préférez WhatsApp ? Envoyez-nous le nom du produit.</p>
        <a href={whatsappLinkTo(c.whatsappNumber, "Bonjour, je voudrais commander : ")} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-md bg-whatsapp px-5 py-2.5 text-sm font-bold text-background"><WaIcon className="h-4 w-4" /> WhatsApp</a>
      </div>
    </ContentPage>
  );
}
