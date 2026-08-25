import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/probe-pbkdf2")({
  server: {
    handlers: {
      GET: async () => {
        const out: Record<string, unknown> = {};
        try {
          const { hashPassword } = await import("@/lib/admin.server");
          const hash = await hashPassword("probe-secret");
          out["hash_ok"] = hash.slice(0, 20);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("admin_users")
            .insert({ username: "probe.fn", password_hash: hash, role: "staff" });
          out["insert_error"] = error ? { code: error.code, message: error.message } : null;
          await supabaseAdmin.from("admin_users").delete().eq("username", "probe.fn");
        } catch (error) {
          out["threw"] = error instanceof Error ? error.message : String(error);
        }
        return Response.json(out);
      },
    },
  },
});
