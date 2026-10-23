import { useEffect, useState, type ReactNode } from "react";
import { Download, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminDeleteRow,
  adminListRows,
  adminSaveContent,
  adminSaveNodeMeta,
  adminSaveRow,
  adminUploadImage,
} from "@/lib/content-admin.functions";
import { DAY_NAMES, DEFAULT_WEEK, whatsappLinkTo } from "@/lib/company";
import { servicesOf } from "@/lib/services";
import { pathOf, slugify, type DayHours, type SiteContent, type SiteData } from "@/lib/catalog-types";
import { cn } from "@/lib/utils";

type Row = Record<string, string | number | boolean | null>;
const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const btn = "inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60";

function Card({ title, children, hint }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <details className="rounded-2xl border border-border bg-card p-5 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer text-base font-semibold">{title}</summary>
      {hint && <p className="mt-1 text-xs text-foreground/60">{hint}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </details>
  );
}

async function fileToPath(file: File) {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return (await adminUploadImage({ data: { dataUrl, name: file.name } })).path;
}

function ImageField({ value, onChange, label }: { value?: string; onChange: (v: string) => void; label: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input className={cn(input, "flex-1")} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Lien https:// ou envoyez une image" />
      <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-xs font-semibold">
        {busy ? "Envoi…" : "Envoyer"}
        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try { onChange(await fileToPath(f)); } catch { toast.error("Image refusée"); } finally { setBusy(false); }
        }} />
      </label>
    </div>
  );
}

function useRows(table: "faq_items" | "guides" | "newsletter_subscribers" | "contact_messages") {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = () => adminListRows({ data: { table } }).then(setRows).catch(() => setRows([]));
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { rows, load };
}

export function SiteContentPanel({ data, onSaved }: { data: SiteData; onSaved: () => void }) {
  const initial = data.settings.content ?? {};
  const [c, setC] = useState<SiteContent>(initial);
  const [busy, setBusy] = useState(false);
  const save = async (patch: SiteContent) => {
    setBusy(true);
    try {
      await adminSaveContent({ data: { patch } });
      toast.success("Enregistré");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };
  const store = c.store ?? {};
  const week: DayHours[] = store.week?.length === 7 ? store.week : DEFAULT_WEEK;
  const setStore = (patch: Partial<NonNullable<SiteContent["store"]>>) => setC({ ...c, store: { ...store, ...patch } });
  const banners = (c.secondary_banners ?? []).map((b) => ({ ...b, image: b.image_path ?? b.image }));
  const services = servicesOf(c);
  const pages = c.pages ?? {};
  const pathName = (id: string) => pathOf(data.nodes, id).map((n) => n.name).join(" › ");
  const nodeOptions = [...data.nodes].sort((a, b) => pathName(a.id).localeCompare(pathName(b.id)));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Contenu du site</h2>

      <Card title="Bannières secondaires (à droite du grand diaporama)" hint="Sans bannière secondaire, le diaporama prend toute la largeur.">
        {banners.map((b, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border p-3">
            <ImageField label="Image" value={b.image} onChange={(v) => { const n = [...banners]; n[i] = { ...b, image: v }; setC({ ...c, secondary_banners: n }); }} />
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={input} placeholder="Lien (ex : /produits/tv-son)" value={b.link} onChange={(e) => { const n = [...banners]; n[i] = { ...b, link: e.target.value }; setC({ ...c, secondary_banners: n }); }} />
              <input className={input} placeholder="Titre (facultatif)" value={b.title ?? ""} onChange={(e) => { const n = [...banners]; n[i] = { ...b, title: e.target.value }; setC({ ...c, secondary_banners: n }); }} />
            </div>
            <button type="button" onClick={() => setC({ ...c, secondary_banners: banners.filter((_, k) => k !== i) })} className="text-xs text-destructive">Supprimer</button>
          </div>
        ))}
        {banners.length < 2 && <button type="button" onClick={() => setC({ ...c, secondary_banners: [...banners, { image: "", link: "", title: "" }] })} className="text-sm font-semibold underline">+ Ajouter une bannière</button>}
        <button type="button" disabled={busy} className={btn} onClick={() => save({ secondary_banners: banners.map(({ image, link, title }) => ({ image, link, title: title ?? "" })) })}>Enregistrer</button>
      </Card>

      <Card title="Raccourcis du menu (3 maximum)" hint="Affichés dans la barre des rayons et dans « Nos univers ».">
        {[0, 1, 2].map((i) => (
          <select key={i} className={input} value={c.shortcuts?.[i] ?? ""} onChange={(e) => {
            const s = [...(c.shortcuts ?? [])];
            s[i] = e.target.value;
            setC({ ...c, shortcuts: s.filter(Boolean) });
          }}>
            <option value="">— Aucun —</option>
            {nodeOptions.map((n) => <option key={n.id} value={n.id}>{pathName(n.id)}</option>)}
          </select>
        ))}
        <button type="button" disabled={busy} className={btn} onClick={() => save({ shortcuts: c.shortcuts ?? [] })}>Enregistrer</button>
      </Card>

      <Card title="Magasin : adresse, téléphone, horaires, photos, réseaux sociaux" hint="Champs vides = valeurs actuelles du site.">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={input} placeholder="Adresse" value={store.address ?? ""} onChange={(e) => setStore({ address: e.target.value })} />
          <input className={input} placeholder="Téléphone (ex : +212 661 194 525)" value={store.phone ?? ""} onChange={(e) => setStore({ phone: e.target.value })} />
          <input className={input} placeholder="Numéro WhatsApp (si différent)" value={store.whatsapp ?? ""} onChange={(e) => setStore({ whatsapp: e.target.value })} />
          <input className={input} placeholder="Lien Google Maps" value={store.maps_link ?? ""} onChange={(e) => setStore({ maps_link: e.target.value })} />
        </div>
        <div className="space-y-2">
          {week.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-20 font-medium">{DAY_NAMES[i]}</span>
              <label className="flex items-center gap-1"><input type="checkbox" checked={d.closed} onChange={(e) => { const w = [...week]; w[i] = { ...d, closed: e.target.checked }; setStore({ week: w }); }} /> Fermé</label>
              {!d.closed && [0, 1].map((r) => (
                <span key={r} className="flex items-center gap-1">
                  <input type="time" className="rounded border border-border px-1 py-1" value={d.ranges[r]?.[0] ?? ""} onChange={(e) => { const w = [...week]; const ranges = [...d.ranges]; ranges[r] = [e.target.value, ranges[r]?.[1] ?? ""]; w[i] = { ...d, ranges: ranges.filter((x) => x[0] || x[1]) as [string, string][] }; setStore({ week: w }); }} />
                  –
                  <input type="time" className="rounded border border-border px-1 py-1" value={d.ranges[r]?.[1] ?? ""} onChange={(e) => { const w = [...week]; const ranges = [...d.ranges]; ranges[r] = [ranges[r]?.[0] ?? "", e.target.value]; w[i] = { ...d, ranges: ranges.filter((x) => x[0] || x[1]) as [string, string][] }; setStore({ week: w }); }} />
                </span>
              ))}
            </div>
          ))}
        </div>
        <div>
          <p className="text-sm font-medium">Photos du magasin</p>
          {(store.photos ?? []).map((p, i) => (
            <div key={i} className="mt-1 flex items-center gap-2 text-xs"><span className="flex-1 truncate">{p}</span><button type="button" className="text-destructive" onClick={() => setStore({ photos: (store.photos ?? []).filter((_, k) => k !== i) })}>Retirer</button></div>
          ))}
          <ImageField label="Ajouter" value="" onChange={(v) => v && setStore({ photos: [...(store.photos ?? []), v] })} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["facebook", "instagram", "tiktok", "youtube"] as const).map((k) => (
            <input key={k} className={input} placeholder={`Lien ${k}`} value={c.social?.[k] ?? ""} onChange={(e) => setC({ ...c, social: { ...c.social, [k]: e.target.value } })} />
          ))}
        </div>
        <button type="button" disabled={busy} className={btn} onClick={() => save({ store: { address: store.address ?? "", phone: store.phone ?? "", whatsapp: store.whatsapp ?? "", maps_link: store.maps_link ?? "", week, photos: store.photos ?? [] }, social: c.social ?? {} })}>Enregistrer</button>
      </Card>

      <Card title="Services">
        {services.map((s, i) => (
          <div key={s.key} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[auto_1fr]">
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={s.enabled} onChange={(e) => { const n = [...services]; n[i] = { ...s, enabled: e.target.checked }; setC({ ...c, services: n }); }} /> Visible</label>
            <input className={input} value={s.title} onChange={(e) => { const n = [...services]; n[i] = { ...s, title: e.target.value }; setC({ ...c, services: n }); }} />
            <textarea className={cn(input, "sm:col-span-2")} value={s.text} placeholder="Texte (écrivez uniquement ce que vous proposez vraiment)" onChange={(e) => { const n = [...services]; n[i] = { ...s, text: e.target.value }; setC({ ...c, services: n }); }} />
          </div>
        ))}
        <button type="button" disabled={busy} className={btn} onClick={() => save({ services })}>Enregistrer</button>
      </Card>

      <Card title="Pages (Qui sommes-nous, Livraison, MRE, CGV, Confidentialité)" hint="Mise en forme : « ## Titre », « - élément de liste », « ![](lien image) », ligne vide = nouveau paragraphe.">
        {([["about", "Qui sommes-nous"], ["livraison", "Livraison et retrait"], ["mre", "MRE (page cachée tant qu'elle n'est pas activée)"], ["cgv", "Conditions générales de vente"], ["confidentialite", "Politique de confidentialité"]] as const).map(([k, l]) => (
          <div key={k} className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-sm font-semibold">{l}</p>
            {k === "mre" && <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={Boolean(pages[k]?.enabled)} onChange={(e) => setC({ ...c, pages: { ...pages, [k]: { ...pages[k], enabled: e.target.checked } } })} /> Page activée</label>}
            <input className={input} placeholder="Titre (facultatif)" value={pages[k]?.title ?? ""} onChange={(e) => setC({ ...c, pages: { ...pages, [k]: { ...pages[k], title: e.target.value } } })} />
            <textarea className={cn(input, "h-32")} placeholder="Texte" value={pages[k]?.body ?? ""} onChange={(e) => setC({ ...c, pages: { ...pages, [k]: { ...pages[k], body: e.target.value } } })} />
          </div>
        ))}
        <button type="button" disabled={busy} className={btn} onClick={() => save({ pages })}>Enregistrer</button>
      </Card>

      <Card title="Texte SEO de l'accueil">
        <textarea className={cn(input, "h-32")} value={c.home_seo_text ?? ""} onChange={(e) => setC({ ...c, home_seo_text: e.target.value })} />
        <button type="button" disabled={busy} className={btn} onClick={() => save({ home_seo_text: c.home_seo_text ?? "" })}>Enregistrer</button>
      </Card>

      <CategoryMeta data={data} onSaved={onSaved} />
      <FaqEditor />
      <GuidesEditor data={data} />
      <NewsletterList />
      <MessagesList />
    </div>
  );
}

function CategoryMeta({ data, onSaved }: { data: SiteData; onSaved: () => void }) {
  const [id, setId] = useState("");
  const node = data.nodes.find((n) => n.id === id);
  const [m, setM] = useState<Record<string, string | boolean>>({});
  useEffect(() => {
    if (node) setM({ show_in_menu: node.show_in_menu !== false, menu_label: node.menu_label ?? "", seo_title: node.seo_title ?? "", seo_description: node.seo_description ?? "", intro_text: node.intro_text ?? "", seo_text: node.seo_text ?? "" });
  }, [node]);
  const name = (nid: string) => pathOf(data.nodes, nid).map((n) => n.name).join(" › ");
  return (
    <Card title="Catégories : menu, textes et SEO" hint="Champs vides = valeurs automatiques.">
      <select className={input} value={id} onChange={(e) => setId(e.target.value)}>
        <option value="">— Choisir une catégorie —</option>
        {[...data.nodes].sort((a, b) => name(a.id).localeCompare(name(b.id))).map((n) => <option key={n.id} value={n.id}>{name(n.id)}</option>)}
      </select>
      {node && (
        <>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(m["show_in_menu"])} onChange={(e) => setM({ ...m, show_in_menu: e.target.checked })} /> Afficher dans le menu</label>
          {([["menu_label", "Nom court dans le menu"], ["seo_title", "Titre SEO"], ["seo_description", "Description SEO"]] as const).map(([k, l]) => (
            <input key={k} className={input} placeholder={l} value={String(m[k] ?? "")} onChange={(e) => setM({ ...m, [k]: e.target.value })} />
          ))}
          <textarea className={input} placeholder="Texte d'introduction (2–3 lignes en haut de la page)" value={String(m["intro_text"] ?? "")} onChange={(e) => setM({ ...m, intro_text: e.target.value })} />
          <textarea className={cn(input, "h-28")} placeholder="Texte SEO (bas de page, replié)" value={String(m["seo_text"] ?? "")} onChange={(e) => setM({ ...m, seo_text: e.target.value })} />
          <button type="button" className={btn} onClick={async () => { await adminSaveNodeMeta({ data: { id: node.id, meta: m } }); toast.success("Enregistré"); onSaved(); }}>Enregistrer</button>
        </>
      )}
    </Card>
  );
}

function FaqEditor() {
  const { rows, load } = useRows("faq_items");
  const [edit, setEdit] = useState<Row | null>(null);
  if (!rows) return <Card title="FAQ"><Loader2 className="h-5 w-5 animate-spin" /></Card>;
  return (
    <Card title={`FAQ (${rows.length} questions)`}>
      {rows.map((r) => (
        <div key={String(r["id"])} className="flex items-start gap-2 rounded-lg border border-border p-2 text-sm">
          <span className="flex-1"><span className="text-xs text-foreground/55">{String(r["category"])}</span><br />{String(r["question"])} {!r["published"] && <em className="text-xs">(masquée)</em>}</span>
          <button type="button" className="text-xs underline" onClick={() => setEdit(r)}>Modifier</button>
          <button type="button" aria-label="Supprimer" onClick={async () => { if (confirm("Supprimer ?")) { await adminDeleteRow({ data: { table: "faq_items", id: String(r["id"]) } }); void load(); } }}><Trash2 className="h-4 w-4 text-destructive" /></button>
        </div>
      ))}
      <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold underline" onClick={() => setEdit({ category: "Commander en ligne", question: "", answer: "", sort_order: rows.length + 1, published: true })}><Plus className="h-4 w-4" /> Ajouter une question</button>
      {edit && (
        <div className="space-y-2 rounded-xl border border-brand/40 p-3">
          <select className={input} value={String(edit["category"])} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
            {["Commander en ligne", "Livraison et retrait", "Paiement", "Au magasin"].map((x) => <option key={x}>{x}</option>)}
          </select>
          <input className={input} placeholder="Question" value={String(edit["question"] ?? "")} onChange={(e) => setEdit({ ...edit, question: e.target.value })} />
          <textarea className={input} placeholder="Réponse" value={String(edit["answer"] ?? "")} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} />
          <div className="flex items-center gap-3 text-sm">
            <label>Ordre <input type="number" className="w-16 rounded border border-border px-1" value={Number(edit["sort_order"] ?? 0)} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(edit["published"])} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} /> Publiée</label>
          </div>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={async () => { await adminSaveRow({ data: { table: "faq_items", row: edit } }); setEdit(null); void load(); toast.success("Enregistré"); }}>Enregistrer</button>
            <button type="button" className="text-sm underline" onClick={() => setEdit(null)}>Annuler</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function GuidesEditor({ data }: { data: SiteData }) {
  const { rows, load } = useRows("guides");
  const [edit, setEdit] = useState<Row | null>(null);
  if (!rows) return <Card title="Conseils"><Loader2 className="h-5 w-5 animate-spin" /></Card>;
  const name = (nid: string) => pathOf(data.nodes, nid).map((n) => n.name).join(" › ");
  return (
    <Card title={`Conseils / guides d'achat (${rows.length})`} hint="La rubrique Conseils reste cachée tant qu'aucun guide n'est publié.">
      {rows.map((r) => (
        <div key={String(r["id"])} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
          <span className="flex-1">{String(r["title"])} {!r["published"] && <em className="text-xs">(brouillon)</em>}</span>
          <button type="button" className="text-xs underline" onClick={() => setEdit(r)}>Modifier</button>
          <button type="button" aria-label="Supprimer" onClick={async () => { if (confirm("Supprimer ?")) { await adminDeleteRow({ data: { table: "guides", id: String(r["id"]) } }); void load(); } }}><Trash2 className="h-4 w-4 text-destructive" /></button>
        </div>
      ))}
      <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold underline" onClick={() => setEdit({ title: "", slug: "", cover_url: "", node_id: "", summary: "", body: "", published: false, published_at: new Date().toISOString() })}><Plus className="h-4 w-4" /> Nouveau guide</button>
      {edit && (
        <div className="space-y-2 rounded-xl border border-brand/40 p-3">
          <input className={input} placeholder="Titre" value={String(edit["title"] ?? "")} onChange={(e) => setEdit({ ...edit, title: e.target.value, slug: edit["id"] ? edit["slug"] : slugify(e.target.value) })} />
          <input className={input} placeholder="Adresse (slug)" value={String(edit["slug"] ?? "")} onChange={(e) => setEdit({ ...edit, slug: slugify(e.target.value) })} />
          <ImageField label="Image de couverture" value={String(edit["cover_url"] ?? "")} onChange={(v) => setEdit({ ...edit, cover_url: v })} />
          <select className={input} value={String(edit["node_id"] ?? "")} onChange={(e) => setEdit({ ...edit, node_id: e.target.value })}>
            <option value="">— Catégorie liée (facultatif) —</option>
            {[...data.nodes].sort((a, b) => name(a.id).localeCompare(name(b.id))).map((n) => <option key={n.id} value={n.id}>{name(n.id)}</option>)}
          </select>
          <textarea className={input} placeholder="Résumé" value={String(edit["summary"] ?? "")} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} />
          <textarea className={cn(input, "h-48")} placeholder={"Texte — ## Titre, - liste, ![](lien image)"} value={String(edit["body"] ?? "")} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1"><input type="checkbox" checked={Boolean(edit["published"])} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} /> Publié</label>
            <label>Date <input type="date" className="rounded border border-border px-1" value={String(edit["published_at"] ?? "").slice(0, 10)} onChange={(e) => setEdit({ ...edit, published_at: new Date(e.target.value).toISOString() })} /></label>
          </div>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={async () => {
              if (!String(edit["title"]).trim() || !String(edit["slug"]).trim()) return toast.error("Titre et adresse obligatoires");
              try { await adminSaveRow({ data: { table: "guides", row: edit } }); setEdit(null); void load(); toast.success("Enregistré"); } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
            }}>Enregistrer</button>
            <button type="button" className="text-sm underline" onClick={() => setEdit(null)}>Annuler</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function NewsletterList() {
  const { rows, load } = useRows("newsletter_subscribers");
  const csv = () => {
    const text = ["email;date;page", ...(rows ?? []).map((r) => `${r["email"]};${String(r["created_at"]).slice(0, 10)};${r["source"] ?? ""}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = "newsletter.csv";
    a.click();
  };
  return (
    <Card title={`Newsletter (${rows?.length ?? "…"} inscrits)`}>
      <button type="button" onClick={csv} className="inline-flex items-center gap-1 text-sm font-semibold underline"><Download className="h-4 w-4" /> Télécharger (CSV)</button>
      <div className="max-h-72 divide-y divide-border overflow-y-auto text-sm">
        {(rows ?? []).map((r) => (
          <div key={String(r["id"])} className="flex items-center gap-2 py-1.5">
            <span className="flex-1">{String(r["email"])}</span>
            <span className="text-xs text-foreground/55">{String(r["created_at"]).slice(0, 10)}</span>
            <button type="button" aria-label="Supprimer" onClick={async () => { await adminDeleteRow({ data: { table: "newsletter_subscribers", id: String(r["id"]) } }); void load(); }}><Trash2 className="h-4 w-4 text-destructive" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MessagesList() {
  const { rows, load } = useRows("contact_messages");
  const unread = (rows ?? []).filter((r) => !r["read"]).length;
  return (
    <Card title={`Messages (${unread} non lu${unread > 1 ? "s" : ""})`}>
      {(rows ?? []).length === 0 && <p className="text-sm text-foreground/60">Aucun message.</p>}
      {(rows ?? []).map((r) => (
        <div key={String(r["id"])} className={cn("rounded-lg border p-3 text-sm", r["read"] ? "border-border" : "border-brand bg-brand-soft/40")}>
          <p className="font-semibold">{String(r["name"])} · {String(r["phone"])} {r["email"] ? `· ${r["email"]}` : ""}</p>
          <p className="text-xs text-foreground/55">{String(r["subject"])} · {new Date(String(r["created_at"])).toLocaleString("fr-MA")}</p>
          <p className="mt-1 whitespace-pre-line">{String(r["message"])}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <a className="font-semibold text-whatsapp underline" target="_blank" rel="noopener noreferrer" href={whatsappLinkTo(String(r["phone"]).replace(/\D/g, "").replace(/^0/, "212"), `Bonjour ${r["name"]}, merci pour votre message.`)}>Répondre sur WhatsApp</a>
            <button type="button" className="underline" onClick={async () => { await adminSaveRow({ data: { table: "contact_messages", row: { id: r["id"] ?? null, read: !r["read"] } } }); void load(); }}>{r["read"] ? "Marquer non lu" : "Marquer lu"}</button>
            <button type="button" className="text-destructive underline" onClick={async () => { if (confirm("Supprimer ?")) { await adminDeleteRow({ data: { table: "contact_messages", id: String(r["id"]) } }); void load(); } }}>Supprimer</button>
          </div>
        </div>
      ))}
    </Card>
  );
}
