import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Check, ClipboardList, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { doneMissingReference, getMissingReferences, sendMissingReference } from '@/lib/price-stock.functions';
import { cn } from '@/lib/utils';

const big = 'min-h-14 h-auto whitespace-normal px-5 py-3 text-lg font-bold';
const field = 'mt-2 min-h-14 w-full rounded-md border-2 border-input bg-background p-3 text-xl';

/** Prix & stock: "I can't find a product" — sends a note (reference + brand) to the owner. */
export function MissingReferenceButton({ initial, brands, className }: { initial?: string; brands: string[]; className?: string }) {
  const send = useServerFn(sendMissingReference);
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [brand, setBrand] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<'' | 'busy' | 'sent'>('');
  const [error, setError] = useState('');
  const start = () => { setReference(initial?.trim() ?? ''); setBrand(''); setNote(''); setState(''); setError(''); setOpen(true); };
  return <>
    <Button type="button" variant="outline" className={cn(big, className)} onClick={start}>➕ Je ne trouve pas un produit</Button>
    {open && <div className="fixed inset-0 z-[85] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label="Produit introuvable">
      <div className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-lg bg-card p-6 text-lg sm:p-8">
        {state === 'sent' ? <>
          <p className="text-2xl font-bold text-stock-ok">✓ Envoyé</p>
          <p className="mt-3">Le produit sera ajouté sur le site. Vous n’avez rien d’autre à faire.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button className={cn(big, 'bg-price-tool text-price-tool-foreground hover:bg-price-tool/90')} onClick={start}>En signaler un autre</Button>
            <Button variant="outline" className={big} onClick={() => setOpen(false)}>Fermer</Button>
          </div>
        </> : <form onSubmit={async e => {
          e.preventDefault(); setError(''); setState('busy');
          try { await send({ data: { reference, brand, note } }); setState('sent'); }
          catch (err) { setState(''); setError(err instanceof Error && err.message.length < 80 ? err.message : 'Pas envoyé. Réessayez.'); }
        }}>
          <h2 className="text-2xl font-bold">Produit introuvable</h2>
          <p className="mt-2 text-text-2">Écrivez la référence. Elle sera ajoutée sur le site.</p>
          <label className="mt-5 block font-bold">Référence
            <input autoFocus required value={reference} onChange={e => setReference(e.target.value)} placeholder="ex. RB34C600ES9" className={cn(field, 'font-bold uppercase')} />
          </label>
          <label className="mt-4 block font-bold">Marque
            <input list="missing-brands" value={brand} onChange={e => setBrand(e.target.value)} placeholder="ex. Samsung" className={field} />
            <datalist id="missing-brands">{brands.map(b => <option key={b} value={b} />)}</datalist>
          </label>
          <label className="mt-4 block font-bold">Note (pas obligatoire)
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="ex. frigo inox 2 portes" className={field} />
          </label>
          {error && <p role="alert" className="mt-3 font-bold text-destructive">{error}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button type="submit" disabled={state === 'busy' || reference.trim().length < 2} className={cn(big, 'bg-price-tool text-price-tool-foreground hover:bg-price-tool/90')}>{state === 'busy' ? 'Envoi…' : 'Envoyer'}</Button>
            <Button type="button" variant="outline" className={big} onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </form>}
      </div>
    </div>}
  </>;
}

type Missing = { id: string; reference: string; brand: string; note: string; by: string; at: string };

/** Admin: the references to add to the site, sent from Prix & stock. Hidden when there are none. */
export function MissingReferencesPanel() {
  const load = useServerFn(getMissingReferences);
  const done = useServerFn(doneMissingReference);
  const [rows, setRows] = useState<Missing[]>([]);
  const refresh = () => load().then(setRows).catch(() => setRows([]));
  useEffect(() => { void refresh(); }, []);
  if (!rows.length) return null;
  return <section className="mb-7 rounded-2xl border-2 border-price-tool bg-card p-5" aria-label="Références à ajouter">
    <h2 className="flex items-center gap-2 text-xl font-bold"><ClipboardList className="h-5 w-5" /> Références à ajouter ({rows.length})</h2>
    <p className="mt-1 text-sm text-text-2">Envoyées depuis « Prix & stock ». Touchez « Ajouté » quand le produit est sur le site.</p>
    <ul className="mt-4 divide-y divide-border">
      {rows.map(r => <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-lg font-bold">{r.brand && <span className="text-text-2">{r.brand} · </span>}{r.reference}</p>
          <p className="text-sm text-text-2">{r.note && <>{r.note} · </>}{new Date(r.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {r.by}</p>
        </div>
        <a href={`https://www.google.com/search?q=${encodeURIComponent(`${r.brand} ${r.reference}`.trim())}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-semibold hover:border-brand hover:text-brand"><Search className="h-4 w-4" /> Chercher</a>
        <button type="button" onClick={async () => { await done({ data: { id: r.id } }).catch(() => {}); void refresh(); }} className="inline-flex items-center gap-1.5 rounded-full bg-stock-ok px-3 py-2 text-sm font-semibold text-background"><Check className="h-4 w-4" /> Ajouté</button>
      </li>)}
    </ul>
  </section>;
}
