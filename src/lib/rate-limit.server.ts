import { getRequestHeader } from "@tanstack/react-start/server";

/** Visitor fingerprint (IP) hashed — never stored in clear. */
async function visitorKey() {
  const ip =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(buf).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns false when this visitor already did `max` actions named `name`
 * within `windowMinutes`; otherwise records one and returns true.
 */
export async function allowAction(name: string, max: number, windowMinutes = 60) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bucket = `${name}:${await visitorKey()}`;
  const since = new Date(Date.now() - windowMinutes * 60000).toISOString();
  const { count } = await supabaseAdmin
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .gte("created_at", since);
  if ((count ?? 0) >= max) return false;
  await supabaseAdmin.from("rate_limits").insert({ bucket });
  return true;
}
