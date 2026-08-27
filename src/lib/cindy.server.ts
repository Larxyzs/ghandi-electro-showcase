import type { MarketingSection, ProductSpec } from "./catalog-types";
import type { CindyEvent, CindySource, ResearchedProduct } from "./cindy-types";

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
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("search_provider, search_api_key, search_model")
      .eq("id", "default")
      .maybeSingle();
    const stored = (data?.search_provider ?? "serper") as SearchProvider;
    if (stored === "serper" || stored === "brave" || stored === "tavily") provider = stored;
    key = (data?.search_api_key ?? "").trim();
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
async function searxSearch(
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
      body: JSON.stringify({ q: query, num: max }),
    });
  } else if (provider === "brave") {
    res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}`,
      { headers: { "X-Subscription-Token": key, Accept: "application/json" } },
    );
  } else {
    res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, search_depth: "basic", max_results: max }),
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
    web?: { results?: { url?: string; title?: string; description?: string }[] };
  };
  const raw: { url: string | undefined; title: string | undefined; content: string | undefined }[] =
    provider === "serper"
      ? (json.organic ?? []).map((r) => ({ url: r.link, title: r.title, content: r.snippet }))
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
export async function testSearchProvider(provider: SearchProvider, key: string) {
  try {
    const hits = await searxSearch("samsung refrigerateur", { max: 3, override: { provider, key } });
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
async function readPage(url: string): Promise<{ text: string; images: string[] }> {
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

  return { text, images: images.slice(0, 24) };
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
  required: [
    "brand",
    "name",
    "model",
    "characteristics",
    "specifications",
    "images",
    "marketing_sections",
    "confidence",
    "notes",
  ],
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
    images: { type: "array", items: { type: "string" } },
    marketing_sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "body", "image", "images"],
        properties: {
          type: { type: "string", enum: ["image_text", "feature", "overlay", "full_image", "specs"] },
          title: { type: "string" },
          body: { type: "string" },
          image: { type: "string" },
          images: { type: "array", items: { type: "string" } },
        },
      },
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: "string" },
  },
} as const;

type RawSection = {
  type: string;
  title: string;
  body: string;
  image: string;
  images: string[];
};

function normalizeSections(raw: RawSection[], images: string[]): MarketingSection[] {
  const out: MarketingSection[] = [];
  raw.forEach((section, index) => {
    const image = section.image || images[index % Math.max(images.length, 1)] || "";
    switch (section.type) {
      case "image_text":
        if (image && section.title)
          out.push({
            type: "image_text",
            image,
            title: section.title,
            body: section.body,
            reverse: index % 2 === 1,
          });
        break;
      case "overlay":
        if (image && section.title)
          out.push({ type: "overlay", image, title: section.title, body: section.body });
        break;
      case "full_image":
        if (image)
          out.push({
            type: "full_image",
            image,
            ...(section.title ? { title: section.title } : {}),
            ...(section.body ? { body: section.body } : {}),
          });
        break;
      case "specs":
        out.push({ type: "specs", ...(section.title ? { title: section.title } : {}) });
        break;
      default:
        if (section.title) out.push({ type: "feature", title: section.title, body: section.body });
    }
  });
  return out;
}

async function extractWithAI(input: {
  query: string;
  sources: { url: string; title: string; content: string }[];
  images: string[];
}): Promise<ResearchedProduct> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI_NOT_CONFIGURED");

  const corpus = input.sources
    .map(
      (s, i) =>
        `### SOURCE ${i + 1}\nURL: ${s.url}\nTITRE: ${s.title}\nCONTENU:\n${s.content.slice(0, 12000)}`,
    )
    .join("\n\n");

  const system =
    "Tu es Cindy, assistante de recherche produit pour un magasin d'électroménager marocain. " +
    "Tu extrais UNIQUEMENT des informations présentes dans les sources fournies. " +
    "N'invente jamais une donnée: si une information est absente, ne la mets pas. " +
    "N'inclus JAMAIS de prix, de stock ou d'information commerciale. " +
    "Réponds en JSON. Rédige en français. Les 'characteristics' sont une liste courte à puces (une par ligne, préfixée par '- '). " +
    "Les 'specifications' sont des paires label/valeur techniques (capacité, dimensions, classe énergétique, consommation, niveau sonore, etc.). " +
    "Les 'marketing_sections' sont 2 à 5 blocs de présentation premium basés sur les vraies fonctionnalités du produit; " +
    "utilise uniquement les URLs d'images fournies. Termine toujours par un bloc de type 'specs'.";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      stream: true,
      store: false,
      instructions: system,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Référence demandée par l'admin: "${input.query}"\n\nImages disponibles (URLs réelles):\n${input.images.slice(0, 8).join("\n") || "(aucune)"}\n\n${corpus}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "product",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI_RATE_LIMITED");
    if (res.status === 402) throw new Error("AI_CREDITS");
    throw new Error(`AI_FAILED: ${res.status} ${text.slice(0, 200)}`);
  }

  // Streaming is required on this endpoint; we only need the final text.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (event.type === "response.output_text.delta" && event.delta) content += event.delta;
        else if (event.type === "response.completed" && event.response?.output_text)
          content = event.response.output_text;
      } catch {
        /* ignore malformed chunk */
      }
    }
  }

  if (!content.trim()) throw new Error("AI_EMPTY");
  const parsed = JSON.parse(content) as {
    brand: string;
    name: string;
    model: string;
    characteristics: string;
    specifications: ProductSpec[];
    images: string[];
    marketing_sections: RawSection[];
    confidence: "high" | "medium" | "low";
    notes: string;
  };

  const allowed = new Set(input.images);
  const images = (parsed.images ?? []).filter((u) => allowed.has(u));
  const finalImages = images.length ? images : input.images.slice(0, 6);

  return {
    brand: parsed.brand ?? "",
    name: parsed.name ?? input.query,
    model: parsed.model ?? "",
    characteristics: parsed.characteristics ?? "",
    specifications: parsed.specifications ?? [],
    images: finalImages,
    marketing_sections: normalizeSections(parsed.marketing_sections ?? [], finalImages),
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

function rankHits(hits: SearchHit[], brandGuess: string, officialDomains: string[]) {
  return [...hits].sort((a, b) => score(b) - score(a));
  function score(hit: SearchHit) {
    const host = domainOf(hit.url);
    let value = 0;
    if (officialDomains.some((d) => host.endsWith(d))) value += 100;
    else if (isOfficial(hit.url, brandGuess)) value += 60;
    if (/support|forum|review|avis|blog|youtube|facebook|pinterest/i.test(hit.url)) value -= 40;
    if (/fiche|spec|technique|product|produit/i.test(hit.url)) value += 10;
    return value;
  }
}

/**
 * Economical research: cache first, then ONE search, then read the best official
 * page and stop. A second search only runs when essential data is still missing.
 * Every emitted step corresponds to a network call that really happened.
 */
export async function researchProduct(
  query: string,
  emit: (event: CindyEvent) => void,
  options: { force?: boolean } = {},
) {
  const brandGuess = guessBrand(query);
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
    emit({ type: "checklist", label: "Images", done: product.images.length > 0 });
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
    text: `Je fais une seule recherche sur « ${query} », j'ouvre la page officielle du fabricant et j'en extrais tout.`,
  });

  // ---- 1. ONE exact-reference search ----
  emit({ type: "activity", id: "s1", kind: "search", label: "Recherche (1)", detail: query, status: "running" });
  const hits = await searxSearch(
    officialDomains.length ? `"${query}" site:${officialDomains[0]}` : `"${query}"`,
    { max: 10 },
  );
  searchesUsed += 1;
  const ranked = rankHits(hits, brandGuess, officialDomains);
  emit({
    type: "activity",
    id: "s1",
    kind: "search",
    label: "Recherche (1)",
    detail: `${ranked.length} résultat(s) — je garde la meilleure page`,
    status: ranked.length ? "done" : "error",
  });

  let pool = ranked;
  if (pool.length === 0 && officialDomains.length) {
    // The site-restricted search found nothing: one open search instead.
    emit({
      type: "activity",
      id: "s1b",
      kind: "search",
      label: "Recherche (2)",
      detail: "Aucune page officielle, recherche ouverte",
      status: "running",
    });
    pool = rankHits(await searxSearch(`"${query}" fiche technique`, { max: 10 }), brandGuess, []);
    searchesUsed += 1;
    emit({
      type: "activity",
      id: "s1b",
      kind: "search",
      label: "Recherche (2)",
      detail: `${pool.length} résultat(s)`,
      status: pool.length ? "done" : "error",
    });
  }

  if (pool.length === 0) {
    emit({ type: "error", message: `Aucun résultat pour « ${query} ». Vérifiez la référence.` });
    return null;
  }

  // ---- 2. Read the best page (direct fetch, no search) ----
  const sources: CindySource[] = [];
  const pages: { url: string; title: string; content: string }[] = [];
  const images: string[] = [];

  const readInto = async (hit: SearchHit, activityId: string) => {
    emit({
      type: "activity",
      id: activityId,
      kind: "open",
      label: "Ouverture",
      detail: domainOf(hit.url),
      status: "running",
    });
    try {
      const page = await readPage(hit.url);
      pages.push({ url: hit.url, title: hit.title, content: page.text || hit.content });
      for (const img of page.images) if (!images.includes(img)) images.push(img);
      sources.push({
        url: hit.url,
        domain: domainOf(hit.url),
        title: hit.title || domainOf(hit.url),
        official: isOfficial(hit.url, brandGuess),
        status: page.text.length > 800 ? "Page lue entièrement" : "Contenu limité",
      });
      emit({
        type: "activity",
        id: activityId,
        kind: "read",
        label: "Lecture",
        detail: `${domainOf(hit.url)} — ${Math.round((page.text.length / 1000) * 10) / 10} k caractères, ${page.images.length} image(s)`,
        status: "done",
      });
      emit({ type: "source", source: sources[sources.length - 1]! });
      return true;
    } catch {
      emit({
        type: "activity",
        id: activityId,
        kind: "open",
        label: "Ouverture",
        detail: `${domainOf(hit.url)} illisible`,
        status: "error",
      });
      return false;
    }
  };

  let index = 0;
  while (index < pool.length && pages.length === 0) {
    await readInto(pool[index]!, `p${index}`);
    index += 1;
  }

  if (pages.length === 0) {
    emit({ type: "error", message: "Impossible d'ouvrir la page produit. Réessayez plus tard." });
    return null;
  }

  // ---- 3. Extract everything from that page ----
  emit({
    type: "activity",
    id: "x1",
    kind: "extract",
    label: "Extraction",
    detail: "Toutes les informations de la page officielle",
    status: "running",
  });
  let product = await extractWithAI({ query, sources: pages, images: images.slice(0, 14) });
  emit({
    type: "activity",
    id: "x1",
    kind: "extract",
    label: "Extraction",
    detail: `${product.specifications.length} spécification(s), ${product.images.length} image(s)`,
    status: "done",
  });

  // ---- 4. Only if essentials are still missing: one complementary search ----
  const missing = missingEssentials(product);
  if (missing.length > 0) {
    emit({
      type: "activity",
      id: "s2",
      kind: "search",
      label: `Recherche complémentaire`,
      detail: `Manque : ${missing.join(", ")}`,
      status: "running",
    });
    try {
      const extra = rankHits(
        await searxSearch(`"${query}" ${missing.join(" ")} fiche technique`, { max: 8 }),
        brandGuess,
        officialDomains,
      ).filter((hit) => !pages.some((p) => p.url === hit.url));
      searchesUsed += 1;
      emit({
        type: "activity",
        id: "s2",
        kind: "search",
        label: "Recherche complémentaire",
        detail: `${extra.length} résultat(s)`,
        status: "done",
      });
      let added = 0;
      for (const hit of extra) {
        if (added >= 2) break;
        if (await readInto(hit, `p2${added}`)) added += 1;
      }
      if (added > 0) {
        emit({
          type: "activity",
          id: "x2",
          kind: "extract",
          label: "Extraction",
          detail: "Complément d'informations",
          status: "running",
        });
        product = await extractWithAI({ query, sources: pages, images: images.slice(0, 14) });
        emit({
          type: "activity",
          id: "x2",
          kind: "extract",
          label: "Extraction",
          detail: `${product.specifications.length} spécification(s), ${product.images.length} image(s)`,
          status: "done",
        });
      }
    } catch {
      emit({
        type: "activity",
        id: "s2",
        kind: "search",
        label: "Recherche complémentaire",
        detail: "Impossible",
        status: "error",
      });
    }
  }

  product.sources = sources.map((s) => ({ name: s.domain, url: s.url, official: s.official }));

  emit({ type: "checklist", label: "Nom du produit", done: Boolean(product.name) });
  emit({ type: "checklist", label: "Modèle / référence", done: Boolean(product.model) });
  emit({ type: "checklist", label: "Caractéristiques", done: Boolean(product.characteristics) });
  emit({ type: "checklist", label: "Spécifications", done: product.specifications.length > 0 });
  emit({ type: "checklist", label: "Images", done: product.images.length > 0 });
  emit({
    type: "checklist",
    label: "Source officielle",
    done: product.sources.some((s) => s.official),
  });

  await cacheSave({ key, query, product, images: images.slice(0, 14), searchesUsed });

  emit({ type: "result", product, cached: false });
  emit({
    type: "message",
    text: `Terminé avec ${searchesUsed} recherche${searchesUsed > 1 ? "s" : ""} web. Je garde cette fiche en mémoire : ce produit ne sera plus jamais recherché, sauf si vous me le demandez.`,
  });

  return product;
}
