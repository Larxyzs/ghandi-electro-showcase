/**
 * Cindy — real image editing.
 *
 * She can look at every catalog image (products and folders), judge it with a
 * vision model, and actually re-render a better version (whole appliance
 * visible, centered, clean white background, square framing) with an image
 * model. The result is uploaded to storage and written back on the row, so the
 * live site changes immediately.
 */
import { aiFetchWithRetry, aiFailure, aiSetup } from "./ai-config.server";

const IMAGE_MODEL_GEMINI = "gemini-3.1-flash-image";
const IMAGE_MODEL_GATEWAY = "google/gemini-3.1-flash-image";

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

export type ImageFixResult = {
  label: string;
  kind: "product" | "node";
  status: "improved" | "already_good" | "skipped" | "failed";
  detail: string;
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

function defaultInstruction(label: string, issues: string[]) {
  return [
    `Photo produit e-commerce de cet appareil (« ${label} »).`,
    "Recadre et remets à l'échelle pour que l'APPAREIL ENTIER soit visible du haut en bas, rien de coupé,",
    "centré, occupant environ 85% du cadre, cadrage carré 1:1, fond blanc pur uniforme,",
    "lumière studio douce, ombre au sol discrète, image nette et droite.",
    "Garde EXACTEMENT le même produit : même modèle, mêmes couleurs, mêmes matériaux, mêmes poignées,",
    "même écran/afficheur, mêmes proportions. N'invente aucun détail, n'ajoute aucun texte, logo, filigrane ni décor.",
    issues.length ? `Défauts à corriger : ${issues.join(" ; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Re-renders one image; returns a data URL ready for storage. */
export async function reframeImage(
  path: string,
  label: string,
  issues: string[],
  instruction?: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const image = await loadImage(path);
  if (!image) return null;
  const setup = await aiSetup();
  const prompt = instruction?.trim()
    ? `${instruction.trim()} Garde exactement le même produit (modèle, couleurs, matériaux) et n'ajoute aucun texte ni logo.`
    : defaultInstruction(label, issues);

  const url =
    setup.provider === "gemini"
      ? `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL_GEMINI}:generateContent`
      : "https://ai.gateway.lovable.dev/v1/images/generations";

  const body =
    setup.provider === "gemini"
      ? {
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { inlineData: { mimeType: image.mime, data: image.base64 } },
              ],
            },
          ],
        }
      : {
          model: IMAGE_MODEL_GATEWAY,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { url: `data:${image.mime};base64,${image.base64}` },
                },
              ],
            },
          ],
          modalities: ["image", "text"],
        };

  const res = await aiFetchWithRetry(
    url,
    { method: "POST", headers: setup.headers, body: JSON.stringify(body) },
    { signal },
  );
  if (!res.ok) throw await aiFailure(res);
  const json = (await res.json()) as Record<string, unknown>;
  return extractImageDataUrl(json);
}

function extractImageDataUrl(json: Record<string, unknown>): string | null {
  // Gemini generateContent shape
  const candidates = (json as { candidates?: unknown[] }).candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const parts = (candidate as { content?: { parts?: unknown[] } }).content?.parts ?? [];
      for (const part of parts) {
        const inline = (part as { inlineData?: { mimeType?: string; data?: string } }).inlineData;
        if (inline?.data) return `data:${inline.mimeType ?? "image/png"};base64,${inline.data}`;
      }
    }
  }
  // Gateway chat/images shapes
  const choices = (json as { choices?: unknown[] }).choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const message = (choice as { message?: Record<string, unknown> }).message ?? {};
      const images = (message as { images?: unknown[] }).images;
      if (Array.isArray(images)) {
        for (const item of images) {
          const value =
            (item as { image_url?: { url?: string } }).image_url?.url ??
            (item as { url?: string }).url;
          if (typeof value === "string" && value.startsWith("data:image")) return value;
        }
      }
    }
  }
  const data = (json as { data?: { b64_json?: string; url?: string }[] }).data;
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item.url?.startsWith("data:image")) return item.url;
    }
  }
  return null;
}

/* --------------------------------- driver ------------------------------- */

/**
 * Inspects then rewrites the images of a set of targets. `force` skips the
 * inspection step and re-renders everything.
 */
export async function fixImages(
  targets: ImageTarget[],
  options: {
    force?: boolean;
    instruction?: string;
    signal?: AbortSignal;
    onProgress?: (message: string) => void;
  } = {},
): Promise<ImageFixResult[]> {
  const { replaceImage } = await import("./admin.server");
  const results: ImageFixResult[] = [];

  for (const target of targets) {
    if (options.signal?.aborted) break;
    if (!target.imagePath) {
      results.push({
        kind: target.kind,
        label: target.label,
        status: "skipped",
        detail: "Pas d'image.",
      });
      continue;
    }
    try {
      let issues: string[] = [];
      if (!options.force) {
        options.onProgress?.(`J'examine l'image de « ${target.label} »`);
        const verdict = await inspectImage(target.imagePath);
        if (verdict?.ok) {
          results.push({
            kind: target.kind,
            label: target.label,
            status: "already_good",
            detail: "Cadrage et qualité déjà corrects.",
          });
          continue;
        }
        issues = verdict?.issues ?? [];
      }
      options.onProgress?.(
        `Je refais l'image de « ${target.label} »${issues.length ? ` (${issues.join(", ")})` : ""}`,
      );
      const dataUrl = await reframeImage(
        target.imagePath,
        target.label,
        issues,
        options.instruction,
        options.signal,
      );
      if (!dataUrl) {
        results.push({
          kind: target.kind,
          label: target.label,
          status: "failed",
          detail: "Le modèle n'a pas renvoyé d'image.",
        });
        continue;
      }
      await replaceImage({
        kind: target.kind,
        id: target.id,
        imageData: dataUrl,
        imageName: `${target.label.slice(0, 40) || "image"}.png`,
      });
      results.push({
        kind: target.kind,
        label: target.label,
        status: "improved",
        detail: issues.length ? `Corrigé : ${issues.join(", ")}` : "Recadré et remis à l'échelle.",
      });
    } catch (error) {
      results.push({
        kind: target.kind,
        label: target.label,
        status: "failed",
        detail: error instanceof Error ? error.message : "Erreur inconnue",
      });
    }
  }
  return results;
}
