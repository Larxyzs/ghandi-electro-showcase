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
    // Stay signed in on this browser essentially forever (10 years).
    maxAge: 60 * 60 * 24 * 3650,
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
  const username = session.data.username;
  return {
    username,
    // Older sessions predate the role field: the founder account is always super.
    role: session.data.role === "super" || username === SUPER_ADMIN_USERNAME ? "super" : "staff",
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

/** Drag & drop: moves a folder (with its whole subtree) under a new parent. */
export async function reparentNode(id: string, newParentId: string | null) {
  const db = await requireAdmin();
  const { data: all } = await db.from("catalog_nodes").select("id, parent_id, level, name");
  const rows = all ?? [];
  const node = rows.find((n) => n.id === id);
  if (!node) throw new Error("NOT_FOUND");
  if (newParentId === id) throw new Error("INVALID_TARGET");
  if ((node.parent_id ?? null) === (newParentId ?? null)) return { ok: true as const };

  let newLevel = 1;
  if (newParentId) {
    const parent = rows.find((n) => n.id === newParentId);
    if (!parent) throw new Error("PARENT_NOT_FOUND");
    // Prevent dropping a folder inside its own subtree.
    let cursor: string | null = parent.id;
    while (cursor) {
      if (cursor === id) throw new Error("CIRCULAR");
      cursor = rows.find((n) => n.id === cursor)?.parent_id ?? null;
    }
    newLevel = parent.level + 1;
  }
  if (newLevel > 4) throw new Error("MAX_DEPTH");

  // Depth of the moved subtree must still fit within 4 levels.
  const depthOf = (rootId: string): number => {
    const kids = rows.filter((n) => n.parent_id === rootId);
    return kids.length === 0 ? 1 : 1 + Math.max(...kids.map((k) => depthOf(k.id)));
  };
  if (newLevel + depthOf(id) - 1 > 4) throw new Error("TOO_DEEP");

  let siblings = db.from("catalog_nodes").select("sort_order");
  siblings = newParentId
    ? siblings.eq("parent_id", newParentId)
    : siblings.is("parent_id", null);
  const { data: existing } = await siblings;
  const sort_order = (existing ?? []).reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
  const slug = await uniqueSlug(db, newParentId, node.name, id);

  const { error } = await db
    .from("catalog_nodes")
    .update({ parent_id: newParentId, level: newLevel, sort_order, slug })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Re-level descendants relative to the moved folder.
  const shift = newLevel - node.level;
  if (shift !== 0) {
    const relevel = async (parentId: string) => {
      for (const child of rows.filter((n) => n.parent_id === parentId)) {
        await db
          .from("catalog_nodes")
          .update({ level: child.level + shift })
          .eq("id", child.id);
        await relevel(child.id);
      }
    };
    await relevel(id);
  }
  return { ok: true as const };
}

/** Drag & drop: moves a product into another Produit/Format folder. */
export async function moveProductToNode(id: string, nodeId: string) {
  const db = await requireAdmin();
  const { data: target } = await db
    .from("catalog_nodes")
    .select("id, level")
    .eq("id", nodeId)
    .maybeSingle();
  if (!target) throw new Error("PARENT_NOT_FOUND");
  if (target.level < 3) throw new Error("INVALID_TARGET");
  const { error } = await db.from("products").update({ node_id: nodeId }).eq("id", id);
  if (error) throw new Error(error.message);
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
  /** Slideshow images: existing URL/path strings, or new uploads to store. */
  gallery?: (string | { imageData: string; imageName: string })[];
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
  folders: (string | ({ name: string } & ImageInput))[];
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

  const entries = input.folders.map((folder) =>
    typeof folder === "string" ? { name: folder.trim() } : { ...folder, name: folder.name.trim() },
  );
  if (entries.some((entry) => !entry.name)) throw new Error("EMPTY_NAME");
  if (level + entries.length > 4) throw new Error("MAX_DEPTH");
  if (level + entries.length < 3) throw new Error("MISSING_LEVELS");

  let parentId = input.fromId;
  for (const entry of entries) {
    const { name, ...image } = entry;
    const created = await createNode(parentId, name, image);
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

/* ---------- Cindy: research sessions & action history ---------- */

export type CindySessionRow = {
  id: string;
  title: string;
  query: string;
  events: Json[];
  created_at: string;
  updated_at: string;
};

export async function listCindySessions() {
  const db = await requireAdmin();
  const me = await currentAdmin();
  const { data, error } = await db
    .from("cindy_sessions")
    .select("id, title, messages, created_at, updated_at")
    .eq("admin_username", me!.username)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const payload = (row.messages ?? {}) as { query?: string; events?: Json[] };
    return {
      id: row.id,
      title: row.title,
      query: payload.query ?? "",
      events: Array.isArray(payload.events) ? payload.events : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
    } satisfies CindySessionRow;
  });
}

export async function saveCindySession(input: {
  id?: string | null;
  title: string;
  query: string;
  events: Json;
}) {
  const db = await requireAdmin();
  const me = await currentAdmin();
  const payload = { query: input.query, events: input.events } as unknown as Json;
  if (input.id) {
    const { error } = await db
      .from("cindy_sessions")
      .update({ title: input.title, messages: payload })
      .eq("id", input.id)
      .eq("admin_username", me!.username);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await db
    .from("cindy_sessions")
    .insert({ admin_username: me!.username, title: input.title, messages: payload })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function deleteCindySession(id: string) {
  const db = await requireAdmin();
  const me = await currentAdmin();
  const { error } = await db
    .from("cindy_sessions")
    .delete()
    .eq("id", id)
    .eq("admin_username", me!.username);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function recordAction(input: {
  action: string;
  entity: string;
  entity_id?: string | null;
  label: string;
  before_state?: Json | null;
  after_state?: Json | null;
}) {
  const db = await requireAdmin();
  const me = await currentAdmin();
  const { error } = await db.from("cindy_actions").insert({
    admin_username: me!.username,
    action: input.action,
    entity: input.entity,
    entity_id: input.entity_id ?? null,
    label: input.label,
    before_state: input.before_state ?? null,
    after_state: input.after_state ?? null,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function listActions() {
  const db = await requireAdmin();
  const { data, error } = await db
    .from("cindy_actions")
    .select("id, admin_username, action, entity, entity_id, label, undone_at, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Reverts a logged action when it is reversible (product creation, site mode change). */
export async function undoAction(id: string) {
  const db = await requireAdmin();
  const { data: action, error } = await db
    .from("cindy_actions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!action) throw new Error("NOT_FOUND");
  if (action.undone_at) throw new Error("ALREADY_UNDONE");

  if (action.action === "product_create" && action.entity_id) {
    await db.from("products").delete().eq("id", action.entity_id);
  } else if (action.action === "site_mode" && action.before_state) {
    const before = action.before_state as { site_mode?: string };
    if (before.site_mode) {
      await db.from("site_settings").update({ site_mode: before.site_mode }).eq("id", "default");
    }
  } else {
    throw new Error("NOT_REVERSIBLE");
  }

  await db.from("cindy_actions").update({ undone_at: new Date().toISOString() }).eq("id", id);
  return { ok: true as const };
}

// ===================== Cindy research memory (cache) =====================

/** Cached products Cindy has already researched — admin only. */
export async function listResearchMemory() {
  const db = await requireAdmin();
  const { data, error } = await db
    .from("cindy_cache")
    .select("id, query, brand, model, hits, searches_used, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Forgets one cached product so the next request researches it from scratch. */
export async function forgetResearchMemory(id: string) {
  const db = await requireAdmin();
  const { error } = await db.from("cindy_cache").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ---------- Google sign-in (authorized admin emails) ---------- */

/** Emails allowed to open the admin panel with Google. */
export async function listAdminEmails() {
  const db = await requireSuperAdmin();
  const { data, error } = await db
    .from("admin_emails")
    .select("id, email, role, created_at")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: (row.role === "super" ? "super" : "staff") as AdminRole,
    created_at: row.created_at,
  }));
}

export async function addAdminEmail(email: string, role: AdminRole) {
  const db = await requireSuperAdmin();
  const value = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(value)) throw new Error("INVALID_EMAIL");
  const { error } = await db
    .from("admin_emails")
    .insert({ email: value, role: role === "super" ? "super" : "staff" });
  if (error) throw new Error(error.code === "23505" ? "EMAIL_TAKEN" : error.message);
  return { ok: true as const };
}

export async function deleteAdminEmail(id: string) {
  const db = await requireSuperAdmin();
  const { error } = await db.from("admin_emails").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

/**
 * Exchanges a Google (Supabase) access token for an admin session.
 * Only emails present in `admin_emails` are accepted.
 */
export async function loginWithGoogle(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData, error } = await supabaseAdmin.auth.getUser(accessToken);
  const email = userData?.user?.email?.toLowerCase() ?? "";
  if (error || !email) return { ok: false as const, reason: "INVALID_TOKEN" as const, email: "" };

  const { data: allowed } = await supabaseAdmin
    .from("admin_emails")
    .select("email, role")
    .ilike("email", email)
    .maybeSingle();

  const { count } = await supabaseAdmin
    .from("admin_emails")
    .select("id", { count: "exact", head: true });

  // Bootstrap: when no email is authorized yet, the first Google sign-in becomes
  // the super admin so the founder can set the list up from the panel itself.
  if (!allowed && (count ?? 0) === 0) {
    await supabaseAdmin.from("admin_emails").insert({ email, role: "super" });
  } else if (!allowed) {
    return { ok: false as const, reason: "NOT_AUTHORIZED" as const, email };
  }

  const role: AdminRole = !allowed || allowed.role === "super" ? "super" : "staff";
  const session = await useSession<AdminSession>(sessionConfig());
  await session.update({ unlocked: true, username: email, role });
  return { ok: true as const, reason: "OK" as const, email, role };
}

/* ---------- Cindy: swappable research API ---------- */

export type SearchProviderId = "tavily" | "serper" | "brave";
export type AiProviderChoice = "gemini" | "lovable";

const SEARCH_ENV: Record<SearchProviderId, string> = {
  serper: "SERPER_API_KEY",
  tavily: "TAVILY_API_KEY",
  brave: "BRAVE_API_KEY",
};

/** Current research + Cindy AI configuration (keys are never returned in clear). */
export async function getSearchSettings() {
  const db = await requireAdmin();
  const { data } = await db
    .from("site_settings")
    .select("search_provider, search_api_key, search_model, ai_provider, ai_model, ai_api_key")
    .eq("id", "default")
    .maybeSingle();

  const provider = (data?.search_provider ?? "serper") as SearchProviderId;
  const key = data?.search_api_key ?? "";
  const envKey = (process.env[SEARCH_ENV[provider]] ?? "").trim();
  const aiProvider = (data?.ai_provider ?? "gemini") as AiProviderChoice;
  const aiKey = data?.ai_api_key ?? "";
  const aiEnvKey = (
    aiProvider === "gemini" ? (process.env["GEMINI_API_KEY"] ?? "") : (process.env["LOVABLE_API_KEY"] ?? "")
  ).trim();

  return {
    provider,
    model: data?.search_model ?? "search",
    hasKey: Boolean(key || envKey),
    keyPreview: key ? `••••${key.slice(-4)}` : envKey ? "clé système" : "",
    aiProvider,
    aiModel: data?.ai_model ?? "gemini-2.5-flash",
    hasAiKey: Boolean(aiKey || aiEnvKey),
    aiKeyPreview: aiKey ? `••••${aiKey.slice(-4)}` : aiEnvKey ? "clé système" : "",
    aiModels: (await import("./ai-config.server")).AI_MODELS,
  };
}

export async function saveSearchSettings(input: {
  provider: SearchProviderId;
  key: string | null;
  model?: string;
  aiProvider?: AiProviderChoice;
  aiModel?: string;
  aiKey?: string | null;
  test?: boolean;
}) {
  const db = await requireAdmin();
  const provider: SearchProviderId = (["tavily", "serper", "brave"] as const).includes(
    input.provider,
  )
    ? input.provider
    : "serper";
  const key = (input.key ?? "").trim();
  const model = ["search", "news", "shopping"].includes(input.model ?? "")
    ? (input.model as string)
    : "search";
  const aiProvider: AiProviderChoice =
    input.aiProvider === "lovable" || input.aiProvider === "gemini" ? input.aiProvider : "gemini";
  const aiKey = (input.aiKey ?? "").trim();

  const { AI_MODELS } = await import("./ai-config.server");
  const allowedAiModels = AI_MODELS[aiProvider].map((m) => m.id);
  const aiModel = allowedAiModels.includes(input.aiModel ?? "")
    ? (input.aiModel as string)
    : allowedAiModels[0]!;

  // Test with the key being submitted, or the one already active.
  let test: { ok: boolean; results: number; message: string } | null = null;
  let aiTest: { ok: boolean; message: string } | null = null;
  if (input.test) {
    const searchKey = key || (process.env[SEARCH_ENV[provider]] ?? "").trim();
    if (searchKey) {
      const { testSearchProvider } = await import("./cindy.server");
      test = await testSearchProvider(provider, searchKey, model);
    } else {
      test = { ok: false, results: 0, message: "SEARCH_NOT_CONFIGURED" };
    }

    const brainKey =
      aiKey ||
      (aiProvider === "gemini"
        ? (process.env["GEMINI_API_KEY"] ?? "")
        : (process.env["LOVABLE_API_KEY"] ?? "")
      ).trim();
    const { testAiProvider } = await import("./ai-config.server");
    aiTest = brainKey
      ? await testAiProvider(aiProvider, aiModel, brainKey)
      : { ok: false, message: "AI_NOT_CONFIGURED" };
  }

  // When a test was requested and failed, keep the previous working configuration.
  if (test && !test.ok) return { ok: false as const, test, aiTest, saved: false };
  if (aiTest && !aiTest.ok) return { ok: false as const, test, aiTest, saved: false };

  const payload: {
    search_provider: string;
    search_model: string;
    ai_provider: string;
    ai_model: string;
    search_api_key?: string;
    ai_api_key?: string;
  } = {
    search_provider: provider,
    search_model: model,
    ai_provider: aiProvider,
    ai_model: aiModel,
  };
  if (key) payload.search_api_key = key;
  if (aiKey) payload.ai_api_key = aiKey;
  const { error } = await db.from("site_settings").update(payload).eq("id", "default");
  if (error) throw new Error(error.message);
  return { ok: true as const, test, aiTest, saved: true };
}

/* ---------- Image maintenance (batch optimisation) ---------- */

/** Every catalog image, used by the admin image optimiser. */
export async function listAllImages() {
  const db = await requireAdmin();
  const [{ data: products }, { data: nodes }] = await Promise.all([
    db.from("products").select("id, name, image_url").order("name"),
    db.from("catalog_nodes").select("id, name, image_url").order("name"),
  ]);
  const sign = async (path: string | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const { data } = await db.storage.from("product-images").createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  };
  const items: { id: string; kind: "product" | "node"; label: string; imageUrl: string | null }[] =
    [];
  for (const row of products ?? []) {
    items.push({ id: row.id, kind: "product", label: row.name, imageUrl: await sign(row.image_url) });
  }
  for (const row of nodes ?? []) {
    items.push({ id: row.id, kind: "node", label: row.name, imageUrl: await sign(row.image_url) });
  }
  return items;
}

/** Replaces a product/folder image with an already-optimised data URL. */
export async function replaceImage(input: {
  kind: "product" | "node";
  id: string;
  imageData: string;
  imageName: string;
}) {
  const db = await requireAdmin();
  const table = input.kind === "product" ? "products" : "catalog_nodes";
  const { data: existing } = await db
    .from(table)
    .select("image_url")
    .eq("id", input.id)
    .maybeSingle();
  const path = await uploadImageFromDataUrl(db, input.imageData, input.imageName);
  const { error } = await db.from(table).update({ image_url: path }).eq("id", input.id);
  if (error) throw new Error(error.message);
  const previous = existing?.image_url;
  if (previous && !previous.startsWith("http")) {
    await db.storage.from("product-images").remove([previous]);
  }
  return { ok: true as const };
}

// ===================== Restore points (site snapshots) =====================

/**
 * Captures the full editable state of the site (catalog folders, products,
 * colors, popular searches) so any later change — by an admin or by Cindy —
 * can be rolled back in one click.
 */
export async function createSnapshot(label = "Point de restauration") {
  const db = await requireAdmin();
  const me = await currentAdmin();
  const [{ data: nodes }, { data: products }, { data: settings }, { data: searches }] =
    await Promise.all([
      db.from("catalog_nodes").select("*"),
      db.from("products").select("*"),
      db.from("site_settings").select("*").eq("id", "default").maybeSingle(),
      db.from("popular_searches").select("*"),
    ]);
  const payload = {
    nodes: nodes ?? [],
    products: products ?? [],
    settings: settings ?? null,
    popular_searches: searches ?? [],
  };
  const { data, error } = await db
    .from("site_snapshots")
    .insert({
      label,
      created_by: me?.username ?? "",
      payload: payload as unknown as Json,
    })
    .select("id, label, created_at")
    .single();
  if (error) throw new Error(error.message);
  // Keep only the 30 most recent restore points.
  const { data: extra } = await db
    .from("site_snapshots")
    .select("id")
    .order("created_at", { ascending: false })
    .range(30, 200);
  if (extra?.length) {
    await db
      .from("site_snapshots")
      .delete()
      .in("id", extra.map((row) => row.id));
  }
  return data;
}

export async function listSnapshots() {
  const db = await requireAdmin();
  const { data, error } = await db
    .from("site_snapshots")
    .select("id, label, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Puts the catalog, products, colors and popular searches back to a snapshot. */
export async function restoreSnapshot(id: string) {
  const db = await requireAdmin();
  const { data: snapshot, error } = await db
    .from("site_snapshots")
    .select("payload, label")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!snapshot) throw new Error("NOT_FOUND");

  const payload = (snapshot.payload ?? {}) as {
    nodes?: Record<string, unknown>[];
    products?: Record<string, unknown>[];
    settings?: Record<string, unknown> | null;
    popular_searches?: Record<string, unknown>[];
  };

  // Safety net: keep the state we are replacing, so a restore can be undone too.
  await createSnapshot(`Avant restauration « ${snapshot.label} »`);

  await db.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("catalog_nodes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("popular_searches").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const nodes = payload.nodes ?? [];
  // Insert parents before children so the self-referencing FK stays valid.
  for (const level of [1, 2, 3, 4]) {
    const batch = nodes.filter((node) => Number(node["level"]) === level);
    if (batch.length) {
      const { error: nodeError } = await db.from("catalog_nodes").insert(batch as never);
      if (nodeError) throw new Error(nodeError.message);
    }
  }
  if (payload.products?.length) {
    const { error: productError } = await db.from("products").insert(payload.products as never);
    if (productError) throw new Error(productError.message);
  }
  if (payload.popular_searches?.length) {
    await db.from("popular_searches").insert(payload.popular_searches as never);
  }
  if (payload.settings) {
    const { id: _ignored, ...rest } = payload.settings;
    await db.from("site_settings").update(rest as never).eq("id", "default");
  }
  return { ok: true as const, label: snapshot.label };
}
