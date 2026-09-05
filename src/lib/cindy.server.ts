import type { MarketingSection, ProductSpec } from "./catalog-types";
import type { CindyEvent, CindySource, ResearchedProduct } from "./cindy-types";
import { extractProductGallery, dedupeGalleryUrls } from "./product-gallery";

/** Official manufacturer domains, used to flag/prioritize trustworthy sources. */
const OFFICIAL_DOMAINS: Record<string, string[]> = {
  samsung: ["samsung.com"],
  lg: ["lg.com"],
  bosch: ["bosch-home.com", "bosch-home.ma", "bosch.com"],
  siemens: ["siemens-home.bsh-group.com"],
  tcl: ["tcl.com"],
  whirlpool: ["whirlpool.com", "whirlpool.fr", "whirlpool.eu"],
  candy: ["candy.it", "candy-home.com", "candy.fr"],
  haier: ["haier.com", "haier-europe.com"],
  hisense: ["hisense.com"],
  beko: ["beko.com"],
  brandt: ["brandt.com"],
  electrolux: ["electrolux.com"],
  panasonic: ["panasonic.com"],
  sharp: ["sharp.eu", "sharp.com"],
  toshiba: ["toshiba-lifestyle.com"],
  midea: ["midea.com"],
};

const ALL_OFFICIAL = Object.values(OFFICIAL_DOMAINS).flat();

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function isOfficial(url: string, brandGuess: string) {
  const host = domainOf(url);
  const brand = brandGuess.trim().toLowerCase();
  const preferred = OFFICIAL_DOMAINS[brand];
  if (preferred?.some((d) => host.endsWith(d))) return true;
  return ALL_OFFICIAL.some((d) => host.endsWith(d));
}

/**
 * Ghandi Home Electro sells in Morocco: the manufacturer page we import from
 * must be the Moroccan / North-African one whenever it exists (right models,
 * right specifications, right public price in MAD).
 */
const REGION_HOST_SUFFIXES = [".ma", ".dz", ".tn", ".ly", ".eg", ".africa"];
const REGION_PATH_HINTS =
  /(^|[/_.-])(ma|maroc|morocco|dz|algerie|algeria|tn|tunisie|tunisia|africa|afrique|north[-_]?africa|n[-_]?africa|maghreb|levant|mea)([/_.-]|$)/i;

/** 2 = Morocco, 1 = other North Africa / Africa-FR, 0 = anywhere else. */
export function regionRank(url: string) {
  const host = domainOf(url).toLowerCase();
  let path = "";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = url.toLowerCase();
  }
  const moroccan =
    host.endsWith(".ma") ||
    /(^|[/_.-])(ma|maroc|morocco)([/_.-]|$)/i.test(path) ||
    /_ma([/_.-]|$)/i.test(path);
  if (moroccan) return 2;
  if (REGION_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)) || REGION_PATH_HINTS.test(path))
    return 1;
  return 0;
}

function guessBrand(query: string) {
  const lower = query.toLowerCase();
  for (const brand of Object.keys(OFFICIAL_DOMAINS)) {
    if (lower.includes(brand)) return brand;
  }
  return "";
}

export type SearchHit = { url: string; title: string; content: string };

export type SearchProvider = "tavily" | "serper" | "brave";

/** Provider + key + model are admin-configurable (site_settings), with env fallback. */
async function searchConfig(): Promise<{ provider: SearchProvider; key: string; model: string }> {
  let provider: SearchProvider = "serper";
  let key = "";
  let model = "search";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data }, { data: secrets }] = await Promise.all([
      supabaseAdmin
        .from("site_settings")
        .select("search_provider, search_model")
        .eq("id", "default")
        .maybeSingle(),
      supabaseAdmin.from("site_secrets").select("search_api_key").eq("id", "default").maybeSingle(),
    ]);
    const stored = (data?.search_provider ?? "serper") as SearchProvider;
    if (stored === "serper" || stored === "brave" || stored === "tavily") provider = stored;
    key = (secrets?.search_api_key ?? "").trim();
    model = (data?.search_model ?? "search").trim() || "search";
  } catch {
    /* fall back to env */
  }
  if (!key) {
    const envKey =
      provider === "serper"
        ? process.env["SERPER_API_KEY"]
        : provider === "brave"
          ? process.env["BRAVE_API_KEY"]
          : process.env["TAVILY_API_KEY"];
    key = (envKey ?? "").trim();
  }
  return { provider, key, model };
}

/** One request = one "search". Provider is swappable from the admin panel. */
export async function webSearch(
  query: string,
  opts: {
    max?: number;
    override?: { provider: SearchProvider; key: string; model?: string };
  } = {},
): Promise<SearchHit[]> {
  const config = opts.override
    ? { ...opts.override, model: opts.override.model ?? "search" }
    : await searchConfig();
  const { provider, key, model } = config;
  if (!key) throw new Error("SEARCH_NOT_CONFIGURED");
  const max = Math.min(opts.max ?? 10, 20);

  let res: Response;
  if (provider === "serper") {
    const endpoint = ["search", "news", "shopping"].includes(model) ? model : "search";
    res = await fetch(`https://google.serper.dev/${endpoint}`, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: max, gl: "ma", hl: "fr", location: "Morocco" }),
    });
  } else if (provider === "brave") {
    res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}&country=MA&search_lang=fr`,
      { headers: { "X-Subscription-Token": key, Accept: "application/json" } },
    );
  } else {
    res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, search_depth: "basic", max_results: max, country: "morocco" }),
    });
  }


  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) throw new Error("SEARCH_KEY_INVALID");
    throw new Error(`SEARCH_FAILED: ${res.status} ${text.slice(0, 160)}`);
  }

  const json = (await res.json()) as {
    results?: { url?: string; title?: string; content?: string }[];
    organic?: { link?: string; title?: string; snippet?: string }[];
    news?: { link?: string; title?: string; snippet?: string }[];
    shopping?: { link?: string; title?: string; source?: string }[];
    web?: { results?: { url?: string; title?: string; description?: string }[] };
  };
  const raw: { url: string | undefined; title: string | undefined; content: string | undefined }[] =
    provider === "serper"
      ? [
          ...(json.organic ?? []).map((r) => ({ url: r.link, title: r.title, content: r.snippet })),
          ...(json.news ?? []).map((r) => ({ url: r.link, title: r.title, content: r.snippet })),
          ...(json.shopping ?? []).map((r) => ({ url: r.link, title: r.title, content: r.source })),
        ]
      : provider === "brave"
        ? (json.web?.results ?? []).map((r) => ({
            url: r.url,
            title: r.title,
            content: r.description,
          }))
        : (json.results ?? []).map((r) => ({
            url: r.url,
            title: r.title,
            content: r.content,
          }));

  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r.url || !/^https?:\/\//.test(r.url) || seen.has(r.url)) continue;
    seen.add(r.url);
    hits.push({ url: r.url, title: r.title ?? domainOf(r.url), content: r.content ?? "" });
    if (hits.length >= max) break;
  }
  return hits;
}

/** Lightweight connectivity test used by the admin "changer l'API" panel. */
export async function testSearchProvider(provider: SearchProvider, key: string, model = "search") {
  try {
    const hits = await webSearch("samsung refrigerateur", {
      max: 3,
      override: { provider, key, model },
    });
    return { ok: hits.length > 0, results: hits.length, message: "" };
  } catch (error) {
    return {
      ok: false,
      results: 0,
      message: error instanceof Error ? error.message : "SEARCH_FAILED",
    };
  }
}




/** Reads a page directly (no search credit) and returns its text plus image URLs. */
export async function readPage(
  url: string,
): Promise<{ text: string; images: string[]; links: { url: string; text: string }[] }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept-Language": "fr,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`PAGE_FAILED: ${res.status}`);
  const html = await res.text();

  const images: string[] = [];
  const push = (raw: string) => {
    try {
      const abs = new URL(raw.trim(), url).toString();
      if (!/^https?:\/\//.test(abs)) return;
      if (/\.(svg|gif)(\?|$)/i.test(abs)) return;
      if (/sprite|logo|icon|placeholder|pixel|tracking/i.test(abs)) return;
      if (!images.includes(abs)) images.push(abs);
    } catch {
      /* ignore malformed image url */
    }
  };
  for (const m of html.matchAll(
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
  ))
    push(m[1] ?? "");
  for (const m of html.matchAll(/<img[^>]+(?:data-src|data-original|src)=["']([^"']+)["']/gi))
    push(m[1] ?? "");
  for (const m of html.matchAll(/<source[^>]+srcset=["']([^"']+)["']/gi)) {
    const first = (m[1] ?? "").split(",")[0]?.trim().split(/\s+/)[0];
    if (first) push(first);
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const links: { url: string; text: string }[] = [];
  const pushLink = (rawUrl: string, label = "") => {
    try {
      const abs = new URL(rawUrl.trim(), url).toString();
      if (!/^https?:\/\//.test(abs)) return;
      const clean = abs.replace(/#.*$/, "");
      if (links.some((link) => link.url.replace(/#.*$/, "") === clean)) return;
      links.push({ url: abs, text: label.replace(/\s+/g, " ").trim() });
    } catch {
      /* ignore malformed link */
    }
  };
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    const label = (m[2] ?? "").replace(/<[^>]+>/g, " ");
    pushLink(m[1] ?? "", label);
    if (links.length >= 220) break;
  }

  // Many manufacturer listings (notably Samsung) render product cards with
  // JavaScript. Their raw HTML contains the products only in JSON-LD, so the
  // ordinary anchor scan above sees navigation links but no product pages.
  const visitStructuredData = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visitStructuredData);
      return;
    }
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    const type = Array.isArray(item["@type"])
      ? item["@type"].map(String)
      : [String(item["@type"] ?? "")];
    if (type.some((entry) => entry.toLowerCase() === "product")) {
      const productUrl = String(item["url"] ?? item["@id"] ?? "");
      if (productUrl) pushLink(productUrl, String(item["name"] ?? ""));
    }
    Object.values(item).forEach(visitStructuredData);
  };
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visitStructuredData(JSON.parse((match[1] ?? "").trim()));
    } catch {
      /* ignore invalid third-party structured data */
    }
  }

  // Some product grids are serialized in application state instead of being
  // rendered as anchors or JSON-LD. Recover same-site descendant URLs from
  // that state so the crawler does not depend on a storefront's UI markup.
  try {
    const listingUrl = new URL(url);
    const listingPath = listingUrl.pathname.endsWith("/")
      ? listingUrl.pathname
      : `${listingUrl.pathname}/`;
    const escapedHost = listingUrl.hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const absoluteUrlPattern = new RegExp(
      `https?:\\\\?\\/\\\\?\\/${escapedHost}[^"'<>\\s\\\\]*`,
      "gi",
    );
    for (const match of html.matchAll(absoluteUrlPattern)) {
      const raw = (match[0] ?? "").replace(/\\\//g, "/").replace(/\\u002F/gi, "/");
      const candidate = new URL(raw);
      const remainder = candidate.pathname.startsWith(listingPath)
        ? candidate.pathname.slice(listingPath.length).replace(/^\/+|\/+$/g, "")
        : "";
      if (!remainder || /\.(?:jpe?g|png|webp|svg|gif)$/i.test(candidate.pathname)) continue;
      pushLink(candidate.toString(), remainder.split("/").filter(Boolean).at(-1) ?? remainder);
    }
  } catch {
    /* ordinary links remain available as fallback */
  }

  // Samsung's category pages only server-render the first product. The rest
  // come from Samsung's own public product-finder feed after hydration. Read
  // the feed configuration embedded in the page, resolve the category slug to
  // its filter code, then add every returned PDP URL to the normal link pool.
  // This stays deterministic and does not spend a search-provider request.
  try {
    const listingUrl = new URL(url);
    if (/(^|\.)samsung\.com$/i.test(listingUrl.hostname)) {
      const inputValue = (name: string) => {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const match = html.match(
          new RegExp(
            `<input[^>]+name=["']${escapedName}["'][^>]+value=["']([^"']*)["']|<input[^>]+value=["']([^"']*)["'][^>]+name=["']${escapedName}["']`,
            "i",
          ),
        );
        return (match?.[1] ?? match?.[2] ?? "").trim();
      };
      const type = inputValue("pfCategoryTypeCode");
      const categorySlug = inputValue("pfDefaultParameter");
      const siteCode = listingUrl.pathname.split("/").filter(Boolean)[0] ?? "";
      const countryCode = inputValue("countryCode").toLowerCase();
      if (type && categorySlug && siteCode) {
        const endpoint = "https://searchapi.samsung.com/v6/front/b2c/product/finder/global";
        const commonParams = new URLSearchParams({
          type,
          siteCode,
          start: "1",
          num: "30",
          sort: "recommended",
          keySummaryYN: "Y",
          ...(countryCode ? { shopSiteCode: countryCode } : {}),
        });
        const filtersResponse = await fetch(
          `${endpoint}?${new URLSearchParams({
            ...Object.fromEntries(commonParams),
            onlyFilterInfoYN: "Y",
          })}`,
        );
        if (filtersResponse.ok) {
          const filtersJson = (await filtersResponse.json()) as {
            response?: {
              resultData?: {
                navGroups?: {
                  productFinderFilter?: {
                    filterRegName?: string;
                    filterSearchCode?: string;
                  }[];
                }[];
              };
            };
          };
          const categoryFilter = filtersJson.response?.resultData?.navGroups
            ?.flatMap((group) => group.productFinderFilter ?? [])
            .find((filter) => filter.filterRegName === categorySlug)?.filterSearchCode;
          commonParams.set("onlyFilterInfoYN", "N");
          if (categoryFilter) commonParams.set("filter1", categoryFilter);
          {
            const productsResponse = await fetch(`${endpoint}?${commonParams}`);
            if (productsResponse.ok) {
              const productsJson = (await productsResponse.json()) as {
                response?: {
                  resultData?: {
                    productList?: {
                      modelList?: {
                        pdpUrl?: string;
                        originPdpUrl?: string;
                        displayName?: string;
                        modelCode?: string;
                      }[];
                    }[];
                  };
                };
              };
              for (const family of productsJson.response?.resultData?.productList ?? []) {
                for (const model of family.modelList ?? []) {
                  const productUrl = model.pdpUrl ?? model.originPdpUrl ?? "";
                  if (!productUrl) continue;
                  pushLink(
                    productUrl,
                    [model.displayName, model.modelCode].filter(Boolean).join(" · "),
                  );
                }
              }
            }
          }
        }
      }
    }
  } catch {
    // Manufacturer feeds are an enhancement; preserve HTML/search fallbacks.
  }

  return { text, images: images.slice(0, 24), links };
}

/* ===================== Product gallery (official slideshow) ==================== */

const alnum = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

/** Same picture served at several sizes/queries counts once. */
export function dedupeImages(urls: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const url = (raw ?? "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    let key = url.toLowerCase();
    try {
      const parsed = new URL(url);
      key = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
    } catch {
      /* keep the raw key */
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

/** Junk that is never part of a product's own slideshow. */
const NON_GALLERY =
  /(logo|icon|sprite|favicon|banner|promo|promotion|hero-?banner|advert|badge|award|social|arrow|chevron|placeholder|pixel|tracking|thumbnail-nav|related|recommend|you-?may|cross-?sell|blog|newsletter|footer|header|menu|nav-|payment|flag)/i;

/**
 * DEPRECATED shim — kept only so older call sites keep working.
 *
 * The authoritative gallery is `extractProductGallery()` in
 * `src/lib/product-gallery.ts`: the product's own slideshow, in its original
 * order, with no page-wide image scanning. This wrapper simply delegates there,
 * so nothing in the codebase can produce a "generic page images" gallery.
 */
export function extractGalleryImages(html: string, baseUrl: string, reference: string): string[] {
  return extractProductGallery(html, baseUrl, { model: reference }).images;
}

/**
 * Reads the manufacturer's own public price from the official page:
 * JSON-LD `offers.price` first (the manufacturer's structured data), then the
 * usual price meta tags, then a MAD/DH amount written in the page text.
 * Nothing is invented: when the official page shows no price, this returns null.
 */
export function extractOfficialPrice(html: string): { price: number | null; currency: string } {
  const clean = (raw: string) => {
    const value = raw.replace(/\s|\u00a0/g, "").replace(/[^0-9.,]/g, "");
    if (!value) return null;
    // "12 499,00" / "12,499.00" → 12499
    const normalized = value.replace(/,(\d{1,2})$/, ".$1").replace(/[,\s](?=\d{3})/g, "");
    const parsed = Number(normalized.replace(/,/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  };

  let price: number | null = null;
  let currency = "";

  const visit = (value: unknown) => {
    if (price !== null) return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    const candidate = item["price"] ?? item["lowPrice"] ?? item["highPrice"];
    if (candidate !== undefined && candidate !== null) {
      const parsed = clean(String(candidate));
      if (parsed) {
        price = parsed;
        currency = String(item["priceCurrency"] ?? currency ?? "");
        return;
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
    if (price !== null) break;
  }

  if (price === null) {
    const meta = html.match(
      /<meta[^>]+(?:property|name|itemprop)=["'](?:product:price:amount|og:price:amount|price)["'][^>]+content=["']([^"']+)["']/i,
    );
    if (meta) price = clean(meta[1] ?? "");
    const metaCurrency = html.match(
      /<meta[^>]+(?:property|name|itemprop)=["'](?:product:price:currency|og:price:currency|priceCurrency)["'][^>]+content=["']([^"']+)["']/i,
    );
    if (metaCurrency) currency = currency || (metaCurrency[1] ?? "");
  }

  if (price === null) {
    const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    const inText = text.match(
      /(\d[\d\s.,\u00a0]{2,12})\s*(?:MAD|DHS?|DH|Dirhams?)\b|(?:MAD|DHS?|DH)\s*(\d[\d\s.,\u00a0]{2,12})/i,
    );
    if (inText) {
      price = clean(inText[1] ?? inText[2] ?? "");
      currency = currency || "MAD";
    }
  }

  const normalizedCurrency = /^(MAD|DH|DHS)$/i.test(currency.trim())
    ? "MAD"
    : currency.trim().toUpperCase();
  return { price, currency: price === null ? "" : normalizedCurrency || "MAD" };
}

/**
 * Reads one official product page: page text, its own gallery, and whether the
 * exact requested reference really appears on it (identity verification).
 */
export async function readProductPage(url: string, reference: string) {
  // Retrieval with the legitimate fallback chain (403 / JavaScript-rendered
  // official pages included). Failure is reported as OFFICIAL_PAGE_INACCESSIBLE
  // with the exact URL: never replaced by another source.
  const { fetchOfficialPage, htmlToText } = await import("./page-fetch.server");
  const page = await fetchOfficialPage(url);
  const html = page.html;
  const text = htmlToText(html);

  const ref = alnum(reference);
  const matchesReference =
    ref.length < 4 || alnum(text).includes(ref) || alnum(decodeURIComponent(url)).includes(ref);

  // Identity survival: a redirect or a rendered page must still be THIS product.
  const { checkPageIdentity } = await import("./page-identity");
  const identityCheck = checkPageIdentity({
    requestedUrl: url,
    finalUrl: page.finalUrl,
    html,
    pageText: text,
    identity: { model: reference },
  });

  const { price, currency } = extractOfficialPrice(html);

  // THE gallery: the product's own slideshow only.
  const gallery = extractProductGallery(html, page.finalUrl || url, { model: reference });

  return {
    html,
    text,
    gallery: gallery.images,
    gallerySource: gallery.source,
    fetchMethod: page.method,
    finalUrl: page.finalUrl,
    identityOk: identityCheck.ok,
    identityReason: identityCheck.reason,
    matchesReference,
    price,
    currency,
  };
}


/**
 * Understands short admin input like "RB34T672EWW, Samsung" or "Samsung RB34T672EWW":
 * the brand token is matched against the known manufacturers, the remaining
 * alphanumeric token that looks like a model code becomes the exact reference.
 */
export function parseProductQuery(query: string): { brand: string; reference: string } {
  const tokens = query
    .split(/[,;\n]+|\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  let brand = "";
  const rest: string[] = [];
  for (const token of tokens) {
    const key = token.toLowerCase().replace(/[^a-z]/g, "");
    if (!brand && key && OFFICIAL_DOMAINS[key]) {
      brand = key;
      continue;
    }
    rest.push(token);
  }
  const looksLikeModel = (token: string) => {
    const value = token.replace(/[^A-Za-z0-9-]/g, "");
    return value.length >= 4 && /\d/.test(value) && /[A-Za-z]/.test(value);
  };
  const reference = rest.find(looksLikeModel) ?? rest.join(" ").trim();
  return { brand, reference };
}

/** Stable cache key: brand/model characters only, so casing and spacing never miss. */
export function cacheKeyOf(query: string) {
  return query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}


const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["brand", "name", "model", "characteristics", "specifications", "confidence", "notes"],
  properties: {
    brand: { type: "string" },
    name: { type: "string" },
    model: { type: "string" },
    characteristics: { type: "string" },
    specifications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value"],
        properties: { label: { type: "string" }, value: { type: "string" } },
      },
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: "string" },
  },
} as const;

/**
 * Turns the official page text into structured product data.
 * Images are NEVER chosen by the model: the gallery passed in (scraped from the
 * product's own slideshow) is used as-is, in order, without any limit.
 */
export async function extractProductFromSources(input: {
  query: string;
  sources: { url: string; title: string; content: string }[];
  images: string[];
  /** Public price read from the official page (never invented by the model). */
  price?: number | null;
  currency?: string;
}): Promise<ResearchedProduct> {
  const { aiSetup, aiFailure, aiFetchWithRetry } = await import("./ai-config.server");
  const ai = await aiSetup();

  const corpus = input.sources
    .map(
      (s, i) =>
        `### SOURCE ${i + 1}\nURL: ${s.url}\nTITRE: ${s.title}\nCONTENU:\n${s.content.slice(0, 14000)}`,
    )
    .join("\n\n");

  const system =
    "Tu es Cindy, assistante de recherche produit pour un magasin d'électroménager marocain. " +
    "Tu extrais UNIQUEMENT des informations présentes dans les sources fournies (pages officielles du fabricant). " +
    "N'invente jamais une donnée: si une information est absente, ne la mets pas. " +
    "N'inclus JAMAIS de prix, de stock ou d'information commerciale. " +
    "Réponds en JSON. Rédige en français. Les 'characteristics' sont une liste courte à puces (une par ligne, préfixée par '- '). " +
    "Les 'specifications' sont TOUTES les paires label/valeur techniques trouvées (capacité, dimensions, classe énergétique, consommation, niveau sonore, etc.). " +
    "'model' est la référence exacte du modèle telle qu'écrite sur la page officielle.";

  const res = await aiFetchWithRetry(ai.url, {
    method: "POST",
    headers: ai.headers,
    body: JSON.stringify({
      model: ai.model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Référence demandée par l'admin: "${input.query}"\n\n${corpus}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "product", strict: true, schema: EXTRACTION_SCHEMA },
      },
    }),
  });

  if (!res.ok) throw await aiFailure(res);

  const payload = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = (payload.choices?.[0]?.message?.content ?? "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  if (!content.trim()) throw new Error("AI_EMPTY");
  const parsed = JSON.parse(content) as {
    brand: string;
    name: string;
    model: string;
    characteristics: string;
    specifications: ProductSpec[];
    confidence: "high" | "medium" | "low";
    notes: string;
  };

  return {
    brand: parsed.brand ?? "",
    name: parsed.name ?? input.query,
    model: parsed.model ?? "",
    characteristics: parsed.characteristics ?? "",
    specifications: parsed.specifications ?? [],
    // Original manufacturer slideshow images, all of them, deduplicated only.
    images: dedupeImages(input.images),
    // Stock is always 0 on import (the admin owns availability); the price is
    // the manufacturer's own public price, read from the official page.
    price: input.price ?? null,
    currency: input.currency ?? "",
    marketing_sections: [],
    sources: [],
    confidence: parsed.confidence ?? "medium",
    notes: parsed.notes ?? "",
  };
}


// ===================== Research cache (Supabase) =====================

type CacheRow = {
  id: string;
  cache_key: string;
  query: string;
  product: ResearchedProduct;
  hits: number;
  searches_used: number;
  updated_at: string;
};

async function cacheLookup(key: string): Promise<CacheRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("cindy_cache")
    .select("id, cache_key, query, product, hits, searches_used, updated_at")
    .eq("cache_key", key)
    .maybeSingle();
  return (data as CacheRow | null) ?? null;
}

async function cacheTouch(row: CacheRow) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("cindy_cache")
    .update({ hits: (row.hits ?? 0) + 1 })
    .eq("id", row.id);
}

async function cacheSave(input: {
  key: string;
  query: string;
  product: ResearchedProduct;
  images: string[];
  searchesUsed: number;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("cindy_cache").upsert(
    {
      cache_key: input.key,
      query: input.query,
      brand: input.product.brand,
      model: input.product.model,
      product: JSON.parse(JSON.stringify(input.product)),
      sources: JSON.parse(JSON.stringify(input.product.sources)),
      images: input.images,
      searches_used: input.searchesUsed,
      hits: 0,
    },
    { onConflict: "cache_key" },
  );
}

/** Admin-only: forget a cached product so the next request researches it again. */
export async function clearCachedResearch(query: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("cindy_cache").delete().eq("cache_key", cacheKeyOf(query));
}

export async function listCachedResearch() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("cindy_cache")
    .select("id, query, brand, model, hits, searches_used, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

// ===================== Research pipeline =====================

/** True when the extracted product is too thin to publish without more sources. */
function missingEssentials(product: ResearchedProduct) {
  const missing: string[] = [];
  if (!product.name.trim()) missing.push("nom");
  if (!product.characteristics.trim()) missing.push("caractéristiques");
  if (product.specifications.length < 4) missing.push("spécifications");
  if (product.images.length === 0) missing.push("images");
  return missing;
}

/** Only official manufacturer pages are ever considered as a data source. */
function officialOnly(hits: SearchHit[], brandGuess: string, officialDomains: string[]) {
  const allowed = officialDomains.length ? officialDomains : ALL_OFFICIAL;
  return hits
    .filter((hit) => allowed.some((domain) => domainOf(hit.url).endsWith(domain)))
    .filter((hit) => !/support|forum|review|avis|blog|community|news|press/i.test(hit.url))
    .sort((a, b) => score(b) - score(a));

  function score(hit: SearchHit) {
    let value = regionRank(hit.url) * 200;
    if (officialDomains.some((d) => domainOf(hit.url).endsWith(d))) value += 100;
    else if (isOfficial(hit.url, brandGuess)) value += 50;
    if (/\/(?:products?|produits?|p)\//i.test(hit.url)) value += 15;
    return value;
  }
}

/**
 * Exact-reference research, official sources only.
 *
 * "RB34T672EWW, Samsung" → brand Samsung + reference RB34T672EWW → the official
 * Samsung product page → page data + the product's ORIGINAL gallery (all images).
 * No marketplace, no retailer, no blog, no image generation, no guessing: when
 * the official page for that exact reference is not found, Cindy says so.
 */
export async function researchProduct(
  query: string,
  emit: (event: CindyEvent) => void,
  options: { force?: boolean } = {},
) {
  const parsed = parseProductQuery(query);
  const brandGuess = parsed.brand || guessBrand(query);
  const reference = parsed.reference || query.trim();
  const officialDomains = brandGuess ? (OFFICIAL_DOMAINS[brandGuess] ?? []) : [];
  const key = cacheKeyOf(query);
  let searchesUsed = 0;

  // ---- 0. Cache first: no network call at all when the product is known ----
  emit({
    type: "activity",
    id: "c0",
    kind: "cache",
    label: "Mémoire",
    detail: "Vérification des recherches déjà effectuées",
    status: "running",
  });

  const cached = options.force ? null : await cacheLookup(key);
  if (cached) {
    emit({
      type: "activity",
      id: "c0",
      kind: "cache",
      label: "Mémoire",
      detail: `Déjà étudié le ${new Date(cached.updated_at).toLocaleDateString("fr-FR")} — 0 recherche web`,
      status: "done",
    });
    const product = cached.product;
    for (const source of product.sources ?? [])
      emit({
        type: "source",
        source: {
          url: source.url,
          domain: source.name,
          title: source.name,
          official: source.official,
          status: "En mémoire",
        },
      });
    emit({ type: "checklist", label: "Nom du produit", done: Boolean(product.name) });
    emit({ type: "checklist", label: "Caractéristiques", done: Boolean(product.characteristics) });
    emit({ type: "checklist", label: "Spécifications", done: product.specifications.length > 0 });
    emit({ type: "checklist", label: "Images d'origine", done: product.images.length > 0 });
    emit({ type: "result", product, cached: true });
    emit({
      type: "message",
      text: "J'avais déjà étudié ce produit : je réutilise ma fiche, sans aucune recherche web. Dites-moi « recherche à nouveau » si vous voulez que je reprenne la recherche depuis zéro.",
    });
    await cacheTouch(cached);
    return product;
  }

  emit({
    type: "activity",
    id: "c0",
    kind: "cache",
    label: "Mémoire",
    detail: options.force ? "Nouvelle recherche demandée" : "Produit inconnu, je le recherche une fois",
    status: "done",
  });

  emit({
    type: "message",
    text: `Référence ${reference}${brandGuess ? ` — marque ${brandGuess}` : ""}. Je cherche uniquement la page officielle du fabricant, puis j'en extrais les informations et le diaporama d'images d'origine.`,
  });

  // ---- 1. ONE exact-reference search, restricted to official domains ----
  emit({
    type: "activity",
    id: "s1",
    kind: "search",
    label: "Recherche officielle (1)",
    detail: officialDomains.length
      ? `"${reference}" sur ${officialDomains[0]} (Maroc / Afrique du Nord)`
      : `"${reference}" (Maroc / Afrique du Nord)`,
    status: "running",
  });
  // Morocco / North Africa first: same reference, but the regional official page.
  const rawHits = await webSearch(
    officialDomains.length
      ? `"${reference}" site:${officialDomains[0]} Maroc`
      : `"${reference}" site officiel Maroc`,
    { max: 10 },
  );
  searchesUsed += 1;
  let pool = officialOnly(rawHits, brandGuess, officialDomains);
  emit({
    type: "activity",
    id: "s1",
    kind: "search",
    label: "Recherche officielle (1)",
    detail: `${pool.length} page(s) officielle(s)`,
    status: pool.length ? "done" : "error",
  });

  if (pool.length === 0) {
    // A second, still official-only attempt with the brand name spelled out.
    emit({
      type: "activity",
      id: "s1b",
      kind: "search",
      label: "Recherche officielle (2)",
      detail: `${brandGuess || ""} ${reference} site officiel`.trim(),
      status: "running",
    });
    pool = officialOnly(
      await webSearch(`${brandGuess} ${reference} site officiel`.trim(), { max: 10 }),
      brandGuess,
      officialDomains,
    );
    searchesUsed += 1;
    emit({
      type: "activity",
      id: "s1b",
      kind: "search",
      label: "Recherche officielle (2)",
      detail: `${pool.length} page(s) officielle(s)`,
      status: pool.length ? "done" : "error",
    });
  }

  if (pool.length === 0) {
    emit({
      type: "error",
      message: `Je n'ai pas trouvé la page officielle du fabricant pour « ${reference} ». Je n'utilise aucune autre source (revendeurs, marketplaces, blogs) : vérifiez la référence ou donnez-moi le lien officiel.`,
    });
    return null;
  }

  // ---- 2. Read official pages until the exact reference is verified ----
  const sources: CindySource[] = [];
  const pages: { url: string; title: string; content: string }[] = [];
  let gallery: string[] = [];
  let officialPrice: number | null = null;
  let officialCurrency = "";
  const rejected: string[] = [];

  for (const [index, hit] of pool.entries()) {
    if (pages.length > 0) break;
    const activityId = `p${index}`;
    emit({
      type: "activity",
      id: activityId,
      kind: "open",
      label: "Ouverture de la page officielle",
      detail: domainOf(hit.url),
      status: "running",
    });
    try {
      const page = await readProductPage(hit.url, reference);
      if (!page.matchesReference) {
        rejected.push(domainOf(hit.url));
        emit({
          type: "activity",
          id: activityId,
          kind: "compare",
          label: "Page écartée",
          detail: `${domainOf(hit.url)} — la référence ${reference} n'y figure pas`,
          status: "error",
        });
        continue;
      }
      pages.push({ url: hit.url, title: hit.title, content: page.text });
      // Authoritative slideshow of the official page, nothing page-wide.
      gallery = dedupeGalleryUrls([...gallery, ...page.gallery]);
      if (officialPrice === null && page.price !== null) {
        officialPrice = page.price;
        officialCurrency = page.currency;
      }
      sources.push({
        url: hit.url,
        domain: domainOf(hit.url),
        title: hit.title || domainOf(hit.url),
        official: true,
        status: "Page officielle vérifiée",
      });
      emit({
        type: "activity",
        id: activityId,
        kind: "images",
        label: "Diaporama d'origine récupéré",
        detail: `${domainOf(hit.url)} — ${page.gallery.length} image(s) du produit`,
        status: "done",
      });
      emit({ type: "source", source: sources[sources.length - 1]! });
    } catch {
      emit({
        type: "activity",
        id: activityId,
        kind: "open",
        label: "Ouverture",
        detail: `${domainOf(hit.url)} illisible`,
        status: "error",
      });
    }
  }

  if (pages.length === 0) {
    emit({
      type: "error",
      message: `Aucune page officielle ne correspond exactement à « ${reference} »${rejected.length ? ` (pages écartées : ${rejected.join(", ")})` : ""}. Je préfère m'arrêter plutôt que d'importer un modèle voisin.`,
    });
    return null;
  }

  // ---- 3. Extract everything from that official page ----
  emit({
    type: "activity",
    id: "x1",
    kind: "extract",
    label: "Extraction",
    detail: "Informations de la page officielle",
    status: "running",
  });
  const product = await extractProductFromSources({
    query: reference,
    sources: pages,
    images: gallery,
    price: officialPrice,
    currency: officialCurrency,
  });
  if (brandGuess && !product.brand) product.brand = brandGuess;
  if (!product.model) product.model = reference;
  emit({
    type: "activity",
    id: "x1",
    kind: "extract",
    label: "Extraction",
    detail: `${product.specifications.length} spécification(s), ${product.images.length} image(s) d'origine`,
    status: "done",
  });

  const missing = missingEssentials(product);
  if (missing.length > 0)
    emit({
      type: "message",
      text: `Attention : sur la page officielle il me manque ${missing.join(", ")}. Je n'invente rien et je ne vais pas chercher ailleurs.`,
    });

  product.sources = sources.map((s) => ({ name: s.domain, url: s.url, official: s.official }));

  emit({ type: "checklist", label: "Référence exacte vérifiée", done: true });
  emit({ type: "checklist", label: "Source officielle", done: true });
  emit({
    type: "checklist",
    label:
      regionRank(sources[0]!.url) >= 2
        ? "Page officielle Maroc"
        : regionRank(sources[0]!.url) === 1
          ? "Page officielle Afrique du Nord"
          : "Page officielle (aucune version Maroc trouvée)",
    done: regionRank(sources[0]!.url) >= 1,
  });
  emit({
    type: "checklist",
    label: product.price === null
      ? "Prix constructeur non affiché sur la page"
      : `Prix constructeur ${product.price} ${product.currency || "MAD"}`,
    done: product.price !== null,
  });
  emit({ type: "checklist", label: "Nom du produit", done: Boolean(product.name) });
  emit({ type: "checklist", label: "Caractéristiques", done: Boolean(product.characteristics) });
  emit({ type: "checklist", label: "Spécifications", done: product.specifications.length > 0 });
  emit({
    type: "checklist",
    label: `Images d'origine (${product.images.length})`,
    done: product.images.length > 0,
  });

  await cacheSave({ key, query, product, images: product.images, searchesUsed });

  emit({ type: "result", product, cached: false });
  emit({
    type: "message",
    text: `Terminé avec ${searchesUsed} recherche${searchesUsed > 1 ? "s" : ""} web, uniquement sur ${sources[0]!.domain}. ${product.images.length} image(s) d'origine conservée(s). Je garde cette fiche en mémoire.`,
  });

  return product;
}

