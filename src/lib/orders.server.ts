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
  items: { product_id: string; qty: number }[];
};

export async function createOrder(input: CreateOrderInput): Promise<{ reference: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const full_name = (input.full_name ?? "").trim();
  const address = (input.address ?? "").trim();
  const city = (input.city ?? "").trim();
  const note = (input.note ?? "").trim();

  if (full_name.length < 2) throw new Error("INVALID_NAME");
  if (address.length < 3) throw new Error("INVALID_ADDRESS");

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
    address,
    city: city || "Casablanca",
    note,
    items: items as never,
    total,
    status: "nouveau",
    payment_state: "unpaid",
  });
  if (insertError) throw new Error(insertError.message);

  return { reference };
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
