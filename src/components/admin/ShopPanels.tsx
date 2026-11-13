import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { adminSaveBanners } from "@/lib/shop-admin.functions";
import type { HomeBanner } from "@/lib/catalog-types";

type Draft = HomeBanner & { imageData?: string | null; imageName?: string | null; preview?: string };

/** Home page slider banners (up to 3 shown). */
export function BannersPanel({ banners, onSaved }: { banners: HomeBanner[]; onSaved: () => void }) {
  const save = useServerFn(adminSaveBanners);
  const [items, setItems] = useState<Draft[]>(() => {
    const base = banners.map((b) => ({ ...b, image: b.image_path ?? b.image, preview: b.image }));
    while (base.length < 3) base.push({ image: "", title: "", button: "", link: "", preview: "" });
    return base.slice(0, 3);
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (i: number, patch: Partial<Draft>) => setItems((list) => list.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Bannières de la page d'accueil</h2>
      <p className="mt-1 text-sm text-foreground/60">3 diapositives : photo, titre, texte du bouton et lien (ex. /produits/froid-rayon). Laissez vide pour garder les bannières par défaut.</p>
      <div className="mt-5 space-y-5">
        {items.map((b, i) => (
          <div key={i} className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[140px_minmax(0,1fr)]">
            <label className="grid aspect-video cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-brand-soft/30 text-xs text-foreground/50">
              {b.preview ? <img src={b.preview} alt="" className="h-full w-full object-cover" /> : "Choisir une photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => set(i, { imageData: String(r.result), imageName: f.name, preview: String(r.result) });
                r.readAsDataURL(f);
              }} />
            </label>
            <div className="grid gap-2">
              <input value={b.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Titre" className="rounded-lg border border-border px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={b.button} onChange={(e) => set(i, { button: e.target.value })} placeholder="Texte du bouton" className="rounded-lg border border-border px-3 py-2 text-sm" />
                <input value={b.link} onChange={(e) => set(i, { link: e.target.value })} placeholder="Lien" className="rounded-lg border border-border px-3 py-2 text-sm" />
              </div>
              {b.preview && <button type="button" onClick={() => set(i, { image: "", imageData: null, preview: "" })} className="w-fit text-xs text-destructive">Retirer la photo</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button type="button" disabled={busy} onClick={async () => {
          setBusy(true);
          setMsg("");
          try {
            await save({ data: { banners: items.map(({ preview: _p, ...rest }) => ({ ...rest, image: rest.imageData ? "" : rest.image })) } });
            setMsg("Enregistré");
            onSaved();
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Erreur");
          } finally {
            setBusy(false);
          }
        }} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer les bannières"}
        </button>
        {msg && <span className="text-sm font-semibold text-brand">{msg}</span>}
      </div>
    </div>
  );
}

