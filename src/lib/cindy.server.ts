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

type TavilyResult = { url: string; title: string; content: string; raw_content?: string | null };

async function tavilySearch(
  query: string,
  opts: { images?: boolean; domains?: string[]; depth?: "basic" | "advanced"; max?: number } = {},
) {
  const key = process.env["TAVILY_API_KEY"];
  if (!key) throw new Error("SEARCH_NOT_CONFIGURED");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      search_depth: opts.depth ?? "advanced",
      max_results: opts.max ?? 6,
      include_raw_content: true,
      include_images: Boolean(opts.images),
      include_image_descriptions: false,
      ...(opts.domains && opts.domains.length ? { include_domains: opts.domains } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SEARCH_FAILED: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    results?: TavilyResult[];
    images?: (string | { url: string })[];
  };
  return {
    results: json.results ?? [],
    images: (json.images ?? []).map((i) => (typeof i === "string" ? i : i.url)).filter(Boolean),
  };
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

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Tu es Cindy, assistante de recherche produit pour un magasin d'électroménager marocain. " +
            "Tu extrais UNIQUEMENT des informations présentes dans les sources fournies. " +
            "N'invente jamais une donnée: si une information est absente, ne la mets pas. " +
            "N'inclus JAMAIS de prix, de stock ou d'information commerciale. " +
            "Rédige en français. Les 'characteristics' sont une liste courte à puces (une par ligne, préfixée par '- '). " +
            "Les 'specifications' sont des paires label/valeur techniques (capacité, dimensions, classe énergétique, consommation, niveau sonore, etc.). " +
            "Les 'marketing_sections' sont 2 à 5 blocs de présentation premium basés sur les vraies fonctionnalités du produit; " +
            "utilise uniquement les URLs d'images fournies. Termine toujours par un bloc de type 'specs'.",
        },
        {
          role: "user",
          content: `Référence demandée par l'admin: "${input.query}"\n\nImages disponibles (URLs réelles):\n${input.images.slice(0, 8).join("\n") || "(aucune)"}\n\n${corpus}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "product", strict: true, schema: EXTRACTION_SCHEMA },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("AI_RATE_LIMITED");
    if (res.status === 402) throw new Error("AI_CREDITS");
    throw new Error(`AI_FAILED: ${res.status} ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI_EMPTY");
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

/**
 * Runs a real research pass and reports every actual step through `emit`.
 * No step is emitted unless the corresponding network call really happened.
 */
export async function researchProduct(query: string, emit: (event: CindyEvent) => void) {
  const brandGuess = guessBrand(query);
  const officialDomains = brandGuess ? (OFFICIAL_DOMAINS[brandGuess] ?? []) : [];

  emit({
    type: "message",
    text: `Très bien ! Je recherche « ${query} » et je rassemble les informations officielles du produit.`,
  });

  // 1. Broad web search
  emit({ type: "activity", id: "s1", kind: "search", label: "Recherche", detail: query, status: "running" });
  const broad = await tavilySearch(`${query} fiche produit caractéristiques spécifications`, {
    images: true,
    max: 6,
  });
  emit({
    type: "activity",
    id: "s1",
    kind: "search",
    label: "Recherche",
    detail: `${broad.results.length} résultat(s) pour « ${query} »`,
    status: "done",
  });

  if (broad.results.length === 0) {
    emit({ type: "error", message: `Aucun résultat trouvé pour « ${query} ». Vérifiez la référence.` });
    return null;
  }

  // 2. Official manufacturer search
  let officialResults: TavilyResult[] = [];
  let officialImages: string[] = [];
  if (officialDomains.length) {
    emit({
      type: "activity",
      id: "s2",
      kind: "open",
      label: "Site officiel",
      detail: officialDomains.join(", "),
      status: "running",
    });
    try {
      const official = await tavilySearch(`${query}`, {
        images: true,
        domains: officialDomains,
        max: 4,
      });
      officialResults = official.results;
      officialImages = official.images;
      emit({
        type: "activity",
        id: "s2",
        kind: "open",
        label: "Site officiel",
        detail: officialResults.length
          ? `Page officielle trouvée (${officialDomains[0]})`
          : `Aucune page officielle sur ${officialDomains[0]}`,
        status: "done",
      });
    } catch {
      emit({
        type: "activity",
        id: "s2",
        kind: "open",
        label: "Site officiel",
        detail: "Consultation impossible",
        status: "error",
      });
    }
  }

  const merged: TavilyResult[] = [];
  const seen = new Set<string>();
  for (const r of [...officialResults, ...broad.results]) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    merged.push(r);
  }
  const picked = merged.slice(0, 6);

  // 3. Report the real sources used
  const sources: CindySource[] = picked.map((r) => ({
    url: r.url,
    domain: domainOf(r.url),
    title: r.title || domainOf(r.url),
    official: isOfficial(r.url, brandGuess),
    status: (r.raw_content ?? r.content ?? "").length > 400 ? "Contenu lu" : "Contenu limité",
  }));
  for (const source of sources) emit({ type: "source", source });

  emit({
    type: "activity",
    id: "s3",
    kind: "read",
    label: "Lecture",
    detail: `Spécifications sur ${picked.length} page(s)`,
    status: "done",
  });

  // 4. Images
  const images = [...new Set([...officialImages, ...broad.images])].filter((u) =>
    /^https?:\/\//.test(u),
  );
  emit({
    type: "activity",
    id: "s4",
    kind: "images",
    label: "Images",
    detail: `${images.length} image(s) trouvée(s)`,
    status: images.length ? "done" : "error",
  });

  // 5. Extraction
  emit({
    type: "activity",
    id: "s5",
    kind: "extract",
    label: "Extraction",
    detail: "Normalisation des informations produit",
    status: "running",
  });
  emit({ type: "message", text: "J'ai trouvé le produit. J'extrais les informations…" });

  const product = await extractWithAI({
    query,
    sources: picked.map((r) => ({
      url: r.url,
      title: r.title,
      content: r.raw_content || r.content || "",
    })),
    images: images.slice(0, 10),
  });

  product.sources = sources.map((s) => ({ name: s.domain, url: s.url, official: s.official }));

  emit({
    type: "activity",
    id: "s5",
    kind: "extract",
    label: "Extraction",
    detail: "Informations produit extraites",
    status: "done",
  });

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

  emit({ type: "result", product });
  emit({
    type: "message",
    text: "Tout est prêt. Vérifiez les informations, ajoutez votre prix et votre stock, puis importez le produit.",
  });

  return product;
}
