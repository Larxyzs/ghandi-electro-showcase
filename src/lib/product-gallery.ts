/**
 * THE authoritative product-gallery pipeline — pure, deterministic, no AI.
 *
 * A saved gallery may contain ONLY the slides of the identified product's real
 * carousel, located through the manufacturer's VERIFIED extraction rules
 * (src/lib/manufacturer-rules.ts, taught once by the deep inspection).
 *
 * There is deliberately no generic path any more: no page-wide <img> scan, no
 * "nearby images", no JSON-LD fallback and no og:image fallback. When the
 * verified rules do not match the page, the result is zero images plus
 * GALLERY_NEEDS_REVIEW — a wrong gallery is worse than an empty one.
 *
 * Feature sections ("No Frost", "Cooling", "Inverter", "Smart", benefits,
 * specifications) may feed the SPECIFICATION extractor; their images can never
 * reach the gallery.
 */

import {
  extractRuleGallery,
  UNIVERSAL_EXCLUDED_URLS,
  type ManufacturerRules,
} from "./manufacturer-rules";

export type GalleryIdentity = {
  brand?: string;
  model?: string;
  name?: string;
};

export const GALLERY_NEEDS_REVIEW = "GALLERY_NEEDS_REVIEW";

export type GalleryResult = {
  /** Verified carousel slides, in the manufacturer's own order. */
  images: string[];
  /** "manufacturer-rules" when verified rules produced the gallery. */
  source: "manufacturer-rules" | "none";
  /** Brand whose registry entry was applied, when one owns the domain. */
  brand: string;
  /** Slide elements the rules matched before deduplication. */
  slides: number;
  rejected: number;
  /** True when no gallery could be proven: the admin must review. */
  needsReview: boolean;
  /** Human-readable reasons, shown in the admin review panel. */
  reasons: string[];
};

export const alnum = (value: string) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const JUNK_URL = new RegExp(UNIVERSAL_EXCLUDED_URLS.join("|"), "i");

/**
 * An image file, including CMS renditions where the extension is followed by a
 * sub-path ("…/photo-1.png/jcr:content/renditions/original" on AEM sites such
 * as whirlpool.ma).
 */
const IMAGE_EXT = /\.(jpe?g|png|webp|avif)(\/|\?|#|$)/i;

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

/** Final per-image validation: could this URL be a picture of THIS product? */
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

/**
 * THE gallery of one exact product page.
 *
 * `rules` are the manufacturer's verified extraction rules for this domain.
 * Without them (unknown domain, rules not yet verified, structure changed) the
 * gallery is empty and flagged GALLERY_NEEDS_REVIEW.
 */
export function extractProductGallery(
  html: string,
  baseUrl: string,
  identity: GalleryIdentity = {},
  rules: ManufacturerRules | null = null,
): GalleryResult {
  const empty: GalleryResult = {
    images: [],
    source: "none",
    brand: rules?.brand ?? "",
    slides: 0,
    rejected: 0,
    needsReview: true,
    reasons: [],
  };

  if (!rules) {
    return {
      ...empty,
      reasons: ["aucune règle d'extraction vérifiée pour ce domaine fabricant"],
    };
  }

  const found = extractRuleGallery(html, baseUrl, rules);
  if (found.urls.length === 0) {
    return { ...empty, slides: found.slides, reasons: found.reasons };
  }

  let rejected = 0;
  const valid = found.urls.filter((url) => {
    const ok = isProductImageUrl(url, baseUrl, identity);
    if (!ok) rejected += 1;
    return ok;
  });

  const images = dedupeGalleryUrls(valid);
  if (images.length < Math.max(1, rules.gallery.min_slides)) {
    return {
      ...empty,
      slides: found.slides,
      rejected,
      reasons: [
        ...found.reasons,
        "diapositives insuffisantes après validation : galerie envoyée en revue",
      ],
    };
  }

  return {
    images,
    source: "manufacturer-rules",
    brand: rules.brand,
    slides: found.slides,
    rejected,
    needsReview: false,
    reasons: found.reasons,
  };
}
