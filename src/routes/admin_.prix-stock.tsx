import { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link, useRouter, useBlocker } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Tag, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriceStockCard } from '@/components/admin/PriceStockCard';
import { downloadPriceBackup, getPriceStock, getPriceStockHistory, priceStockAccess, priceStockGoogleLogin, revertPriceStock, updatePriceStock } from '@/lib/price-stock.functions';
import { lovable } from '@/integrations/lovable';
import { supabase } from '@/integrations/supabase/client';
import { integerDH, AVAILABILITY_LABELS, type Availability, type PriceStockChange, type PriceStockProduct, type PriceStockState } from '@/lib/price-stock';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin_/prix-stock')({
  ssr: false,
  head: () => ({ meta: [
    { title: 'Prix & stock | Ghandi Home Electro' },
    { name: 'description', content: 'Espace privé de modification des prix, noms et disponibilités de Ghandi Home Electro.' },
    { property: 'og:title', content: 'Prix & stock | Ghandi Home Electro' },
    { property: 'og:description', content: 'Gestion privée des prix et disponibilités du magasin.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' },
  ] }), component: PriceStockPage,
});
type Data = Awaited<ReturnType<typeof getPriceStock>>;
type Speech = { lang: string; start: () => void; onresult: ((event: { results: { transcript: string }[][] }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
function PriceStockPage() {
  const access = useServerFn(priceStockAccess);
  const google = useServerFn(priceStockGoogleLogin);
  const load = useServerFn(getPriceStock);
  const save = useServerFn(updatePriceStock);
  const history = useServerFn(getPriceStockHistory);
  const revert = useServerFn(revertPriceStock);
  const backup = useServerFn(downloadPriceBackup);
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [products, setProducts] = useState<PriceStockProduct[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'todo'|'all'|'in_stock'|'out_of_stock'|'on_request'>('todo');
  const [node, setNode] = useState('');
  const [brand, setBrand] = useState('');
  const [mode, setMode] = useState<'one'|'list'>('list');
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [help, setHelp] = useState<number | null>(null);
  const [changes, setChanges] = useState<PriceStockChange[] | null>(null);
  const [undo, setUndo] = useState<{ id: string; before: PriceStockState; after: PriceStockState; reference: string } | null>(null);
  const [voice, setVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const sentinel = useRef<HTMLDivElement>(null);
  const commits = useRef(new Map<string, () => Promise<boolean>>());
  const doneToday = useRef(new Set<string>());
  const generation = useRef(0);
  const loadBusy = useRef(false);
  useEffect(() => {
    void (async () => {
      let result = await access();
      if (!result.allowed) {
        const { data: session } = await supabase.auth.getSession();
        if (session.session?.access_token) {
          await google({ data: { accessToken: session.session.access_token } });
          result = await access();
        }
      }
      setAllowed(result.allowed); setEmail(result.email);
      if (result.allowed) {
        const stored = localStorage.getItem(`ghe-price-mode:${result.email}`);
        setMode(stored === 'one' || stored === 'list' ? stored : window.matchMedia('(max-width:767px)').matches ? 'one' : 'list');
        if (!localStorage.getItem(`ghe-price-help:${result.email}`)) setHelp(0);
      }
    })().catch(() => { setAllowed(false); setError('Connexion impossible. Réessayez.'); });
    const w = window as unknown as { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech };
    setVoice(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  const hasDrafts = () => Object.keys(localStorage).some(k => k.startsWith(`ghe-price-draft:${email}:`));
  useBlocker({ shouldBlockFn: () => allowed === true && hasDrafts() && !window.confirm('Des modifications ne sont pas enregistrées. Elles restent gardées ici. Quitter ?'), enableBeforeUnload:false });
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => { if (hasDrafts()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [email]);
  const fetchRows = async (append = false) => {
    if (loadBusy.current && append) return;
    const token = append ? generation.current : ++generation.current;
    loadBusy.current = true; setBusy(true); setError('');
    try {
      const result = await load({ data: { q: query, filter, node: node || undefined, brand: brand || undefined, offset: append ? products.length : 0 } });
      if (token !== generation.current) return;
      setData(result); setProducts(p => append ? [...p, ...result.products.filter(r => !p.some(x => x.id === r.id))] : result.products); if (!append) setIndex(0);
    } catch (e) { setError(e instanceof Error ? e.message : 'Chargement impossible.'); }
    finally { if (token === generation.current) { setBusy(false); loadBusy.current = false; } }
  };
  useEffect(() => {
    if (!allowed) return;
    const timer = window.setTimeout(() => void fetchRows(), 350);
    return () => window.clearTimeout(timer);
  }, [allowed, query, filter, node, brand]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !data || mode !== 'list') return;
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting && products.length < data.total && !loadBusy.current) void fetchRows(true); });
    observer.observe(el); return () => observer.disconnect();
  }, [products.length, data?.total, mode]);
  useEffect(() => { if (!undo) return; const timer = setTimeout(() => setUndo(null), 10000); return () => clearTimeout(timer); }, [undo]);
  const onSaved = (id: string, state: PriceStockState, before?: PriceStockState) => {
    setProducts(p => p.map(x => x.id === id ? { ...x, ...state } : x));
    if (before) {
      const p = products.find(x => x.id === id);
      setUndo({ id, before, after: state, reference: p?.model || p?.serial_number || state.name });
      const newlyDone=!doneToday.current.has(id); doneToday.current.add(id);
      setData(d => d ? {...d,remaining:Math.max(0,d.remaining+(before.price?0:-1)+(state.price?0:1)),today:d.today+(newlyDone?1:0)} : d);
    }
    void router.invalidate();
  };
  const safeChange = (action: () => void) => { if (!hasDrafts() || window.confirm('Une modification n’est pas enregistrée. Elle restera gardée ici. Continuer ?')) action(); };
  const next = (id: string) => {
    if (mode === 'one') { if (index + 1 < products.length) setIndex(index + 1); else if (data && products.length < data.total) void fetchRows(true).then(() => setIndex(index + 1)); }
    else { const at = products.findIndex(p => p.id === id); const following = products[at+1]; if (following) { inputs.current.get(following.id)?.focus(); inputs.current.get(following.id)?.select(); } else if (data && products.length < data.total) void fetchRows(true); }
  };
  const download = async () => {
    try { const result = await backup(); const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'anciens-prix-ghandi-2026-10-23.csv'; a.click(); URL.revokeObjectURL(url); } catch { setError('Téléchargement impossible. Réessayez.'); }
  };
  const btn = 'min-h-14 h-auto whitespace-normal px-5 py-3 text-lg font-bold';
  if (allowed === null) return <main className="p-10 text-xl">Connexion…</main>;
  if (!allowed) return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6 text-xl">
    <h1 className="text-3xl font-bold">Prix & stock</h1><p>Connectez-vous avec le compte Google autorisé par le magasin.</p>
    <Button className={cn(btn,'bg-price-tool text-price-tool-foreground hover:bg-price-tool/90')} onClick={async () => { setError(''); try { await lovable.auth.signInWithOAuth('google',{ redirect_uri: `${window.location.origin}/admin/prix-stock` }); const { data: session } = await supabase.auth.getSession(); if (session.session?.access_token) { await google({ data: { accessToken: session.session.access_token } }); const result = await access(); setAllowed(result.allowed); setEmail(result.email); if (!result.allowed) setError('Ce compte n’est pas autorisé.'); } } catch { setError('Connexion impossible. Réessayez.'); } }}>Continuer avec Google</Button>
    {error && <p role="alert" className="text-destructive">{error}</p>}<Link to="/" className="underline">Retour au magasin</Link>
  </main>;
  const shown = mode === 'one' ? products.slice(index,index+1) : products;
  return <main className="mx-auto max-w-5xl px-4 py-7 pb-36 text-lg sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="flex items-center gap-3 text-3xl font-bold"><Tag /> Prix & stock</h1>
      <div className="flex flex-wrap gap-3"><Button variant="outline" className={btn} onClick={() => setHelp(0)}>? Aide</Button><Button variant="outline" className={btn} onClick={async () => { try { setChanges(await history()); } catch { setError('Historique indisponible.'); } }}>Mes dernières modifications</Button></div>
    </header>
    <nav className="mt-4 flex flex-wrap gap-4"><Link to="/admin" onClick={e => { if (hasDrafts() && !window.confirm('Des modifications ne sont pas enregistrées. Elles restent gardées ici. Quitter ?')) e.preventDefault(); }} className="flex min-h-14 items-center font-bold underline">Administration</Link><Button variant="link" className={btn} onClick={() => void download()}>Sauvegarde des anciens prix</Button></nav>
    <form className="mt-6 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); safeChange(() => void fetchRows()); }}>
      <input aria-label="Chercher un produit (nom, marque ou référence)" placeholder="Chercher un produit (nom, marque ou référence)" value={query} onChange={e => setQuery(e.target.value)} className="min-h-16 min-w-0 flex-1 rounded-md border-2 border-input bg-background p-4 text-xl" />
      {voice && <Button type="button" variant="outline" className={btn} onClick={() => {
        const w = window as unknown as { SpeechRecognition?: new () => Speech; webkitSpeechRecognition?: new () => Speech }; const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition; if (!Ctor) return;
        const speech = new Ctor(); speech.lang='fr-FR'; speech.onresult=e => { setQuery(e.results[0]?.[0]?.transcript ?? ''); }; speech.onend=() => setListening(false); speech.onerror=() => { setListening(false); setError('Le microphone n’est pas disponible. Tapez votre recherche.'); }; setListening(true); speech.start();
      }}><Mic /> {listening ? 'J’écoute…' : 'Parler'}</Button>}
    </form>
    <div className="mt-5 flex flex-wrap gap-3">{([['todo','À faire (sans prix)'],['all','Tous'],['in_stock','En stock'],['out_of_stock','Rupture'],['on_request','Sur demande']] as const).map(([v,label]) => <Button key={v} variant="outline" className={cn(btn,filter===v && 'border-price-tool bg-price-tool text-price-tool-foreground')} aria-pressed={filter===v} onClick={() => safeChange(() => setFilter(v))}>{label}</Button>)}</div>
    {data && <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button variant="outline" className={cn(btn,!node && 'bg-price-tool text-price-tool-foreground')} onClick={() => safeChange(() => setNode(''))}>Toutes les catégories</Button>
      {data.nodes.filter(n => n.level <= 2).map(n => <Button key={n.id} variant="outline" className={cn(btn,node===n.id && 'bg-price-tool text-price-tool-foreground')} onClick={() => safeChange(() => setNode(n.id))}>{n.name}</Button>)}
      <label className="flex items-center gap-3 font-bold">Marque <select aria-label="Marque" value={brand} onChange={e => safeChange(() => setBrand(e.target.value))} className="min-h-14 max-w-full rounded-md border-2 border-input bg-background px-4 text-lg"><option value="">Toutes</option>{data.brands.map(b => <option key={b}>{b}</option>)}</select></label>
    </div>}
    <p className="mt-6 font-bold" aria-live="polite">{data ? `Il reste ${data.remaining} produits sans prix · ${data.today} faits aujourd’hui 👍` : 'Chargement des produits…'}</p>
    <div className="mt-4 flex flex-wrap gap-3">{([['one','Un par un'],['list','Liste']] as const).map(([v,label]) => <Button key={v} variant="outline" className={cn(btn,mode===v && 'bg-price-tool text-price-tool-foreground')} aria-pressed={mode===v} onClick={() => safeChange(() => { setMode(v); localStorage.setItem(`ghe-price-mode:${email}`,v); })}>{label}</Button>)}
      <Button variant="outline" className={btn} onClick={() => safeChange(() => void fetchRows())}>Actualiser</Button>
    </div>
    {error && <p role="alert" className="mt-4 font-bold text-destructive">{error} <Button variant="outline" className={btn} onClick={() => void fetchRows()}>Réessayer</Button></p>}
    <div className="mt-6 space-y-5">{shown.map(p => <PriceStockCard key={p.id} product={p} email={email} category={data?.nodes.find(n => n.id===p.node_id)?.name ?? ''} save={input => save({data:input})} onSaved={onSaved} next={() => next(p.id)} register={el => { if (el) inputs.current.set(p.id,el); else inputs.current.delete(p.id); }} registerCommit={fn=>{if(fn) commits.current.set(p.id,fn); else commits.current.delete(p.id);}} />)}</div>
    {!busy && !products.length && <p className="py-12 text-xl">Aucun produit dans cette sélection.</p>}
    {mode==='one' && products[index] && <div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline" disabled={index===0} className={btn} onClick={() => safeChange(() => setIndex(Math.max(0,index-1)))}>‹ Précédent</Button><Button className={cn(btn,'bg-price-tool text-price-tool-foreground hover:bg-price-tool/90')} disabled={index+1>=products.length && products.length>=(data?.total ?? 0)} onClick={() => { void commits.current.get(products[index]?.id ?? '')?.(); }}>Suivant ›</Button></div>}
    <div ref={sentinel} className="mt-5">{busy && <p>Chargement…</p>}{!busy && data && products.length<data.total && <Button variant="outline" className={btn} onClick={() => void fetchRows(true)}>Afficher 30 produits de plus</Button>}</div>
    {undo && <aside className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-price-tool bg-card p-4" aria-live="polite"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3"><p className="text-lg font-bold">{undo.before.price !== undo.after.price ? `Prix de ${undo.reference} changé : ${integerDH(undo.before.price)} → ${integerDH(undo.after.price)}` : `${undo.reference} : modification enregistrée`}</p><Button variant="outline" className={btn} onClick={async () => { try { const patch: Record<string,unknown>={}; for (const k of ['name','price','stock','availability'] as const) if (undo.before[k]!==undo.after[k]) patch[k]=undo.before[k]; const r=await save({ data:{ id:undo.id, expected:undo.after.updated_at, operation:crypto.randomUUID(), patch, confirmed:true } }); if (!r.confirmation) { onSaved(undo.id,r.state); setUndo(null); } } catch (e) { setError(e instanceof Error ? e.message : 'Annulation impossible.'); } }}>Annuler</Button></div></aside>}
    {help!==null && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label="Aide Prix et stock"><div className="w-full max-w-xl rounded-lg bg-card p-8"><p className="text-lg font-bold text-text-2">{help+1} sur 3</p><p className="mt-4 text-2xl font-bold">{['Cherchez le produit ici, ou touchez une catégorie.','Tapez le prix et appuyez sur Entrée. C’est enregistré tout seul.','Touchez En stock, Rupture ou Sur demande. Pour En stock, mettez le nombre avec − et +.'][help]}</p><Button autoFocus className={cn(btn,'mt-7 w-full bg-price-tool text-price-tool-foreground hover:bg-price-tool/90')} onClick={() => { if (help===2) { localStorage.setItem(`ghe-price-help:${email}`,'1'); setHelp(null); } else setHelp(help+1); }}>Compris</Button></div></div>}
    {changes && <div className="fixed inset-0 z-[75] flex items-center justify-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-label="Mes dernières modifications"><div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-card p-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-2xl font-bold">Mes dernières modifications</h2><Button variant="outline" className={btn} onClick={() => setChanges(null)}>Fermer</Button></div><div className="mt-4 space-y-4 overflow-y-auto">{!changes.length && <p>Aucune modification.</p>}{changes.map(c => <div key={c.id} className="flex flex-wrap items-center gap-4 border-t border-border pt-4">{c.image_url && <img src={c.image_url} alt="" className="h-20 w-20 object-contain" />}<div className="min-w-0 flex-1"><p className="break-words text-xl font-bold">{c.reference}</p><p>{({ price:'Prix',name:'Nom',stock:'Quantité',availability:'Disponibilité' } as Record<string,string>)[c.champ]} : {c.champ==='price' ? `${integerDH(Number(c.ancienne_valeur))} → ${integerDH(Number(c.nouvelle_valeur))}` : `${c.ancienne_valeur} → ${c.nouvelle_valeur}`}</p><p className="break-all text-lg text-text-2">{new Date(c.created_at).toLocaleString('fr-FR',{timeZone:'Africa/Casablanca'})} · {c.admin_email}</p></div><Button variant="outline" className={btn} disabled={!c.product_id} onClick={async () => { try { await revert({data:{id:c.id,operation:crypto.randomUUID()}}); setChanges(await history()); await fetchRows(); void router.invalidate(); } catch (e) { setError(e instanceof Error ? e.message : 'Annulation impossible.'); setChanges(null); } }}>Remettre comme avant</Button></div>)}</div></div></div>}
  </main>;
}