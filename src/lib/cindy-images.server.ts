/**
 * Cindy — read-only image audit.
 *
 * She can look at every catalog image (products and folders) with a vision
 * model and report what is wrong with it, so the admin can replace it with
 * another ORIGINAL manufacturer picture. Cindy never regenerates or reframes an
 * appliance photo with an image model.
 */
import { aiFetchWithRetry, aiFailure, aiSetup } from "./ai-config.server";

export type ImageTarget = {
  kind: "product" | "node";
  id: string;
  label: string;
  imagePath: string | null;
};

export type ImageVerdict = {
  ok: boolean;
  issues: string[];
  advice: string;
};


/* ------------------------------ collection ------------------------------ */

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** All descendant folder ids of a node (inclusive). */
export async function subtreeNodeIds(rootId: string): Promise<string[]> {
  const client = await db();
  const { data } = await client.from("catalog_nodes").select("id, parent_id");
  const rows = data ?? [];
  const ids = [rootId];
  for (let i = 0; i < ids.length; i += 1) {
    for (const row of rows) {
      if (row.parent_id === ids[i] && !ids.includes(row.id)) ids.push(row.id);
    }
  }
  return ids;
}

/**
 * Every image inside a folder subtree (or the whole site when rootId is null).
 */
export async function collectImageTargets(
  rootId: string | null,
  options: { includeFolders?: boolean; includeProducts?: boolean } = {},
): Promise<ImageTarget[]> {
  const client = await db();
  const includeFolders = options.includeFolders ?? false;
  const includeProducts = options.includeProducts ?? true;
  const ids = rootId ? await subtreeNodeIds(rootId) : null;
  const targets: ImageTarget[] = [];

  if (includeProducts) {
    let query = client.from("products").select("id, name, image_url, node_id").order("name");
    if (ids) query = query.in("node_id", ids);
    const { data } = await query;
    for (const row of data ?? []) {
      targets.push({ kind: "product", id: row.id, label: row.name, imagePath: row.image_url });
    }
  }
  if (includeFolders) {
    let query = client.from("catalog_nodes").select("id, name, image_url").order("name");
    if (ids) query = query.in("id", ids);
    const { data } = await query;
    for (const row of data ?? []) {
      targets.push({ kind: "node", id: row.id, label: row.name, imagePath: row.image_url });
    }
  }
  return targets;
}

/* -------------------------------- loading ------------------------------- */

async function publicOrSignedUrl(path: string): Promise<string | null> {
  if (/^https?:\/\//i.test(path)) return path;
  const client = await db();
  const { data } = await client.storage.from("product-images").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

async function loadImage(path: string): Promise<{ base64: string; mime: string } | null> {
  const url = await publicOrSignedUrl(path);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  if (!mime.startsWith("image/")) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.byteLength) return null;
  return { base64: buffer.toString("base64"), mime };
}

/* ------------------------------- inspection ----------------------------- */

const INSPECT_PROMPT = `Tu es contrôleur qualité des photos produit d'un site d'électroménager.
Regarde la photo et réponds UNIQUEMENT en JSON :
{"ok":true|false,"issues":["..."],"advice":"..."}
ok=false si l'appareil est coupé/rogné, mal centré, trop petit dans le cadre, de travers, sur un fond sale ou distrayant, sombre, flou, ou si la photo contient du texte/watermark/logo de site.
issues = défauts courts en français. advice = ce qu'il faut corriger en une phrase.`;

export async function inspectImage(path: string): Promise<ImageVerdict | null> {
  const image = await loadImage(path);
  if (!image) return null;
  const setup = await aiSetup();
  const res = await aiFetchWithRetry(setup.url, {
    method: "POST",
    headers: setup.headers,
    body: JSON.stringify({
      model: setup.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: INSPECT_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${image.mime};base64,${image.base64}` },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw await aiFailure(res);
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const match = /\{[\s\S]*\}/.exec(raw);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as ImageVerdict;
    return {
      ok: Boolean(parsed.ok),
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 5).map(String) : [],
      advice: String(parsed.advice ?? ""),
    };
  } catch {
    return null;
  }
}

/* ------------------------------- re-rendering --------------------------- */

/*
 * NOTE: AI image regeneration/reframing has been intentionally removed.
 * Catalog pictures must always stay the ORIGINAL manufacturer images taken from
 * the official product slideshow. Badly framed pictures are handled by the
 * front-end (object-contain, full product always visible), never by redrawing
 * an appliance with a generative model.
 */

