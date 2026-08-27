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

function buildTools(): ToolDef[] {
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
  ];
}


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

EN MASSE : si l'admin donne plusieurs références (même dans un long message), utilise bulk_create_products une seule fois avec toutes les références, plus la marque/le dossier/le prix/le stock communs qu'il a indiqués. Si le dossier ou le prix/stock commun manque et que l'admin veut publier tout de suite, demande-le en une seule question courte.

DESTRUCTIF : ne supprime un dossier ou un article qu'après une confirmation explicite de l'admin.`;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

type StreamToolCall = { id: string; name: string; args: string };

export async function runCindyAgent(input: {
  messages: { role: "user" | "assistant"; content: string }[];
  emit: Emit;
}) {
  const { aiSetup, aiFailure } = await import("./ai-config.server");
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

  const tools = buildTools();

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

  for (let step = 0; step < 12; step += 1) {
    const res = await fetch(ai.url, {
      method: "POST",
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        stream: true,
        tools: toolSchemas,
        messages: history,
      }),
    });

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
      try {
        if (!tool) throw new Error(`Outil inconnu : ${name}`);
        // Before the first real change of the conversation, keep a full backup
        // so the admin can revert everything Cindy does in one click.
        if (MUTATING_TOOLS.has(name)) await ensureSafetyPoint();
        result = await tool.run(args, input.emit);
      } catch (error) {
        failed = true;
        result = { error: error instanceof Error ? error.message : "Erreur inconnue" };
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
