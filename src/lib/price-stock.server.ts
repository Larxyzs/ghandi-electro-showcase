import { currentAdmin } from './admin.server';
import { signImagePaths } from './catalog.server';
import { needsPriceConfirmation, searchKey, type PriceStockSave, type PriceStockProduct, type PriceStockChange, type PriceStockState } from './price-stock';
import type { Json } from '@/integrations/supabase/types';

/** Re-read the Google allow-list every time, including for old admin cookies. */
export async function priceStockAdmin() {
  const me = await currentAdmin();
  if (!me || !me.username.includes('@')) throw new Error('UNAUTHORIZED');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { data, error } = await db.from('admin_emails').select('email,role').ilike('email', me.username).maybeSingle();
  if (error || !data || !['super', 'staff'].includes(data.role)) throw new Error('UNAUTHORIZED');
  return { db, email: data.email, role: data.role };
}
export async function listPriceStock(input: { q?: string; filter?: string; node?: string; brand?: string; offset?: number }) {
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
  if (patch.price !== undefined && (patch.price === null || !Number.isSafeInteger(patch.price) || patch.price < 0)) throw new Error('Tapez un prix entier positif.');
  if (patch.availability && !['in_stock','out_of_stock','on_request'].includes(patch.availability)) throw new Error('Disponibilité invalide.');
  if (patch.stock !== undefined && (!Number.isSafeInteger(patch.stock) || patch.stock < 0)) throw new Error('Quantité invalide.');
  const r = await db.from('products').select('price').eq('id', input.id).single();
  if (r.error) throw new Error('Produit introuvable.');
  if (patch.price !== undefined && needsPriceConfirmation(r.data.price, patch.price) && !input.confirmed) return { confirmation: true as const };
  const { data, error } = await db.rpc('save_product_price_stock', { _id: input.id, _patch: patch as Json, _expected: input.expected, _email: email, _operation: input.operation });
  if (error) throw new Error(error.message);
  return { confirmation: false as const, ...(data as unknown as { state: PriceStockState; before?: PriceStockState }) };
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