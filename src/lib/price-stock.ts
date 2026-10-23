export type Availability = 'in_stock' | 'out_of_stock' | 'on_request';
export const AVAILABILITY_LABELS: Record<Availability, string> = { in_stock: 'En stock', out_of_stock: 'Rupture de stock', on_request: 'Disponible sur demande' };
export function availabilityOf(p: { availability?: string; stock: number | null }): Availability {
  if (p.availability === 'on_request') return 'on_request';
  return p.availability === 'in_stock' && (p.stock ?? 0) > 0 ? 'in_stock' : 'out_of_stock';
}
export function searchKey(s: string) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function needsPriceConfirmation(oldPrice: number | null, price: number) {
  if (price === 0 || price === oldPrice) return false;
  return price < 50 || price > 200000 || ((oldPrice ?? 0) > 0 && (price > Number(oldPrice) * 3 || price < Number(oldPrice) / 3));
}
export function wholePrice(value: string) { return Number(value.replace(/\s/g, '')) || 0; }
export function integerDH(value: number | null) { return `${Math.round(value ?? 0).toLocaleString('fr-FR')} DH`; }
export type PriceStockState = { name: string; price: number | null; stock: number; availability: Availability; updated_at: string };
export type PriceStockProduct = PriceStockState & { id: string; brand: string; model: string | null; serial_number: string; node_id: string; image_url: string | null };
export type PriceStockPatch = { name?: string | undefined; price?: number | null | undefined; stock?: number | undefined; availability?: Availability | undefined };
export type PriceStockSave = { id: string; patch: PriceStockPatch; expected: string; operation: string; confirmed?: boolean | undefined };
export type PriceStockChange = { id: string; product_id: string | null; champ: string; ancienne_valeur: string | number | null; nouvelle_valeur: string | number | null; admin_email: string; created_at: string; reference: string; product_name: string; image_url: string | null; before_state: PriceStockState; after_state: PriceStockState };
export const availabilityRank = (p: { availability?: string; stock: number | null }) => ({ in_stock: 0, on_request: 1, out_of_stock: 2 })[availabilityOf(p)];