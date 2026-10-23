import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Clock, Home as HomeIcon, MapPin, Minus, PackageSearch, Plus, Store, Trash2 } from "lucide-react";
import { SiteLayout, WaIcon } from "@/components/SiteLayout";
import { useCart } from "@/lib/cart";
import { isValidMaPhone } from "@/lib/orders-types";
import { placeOrder } from "@/lib/orders.functions";
import { formatDH, useCompany, whatsappLinkTo } from "@/lib/company";
import { useDynamicText } from "@/lib/dynamic-text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/panier")({
  head: () => ({
    meta: [
      { title: "Panier et commande | Ghandi Home Electro" },
      { name: "description", content: "Finalisez votre commande d'électroménager chez Ghandi Home Electro à Casablanca : livraison ou retrait au magasin, paiement à la livraison." },
      { property: "og:title", content: "Panier | Ghandi Home Electro" },
      { property: "og:description", content: "Passez votre commande, nous vous appelons pour la confirmer." },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PanierPage,
});

const CITIES = [
  "Casablanca", "Agadir", "Al Hoceïma", "Azrou", "Béni Mellal", "Ben Guerir", "Benslimane", "Berkane", "Berrechid", "Bouskoura", "Chefchaouen",
  "Dakhla", "Dar Bouazza", "El Jadida", "Errachidia", "Essaouira", "Fès", "Fnideq", "Guelmim", "Ifrane", "Kénitra", "Khémisset", "Khouribga",
  "Ksar El Kébir", "Laâyoune", "Larache", "Marrakech", "Martil", "Médiouna", "Meknès", "Mohammédia", "Nador", "Ouarzazate", "Oujda", "Rabat",
  "Safi", "Salé", "Settat", "Sidi Kacem", "Sidi Slimane", "Skhirat", "Tanger", "Taourirt", "Taroudant", "Taza", "Témara", "Tétouan", "Tiznit",
];

type Mode = "livraison" | "retrait";
type FormState = { full_name: string; phone: string; email: string; address: string; city: string; note: string };
const EMPTY: FormState = { full_name: "", phone: "", email: "", address: "", city: "Casablanca", note: "" };
const STORE_KEY = "ghe-checkout";

function Steps({ step }: { step: number }) {
  const labels = ["Panier", "Livraison", "Confirmation"];
  return (
    <ol className="panel flex items-center justify-between gap-2 px-4 py-3 text-sm">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 items-center gap-2">
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold", i + 1 <= step ? "bg-brand text-brand-foreground" : "bg-page text-text-3")}>
            {i + 1 < step ? <Check className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn("font-medium", i + 1 === step ? "text-foreground" : "text-text-3")}>{l}</span>
          {i < 2 && <span className="mx-2 hidden h-px flex-1 bg-border sm:block" />}
        </li>
      ))}
    </ol>
  );
}

function PanierPage() {
  const { items, setQty, remove, clear } = useCart();
  const tr = useDynamicText();
  const company = useCompany();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>("livraison");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "cgv", string>>>({});
  const [cgv, setCgv] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; phone: string; msg: string } | null>(null);
  const [cityQuery, setCityQuery] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
      if (saved && typeof saved === "object") {
        setForm({ ...EMPTY, ...saved.form, note: "" });
        if (saved.mode === "retrait") setMode("retrait");
      }
    } catch { /* ignore */ }
  }, []);

  const priced = items.filter((i) => !i.price_on_request);
  const subtotal = priced.reduce((a, i) => a + i.price * i.qty, 0);
  const hasOnRequest = items.some((i) => i.price_on_request);
  const cities = useMemo(() => {
    const q = cityQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return CITIES.filter((c) => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(q));
  }, [cityQuery]);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const validate = () => {
    const e: typeof errors = {};
    if (form.full_name.trim().length < 2) e.full_name = "Indiquez votre nom complet.";
    if (!isValidMaPhone(form.phone)) e.phone = "Numéro marocain invalide (06…, 07…, 05… ou +212…).";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Adresse email invalide.";
    if (mode === "livraison") {
      if (!form.city.trim()) e.city = "Choisissez votre ville.";
      if (form.address.trim().length < 3) e.address = "Indiquez votre adresse.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!cgv) {
      setErrors({ cgv: "Veuillez accepter les conditions générales de vente." });
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      const result = await placeOrder({
        data: {
          full_name: form.full_name,
          phone: form.phone,
          email: form.email,
          address: mode === "retrait" ? "" : form.address,
          city: mode === "retrait" ? "Casablanca" : form.city,
          note: form.note,
          delivery_mode: mode,
          items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        },
      });
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ form: { ...form, note: "" }, mode })); } catch { /* ignore */ }
      const lines = items.map((i) => `- ${i.qty} × ${i.brand} ${i.name} : ${i.price_on_request ? "prix à confirmer" : formatDH(i.price * i.qty)}`).join("\n");
      const where = mode === "retrait" ? "Retrait au magasin" : `Livraison : ${form.city}, ${form.address}`;
      const msg = `Bonjour, nouvelle commande ${result.reference}\n${lines}\nNom : ${form.full_name}\nTél : ${form.phone}\n${where}${form.note ? `\nNote : ${form.note}` : ""}\nPaiement à la livraison.`;
      setDone({ reference: result.reference, phone: form.phone, msg });
      clear();
      window.scrollTo({ top: 0 });
    } catch (error) {
      const m = error instanceof Error ? error.message : "";
      if (m.includes("INVALID_PHONE")) { setStep(2); setErrors({ phone: "Numéro marocain invalide." }); }
      else if (m.includes("EMPTY_CART")) setServerError("Votre panier est vide.");
      else if (m.includes("INSUFFICIENT_STOCK")) setServerError("Un produit n'a plus assez de stock. Modifiez la quantité.");
      else setServerError("La commande n'a pas pu être envoyée. Réessayez ou appelez-nous.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <SiteLayout>
        <section className="shell max-w-2xl py-10">
          <div className="panel flex flex-col items-center px-6 py-12 text-center">
            <CheckCircle2 className="h-14 w-14 text-whatsapp" />
            <h1 className="mt-4 text-2xl font-bold">Merci ! Votre commande n° {done.reference} est enregistrée.</h1>
            <p className="mt-2 text-text-2">Nous vous appelons pour la confirmer.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/suivi-commande" search={{ n: done.reference, t: done.phone }} className="rounded-md bg-brand px-5 py-3 text-sm font-bold text-brand-foreground">Suivre ma commande</Link>
              <a href={whatsappLinkTo(company.whatsappNumber, done.msg)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-whatsapp px-5 py-3 text-sm font-bold text-background">
                <WaIcon className="h-4 w-4" /> Nous écrire sur WhatsApp
              </a>
            </div>
          </div>
        </section>
      </SiteLayout>
    );
  }

  const input = "w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";
  const err = (k: keyof typeof errors) => errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>;

  const summary = (
    <aside className="panel h-fit p-5">
      <p className="font-bold">Récapitulatif</p>
      <div className="mt-3 flex justify-between text-sm"><span>Sous-total</span><span className="font-bold">{formatDH(subtotal)}</span></div>
      {hasOnRequest && <p className="mt-2 text-xs text-text-2">Les prix sur demande vous seront confirmés par téléphone.</p>}
      <p className="mt-2 text-xs text-text-2">Livraison : délai et frais confirmés par téléphone.</p>
      <p className="mt-1 text-xs text-text-2">Paiement à la livraison.</p>
    </aside>
  );

  return (
    <SiteLayout>
      <section className="shell max-w-5xl py-4">
        <Steps step={step} />
        {items.length === 0 ? (
          <div className="panel mt-4 flex flex-col items-center gap-3 p-12 text-center">
            <PackageSearch className="h-10 w-10 text-brand" />
            <p className="text-text-2">Votre panier est vide.</p>
            <Link to="/produits" search={{}} className="font-bold underline">Découvrir nos produits</Link>
          </div>
        ) : step === 1 ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
            <div>
              <h1 className="mb-3 text-xl font-bold">Mon panier</h1>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.product_id} className="panel flex gap-4 p-3">
                    <div className="grid h-20 w-20 shrink-0 place-items-center">
                      {item.image_url ? <img src={item.image_url} alt={tr(item.name)} className="h-full w-full object-contain" /> : <PackageSearch className="h-6 w-6 text-text-3" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {item.brand && <p className="text-xs text-text-3 uppercase">{item.brand}</p>}
                          <p className="text-sm font-medium">{tr(item.name)}</p>
                        </div>
                        <button type="button" onClick={() => remove(item.product_id)} aria-label="Retirer" className="text-text-3 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center rounded-md border border-input">
                          <button type="button" onClick={() => setQty(item.product_id, item.qty - 1)} aria-label="Moins" className="grid h-8 w-8 place-items-center"><Minus className="h-4 w-4" /></button>
                          <span className="w-7 text-center text-sm font-bold">{item.qty}</span>
                          <button type="button" onClick={() => setQty(item.product_id, item.qty + 1)} aria-label="Plus" className="grid h-8 w-8 place-items-center"><Plus className="h-4 w-4" /></button>
                        </div>
                        <span className="text-sm font-bold">{item.price_on_request ? "Prix sur demande" : formatDH(item.price * item.qty)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              {summary}
              <button type="button" onClick={() => { setStep(2); window.scrollTo({ top: 0 }); }} className="w-full rounded-md bg-brand py-3 text-sm font-bold text-brand-foreground">Passer la commande</button>
              <Link to="/produits" search={{}} className="block text-center text-sm underline">Continuer mes achats</Link>
            </div>
          </div>
        ) : step === 2 ? (
          <form className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]" onSubmit={(e) => { e.preventDefault(); if (validate()) { setStep(3); window.scrollTo({ top: 0 }); } }} noValidate>
            <div className="space-y-4">
              <div className="panel p-5">
                <h2 className="font-bold">Mode de réception</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {([["livraison", HomeIcon, "Livraison à domicile", "Gratuite à Casablanca, Mohammedia et Dar Bouazza"], ["retrait", Store, "Retrait au magasin", company.shortAddress]] as const).map(([m, Icon, t, s]) => (
                    <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex items-start gap-3 rounded-lg border-2 p-4 text-start", mode === m ? "border-brand bg-brand-soft" : "border-border")}>
                      <Icon className="h-6 w-6 shrink-0 text-brand" />
                      <span><span className="block font-bold">{t}</span><span className="text-xs text-text-2">{s}</span></span>
                    </button>
                  ))}
                </div>
                {mode === "livraison" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Ville</label>
                      <input className={input} placeholder="Rechercher une ville" value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} />
                      <select className={cn(input, "mt-2")} value={form.city} onChange={(e) => set("city", e.target.value)} size={4}>
                        {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {err("city")}
                    </div>
                    <div>
                      <label className="text-sm font-medium">Adresse</label>
                      <textarea className={cn(input, "h-[132px]")} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Quartier, rue, numéro…" />
                      {err("address")}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 text-sm">
                      <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-brand" /> {company.address}</p>
                      {company.hours.map((h) => <p key={h.days} className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 text-brand" /> {h.days} : {h.time}</p>)}
                    </div>
                    <iframe title="Plan" src={company.mapsEmbed} loading="lazy" className="h-40 w-full rounded-md border border-border" />
                  </div>
                )}
              </div>
              <div className="panel grid gap-3 p-5 sm:grid-cols-2">
                <h2 className="font-bold sm:col-span-2">Vos coordonnées</h2>
                <div><label className="text-sm font-medium">Nom complet</label><input className={input} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" />{err("full_name")}</div>
                <div><label className="text-sm font-medium">Téléphone</label><input className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" placeholder="06 00 00 00 00" />{err("phone")}</div>
                <div><label className="text-sm font-medium">Email (facultatif)</label><input className={input} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />{err("email")}</div>
                <div><label className="text-sm font-medium">Note (facultatif)</label><input className={input} value={form.note} onChange={(e) => set("note", e.target.value)} /></div>
              </div>
            </div>
            <div className="space-y-3">
              {summary}
              <button type="submit" className="w-full rounded-md bg-brand py-3 text-sm font-bold text-brand-foreground">Continuer</button>
              <button type="button" onClick={() => setStep(1)} className="block w-full text-center text-sm underline">Retour au panier</button>
            </div>
          </form>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              <div className="panel p-5">
                <h2 className="font-bold">Produits</h2>
                <ul className="mt-2 divide-y divide-border text-sm">
                  {items.map((i) => (
                    <li key={i.product_id} className="flex justify-between gap-3 py-2"><span>{i.qty} × {i.brand} {tr(i.name)}</span><span className="font-bold">{i.price_on_request ? "Prix sur demande" : formatDH(i.price * i.qty)}</span></li>
                  ))}
                </ul>
              </div>
              <div className="panel grid gap-4 p-5 text-sm sm:grid-cols-2">
                <div>
                  <p className="font-bold">{mode === "retrait" ? "Retrait au magasin" : "Livraison à domicile"}</p>
                  <p className="text-text-2">{mode === "retrait" ? company.address : `${form.address}, ${form.city}`}</p>
                </div>
                <div>
                  <p className="font-bold">Contact</p>
                  <p className="text-text-2">{form.full_name} · {form.phone}{form.email && ` · ${form.email}`}</p>
                </div>
                <div className="sm:col-span-2"><p className="font-bold">Paiement : à la livraison</p></div>
              </div>
              <label className="panel flex items-start gap-2 p-4 text-sm">
                <input type="checkbox" checked={cgv} onChange={(e) => setCgv(e.target.checked)} className="mt-0.5 accent-brand" />
                <span>J'accepte les <Link to="/conditions-generales-de-vente" target="_blank" className="underline">conditions générales de vente</Link></span>
              </label>
              {err("cgv")}
              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            </div>
            <div className="space-y-3">
              {summary}
              <button type="button" disabled={busy} onClick={submit} className="w-full rounded-md bg-brand py-3 text-sm font-bold text-brand-foreground disabled:opacity-60">{busy ? "Envoi…" : "Valider ma commande"}</button>
              <button type="button" onClick={() => setStep(2)} className="block w-full text-center text-sm underline">Modifier la livraison</button>
            </div>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
