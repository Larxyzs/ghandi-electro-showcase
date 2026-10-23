import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, PackageSearch, X } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { trackOrderFn } from "@/lib/orders.functions";
import type { TrackedOrder } from "@/lib/orders.server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/suivi-commande")({
  validateSearch: (s: Record<string, unknown>): { n?: string; t?: string } => ({
    ...(typeof s["n"] === "string" && s["n"] ? { n: s["n"] } : {}),
    ...(typeof s["t"] === "string" && s["t"] ? { t: s["t"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Suivre ma commande | Ghandi Home Electro" },
      { name: "description", content: "Suivez votre commande Ghandi Home Electro avec votre numéro de commande et votre téléphone." },
      { property: "og:title", content: "Suivre ma commande | Ghandi Home Electro" },
      { property: "og:description", content: "Suivez l'avancement de votre commande." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

const STEPS = [
  ["nouveau", "Nouvelle"],
  ["en_cours", "Confirmée"],
  ["termine", "Livrée"],
] as const;

function TrackPage() {
  const search = Route.useSearch();
  const [n, setN] = useState(search.n ?? "");
  const [t, setT] = useState(search.t ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const auto = useRef(false);

  const run = async (ref: string, phone: string) => {
    setBusy(true);
    setError(null);
    setOrder(null);
    try {
      const r = await trackOrderFn({ data: { reference: ref, phone } });
      if (r.ok) setOrder(r.order);
      else setError(r.error);
    } catch {
      setError("Nous ne trouvons pas cette commande. Vérifiez le numéro et le téléphone.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!auto.current && search.n && search.t) {
      auto.current = true;
      void run(search.n, search.t);
    }
  }, [search.n, search.t]);

  const idx = order ? STEPS.findIndex(([k]) => k === order.status) : -1;
  const input = "w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm";

  return (
    <SiteLayout>
      <section className="shell max-w-2xl py-6">
        <form className="panel p-5 sm:p-8" onSubmit={(e) => { e.preventDefault(); void run(n, t); }}>
          <h1 className="text-2xl font-bold">Suivre ma commande</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label className="text-sm font-medium">Numéro de commande</label><input className={input} value={n} onChange={(e) => setN(e.target.value)} placeholder="GHE-…" required /></div>
            <div><label className="text-sm font-medium">Téléphone utilisé pour la commande</label><input className={input} value={t} onChange={(e) => setT(e.target.value)} inputMode="tel" required /></div>
          </div>
          <button type="submit" disabled={busy} className="mt-4 rounded-md bg-brand px-6 py-2.5 text-sm font-bold text-brand-foreground disabled:opacity-60">{busy ? "Recherche…" : "Suivre"}</button>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </form>

        {order && (
          <div className="panel mt-4 p-5 sm:p-8">
            <p className="text-sm text-text-2">Commande <span className="font-bold text-foreground">{order.reference}</span> du {new Date(order.created_at).toLocaleDateString("fr-MA")}</p>
            <p className="mt-1 text-sm">{order.delivery_mode === "retrait" ? "Retrait au magasin" : "Livraison à domicile"}</p>
            {order.status === "annule" ? (
              <p className="mt-5 inline-flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive"><X className="h-4 w-4" /> Commande annulée</p>
            ) : (
              <ol className="mt-6 flex items-center">
                {STEPS.map(([k, l], i) => (
                  <li key={k} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn("grid h-8 w-8 place-items-center rounded-full text-xs font-bold", i <= idx ? "bg-brand text-brand-foreground" : "bg-page text-text-3")}>{i <= idx ? <Check className="h-4 w-4" /> : i + 1}</span>
                      <span className={cn("text-xs font-medium", i <= idx ? "text-foreground" : "text-text-3")}>{l}</span>
                    </div>
                    {i < STEPS.length - 1 && <span className={cn("mx-2 mb-5 h-0.5 flex-1", i < idx ? "bg-brand" : "bg-border")} />}
                  </li>
                ))}
              </ol>
            )}
            <ul className="mt-6 divide-y divide-border text-sm">
              {order.items.map((i, k) => <li key={k} className="flex items-center gap-2 py-2"><PackageSearch className="h-4 w-4 text-text-3" /> {i.qty} × {i.name}</li>)}
            </ul>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
