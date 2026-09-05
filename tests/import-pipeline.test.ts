import { describe, expect, it } from "vitest";
import { extractProductGallery, dedupeGalleryUrls, imageVariantKey } from "../src/lib/product-gallery";
import { runIsolated } from "../src/lib/batch-runner";
import { validateOrderLine } from "../src/lib/orders-types";

const page = (body: string) => `<!doctype html><html><head>
<meta property="og:image" content="https://images.samsung.com/is/image/samsung/p6pim/ma/rb34_main.jpg?$650_519_PNG$">
</head><body>${body}</body></html>`;

describe("official gallery extraction", () => {
  it("keeps only the product slideshow, in source order, without duplicates or thumbnails", () => {
    const html = page(`
      <div class="pd-gallery__slideshow">
        <img src="https://images.samsung.com/is/image/samsung/p6pim/ma/rb34_001.jpg?$650_519_PNG$">
        <img src="https://images.samsung.com/is/image/samsung/p6pim/ma/rb34_002.jpg?$650_519_PNG$">
        <img src="https://images.samsung.com/is/image/samsung/p6pim/ma/rb34_002.jpg?$180_180_PNG$">
        <img src="https://images.samsung.com/is/image/samsung/p6pim/ma/rb34_003.jpg?$650_519_PNG$">
      </div>
      <section class="recommended-products">
        <img src="https://images.samsung.com/is/image/samsung/p6pim/ma/other_model.jpg?$650_519_PNG$">
      </section>
      <footer><img src="https://images.samsung.com/logo.svg"><img src="https://images.samsung.com/icons/sprite.png"></footer>`);

    const { images } = extractProductGallery(html, "https://www.samsung.com/n_africa/refrigerators/rb34/");
    expect(images).toEqual([
      "https://images.samsung.com/is/image/samsung/p6pim/ma/rb34_001.jpg?$650_519_PNG$",
      "https://images.samsung.com/is/image/samsung/p6pim/ma/rb34_002.jpg?$650_519_PNG$",
      "https://images.samsung.com/is/image/samsung/p6pim/ma/rb34_003.jpg?$650_519_PNG$",
    ]);
  });

  it("never returns 28 copies of 4 images", () => {
    const one = "https://cdn.lg.com/img/hero_01.jpg";
    const four = [one, "https://cdn.lg.com/img/hero_02.jpg", "https://cdn.lg.com/img/hero_03.jpg", "https://cdn.lg.com/img/hero_04.jpg"];
    const flooded = Array.from({ length: 7 }, () => four).flat();
    expect(dedupeGalleryUrls(flooded)).toHaveLength(4);
  });

  it("treats CDN size variants of one photo as the same image", () => {
    expect(imageVariantKey("https://cdn.lg.com/img/hero_01_1100.jpg")).toBe(
      imageVariantKey("https://cdn.lg.com/img/hero_01_300.jpg"),
    );
  });

  it("falls back to the official og:image rather than inventing pictures", () => {
    const { images, source } = extractProductGallery(page("<main><p>Fiche produit</p></main>"), "https://www.samsung.com/x");
    expect(images).toHaveLength(1);
    expect(source).toBe("og-image");
  });
});

describe("large batches with failing URLs", () => {
  it("isolates failures and still finishes 120 items", async () => {
    const urls = Array.from({ length: 120 }, (_, i) => `https://brand.example/p/${i}`);
    let progress = 0;
    const results = await runIsolated(
      urls,
      async (url, i) => {
        if (i % 17 === 0) throw new Error("HTTP_403");
        return url;
      },
      { concurrency: 4, onSettled: () => void progress++ },
    );
    expect(results).toHaveLength(120);
    expect(progress).toBe(120);
    expect(results.filter((r) => !r.ok)).toHaveLength(8);
    expect(results.filter((r) => r.ok)).toHaveLength(112);
    // order preserved: item 3 stays item 3
    expect(results[3]).toMatchObject({ index: 3, ok: true, value: "https://brand.example/p/3" });
  });
});

describe("order safety", () => {
  const product = { id: "p1", name: "Frigo RB34", price: 8990, stock: 3 };

  it("accepts a quantity within stock", () => {
    expect(validateOrderLine(product, 3)).toEqual({ qty: 3, price: 8990 });
  });

  it("refuses more than the stock on hand", () => {
    expect(() => validateOrderLine(product, 5)).toThrow(/INSUFFICIENT_STOCK/);
  });

  it("refuses an out-of-stock product", () => {
    expect(() => validateOrderLine({ ...product, stock: 0 }, 1)).toThrow(/OUT_OF_STOCK/);
  });

  it("refuses an unknown or unpriced product", () => {
    expect(() => validateOrderLine(undefined, 1)).toThrow("PRODUCT_UNAVAILABLE");
    expect(() => validateOrderLine({ ...product, price: null }, 1)).toThrow("PRICE_UNAVAILABLE");
  });
});
