import { createServerFn } from "@tanstack/react-start";

/** Looks up an old category address and returns the node's current path (or null). */
export const lookupCatalogRedirect = createServerFn({ method: "GET" })
  .inputValidator((d: { path: string }) => ({ path: String(d.path ?? "").replace(/^\/+|\/+$/g, "").slice(0, 400) }))
  .handler(async ({ data }) => {
    if (!data.path) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("catalog_redirects").select("node_id").eq("old_path", data.path).maybeSingle();
    if (!row) return null;
    const { data: nodes } = await supabaseAdmin.from("catalog_nodes").select("id, parent_id, slug");
    const byId = new Map((nodes ?? []).map((n) => [n.id, n]));
    const parts: string[] = [];
    let cur = byId.get(row.node_id);
    while (cur) {
      parts.unshift(cur.slug);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    const path = parts.join("/");
    return path && path !== data.path ? path : null;
  });
