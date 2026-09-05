/**
 * Zero-hallucination product extraction.
 *
 * SOURCE FIRST, AI SECOND:
 *  - deterministic code identifies the product and collects every label/value
 *    pair actually printed on the official page (tables, definition lists,
 *    spec lists, structured data);
 *  - the AI (one single call) only cleans wording, classifies the pairs and
 *    flags contradictions — it may never introduce a value that is not in the
 *    candidates or in the page text;
 *  - every kept field is re-checked against the page text afterwards and gets a
 *    verification state: verified / unverified / conflicting / missing.
 */
import { htmlToText } from "./page-fetch.server";
import { alnum } from "./product-gallery";
import type { ProductSpec } from "./catalog-types";

export type FieldSection =
  | "characteristics"
  | "specifications"
  | "dimensions"
  | "capacity"
  | "energy"
  | "performance"
  | "installation"
  | "connectivity"
  | "identity";

export const FIELD_SECTIONS: FieldSection[] = [
  "characteristics",
  "specifications",
  "dimensions",
  "capacity",
  "energy",
  "performance",
  "installation",
  "connectivity",
  "identity",
];

export type VerificationState = "verified" | "unverified" | "conflicting" | "missing";

export type ExtractedField = {
  label: string;
  value: string;
  section: FieldSection;
  /** Exact sentence/pair as printed on the official page. */
  evidence: string;
  status: VerificationState;
};

export type ProductIdentity = {
  brand: string;
  name: string;
  model: string;
  family: string;
  canonicalUrl: string;
};

export type SpecCandidate = { label: string; value: string; evidence: string };

export type ExtractionResult = {
  identity: ProductIdentity;
  fields: ExtractedField[];
  characteristics: string;
  specifications: ProductSpec[];
  conflicts: string[];
  missing: string[];
  notes: string;
  status: "verified" | "needs_review";
};

/* ----------------------------- identity ------------------------------- */

const metaContent = (html: string, pattern: RegExp) => {
  const match = pattern.exec(html);
  return (match?.[1] ?? "").trim();
};

function jsonLdProduct(html: string, url: string): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null;
  const path = alnum(decodeURIComponent(url));
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    const types = (Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]]).map((t) =>
      String(t ?? "").toLowerCase(),
    );
    if (types.includes("product")) {
      const identity = alnum(
        [item["sku"], item["mpn"], item["model"], item["name"]].map((v) => String(v ?? "")).join(" "),
      );
      // Prefer the product whose reference appears in the requested URL.
      if (!best || (identity && path.includes(identity.slice(0, 8)))) best = item;
    }
    Object.values(item).forEach(visit);
  };
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      visit(JSON.parse((match[1] ?? "").trim()));
    } catch {
      /* ignore */
    }
  }
  return best;
}

/** Determines WHICH product this page is about, before any specification. */
export function identifyProduct(html: string, url: string): ProductIdentity {
  const product = jsonLdProduct(html, url);
  const brandValue = product?.["brand"];
  const brandFromLd =
    typeof brandValue === "string"
      ? brandValue
      : String((brandValue as Record<string, unknown> | undefined)?.["name"] ?? "");

  const canonical =
    metaContent(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    metaContent(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ||
    url;

  const h1 = htmlToText(/<h1[^>]*>([\s\S]{0,240}?)<\/h1>/i.exec(html)?.[1] ?? "");
  const ogTitle = metaContent(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const title = htmlToText(/<title[^>]*>([\s\S]{0,240}?)<\/title>/i.exec(html)?.[1] ?? "");

  const model = String(
    product?.["mpn"] ?? product?.["sku"] ?? product?.["model"] ?? "",
  ).trim();

  const name = String(product?.["name"] ?? "").trim() || h1 || ogTitle || title;

  return {
    brand: brandFromLd.trim(),
    name,
    model,
    family: String(product?.["category"] ?? "").trim(),
    canonicalUrl: /^https?:\/\//i.test(canonical) ? canonical : url,
  };
}

/** Model reference guessed from the URL when the page carries no structured data. */
export function modelFromUrl(url: string): string {
  const last = decodeURIComponent(url).split(/[/?#]/).filter(Boolean).pop() ?? "";
  const token = last
    .split(/[-_.]/)
    .filter((part) => part.length >= 5 && /\d/.test(part) && /[a-z]/i.test(part))
    .pop();
  return (token ?? "").toUpperCase();
}

/* -------------------------- spec candidates --------------------------- */

const cleanCell = (raw: string) => htmlToText(raw).replace(/\s+/g, " ").trim();

const BAD_LABEL =
  /(cookie|newsletter|panier|connexion|login|partager|share|avis|review|note|prix|price|stock|livraison|garantie étendue|où acheter|where to buy)/i;

/** Every label/value pair actually printed on the page, in document order. */
export function collectSpecCandidates(html: string): SpecCandidate[] {
  const out: SpecCandidate[] = [];
  const seen = new Set<string>();
  const push = (label: string, value: string) => {
    const l = cleanCell(label);
    const v = cleanCell(value);
    if (!l || !v) return;
    if (l.length > 90 || v.length > 220) return;
    if (BAD_LABEL.test(l)) return;
    if (l.toLowerCase() === v.toLowerCase()) return;
    const key = `${alnum(l)}=${alnum(v)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label: l, value: v, evidence: `${l} : ${v}` });
  };

  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(row[1] ?? "").matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(
      (c) => c[1] ?? "",
    );
    if (cells.length >= 2) push(cells[0]!, cells.slice(1).join(" "));
  }

  for (const list of html.matchAll(/<dl\b[^>]*>([\s\S]*?)<\/dl>/gi)) {
    const body = list[1] ?? "";
    const terms = [...body.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)];
    for (const term of terms) push(term[1] ?? "", term[2] ?? "");
  }

  for (const item of html.matchAll(/<li\b[^>]*>([\s\S]{0,400}?)<\/li>/gi)) {
    const text = cleanCell(item[1] ?? "");
    const match = /^([^:]{2,80})\s*[:：]\s*(.{1,200})$/.exec(text);
    if (match) push(match[1]!, match[2]!);
  }

  for (const div of html.matchAll(
    /<(?:div|p|span)\b[^>]*>([\s\S]{0,200}?)<\/(?:div|p|span)>\s*<(?:div|p|span)\b[^>]*>([\s\S]{0,200}?)<\/(?:div|p|span)>/gi,
  )) {
    const label = cleanCell(div[1] ?? "");
    if (/[:：]$/.test(label)) push(label.replace(/[:：]$/, ""), div[2] ?? "");
  }

  const product = jsonLdProduct(html, "");
  const additional = product?.["additionalProperty"];
  if (Array.isArray(additional)) {
    for (const entry of additional) {
      const item = entry as Record<string, unknown>;
      push(String(item["name"] ?? ""), String(item["value"] ?? ""));
    }
  }

  return out.slice(0, 260);
}

/** Same label printed with two different values on the page = contradiction. */
export function detectConflicts(candidates: SpecCandidate[]): Map<string, string[]> {
  const byLabel = new Map<string, string[]>();
  for (const candidate of candidates) {
    const key = alnum(candidate.label);
    if (!key) continue;
    const values = byLabel.get(key) ?? [];
    if (!values.some((v) => alnum(v) === alnum(candidate.value))) values.push(candidate.value);
    byLabel.set(key, values);
  }
  const conflicts = new Map<string, string[]>();
  for (const [key, values] of byLabel) if (values.length > 1) conflicts.set(key, values);
  return conflicts;
}

/** A value counts as verified only when it is literally printed on the page. */
export function verifyValue(value: string, pageText: string): boolean {
  const needle = alnum(value);
  if (needle.length < 2) return false;
  return alnum(pageText).includes(needle);
}

/* ------------------------------ AI pass -------------------------------- */

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["brand", "name", "model", "family", "characteristics", "fields", "notes"],
  properties: {
    brand: { type: "string" },
    name: { type: "string" },
    model: { type: "string" },
    family: { type: "string" },
    characteristics: {
      type: "array",
      items: { type: "string" },
    },
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "section", "evidence"],
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          section: { type: "string", enum: FIELD_SECTIONS },
          evidence: { type: "string" },
        },
      },
    },
    notes: { type: "string" },
  },
} as const;

const SYSTEM = `Tu es le module d'extraction produit de Ghandi Home Electro.
RÈGLE ABSOLUE : la page officielle fournie est la seule autorité.
- Tu n'utilises QUE les paires étiquette/valeur fournies et le texte de la page.
- Tu n'inventes JAMAIS une valeur, tu ne complètes JAMAIS avec tes connaissances générales, tu ne "corriges" JAMAIS le fabricant.
- Tu ignores toute donnée qui appartient à un autre modèle, une autre capacité, une autre couleur, un produit recommandé ou une catégorie.
- Si une valeur est absente, tu ne la mets pas. Si deux valeurs se contredisent, tu les gardes toutes les deux séparées par " / ".
- "evidence" doit être le texte tel qu'il est écrit sur la page (copie exacte).
- Tu classes chaque champ : characteristics (avantage client), specifications, dimensions, capacity, energy, performance, installation, connectivity, identity.
- Tu ne dupliques pas la même information dans plusieurs sections.
- Tu conserves les unités et le format du fabricant (512 L reste 512 L).
- "characteristics" = 4 à 10 puces courtes en français, uniquement d'après la page.`;

export async function extractProductFromPage(input: {
  url: string;
  html: string;
  pageText: string;
  identity: ProductIdentity;
  candidates: SpecCandidate[];
  /** Manufacturer memory: wording rules and quirks learned for this domain. */
  profileHints?: string;
  signal?: AbortSignal;
}): Promise<ExtractionResult> {
  const { aiSetup, aiFailure, aiFetchWithRetry } = await import("./ai-config.server");
  const ai = await aiSetup();

  const conflicts = detectConflicts(input.candidates);
  const candidateBlock = input.candidates
    .map((c, i) => `${i + 1}. ${c.label} :: ${c.value}`)
    .join("\n");

  const user = [
    `PRODUIT DE CETTE PAGE (déjà identifié par le code, ne le change pas) :`,
    `marque: ${input.identity.brand || "(inconnue)"}`,
    `nom: ${input.identity.name || "(inconnu)"}`,
    `référence: ${input.identity.model || "(inconnue)"}`,
    `URL officielle: ${input.identity.canonicalUrl || input.url}`,
    input.profileHints ? `\nMÉMOIRE FABRICANT (règles validées par l'admin) :\n${input.profileHints}` : "",
    `\nPAIRES ÉTIQUETTE/VALEUR RELEVÉES SUR LA PAGE (source unique) :\n${candidateBlock || "(aucune)"}`,
    conflicts.size
      ? `\nCONTRADICTIONS DÉTECTÉES PAR LE CODE (garde les deux valeurs) :\n${[...conflicts.entries()]
          .map(([label, values]) => `${label}: ${values.join(" / ")}`)
          .join("\n")}`
      : "",
    `\nTEXTE DE LA PAGE (extrait) :\n${input.pageText.slice(0, 9000)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await aiFetchWithRetry(
    ai.url,
    {
      method: "POST",
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "product_extraction", strict: true, schema: EXTRACTION_SCHEMA },
        },
      }),
    },
    input.signal ? { signal: input.signal } : {},
  );
  if (!res.ok) throw await aiFailure(res);

  const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = (payload.choices?.[0]?.message?.content ?? "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  if (!content) throw new Error("AI_EMPTY");

  const parsed = JSON.parse(content) as {
    brand?: string;
    name?: string;
    model?: string;
    family?: string;
    characteristics?: string[];
    fields?: { label: string; value: string; section: FieldSection; evidence: string }[];
    notes?: string;
  };

  const candidateByLabel = new Map(input.candidates.map((c) => [alnum(c.label), c]));
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();

  for (const raw of parsed.fields ?? []) {
    const label = String(raw.label ?? "").trim();
    const value = String(raw.value ?? "").trim();
    if (!label || !value) continue;
    const key = alnum(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const candidate = candidateByLabel.get(key);
    const conflictValues = conflicts.get(key);
    const evidence = (candidate?.evidence ?? String(raw.evidence ?? "")).slice(0, 300);

    let status: VerificationState;
    if (conflictValues && conflictValues.length > 1) status = "conflicting";
    else if (value.split("/").every((part) => verifyValue(part.trim(), input.pageText))) status = "verified";
    else status = "unverified";

    fields.push({
      label,
      value: status === "conflicting" ? conflictValues!.join(" / ") : value,
      section: FIELD_SECTIONS.includes(raw.section) ? raw.section : "specifications",
      evidence,
      status,
    });
  }

  const characteristics = (parsed.characteristics ?? [])
    .map((line) => String(line ?? "").replace(/^[-•\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => `- ${line}`)
    .join("\n");

  const specifications: ProductSpec[] = fields
    .filter((field) => field.section !== "characteristics")
    .map((field) => ({
      label: field.label,
      value: field.status === "unverified" ? `${field.value} (à vérifier)` : field.value,
    }));

  const missing: string[] = [];
  const identity: ProductIdentity = {
    brand: input.identity.brand || String(parsed.brand ?? "").trim(),
    name: input.identity.name || String(parsed.name ?? "").trim(),
    model: input.identity.model || String(parsed.model ?? "").trim(),
    family: input.identity.family || String(parsed.family ?? "").trim(),
    canonicalUrl: input.identity.canonicalUrl || input.url,
  };
  if (!identity.brand) missing.push("marque");
  if (!identity.model) missing.push("référence");
  if (!fields.length) missing.push("spécifications");

  const conflictLabels = fields.filter((f) => f.status === "conflicting").map((f) => f.label);
  const unverified = fields.filter((f) => f.status === "unverified").length;

  return {
    identity,
    fields,
    characteristics,
    specifications,
    conflicts: conflictLabels,
    missing,
    notes: String(parsed.notes ?? "").slice(0, 600),
    status: conflictLabels.length || missing.length || unverified > 2 ? "needs_review" : "verified",
  };
}
