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

