/**
 * Manufacturer extraction registry — the verified knowledge layer.
 *
 * The gallery of a product is NEVER guessed. For each manufacturer we store the
 * structure of its OWN product carousel (container, slides, image attributes,
 * order, CDN patterns, sections to exclude). Those rules are the knowledge; a
 * strong reasoning model is only the teacher that discovers them once
 * (see manufacturer-inspect.server.ts) and they survive any model change.
 *
 * This module is pure and deterministic: no AI, no network, no database.
 */

export type GalleryRules = {
  /** Regex sources tested against the attributes of a container open tag. */
  container_patterns: string[];
  /** Regex sources tested against the attributes of a slide <img>/<source>. */
  slide_patterns: string[];
  /**
   * True when slide_patterns alone prove membership of the product carousel
   * (e.g. Whirlpool's id="product-info-image-N" + data-modal-id="product-carousel").
   * Only then may slides be read outside a matched container.
   */
  slides_self_identifying: boolean;
  /** Attribute names holding the image URL, best quality first. */
  image_attributes: string[];
  /** Gallery image URLs must match at least one of these (when non-empty). */
  url_must_match: string[];
  /** Gallery image URLs must match none of these. */
  url_must_not_match: string[];
  /** Sub-sections removed before reading slides (features, related, banners…). */
  exclude_section_patterns: string[];
  /** "dom" = document order; "attribute" = numeric value of order_attribute. */
  order: "dom" | "attribute";
  order_attribute: string;
  /** Below this number of slides the carousel is not considered identified. */
  min_slides: number;
};

export type ManufacturerRules = {
  brand: string;
  /** Official domains this registry entry applies to. */
  domains: string[];
  identity: {
    /** Attributes/meta names carrying the model reference on this site. */
    model_attributes: string[];
    /** The URL slug carries the model reference. */
    model_in_url_slug: boolean;
  };
  gallery: GalleryRules;
  /** Only verified rules may produce a saved gallery. */
  verified: boolean;
  /** Model that discovered/validated the rules (the teacher). */
  verified_by: string;
  sample_urls: string[];
  notes: string;
};

export const EMPTY_GALLERY_RULES: GalleryRules = {
  container_patterns: [],
  slide_patterns: [],
  slides_self_identifying: false,
  image_attributes: ["src"],
  url_must_match: [],
  url_must_not_match: [],
  exclude_section_patterns: [],
  order: "dom",
  order_attribute: "",
  min_slides: 1,
};

/** Sections that never belong to a product carousel, on any manufacturer site. */
export const UNIVERSAL_EXCLUDED_SECTIONS = [
  "related",
  "recommend",
  "recommand",
  "you[-_]?may",
  "also[-_]?like",
  "cross[-_]?sell",
  "up[-_]?sell",
  "similar",
  "compare",
  "comparison",
  "bundle",
  "accessor",
  "feature",
  "benefit",
  "highlight",
  "spec",
  "caracteristique",
  "characteristic",
  "technical",
  "no[-_]?frost",
  "nofrost",
  "cooling",
  "inverter",
  "smart[-_]?things",
  "marketing",
  "promo",
  "banner",
  "campaign",
  "footer",
  "header",
  "nav",
  "menu",
  "breadcrumb",
  "review",
  "blog",
  "article",
  "newsletter",
  "category",
];

/** URL shapes that are never a product slide. */
export const UNIVERSAL_EXCLUDED_URLS = [
  "logo",
  "favicon",
  "sprite",
  "icon[-_/.]",
  "banner",
  "bandeau",
  "promo",
  "campaign",
  "advert",
  "badge",
  "award",
  "social",
  "facebook",
  "instagram",
  "twitter",
  "youtube",
  "whatsapp",
  "pinterest",
  "arrow",
  "chevron",
  "placeholder",
  "spacer",
  "pixel",
  "tracking",
  "beacon",
  "analytics",
  "newsletter",
  "payment",
  "flag",
  "avatar",
  "cookie",
  "loader",
  "spinner",
  "play[-_]?button",
  "qr[-_]?code",
];

const rules = (
  brand: string,
  domains: string[],
  gallery: Partial<GalleryRules>,
  extra: Partial<ManufacturerRules> = {},
): ManufacturerRules => ({
  brand,
  domains,
  identity: { model_attributes: [], model_in_url_slug: true },
  gallery: { ...EMPTY_GALLERY_RULES, ...gallery },
  verified: false,
  verified_by: "",
  sample_urls: [],
  notes: "",
  ...extra,
});

/**
 * Built-in registry for the eight manufacturers we sell.
 *
 * Only entries whose carousel structure was READ on the real official page are
 * `verified: true`. The others carry their official domains only: until the
 * one-time deep inspection stores their real carousel structure, their imports
 * return GALLERY_NEEDS_REVIEW instead of a guessed gallery.
 */
export const BUILTIN_MANUFACTURER_RULES: ManufacturerRules[] = [
  rules(
    "Whirlpool",
    ["whirlpool.ma", "whirlpool.com", "whirlpool.fr"],
    {
      // Verified on whirlpool.ma (AEM): each slide is an <img> carrying
      // id="product-info-image-N", data-modal-id="product-carousel" and
      // data-view-index; the full-size file lives in data-page-main-image.
      container_patterns: ["product-carousel", "product-info-images?"],
      slide_patterns: ["data-modal-id=[\"']product-carousel", "id=[\"']product-info-image-\\d+"],
      slides_self_identifying: true,
      image_attributes: ["data-page-main-image", "data-image-desktop", "src", "data-src"],
      url_must_match: ["/content/dam/"],
      order: "attribute",
      order_attribute: "data-view-index",
      min_slides: 1,
    },
    { verified: true, verified_by: "inspection manuelle du DOM officiel", notes: "AEM renditions : l'extension .png est suivie de /jcr:content/renditions/original." },
  ),
  rules(
    "Samsung",
    ["samsung.com"],
    {
      // Verified on samsung.com product pages: the slideshow lives in the
      // pd-gallery component, thumbnails in pd-gallery__thumbnails resolve to
      // the same files at another size.
      container_patterns: ["pd-gallery", "product-gallery__slideshow"],
      slide_patterns: [],
      slides_self_identifying: false,
      image_attributes: ["data-zoom-image", "data-src", "src"],
      order: "dom",
      min_slides: 1,
    },
    { verified: true, verified_by: "inspection manuelle du DOM officiel" },
  ),
  rules("LG", ["lg.com"], {}),
  rules("Bosch", ["bosch-home.ma", "bosch-home.com", "bosch-home.fr"], {}),
  rules("TCL", ["tcl.com", "tcl.ma"], {}),
  rules("Candy", ["candy.ma", "candy-home.com", "candy.it"], {}),
  rules("Ariston", ["ariston.com", "aristonthermo.com"], {}),
  rules("Haier", ["haier.com", "haier-europe.com", "haier.ma"], {}),
];

/* ----------------------------- rule lookup ----------------------------- */

export function domainOfUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const domainMatches = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

/** The registry entry that owns this exact URL, or null. */
export function rulesForUrl(url: string, registry: ManufacturerRules[]): ManufacturerRules | null {
  const host = domainOfUrl(url);
  if (!host) return null;
  for (const entry of registry) {
    if (entry.domains.some((domain) => domainMatches(host, domain.toLowerCase().replace(/^www\./, "")))) {
      return entry;
    }
  }
  return null;
}

/* --------------------------- rule-driven DOM --------------------------- */

const compile = (patterns: string[]): RegExp | null => {
  const usable = patterns.map((p) => p.trim()).filter(Boolean);
  if (usable.length === 0) return null;
  try {
    return new RegExp(usable.join("|"), "i");
  } catch {
    return null;
  }
};

function absolute(raw: string, baseUrl: string): string {
  try {
    const url = new URL(raw.trim().replace(/&amp;/g, "&").replace(/\\\//g, "/"), baseUrl).toString();
    return /^https?:\/\//i.test(url) ? url : "";
  } catch {
    return "";
  }
}

/** Content of the element opened at `start`, stopping at its own closing tag. */
function elementBody(html: string, tag: string, start: number): string {
  const limit = Math.min(html.length, start + 200_000);
  const scanner = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, "gi");
  scanner.lastIndex = start;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(html)) !== null) {
    if (match.index >= limit) break;
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index);
  }
  return html.slice(start, Math.min(limit, start + 40_000));
}

const CONTAINER_TAGS = "div|section|ul|figure|aside|swiper-container|product-gallery";

/** Regions of the document that the rules identify as THE product carousel. */
export function galleryContainers(html: string, gallery: GalleryRules): string[] {
  const wanted = compile(gallery.container_patterns);
  if (!wanted) return [];
  const excluded = compile([...gallery.exclude_section_patterns, ...UNIVERSAL_EXCLUDED_SECTIONS]);
  const out: string[] = [];
  const openTag = new RegExp(`<(${CONTAINER_TAGS})\\b([^>]*)>`, "gi");
  for (const match of html.matchAll(openTag)) {
    const attrs = (match[2] ?? "").replace(/\s+/g, " ");
    if (!wanted.test(attrs)) continue;
    if (excluded?.test(attrs)) continue;
    const start = (match.index ?? 0) + match[0].length;
    out.push(stripExcludedSections(elementBody(html, (match[1] ?? "div").toLowerCase(), start), excluded));
  }
  return out;
}

/** Removes nested feature/related/banner sub-sections from a carousel region. */
function stripExcludedSections(region: string, excluded: RegExp | null): string {
  if (!excluded) return region;
  let out = region;
  const openTag = new RegExp(`<(${CONTAINER_TAGS})\\b([^>]*)>`, "gi");
  const cuts: [number, number][] = [];
  for (const match of out.matchAll(openTag)) {
    const attrs = (match[2] ?? "").replace(/\s+/g, " ");
    if (!excluded.test(attrs)) continue;
    const start = match.index ?? 0;
    const bodyStart = start + match[0].length;
    const body = elementBody(out, (match[1] ?? "div").toLowerCase(), bodyStart);
    cuts.push([start, bodyStart + body.length]);
  }
  for (const [from, to] of cuts.reverse()) out = out.slice(0, from) + out.slice(to);
  return out;
}

type SlideCandidate = { url: string; order: number };

const attrValue = (attrs: string, name: string): string => {
  const match = attrs.match(new RegExp(`${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}\\s*=\\s*["']([^"']*)["']`, "i"));
  return (match?.[1] ?? "").trim();
};

/** URLs of the slides inside one region (or of self-identifying slides). */
function slidesFromRegion(region: string, baseUrl: string, gallery: GalleryRules, indexBase: number): SlideCandidate[] {
  const slideMatcher = compile(gallery.slide_patterns);
  const out: SlideCandidate[] = [];
  let seen = 0;
  for (const match of region.matchAll(/<(img|source)\b([^>]*)>/gi)) {
    const attrs = (match[2] ?? "").replace(/\s+/g, " ");
    if (slideMatcher && !slideMatcher.test(attrs)) continue;
    let raw = "";
    for (const name of gallery.image_attributes.length ? gallery.image_attributes : ["src"]) {
      const value = attrValue(attrs, name);
      if (!value) continue;
      raw = /srcset/i.test(name) ? (value.split(",").pop() ?? "").trim().split(/\s+/)[0] ?? "" : value;
      if (raw) break;
    }
    const url = absolute(raw, baseUrl);
    if (!url) continue;
    const orderAttr =
      gallery.order === "attribute" && gallery.order_attribute
        ? Number(attrValue(attrs, gallery.order_attribute))
        : NaN;
    out.push({ url, order: Number.isFinite(orderAttr) ? orderAttr : indexBase + seen });
    seen += 1;
  }
  return out;
}

export type RuleGalleryResult = {
  urls: string[];
  /** How many slide elements the rules matched. */
  slides: number;
  reasons: string[];
};

/**
 * Extracts the carousel slides described by the manufacturer's verified rules.
 * No rule match ⇒ no image. Never scans the page generically.
 */
export function extractRuleGallery(
  html: string,
  baseUrl: string,
  entry: ManufacturerRules,
): RuleGalleryResult {
  const gallery = entry.gallery;
  const reasons: string[] = [];
  if (!entry.verified) {
    return { urls: [], slides: 0, reasons: [`règles fabricant non vérifiées pour ${entry.brand}`] };
  }

  const candidates: SlideCandidate[] = [];
  const containers = galleryContainers(html, gallery);
  containers.forEach((region, i) => candidates.push(...slidesFromRegion(region, baseUrl, gallery, i * 1000)));

  if (candidates.length === 0 && gallery.slides_self_identifying && gallery.slide_patterns.length > 0) {
    // Slides that prove their own membership (unique carousel attributes) may
    // be read outside a container — the page may render them flat. Feature,
    // related and marketing sections are still removed first, so an image
    // inside a "No Frost" block can never be read as a slide.
    const cleaned = stripExcludedSections(
      html,
      compile([...gallery.exclude_section_patterns, ...UNIVERSAL_EXCLUDED_SECTIONS]),
    );
    candidates.push(...slidesFromRegion(cleaned, baseUrl, gallery, 0));
  }
  if (candidates.length === 0) {
    reasons.push("carrousel officiel non identifié par les règles du fabricant");
    return { urls: [], slides: 0, reasons };
  }

  const mustMatch = compile(gallery.url_must_match);
  const mustNot = compile([...gallery.url_must_not_match, ...UNIVERSAL_EXCLUDED_URLS]);
  const kept = candidates
    .filter((c) => (mustMatch ? mustMatch.test(c.url) : true))
    .filter((c) => !(mustNot && mustNot.test(c.url)))
    .filter((c) => !/^data:/i.test(c.url) && !/\.(svg|gif|ico|bmp)(\?|#|$)/i.test(c.url));

  if (kept.length === 0) {
    reasons.push("les diapositives trouvées ne correspondent pas aux motifs d'images officiels");
    return { urls: [], slides: candidates.length, reasons };
  }

  const ordered = gallery.order === "attribute" ? [...kept].sort((a, b) => a.order - b.order) : kept;
  return { urls: ordered.map((c) => c.url), slides: kept.length, reasons };
}
