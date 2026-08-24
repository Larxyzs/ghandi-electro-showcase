import type { Json } from "@/integrations/supabase/types";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { fetchSiteData, type SiteData } from "./catalog.server";

export const SUPER_ADMIN_USERNAME = "khaled.douiou";

export type AdminRole = "super" | "staff";
type AdminSession = { unlocked?: boolean; username?: string; role?: AdminRole };

function sessionConfig() {
  return {
    password: process.env["ADMIN_SESSION_SECRET"]!,
    name: "ghe-admin",
    maxAge: 60 * 60 * 24 * 60,
    cookie: {
      httpOnly: true,
      // The preview runs inside an iframe (third-party context), so the cookie
      // must be SameSite=None + Secure to be sent back with server-fn requests.
      secure: true,
      sameSite: "none" as const,
      path: "/",
    },
  };
}

function equals(a: string, b: string) {
  const x = createHash("sha256").update(a, "utf8").digest();
  const y = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(x, y);
}

const PBKDF2_ITERATIONS = 120_000;

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function derive(password: string, saltHex: string, iterations: number) {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g) ?? [], (h) => parseInt(h, 16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string) {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const saltHex = [...saltBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hash = await derive(password, saltHex, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hash}`;
}

async function verifyPassword(password: string, stored: string) {
  const [scheme, iterations, saltHex, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterations || !saltHex || !hash) return false;
  const candidate = await derive(password, saltHex, Number(iterations));
  return equals(candidate, hash);
}

export type AdminIdentity = { username: string; role: AdminRole };

export async function currentAdmin(): Promise<AdminIdentity | null> {
  const session = await useSession<AdminSession>(sessionConfig());
  if (!session.data.unlocked || !session.data.username) return null;
  return {
    username: session.data.username,
    role: session.data.role === "super" ? "super" : "staff",
  };
}

export async function login(
  username: string,
  password: string,
): Promise<AdminIdentity | null> {
  const name = username.trim().toLowerCase();

  if (name === SUPER_ADMIN_USERNAME) {
    const expected = process.env["ADMIN_PASSWORD"];
    if (!expected) throw new Error("ADMIN_PASSWORD is not configured");
    if (!equals(password, expected)) return null;
    const session = await useSession<AdminSession>(sessionConfig());
    await session.update({ unlocked: true, username: name, role: "super" });
    return { username: name, role: "super" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("username, password_hash, role")
    .eq("username", name)
    .maybeSingle();
  if (!data) return null;
  if (!(await verifyPassword(password, data.password_hash))) return null;

  const role: AdminRole = data.role === "super" ? "super" : "staff";
  const session = await useSession<AdminSession>(sessionConfig());
  await session.update({ unlocked: true, username: data.username, role });
  return { username: data.username, role };
}

export async function lock(): Promise<void> {
  const session = await useSession<AdminSession>(sessionConfig());
  await session.clear();
}

async function requireAdmin() {
  if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireSuperAdmin() {
  const me = await currentAdmin();
  if (!me || me.role !== "super") throw new Error("FORBIDDEN");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function slugBase(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "dossier"
  );
}

async function uniqueSlug(
  db: Awaited<ReturnType<typeof requireAdmin>>,
  parentId: string | null,
  name: string,
  excludeId?: string,
) {
  const base = slugBase(name);
  let query = db.from("catalog_nodes").select("slug, id");
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  const { data } = await query;
  const taken = new Set(
    (data ?? []).filter((row) => row.id !== excludeId).map((row) => row.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; i < 500; i += 1) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export type StaffAccount = { id: string; username: string; role: AdminRole; created_at: string };

export async function listStaff(): Promise<StaffAccount[]> {
  const db = await requireSuperAdmin();
  const { data, error } = await db
    .from("admin_users")
    .select("id, username, role, created_at")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    role: row.role === "super" ? "super" : "staff",
    created_at: row.created_at,
  }));
}

export async function createStaff(username: string, password: string) {
  const db = await requireSuperAdmin();
  const name = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(name)) throw new Error("INVALID_USERNAME");
  if (name === SUPER_ADMIN_USERNAME) throw new Error("USERNAME_TAKEN");
  if (password.length < 6) throw new Error("WEAK_PASSWORD");
  const password_hash = await hashPassword(password);
  const { error } = await db
    .from("admin_users")
    .insert({ username: name, password_hash, role: "staff" });
  if (error) throw new Error(error.code === "23505" ? "USERNAME_TAKEN" : error.message);
  return { ok: true as const };
}

export async function updateStaffPassword(id: string, password: string) {
  const db = await requireSuperAdmin();
  if (password.length < 6) throw new Error("WEAK_PASSWORD");
  const password_hash = await hashPassword(password);
  const { error } = await db.from("admin_users").update({ password_hash }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function deleteStaff(id: string) {
  const db = await requireSuperAdmin();
  const { error } = await db.from("admin_users").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function adminData(): Promise<SiteData> {
  if (!(await currentAdmin())) throw new Error("UNAUTHORIZED");
  return fetchSiteData();
}

export type ImageInput = {
  imageData?: string | null;
  imageName?: string | null;
  imageUrl?: string | null;
  removeImage?: boolean;
};

/** Returns the value to store: a path, an https url, null (clear) or undefined (keep). */
async function resolveImage(
  db: Awaited<ReturnType<typeof requireAdmin>>,
  input: ImageInput,
): Promise<string | null | undefined> {
  if (input.imageData && input.imageName) return storeImage(db, input.imageData, input.imageName);
  if (input.imageUrl) {
    const url = input.imageUrl.trim();
    if (!/^https:\/\/[^\s]+$/i.test(url)) throw new Error("INVALID_IMAGE_URL");
    return url;
  }
  if (input.removeImage) return null;
  return undefined;
}

export async function createNode(parentId: string | null, name: string, image?: ImageInput) {
  const db = await requireAdmin();
  let level = 1;
  if (parentId) {
    const { data: parent } = await db
      .from("catalog_nodes")
      .select("id, level")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent) throw new Error("PARENT_NOT_FOUND");
    if (parent.level >= 4) throw new Error("MAX_DEPTH");
    level = parent.level + 1;
  }

  let siblings = db.from("catalog_nodes").select("sort_order");
  siblings = parentId ? siblings.eq("parent_id", parentId) : siblings.is("parent_id", null);
  const { data: existing } = await siblings;
  const sort_order = (existing ?? []).reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;

  const slug = await uniqueSlug(db, parentId, name);
  const imagePath = image ? await resolveImage(db, image) : undefined;
  const { data, error } = await db
    .from("catalog_nodes")
    .insert({
      parent_id: parentId,
      name: name.trim(),
      slug,
      level,
      sort_order,
      image_url: imagePath ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function renameNode(id: string, name: string, image?: ImageInput) {
  const db = await requireAdmin();
  const { data: node } = await db
    .from("catalog_nodes")
    .select("id, parent_id, image_url")
    .eq("id", id)
    .maybeSingle();
  if (!node) throw new Error("NOT_FOUND");
  const slug = await uniqueSlug(db, node.parent_id, name, id);
  const imagePath = image ? await resolveImage(db, image) : undefined;
  const { error } = await db
    .from("catalog_nodes")
    .update(
      imagePath === undefined
        ? { name: name.trim(), slug }
        : { name: name.trim(), slug, image_url: imagePath },
    )
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (imagePath !== undefined && node.image_url && !node.image_url.startsWith("http")) {
    await db.storage.from("product-images").remove([node.image_url]);
  }
  return { ok: true as const };
}

/** Moves a folder up or down among its siblings. */
export async function moveNode(id: string, direction: "up" | "down") {
  const db = await requireAdmin();
  const { data: node } = await db
    .from("catalog_nodes")
    .select("id, parent_id, sort_order")
    .eq("id", id)
    .maybeSingle();
  if (!node) throw new Error("NOT_FOUND");

  let query = db.from("catalog_nodes").select("id, sort_order, name").order("sort_order");
  query = node.parent_id ? query.eq("parent_id", node.parent_id) : query.is("parent_id", null);
  const { data: siblings } = await query;
  const ordered = (siblings ?? []).slice();
  const index = ordered.findIndex((s) => s.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return { ok: true as const };

  const a = ordered[index]!;
  const b = ordered[target]!;
  ordered[index] = b;
  ordered[target] = a;
  for (const [position, item] of ordered.entries()) {
    await db.from("catalog_nodes").update({ sort_order: position }).eq("id", item.id);
  }
  return { ok: true as const };
}

async function descendantIds(
  db: Awaited<ReturnType<typeof requireAdmin>>,
  rootId: string,
): Promise<string[]> {
  const { data } = await db.from("catalog_nodes").select("id, parent_id");
  const all = data ?? [];
  const ids = [rootId];
  const walk = (parent: string) => {
    for (const child of all.filter((n) => n.parent_id === parent)) {
      ids.push(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return ids;
}

/** Counts what a folder deletion would destroy, used for the confirmation dialog. */
export async function nodeDeletionImpact(id: string) {
  const db = await requireAdmin();
  const ids = await descendantIds(db, id);
  const { data: products } = await db.from("products").select("id").in("node_id", ids);
  return { folders: ids.length - 1, products: (products ?? []).length };
}

export async function deleteNode(id: string) {
  const db = await requireAdmin();
  const ids = await descendantIds(db, id);
  const { data: products } = await db.from("products").select("image_url").in("node_id", ids);
  const { data: nodeRows } = await db.from("catalog_nodes").select("image_url").in("id", ids);
  const paths = [...(products ?? []), ...(nodeRows ?? [])]
    .map((p) => p.image_url)
    .filter((p): p is string => Boolean(p) && !p!.startsWith("http"));
  if (paths.length) await db.storage.from("product-images").remove(paths);
  const { error } = await db.from("catalog_nodes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export type ProductInput = {
  id?: string;
  node_id: string;
  name: string;
  brand: string;
  serial_number: string;
  stock: number;
  price: number | null;
  /** Product characteristics (formerly "description"). */
  characteristics: string;
  specifications?: { label: string; value: string }[];
  gallery?: string[];
  marketing_sections?: Json[];
  source_url?: string | null;
  source_name?: string | null;
  featured?: boolean;
  imageData?: string | null;
  imageName?: string | null;
  imageUrl?: string | null;
  removeImage?: boolean;
};

export async function uploadImageFromDataUrl(
  db: Awaited<ReturnType<typeof requireAdmin>>,
  imageData: string,
  imageName: string,
) {
  return storeImage(db, imageData, imageName);
}

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
  } else if (input.imageUrl) {
    const url = input.imageUrl.trim();
    if (!/^https:\/\/[^\s]+$/i.test(url)) throw new Error("INVALID_IMAGE_URL");
    imagePath = url;
  } else if (input.removeImage) {
    imagePath = null;
  }

  const base = {
    node_id: input.node_id,
    name: input.name.trim(),
    brand: input.brand.trim(),
    serial_number: input.serial_number.trim(),
    stock: Math.max(0, Math.floor(input.stock)),
    price: input.price,
    characteristics: input.characteristics,
    featured: Boolean(input.featured),
    ...(input.specifications ? { specifications: input.specifications as Json } : {}),
    ...(input.gallery ? { gallery: input.gallery } : {}),
    ...(input.marketing_sections ? { marketing_sections: input.marketing_sections as Json } : {}),
    ...(input.source_url !== undefined ? { source_url: input.source_url } : {}),
    ...(input.source_name !== undefined ? { source_name: input.source_name } : {}),
  };

  if (input.id) {
    const { data: existing } = await db
      .from("products")
      .select("image_url")
      .eq("id", input.id)
      .maybeSingle();
    const payload = imagePath === undefined ? base : { ...base, image_url: imagePath };
    const { error } = await db.from("products").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
    if (imagePath !== undefined && existing?.image_url && !existing.image_url.startsWith("http")) {
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
  if (existing?.image_url && !existing.image_url.startsWith("http")) {
    await db.storage.from("product-images").remove([existing.image_url]);
  }
  return { ok: true as const };
}

export async function saveSettings(input: {
  primary_color: string;
  secondary_color: string;
  text_color: string;
}) {
  const db = await requireAdmin();
  const hex = /^#[0-9a-fA-F]{6}$/;
  for (const value of [input.primary_color, input.secondary_color, input.text_color]) {
    if (!hex.test(value)) throw new Error("INVALID_COLOR");
  }
  const { error } = await db
    .from("site_settings")
    .update({ ...input })
    .eq("id", "default");
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/**
 * Quick-jump: creates every missing folder between `fromId` and the new
 * product (Modèle) in one action, then creates the product itself.
 * `folders` are the names of the levels still missing, top to bottom.
 */
export async function quickCreateChain(input: {
  fromId: string | null;
  folders: string[];
  product: Omit<ProductInput, "node_id" | "id">;
}) {
  const db = await requireAdmin();

  let level = 0;
  if (input.fromId) {
    const { data: from } = await db
      .from("catalog_nodes")
      .select("id, level")
      .eq("id", input.fromId)
      .maybeSingle();
    if (!from) throw new Error("PARENT_NOT_FOUND");
    level = from.level;
  }

  const names = input.folders.map((n) => n.trim()).filter(Boolean);
  if (names.length !== input.folders.length) throw new Error("EMPTY_NAME");
  if (level + names.length > 4) throw new Error("MAX_DEPTH");
  if (level + names.length < 3) throw new Error("MISSING_LEVELS");

  let parentId = input.fromId;
  for (const name of names) {
    const created = await createNode(parentId, name);
    parentId = created.id;
  }
  if (!parentId) throw new Error("NO_FOLDER");

  const product = await saveProduct({ ...input.product, node_id: parentId });
  return { nodeId: parentId, productId: product.id };
}


/* ---------- Recherches populaires (curated by admins) ---------- */

export async function addPopularSearch(term: string) {
  const db = await requireAdmin();
  const value = term.trim().slice(0, 60);
  if (!value) throw new Error("EMPTY_TERM");
  const { data: existing } = await db.from("popular_searches").select("sort_order");
  const sort_order = (existing ?? []).reduce((max, r) => Math.max(max, r.sort_order), -1) + 1;
  const { error } = await db.from("popular_searches").insert({ term: value, sort_order });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function deletePopularSearch(id: string) {
  const db = await requireAdmin();
  const { error } = await db.from("popular_searches").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function movePopularSearch(id: string, direction: "up" | "down") {
  const db = await requireAdmin();
  const { data } = await db.from("popular_searches").select("id, sort_order").order("sort_order");
  const ordered = (data ?? []).slice();
  const index = ordered.findIndex((r) => r.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return { ok: true as const };
  const a = ordered[index]!;
  ordered[index] = ordered[target]!;
  ordered[target] = a;
  for (const [position, row] of ordered.entries()) {
    await db.from("popular_searches").update({ sort_order: position }).eq("id", row.id);
  }
  return { ok: true as const };
}

export async function setProductFeatured(id: string, featured: boolean) {
  const db = await requireAdmin();
  const { error } = await db.from("products").update({ featured }).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}


/* ---------- Site mode (public site availability) ---------- */

export type SiteMode = "online" | "maintenance" | "coming_soon" | "closed";

const SITE_MODES: SiteMode[] = ["online", "maintenance", "coming_soon", "closed"];

export async function getSiteMode(): Promise<SiteMode> {
  const db = await requireAdmin();
  const { data } = await db
    .from("site_settings")
    .select("site_mode")
    .eq("id", "default")
    .maybeSingle();
  return ((data?.site_mode ?? "online") as SiteMode);
}

export async function setSiteMode(mode: SiteMode) {
  const db = await requireAdmin();
  if (!SITE_MODES.includes(mode)) throw new Error("INVALID_MODE");
  const previous = await getSiteMode();
  const { error } = await db.from("site_settings").update({ site_mode: mode }).eq("id", "default");
  if (error) throw new Error(error.message);
  return { ok: true as const, previous, mode };
}

/** Shared admin guard for Cindy's controlled actions. */
export async function adminDb() {
  return requireAdmin();
}
