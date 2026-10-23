import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Banknote, Headphones, Store, Truck, Wrench } from "lucide-react";
import { ContentPage, pageMeta } from "@/components/ContentPage";
import { servicesOf } from "@/lib/services";
import type { SiteData } from "@/lib/catalog-types";

const ICONS = { livraison: Truck, paiement: Banknote, retrait: Store, conseil: Headphones, installation: Wrench } as Record<string, typeof Truck>;

export const Route = createFileRoute("/services")({
  head: () => pageMeta("Nos services | Ghandi Home Electro", "Livraison partout au Maroc, paiement à la livraison, retrait au magasin et conseil par téléphone et WhatsApp."),
  component: ServicesPage,
});

function ServicesPage() {
  const data = useLoaderData({ from: "__root__" }) as SiteData;
  const list = servicesOf(data.settings.content).filter((s) => s.enabled && s.title.trim());
  return (
    <ContentPage title="Nos services" wide>
      <div className="panel mt-3 px-5 py-4"><h1 className="text-2xl font-bold">Nos services</h1></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((s) => {
          const Icon = ICONS[s.key] ?? Store;
          return (
            <div key={s.key} className="panel p-5">
              <Icon className="h-8 w-8 text-brand" strokeWidth={1.6} />
              <h2 className="mt-3 font-bold">{s.title}</h2>
              {s.text && <p className="mt-1 text-sm text-text-2">{s.text}</p>}
            </div>
          );
        })}
      </div>
    </ContentPage>
  );
}
