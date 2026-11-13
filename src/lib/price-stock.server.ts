import { getRequestHeader } from '@tanstack/react-start/server';
import { currentAdmin } from './admin.server';
import { signImagePaths } from './catalog.server';
import { needsPriceConfirmation, searchKey, type PriceStockSave, type PriceStockProduct, type PriceStockChange, type PriceStockState } from './price-stock';
import type { Json } from '@/integrations/supabase/types';

/** Name used in the history for changes made from the shop's allowed Wi-Fi. */
export const WIFI_NAME = 'Wi-Fi du magasin';

/** The visitor's address as Cloudflare saw it (a visitor cannot fake this header). */
export function visitorIp() {
  return (getRequestHeader('cf-connecting-ip') ?? '').trim();
}

/** Re-read the Google allow-list every time, including for old admin cookies.
 *  Without a Google admin, a Wi-Fi allowed in Admin (row "wifi:<address>") opens Prix & stock only. */
export async function priceStockAdmin() {
  const me = await currentAdmin();
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  if (me && me.username.includes('@')) {
    const { data, error } = await db.from('admin_emails').select('email,role').ilike('email', me.username).maybeSingle();
    if (!error && data && ['super', 'staff'].includes(data.role)) return { db, email: data.email, role: data.role };
  }
  const ip = visitorIp();
  if (ip) {
    const { data } = await db.from('admin_emails').select('id').eq('email', `wifi:${ip}`).maybeSingle();
    if (data) return { db, email: WIFI_NAME, role: 'staff' };
  }
  throw new Error('UNAUTHORIZED');
}

/* ---------- "Je ne trouve pas un produit": notes for the owner ---------- */
const MISSING_SUBJECT = 'Référence à ajouter';
export async function reportMissing(input: { reference: string; brand: string; note: string }) {
  const { db, email } = await priceStockAdmin();
  const reference = input.reference.trim();
  if (reference.length < 2) throw new Error('Tapez la référence.');
  const message = [`Référence : ${reference}`, input.brand.trim() && `Marque : ${input.brand.trim()}`, input.note.trim() && `Note : ${input.note.trim()}`].filter(Boolean).join('\n');
  const { error } = await db.from('contact_messages').insert({ name: email, email: email.includes('@') ? email : '', phone: '', subject: MISSING_SUBJECT, message });
  if (error) throw new Error('Pas envoyé. Réessayez.');
  return { ok: true };
}
function parseMissing(row: { id: string; message: string; name: string; created_at: string; read: boolean }) {
  const get = (k: string) => (row.message.match(new RegExp(`^${k} : (.*)$`, 'm')) ?? [])[1] ?? '';
  return { id: row.id, reference: get('Référence'), brand: get('Marque'), note: get('Note'), by: row.name, at: row.created_at, done: row.read };
}
/** Notes still to do (any admin, or the shop Wi-Fi to see what was already sent). */
export async function listMissing() {
  const { db } = await priceStockAdmin().catch(async () => {
    const me = await currentAdmin();
    if (!me) throw new Error('UNAUTHORIZED');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    return { db: supabaseAdmin };
  });
  const r = await db.from('contact_messages').select('id,message,name,created_at,read').eq('subject', MISSING_SUBJECT).eq('read', false).order('created_at', { ascending: false }).limit(200);
  if (r.error) throw new Error('Impossible de charger les références.');
  return r.data.map(parseMissing);
}
export async function finishMissing(id: string) {
  const me = await currentAdmin();
  if (!me) throw new Error('UNAUTHORIZED');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { error } = await db.from('contact_messages').update({ read: true }).eq('id', id).eq('subject', MISSING_SUBJECT);
  if (error) throw new Error(error.message);
  return { ok: true };
}
export async function listPriceStock(input: { q?: string | undefined; filter?: string | undefined; node?: string | undefined; brand?: string | undefined; offset?: number | undefined }) {
  const { db, email } = await priceStockAdmin();
  const nodes = await db.from('catalog_nodes').select('id,name,parent_id,level').order('sort_order');
  const links = await db.from('product_nodes').select('product_id,node_id');
  if (nodes.error || links.error) throw new Error('Impossible de charger les catégories.');
  const all: PriceStockProduct[] = [];
  // Narrow columns only; never pull descriptions/galleries for this editor.
  for (let offset = 0; ; offset += 1000) {
    const r = await db.from('products').select('id,name,brand,model,serial_number,node_id,image_url,price,stock,availability,updated_at').order('id').range(offset, offset + 999);
    if (r.error) throw new Error('Impossible de charger les produits.');
    all.push(...r.data.map(p => ({ ...p, availability: p.availability as PriceStockProduct['availability'], price: p.price === null ? null : Number(p.price) })));
    if (r.data.length < 1000) break;
  }
  const descendants = new Set<string>(input.node ? [input.node] : []);
  let more = true;
  while (more) { more = false; for (const n of nodes.data) if (n.parent_id && descendants.has(n.parent_id) && !descendants.has(n.id)) { descendants.add(n.id); more = true; } }
  const linkedIds = new Set(links.data.filter(l => descendants.has(l.node_id)).map(l => l.product_id));
  const key = searchKey(input.q ?? '');
  const filtered = all.filter(p => (!key || searchKey(`${p.name} ${p.brand} ${p.model ?? ''} ${p.serial_number}`).includes(key)) && (!input.brand || p.brand === input.brand) && (!input.node || descendants.has(p.node_id) || linkedIds.has(p.id)) && (input.filter === 'all' || !input.filter || (input.filter === 'todo' ? !p.price : p.availability === input.filter)));
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const rows = filtered.slice(offset, offset + 30);
  const paths = rows.map(p => p.image_url).filter((s): s is string => Boolean(s) && !s?.startsWith('http'));
  const signed = await signImagePaths(paths);
  const midnight = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Casablanca' });
  const history = await db.from('product_changes').select('product_id').eq('admin_email', email).gte('created_at', `${midnight}T00:00:00Z`);
  if (history.error) throw new Error('Impossible de charger le compteur.');
  return { email, products: rows.map(p => ({ ...p, image_url: p.image_url?.startsWith('http') ? p.image_url : signed[p.image_url ?? ''] ?? null })), total: filtered.length, remaining: all.filter(p => !p.price).length, today: new Set(history.data.map(h => h.product_id)).size, nodes: nodes.data, brands: [...new Set(all.map(p => p.brand).filter(Boolean))].sort() };
}
export async function savePriceStock(input: PriceStockSave) {
  const { db, email } = await priceStockAdmin();
  const patch = { ...input.patch };
  if (patch.name !== undefined) { patch.name = patch.name.trim(); if ((patch.name.match(/\p{L}/gu) ?? []).length < 3) throw new Error('Le nom ne peut pas être vide'); }
  if (patch.price !== undefined && patch.price !== null && (!Number.isSafeInteger(patch.price) || patch.price < 0)) throw new Error('Tapez un prix entier positif.');
  if (patch.availability && !['in_stock','out_of_stock','on_request'].includes(patch.availability)) throw new Error('Disponibilité invalide.');
  if (patch.stock !== undefined && (!Number.isSafeInteger(patch.stock) || patch.stock < 0)) throw new Error('Quantité invalide.');
  const r = await db.from('products').select('price').eq('id', input.id).single();
  if (r.error) throw new Error('Produit introuvable.');
  if (patch.price !== undefined && patch.price !== null && needsPriceConfirmation(r.data.price, patch.price) && !input.confirmed) return { confirmation: true as const };
  const { data, error } = await db.rpc('save_product_price_stock', { _id: input.id, _patch: patch as Json, _expected: input.expected, _email: email, _operation: input.operation });
  if (error) throw new Error(error.message);
  const saved = data as unknown as { state?: PriceStockState; before?: PriceStockState; conflict?: unknown; error?: unknown };
  // Never say "Enregistré" unless the database really holds the new values.
  const check = await db.from('products').select('name,price,stock,availability,updated_at').eq('id', input.id).single();
  if (check.error) throw new Error('Vérification impossible. Réessayez.');
  const wrong = (Object.keys(patch) as (keyof typeof patch)[]).filter(k => (k === 'price' ? Number(check.data.price ?? 0) !== Number(patch.price ?? 0) : check.data[k] !== patch[k]));
  if (wrong.length) {
    console.error('price-stock save not applied', { id: input.id, wrong, reply: saved });
    throw new Error(saved?.conflict ? 'Ce produit a été modifié ailleurs. Touchez « Actualiser » puis recommencez.' : 'Le site n’a pas gardé la modification. Réessayez.');
  }
  return { confirmation: false as const, state: { ...(saved?.state ?? {}), ...check.data, price: check.data.price === null ? null : Number(check.data.price) } as PriceStockState, ...(saved?.before ? { before: saved.before } : {}) };
}
export async function historyPriceStock() {
  const { db } = await priceStockAdmin();
  const r = await db.from('product_changes').select('*').order('created_at', { ascending: false }).limit(50);
  if (r.error) throw new Error('Impossible de charger les modifications.');
  const paths = r.data.map(p => p.image_url).filter((s): s is string => Boolean(s) && !s?.startsWith('http'));
  const signed = await signImagePaths(paths);
  return r.data.map(p => ({ ...p, image_url: p.image_url?.startsWith('http') ? p.image_url : signed[p.image_url ?? ''] ?? null })) as unknown as PriceStockChange[];
}
export async function undoPriceStock(id: string, operation: string) {
  const { db } = await priceStockAdmin();
  const r = await db.from('product_changes').select('*').eq('id', id).single();
  if (r.error || !r.data.product_id) throw new Error('Ce produit n’existe plus.');
  const field = r.data.champ;
  if (!['name','price','stock','availability'].includes(field)) throw new Error('Modification invalide.');
  const current = await db.from('products').select('name,price,stock,availability,updated_at').eq('id', r.data.product_id).single();
  if (current.error) throw new Error('Produit introuvable.');
  const after = r.data.after_state as unknown as PriceStockState;
  const before = r.data.before_state as unknown as PriceStockState;
  const fields = field === 'stock' || field === 'availability' ? ['stock','availability'] as const : [field as 'name' | 'price'];
  if (fields.some(k => current.data[k] !== after[k])) throw new Error('Ce produit a été modifié depuis. Il ne sera pas écrasé.');
  return savePriceStock({ id: r.data.product_id, operation, expected: current.data.updated_at, patch: Object.fromEntries(fields.map(k => [k, before[k]])), confirmed: true });
}
export async function priceBackup() {
  const { db } = await priceStockAdmin();
  const r = await db.from('product_price_backups').select('rows,created_at').order('created_at', { ascending: true }).limit(1).single();
  if (r.error) throw new Error('Sauvegarde introuvable.');
  const rows = r.data.rows as unknown as { id: string; reference: string; name: string; price: number | null; stock: number }[];
  const cell = (s: unknown) => { const v = String(s ?? ''); return `"${(/^[=+@\-]/.test(v) ? "'" : '') + v.replace(/"/g, '""')}"`; };
  return { csv: '\uFEFFid;référence;nom;prix actuel;stock\r\n' + rows.map(p => [p.id,p.reference,p.name,p.price,p.stock].map(cell).join(';')).join('\r\n'), count: rows.length };
}