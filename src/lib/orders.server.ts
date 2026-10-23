import type { OrderItem, OrderStatus, Order } from "./orders-types";
import { normalizeMaPhone, validateOrderLine } from "./orders-types";

function generateReference() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GHE-${y}${m}${d}-${rand}`;
}

export type CreateOrderInput = {
  full_name: string;
  phone: string;
  address: string;
  city: string;
  note?: string;
  delivery_mode?: string;
  email?: string;
  items: { product_id: string; qty: number }[];
};

export async function createOrder(input: CreateOrderInput): Promise<{ reference: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const full_name = (input.full_name ?? "").trim();
  const address = (input.address ?? "").trim();
  const city = (input.city ?? "").trim();
  const note = (input.note ?? "").trim();

  if (full_name.length < 2) throw new Error("INVALID_NAME");
  const delivery_mode = input.delivery_mode === "retrait" ? "retrait" : "livraison";
  const email = (input.email ?? "").trim().slice(0, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");
  if (delivery_mode === "livraison" && address.length < 3) throw new Error("INVALID_ADDRESS");

  const phone = normalizeMaPhone(input.phone ?? "");
  if (!phone) throw new Error("INVALID_PHONE");

  const rawItems = (input.items ?? []).filter((i) => i && i.product_id && i.qty > 0);
  if (rawItems.length === 0) throw new Error("EMPTY_CART");

  const ids = [...new Set(rawItems.map((i) => i.product_id))];
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("id, name, brand, price, stock, image_url")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const items: OrderItem[] = [];
  let total = 0;

  // The server is the authority: existence, current price and current stock are
  // re-checked here, never trusted from the browser.
  for (const line of rawItems) {
    const product = byId.get(line.product_id);
    const { qty, price } = validateOrderLine(product, line.qty);
    if (!product) continue;
    items.push({
      product_id: product.id,
      name: product.name,
      brand: product.brand ?? "",
      price,
      qty,
      image_url: product.image_url ?? null,
    });
    total += price * qty;
  }

  if (items.length === 0) throw new Error("EMPTY_CART");

  const reference = generateReference();
  const { error: insertError } = await supabaseAdmin.from("orders").insert({
    reference,
    full_name,
    phone,
    address: delivery_mode === "retrait" ? "Retrait au magasin" : address,
    city: delivery_mode === "retrait" ? "Casablanca" : city || "Casablanca",
    delivery_mode,
    email,
    note,
    items: items as never,
    total,
    status: "nouveau",
    payment_state: "unpaid",
  });
  if (insertError) throw new Error(insertError.message);

  return { reference };
}

const TRACK_ERROR = "Nous ne trouvons pas cette commande. Vérifiez le numéro et le téléphone.";

export type TrackedOrder = {
  reference: string;
  created_at: string;
  status: OrderStatus;
  delivery_mode: string;
  items: { name: string; qty: number }[];
};

/** Public order lookup: reference + phone (digits only, last 9 compared). */
export async function trackOrder(reference: string, phone: string): Promise<{ ok: true; order: TrackedOrder } | { ok: false; error: string }> {
  const { allowAction } = await import("./rate-limit.server");
  if (!(await allowAction("track", 10, 60))) return { ok: false, error: "Trop d'essais. Réessayez dans une heure." };
  const ref = reference.trim().toUpperCase();
  const digits = phone.replace(/\D/g, "").slice(-9);
  if (!ref || digits.length < 9) return { ok: false, error: TRACK_ERROR };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("orders").select("reference, created_at, status, delivery_mode, items, phone").eq("reference", ref).maybeSingle();
  if (!data || data.phone.replace(/\D/g, "").slice(-9) !== digits) return { ok: false, error: TRACK_ERROR };
  return {
    ok: true,
    order: {
      reference: data.reference,
      created_at: data.created_at,
      status: data.status as OrderStatus,
      delivery_mode: data.delivery_mode,
      items: ((data.items ?? []) as unknown as OrderItem[]).map((i) => ({ name: `${i.brand ? `${i.brand} ` : ""}${i.name}`, qty: i.qty })),
    },
  };
}

export async function listOrders(): Promise<Order[]> {
  const { currentAdmin } = await import("./admin.server");
  if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...row,
    items: (row.items ?? []) as unknown as OrderItem[],
    total: row.total ?? 0,
    status: row.status as OrderStatus,
  }));
}

export async function setOrderStatus(id: string, status: OrderStatus) {
  const { currentAdmin } = await import("./admin.server");
  if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function deleteOrder(id: string) {
  const { currentAdmin } = await import("./admin.server");
  if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
