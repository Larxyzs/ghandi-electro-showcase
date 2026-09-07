/**
 * PHASE 1 — one-time deep structural inspection of a manufacturer's site.
 *
 * The strongest available reasoning model (GPT-5.6 Sol by default) reads the
 * real DOM skeleton of a SMALL sample of official product pages and returns the
 * structure of that manufacturer's product carousel. The answer is then VERIFIED
 * deterministically (the rules must actually extract slides on the samples)
 * before being stored in the registry.
 *
 * This never runs during a normal import: normal imports (GPT-5.6 Luna) reuse
 * the stored rules.
 */
import { aiFailure, aiFetchWithRetry, aiSetup, AI_MODELS } from "./ai-config.server";
import { responsesUrl } from "./ai-tool-loop.server";
import {
  EMPTY_GALLERY_RULES,
  domainOfUrl,
  extractRuleGallery,
  type GalleryRules,
  type ManufacturerRules,
} from "./manufacturer-rules";
import { manufacturerRegistry, saveManufacturerRules } from "./manufacturer-rules.server";

/** Strongest flagship exposed by the active configuration (the "teacher"). */
export function inspectionModel(provider: string): string {
  const ids = AI_MODELS[provider as keyof typeof AI_MODELS]?.map((m) => m.id) ?? [];
  const preferred = provider === "lovable" ? ["openai/gpt-5.6-sol", "openai/gpt-5.6-terra"] : ["gpt-5.6-sol", "gpt-5.6-terra"];
  return preferred.find((id) => ids.includes(id)) ?? ids[0] ?? "gpt-5.6-sol";
}

/**
 * Compact structural view of a page: the open tags that could be carousel
 * containers plus every <img> with its attributes. No prose, no page copy — the
 * model must reason on STRUCTURE, not on how images look.
 */
export function domSkeleton(html: string, limit = 24_000): string {
  const lines: string[] = [];
  for (const match of html.matchAll(
    /<(div|section|ul|li|figure|aside|swiper-container|button)\b([^>]*)>|<(img|source)\b([^>]*)>/gi,
  )) {
    const tag = (match[1] ?? match[3] ?? "").toLowerCase();
    const attrs = (match[2] ?? match[4] ?? "").replace(/\s+/g, " ").trim();
    if (!attrs) continue;
    // Only structural attributes matter.
    const kept = [...attrs.matchAll(/(id|class|role|itemprop|src|srcset|data-[\w-]+|aria-[\w-]+)\s*=\s*["']([^"']*)["']/gi)]
      .map(([, name, value]) => `${name}="${(value ?? "").slice(0, 180)}"`)
      .join(" ");
    if (!kept) continue;
    lines.push(`<${tag} ${kept}>`);
    if (lines.join("\n").length > limit) break;
  }
  return lines.join("\n").slice(0, limit);
}

const RULES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["container_patterns", "slide_patterns", "slides_self_identifying", "image_attributes", "url_must_match", "url_must_not_match", "exclude_section_patterns", "order", "order_attribute", "min_slides", "notes"],
  properties: {
    container_patterns: { type: "array", items: { type: "string" } },
    slide_patterns: { type: "array", items: { type: "string" } },
    slides_self_identifying: { type: "boolean" },
    image_attributes: { type: "array", items: { type: "string" } },
    url_must_match: { type: "array", items: { type: "string" } },
    url_must_not_match: { type: "array", items: { type: "string" } },
    exclude_section_patterns: { type: "array", items: { type: "string" } },
    order: { type: "string", enum: ["dom", "attribute"] },
    order_attribute: { type: "string" },
    min_slides: { type: "integer" },
    notes: { type: "string" },
  },
} as const;

const INSTRUCTIONS = `Tu es un ingénieur d'extraction. On te donne le SQUELETTE DOM (balises et attributs uniquement) de plusieurs fiches produits officielles d'UN SEUL fabricant.

Ta mission : décrire la structure RÉELLE du carrousel/diaporama d'images du produit sur ce site.

Règles absolues :
- Tu te bases uniquement sur la structure DOM fournie (id, class, data-*, srcset...), jamais sur l'apparence d'une image.
- container_patterns / slide_patterns / exclude_section_patterns sont des fragments d'EXPRESSIONS RÉGULIÈRES testés sur le texte des attributs d'une balise ouvrante. N'invente pas de sélecteurs : n'utilise que des valeurs présentes dans le squelette.
- slides_self_identifying = true seulement si les attributs des diapositives suffisent à eux seuls à prouver l'appartenance au carrousel produit (attribut unique, ex. data-modal-id="product-carousel").
- image_attributes : les attributs qui portent l'URL, du meilleur au moins bon (pleine taille avant vignette).
- exclude_section_patterns : sections d'images de fonctionnalités/caractéristiques (No Frost, Cooling, Inverter, Smart, benefits), bannières marketing, produits liés/recommandés, catégories, en-tête/pied de page.
- order = "attribute" + order_attribute si l'ordre des diapositives est porté par un attribut numérique, sinon "dom".
- Si tu ne peux pas identifier le carrousel avec certitude, renvoie des tableaux vides : mieux vaut aucune règle qu'une règle fausse.`;

export type InspectionReport = {
  brand: string;
  model: string;
  samples: { url: string; ok: boolean; slides: number; error: string }[];
  rules: GalleryRules | null;
  saved: boolean;
  verified: boolean;
  message: string;
};

/** Runs the one-time inspection for one manufacturer and stores the rules. */
export async function inspectManufacturer(input: {
  brand: string;
  sampleUrls: string[];
  signal?: AbortSignal;
}): Promise<InspectionReport> {
  const brand = input.brand.trim();
  const urls = input.sampleUrls.map((u) => u.trim()).filter(Boolean).slice(0, 4);
  if (!brand) throw new Error("BRAND_REQUIRED");
  if (urls.length === 0) throw new Error("SAMPLE_URLS_REQUIRED");

  const ai = await aiSetup();
  const model = inspectionModel(ai.provider);
  const report: InspectionReport = {
    brand,
    model,
    samples: [],
    rules: null,
    saved: false,
    verified: false,
    message: "",
  };

  const { fetchOfficialPage } = await import("./page-fetch.server");
  const pages: { url: string; html: string }[] = [];
  for (const url of urls) {
    try {
      const page = await fetchOfficialPage(url, input.signal ? { signal: input.signal } : {});
      pages.push({ url: page.finalUrl || url, html: page.html });
      report.samples.push({ url, ok: true, slides: 0, error: "" });
    } catch (error) {
      report.samples.push({
        url,
        ok: false,
        slides: 0,
        error: error instanceof Error ? error.message : "PAGE_INACCESSIBLE",
      });
    }
  }
  if (pages.length === 0) {
    report.message = "Aucune page échantillon accessible : inspection impossible.";
    return report;
  }

  const prompt = [
    `Fabricant : ${brand}`,
    ...pages.map((page, i) => `--- ÉCHANTILLON ${i + 1} : ${page.url}\n${domSkeleton(page.html)}`),
  ].join("\n\n");

  const res = await aiFetchWithRetry(
    responsesUrl(ai.url),
    {
      method: "POST",
      headers: ai.headers,
      body: JSON.stringify({
        model,
        instructions: INSTRUCTIONS,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        reasoning: { effort: "high" },
        text: {
          format: {
            type: "json_schema",
            name: "manufacturer_gallery_rules",
            strict: true,
            schema: RULES_SCHEMA,
          },
        },
      }),
      ...(input.signal ? { signal: input.signal } : {}),
    },
    input.signal ? { signal: input.signal } : {},
  );
  if (!res.ok) throw await aiFailure(res);

  const payload = (await res.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  const text =
    payload.output_text ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("") ??
    "";

  let parsed: (Partial<GalleryRules> & { notes?: string }) | null = null;
  try {
    parsed = JSON.parse(text) as Partial<GalleryRules> & { notes?: string };
  } catch {
    report.message = "Réponse du modèle illisible : aucune règle enregistrée.";
    return report;
  }

  const rules: GalleryRules = { ...EMPTY_GALLERY_RULES, ...parsed };
  report.rules = rules;
  if (rules.container_patterns.length === 0 && rules.slide_patterns.length === 0) {
    report.message = "Le carrousel n'a pas pu être identifié avec certitude : rien n'est enregistré.";
    return report;
  }

  // Deterministic verification: the rules must really extract slides.
  const registry = await manufacturerRegistry({ fresh: true });
  const existing = registry.find((entry) => entry.brand.toLowerCase() === brand.toLowerCase());
  const candidate: ManufacturerRules = {
    brand,
    domains: [...new Set([...(existing?.domains ?? []), ...pages.map((p) => domainOfUrl(p.url))])].filter(Boolean),
    identity: existing?.identity ?? { model_attributes: [], model_in_url_slug: true },
    gallery: rules,
    verified: true,
    verified_by: model,
    sample_urls: pages.map((p) => p.url),
    notes: (parsed.notes ?? "").slice(0, 2000),
  };

  let passing = 0;
  for (const page of pages) {
    const found = extractRuleGallery(page.html, page.url, candidate);
    const sample = report.samples.find((s) => page.url.startsWith(s.url) || s.url.startsWith(page.url));
    if (sample) sample.slides = found.urls.length;
    if (found.urls.length >= 1) passing += 1;
  }

  if (passing < Math.ceil(pages.length / 2)) {
    report.message = `Les règles proposées n'extraient pas de diapositives sur les échantillons (${passing}/${pages.length}) : rien n'est enregistré.`;
    return report;
  }

  await saveManufacturerRules(candidate);
  report.saved = true;
  report.verified = true;
  report.message = `Règles ${brand} vérifiées sur ${passing}/${pages.length} échantillons et enregistrées. Les imports normaux (GPT-5.6 Luna) les réutilisent.`;
  return report;
}
