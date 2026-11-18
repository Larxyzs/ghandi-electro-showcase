import { createFileRoute } from "@tanstack/react-router";

// One-time move of the site's own pictures (logo, showroom, brand logos) from Lovable's asset host
// into the public Supabase bucket, so they keep working without Lovable. Admins only.
const assets = import.meta.glob("/src/assets/**/*.asset.json", { eager: true, import: "default" }) as Record<
  string,
  { asset_id: string; original_filename: string; content_type: string }
>;

export const Route = createFileRoute("/api/public/copy-site-assets")({
  server: {
    handlers: {
      GET: async () => {
        const { currentAdmin } = await import("@/lib/admin.server");
        if (!(await currentAdmin())) return new Response("Log in to the admin first.", { status: 401 });
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const out: string[] = [];
        for (const a of Object.values(assets)) {
          try {
            const res = await fetch(`https://ghandihomeelectro.lovable.app/__l5e/assets-v1/${a.asset_id}/${a.original_filename}`);
            if (!res.ok) throw new Error(String(res.status));
            const bytes = new Uint8Array(await res.arrayBuffer());
            const { error } = await db.storage
              .from("product-images")
              .upload(`site-assets/${a.asset_id}/${a.original_filename}`, bytes, { contentType: a.content_type, upsert: true });
            if (error) throw new Error(error.message);
            out.push(`ok ${a.original_filename} ${bytes.length}`);
          } catch (e) {
            out.push(`FAILED ${a.original_filename}: ${e instanceof Error ? e.message : e}`);
          }
        }
        return new Response(out.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
      },
    },
  },
});
