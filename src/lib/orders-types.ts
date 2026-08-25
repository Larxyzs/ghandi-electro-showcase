export type OrderStatus = "nouveau" | "en_cours" | "termine" | "annule";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  nouveau: "Non vu",
  en_cours: "En cours",
  termine: "Terminée",
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
