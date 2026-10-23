import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Clock, Headphones, MapPin, Navigation, Package, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { ContentPage } from "@/components/ContentPage";
import { OpenBadge, WaIcon } from "@/components/SiteLayout";
import { DAY_NAMES, WHATSAPP_GENERAL_MESSAGE, formatDay, resolveCompany, todayIndex, useCompany, whatsappLinkTo } from "@/lib/company";
import type { SiteData } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/magasin")({
  head: ({ matches }) => {
    const c = resolveCompany((matches[0]?.loaderData as SiteData | undefined)?.settings?.content);
    const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    const ld = {
      "@context": "https://schema.org",
      "@type": "ElectronicsStore",
      name: c.name,
      url: "https://ghandihomeelectro.com/magasin",
      telephone: c.phone,
      address: { "@type": "PostalAddress", streetAddress: "41 Boulevard Ghandi", addressLocality: "Casablanca", addressRegion: "Casablanca-Settat", addressCountry: "MA" },
      openingHours: c.week.flatMap((d, i) => (d.closed ? [] : d.ranges.map(([a, b]) => `${days[i]} ${a}-${b}`))),
    };
    const t = "Magasin Ghandi Home Electro – Casablanca | Adresse et horaires";
    const d = `Notre magasin d'électroménager au ${c.shortAddress} : horaires, itinéraire, téléphone et WhatsApp.`;
    return {
      meta: [
        { title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      ],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
    };
  },
  component: StorePage,
});

function StorePage() {
  const c = useCompany();
  const [today, setToday] = useState(-1);
  useEffect(() => setToday(todayIndex()), []);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(c.address)}`;
  return (
    <ContentPage title="Notre magasin" wide>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="panel p-5 sm:p-7">
          <h1 className="text-2xl font-bold">Magasin Ghandi Home Electro – Casablanca</h1>
          <div className="mt-2"><OpenBadge /></div>
          <p className="mt-4 flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 text-brand" /> {c.address}</p>
          <p className="mt-2 flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-brand" /> <a href={c.phoneHref}>{c.phone}</a></p>
          <h2 className="mt-6 flex items-center gap-2 font-bold"><Clock className="h-4 w-4 text-brand" /> Horaires</h2>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {c.week.map((d, i) => (
                <tr key={i} className={cn("border-b border-border last:border-0", i === today && "font-bold")}>
                  <td className="py-2">{DAY_NAMES[i]}</td><td className="py-2 text-end">{formatDay(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={directions} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-brand-foreground"><Navigation className="h-4 w-4" /> Itinéraire</a>
            <a href={c.phoneHref} className="inline-flex items-center gap-2 rounded-md border border-dark px-4 py-2.5 text-sm font-bold"><Phone className="h-4 w-4" /> Appeler</a>
            <a href={whatsappLinkTo(c.whatsappNumber, WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-whatsapp px-4 py-2.5 text-sm font-bold text-background"><WaIcon className="h-4 w-4" /> WhatsApp</a>
          </div>
        </div>
        <iframe title="Plan d'accès" src={c.mapsEmbed} loading="lazy" className="h-80 w-full rounded-lg border border-border lg:h-full" />
      </div>
      {c.photos.length > 0 && (
        <div className="panel mt-4 p-5">
          <h2 className="font-bold">Le magasin en photos</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">{c.photos.map((p) => <img key={p} src={p} alt="Magasin Ghandi Home Electro" loading="lazy" className="aspect-[4/3] w-full rounded-md object-cover" />)}</div>
        </div>
      )}
      <div className="panel mt-4 p-5">
        <h2 className="font-bold">Services au magasin</h2>
        <ul className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <li className="flex items-center gap-2"><Package className="h-5 w-5 text-brand" /> Retrait des commandes</li>
          <li className="flex items-center gap-2"><Headphones className="h-5 w-5 text-brand" /> Conseil</li>
          <li className="flex items-center gap-2"><Banknote className="h-5 w-5 text-brand" /> Paiement à la livraison</li>
        </ul>
      </div>
    </ContentPage>
  );
}
