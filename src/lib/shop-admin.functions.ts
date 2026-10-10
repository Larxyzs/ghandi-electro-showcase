import { createServerFn } from "@tanstack/react-start";
import type { BannerInput } from "./shop-admin.server";

export const adminSaveBanners = createServerFn({ method: "POST" })
  .inputValidator((data: { banners: BannerInput[] }) => {
    if (!Array.isArray(data?.banners)) throw new Error("BAD_INPUT");
    return data;
  })
  .handler(async ({ data }) => {
    const { saveBanners } = await import("./shop-admin.server");
    return saveBanners(data.banners);
  });

export const adminSavePrices = createServerFn({ method: "POST" })
  .inputValidator((data: { rows: { id: string; price: number | null }[] }) => {
    if (!Array.isArray(data?.rows) || data.rows.length > 500) throw new Error("BAD_INPUT");
    return {
      rows: data.rows.map((r) => ({
        id: String(r.id),
        price: r.price === null ? null : Number(r.price),
      })),
    };
  })
  .handler(async ({ data }) => {
    const { savePrices } = await import("./shop-admin.server");
    return savePrices(data.rows);
  });
