import { createServerFn } from "@tanstack/react-start";
import type { OrderStatus } from "./orders-types";

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      full_name: string;
      phone: string;
      address: string;
      city: string;
      note?: string;
      items: { product_id: string; qty: number }[];
    }) => ({
      full_name: String(data.full_name ?? "").slice(0, 120),
      phone: String(data.phone ?? "").slice(0, 32),
      address: String(data.address ?? "").slice(0, 240),
      city: String(data.city ?? "").slice(0, 80),
      note: String(data.note ?? "").slice(0, 500),
      items: Array.isArray(data.items)
        ? data.items
            .map((i) => ({ product_id: String(i.product_id), qty: Number(i.qty) || 0 }))
            .slice(0, 50)
        : [],
    }),
  )
  .handler(async ({ data }) => {
    const { createOrder } = await import("./orders.server");
    return createOrder(data);
  });

export const adminListOrders = createServerFn({ method: "GET" }).handler(async () => {
  const { listOrders } = await import("./orders.server");
  return listOrders();
});

export const adminSetOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: OrderStatus }) => ({
    id: String(data.id),
    status: data.status,
  }))
  .handler(async ({ data }) => {
    const { setOrderStatus } = await import("./orders.server");
    return setOrderStatus(data.id, data.status);
  });

export const adminDeleteOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deleteOrder } = await import("./orders.server");
    return deleteOrder(data.id);
  });
