import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { integerDH, type Availability, type PriceStockProduct, type PriceStockSave, type PriceStockState } from '@/lib/price-stock';
import { cn } from '@/lib/utils';

export type SavedPriceStock = { confirmation: true } | { confirmation: false; state: PriceStockState; before?: PriceStockState };
export function PriceStockCard({ product, category, email, save, onSaved, next, register, registerCommit }: {
  product: PriceStockProduct; category: string; email: string;
  save: (input: PriceStockSave) => Promise<SavedPriceStock>;
  onSaved: (id: string, state: PriceStockState, before?: PriceStockState) => void;
  next: () => void; register: (el: HTMLInputElement | null) => void;
  registerCommit: (fn: (() => Promise<boolean>) | null) => void;
}) {
  const key = `ghe-price-draft:${email}:${product.id}`;
  const [draft, setDraft] = useState(product);
  const draftRef = useRef(product);
  const current = useRef(product);
  const originalName = useRef(product.name);
  const originalPrice = useRef(product.price);
  const advance = useRef(false);
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<PriceStockSave | null>(null);
  const [priceError, setPriceError] = useState('');
  const [leaveName, setLeaveName] = useState(false);
  const running = useRef(false);
  const queued = useRef(false);
  const pending = useRef<PriceStockSave | null>(null);
  const mounted = useRef(true);
  const reference = product.model || product.serial_number;
  const persist = (value: PriceStockProduct) => {
    draftRef.current = value; setDraft(value); setDirty(true); setStatus('À enregistrer');
    try { localStorage.setItem(key, JSON.stringify({ draft: value, base: current.current, pending: pending.current })); window.dispatchEvent(new Event('price-drafts')); }
    catch { setStatus('Le navigateur ne peut pas garder cette modification. Ne fermez pas cette page.'); }
  };
  useEffect(() => {
    mounted.current = true;
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (stored?.draft?.id === product.id) {
        draftRef.current = stored.draft; setDraft(stored.draft); current.current = stored.base ?? product;
        pending.current = stored.pending; setDirty(true); setStatus('✗ Pas enregistré');
      }
    } catch { /* Invalid stored draft is not applied. */ }
    return () => { mounted.current = false; };
  }, [key, product.id]);
  useEffect(() => {
    if (dirty || pending.current) return;
    current.current = product; draftRef.current = product; setDraft(product);
  }, [product.updated_at]);

  const commit = async (goNext = false, approved?: PriceStockSave): Promise<boolean> => {
    if (running.current) { queued.current = true; if(goNext) advance.current=true; return false; }
    if (goNext) advance.current=true;
    const d = draftRef.current;
    if ((d.name.trim().match(/\p{L}/gu) ?? []).length < 3) { setLeaveName(true); setStatus('Le nom ne peut pas être vide'); return false; }
    if (priceError) return false;
    const patch: PriceStockSave['patch'] = {};
    for (const field of ['name','price','stock','availability'] as const) {
      if (d[field] !== current.current[field]) Object.assign(patch, { [field]: d[field] });
    }
    if (!Object.keys(patch).length && !pending.current) { setDirty(false); localStorage.removeItem(key); if (goNext) next(); return true; }
    const request = approved ?? pending.current ?? { id: product.id, patch, expected: current.current.updated_at, operation: crypto.randomUUID() };
    pending.current = request;
    try { localStorage.setItem(key, JSON.stringify({ draft: d, base: current.current, pending: request })); }
    catch { setStatus('✗ Pas enregistré · Le navigateur ne peut pas garder la modification.'); return false; }
    running.current = true; setStatus('Enregistrement…');
    try {
      const result = await save(request);
      if (result.confirmation) { setConfirm(request); setStatus('Confirmez le prix'); return false; }
      pending.current = null;
      const before = result.before ?? current.current;
      const newest = draftRef.current;
      const changedDuringSave = newest !== d;
      current.current = { ...current.current, ...result.state };
      onSaved(product.id, result.state, before);
      if (changedDuringSave) {
        const merged = { ...newest, updated_at: result.state.updated_at };
        for (const field of ['name','price','stock','availability'] as const) if (newest[field] === d[field]) Object.assign(merged, { [field]: result.state[field] });
        persist(merged); queued.current = true;
      } else {
        draftRef.current = { ...d, ...result.state };
        if (mounted.current) { setDraft(draftRef.current); setDirty(false); setStatus('✓ Enregistré'); }
        localStorage.removeItem(key); window.dispatchEvent(new Event('price-drafts'));
      }
      if (advance.current && !changedDuringSave) { advance.current=false; next(); }
      return true;
    } catch (e) { setStatus(`✗ Pas enregistré${e instanceof Error ? ` · ${e.message}` : ''}`); return false; }
    finally {
      running.current = false;
      if (queued.current) { queued.current = false; void commit(); }
    }
  };
  useEffect(() => { registerCommit(() => commit(true)); return () => registerCommit(null); });
  const availability = (value: Availability) => {
    pending.current = null;
    persist({ ...draftRef.current, availability: value, stock: value === 'in_stock' ? Math.max(1, draftRef.current.stock) : 0 });
    void commit();
  };
  const quantity = (value: number, auto: boolean) => {
    const stock = Math.max(1, Math.floor(value) || 1);
    pending.current = null; persist({ ...draftRef.current, stock });
    if (auto) void commit();
  };
  useEffect(() => {
    const online = () => { if (localStorage.getItem(key)) void commit(); };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  });
  return (
    <article className="rounded-lg border-2 border-border bg-card p-5 sm:p-7" aria-label={reference || product.name}>
      <div className="grid items-start gap-6 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex aspect-square w-full max-w-60 items-center justify-center justify-self-center bg-background">
          {product.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" className="h-full w-full object-contain" /> : <span className="text-text-2">Sans photo</span>}
        </div>
        <div className="min-w-0">
          <p className="font-bold">{product.brand}</p>
          <p className="mt-1 break-words text-2xl font-bold">{reference || 'Sans référence'}</p>
          <p className="mt-2 text-lg text-text-2">{category}</p>
          <label className="mt-5 block font-bold">Nom du produit
            <textarea rows={2} aria-label={`Nom ${reference}`} value={draft.name} className="mt-2 w-full rounded-md border-2 border-input bg-background p-3 text-xl"
              onChange={e => { pending.current = null; persist({ ...draftRef.current, name: e.target.value }); setLeaveName(false); }}
              onBlur={() => void commit()} />
          </label>
          {(draft.name !== originalName.current || leaveName) && <Button variant="link" className="h-14 text-lg" onClick={() => { pending.current = null; persist({ ...draftRef.current, name: originalName.current }); setLeaveName(false); void commit(); }}>Remettre le nom d’avant</Button>}
          {leaveName && <p role="alert" className="text-lg font-bold text-destructive">Le nom ne peut pas être vide</p>}
          <label className="mt-4 block font-bold">Prix
            <div className="mt-2 flex items-center rounded-md border-2 border-input bg-background focus-within:border-brand">
              <input ref={register} aria-label={`Prix ${reference}`} inputMode="numeric" value={draft.price ? Math.round(draft.price).toLocaleString('fr-FR') : ''} placeholder="Sans prix"
                className="min-w-0 flex-1 bg-transparent p-4 text-[28px] font-bold outline-none"
                onChange={e => { const v = e.target.value.replace(/\s/g,''); if (!/^\d*$/.test(v)) { setPriceError('Tapez seulement des chiffres entiers.'); return; } setPriceError(''); pending.current = null; persist({ ...draftRef.current, price: Number(v) }); }}
                onBlur={() => void commit()} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void commit(true); } }} />
              <span className="pe-4 text-[28px] font-bold">DH</span>
            </div>
          </label>
          {priceError && <p role="alert" className="mt-2 text-destructive">{priceError}</p>}
          <p className="mt-2 text-text-2">{originalPrice.current ? `Ancien prix : ${integerDH(originalPrice.current)}` : 'Pas encore de prix'}</p>
        </div>
      </div>
      <fieldset className="mt-6"><legend className="mb-3 font-bold">Disponibilité</legend>
        <div className="grid gap-3 lg:grid-cols-3">
          {([['in_stock','✅ En stock'],['out_of_stock','⛔ Rupture de stock'],['on_request','📞 Sur demande (WhatsApp)']] as const).map(([v,label]) => <Button key={v} variant="outline" aria-pressed={draft.availability === v} onClick={() => availability(v)} className={cn('min-h-14 h-auto whitespace-normal px-4 py-3 text-lg font-bold', draft.availability === v && (v === 'in_stock' ? 'border-stock-ok bg-stock-ok text-background' : v === 'on_request' ? 'border-whatsapp bg-whatsapp text-background' : 'border-foreground bg-muted text-foreground'))}>{label}</Button>)}
        </div>
        {draft.availability === 'in_stock' && <label className="mt-4 flex flex-wrap items-center gap-3 font-bold">Combien ?
          <Button variant="outline" className="h-14 text-xl" onClick={() => quantity(draftRef.current.stock - 1, true)}>− Moins</Button>
          <input aria-label={`Quantité ${reference}`} inputMode="numeric" className="h-14 w-24 rounded-md border-2 border-input text-center text-[28px]" value={draft.stock} onChange={e => quantity(Number(e.target.value.replace(/\D/g,'')), false)} onBlur={() => void commit()} onKeyDown={e => { if (e.key === 'Enter') void commit(); }} />
          <Button variant="outline" className="h-14 text-xl" onClick={() => quantity(draftRef.current.stock + 1, true)}>+ Plus</Button>
        </label>}
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center gap-3" aria-live="polite">
        <p className={cn('text-lg font-bold', status.startsWith('✓') ? 'text-stock-ok' : status.startsWith('✗') || leaveName ? 'text-destructive' : 'text-text-2')}>{status || 'Aucune modification'}</p>
        {dirty && status.startsWith('✗') && <Button variant="outline" className="h-14 text-lg" onClick={() => void commit()}>Réessayer</Button>}
      </div>
      {confirm && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label="Confirmer le prix">
        <div className="w-full max-w-xl rounded-lg bg-card p-7 text-xl">
          <h2 className="text-2xl font-bold">Vous avez tapé {integerDH(confirm.patch.price ?? 0)}. C’est bien ça ?</h2>
          <div className="mt-6 grid gap-3">
            <Button autoFocus className="h-14 bg-price-tool text-xl text-price-tool-foreground hover:bg-price-tool/90" onClick={() => { const r = { ...confirm, confirmed: true }; setConfirm(null); void commit(false, r); }}>Oui, c’est correct</Button>
            <Button variant="outline" className="h-14 text-xl" onClick={() => { pending.current = null; setConfirm(null); setStatus('Corrigez le prix'); }}>Non, corriger</Button>
          </div>
        </div>
      </div>}
    </article>
  );
}