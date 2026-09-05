/**
 * Authoritative product gallery extraction — pure, deterministic, no AI.
 *
 * The saved gallery must be the manufacturer's own product slideshow for THIS
 * exact model, in its original order. Everything else on the page (logos,
 * banners, promos, category tiles, recommended/related products, footer, icons,
 * trackers) is rejected instead of being collected and cleaned up afterwards.
 */

export type GalleryIdentity = {
  brand?: string;
  model?: string;
  name?: string;
};

export type GalleryResult = {
  images: string[];
  /** Where the slideshow came from, for the admin review panel. */
  source: "json-ld" | "gallery-container" | "og-image" | "none";
  rejected: number;
};

export const alnum = (value: string) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** Never part of a product's own slideshow. */
const JUNK_URL =
  /(logo|favicon|sprite|icon(?:s)?[-_/.]|banner|bandeau|promo|promotion|hero[-_]?banner|campaign|advert|badge|award|label[-_]?energy?[-_]?icon|social|facebook|instagram|twitter|youtube|whatsapp|pinterest|arrow|chevron|caret|placeholder|blank|spacer|pixel|tracking|beacon|analytics|newsletter|footer|header|menu|nav[-_]|breadcrumb|payment|visa|mastercard|flag|avatar|cookie|loader|spinner|play[-_]?button|video[-_]?poster|qr[-_]?code)/i;

/** Page regions that hold other products, never this product's slideshow. */
const FOREIGN_REGION =
  /(related|recommend|recommand|you[-_]?may|also[-_]?like|cross[-_]?sell|up[-_]?sell|similar|accessor|compare|comparison|bundle|other[-_]?product|carousel[-_]?product-list|footer|header|nav|menu|breadcrumb|banner|promo|review|blog|article|newsletter|category)/i;

/** Regions that DO hold the product slideshow. */
const GALLERY_REGION =
  /(product[-_]?gallery|gallery|slideshow|slider|swiper|carousel|fotorama|flickity|splide|glide|media[-_]?viewer|media[-_]?gallery|image[-_]?viewer|pdp[-_]?media|pdp[-_]?image|product[-_]?media|product[-_]?image|productimages|main[-_]?image|hero[-_]?image|zoom)/i;

const IMAGE_EXT = /\.(jpe?g|png|webp|avif)(\?|#|$)/i;

/** Registrable-ish base of a hostname (last two labels, or three for co.uk-like). */
export function hostBase(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const twoLevelTld = /^(co|com|net|org|gov|ac)$/.test(parts[parts.length - 2] ?? "");
  return parts.slice(twoLevelTld ? -3 : -2).join(".");
}

/** Size hint contained in a URL ("_1600x1200", "-300x300", "w_800"). */
function sizeScore(url: string): number {
  let best = 0;
  for (const m of url.matchAll(/(\d{2,5})\s?[x×]\s?(\d{2,5})/g)) {
    best = Math.max(best, Number(m[1]), Number(m[2]));
  }
  for (const m of url.matchAll(/[?&_/-](?:w|width|h|height|size|sz)[=_-]?(\d{2,5})/gi)) {
    best = Math.max(best, Number(m[1]));
  }
  if (/thumb|thumbnail|small|mini|tiny|preview|_xs|_sm|-sm\b/i.test(url)) best -= 5000;
  return best;
}

/**
 * Same picture served at another size / CDN transform / query string collapses
 * to one key: "_1600x1200", "-300x300", "/w_800,h_600/", "?imwidth=1080", …
 */
export function imageVariantKey(rawUrl: string): string {
  let host = "";
  let path = rawUrl.toLowerCase();
  try {
    const parsed = new URL(rawUrl);
    host = hostBase(parsed.hostname);
    path = parsed.pathname.toLowerCase();
  } catch {
    /* keep the raw value */
  }
  path = path
    .replace(/\/(?:[whqcf]|dpr|fit|crop|resize|rs|sc)[=_,-]?\d+(?:[,_-][a-z]+[=_,-]?\d+)*\//g, "/")
    .replace(/\/fit-in\/\d+x\d+\//g, "/")
    .replace(/\/\d{2,5}x\d{2,5}\//g, "/")
    .replace(/[-_]\d{2,5}x\d{2,5}(?=\.|$)/g, "")
    .replace(/[-_](?:thumb|thumbnail|small|medium|large|big|xl|xxl|zoom|full|orig(?:inal)?|preview|mini|\d{2,5}w)(?=\.|$)/g, "")
    // A trailing number is a size variant only when it is a plain pixel value
    // (hero_01_1100.jpg, hero_300.jpg). Zero-padded or small numbers are
    // slideshow sequence numbers (rb34_001 / rb34_002) and MUST stay distinct,
    // otherwise a whole gallery collapses into a single photo.
    .replace(/[-_]([1-9]\d{2,4})(?=\.(?:jpe?g|png|webp|avif)$)/g, "")
    .replace(/\.(jpe?g|png|webp|avif)$/g, "");
  return `${host}${path}`;
}

/** Keeps one URL per picture (the biggest variant) in first-seen order. */
export function dedupeGalleryUrls(urls: string[]): string[] {
  const order: string[] = [];
  const best = new Map<string, string>();
  for (const raw of urls) {
    const url = (raw ?? "").trim();
    if (!url) continue;
    const key = imageVariantKey(url);
    const current = best.get(key);
    if (current === undefined) {
      order.push(key);
      best.set(key, url);
    } else if (sizeScore(url) > sizeScore(current)) {
      best.set(key, url);
    }
  }
  return order.map((key) => best.get(key)!).filter(Boolean);
}

function absolute(raw: string, baseUrl: string): string {
  try {
    const url = new URL(raw.trim().replace(/&amp;/g, "&").replace(/\\\//g, "/"), baseUrl).toString();
    if (!/^https?:\/\//i.test(url)) return "";
    return url;
  } catch {
    return "";
  }
}

/** True when this URL can plausibly be a picture of this product. */
export function isProductImageUrl(url: string, baseUrl: string, identity: GalleryIdentity): boolean {
  if (!url) return false;
  if (/^data:/i.test(url)) return false;
  if (/\.(svg|gif|ico|bmp)(\?|#|$)/i.test(url)) return false;
  if (!IMAGE_EXT.test(url) && !/\/image|\/media|\/photo|imwidth|format=/i.test(url)) return false;
  if (JUNK_URL.test(url)) return false;

  let host = "";
  try {
    host = hostBase(new URL(url).hostname);
  } catch {
    return false;
  }
  let pageHost = "";
  try {
    pageHost = hostBase(new URL(baseUrl).hostname);
  } catch {
    /* ignore */
  }
  if (host && pageHost && host === pageHost) return true;

  // A manufacturer CDN carrying the brand name, or a file named after the model,
  // still belongs to the same official source.
  const brand = alnum(identity.brand ?? "");
  const model = alnum(identity.model ?? "");
  const haystack = alnum(decodeURIComponent(url));
  if (brand.length >= 3 && (alnum(host).includes(brand) || haystack.includes(brand))) return true;
  if (model.length >= 4 && haystack.includes(model)) return true;
  return false;
}

/* --------------------------- structured data --------------------------- */

function jsonLdImages(html: string, baseUrl: string, identity: GalleryIdentity): string[] {
  const ref = alnum(identity.model ?? "");
  const found: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    const types = (Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]]).map((t) =>
      String(t ?? "").toLowerCase(),
    );
    if (types.includes("product")) {
      const identityText = alnum(
        [item["sku"], item["mpn"], item["model"], item["name"]].map((v) => String(v ?? "")).join(" "),
      );
      // Only this product's structured data; a related product's block is skipped.
      if (!ref || !identityText || identityText.includes(ref)) {
        const images = item["image"];
        const list = Array.isArray(images) ? images : [images];
        for (const entry of list) {
          const raw =
            typeof entry === "string"
              ? entry
              : String((entry as Record<string, unknown> | null)?.["url"] ?? "");
          const url = absolute(raw, baseUrl);
          if (url) found.push(url);
        }
      }
    }
    Object.values(item).forEach(visit);
  };
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse((match[1] ?? "").trim()));
    } catch {
      /* ignore invalid structured data */
    }
  }
  return found;
}

/* --------------------------- gallery containers ------------------------ */

const ATTR_IMAGE =
  /(?:data-zoom-image|data-large|data-large-image|data-full|data-full-image|data-hires|data-image|data-src|data-original|data-lazy|data-srcset|srcset|src)\s*=\s*["']([^"']+)["']/gi;

function urlsFromRegion(region: string, baseUrl: string): string[] {
  const out: string[] = [];
  for (const m of region.matchAll(ATTR_IMAGE)) {
    const candidate = (m[1] ?? "").split(",").pop()?.trim().split(/\s+/)[0] ?? "";
    const url = absolute(candidate, baseUrl);
    if (url) out.push(url);
  }
  // JSON blobs inside the gallery component (Next.js / Nuxt payloads).
  for (const m of region.matchAll(/https?:(?:\\\/\\\/|\/\/)[^"'\s\\<>]+\.(?:jpe?g|png|webp|avif)/gi)) {
    const url = absolute((m[0] ?? "").replace(/\\\//g, "/"), baseUrl);
    if (url) out.push(url);
  }
  return out;
}

function galleryRegions(html: string): string[] {
  const regions: string[] = [];
  const openTag = /<(div|section|ul|figure|aside|swiper-container)\b([^>]*)>/gi;
  for (const match of html.matchAll(openTag)) {
    const tag = (match[1] ?? "").toLowerCase();
    const attrs = match[2] ?? "";
    const attrText = attrs.replace(/\s+/g, " ");
    if (!GALLERY_REGION.test(attrText)) continue;
    if (FOREIGN_REGION.test(attrText)) continue;
    const start = (match.index ?? 0) + match[0].length;
    regions.push(html.slice(start, start + regionLength(html, tag, start)));
  }
  return regions;
}

/**
 * Length of the element's own content: we stop at its matching closing tag so a
 * "recommended products" block that merely follows the slideshow is never read
 * as part of it.
 */
function regionLength(html: string, tag: string, start: number): number {
  const limit = Math.min(html.length, start + 60_000);
  const scanner = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, "gi");
  scanner.lastIndex = start;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(html)) !== null) {
    if (match.index >= limit) break;
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return match.index - start;
  }
  return Math.min(12_000, limit - start);
}

/**
 * THE authoritative gallery for one exact product page.
 * Order is the manufacturer's slideshow order; duplicates (thumbnail vs
 * full-size, CDN resizes, query-string variants, mirrors) collapse to one.
 */
export function extractProductGallery(
  html: string,
  baseUrl: string,
  identity: GalleryIdentity = {},
): GalleryResult {
  let rejected = 0;
  const keep = (urls: string[]) =>
    urls.filter((url) => {
      const ok = isProductImageUrl(url, baseUrl, identity);
      if (!ok) rejected += 1;
      return ok;
    });

  const structured = keep(jsonLdImages(html, baseUrl, identity));
  const container = keep(galleryRegions(html).flatMap((region) => urlsFromRegion(region, baseUrl)));

  let images = dedupeGalleryUrls([...structured, ...container]);
  let source: GalleryResult["source"] = structured.length ? "json-ld" : container.length ? "gallery-container" : "none";

  if (images.length === 0) {
    const og: string[] = [];
    for (const m of html.matchAll(
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
    )) {
      const url = absolute(m[1] ?? "", baseUrl);
      if (url) og.push(url);
    }
    images = dedupeGalleryUrls(keep(og));
    source = images.length ? "og-image" : "none";
  }

  return { images, source, rejected };
}
