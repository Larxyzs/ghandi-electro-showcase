export type OrderStatus = "nouveau" | "en_cours" | "termine" | "annule";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  nouveau: "Nouvelle",
  en_cours: "Confirmée",
  termine: "Livrée",
  annule: "Annulée",
};

export const ORDER_STATUSES: OrderStatus[] = ["nouveau", "en_cours", "termine", "annule"];

export type OrderItem = {
  product_id: string;
  name: string;
  brand: string;
  price: number;
  qty: number;
  image_url: string | null;
};

export type Order = {
  id: string;
  reference: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  note: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};

/**
 * Normalizes a Moroccan phone number to the local 0XXXXXXXXX form.
 * Accepts 06/07 + 8 digits, or +2126/+2127 / 002126/002127 variants,
 * with optional spaces, dots or dashes.
 */
export function normalizeMaPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s.\-()]/g, "");
  let digits = cleaned;
  if (digits.startsWith("+212")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("00212")) digits = "0" + digits.slice(5);
  else if (digits.startsWith("212") && digits.length === 12) digits = "0" + digits.slice(3);

  if (!/^0[67]\d{8}$/.test(digits)) return null;
  return digits;
}

export function isValidMaPhone(raw: string): boolean {
  return normalizeMaPhone(raw) !== null;
}


/**
 * Server-side order line check: the product must exist, be priced and have
 * enough stock. Pure so it can be unit tested.
 */
export function validateOrderLine(
  product: { id: string; name: string; price: number | null; stock: number | null } | undefined,
  qty: number,
): { qty: number; price: number } {
  if (!product) throw new Error("PRODUCT_UNAVAILABLE");
  const stock = Math.max(0, Math.floor(product.stock ?? 0));
  const asked = Math.max(1, Math.min(99, Math.floor(qty)));
  // stock 0 = not tracked / on order: allowed. A tracked stock caps the quantity.
  if (stock > 0 && asked > stock) throw new Error(`INSUFFICIENT_STOCK:${product.name}:${stock}`);
  // No shop price yet: 0 here, the price is confirmed by phone.
  const price = product.price !== null && product.price > 0 ? product.price : 0;
  return { qty: asked, price };
}
