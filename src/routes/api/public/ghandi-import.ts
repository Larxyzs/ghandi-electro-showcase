import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-ghandi-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (error: string, status: number) => json({ ok: false, error }, status);

async function sha256(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Chrome extension inbox. Never creates shop products — only stores them for review. */
export const Route = createFileRoute("/api/public/ghandi-import")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const key = request.headers.get("x-ghandi-key")?.trim() ?? "";
          if (!key) return fail("bad key", 401);
          const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
          const hash = await sha256(key);
          const { data: k } = await db.from("extension_keys").select("id").eq("key_hash", hash).eq("revoked", false).maybeSingle();
          if (!k) return fail("bad key", 401);
          await db.from("extension_keys").update({ last_used_at: new Date().toISOString() }).eq("id", k.id);

          const text = await request.text();
          if (text.length > 5 * 1024 * 1024) return fail("Request too large (max 5 MB).", 413);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let body: any;
          try { body = JSON.parse(text); } catch { return fail("The request is not valid JSON.", 400); }

          if (body?.action === "ping") {
            const { data: nodes } = await db.from("catalog_nodes").select("id, parent_id, name");
            const list = nodes ?? [];
            const byId = new Map(list.map((n) => [n.id, n]));
            const path = (id: string) => {
              const names: string[] = [];
              let cur = byId.get(id);
              while (cur && names.length < 10) { names.unshift(cur.name); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
              return names.join(" > ");
            };
            const sections = list.map((n) => ({ id: n.id, name: n.name, path: path(n.id) })).sort((a, b) => a.path.localeCompare(b.path));
            return json({ ok: true, site: "Ghandi Home Electro", sections });
          }

          if (body?.action === "push") {
            const batchId = typeof body.batchId === "string" ? body.batchId.trim().slice(0, 100) : "";
            if (!batchId) return fail("batchId is missing.", 400);
            const products = Array.isArray(body.products) ? body.products : null;
            if (!products) return fail("products must be a list.", 400);
            if (products.length > 50) return fail("Too many products (max 50 per request).", 413);
            const str = (v: unknown) => (typeof v === "string" ? v : "");
            const uuid = /^[0-9a-f-]{36}$/i;
            const sid = uuid.test(str(body.suggestedSectionId)) ? str(body.suggestedSectionId) : null;

            const { data: existing } = await db.from("extension_batches").select("id, status").eq("id", batchId).maybeSingle();
            if (existing && (existing.status === "done" || existing.status === "cancelled"))
              return fail("This batch is already closed. Send it again with a new batchId.", 409);
            const meta = {
              label: str(body.label), note: str(body.note), source: str(body.source),
              total_expected: Number.isFinite(body.total) ? Math.max(0, Math.floor(body.total)) : 0,
              suggested_category_id: sid, suggested_section_text: str(body.suggestedSectionPath),
            };
            const up = existing
              ? await db.from("extension_batches").update(meta).eq("id", batchId)
              : await db.from("extension_batches").insert({ id: batchId, status: "receiving", ...meta });
            if (up.error) return fail("Could not save the batch.", 500);

            const rows = products.map((p: unknown, i: number) => {
              const o = (p ?? {}) as Record<string, unknown>;
              return { batch_id: batchId, source_url: str(o.sourceUrl) || `no-url-${Date.now()}-${i}`, payload: o as never, suggested_category_id: sid };
            });
            if (rows.length) {
              const ins = await db.from("extension_inbox_items").upsert(rows, { onConflict: "batch_id,source_url" });
              if (ins.error) return fail("Could not save the products.", 500);
            }
            if (body.final === true) {
              const { count } = await db.from("extension_inbox_items").select("id", { count: "exact", head: true }).eq("batch_id", batchId);
              await db.from("extension_batches").update({ status: "ready", product_count: count ?? 0 }).eq("id", batchId);
            }
            return json({ ok: true, batchId, received: rows.length });
          }
          return fail("Unknown action (use ping or push).", 400);
        } catch {
          return fail("Server error, please try again.", 500);
        }
      },
    },
  },
});
