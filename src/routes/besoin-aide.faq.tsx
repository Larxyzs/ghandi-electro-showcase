import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Search } from "lucide-react";
import { ContentPage } from "@/components/ContentPage";
import { getFaq } from "@/lib/content.functions";
import { cn } from "@/lib/utils";

const CATS = ["Commander en ligne", "Livraison et retrait", "Paiement", "Au magasin"];

export const Route = createFileRoute("/besoin-aide/faq")({
  loader: () => getFaq(),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Questions fréquentes (FAQ) | Ghandi Home Electro" },
      { name: "description", content: "Commande, livraison, retrait au magasin et paiement : toutes les réponses à vos questions." },
      { property: "og:title", content: "FAQ | Ghandi Home Electro" },
      { property: "og:description", content: "Toutes les réponses à vos questions sur la commande, la livraison et le paiement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: (loaderData ?? []).map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
      }),
    }],
  }),
  component: FaqPage,
});

function FaqPage() {
  const items = Route.useLoaderData();
  const [tab, setTab] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const cats = useMemo(() => [...CATS, ...new Set(items.map((i) => i.category))].filter((c, i, a) => a.indexOf(c) === i && items.some((x) => x.category === c)), [items]);
  const fold = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const list = items.filter((i) => (!tab || i.category === tab) && (!q || fold(`${i.question} ${i.answer}`).includes(fold(q))));
  return (
    <ContentPage title="Questions fréquentes" crumbs={[{ label: "Besoin d'aide ?", to: "/besoin-aide" }]}>
      <div className="panel mt-3 p-5">
        <h1 className="text-2xl font-bold">Questions fréquentes</h1>
        <label className="mt-4 flex items-center gap-2 rounded-md border border-input px-3">
          <Search className="h-4 w-4 text-text-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une question" className="flex-1 bg-transparent py-2.5 text-sm outline-none" />
        </label>
        <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border">
          {[null, ...cats].map((c) => (
            <button key={c ?? "all"} type="button" onClick={() => setTab(c)} className={cn("-mb-px shrink-0 border-b-[3px] px-3 py-2 text-sm font-bold", tab === c ? "border-brand" : "border-transparent text-text-2")}>{c ?? "Toutes"}</button>
          ))}
        </div>
        <div className="mt-2 divide-y divide-border">
          {list.map((f) => (
            <details key={f.id} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">{f.question}<ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" /></summary>
              <p className="mt-2 text-sm whitespace-pre-line text-text-2">{f.answer}</p>
            </details>
          ))}
          {list.length === 0 && <p className="py-6 text-sm text-text-2">Aucune question trouvée.</p>}
        </div>
      </div>
    </ContentPage>
  );
}
