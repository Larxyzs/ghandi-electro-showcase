/**
 * Catalogue checkup — pure, deterministic analysis.
 *
 * The audit inspects what is really stored (identity, specifications, gallery,
 * official URL) and, when asked, compares it with the official manufacturer
 * page through the existing retrieval/extraction pipeline.
 *
 * Hard rule: the official page is the only source of truth. The audit never
 * merges a value between two products and never "corrects" a specification
 * from general knowledge. Conflicting or insufficient evidence produces
 * needs_review, not a guess.
 */
import { imageKey, isUsableImage, type ProductSpec } from "./catalog-types";
import { hostOf, referenceLabel, usableOfficialUrl, type CatalogReference } from "./catalog-references";
import { hostBase } from "./product-gallery";

export type Severity = "low" | "medium" | "high" | "critical";

export type AuditFinding = {
  product_id: string | null;
  reference_id: string | null;
  product_label: string;
  model: string;
  problem_code: string;
  problem: string;
  evidence: string;
  source_url: string | null;
  severity: Severity;
  action: string;
  auto_repair_safe: boolean;
};

export type AuditProduct = {
  id: string;
  name: string;
  brand: string;
  serial_number: string;
  node_id: string;
  node_path: string;
  source_url: string | null;
  source_name: string | null;
  review_state: string;
  price: number | null;
  specifications: ProductSpec[];
  gallery: string[];
  image_url: string | null;
  extraction_evidence: { label: string; value: string; evidence: string; status: string }[];
};

export type OfficialSnapshot = {
  status: "verified" | "needs_review" | "failed";
  error: string;
  canonicalUrl: string;
  identity: { brand: string; name: string; model: string };
  gallery: string[];
  specifications: ProductSpec[];
  conflicts: string[];
  missing: string[];
};

const RETAILER_HOSTS =
  /(google|gstatic|googleusercontent|bing|duckduckgo|yandex|amazon|amazonaws\.com\/images|jumia|aliexpress|alicdn|ebay|electroplanet|marjane|darty|boulanger|fnac|cdiscount|but\.fr|conforama|pinterest|facebook|fbcdn|instagram|twimg|olx|avito)/i;

const norm = (value: string) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const codeOf = (value: string) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Numeric value + unit of a specification, when it carries one. */
export function specNumber(value: string): { amount: number; unit: string } | null {
  const match = /(-?\d+(?:[.,]\d+)?)\s*(l|litres?|kg|cm|mm|w|kwh|db|°c|"|pouces?|inch)?/i.exec(value ?? "");
  if (!match) return null;
  const amount = Number((match[1] ?? "").replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  return { amount, unit: (match[2] ?? "").toLowerCase() };
}

/** Plausibility windows for the specifications we sell. Outside = suspicious. */
const RANGES: { test: RegExp; unit: RegExp; min: number; max: number; what: string }[] = [
  { test: /capacit|volume|contenance/i, unit: /^(l|litres?)$/, min: 20, max: 900, what: "capacité en litres" },
  { test: /capacit.*(linge|lavage)|charge/i, unit: /^kg$/, min: 1, max: 30, what: "capacité de lavage" },
  { test: /(largeur|hauteur|profondeur|dimension)/i, unit: /^cm$/, min: 10, max: 260, what: "dimension" },
  { test: /(bruit|sonore)/i, unit: /^db$/, min: 20, max: 90, what: "niveau sonore" },
  { test: /(puissance)/i, unit: /^w$/, min: 1, max: 12000, what: "puissance" },
  // Energy labels mix daily (0,7 kWh), 100-cycle and annual (350 kWh) figures,
  // so the plausible band has to stay wide or every fridge looks broken.
  { test: /(consommation|energie|énergie)/i, unit: /^kwh$/, min: 0.05, max: 2000, what: "consommation" },
  { test: /(ecran|écran|diagonale|taille.*ecran)/i, unit: /^(pouces?|"|inch)$/, min: 15, max: 120, what: "taille d'écran" },
];

export function suspiciousSpec(spec: ProductSpec): string {
  const parsed = specNumber(spec.value);
  if (!parsed) return "";
  for (const range of RANGES) {
    if (!range.test.test(spec.label)) continue;
    if (!range.unit.test(parsed.unit)) continue;
    if (parsed.amount < range.min || parsed.amount > range.max) {
      return `${range.what} hors plage réaliste (${parsed.amount}${parsed.unit} ; attendu ${range.min}-${range.max})`;
    }
  }
  return "";
}

const finding = (input: Partial<AuditFinding> & { problem_code: string; problem: string }): AuditFinding => ({
  product_id: null,
  reference_id: null,
  product_label: "",
  model: "",
  evidence: "",
  source_url: null,
  severity: "medium",
  action: "",
  auto_repair_safe: false,
  ...input,
});

/* ----------------------- stored-catalogue checks ------------------------ */

/**
 * Deterministic checks on what is stored, plus the three-way comparison with
 * the master reference list. No network, no AI.
 */
export function auditStoredCatalog(
  products: AuditProduct[],
  references: CatalogReference[] = [],
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const label = (p: AuditProduct) => [p.brand, p.serial_number].filter(Boolean).join(" ") || p.name;

  const bySerial = new Map<string, AuditProduct[]>();
  const byUrl = new Map<string, AuditProduct[]>();

  for (const product of products) {
    const base = {
      product_id: product.id,
      product_label: label(product),
      model: product.serial_number,
      source_url: product.source_url ?? null,
    };

    if (!product.serial_number.trim()) {
      findings.push(
        finding({
          ...base,
          problem_code: "missing_model",
          problem: "Référence/modèle absent.",
          evidence: `Article « ${product.name} » enregistré sans référence.`,
          severity: "high",
          action: "Réimporter depuis la page officielle pour lire la référence exacte.",
        }),
      );
    }
    if (!product.brand.trim()) {
      findings.push(
        finding({
          ...base,
          problem_code: "missing_manufacturer",
          problem: "Fabricant absent.",
          evidence: "Aucune marque enregistrée.",
          severity: "high",
          action: "Réimporter depuis la page officielle.",
        }),
      );
    }

    const officialUrl = usableOfficialUrl(product.source_url);
    if (!officialUrl) {
      findings.push(
        finding({
          ...base,
          problem_code: "missing_official_url",
          problem: "Aucune URL officielle enregistrée.",
          evidence: product.source_url ? `URL enregistrée : ${product.source_url}` : "Champ source vide.",
          severity: "high",
          action: "Renseigner la page officielle du fabricant, puis réimporter.",
        }),
      );
    } else if (product.brand && !hostOf(officialUrl).includes(norm(product.brand).replace(/\s+/g, ""))) {
      const host = hostOf(officialUrl);
      if (RETAILER_HOSTS.test(host)) {
        findings.push(
          finding({
            ...base,
            problem_code: "non_official_source",
            problem: "La source enregistrée n'est pas le site du fabricant.",
            evidence: `Source : ${host}`,
            severity: "high",
            action: "Remplacer par la page officielle du fabricant, puis réimporter.",
          }),
        );
      }
    }

    // Specifications
    if (product.specifications.length === 0) {
      findings.push(
        finding({
          ...base,
          problem_code: "missing_specifications",
          problem: "Aucune caractéristique technique enregistrée.",
          evidence: "0 spécification.",
          severity: "high",
          action: "Réimporter depuis la page officielle.",
        }),
      );
    } else if (product.specifications.length < 4) {
      findings.push(
        finding({
          ...base,
          problem_code: "incomplete_extraction",
          problem: "Extraction incomplète : très peu de caractéristiques.",
          evidence: `${product.specifications.length} spécification(s) seulement.`,
          severity: "medium",
          action: "Réimporter depuis la page officielle.",
        }),
      );
    }

    const seenLabels = new Map<string, string>();
    for (const spec of product.specifications) {
      const key = norm(spec.label);
      const previous = seenLabels.get(key);
      if (previous !== undefined && norm(previous) !== norm(spec.value)) {
        findings.push(
          finding({
            ...base,
            problem_code: "conflicting_specifications",
            problem: `Deux valeurs différentes pour « ${spec.label} ».`,
            evidence: `${previous} / ${spec.value}`,
            severity: "high",
            action: "Vérifier sur la page officielle ; aucune valeur ne doit être devinée.",
          }),
        );
      } else seenLabels.set(key, spec.value);

      const suspicious = suspiciousSpec(spec);
      if (suspicious) {
        findings.push(
          finding({
            ...base,
            problem_code: "suspicious_specification",
            problem: `Valeur suspecte : « ${spec.label} ».`,
            evidence: `${spec.value} — ${suspicious}`,
            severity: "high",
            action: "Comparer avec la page officielle ; marquer à revoir si le doute persiste.",
          }),
        );
      }
      if (/à vérifier|a verifier/i.test(spec.value)) {
        findings.push(
          finding({
            ...base,
            problem_code: "unverified_specification",
            problem: `Valeur non vérifiée sur la source : « ${spec.label} ».`,
            evidence: spec.value,
            severity: "medium",
            action: "Revue humaine ou réimport depuis la page officielle.",
          }),
        );
      }
    }

    // Gallery
    const usable = product.gallery.filter((image) => isUsableImage(image));
    if (usable.length === 0) {
      findings.push(
        finding({
          ...base,
          problem_code: "missing_gallery",
          problem: "Diaporama officiel vide.",
          evidence: `${product.gallery.length} entrée(s), 0 photo exploitable.`,
          severity: "critical",
          action: "Réextraire le diaporama officiel depuis la page du fabricant.",
          auto_repair_safe: Boolean(officialUrl),
        }),
      );
    } else {
      const keys = new Set<string>();
      const duplicates: string[] = [];
      for (const image of usable) {
        const key = imageKey(image);
        if (keys.has(key)) duplicates.push(image);
        else keys.add(key);
      }
      if (duplicates.length) {
        findings.push(
          finding({
            ...base,
            problem_code: "duplicate_images",
            problem: `${duplicates.length} photo(s) en double dans le diaporama.`,
            evidence: `${usable.length} entrées pour ${keys.size} photos réellement différentes.`,
            severity: "medium",
            action: "Dédupliquer le diaporama (réparation sûre).",
            auto_repair_safe: true,
          }),
        );
      }
      const junk = product.gallery.filter((image) => !isUsableImage(image));
      if (junk.length) {
        findings.push(
          finding({
            ...base,
            problem_code: "invalid_gallery_entries",
            problem: `${junk.length} entrée(s) qui ne sont pas des photos produit.`,
            evidence: junk.slice(0, 3).join(" | "),
            severity: "medium",
            action: "Nettoyer le diaporama (réparation sûre).",
            auto_repair_safe: true,
          }),
        );
      }
      const retailer = usable.filter((image) => RETAILER_HOSTS.test(hostOf(image)));
      if (retailer.length) {
        findings.push(
          finding({
            ...base,
            problem_code: "non_official_images",
            problem: `${retailer.length} image(s) issues d'un revendeur ou d'un moteur de recherche.`,
            evidence: retailer.slice(0, 3).join(" | "),
            severity: "high",
            action: "Réextraire uniquement le diaporama officiel.",
            auto_repair_safe: Boolean(officialUrl),
          }),
        );
      }
      if (officialUrl) {
        const officialBase = hostBase(hostOf(officialUrl));
        const foreign = usable.filter((image) => {
          const host = hostOf(image);
          return host !== "" && hostBase(host) !== officialBase && !RETAILER_HOSTS.test(host);
        });
        if (foreign.length && officialBase) {
          findings.push(
            finding({
              ...base,
              problem_code: "foreign_domain_images",
              problem: `${foreign.length} image(s) hébergées hors du domaine officiel.`,
              evidence: `Domaine officiel ${officialBase} ; images : ${foreign
                .slice(0, 3)
                .map((image) => hostOf(image))
                .join(", ")}`,
              severity: "medium",
              action: "Vérifier l'appartenance au diaporama officiel ; réextraire si besoin.",
            }),
          );
        }
      }
      if (product.image_url && !usable.some((image) => imageKey(image) === imageKey(product.image_url ?? ""))) {
        findings.push(
          finding({
            ...base,
            problem_code: "main_image_outside_gallery",
            problem: "La photo principale ne fait pas partie du diaporama enregistré.",
            evidence: product.image_url,
            severity: "medium",
            action: "Reprendre la première photo du diaporama officiel (réparation sûre).",
            auto_repair_safe: true,
          }),
        );
      }
    }

    if (product.review_state && product.review_state !== "verified") {
      findings.push(
        finding({
          ...base,
          problem_code: "needs_human_review",
          problem: "Article déjà marqué à revoir.",
          evidence: `état : ${product.review_state}`,
          severity: "medium",
          action: "Revue humaine.",
        }),
      );
    }

    const serialKey = codeOf(product.serial_number);
    if (serialKey) bySerial.set(serialKey, [...(bySerial.get(serialKey) ?? []), product]);
    if (officialUrl) {
      const key = officialUrl.replace(/\/+$/, "").toLowerCase();
      byUrl.set(key, [...(byUrl.get(key) ?? []), product]);
    }
  }

  for (const [key, group] of bySerial) {
    if (group.length < 2) continue;
    findings.push(
      finding({
        product_id: group[1]!.id,
        product_label: label(group[1]!),
        model: group[1]!.serial_number,
        problem_code: "duplicate_product",
        problem: `${group.length} articles partagent la référence ${key}.`,
        evidence: group.map((p) => p.name).join(" | "),
        severity: "high",
        action: "Fusionner : garder un seul article et le rattacher aux catégories concernées.",
      }),
    );
  }
  for (const [key, group] of byUrl) {
    if (group.length < 2) continue;
    findings.push(
      finding({
        product_id: group[1]!.id,
        product_label: label(group[1]!),
        model: group[1]!.serial_number,
        source_url: key,
        problem_code: "duplicate_canonical_url",
        problem: `${group.length} articles pointent vers la même page officielle.`,
        evidence: key,
        severity: "high",
        action: "Supprimer le doublon et rattacher l'article restant aux catégories (réparation sûre).",
        auto_repair_safe: true,
      }),
    );
  }

  // Three-way comparison: master references vs current products.
  const productsBySerial = new Map(
    products.filter((p) => codeOf(p.serial_number)).map((p) => [codeOf(p.serial_number), p]),
  );
  const productsById = new Map(products.map((p) => [p.id, p]));
  for (const ref of references) {
    if (!ref.active) continue;
    const byRefSerial = productsBySerial.get(codeOf(ref.model));
    const byRefId = ref.product_id ? productsById.get(ref.product_id) : undefined;
    const match = byRefSerial ?? byRefId;
    if (!match) {
      findings.push(
        finding({
          reference_id: ref.id,
          product_label: referenceLabel(ref),
          model: ref.model,
          source_url: ref.official_url,
          problem_code: "reference_without_product",
          problem: "Référence maîtresse sans article dans le catalogue.",
          evidence: `Référence ${referenceLabel(ref)} conservée, article absent.`,
          severity: "high",
          action: "Reconstruire cet article depuis son URL officielle.",
          auto_repair_safe: Boolean(usableOfficialUrl(ref.official_url)),
        }),
      );
      continue;
    }
    if (codeOf(ref.model) && codeOf(match.serial_number) && codeOf(ref.model) !== codeOf(match.serial_number)) {
      findings.push(
        finding({
          product_id: match.id,
          reference_id: ref.id,
          product_label: referenceLabel(ref),
          model: ref.model,
          source_url: ref.official_url,
          problem_code: "identity_mismatch",
          problem: "L'article ne correspond pas à sa référence maîtresse.",
          evidence: `Référence ${ref.model} ≠ article ${match.serial_number}`,
          severity: "critical",
          action: "Revue humaine : ne jamais écraser une identité automatiquement.",
        }),
      );
    }
  }

  return findings;
}

/* -------------------- comparison with the official page ----------------- */

/**
 * Compares one stored product with its own official page snapshot. Values are
 * never merged between products: only this product's page is used, and a
 * disagreement without decisive evidence becomes needs_review.
 */
export function auditAgainstOfficial(
  product: AuditProduct,
  official: OfficialSnapshot,
  referenceId: string | null = null,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const base = {
    product_id: product.id,
    reference_id: referenceId,
    product_label: [product.brand, product.serial_number].filter(Boolean).join(" ") || product.name,
    model: product.serial_number,
    source_url: product.source_url ?? null,
  };

  if (official.status === "failed") {
    const identityIssue = /IDENTITY|MISMATCH|WRONG_PRODUCT/i.test(official.error);
    findings.push(
      finding({
        ...base,
        problem_code: identityIssue ? "identity_unverifiable" : "official_page_inaccessible",
        problem: identityIssue
          ? "L'identité du produit n'a pas pu être confirmée sur la page officielle."
          : "Page officielle inaccessible.",
        evidence: official.error || "Aucune réponse exploitable.",
        severity: "high",
        action: identityIssue
          ? "Revue humaine : vérifier l'URL officielle du modèle."
          : "Réessayer plus tard ou corriger l'URL officielle ; ne pas remplacer par une autre source.",
      }),
    );
    return findings;
  }

  const pageModel = codeOf(official.identity.model);
  const savedModel = codeOf(product.serial_number);
  if (pageModel && savedModel && pageModel !== savedModel && !pageModel.includes(savedModel)) {
    findings.push(
      finding({
        ...base,
        problem_code: "model_mismatch",
        problem: "Le modèle enregistré ne correspond pas à la page officielle.",
        evidence: `Enregistré ${product.serial_number} ; page officielle ${official.identity.model}`,
        severity: "critical",
        action: "Revue humaine : corriger l'URL ou l'article, sans mélanger les deux produits.",
      }),
    );
  }
  if (
    official.identity.brand &&
    product.brand &&
    norm(official.identity.brand) !== norm(product.brand)
  ) {
    findings.push(
      finding({
        ...base,
        problem_code: "manufacturer_mismatch",
        problem: "Fabricant différent de celui de la page officielle.",
        evidence: `Enregistré ${product.brand} ; page ${official.identity.brand}`,
        severity: "high",
        action: "Revue humaine.",
      }),
    );
  }

  // Gallery: the official slideshow is authoritative.
  const officialKeys = new Set(official.gallery.map((image) => imageKey(image)));
  const savedUsable = product.gallery.filter((image) => isUsableImage(image));
  const extra = savedUsable.filter((image) => !officialKeys.has(imageKey(image)));
  const missingImages = official.gallery.filter(
    (image) => !savedUsable.some((saved) => imageKey(saved) === imageKey(image)),
  );
  if (official.gallery.length === 0) {
    findings.push(
      finding({
        ...base,
        problem_code: "official_gallery_unavailable",
        problem: "Aucun diaporama officiel détecté sur la page.",
        evidence: `Page ${official.canonicalUrl}`,
        severity: "medium",
        action: "Revue humaine : la page a peut-être changé de structure.",
      }),
    );
  } else if (extra.length) {
    findings.push(
      finding({
        ...base,
        problem_code: "invalid_gallery",
        problem: `Le diaporama enregistré contient ${extra.length} image(s) absentes du diaporama officiel.`,
        evidence: `Diaporama officiel : ${official.gallery.length} images. Catalogue : ${savedUsable.length} images.`,
        severity: "high",
        action: "Réextraire le diaporama officiel.",
        auto_repair_safe: true,
      }),
    );
  } else if (missingImages.length) {
    findings.push(
      finding({
        ...base,
        problem_code: "stale_gallery",
        problem: `${missingImages.length} image(s) du diaporama officiel manquent au catalogue.`,
        evidence: `Diaporama officiel : ${official.gallery.length} images. Catalogue : ${savedUsable.length} images.`,
        severity: "medium",
        action: "Réextraire le diaporama officiel.",
        auto_repair_safe: true,
      }),
    );
  }

  // Specifications, compared label by label, this product only.
  const savedSpecs = new Map(product.specifications.map((spec) => [norm(spec.label), spec.value]));
  const changed: string[] = [];
  const absent: string[] = [];
  for (const spec of official.specifications) {
    const saved = savedSpecs.get(norm(spec.label));
    if (saved === undefined) {
      absent.push(`${spec.label} = ${spec.value}`);
      continue;
    }
    if (norm(saved) !== norm(spec.value)) changed.push(`${spec.label} : ${saved} → ${spec.value}`);
  }
  if (changed.length) {
    const decisive = official.status === "verified" && official.conflicts.length === 0;
    findings.push(
      finding({
        ...base,
        problem_code: "stale_data",
        problem: `${changed.length} caractéristique(s) ne correspondent plus à la page officielle.`,
        evidence: changed.slice(0, 5).join(" | "),
        severity: "high",
        action: decisive
          ? "Réimporter cet article depuis sa page officielle."
          : "Revue humaine : les preuves ne sont pas décisives.",
        auto_repair_safe: decisive,
      }),
    );
  }
  if (absent.length) {
    findings.push(
      finding({
        ...base,
        problem_code: "missing_specifications",
        problem: `${absent.length} caractéristique(s) officielles absentes du catalogue.`,
        evidence: absent.slice(0, 5).join(" | "),
        severity: "medium",
        action: "Réimporter cet article depuis sa page officielle.",
        auto_repair_safe: official.status === "verified",
      }),
    );
  }
  if (official.conflicts.length) {
    findings.push(
      finding({
        ...base,
        problem_code: "conflicting_source_values",
        problem: "La page officielle donne plusieurs valeurs pour un même champ.",
        evidence: official.conflicts.slice(0, 5).join(" | "),
        severity: "high",
        action: "Revue humaine : conserver les deux valeurs, ne rien deviner.",
      }),
    );
  }

  return findings;
}

/* ------------------------------- reporting ------------------------------ */

export type AuditSummary = {
  checked: number;
  verified: number;
  needs_review: number;
  incorrect: number;
  problems: { code: string; label: string; count: number }[];
};

const PROBLEM_LABELS: Record<string, string> = {
  missing_model: "référence/modèle incorrect ou absent",
  model_mismatch: "modèle différent de la page officielle",
  identity_mismatch: "identités qui ne correspondent pas",
  identity_unverifiable: "identités non confirmées",
  manufacturer_mismatch: "fabricant incorrect",
  missing_manufacturer: "fabricant absent",
  missing_specifications: "caractéristiques manquantes",
  incomplete_extraction: "extractions incomplètes",
  suspicious_specification: "valeurs suspectes",
  conflicting_specifications: "valeurs contradictoires",
  conflicting_source_values: "contradictions sur la source",
  unverified_specification: "valeurs non vérifiées",
  stale_data: "données périmées vs source officielle",
  missing_gallery: "diaporamas vides",
  invalid_gallery: "diaporamas invalides",
  invalid_gallery_entries: "entrées de diaporama non valides",
  stale_gallery: "diaporamas incomplets",
  duplicate_images: "images en double",
  non_official_images: "images de revendeur/moteur de recherche",
  foreign_domain_images: "images hors domaine officiel",
  main_image_outside_gallery: "photo principale hors diaporama",
  official_gallery_unavailable: "diaporamas officiels introuvables",
  duplicate_product: "articles en double",
  duplicate_canonical_url: "articles partageant la même page officielle",
  missing_official_url: "URL officielles manquantes",
  non_official_source: "sources non officielles",
  official_page_inaccessible: "pages officielles inaccessibles",
  reference_without_product: "articles à reconstruire",
  needs_human_review: "articles en attente de revue",
};

const CRITICAL_CODES = new Set([
  "identity_mismatch",
  "model_mismatch",
  "manufacturer_mismatch",
  "missing_model",
  "duplicate_product",
  "duplicate_canonical_url",
  "invalid_gallery",
  "missing_gallery",
  "non_official_images",
  "stale_data",
  "reference_without_product",
]);

export function summarizeFindings(checked: number, findings: AuditFinding[]): AuditSummary {
  const counts = new Map<string, number>();
  const incorrect = new Set<string>();
  const review = new Set<string>();
  for (const item of findings) {
    counts.set(item.problem_code, (counts.get(item.problem_code) ?? 0) + 1);
    const key = item.product_id ?? item.reference_id ?? `${item.problem_code}:${item.product_label}`;
    if (CRITICAL_CODES.has(item.problem_code)) incorrect.add(key);
    else review.add(key);
  }
  for (const key of incorrect) review.delete(key);
  return {
    checked,
    verified: Math.max(0, checked - incorrect.size - review.size),
    needs_review: review.size,
    incorrect: incorrect.size,
    problems: [...counts.entries()]
      .map(([code, count]) => ({ code, label: PROBLEM_LABELS[code] ?? code, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Human-readable report, deterministic — no AI wording needed to be useful. */
export function formatAuditReport(summary: AuditSummary, findings: AuditFinding[], limit = 40): string {
  const lines: string[] = [
    "CONTRÔLE DU CATALOGUE",
    "",
    `Articles contrôlés : ${summary.checked}`,
    "",
    `Conformes : ${summary.verified}`,
    `À revoir : ${summary.needs_review}`,
    `Incorrects : ${summary.incorrect}`,
    "",
  ];
  if (summary.problems.length) {
    lines.push("Problèmes trouvés :");
    for (const problem of summary.problems) lines.push(`- ${problem.count} ${problem.label}`);
    lines.push("");
  } else {
    lines.push("Aucun problème détecté sur les articles réellement contrôlés.", "");
  }
  const severityOrder: Severity[] = ["critical", "high", "medium", "low"];
  const sorted = [...findings].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
  );
  for (const item of sorted.slice(0, limit)) {
    lines.push(
      `${item.product_label}${item.model && !item.product_label.includes(item.model) ? ` (${item.model})` : ""}`,
      `Problème : ${item.problem}`,
      `Preuve : ${item.evidence}${item.source_url ? ` (${item.source_url})` : ""}`,
      `Action : ${item.action}`,
      `Gravité : ${item.severity.toUpperCase()}`,
      `Réparation automatique sûre : ${item.auto_repair_safe ? "OUI" : "NON"}`,
      "",
    );
  }
  if (sorted.length > limit) lines.push(`… et ${sorted.length - limit} autre(s) problème(s) enregistré(s).`);
  return lines.join("\n");
}
