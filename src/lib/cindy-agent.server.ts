/**
 * Cindy — conversational admin agent.
 *
 * A real chatbot: she replies in the admin's own language, explains what she
 * did in simple words, and can act on the whole site through tools (catalog
 * folders, products, bulk research + creation, theme, site mode, popular
 * searches). Every tool call is a real mutation reported back to the UI.
 */
import type { CindyAgentEvent, CindyEvent, ResearchedProduct } from "./cindy-types";
import type { CatalogNode, Product } from "./catalog-types";

type Emit = (event: CindyAgentEvent) => void;

type Json = Record<string, unknown>;

/* ------------------------------- helpers -------------------------------- */

const norm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

async function loadCatalog() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: nodes }, { data: products }] = await Promise.all([
    supabaseAdmin
      .from("catalog_nodes")
      .select("id, parent_id, name, slug, level, sort_order, image_url")
      .order("sort_order"),
    supabaseAdmin
      .from("products")
      .select("id, node_id, name, brand, serial_number, stock, price, featured"),
  ]);
  return {
    nodes: (nodes ?? []) as CatalogNode[],
    products: (products ?? []) as Pick<
      Product,
      "id" | "node_id" | "name" | "brand" | "serial_number" | "stock" | "price" | "featured"
    >[],
  };
}

function pathString(nodes: CatalogNode[], id: string): string {
  const parts: string[] = [];
  let cursor: string | null = id;
  while (cursor) {
    const node = nodes.find((n) => n.id === cursor);
    if (!node) break;
    parts.unshift(node.name);
    cursor = node.parent_id;
  }
  return parts.join(" / ");
}

/** Finds (and optionally creates) the folder chain described by a path. */
async function resolvePath(path: string, create: boolean): Promise<CatalogNode> {
  const segments = path
    .split(/[/>|»]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) throw new Error("Chemin de dossier vide.");
  if (segments.length > 4) throw new Error("Le catalogue n'a que 4 niveaux.");

  let { nodes } = await loadCatalog();
  let parentId: string | null = null;
  let current: CatalogNode | null = null;

  for (const segment of segments) {
    const found = nodes.find(
      (n) => (n.parent_id ?? null) === parentId && norm(n.name) === norm(segment),
    );
    if (found) {
      current = found;
      parentId = found.id;
      continue;
    }
    if (!create) throw new Error(`Dossier introuvable : « ${segment} ».`);
    const { createNode } = await import("./admin.server");
    const created = await createNode(parentId, segment);
    nodes = (await loadCatalog()).nodes;
    current = nodes.find((n) => n.id === created.id) ?? null;
    parentId = created.id;
  }
  if (!current) throw new Error("Chemin invalide.");
  return current;
}

async function findNode(ref: string): Promise<CatalogNode> {
  const { nodes } = await loadCatalog();
  const byId = nodes.find((n) => n.id === ref);
  if (byId) return byId;
  if (ref.includes("/")) return resolvePath(ref, false);
  const matches = nodes.filter((n) => norm(n.name) === norm(ref));
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1)
    throw new Error(`Plusieurs dossiers s'appellent « ${ref} », précisez le chemin complet.`);
  throw new Error(`Dossier introuvable : « ${ref} ».`);
}

async function findProduct(ref: string) {
  const { products } = await loadCatalog();
  const byId = products.find((p) => p.id === ref);
  if (byId) return byId;
  const key = norm(ref);
  const matches = products.filter(
    (p) => norm(p.name) === key || norm(p.serial_number ?? "") === key,
  );
  if (matches.length === 1) return matches[0]!;
  const loose = products.filter(
    (p) => norm(p.name).includes(key) || norm(p.serial_number ?? "").includes(key),
  );
  if (loose.length === 1) return loose[0]!;
  if (loose.length > 1)
    throw new Error(`Plusieurs articles correspondent à « ${ref} », donnez la référence exacte.`);
  throw new Error(`Article introuvable : « ${ref} ».`);
}

const httpsImage = (url?: string | null) =>
  url && /^https:\/\//i.test(url.trim()) ? { imageUrl: url.trim() } : {};

/* -------------------------------- tools --------------------------------- */

type ToolDef = {
  name: string;
  description: string;
  properties: Json;
  required: string[];
  run: (args: Json, emit: Emit) => Promise<unknown>;
};

const str = (args: Json, key: string) => String(args[key] ?? "").trim();
const num = (args: Json, key: string) => {
  const value = args[key];
  return value === null || value === undefined || value === "" ? null : Number(value);
};

const S = { type: ["string", "null"] };
const N = { type: ["number", "null"] };
const B = { type: ["boolean", "null"] };

function buildTools(signal?: AbortSignal): ToolDef[] {
  return [
    {
      name: "get_site_overview",
      description:
        "Lit tout le site : arborescence du catalogue (4 niveaux), articles avec stock/prix, couleurs, mode du site, recherches populaires. À appeler avant toute modification pour connaître l'état réel.",
      properties: {},
      required: [],
      run: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { nodes, products } = await loadCatalog();
        const [{ data: settings }, { data: searches }] = await Promise.all([
          supabaseAdmin.from("site_settings").select("*").eq("id", "default").maybeSingle(),
          supabaseAdmin.from("popular_searches").select("id, term").order("sort_order"),
        ]);
        return {
          folders: nodes.map((n) => ({
            id: n.id,
            level: n.level,
            path: pathString(nodes, n.id),
            has_image: Boolean(n.image_url),
          })),
          products: products.map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            reference: p.serial_number,
            stock: p.stock,
            price: p.price,
            featured: p.featured,
            folder: pathString(nodes, p.node_id),
          })),
          settings,
          popular_searches: searches ?? [],
        };
      },
    },
    {
      name: "create_folder",
      description:
        "Crée un dossier du catalogue. `path` est le chemin complet séparé par ' / ' (ex. 'Réfrigérateurs / Combiné / RB34'). Les dossiers parents manquants sont créés automatiquement.",
      properties: { path: { type: "string" }, image_url: S },
      required: ["path", "image_url"],
      run: async (args, emit) => {
        const node = await resolvePath(str(args, "path"), true);
        const image = httpsImage(str(args, "image_url") || null);
        if (image.imageUrl) {
          const { renameNode } = await import("./admin.server");
          await renameNode(node.id, node.name, image);
        }
        emit({ type: "changed" });
        return { id: node.id, path: str(args, "path"), level: node.level };
      },
    },
    {
      name: "rename_folder",
      description: "Renomme un dossier et/ou change son image (URL https).",
      properties: { folder: { type: "string" }, name: S, image_url: S },
      required: ["folder", "name", "image_url"],
      run: async (args, emit) => {
        const node = await findNode(str(args, "folder"));
        const { renameNode } = await import("./admin.server");
        await renameNode(node.id, str(args, "name") || node.name, httpsImage(str(args, "image_url")));
        emit({ type: "changed" });
        return { ok: true };
      },
    },
    {
      name: "move_folder",
      description:
        "Déplace un dossier (avec tout son contenu) sous un autre dossier, ou à la racine si `new_parent` est vide.",
      properties: { folder: { type: "string" }, new_parent: S },
      required: ["folder", "new_parent"],
      run: async (args, emit) => {
        const node = await findNode(str(args, "folder"));
        const parentRef = str(args, "new_parent");
        const parent = parentRef ? await findNode(parentRef) : null;
        const { reparentNode } = await import("./admin.server");
        await reparentNode(node.id, parent?.id ?? null);
        emit({ type: "changed" });
        return { ok: true };
      },
    },
    {
      name: "delete_folder",
      description:
        "Supprime un dossier ET tout ce qu'il contient. À n'utiliser qu'après confirmation explicite de l'admin.",
      properties: { folder: { type: "string" } },
      required: ["folder"],
      run: async (args, emit) => {
        const node = await findNode(str(args, "folder"));
        const { deleteNode, nodeDeletionImpact } = await import("./admin.server");
        const impact = await nodeDeletionImpact(node.id);
        await deleteNode(node.id);
        emit({ type: "changed" });
        return { deleted: node.name, ...impact };
      },
    },
    {
      name: "create_product",
      description:
        "Crée un article dans un dossier (chemin complet ; les dossiers manquants sont créés). Le prix et le stock viennent uniquement de l'admin : si l'admin ne les a pas donnés, mets stock 0 et price null.",
      properties: {
        folder_path: { type: "string" },
        name: { type: "string" },
        brand: S,
        reference: S,
        characteristics: S,
        stock: N,
        price: N,
        image_url: S,
        featured: B,
      },
      required: [
        "folder_path",
        "name",
        "brand",
        "reference",
        "characteristics",
        "stock",
        "price",
        "image_url",
        "featured",
      ],
      run: async (args, emit) => {
        const node = await resolvePath(str(args, "folder_path"), true);
        if (node.level < 3) throw new Error("Un article doit être dans un dossier Produit ou Format.");
        const { saveProduct } = await import("./admin.server");
        const created = await saveProduct({
          node_id: node.id,
          name: str(args, "name"),
          brand: str(args, "brand"),
          serial_number: str(args, "reference"),
          characteristics: str(args, "characteristics"),
          stock: Math.max(0, Math.floor(num(args, "stock") ?? 0)),
          price: num(args, "price"),
          featured: args["featured"] === true,
          ...httpsImage(str(args, "image_url")),
        });
        emit({ type: "changed" });
        return { id: created.id, folder: pathString((await loadCatalog()).nodes, node.id) };
      },
    },
    {
      name: "update_product",
      description:
        "Modifie un article existant (nom, marque, référence, caractéristiques, stock, prix, image, mise en avant). Les champs laissés vides/null ne changent pas.",
      properties: {
        product: { type: "string" },
        name: S,
        brand: S,
        reference: S,
        characteristics: S,
        stock: N,
        price: N,
        image_url: S,
        featured: B,
      },
      required: [
        "product",
        "name",
        "brand",
        "reference",
        "characteristics",
        "stock",
        "price",
        "image_url",
        "featured",
      ],
      run: async (args, emit) => {
        const product = await findProduct(str(args, "product"));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: full } = await supabaseAdmin
          .from("products")
          .select("*")
          .eq("id", product.id)
          .single();
        const { saveProduct } = await import("./admin.server");
        const stock = num(args, "stock");
        const price = num(args, "price");
        await saveProduct({
          id: product.id,
          node_id: full!.node_id,
          name: str(args, "name") || full!.name,
          brand: str(args, "brand") || (full!.brand ?? ""),
          serial_number: str(args, "reference") || (full!.serial_number ?? ""),
          characteristics: str(args, "characteristics") || (full!.characteristics ?? ""),
          stock: stock === null ? full!.stock : Math.max(0, Math.floor(stock)),
          price: price === null ? full!.price : price,
          featured: args["featured"] === null || args["featured"] === undefined
            ? Boolean(full!.featured)
            : args["featured"] === true,
          ...httpsImage(str(args, "image_url")),
        });
        emit({ type: "changed" });
        return { ok: true, product: product.name };
      },
    },
    {
      name: "move_product",
      description: "Déplace un article vers un autre dossier Produit/Format (chemin complet).",
      properties: { product: { type: "string" }, folder_path: { type: "string" } },
      required: ["product", "folder_path"],
      run: async (args, emit) => {
        const product = await findProduct(str(args, "product"));
        const node = await resolvePath(str(args, "folder_path"), true);
        const { moveProductToNode } = await import("./admin.server");
        await moveProductToNode(product.id, node.id);
        emit({ type: "changed" });
        return { ok: true };
      },
    },
    {
      name: "delete_product",
      description: "Supprime un article. À n'utiliser qu'après confirmation explicite de l'admin.",
      properties: { product: { type: "string" } },
      required: ["product"],
      run: async (args, emit) => {
        const product = await findProduct(str(args, "product"));
        const { deleteProduct } = await import("./admin.server");
        await deleteProduct(product.id);
        emit({ type: "changed" });
        return { deleted: product.name };
      },
    },
    {
      name: "research_product",
      description:
        "Recherche une référence produit (mémoire d'abord, puis UNE recherche web sur le site officiel). Renvoie nom, marque, caractéristiques, spécifications, images et sources. Ne renvoie jamais de prix ni de stock.",
      properties: { reference: { type: "string" }, force: B },
      required: ["reference", "force"],
      run: async (args, emit) => {
        const { researchProduct } = await import("./cindy.server");
        const product = await researchProduct(
          str(args, "reference"),
          (event: CindyEvent) => emit(event as CindyAgentEvent),
          { force: args["force"] === true },
        );
        if (!product) throw new Error("Aucune donnée trouvée pour cette référence.");
        return summarize(product);
      },
    },
    {
      name: "bulk_create_products",
      description:
        "Recherche PLUSIEURS références et crée les articles d'un coup. Utilise la mémoire, une seule recherche web par référence inconnue, et n'écrase jamais un article existant (il est signalé comme doublon). price/stock/folder_path communs viennent de l'admin.",
      properties: {
        references: { type: "array", items: { type: "string" } },
        folder_path: S,
        brand: S,
        stock: N,
        price: N,
      },
      required: ["references", "folder_path", "brand", "stock", "price"],
      run: async (args, emit) => {
        const refs = Array.from(
          new Set(
            (Array.isArray(args["references"]) ? args["references"] : [])
              .map((r) => String(r ?? "").trim())
              .filter((r) => r.length >= 2),
          ),
        ).slice(0, 40);
        if (refs.length === 0) throw new Error("Aucune référence fournie.");

        const { researchProduct } = await import("./cindy.server");
        const { saveProduct } = await import("./admin.server");
        const commonFolder = str(args, "folder_path");
        const stock = Math.max(0, Math.floor(num(args, "stock") ?? 0));
        const price = num(args, "price");
        const brandHint = str(args, "brand");
        const report: {
          reference: string;
          status: "created" | "duplicate" | "error";
          detail?: string;
        }[] = [];

        refs.forEach((ref, index) =>
          emit({ type: "bulk_item", item: { index, ref, status: "pending" } }),
        );

        for (const [index, ref] of refs.entries()) {
          emit({ type: "bulk_item", item: { index, ref, status: "running" } });
          try {
            const { products } = await loadCatalog();
            const key = norm(ref);
            const exists = products.find(
              (p) => norm(p.serial_number ?? "") === key || norm(p.name) === key,
            );
            if (exists) {
              report.push({ reference: ref, status: "duplicate", detail: exists.name });
              emit({
                type: "bulk_item",
                item: { index, ref, status: "error", message: "Déjà dans le catalogue" },
              });
              continue;
            }

            const researched = await researchProduct(ref, (event) => emit(event as CindyAgentEvent));
            if (!researched) throw new Error("Aucune donnée trouvée");
            const folderPath =
              commonFolder ||
              [researched.brand || brandHint || "Divers", "Modèles", researched.model || ref]
                .filter(Boolean)
                .join(" / ");
            const node = await resolvePath(folderPath, true);
            await saveProduct({
              node_id: node.id,
              name: researched.name || ref,
              brand: researched.brand || brandHint,
              serial_number: researched.model || ref,
              characteristics: researched.characteristics,
              specifications: researched.specifications,
              gallery: researched.images.slice(0, 8),
              marketing_sections: researched.marketing_sections as never,
              source_url: researched.sources[0]?.url ?? null,
              source_name: researched.sources[0]?.name ?? null,
              stock,
              price,
              ...httpsImage(researched.images[0] ?? null),
            });
            report.push({ reference: ref, status: "created" });
            emit({ type: "bulk_item", item: { index, ref, status: "done" } });
            emit({ type: "changed" });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Erreur";
            report.push({ reference: ref, status: "error", detail: message });
            emit({ type: "bulk_item", item: { index, ref, status: "error", message } });
          }
        }

        emit({
          type: "bulk_summary",
          total: refs.length,
          ok: report.filter((r) => r.status === "created").length,
          failed: report.filter((r) => r.status !== "created").length,
        });
        return report;
      },
    },
    {
      name: "discover_references",
      description:
        "Comprend une demande en langage naturel (« va dans tous les réfrigérateurs combinés Samsung Afrique du Nord (samsung.com/n_africa) », « ajoute tout le rayon lave-linge LG »), ouvre vraiment les pages de listing officielles et renvoie la liste des références de modèles trouvées. À utiliser AVANT bulk_create_products quand l'admin ne donne pas les références une par une. N'écris jamais la phrase de l'admin dans une recherche mot à mot : passe-la ici.",
      properties: { instruction: { type: "string" }, limit: N },
      required: ["instruction", "limit"],
      run: async (args, emit) => {
        const { discoverReferences } = await import("./cindy-discover.server");
        const limit = num(args, "limit");
        const found = await discoverReferences({
          instruction: str(args, "instruction"),
          ...(limit ? { limit: Math.floor(limit) } : {}),
          emit,
        });
        if (found.references.length === 0)
          throw new Error(
            "Aucun modèle trouvé sur ces pages. Donne-moi une page de listing plus précise ou les références directement.",
          );
        return {
          brand: found.plan.brand,
          pages: found.pages,
          references: found.references,
        };
      },
    },
    {
      name: "import_from_page",
      description:
        "L'admin donne l'URL d'une page (rayon, listing, résultats d'une marque) : cet outil ouvre la page, repère TOUS les liens de fiches produits, ouvre chaque fiche une par une et en extrait toutes les informations (nom, référence, caractéristiques, spécifications, images), puis crée les articles dans le dossier demandé. Les doublons déjà au catalogue sont signalés, pas recréés. price/stock viennent uniquement de l'admin (laisse null/0 s'il ne les a pas donnés). C'est l'outil à utiliser dès que l'admin envoie un lien de page avec plusieurs produits.",
      properties: {
        url: { type: "string" },
        folder_path: S,
        hint: S,
        limit: N,
        stock: N,
        price: N,
        create: B,
      },
      required: ["url", "folder_path", "hint", "limit", "stock", "price", "create"],
      run: async (args, emit) => {
        const url = str(args, "url");
        if (!/^https?:\/\//i.test(url)) throw new Error("Donne-moi une URL complète (https://…).");
        const limit = num(args, "limit");
        const { crawlListingPage } = await import("./cindy-crawl.server");
        const crawled = await crawlListingPage({
          url,
          hint: str(args, "hint"),
          ...(limit ? { limit: Math.floor(limit) } : {}),
          emit,
          ...(signal ? { signal } : {}),
        });
        if (crawled.products.length === 0)
          throw new Error(
            "Aucune fiche produit trouvée sur cette page. Envoie-moi la page de listing exacte ou les références.",
          );

        const shouldCreate = args["create"] !== false;
        const report = crawled.products.map((p) => ({
          reference: p.model || p.name,
          name: p.name,
          brand: p.brand,
          url: p.url,
          images: p.images.length,
          specifications: p.specifications.length,
          status: "found" as string,
        }));

        if (!shouldCreate) return { pages_read: crawled.visited, products: report, failures: crawled.failures };

        const folderPath = str(args, "folder_path");
        const stock = Math.max(0, Math.floor(num(args, "stock") ?? 0));
        const price = num(args, "price");
        const { saveProduct } = await import("./admin.server");

        for (const [index, product] of crawled.products.entries()) {
          if (signal?.aborted) break;
          const reference = product.model || product.name;
          try {
            const { products: existing } = await loadCatalog();
            const key = norm(reference);
            const duplicate = existing.find(
              (p) => norm(p.serial_number ?? "") === key || norm(p.name) === key,
            );
            if (duplicate) {
              report[index]!.status = "duplicate";
              continue;
            }
            const path =
              folderPath ||
              [product.brand || "Divers", "Modèles", reference].filter(Boolean).join(" / ");
            const node = await resolvePath(path, true);
            await saveProduct({
              node_id: node.id,
              name: product.name || reference,
              brand: product.brand,
              serial_number: product.model || reference,
              characteristics: product.characteristics,
              specifications: product.specifications,
              gallery: product.images.slice(0, 8),
              marketing_sections: product.marketing_sections as never,
              source_url: product.url,
              source_name: product.sources[0]?.name ?? null,
              stock,
              price,
              ...httpsImage(product.images[0] ?? null),
            });
            report[index]!.status = "created";
            emit({ type: "changed" });
          } catch (error) {
            report[index]!.status = `error: ${error instanceof Error ? error.message : "échec"}`;
          }
        }

        return {
          pages_read: crawled.visited,
          created: report.filter((r) => r.status === "created").length,
          duplicates: report.filter((r) => r.status === "duplicate").length,
          products: report,
          failures: crawled.failures,
        };
      },
    },

    {
      name: "web_search",
      description:
        "Recherche web par mots-clés courts (jamais une phrase complète). Utile pour trouver la bonne page officielle avant open_page.",
      properties: { query: { type: "string" }, max: N },
      required: ["query", "max"],
      run: async (args, emit) => {
        const query = str(args, "query");
        const { webSearch } = await import("./cindy.server");
        emit({ type: "activity", id: `s-${query}`, kind: "search", label: `Recherche : ${query}`, status: "running" });
        const max = num(args, "max");
        const hits = await webSearch(query, { max: Math.min(Math.max(max ?? 6, 1), 10) });
        emit({
          type: "activity",
          id: `s-${query}`,
          kind: "search",
          label: `Recherche : ${query}`,
          detail: `${hits.length} résultats`,
          status: "done",
        });
        return hits.map((h) => ({ url: h.url, title: h.title, snippet: h.content.slice(0, 300) }));
      },
    },
    {
      name: "open_page",
      description:
        "Ouvre une URL et renvoie son texte, ses images et ses liens (gratuit, aucun crédit de recherche). Utilise-le pour explorer un site officiel page par page.",
      properties: { url: { type: "string" } },
      required: ["url"],
      run: async (args, emit) => {
        const url = str(args, "url");
        const { readPage } = await import("./cindy.server");
        emit({ type: "activity", id: `o-${url}`, kind: "open", label: "J'ouvre la page", detail: url, status: "running" });
        try {
          const page = await readPage(url);
          emit({ type: "activity", id: `o-${url}`, kind: "open", label: "Page lue", detail: url, status: "done" });
          return {
            text: page.text.slice(0, 9000),
            images: page.images.slice(0, 12),
            links: page.links.slice(0, 120),
          };
        } catch (error) {
          emit({ type: "activity", id: `o-${url}`, kind: "open", label: "Page inaccessible", detail: url, status: "error" });
          throw error;
        }
      },
    },
    {
      name: "update_theme",
      description:
        "Change les couleurs globales du site (hex #RRGGBB) : primary_color (fond), secondary_color (couleur de marque), text_color.",
      properties: { primary_color: S, secondary_color: S, text_color: S },
      required: ["primary_color", "secondary_color", "text_color"],
      run: async (args, emit) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: current } = await supabaseAdmin
          .from("site_settings")
          .select("primary_color, secondary_color, text_color")
          .eq("id", "default")
          .single();
        const { saveSettings } = await import("./admin.server");
        const next = {
          primary_color: str(args, "primary_color") || current!.primary_color,
          secondary_color: str(args, "secondary_color") || current!.secondary_color,
          text_color: str(args, "text_color") || current!.text_color,
        };
        await saveSettings(next);
        emit({ type: "changed" });
        return next;
      },
    },
    {
      name: "set_site_mode",
      description:
        "Change le mode du site public : online, maintenance, coming_soon ou closed (selon les modes disponibles).",
      properties: { mode: { type: "string" } },
      required: ["mode"],
      run: async (args, emit) => {
        const { setSiteMode } = await import("./admin.server");
        await setSiteMode(str(args, "mode") as never);
        emit({ type: "changed" });
        return { mode: str(args, "mode") };
      },
    },
    {
      name: "manage_popular_search",
      description:
        "Ajoute (action='add') ou supprime (action='remove') une recherche populaire affichée dans la barre de recherche du site.",
      properties: { action: { type: "string" }, term: { type: "string" } },
      required: ["action", "term"],
      run: async (args, emit) => {
        const { addPopularSearch, deletePopularSearch } = await import("./admin.server");
        const term = str(args, "term");
        if (str(args, "action") === "remove") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin.from("popular_searches").select("id, term");
          const found = (data ?? []).find((row) => norm(row.term) === norm(term));
          if (!found) throw new Error(`Recherche populaire introuvable : « ${term} ».`);
          await deletePopularSearch(found.id);
        } else {
          await addPopularSearch(term);
        }
        emit({ type: "changed" });
        return { ok: true };
      },
    },
    {
      name: "reorder_popular_search",
      description:
        "Déplace une recherche populaire dans la liste (direction 'up' ou 'down').",
      properties: { term: { type: "string" }, direction: { type: "string" } },
      required: ["term", "direction"],
      run: async (args, emit) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { movePopularSearch } = await import("./admin.server");
        const { data } = await supabaseAdmin.from("popular_searches").select("id, term");
        const found = (data ?? []).find((row) => norm(row.term) === norm(str(args, "term")));
        if (!found) throw new Error(`Recherche populaire introuvable : « ${str(args, "term")} ».`);
        await movePopularSearch(found.id, str(args, "direction") === "up" ? "up" : "down");
        emit({ type: "changed" });
        return { ok: true };
      },
    },
    {
      name: "reorder_folder",
      description:
        "Change la position d'affichage d'un dossier parmi ses voisins (direction 'up' ou 'down').",
      properties: { folder: { type: "string" }, direction: { type: "string" } },
      required: ["folder", "direction"],
      run: async (args, emit) => {
        const node = await findNode(str(args, "folder"));
        const { moveNode } = await import("./admin.server");
        await moveNode(node.id, str(args, "direction") === "up" ? "up" : "down");
        emit({ type: "changed" });
        return { ok: true };
      },
    },
    {
      name: "set_product_featured",
      description:
        "Met un article en avant sur la page d'accueil (featured=true) ou le retire (featured=false).",
      properties: { product: { type: "string" }, featured: { type: "boolean" } },
      required: ["product", "featured"],
      run: async (args, emit) => {
        const product = await findProduct(str(args, "product"));
        const { setProductFeatured } = await import("./admin.server");
        await setProductFeatured(product.id, args["featured"] === true);
        emit({ type: "changed" });
        return { ok: true, product: product.name };
      },
    },
    {
      name: "list_orders",
      description:
        "Lit les commandes des clients (nom, téléphone, adresse, articles, total, statut). Ne jamais divulguer ces informations en dehors de l'administration.",
      properties: {},
      required: [],
      run: async () => {
        const { listOrders } = await import("./orders.server");
        const orders = await listOrders();
        return orders.slice(0, 60);
      },
    },
    {
      name: "update_order_status",
      description:
        "Change le statut d'une commande à partir de sa référence : 'nouveau', 'en_cours' ou 'termine'.",
      properties: { reference: { type: "string" }, status: { type: "string" } },
      required: ["reference", "status"],
      run: async (args, emit) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ref = str(args, "reference");
        const { data } = await supabaseAdmin.from("orders").select("id, reference");
        const found = (data ?? []).find(
          (row) => norm(row.reference) === norm(ref) || row.id === ref,
        );
        if (!found) throw new Error(`Commande introuvable : « ${ref} ».`);
        const { setOrderStatus } = await import("./orders.server");
        await setOrderStatus(found.id, str(args, "status") as never);
        emit({ type: "changed" });
        return { ok: true, reference: found.reference, status: str(args, "status") };
      },
    },
    {
      name: "list_history",
      description:
        "Liste les dernières actions enregistrées dans l'administration (qui a fait quoi, et si c'est déjà annulé).",
      properties: {},
      required: [],
      run: async () => {
        const { listActions } = await import("./admin.server");
        return listActions();
      },
    },
    {
      name: "list_restore_points",
      description:
        "Liste les points de restauration disponibles (sauvegardes complètes du catalogue, des articles, des couleurs et des recherches populaires).",
      properties: {},
      required: [],
      run: async () => {
        const { listSnapshots } = await import("./admin.server");
        return listSnapshots();
      },
    },
    {
      name: "create_restore_point",
      description:
        "Crée une sauvegarde complète du site avant un gros changement, pour pouvoir tout remettre en arrière ensuite.",
      properties: { label: S },
      required: ["label"],
      run: async (args) => {
        const { createSnapshot } = await import("./admin.server");
        return createSnapshot(str(args, "label") || "Point de restauration");
      },
    },
    {
      name: "restore_site",
      description:
        "Remet tout le site (dossiers, articles, couleurs, recherches populaires) dans l'état d'un point de restauration. À utiliser quand l'admin dit qu'il n'aime pas les changements. Demande toujours confirmation avant.",
      properties: { restore_point_id: { type: "string" } },
      required: ["restore_point_id"],
      run: async (args, emit) => {
        const { restoreSnapshot } = await import("./admin.server");
        const result = await restoreSnapshot(str(args, "restore_point_id"));
        emit({ type: "changed" });
        return result;
      },
    },
    {
      name: "optimize_images",
      description:
        "Liste les images du site (articles et dossiers) avec leur taille pour repérer celles à remplacer. N'altère rien : sert à conseiller l'admin.",
      properties: {},
      required: [],
      run: async () => {
        const { listAllImages } = await import("./admin.server");
        const images = await listAllImages();
        return images.map((image) => ({
          kind: image.kind,
          label: image.label,
          has_image: Boolean(image.imageUrl),
        }));
      },
    },
    {
      name: "check_images",
      description:
        "Regarde VRAIMENT les images (vision IA) d'un dossier et de tous ses sous-dossiers, et dit pour chacune si le cadrage/la qualité vont ou ce qui cloche. Ne modifie rien. folder_path vide = tout le site.",
      properties: {
        folder_path: S,
        include_folders: B,
        limit: N,
      },
      required: ["folder_path", "include_folders", "limit"],
      run: async (args, emit) => {
        const { collectImageTargets, inspectImage } = await import("./cindy-images.server");
        const path = str(args, "folder_path");
        const root = path ? (await resolvePath(path, false)).id : null;
        const targets = (
          await collectImageTargets(root, {
            includeFolders: args["include_folders"] === true,
            includeProducts: true,
          })
        ).slice(0, Math.max(1, Math.floor(num(args, "limit") ?? 40)));
        const out: unknown[] = [];
        for (const target of targets) {
          if (signal?.aborted) break;
          if (!target.imagePath) {
            out.push({ label: target.label, kind: target.kind, ok: false, issues: ["aucune image"] });
            continue;
          }
          emit({
            type: "activity",
            id: `img-${target.id}`,
            kind: "images",
            label: `J'examine l'image de « ${target.label} »`,
            status: "running",
          });
          try {
            const verdict = await inspectImage(target.imagePath);
            emit({
              type: "activity",
              id: `img-${target.id}`,
              kind: "images",
              label: `${target.label} : ${verdict?.ok ? "image correcte" : "à améliorer"}`,
              ...(verdict?.issues.length ? { detail: verdict.issues.join(", ") } : {}),
              status: "done",
            });
            out.push({ label: target.label, kind: target.kind, ...(verdict ?? { ok: false }) });
          } catch (error) {
            emit({
              type: "activity",
              id: `img-${target.id}`,
              kind: "images",
              label: `Image illisible : ${target.label}`,
              status: "error",
            });
            out.push({
              label: target.label,
              kind: target.kind,
              ok: false,
              issues: [error instanceof Error ? error.message : "erreur"],
            });
          }
        }
        return out;
      },
    },
    {
      name: "fix_images",
      description:
        "AMÉLIORE VRAIMENT LES IMAGES : pour un dossier (et tous ses sous-dossiers) ou pour un article précis, Cindy regarde chaque image, puis la refait avec un modèle d'image — appareil entier visible, centré, à la bonne échelle, fond blanc propre, format carré — et remplace l'image sur le site. instruction = consigne libre de l'admin (ex. « qu'on voie tout le frigo »). force=true refait toutes les images sans juger d'abord. folder_path vide + product vide = tout le site.",
      properties: {
        folder_path: S,
        product: S,
        include_folders: B,
        force: B,
        instruction: S,
        limit: N,
      },
      required: ["folder_path", "product", "include_folders", "force", "instruction", "limit"],
      run: async (args, emit) => {
        const { collectImageTargets, fixImages } = await import("./cindy-images.server");
        const { createSnapshot } = await import("./admin.server");
        const productRef = str(args, "product");
        const path = str(args, "folder_path");
        let targets;
        if (productRef) {
          const product = await findProduct(productRef);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("products")
            .select("id, name, image_url")
            .eq("id", product.id)
            .single();
          targets = [
            {
              kind: "product" as const,
              id: data!.id,
              label: data!.name,
              imagePath: data!.image_url,
            },
          ];
        } else {
          const root = path ? (await resolvePath(path, false)).id : null;
          targets = await collectImageTargets(root, {
            includeFolders: args["include_folders"] === true,
            includeProducts: true,
          });
        }
        targets = targets.slice(0, Math.max(1, Math.floor(num(args, "limit") ?? 30)));
        await createSnapshot("Avant retouche des images");

        const results = await fixImages(targets, {
          force: args["force"] === true,
          instruction: str(args, "instruction"),
          ...(signal ? { signal } : {}),
          onProgress: (message) =>
            emit({
              type: "activity",
              id: `fix-${message.slice(0, 40)}`,
              kind: "images",
              label: message,
              status: "running",
            }),
        });
        emit({ type: "changed" });
        const improved = results.filter((r) => r.status === "improved").length;
        emit({
          type: "activity",
          id: "fix-done",
          kind: "images",
          label: `${improved} image(s) refaite(s) sur ${results.length}`,
          status: "done",
        });
        return { improved, total: results.length, results };
      },
    },
    {
      name: "set_image",
      description:
        "Met une image précise (URL https) sur un article ou un dossier du catalogue. kind = 'product' ou 'folder'.",
      properties: { kind: { type: "string" }, target: { type: "string" }, image_url: { type: "string" } },
      required: ["kind", "target", "image_url"],
      run: async (args, emit) => {
        const url = str(args, "image_url");
        if (!/^https:\/\//i.test(url)) throw new Error("L'URL de l'image doit commencer par https.");
        const kind = str(args, "kind");
        if (kind === "folder") {
          const node = await findNode(str(args, "target"));
          const { renameNode } = await import("./admin.server");
          await renameNode(node.id, node.name, { imageUrl: url });
          emit({ type: "changed" });
          return { ok: true, folder: node.name };
        }
        const product = await findProduct(str(args, "target"));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: full } = await supabaseAdmin
          .from("products")
          .select("*")
          .eq("id", product.id)
          .single();
        const { saveProduct } = await import("./admin.server");
        await saveProduct({
          id: full!.id,
          node_id: full!.node_id,
          name: full!.name,
          brand: full!.brand ?? "",
          serial_number: full!.serial_number ?? "",
          characteristics: full!.characteristics ?? "",
          stock: full!.stock,
          price: full!.price,
          featured: Boolean(full!.featured),
          imageUrl: url,
        });
        emit({ type: "changed" });
        return { ok: true, product: full!.name };
      },
    },
    {
      name: "bulk_update_products",
      description:
        "Modifie d'un coup TOUS les articles d'un dossier et de ses sous-dossiers (prix, stock, marque, caractéristiques, mise en avant). Les champs null ne changent pas. Le prix et le stock ne viennent QUE de l'admin.",
      properties: {
        folder_path: { type: "string" },
        price: N,
        stock: N,
        brand: S,
        characteristics: S,
        featured: B,
      },
      required: ["folder_path", "price", "stock", "brand", "characteristics", "featured"],
      run: async (args, emit) => {
        const node = await resolvePath(str(args, "folder_path"), false);
        const { subtreeNodeIds } = await import("./cindy-images.server");
        const ids = await subtreeNodeIds(node.id);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const patch: Json = {};
        const price = num(args, "price");
        const stock = num(args, "stock");
        if (price !== null) patch["price"] = price;
        if (stock !== null) patch["stock"] = Math.max(0, Math.floor(stock));
        if (str(args, "brand")) patch["brand"] = str(args, "brand");
        if (str(args, "characteristics")) patch["characteristics"] = str(args, "characteristics");
        if (args["featured"] === true || args["featured"] === false)
          patch["featured"] = args["featured"];
        if (Object.keys(patch).length === 0) throw new Error("Rien à modifier.");
        const { data, error } = await looseDb(supabaseAdmin)
          .from("products")
          .update(patch)
          .in("node_id", ids)
          .select("id");
        if (error) throw new Error(error.message);
        emit({ type: "changed" });
        return { updated: (data ?? []).length, folder: pathString((await loadCatalog()).nodes, node.id) };
      },
    },
    {
      name: "read_data",
      description:
        "Lit directement les données du site (table 'products', 'catalog_nodes', 'orders', 'popular_searches', 'site_settings', 'site_snapshots', 'cindy_actions'). filter = colonne=valeur (facultatif). Sert quand aucun autre outil ne suffit.",
      properties: { table: { type: "string" }, filter: S, limit: N },
      required: ["table", "filter", "limit"],
      run: async (args) => {
        const table = str(args, "table");
        if (!READABLE_TABLES.includes(table)) throw new Error(`Table non autorisée : ${table}.`);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const columns = table === "site_settings" ? PUBLIC_SETTINGS_COLUMNS : "*";
        let query = looseDb(supabaseAdmin)
          .from(table)
          .select(columns)
          .limit(Math.min(200, Math.max(1, Math.floor(num(args, "limit") ?? 50))));
        const filter = str(args, "filter");
        if (filter.includes("=")) {
          const [column, ...rest] = filter.split("=");
          query = query.eq(column!.trim(), rest.join("=").trim());
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data;
      },
    },
    {
      name: "write_data",
      description:
        "Modifie directement une ligne de données du site quand aucun outil dédié ne convient (table 'products', 'catalog_nodes', 'orders', 'popular_searches', 'site_settings'). changes = objet colonne/valeur. Les clés d'API et les mots de passe sont interdits.",
      properties: { table: { type: "string" }, id: { type: "string" }, changes: { type: "object" } },
      required: ["table", "id", "changes"],
      run: async (args, emit) => {
        const table = str(args, "table");
        if (!WRITABLE_TABLES.includes(table)) throw new Error(`Table non modifiable : ${table}.`);
        const changes = (args["changes"] ?? {}) as Json;
        for (const key of Object.keys(changes)) {
          if (FORBIDDEN_COLUMNS.some((forbidden) => key.includes(forbidden)))
            throw new Error(`Colonne protégée : ${key}.`);
        }
        if (Object.keys(changes).length === 0) throw new Error("Aucune modification fournie.");
        const { createSnapshot } = await import("./admin.server");
        await createSnapshot("Avant modification directe");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await looseDb(supabaseAdmin)
          .from(table)
          .update(changes)
          .eq("id", str(args, "id"))
          .select("id");
        if (error) throw new Error(error.message);
        emit({ type: "changed" });
        return { updated: (data ?? []).length };
      },
    },
  ];
}

/* --------------------- untyped table access (Cindy) ---------------------- */

type LooseResult = Promise<{ data: Json[] | null; error: { message: string } | null }>;
type LooseBuilder = LooseResult & {
  select: (columns: string) => LooseBuilder;
  update: (values: Json) => LooseBuilder;
  eq: (column: string, value: unknown) => LooseBuilder;
  in: (column: string, values: unknown[]) => LooseBuilder;
  limit: (count: number) => LooseBuilder;
};

/**
 * Cindy can touch any table in the app schema, so her generic read/write tools
 * bypass the generated per-table types (table names are validated against the
 * allow-lists below instead).
 */
function looseDb(client: unknown): { from: (table: string) => LooseBuilder } {
  return client as { from: (table: string) => LooseBuilder };
}

const READABLE_TABLES = [
  "products",
  "catalog_nodes",
  "orders",
  "popular_searches",
  "site_settings",
  "site_snapshots",
  "cindy_actions",
];

const WRITABLE_TABLES = [
  "products",
  "catalog_nodes",
  "orders",
  "popular_searches",
  "site_settings",
];

const FORBIDDEN_COLUMNS = ["api_key", "password", "hash", "token", "secret"];

const PUBLIC_SETTINGS_COLUMNS =
  "id, primary_color, secondary_color, text_color, site_mode, search_provider, search_model, ai_provider, ai_model, updated_at";



function summarize(product: ResearchedProduct) {
  return {
    brand: product.brand,
    name: product.name,
    model: product.model,
    characteristics: product.characteristics.slice(0, 1200),
    specifications: product.specifications.slice(0, 20),
    images: product.images.slice(0, 6),
    sources: product.sources,
    confidence: product.confidence,
  };
}

/* ------------------------------ agent loop ------------------------------ */

const SYSTEM = `Tu es Cindy, l'assistante IA de l'administration du site "Ghandi Home Electro" (électroménager, Casablanca).

LANGUE — RÈGLE ABSOLUE : réponds TOUJOURS dans la langue du dernier message de l'admin. S'il écrit en français, réponds en français ; en arabe (même en arabizi/darija latine), réponds en arabe ; en anglais, en anglais ; idem espagnol/italien. Ne change jamais de langue de ta propre initiative.

TON : vraie conversation, chaleureuse et brève. Pas de jargon technique, pas d'ID de base de données, pas de JSON dans tes réponses. Tu tutoies l'admin poliment.

TU AGIS VRAIMENT — ACCÈS COMPLET : tu as les mêmes droits qu'un admin. Tes outils modifient le site en direct : dossiers du catalogue (création, renommage, images, déplacement, ordre, suppression), articles (création, modification, prix/stock donnés par l'admin, images, mise en avant, déplacement, suppression), recherche produit et création en masse, couleurs et design du site, mode du site, recherches populaires, commandes clients (lecture et statut), historique des actions, et points de restauration. Quand l'admin demande un changement, fais-le avec les outils au lieu d'expliquer comment faire. Lis l'état du site avec get_site_overview quand tu as besoin de contexte.

RETOUR EN ARRIÈRE : une sauvegarde complète du site est créée automatiquement avant tes premiers changements de chaque conversation. Si l'admin dit qu'il n'aime pas le résultat, propose-lui la restauration : liste les points avec list_restore_points, puis, après sa confirmation, utilise restore_site. Avant un très gros chantier (redesign, réorganisation complète), crée d'abord un point avec create_restore_point.

CONFIDENTIALITÉ : les données clients (nom, téléphone, adresse) restent dans l'administration ; tu ne les partages jamais ailleurs et tu ne les utilises que pour répondre à l'admin.

APRÈS CHAQUE ACTION : explique simplement ce que tu as fait, en une à trois phrases + une petite liste si nécessaire ("J'ai créé le dossier X, ajouté 3 articles, mis le stock à 5"). Si quelque chose a échoué, dis-le clairement et propose la suite.

INFOS COMMERCIALES : tu n'invents JAMAIS un prix ni un stock. Si l'admin ne les donne pas, mets stock 0 / prix vide et demande-les.

LIEN D'UNE PAGE = import_from_page : dès que l'admin t'envoie une URL de page contenant plusieurs produits (« voilà le lien, prends tout ce qu'il y a dessus »), utilise import_from_page avec cette URL. L'outil ouvre la page, clique lui-même sur chaque fiche produit, lit chaque fiche et récupère toutes les infos, puis crée les articles dans le dossier indiqué (doublons signalés, jamais recréés). Si l'admin n'a pas donné dossier/prix/stock, appelle-le d'abord avec create=false pour lui montrer la liste trouvée, puis demande dossier + prix/stock en une seule question courte, puis relance avec create=true.

RECHERCHE — RÈGLE IMPORTANTE : l'API de recherche ne comprend que des mots-clés courts, jamais une phrase. Ne lui passe donc JAMAIS la demande de l'admin mot à mot. Quand l'admin décrit un rayon ou un site entier sans donner de lien (« va dans tous les réfrigérateurs combinés Samsung Afrique du Nord », « ajoute toute la gamme lave-linge LG »), utilise discover_references avec sa phrase complète : cet outil réfléchit, ouvre vraiment les pages officielles de listing et te renvoie les références des modèles. Ensuite montre-lui la liste trouvée, demande le dossier + prix/stock si besoin, puis crée tout avec bulk_create_products. Tu peux aussi explorer toi-même : web_search (mots-clés courts) pour trouver la bonne page, puis open_page (gratuit) pour la lire et suivre ses liens. research_product ne sert qu'à UNE référence précise déjà connue. Les références seules données par l'admin (Samsung RB34T672EWW, etc.) continuent de passer par research_product / bulk_create_products.

AUTO-RÉPARATION : si un outil échoue, ne t'arrête pas. Diagnostique la cause (URL invalide, dossier inexistant, référence introuvable, page bloquée), corrige les arguments ou change de méthode (autre URL, web_search puis open_page, création du dossier manquant), et réessaie. Après 3 essais infructueux sur la même chose, explique la cause en une phrase simple et propose une alternative. L'admin peut arrêter les tentatives à tout moment avec le bouton Stop : dans ce cas termine proprement sans rien relancer.

EN MASSE : si l'admin donne plusieurs références (même dans un long message), utilise bulk_create_products une seule fois avec toutes les références, plus la marque/le dossier/le prix/le stock communs qu'il a indiqués. Si le dossier ou le prix/stock commun manque et que l'admin veut publier tout de suite, demande-le en une seule question courte.

DESTRUCTIF : ne supprime un dossier ou un article qu'après une confirmation explicite de l'admin.`;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    /** Gemini 3 requires its thought signature to be echoed back verbatim. */
    extra_content?: { google?: { thought_signature: string } };
  }[];
  tool_call_id?: string;
};

type StreamToolCall = { id: string; name: string; args: string; signature?: string };

export async function runCindyAgent(input: {
  messages: { role: "user" | "assistant"; content: string }[];
  emit: Emit;
  /** Aborted when the admin presses "Stop" — ends retries and long crawls. */
  signal?: AbortSignal;
}) {

  const { aiSetup, aiFailure, aiFetchWithRetry } = await import("./ai-config.server");
  const ai = await aiSetup();

  let safetyPoint = false;
  /** One full backup per conversation turn, created lazily on the first change. */
  const ensureSafetyPoint = async () => {
    if (safetyPoint) return;
    safetyPoint = true;
    try {
      const { createSnapshot } = await import("./admin.server");
      await createSnapshot("Avant les changements de Cindy");
    } catch {
      /* a missing backup must not block the admin's request */
    }
  };

  const tools = buildTools(input.signal);

  const toolSchemas = tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.properties,
        required: tool.required,
      },
    },
  }));

  const history: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    ...input.messages.slice(-24).map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  for (let step = 0; step < 18; step += 1) {
    if (input.signal?.aborted) {
      input.emit({ type: "assistant", text: "Ok, j'arrête là." });
      input.emit({ type: "done" });
      return;
    }
    const res = await aiFetchWithRetry(
      ai.url,
      {
        method: "POST",
        headers: ai.headers,
        ...(input.signal ? { signal: input.signal } : {}),
        body: JSON.stringify({
          model: ai.model,
          stream: true,
          tools: toolSchemas,
          messages: history,
        }),
      },
      {
        ...(input.signal ? { signal: input.signal } : {}),
        onWait: ({ waitMs, attempt, status }) => {
          input.emit({
            type: "activity",
            id: `wait-${step}-${attempt}`,
            kind: "read",
            label:
              status === 429
                ? `Limite d'IA atteinte — je patiente ${Math.round(waitMs / 1000)}s puis je reprends`
                : `Service IA momentanément indisponible — nouvelle tentative dans ${Math.round(waitMs / 1000)}s`,
            status: "running",
          });
        },
      },
    );

    if (!res.ok || !res.body) throw await aiFailure(res);


    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    const pending = new Map<number, StreamToolCall>();

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
            choices?: {
              delta?: {
                content?: string | null;
                tool_calls?: {
                  index?: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                  extra_content?: { google?: { thought_signature?: string } };
                }[];
              };
            }[];
          };
          const delta = event.choices?.[0]?.delta;
          if (delta?.content) {
            text += delta.content;
            input.emit({ type: "delta", text: delta.content });
          }
          for (const call of delta?.tool_calls ?? []) {
            const index = call.index ?? 0;
            const current =
              pending.get(index) ?? { id: call.id ?? `call-${step}-${index}`, name: "", args: "" };
            if (call.id) current.id = call.id;
            if (call.function?.name) current.name = call.function.name;
            if (call.function?.arguments) current.args += call.function.arguments;
            // Gemini 3 sends a thought signature on the tool-call chunk; it MUST be
            // sent back untouched or the next request fails with a 400.
            const signature = call.extra_content?.google?.thought_signature;
            if (signature) current.signature = signature;
            pending.set(index, current);
          }
        } catch {
          /* ignore malformed chunk */
        }
      }
    }

    const calls = [...pending.values()].filter((call) => call.name);

    if (calls.length === 0) {
      if (text.trim()) input.emit({ type: "assistant", text: text.trim() });
      input.emit({ type: "done" });
      return;
    }

    history.push({
      role: "assistant",
      content: text || null,
      tool_calls: calls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.args || "{}" },
        ...(call.signature
          ? { extra_content: { google: { thought_signature: call.signature } } }
          : {}),
      })),
    });

    for (const call of calls) {
      const name = call.name;
      const tool = tools.find((t) => t.name === name);
      let args: Json = {};
      try {
        args = JSON.parse(call.args || "{}") as Json;
      } catch {
        args = {};
      }
      const activityId = `t-${call.id || name}`;
      input.emit({
        type: "activity",
        id: activityId,
        kind: "action",
        label: TOOL_LABELS[name] ?? name,
        detail: describeArgs(args),
        status: "running",
      });

      let result: unknown;
      let failed = false;
      /** Auto-repair: on failure Cindy retries the same call, backing off a
       *  little, until it works or the admin presses Stop. */
      const attempts = 3;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (input.signal?.aborted) {
          failed = true;
          result = { error: "Arrêté par l'admin." };
          break;
        }
        try {
          if (!tool) throw new Error(`Outil inconnu : ${name}`);
          // Before the first real change of the conversation, keep a full backup
          // so the admin can revert everything Cindy does in one click.
          if (MUTATING_TOOLS.has(name)) await ensureSafetyPoint();
          result = await tool.run(args, input.emit);
          failed = false;
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erreur inconnue";
          failed = true;
          result = {
            error: message,
            attempts: attempt,
            repair_hint:
              "Diagnostique la cause de cette erreur, corrige les arguments (chemin de dossier, URL, référence) ou change de méthode, puis réessaie. Si ça échoue toujours, explique la cause à l'admin en une phrase et propose une solution.",
          };
          const retryable = !tool || attempt >= attempts || input.signal?.aborted;
          if (retryable) break;
          input.emit({
            type: "activity",
            id: `${activityId}-fix-${attempt}`,
            kind: "action",
            label: "Erreur détectée — je répare et je réessaie",
            detail: message,
            status: "running",
          });
          await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
          input.emit({
            type: "activity",
            id: `${activityId}-fix-${attempt}`,
            kind: "action",
            label: `Nouvelle tentative ${attempt + 1}/${attempts}`,
            detail: message,
            status: "done",
          });
        }
      }

      if (!failed && MUTATING_TOOLS.has(name)) {
        input.emit({ type: "changed" });
        try {
          const { recordAction } = await import("./admin.server");
          await recordAction({
            action: `cindy_${name}`,
            entity: "site",
            label: `${TOOL_LABELS[name] ?? name} — Cindy${describeArgs(args) ? ` (${describeArgs(args)})` : ""}`,
            after_state: args as never,
          });
        } catch {
          /* history logging must never break the action itself */
        }
      }


      input.emit({
        type: "activity",
        id: activityId,
        kind: "action",
        label: TOOL_LABELS[name] ?? name,
        detail: failed
          ? String((result as { error?: string }).error ?? "Échec")
          : describeArgs(args) || "Terminé",
        status: failed ? "error" : "done",
      });

      history.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 12000),
      });

      if (input.signal?.aborted) {
        input.emit({ type: "assistant", text: "Ok, j'arrête là." });
        input.emit({ type: "done" });
        return;
      }
    }

  }

  input.emit({
    type: "assistant",
    text: "J'ai dû m'arrêter après beaucoup d'étapes. Dites-moi comment continuer.",
  });
  input.emit({ type: "done" });
}

const TOOL_LABELS: Record<string, string> = {
  get_site_overview: "Lecture du site",
  create_folder: "Création d'un dossier",
  rename_folder: "Modification d'un dossier",
  move_folder: "Déplacement d'un dossier",
  delete_folder: "Suppression d'un dossier",
  create_product: "Création d'un article",
  update_product: "Mise à jour d'un article",
  move_product: "Déplacement d'un article",
  delete_product: "Suppression d'un article",
  research_product: "Recherche produit",
  bulk_create_products: "Création en masse",
  update_theme: "Couleurs du site",
  set_site_mode: "Mode du site",
  manage_popular_search: "Recherches populaires",
  reorder_popular_search: "Ordre des recherches",
  reorder_folder: "Ordre des dossiers",
  set_product_featured: "Mise en avant",
  list_orders: "Lecture des commandes",
  update_order_status: "Statut d'une commande",
  list_history: "Lecture de l'historique",
  list_restore_points: "Points de restauration",
  create_restore_point: "Sauvegarde du site",
  restore_site: "Restauration du site",
  optimize_images: "Inspection des images",
  import_from_page: "Import depuis une page",
  discover_references: "Découverte de modèles",
  web_search: "Recherche web",
  open_page: "Ouverture d'une page",
};

/** Tools that change real data: they trigger a backup + a history entry. */
const MUTATING_TOOLS = new Set([
  "create_folder",
  "rename_folder",
  "move_folder",
  "reorder_folder",
  "delete_folder",
  "create_product",
  "update_product",
  "move_product",
  "delete_product",
  "set_product_featured",
  "bulk_create_products",
  "update_theme",
  "set_site_mode",
  "manage_popular_search",
  "reorder_popular_search",
  "update_order_status",
  "restore_site",
  "import_from_page",
]);


function describeArgs(args: Json) {
  const parts: string[] = [];
  for (const key of ["path", "folder_path", "folder", "product", "name", "reference", "term", "mode"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
  }
  if (Array.isArray(args["references"])) parts.push(`${args["references"].length} référence(s)`);
  return parts.slice(0, 3).join(" · ");
}
