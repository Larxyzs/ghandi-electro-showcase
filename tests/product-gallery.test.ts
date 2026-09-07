import { describe, expect, it } from "vitest";
import {
  extractProductGallery,
  dedupeGalleryUrls,
  imageVariantKey,
} from "../src/lib/product-gallery";
import { BUILTIN_MANUFACTURER_RULES, rulesForUrl } from "../src/lib/manufacturer-rules";

const CDN = "https://images.samsung.com/is/image/samsung/p6pim/ma/rb34t672eww";

const PAGE_URL =
  "https://www.samsung.com/n_africa/refrigerators/bottom-mount-freezer/rb34t672eww-ef/";

const samsung = rulesForUrl(PAGE_URL, BUILTIN_MANUFACTURER_RULES);
const whirlpoolRules = rulesForUrl("https://www.whirlpool.ma/x", BUILTIN_MANUFACTURER_RULES);

/**
 * A realistic Samsung product page:
 *  - 5 real slideshow images inside the pd-gallery carousel
 *  - 4 thumbnails of those same images
 *  - a "No Frost" / "Inverter" feature carousel of the SAME appliance
 *  - 3 recommendation images (other products)
 *  - logos, banners, footer icons
 */
const productPage = `<!doctype html><html><head>
<link rel="canonical" href="${PAGE_URL}">
<meta property="og:image" content="${CDN}/og_share.jpg">
</head><body>
<header class="site-header">
  <img src="https://images.samsung.com/common/logo-samsung.png">
  <img src="https://images.samsung.com/common/header-banner-promo.jpg">
</header>
<div class="pd-gallery product-gallery__slideshow">
  <img src="${CDN}_front_001.jpg?$1100_872_PNG$" alt="RB34T672EWW vue de face">
  <img src="${CDN}_front-open_002.jpg?$1100_872_PNG$" alt="porte ouverte">
  <img src="${CDN}_side_003.jpg?$1100_872_PNG$" alt="vue de côté">
  <img src="${CDN}_drawer_004.jpg?$1100_872_PNG$" alt="bac à légumes">
  <img src="${CDN}_detail_005.jpg?$1100_872_PNG$" alt="détail du bandeau">
  <ul class="pd-gallery__thumbnails">
    <li><img src="${CDN}_front_001.jpg?$180_144_PNG$"></li>
    <li><img src="${CDN}_front-open_002.jpg?$180_144_PNG$"></li>
    <li><img src="${CDN}_side_003.jpg?$180_144_PNG$"></li>
    <li><img src="${CDN}_drawer_004.jpg?$180_144_PNG$"></li>
  </ul>
</div>
<div class="pd-gallery feature-carousel no-frost">
  <img src="${CDN}_nofrost_feature.jpg?$1100_872_PNG$" alt="No Frost">
  <img src="${CDN}_inverter_feature.jpg?$1100_872_PNG$" alt="Digital Inverter">
  <img src="${CDN}_smartthings_feature.jpg?$1100_872_PNG$" alt="SmartThings">
</div>
<section class="related-products recommended">
  <img src="https://images.samsung.com/is/image/samsung/p6pim/ma/rb33t307055_front.jpg?$650_519_PNG$">
  <img src="https://images.samsung.com/is/image/samsung/p6pim/ma/rt38k5530_front.jpg?$650_519_PNG$">
</section>
<div class="promo-banner"><img src="https://images.samsung.com/marketing/banner-rentree-2026.jpg"></div>
<footer><img src="https://images.samsung.com/common/logo-footer.png"><img src="https://images.samsung.com/icons/sprite-social.png"></footer>
</body></html>`;

describe("verified carousel slides = gallery, everything else = not gallery", () => {
  it("keeps exactly the 5 slideshow images, in slideshow order", () => {
    const { images, source, needsReview } = extractProductGallery(
      productPage,
      PAGE_URL,
      { brand: "Samsung", model: "RB34T672EWW", name: "Réfrigérateur combiné" },
      samsung,
    );
    expect(images).toEqual([
      `${CDN}_front_001.jpg?$1100_872_PNG$`,
      `${CDN}_front-open_002.jpg?$1100_872_PNG$`,
      `${CDN}_side_003.jpg?$1100_872_PNG$`,
      `${CDN}_drawer_004.jpg?$1100_872_PNG$`,
      `${CDN}_detail_005.jpg?$1100_872_PNG$`,
    ]);
    expect(source).toBe("manufacturer-rules");
    expect(needsReview).toBe(false);
  });

  it("excludes feature images (No Frost, Inverter, Smart) of the very same appliance", () => {
    const { images } = extractProductGallery(productPage, PAGE_URL, { model: "RB34T672EWW" }, samsung);
    const joined = images.join(" ").toLowerCase();
    for (const junk of ["nofrost", "inverter", "smartthings", "feature"]) {
      expect(joined).not.toContain(junk);
    }
  });

  it("rejects logos, banners, header/footer, icons, recommended products and og:image", () => {
    const { images } = extractProductGallery(productPage, PAGE_URL, { model: "RB34T672EWW" }, samsung);
    const joined = images.join(" ").toLowerCase();
    for (const junk of ["logo", "banner", "sprite", "rb33t307055", "rt38k5530", "og_share"]) {
      expect(joined).not.toContain(junk);
    }
  });

  it("collapses thumbnails and full-size versions of one photo", () => {
    const { images } = extractProductGallery(productPage, PAGE_URL, { model: "RB34T672EWW" }, samsung);
    expect(images).toHaveLength(5);
    expect(images.every((url) => url.includes("1100_872"))).toBe(true);
  });

  it("keeps genuinely different product views", () => {
    const views = [
      "https://cdn.lg.com/gsc/view_01.jpg",
      "https://cdn.lg.com/gsc/view_02.jpg",
      "https://cdn.lg.com/gsc/view_03.jpg",
      "https://cdn.lg.com/gsc/detail-handle.jpg",
      "https://cdn.lg.com/gsc/interior.jpg",
    ];
    expect(dedupeGalleryUrls(views)).toEqual(views);
  });

  it("treats CDN resizes, query-string variants and mirrors as one image", () => {
    const key = imageVariantKey("https://cdn.bosch-home.com/media/hero_a_1600.jpg");
    expect(imageVariantKey("https://cdn.bosch-home.com/media/hero_a_400.jpg")).toBe(key);
    expect(imageVariantKey("https://cdn.bosch-home.com/media/w_800,h_600/hero_a.jpg")).toBe(key);
    expect(imageVariantKey("https://www.cdn.bosch-home.com/media/hero_a.jpg?imwidth=1080")).toBe(key);
  });

  it("never uses JSON-LD product images as the gallery when no carousel matches", () => {
    const html = `<!doctype html><html><body>
    <script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      sku: "RB34T672EWW",
      image: [`${CDN}_a.jpg`, `${CDN}_b.jpg`],
    })}</script>
    <div class="carousel-recommendations"><img src="${CDN}_x.jpg"></div>
    </body></html>`;
    const { images, source, needsReview } = extractProductGallery(
      html,
      PAGE_URL,
      { model: "RB34T672EWW" },
      samsung,
    );
    expect(images).toEqual([]);
    expect(source).toBe("none");
    expect(needsReview).toBe(true);
  });

  it("returns GALLERY_NEEDS_REVIEW when the domain has no verified rules", () => {
    const result = extractProductGallery(productPage, PAGE_URL, {}, null);
    expect(result.images).toEqual([]);
    expect(result.needsReview).toBe(true);
    expect(result.reasons.join(" ")).toContain("règle");
  });
});

describe("Whirlpool (AEM) verified rules", () => {
  const base = "https://www.whirlpool.ma/ma-fr/produits/x-wbmf-706564-xna";
  const file = (n: number) =>
    `/content/dam/whirlpool/product-images/7295848511-WBMF-706564-XNA/7295848511-MDM2-LOW-${n}.png`;

  it("reads the real product-carousel slides, ordered by data-view-index", () => {
    const html = `<html><body><div class="product-info">
      ${[3, 1, 2]
        .map(
          (n) =>
            `<img id="product-info-image-${n}" data-modal-id="product-carousel" data-view-index="${n - 1}" data-page-main-image="${file(n)}" src="${file(n)}/jcr:content/renditions/original" alt="WBMF 706564 XNA">`,
        )
        .join("")}
      <div class="product-features no-frost"><img id="feature-1" data-modal-id="product-carousel" src="/content/dam/whirlpool/features/nofrost.png"></div>
    </div></body></html>`;
    const gallery = extractProductGallery(
      html,
      base,
      { brand: "Whirlpool", model: "WBMF 706564 XNA" },
      whirlpoolRules,
    );
    expect(gallery.source).toBe("manufacturer-rules");
    expect(gallery.images).toEqual([1, 2, 3].map((n) => `https://www.whirlpool.ma${file(n)}`));
  });

  it("keeps CMS rendition URLs whose extension is followed by a sub-path", () => {
    const html = `<html><body><div class="product-carousel">
      ${[1, 2, 3]
        .map(
          (n) =>
            `<img id="product-info-image-${n}" data-modal-id="product-carousel" data-view-index="${n - 1}" src="${file(n)}/jcr:content/renditions/original">`,
        )
        .join("")}
    </div></body></html>`;
    const gallery = extractProductGallery(html, base, { brand: "Whirlpool" }, whirlpoolRules);
    expect(gallery.images).toHaveLength(3);
    expect(gallery.images[0]).toContain("MDM2-LOW-1.png/jcr:content/renditions/original");
  });
});

describe("nested excluded sections", () => {
  it("removes a feature block nested in a header without eating the carousel", () => {
    const base = "https://www.whirlpool.ma/ma-fr/produits/x-wbmf-706564-xna";
    const dam = (n: number) => `/content/dam/whirlpool/product-images/shot-${n}.png`;
    const html = `<html><body>
      <div class="ProductInfo__header">
        <div class="product-features no-frost"><img src="/content/dam/whirlpool/features/nofrost.png"></div>
        <nav class="breadcrumb"><img src="/content/dam/whirlpool/icons/arrow.png"></nav>
      </div>
      <div class="ProductInfo__views">
        ${[1, 2, 3]
          .map(
            (n) =>
              `<img id="product-info-image-${n}" data-modal-id="product-carousel" data-view-index="${n - 1}" src="${dam(n)}">`,
          )
          .join("")}
      </div></body></html>`;
    const gallery = extractProductGallery(html, base, { brand: "Whirlpool" }, whirlpoolRules);
    expect(gallery.images).toEqual([1, 2, 3].map((n) => `https://www.whirlpool.ma${dam(n)}`));
  });

  it("ignores analytics payloads that merely mention marketing or cooling", () => {
    const base = "https://www.whirlpool.ma/ma-fr/produits/y";
    const html = `<html><body><div class="ProductInfo__views" data-gtm-data='{"item_MarketingCode":"1","item_category2":"Cooling"}'>
      <img id="product-info-image-1" data-modal-id="product-carousel" data-view-index="0" data-gtm-data='{"item_MarketingCode":"1","item_category2":"Cooling"}' src="/content/dam/whirlpool/product-images/only.png">
    </div></body></html>`;
    const gallery = extractProductGallery(html, base, { brand: "Whirlpool" }, whirlpoolRules);
    expect(gallery.images).toEqual(["https://www.whirlpool.ma/content/dam/whirlpool/product-images/only.png"]);
  });
});
