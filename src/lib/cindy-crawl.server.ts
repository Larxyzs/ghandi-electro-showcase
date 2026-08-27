/**
 * Listing crawler — "give Cindy a page, she opens every product on it".
 *
 * The admin pastes a category/listing URL (e.g. all Samsung combi fridges).
 * Cindy opens that page, lets the AI pick the real product-detail links out of
 * the page's links/text, then opens each product page and extracts the full
 * product data (name, reference, characteristics, specs, images) from it.
 * No commercial data is ever invented: price and stock stay with the admin.
 */
import type { CindyAgentEvent, ResearchedProduct } from "./cindy-types";

type Emit = (event: CindyAgentEvent) => void;

export type CrawledProduct = ResearchedProduct & { url: string };

const LINKS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["products"],
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "label"],
        properties: { url: { type: "string" }, label: { type: "string" } },
      },
    },
  },
} as const;

async function pickProductLinks(input: {
  pageUrl: string;
  text: string;
  links: { url: string; text: string }[];
  hint: string;
  limit: number;
}): Promise<{ url: string; label: string }[]> {
  const listing = new URL(input.pageUrl);
  const basePath = listing.pathname.endsWith("/") ? listing.pathname : `${listing.pathname}/`;
  const structuralMatches = input.links.filter((link) => {
    try {
      const candidate = new URL(link.url);
      if (candidate.hostname !== listing.hostname || !candidate.pathname.startsWith(basePath)) return false;
      const remainder = candidate.pathname.slice(basePath.length).replace(/^\/+|\/+$/g, "");
      return remainder.length > 0 && !/^(all|compare|support|reviews?)(\/|$)/i.test(remainder);
    } catch {
      return false;
    }
  });

  // A product nested below a category path is deterministic evidence. Prefer
  // it over asking the model, which can return an empty array with long menus.
  if (structuralMatches.length > 0) {
    const seen = new Set<string>();
    return structuralMatches
      .filter((item) => {
        const key = item.url.replace(/[?#].*$/, "").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, input.limit)
      .map((item) => ({ url: item.url, label: item.text }));
  }

  const { aiSetup, aiFailure } = await import("./ai-config.server");
  const ai = await aiSetup();
  const res = await fetch(ai.url, {
    method: "POST",
    headers: ai.headers,
    body: JSON.stringify({
      model: ai.model,
      messages: [
        {
          role: "system",
          content:
            "Tu analyses une page de listing d'un site d'électroménager. Parmi les liens fournis, sélectionne UNIQUEMENT les liens qui mènent à une fiche produit (un modèle précis). Ignore la navigation, les catégories, les filtres, les comparateurs, le support, les accessoires, les blogs, les réseaux sociaux et les doublons (même modèle, autre couleur). Renvoie les URLs telles quelles.",
        },
        {
          role: "user",
          content: `PAGE : ${input.pageUrl}\nDEMANDE DE L'ADMIN : ${input.hint || "(aucune précision)"}\nMAX : ${input.limit}\n\nLIENS :\n${input.links
            .map((l) => `- ${l.text || "(sans texte)"} → ${l.url}`)
            .join("\n")}\n\nTEXTE DE LA PAGE :\n${input.text.slice(0, 8000)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "product_links", strict: true, schema: LINKS_SCHEMA },
      },
    }),
  });
  if (!res.ok) throw await aiFailure(res);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: { products?: { url?: string; label?: string }[] } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = match ? (JSON.parse(match[0]) as typeof parsed) : {};
  }
  const seen = new Set<string>();
  const out: { url: string; label: string }[] = [];
  for (const item of parsed.products ?? []) {
    const url = String(item?.url ?? "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const key = url.replace(/[?#].*$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url, label: String(item?.label ?? "").trim() });
    if (out.length >= input.limit) break;
  }
  return out;
}

/** Opens a listing page and reads every product page it links to. */
export async function crawlListingPage(input: {
  url: string;
  hint?: string;
  limit?: number;
  emit?: Emit;
  signal?: AbortSignal;
}): Promise<{ products: CrawledProduct[]; visited: number; failures: string[] }> {
  const emit = input.emit ?? (() => {});
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 30);
  const { readPage, webSearch, extractProductFromSources } = await import("./cindy.server");

  emit({
    type: "activity",
    id: "crawl-listing",
    kind: "open",
    label: "J'ouvre la page",
    detail: input.url,
    status: "running",
  });
  const listing = await readPage(input.url);
  let candidateLinks = listing.links;
  const listingUrl = new URL(input.url);
  const listingPath = listingUrl.pathname.endsWith("/")
    ? listingUrl.pathname
    : `${listingUrl.pathname}/`;
  const directProductLinks = candidateLinks.filter((link) => {
    try {
      const candidate = new URL(link.url);
      return (
        candidate.hostname === listingUrl.hostname &&
        candidate.pathname.startsWith(listingPath) &&
        candidate.pathname.slice(listingPath.length).replace(/^\/+|\/+$/g, "").length > 0
      );
    } catch {
      return false;
    }
  });

  // JS-heavy manufacturer grids often expose only one SEO product in their
  // raw HTML. One search based on the admin's sentence is not enough: search
  // the category and the visible seed product separately, then keep only
  // official URLs nested under this exact listing. This is storefront-agnostic
  // and works for Samsung, Bosch, LG, etc. without inventing model references.
  if (directProductLinks.length <= 1) {
    emit({
      type: "activity",
      id: "crawl-recover-links",
      kind: "search",
      label: "La grille est dynamique — je récupère ses fiches",
      detail: `${listingUrl.hostname}${listingPath}`,
      status: "running",
    });
    try {
      const brand = listingUrl.hostname.split(".").filter((part) => !/^(www|com|net|org)$/i.test(part))[0] ?? "";
      const category = listingPath
        .split("/")
        .filter(Boolean)
        .filter((part) => !/^(n_[a-z]+|[a-z]{2}_[a-z]{2}|fr|en|ma)$/i.test(part))
        .join(" ")
        .replace(/[-_]+/g, " ");
      const hint = (input.hint ?? "")
        .replace(/https?:\/\/\S+/gi, " ")
        .replace(/\b(?:ajoute|importe|cherche|trouve|tous?|toutes?|page|site)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const visibleProductName = directProductLinks[0]?.text ?? "";
      const queries = [
        `${brand} ${category}`,
        visibleProductName ? `${brand} ${visibleProductName}` : "",
        hint ? `${brand} ${hint}` : "",
      ]
        .map((query) => query.replace(/\s+/g, " ").trim().slice(0, 140))
        .filter((query, index, all) => query.length > brand.length && all.indexOf(query) === index);

      const recovered: { url: string; text: string }[] = [];
      const recoveredKeys = new Set<string>();
      for (const query of queries) {
        if (input.signal?.aborted) break;
        const hits = await webSearch(query, { max: 20 });
        for (const hit of hits) {
          try {
            const candidate = new URL(hit.url);
            const remainder = candidate.pathname.startsWith(listingPath)
              ? candidate.pathname.slice(listingPath.length).replace(/^\/+|\/+$/g, "")
              : "";
            if (candidate.hostname !== listingUrl.hostname || !remainder) continue;
            const key = candidate.toString().replace(/[?#].*$/, "").toLowerCase();
            if (recoveredKeys.has(key)) continue;
            recoveredKeys.add(key);
            recovered.push({ url: candidate.toString(), text: hit.title });
          } catch {
            /* ignore malformed search result URLs */
          }
        }
        if (recovered.length >= limit) break;
      }
      candidateLinks = [...directProductLinks, ...recovered, ...candidateLinks].filter(
        (link, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.url.replace(/[?#].*$/, "").toLowerCase() ===
              link.url.replace(/[?#].*$/, "").toLowerCase(),
          ) === index,
      );
      emit({
        type: "activity",
        id: "crawl-recover-links",
        kind: "search",
        label: `${new Set([...directProductLinks, ...recovered].map((link) => link.url.replace(/[?#].*$/, "").toLowerCase())).size} fiche(s) récupérée(s)`,
        status: "done",
      });
    } catch (error) {
      emit({
        type: "activity",
        id: "crawl-recover-links",
        kind: "search",
        label: "Récupération complémentaire indisponible",
        detail: error instanceof Error ? error.message : "Erreur",
        status: "error",
      });
    }
  }
  emit({
    type: "activity",
    id: "crawl-listing",
    kind: "open",
    label: "Page lue",
    detail: `${listing.links.length} liens`,
    status: "done",
  });

  emit({
    type: "activity",
    id: "crawl-pick",
    kind: "extract",
    label: "Je repère les produits de la page",
    status: "running",
  });
  const picked = await pickProductLinks({
    pageUrl: input.url,
    text: listing.text,
    links: candidateLinks.slice(0, 220),
    hint: input.hint ?? "",
    limit,
  });
  emit({
    type: "activity",
    id: "crawl-pick",
    kind: "extract",
    label: `${picked.length} produit(s) sur la page`,
    status: picked.length ? "done" : "error",
  });
  if (picked.length === 0) return { products: [], visited: 0, failures: [] };

  picked.forEach((item, index) =>
    emit({ type: "bulk_item", item: { index, ref: item.label || item.url, status: "pending" } }),
  );

  const products: CrawledProduct[] = [];
  const failures: string[] = [];
  let visited = 0;

  for (const [index, item] of picked.entries()) {
    if (input.signal?.aborted) break;
    const ref = item.label || item.url;
    emit({ type: "bulk_item", item: { index, ref, status: "running" } });
    const stepId = `crawl-${index}`;
    emit({
      type: "activity",
      id: stepId,
      kind: "read",
      label: `Fiche ${index + 1}/${picked.length} — j'ouvre et je lis`,
      detail: ref,
      status: "running",
    });
    try {
      const page = await readPage(item.url);
      visited += 1;
      const product = await extractProductFromSources({
        query: item.label || item.url,
        sources: [{ url: item.url, title: item.label || item.url, content: page.text }],
        images: page.images.slice(0, 12),
      });
      products.push({
        ...product,
        url: item.url,
        sources: [{ name: new URL(item.url).hostname, url: item.url, official: true }],
      });
      emit({ type: "bulk_item", item: { index, ref, status: "done", product } });
      emit({
        type: "activity",
        id: stepId,
        kind: "read",
        label: `Fiche ${index + 1}/${picked.length} lue`,
        detail: `${product.name || ref} · ${product.images.length} image(s) · ${product.specifications.length} spéc.`,
        status: "done",
      });
      emit({
        type: "source",
        source: {
          url: item.url,
          domain: new URL(item.url).hostname,
          title: product.name || ref,
          official: true,
          status: "ok",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur";
      failures.push(`${ref} : ${message}`);
      emit({ type: "bulk_item", item: { index, ref, status: "error", message } });
      emit({
        type: "activity",
        id: stepId,
        kind: "read",
        label: `Fiche ${index + 1}/${picked.length} illisible`,
        detail: message,
        status: "error",
      });
    }
  }

  emit({
    type: "bulk_summary",
    total: picked.length,
    ok: products.length,
    failed: picked.length - products.length,
  });

  return { products, visited, failures };
}
