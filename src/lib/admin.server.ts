import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { fetchSiteData, type SiteData } from "./catalog.server";

type AdminSession = { unlocked?: boolean };

function sessionConfig() {
  return {
    password: process.env["ADMIN_SESSION_SECRET"]!,
    name: "ghe-admin",
    maxAge: 60 * 60 * 24 * 60,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function isUnlocked(): Promise<boolean> {
  const session = await useSession<AdminSession>(sessionConfig());
  return Boolean(session.data.unlocked);
}

export async function unlock(password: string): Promise<boolean> {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) throw new Error("ADMIN_PASSWORD is not configured");
  if (!matches(password, expected)) return false;
  const session = await useSession<AdminSession>(sessionConfig());
  await session.update({ unlocked: true });
  return true;
}

export async function lock(): Promise<void> {
  const session = await useSession<AdminSession>(sessionConfig());
  await session.clear();
}

async function requireAdmin() {
  if (!(await isUnlocked())) throw new Error("UNAUTHORIZED");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "categorie"}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function adminData(): Promise<SiteData> {
  if (!(await isUnlocked())) throw new Error("UNAUTHORIZED");
  return fetchSiteData();
}

export async function createCategory(name: string) {
  const db = await requireAdmin();
  const { data, error } = await db
    .from("categories")
    .insert({ name: name.trim(), slug: slugify(name) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function renameCategory(id: string, name: string) {
  const db = await requireAdmin();
  const { error } = await db.from("categories").update({ name: name.trim() }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function deleteCategory(id: string) {
  const db = await requireAdmin();
  const { data: products } = await db.from("products").select("image_url").eq("category_id", id);
  const paths = (products ?? []).map((p) => p.image_url).filter((p): p is string => Boolean(p));
  if (paths.length) await db.storage.from("product-images").remove(paths);
  const { error } = await db.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export type ProductInput = {
  id?: string;
  category_id: string;
  name: string;
  serial_number: string;
  stock: number;
  price: number | null;
  description: string;
  imageData?: string | null;
  imageName?: string | null;
  removeImage?: boolean;
};

async function storeImage(
  db: Awaited<ReturnType<typeof requireAdmin>>,
  imageData: string,
  imageName: string,
) {
  const commaIdx = imageData.indexOf(",");
  const meta = imageData.slice(0, commaIdx);
  const base64 = imageData.slice(commaIdx + 1);
  const contentType = /data:([^;]+);/.exec(meta)?.[1] ?? "image/jpeg";
  const bytes = Buffer.from(base64, "base64");
  if (bytes.byteLength > 6 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
  const ext = (imageName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${crypto.randomUUID()}.${ext || "jpg"}`;
  const { error } = await db.storage
    .from("product-images")
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function saveProduct(input: ProductInput) {
  const db = await requireAdmin();

  let imagePath: string | null | undefined = undefined;
  if (input.imageData && input.imageName) {
    imagePath = await storeImage(db, input.imageData, input.imageName);
  } else if (input.removeImage) {
    imagePath = null;
  }

  const base = {
    category_id: input.category_id,
    name: input.name.trim(),
    serial_number: input.serial_number.trim(),
    stock: Math.max(0, Math.floor(input.stock)),
    price: input.price,
    description: input.description,
  };

  if (input.id) {
    const { data: existing } = await db
      .from("products")
      .select("image_url")
      .eq("id", input.id)
      .maybeSingle();
    const payload =
      imagePath === undefined ? base : { ...base, image_url: imagePath };
    const { error } = await db.from("products").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
    if (imagePath !== undefined && existing?.image_url) {
      await db.storage.from("product-images").remove([existing.image_url]);
    }
    return { id: input.id };
  }

  const { data, error } = await db
    .from("products")
    .insert({ ...base, image_url: imagePath ?? null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function deleteProduct(id: string) {
  const db = await requireAdmin();
  const { data: existing } = await db.from("products").select("image_url").eq("id", id).maybeSingle();
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (existing?.image_url) await db.storage.from("product-images").remove([existing.image_url]);
  return { ok: true as const };
}

export async function saveSettings(input: {
  primary_color: string;
  secondary_color: string;
  text_color: string;
}) {
  const db = await requireAdmin();
  const hex = /^#[0-9a-fA-F]{6}$/;
  for (const value of Object.values(input)) {
    if (!hex.test(value)) throw new Error("INVALID_COLOR");
  }
  const { error } = await db
    .from("site_settings")
    .update({ ...input })
    .eq("id", "default");
  if (error) throw new Error(error.message);
  return { ok: true as const };
}