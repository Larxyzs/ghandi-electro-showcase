/**
 * Semantic discovery layer — the missing bridge between Cindy's brain (Gemini)
 * and the raw search API.
 *
 * The search provider only matches literal keywords, so a natural instruction
 * like "va dans tous les réfrigérateurs combinés Samsung Afrique du Nord
 * (samsung.com/n_africa)" found nothing. Here the AI first turns the sentence
 * into a plan (target URLs + a short keyword query), then we really open the
 * listing pages, and the AI reads their links/text to return concrete model
 * references ready for bulk creation.
 */
import type { CindyAgentEvent } from "./cindy-types";

type Emit = (event: CindyAgentEvent) => void;

export type DiscoveredRef = { reference: string; name: string; url: string };

type Plan = {
  urls: string[];
  query: string;
  brand: string;
  keywords: string[];
};

async function chat(messages: { role: string; content: string }[], schemaName: string, schema: unknown) {
  const { aiSetup, aiFailure } = await import("./ai-config.server");
  const ai = await aiSetup();
  const res = await fetch(ai.url, {
    method: "POST",
    headers: ai.headers,
    body: JSON.stringify({
      model: ai.model,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema },
      },
    }),
  });
  if (!res.ok) throw await aiFailure(res);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as Record<string, unknown>) : {};
  }
}

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["urls", "query", "brand", "keywords"],
  properties: {
    urls: { type: "array", items: { type: "string" } },
    query: { type: "string" },
    brand: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
  },
} as const;

const REFS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["references"],
  properties: {
    references: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["reference", "name", "url"],
        properties: {
          reference: { type: "string" },
          name: { type: "string" },
          url: { type: "string" },
        },
      },
    },
  },
} as const;

/** Step 1 — the AI reads the admin's sentence and produces a browsing plan. */
async function planFrom(instruction: string): Promise<Plan> {
  const explicit = Array.from(instruction.matchAll(/https?:\/\/[^\s)<>"']+/gi)).map((m) => m[0]!);
  const parsed = await chat(
    [
      {
        role: "system",
        content:
          "Tu prépares une recherche produit d'électroménager. À partir de la demande de l'admin, renvoie : urls = pages de listing officielles à ouvrir (déduis-les du site donné, ex. https://www.samsung.com/n_africa/refrigerators/all-refrigerators/ ; 1 à 4 urls), query = requête web courte en mots-clés (jamais la phrase complète), brand = marque, keywords = mots-clés de filtrage (type de produit, gamme).",
      },
      { role: "user", content: instruction },
    ],
    "plan",
    PLAN_SCHEMA,
  );
  const urls = [
    ...explicit,
    ...(Array.isArray(parsed["urls"]) ? (parsed["urls"] as unknown[]) : []).map((u) => String(u)),
  ]
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  return {
    urls: Array.from(new Set(urls)).slice(0, 4),
    query: String(parsed["query"] ?? instruction).slice(0, 160),
    brand: String(parsed["brand"] ?? ""),
    keywords: (Array.isArray(parsed["keywords"]) ? (parsed["keywords"] as unknown[]) : []).map((k) =>
      String(k),
    ),
  };
}

/**
 * Turns a natural instruction into a list of concrete product references by
 * really opening the listing pages (and, only if needed, one keyword search).
 */
export async function discoverReferences(input: {
  instruction: string;
  limit?: number;
  emit?: Emit;
}): Promise<{ references: DiscoveredRef[]; plan: Plan; pages: string[] }> {
  const emit = input.emit ?? (() => {});
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 40);

  emit({ type: "activity", id: "plan", kind: "read", label: "Je comprends la demande", status: "running" });
  const plan = await planFrom(input.instruction);
  emit({
    type: "activity",
    id: "plan",
    kind: "read",
    label: "Plan de recherche prêt",
    detail: [plan.brand, plan.keywords.join(", ")].filter(Boolean).join(" · "),
    status: "done",
  });

  const { readPage, webSearch } = await import("./cindy.server");
  const corpus: { url: string; text: string; links: { url: string; text: string }[] }[] = [];
  const opened: string[] = [];

  const targets = [...plan.urls];
  if (targets.length === 0) {
    emit({ type: "activity", id: "search", kind: "search", label: `Recherche : ${plan.query}`, status: "running" });
    const hits = await webSearch(plan.query, { max: 8 });
    emit({
      type: "activity",
      id: "search",
      kind: "search",
      label: `Recherche : ${plan.query}`,
      detail: `${hits.length} résultats`,
      status: "done",
    });
    targets.push(...hits.slice(0, 3).map((h) => h.url));
  }

  for (const url of targets.slice(0, 4)) {
    const id = `open-${url}`;
    emit({ type: "activity", id, kind: "open", label: "J'ouvre la page", detail: url, status: "running" });
    try {
      const page = await readPage(url);
      corpus.push({ url, text: page.text.slice(0, 14000), links: page.links.slice(0, 200) });
      opened.push(url);
      emit({
        type: "activity",
        id,
        kind: "open",
        label: "Page lue",
        detail: `${url} · ${page.links.length} liens`,
        status: "done",
      });
    } catch {
      emit({ type: "activity", id, kind: "open", label: "Page inaccessible", detail: url, status: "error" });
    }
  }

  if (corpus.length === 0) return { references: [], plan, pages: opened };

  emit({ type: "activity", id: "extract", kind: "extract", label: "J'extrais les modèles", status: "running" });
  const blocks = corpus
    .map(
      (page, i) =>
        `### PAGE ${i + 1}\nURL: ${page.url}\nLIENS:\n${page.links
          .map((l) => `- ${l.text || "(sans texte)"} → ${l.url}`)
          .join("\n")}\nTEXTE:\n${page.text}`,
    )
    .join("\n\n");

  const deterministicReferences: DiscoveredRef[] = [];
  const deterministicSeen = new Set<string>();
  for (const page of corpus) {
    const listing = new URL(page.url);
    const basePath = listing.pathname.endsWith("/") ? listing.pathname : `${listing.pathname}/`;
    for (const link of page.links) {
      try {
        const candidate = new URL(link.url);
        const remainder = candidate.pathname.startsWith(basePath)
          ? candidate.pathname.slice(basePath.length).replace(/^\/+|\/+$/g, "")
          : "";
        if (candidate.hostname !== listing.hostname || !remainder) continue;
        const slug = remainder.split("/").filter(Boolean).at(-1) ?? "";
        const reference = slug.match(/(?:^|-)([a-z]{1,5}\d[a-z0-9-]{3,})(?:-|$)/i)?.[1] ?? slug;
        const key = candidate.toString().replace(/[?#].*$/, "").toLowerCase();
        if (deterministicSeen.has(key)) continue;
        deterministicSeen.add(key);
        deterministicReferences.push({ reference, name: link.text || reference, url: candidate.toString() });
      } catch {
        /* ignore malformed link */
      }
    }
  }

  if (deterministicReferences.length > 0) {
    const references = deterministicReferences.slice(0, limit);
    emit({
      type: "activity",
      id: "extract",
      kind: "extract",
      label: `${references.length} modèle(s) identifié(s)`,
      status: "done",
    });
    return { references, plan, pages: opened };
  }

  const parsed = await chat(
    [
      {
        role: "system",
        content:
          "Tu extrais des références de produits d'électroménager depuis des pages officielles. Renvoie uniquement les modèles qui correspondent VRAIMENT à la demande (type, marque, gamme). reference = référence commerciale exacte du modèle (ex. RB34T672EWW), name = nom lisible, url = page produit. Ignore accessoires, pièces, articles de blog, doublons et variantes de couleur du même code.",
      },
      {
        role: "user",
        content: `DEMANDE : ${input.instruction}\nMARQUE : ${plan.brand}\nMOTS-CLÉS : ${plan.keywords.join(", ")}\nMAX : ${limit}\n\n${blocks}`,
      },
    ],
    "references",
    REFS_SCHEMA,
  );

  const seen = new Set<string>();
  const references: DiscoveredRef[] = [];
  for (const raw of Array.isArray(parsed["references"]) ? (parsed["references"] as unknown[]) : []) {
    const item = raw as Record<string, unknown>;
    const reference = String(item["reference"] ?? "").trim();
    if (reference.length < 3) continue;
    const key = reference.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    references.push({
      reference,
      name: String(item["name"] ?? reference).trim(),
      url: String(item["url"] ?? "").trim(),
    });
    if (references.length >= limit) break;
  }

  emit({
    type: "activity",
    id: "extract",
    kind: "extract",
    label: `${references.length} modèle(s) identifié(s)`,
    status: references.length > 0 ? "done" : "error",
  });

  return { references, plan, pages: opened };
}
