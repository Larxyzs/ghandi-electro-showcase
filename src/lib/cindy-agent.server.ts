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

TU AGIS VRAIMENT : tu as des outils qui modifient le site en direct (dossiers du catalogue, articles, recherche produit, création en masse, couleurs du site, mode du site, recherches populaires). Quand l'admin demande un changement, fais-le avec les outils au lieu d'expliquer comment faire. Lis l'état du site avec get_site_overview quand tu as besoin de contexte.

APRÈS CHAQUE ACTION : explique simplement ce que tu as fait, en une à trois phrases + une petite liste si nécessaire ("J'ai créé le dossier X, ajouté 3 articles, mis le stock à 5"). Si quelque chose a échoué, dis-le clairement et propose la suite.

INFOS COMMERCIALES : tu n'invents JAMAIS un prix ni un stock. Si l'admin ne les donne pas, mets stock 0 / prix vide et demande-les.

EN MASSE : si l'admin donne plusieurs références (même dans un long message), utilise bulk_create_products une seule fois avec toutes les références, plus la marque/le dossier/le prix/le stock communs qu'il a indiqués. Si le dossier ou le prix/stock commun manque et que l'admin veut publier tout de suite, demande-le en une seule question courte.

DESTRUCTIF : ne supprime un dossier ou un article qu'après une confirmation explicite de l'admin.`;

type OutputItem = Json & { type?: string };

export async function runCindyAgent(input: {
  messages: { role: "user" | "assistant"; content: string }[];
  emit: Emit;
}) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI_NOT_CONFIGURED");

  const tools = buildTools();
  const toolSchemas = tools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    strict: true,
    parameters: {
      type: "object",
      properties: tool.properties,
      required: tool.required,
      additionalProperties: false,
    },
  }));

  const history: OutputItem[] = input.messages.slice(-24).map((message) => ({
    type: "message",
    role: message.role,
    content: [
      {
        type: message.role === "assistant" ? "output_text" : "input_text",
        text: message.content,
      },
    ],
  }));

  for (let step = 0; step < 12; step += 1) {
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
        instructions: SYSTEM,
        tools: toolSchemas,
        input: history,
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI_RATE_LIMITED");
      if (res.status === 402) throw new Error("AI_CREDITS");
      throw new Error(`AI_FAILED: ${res.status} ${text.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let output: OutputItem[] = [];
    let text = "";

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
            response?: { output?: OutputItem[] };
          };
          if (event.type === "response.output_text.delta" && event.delta) {
            text += event.delta;
            input.emit({ type: "delta", text: event.delta });
          } else if (event.type === "response.completed" && event.response?.output) {
            output = event.response.output;
          }
        } catch {
          /* ignore malformed chunk */
        }
      }
    }

    const calls = output.filter((item) => item["type"] === "function_call");
    history.push(...output);

    if (calls.length === 0) {
      if (text.trim()) input.emit({ type: "assistant", text: text.trim() });
      input.emit({ type: "done" });
      return;
    }

    for (const call of calls) {
      const name = String(call["name"] ?? "");
      const callId = String(call["call_id"] ?? "");
      const tool = tools.find((t) => t.name === name);
      let args: Json = {};
      try {
        args = JSON.parse(String(call["arguments"] ?? "{}")) as Json;
      } catch {
        args = {};
      }
      const activityId = `t-${callId || name}`;
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
        result = await tool.run(args, input.emit);
      } catch (error) {
        failed = true;
        result = { error: error instanceof Error ? error.message : "Erreur inconnue" };
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
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result).slice(0, 12000),
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
};

function describeArgs(args: Json) {
  const parts: string[] = [];
  for (const key of ["path", "folder_path", "folder", "product", "name", "reference", "term", "mode"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) parts.push(value.trim());
  }
  if (Array.isArray(args["references"])) parts.push(`${args["references"].length} référence(s)`);
  return parts.slice(0, 3).join(" · ");
}
