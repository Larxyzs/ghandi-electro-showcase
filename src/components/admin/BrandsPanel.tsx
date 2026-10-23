import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminDeleteRow, adminListRows, adminSaveRow, adminUploadImage } from "@/lib/content-admin.functions";
import { slugify } from "@/lib/catalog-types";

type Row = Record<string, string | number | boolean | null>;
const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

/** Brands: add, edit, reorder, hide, upload a logo. */
export function BrandsPanel({ onSaved }: { onSaved: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => adminListRows({ data: { table: "brands" } }).then(setRows).catch(() => setRows([]));
  useEffect(() => { void load(); }, []);

  const save = async (row: Row) => {
    setBusy(true);
    try {
      await adminSaveRow({ data: { table: "brands", row } });
      await load();
      onSaved();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const move = async (i: number, d: -1 | 1) => {
    if (!rows) return;
    const a = rows[i]!, b = rows[i + d];
    if (!b) return;
    await adminSaveRow({ data: { table: "brands", row: { id: a["id"] ?? null, sort_order: Number(b["sort_order"]) } } });
    await adminSaveRow({ data: { table: "brands", row: { id: b["id"] ?? null, sort_order: Number(a["sort_order"]) } } });
    await load();
    onSaved();
  };

  if (!rows) return <Loader2 className="mx-auto h-6 w-6 animate-spin" />;
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xl font-bold">Marques</h2>
      <p className="text-sm text-foreground/60">Sans logo envoyé, le logo fourni avec le site est utilisé (si la marque est connue).</p>
      <div className="divide-y divide-border">
        {rows.map((r, i) => (
          <div key={String(r["id"])} className="flex items-center gap-2 py-2 text-sm">
            <span className="flex-1 font-semibold">{String(r["name"])} <span className="font-normal text-foreground/50">/marques/{String(r["slug"])}</span> {!r["visible"] && <em className="text-xs">(cachée)</em>}</span>
            <button type="button" aria-label="Monter" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
            <button type="button" aria-label="Descendre" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
            <button type="button" className="text-xs underline" onClick={() => setEdit(r)}>Modifier</button>
            <button type="button" aria-label="Supprimer" onClick={async () => { if (confirm("Supprimer cette marque ? Les produits ne sont pas supprimés.")) { await adminDeleteRow({ data: { table: "brands", id: String(r["id"]) } }); void load(); onSaved(); } }}><Trash2 className="h-4 w-4 text-destructive" /></button>
          </div>
        ))}
      </div>
      <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold underline" onClick={() => setEdit({ name: "", slug: "", logo_url: "", description: "", visible: true, sort_order: rows.length + 1 })}><Plus className="h-4 w-4" /> Ajouter une marque</button>
      {edit && (
        <div className="space-y-2 rounded-xl border border-brand/40 p-3">
          <input className={input} placeholder="Nom" value={String(edit["name"] ?? "")} onChange={(e) => setEdit({ ...edit, name: e.target.value, slug: edit["id"] ? edit["slug"] : slugify(e.target.value) })} />
          <input className={input} placeholder="Adresse (slug)" value={String(edit["slug"] ?? "")} onChange={(e) => setEdit({ ...edit, slug: slugify(e.target.value) })} />
          <div className="flex items-center gap-2">
            <input className={input} placeholder="Logo (lien https:// ou envoi)" value={String(edit["logo_url"] ?? "")} onChange={(e) => setEdit({ ...edit, logo_url: e.target.value })} />
            <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-xs font-semibold">Envoyer
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const dataUrl = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
                try { const { path } = await adminUploadImage({ data: { dataUrl, name: f.name } }); setEdit((x) => (x ? { ...x, logo_url: path } : x)); } catch { toast.error("Image refusée"); }
              }} />
            </label>
          </div>
          <textarea className={input} placeholder="Courte description (facultatif)" value={String(edit["description"] ?? "")} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={Boolean(edit["visible"])} onChange={(e) => setEdit({ ...edit, visible: e.target.checked })} /> Visible sur le site</label>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={async () => {
              if (!String(edit["name"]).trim() || !String(edit["slug"]).trim()) return toast.error("Nom obligatoire");
              if (await save(edit)) { setEdit(null); toast.success("Enregistré"); }
            }}>Enregistrer</button>
            <button type="button" className="text-sm underline" onClick={() => setEdit(null)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
