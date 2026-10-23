import { createServerFn } from "@tanstack/react-start";

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; source?: string }) => ({
    email: String(d.email ?? "").trim().toLowerCase().slice(0, 200),
    source: String(d.source ?? "").slice(0, 200),
  }))
  .handler(async ({ data }): Promise<"ok" | "exists" | "invalid" | "limit"> => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return "invalid";
    const { allowAction } = await import("./rate-limit.server");
    if (!(await allowAction("newsletter", 10, 60))) return "limit";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("newsletter_subscribers").insert({ email: data.email, source: data.source });
    if (error) return error.code === "23505" ? "exists" : "invalid";
    return "ok";
  });
