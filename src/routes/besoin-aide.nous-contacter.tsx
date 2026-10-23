import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, MapPin, Phone } from "lucide-react";
import { ContentPage, pageMeta } from "@/components/ContentPage";
import { WaIcon } from "@/components/SiteLayout";
import { sendContactMessage } from "@/lib/content.functions";
import { WHATSAPP_GENERAL_MESSAGE, useCompany, whatsappLinkTo } from "@/lib/company";

export const Route = createFileRoute("/besoin-aide/nous-contacter")({
  head: () => pageMeta("Nous contacter | Ghandi Home Electro", "Contactez Ghandi Home Electro à Casablanca : formulaire, téléphone, WhatsApp et adresse du magasin."),
  component: ContactPage,
});

const SUBJECTS = ["Question sur un produit", "Suivi de commande", "Livraison", "Autre"];

function ContactPage() {
  const c = useCompany();
  const [f, setF] = useState({ name: "", phone: "", email: "", subject: SUBJECTS[0]!, message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const input = "w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await sendContactMessage({ data: f });
      if (r.ok) setSent(true);
      else setError(r.error ?? "Erreur");
    } catch {
      setError("Le message n'a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <ContentPage title="Nous contacter" crumbs={[{ label: "Besoin d'aide ?", to: "/besoin-aide" }]} wide>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-5 sm:p-7">
          <h1 className="text-2xl font-bold">Nous contacter</h1>
          {sent ? (
            <div className="mt-6 flex items-center gap-3 text-sm"><CheckCircle2 className="h-6 w-6 text-whatsapp" /> Merci, votre message est envoyé. Nous vous répondons rapidement.</div>
          ) : (
            <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><label className="text-sm font-medium">Nom</label><input required className={input} value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div><label className="text-sm font-medium">Téléphone</label><input required inputMode="tel" className={input} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><label className="text-sm font-medium">Email (facultatif)</label><input type="email" className={input} value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div><label className="text-sm font-medium">Sujet</label><select className={input} value={f.subject} onChange={(e) => set("subject", e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="text-sm font-medium">Message</label><textarea required className={`${input} h-32`} value={f.message} onChange={(e) => set("message", e.target.value)} /></div>
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={f.website} onChange={(e) => set("website", e.target.value)} name="website" />
              {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
              <button type="submit" disabled={busy} className="rounded-md bg-brand px-6 py-2.5 text-sm font-bold text-brand-foreground disabled:opacity-60 sm:w-fit">{busy ? "Envoi…" : "Envoyer"}</button>
            </form>
          )}
        </div>
        <div className="panel space-y-3 p-5 text-sm sm:p-7">
          <a href={c.phoneHref} className="flex items-center gap-2 font-bold"><Phone className="h-4 w-4 text-brand" /> {c.phone}</a>
          <a href={whatsappLinkTo(c.whatsappNumber, WHATSAPP_GENERAL_MESSAGE)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-bold"><WaIcon className="h-4 w-4 text-whatsapp" /> WhatsApp</a>
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-brand" /> {c.address}</p>
          {c.hours.map((h) => <p key={h.days} className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 text-brand" /> {h.days} : {h.time}</p>)}
        </div>
      </div>
    </ContentPage>
  );
}
