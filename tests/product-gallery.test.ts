import { describe, expect, it } from "vitest";
import {
  extractProductGallery,
  dedupeGalleryUrls,
  imageVariantKey,
} from "../src/lib/product-gallery";
import { extractGalleryImages } from "../src/lib/cindy.server";

const CDN = "https://images.samsung.com/is/image/samsung/p6pim/ma/rb34t672eww";

/**
 * A realistic manufacturer product page:
 *  - 5 real slideshow images
 *  - 4 thumbnails of those same images
 *  - 3 recommendation images (other products)
 *  - 2 logos, 2 banners
 */
const productPage = `<!doctype html><html><head>
<link rel="canonical" href="https://www.samsung.com/n_africa/refrigerators/bottom-mount-freezer/rb34t672eww-ef/">
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
</div>
<ul class="pd-gallery__thumbnails">
  <li><img src="${CDN}_front_001.jpg?$180_144_PNG$"></li>
  <li><img src="${CDN}_front-open_002.jpg?$180_144_PNG$"></li>
  <li><img src="${CDN}_side_003.jpg?$180_144_PNG$"></li>
  <li><img src="${CDN}_drawer_004.jpg?$180_144_PNG$"></li>
</ul>
<section class="related-products recommended">
  <img src="https://images.samsung.com/is/image/samsung/p6pim/ma/rb33t307055_front.jpg?$650_519_PNG$">
  <img src="https://images.samsung.com/is/image/samsung/p6pim/ma/rt38k5530_front.jpg?$650_519_PNG$">
  <img src="https://images.samsung.com/is/image/samsung/p6pim/ma/ww90t534_front.jpg?$650_519_PNG$">
</section>
<div class="promo-banner"><img src="https://images.samsung.com/marketing/banner-rentree-2026.jpg"></div>
<footer><img src="https://images.samsung.com/common/logo-footer.png"><img src="https://images.samsung.com/icons/sprite-social.png"></footer>
</body></html>`;

const PAGE_URL =
  "https://www.samsung.com/n_africa/refrigerators/bottom-mount-freezer/rb34t672eww-ef/";

describe("authoritative product gallery", () => {
  it("keeps exactly the 5 slideshow images, in slideshow order", () => {
    const { images, source } = extractProductGallery(productPage, PAGE_URL, {
      brand: "Samsung",
      model: "RB34T672EWW",
      name: "Réfrigérateur combiné",
    });
    expect(images).toEqual([
      `${CDN}_front_001.jpg?$1100_872_PNG$`,
      `${CDN}_front-open_002.jpg?$1100_872_PNG$`,
      `${CDN}_side_003.jpg?$1100_872_PNG$`,
      `${CDN}_drawer_004.jpg?$1100_872_PNG$`,
      `${CDN}_detail_005.jpg?$1100_872_PNG$`,
    ]);
    expect(source).toBe("gallery-container");
  });

  it("rejects logos, banners, header/footer, icons and recommended products", () => {
    const { images } = extractProductGallery(productPage, PAGE_URL, { model: "RB34T672EWW" });
    const joined = images.join(" ");
    for (const junk of [
      "logo",
      "banner",
      "sprite",
      "rb33t307055",
      "rt38k5530",
      "ww90t534",
      "og_share",
    ]) {
      expect(joined.toLowerCase()).not.toContain(junk);
    }
  });

  it("collapses thumbnails and full-size versions of one photo", () => {
    const { images } = extractProductGallery(productPage, PAGE_URL, { model: "RB34T672EWW" });
    expect(images).toHaveLength(5);
    // the kept variant is the big one, not the 180px thumbnail
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
    expect(
      dedupeGalleryUrls([
        "https://cdn.bosch-home.com/media/hero_a_400.jpg",
        "https://cdn.bosch-home.com/media/hero_a_1600.jpg",
        "https://cdn.bosch-home.com/media/hero_a.jpg?imwidth=1080",
      ]),
    ).toHaveLength(1);
  });

  it("prefers the manufacturer's structured gallery when the page provides one", () => {
    const html = `<!doctype html><html><body>
    <script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      sku: "RB34T672EWW",
      image: [`${CDN}_a.jpg`, `${CDN}_b.jpg`],
    })}</script>
    <div class="carousel-recommendations"><img src="${CDN.replace("rb34t672eww", "rt38k")}_x.jpg"></div>
    </body></html>`;
    const { images, source } = extractProductGallery(html, PAGE_URL, { model: "RB34T672EWW" });
    expect(source).toBe("json-ld");
    expect(images).toEqual([`${CDN}_a.jpg`, `${CDN}_b.jpg`]);
  });

  it("no generic page-wide scan can leak in: the legacy helper now delegates", () => {
    const legacy = extractGalleryImages(productPage, PAGE_URL, "RB34T672EWW");
    const authoritative = extractProductGallery(productPage, PAGE_URL, {
      model: "RB34T672EWW",
    }).images;
    expect(legacy).toEqual(authoritative);
    expect(legacy).toHaveLength(5);
  });
});
