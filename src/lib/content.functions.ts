import { createServerFn } from "@tanstack/react-start";

export type FaqItem = { id: string; category: string; question: string; answer: string; sort_order: number };
export type Guide = {
  id: string;
  title: string;
  slug: string;
  cover_url: string;
  node_id: string | null;
  summary: string;
  body: string;
  published_at: string;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function signCover(rows: Guide[]): Promise<Guide[]> {
  const { signImagePaths } = await import("./catalog.server");
  const paths = rows.map((r) => r.cover_url).filter((v) => v && !v.startsWith("http"));
  const map = await signImagePaths(paths);
  return rows.map((r) => ({ ...r, cover_url: r.cover_url.startsWith("http") ? r.cover_url : (map[r.cover_url] ?? "") }));
}

export const getFaq = createServerFn({ method: "GET" }).handler(async (): Promise<FaqItem[]> => {
  const { data } = await (await db())
    .from("faq_items")
    .select("id, category, question, answer, sort_order")
    .eq("published", true)
    .order("sort_order");
  return data ?? [];
});

export const getGuides = createServerFn({ method: "GET" }).handler(async (): Promise<Guide[]> => {
  const { data } = await (await db())
    .from("guides")
    .select("id, title, slug, cover_url, node_id, summary, body, published_at")
    .eq("published", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });
  return signCover(data ?? []);
});

export const getGuide = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug ?? "").slice(0, 200) }))
  .handler(async ({ data }): Promise<Guide | null> => {
    const { data: row } = await (await db())
      .from("guides")
      .select("id, title, slug, cover_url, node_id, summary, body, published_at")
      .eq("published", true)
      .eq("slug", data.slug)
      .maybeSingle();
    return row ? (await signCover([row]))[0]! : null;
  });

export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; phone: string; email?: string; subject: string; message: string; website?: string }) => ({
    name: String(d.name ?? "").trim().slice(0, 120),
    phone: String(d.phone ?? "").trim().slice(0, 32),
    email: String(d.email ?? "").trim().slice(0, 200),
    subject: ["Question sur un produit", "Suivi de commande", "Livraison", "Autre"].includes(d.subject) ? d.subject : "Autre",
    message: String(d.message ?? "").trim().slice(0, 3000),
    website: String(d.website ?? ""),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    if (data.website) return { ok: true }; // honeypot: silently ignore bots
    if (data.name.length < 2) return { ok: false, error: "Indiquez votre nom." };
    if (data.phone.replace(/\D/g, "").length < 9) return { ok: false, error: "Indiquez un numéro de téléphone valide." };
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { ok: false, error: "Adresse email invalide." };
    if (data.message.length < 5) return { ok: false, error: "Écrivez votre message." };
    const { allowAction } = await import("./rate-limit.server");
    if (!(await allowAction("contact", 5, 60))) return { ok: false, error: "Trop de messages envoyés. Réessayez dans une heure." };
    const { error } = await (await db()).from("contact_messages").insert({
      name: data.name, phone: data.phone, email: data.email, subject: data.subject, message: data.message,
    });
    return error ? { ok: false, error: "Le message n'a pas pu être envoyé." } : { ok: true };
  });
