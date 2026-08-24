import { createServerFn } from "@tanstack/react-start";

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { currentAdmin } = await import("./admin.server");
  const me = await currentAdmin();
  return { authenticated: Boolean(me), username: me?.username ?? null, role: me?.role ?? null };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => ({
    username: String(data.username ?? "").slice(0, 64),
    password: String(data.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const { login } = await import("./admin.server");
    const me = await login(data.username, data.password);
    return { ok: Boolean(me), role: me?.role ?? null, username: me?.username ?? null };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { lock } = await import("./admin.server");
  await lock();
  return { ok: true as const };
});

export const adminGetData = createServerFn({ method: "GET" }).handler(async () => {
  const { adminData } = await import("./admin.server");
  return adminData();
});

export const adminListStaff = createServerFn({ method: "GET" }).handler(async () => {
  const { listStaff } = await import("./admin.server");
  return listStaff();
});

export const adminCreateStaff = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => ({
    username: String(data.username ?? "").slice(0, 64),
    password: String(data.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const { createStaff } = await import("./admin.server");
    return createStaff(data.username, data.password);
  });

export const adminUpdateStaffPassword = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; password: string }) => ({
    id: String(data.id),
    password: String(data.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const { updateStaffPassword } = await import("./admin.server");
    return updateStaffPassword(data.id, data.password);
  });

export const adminDeleteStaff = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deleteStaff } = await import("./admin.server");
    return deleteStaff(data.id);
  });

export type AdminImageInput = {
  imageData?: string | null;
  imageName?: string | null;
  imageUrl?: string | null;
  removeImage?: boolean;
};

export const adminCreateNode = createServerFn({ method: "POST" })
  .inputValidator((data: { parentId: string | null; name: string; image?: AdminImageInput }) => ({
    parentId: data.parentId ? String(data.parentId) : null,
    name: String(data.name ?? "").slice(0, 80),
    image: data.image ?? undefined,
  }))
  .handler(async ({ data }) => {
    const { createNode } = await import("./admin.server");
    if (!data.name.trim()) throw new Error("EMPTY_NAME");
    return createNode(data.parentId, data.name, data.image);
  });

export const adminRenameNode = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; name: string; image?: AdminImageInput }) => ({
    id: String(data.id),
    name: String(data.name ?? "").slice(0, 80),
    image: data.image ?? undefined,
  }))
  .handler(async ({ data }) => {
    const { renameNode } = await import("./admin.server");
    if (!data.name.trim()) throw new Error("EMPTY_NAME");
    return renameNode(data.id, data.name, data.image);
  });

export const adminMoveNode = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; direction: "up" | "down" }) => ({
    id: String(data.id),
    direction: data.direction === "up" ? ("up" as const) : ("down" as const),
  }))
  .handler(async ({ data }) => {
    const { moveNode } = await import("./admin.server");
    return moveNode(data.id, data.direction);
  });

export const adminNodeImpact = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { nodeDeletionImpact } = await import("./admin.server");
    return nodeDeletionImpact(data.id);
  });

export const adminDeleteNode = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deleteNode } = await import("./admin.server");
    return deleteNode(data.id);
  });

export type AdminProductInput = {
  id?: string;
  node_id: string;
  name: string;
  brand: string;
  serial_number: string;
  stock: number;
  price: number | null;
  characteristics: string;
  specifications?: { label: string; value: string }[];
  gallery?: string[];
  marketing_sections?: import("@/integrations/supabase/types").Json[];
  source_url?: string | null;
  source_name?: string | null;
  featured?: boolean;
  imageData?: string | null;
  imageName?: string | null;
  imageUrl?: string | null;
  removeImage?: boolean;
};

export const adminSaveProduct = createServerFn({ method: "POST" })
  .inputValidator((data: AdminProductInput) => data)
  .handler(async ({ data }) => {
    const { saveProduct } = await import("./admin.server");
    if (!data.name?.trim()) throw new Error("EMPTY_NAME");
    if (!data.node_id) throw new Error("NO_FOLDER");
    return saveProduct({
      ...data,
      brand: data.brand ?? "",
      stock: Number.isFinite(data.stock) ? data.stock : 0,
      serial_number: data.serial_number ?? "",
      characteristics: data.characteristics ?? "",
      price: data.price ?? null,
    });
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deleteProduct } = await import("./admin.server");
    return deleteProduct(data.id);
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { primary_color: string; secondary_color: string; text_color: string }) => ({
    primary_color: String(data.primary_color),
    secondary_color: String(data.secondary_color),
    text_color: String(data.text_color),
  }))
  .handler(async ({ data }) => {
    const { saveSettings } = await import("./admin.server");
    return saveSettings(data);
  });

export const adminQuickCreate = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      fromId: string | null;
      folders: string[];
      product: Omit<AdminProductInput, "id" | "node_id">;
    }) => ({
      fromId: data.fromId ? String(data.fromId) : null,
      folders: (data.folders ?? []).map((n) => String(n ?? "").slice(0, 80)),
      product: data.product,
    }),
  )
  .handler(async ({ data }) => {
    const { quickCreateChain } = await import("./admin.server");
    if (!data.product?.name?.trim()) throw new Error("EMPTY_NAME");
    return quickCreateChain({
      fromId: data.fromId,
      folders: data.folders,
      product: {
        ...data.product,
        brand: data.product.brand ?? "",
        stock: Number.isFinite(data.product.stock) ? data.product.stock : 0,
        serial_number: data.product.serial_number ?? "",
        characteristics: data.product.characteristics ?? "",
        price: data.product.price ?? null,
      },
    });
  });


export const adminSetFeatured = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; featured: boolean }) => ({
    id: String(data.id),
    featured: Boolean(data.featured),
  }))
  .handler(async ({ data }) => {
    const { setProductFeatured } = await import("./admin.server");
    return setProductFeatured(data.id, data.featured);
  });

export const adminAddPopularSearch = createServerFn({ method: "POST" })
  .inputValidator((data: { term: string }) => ({ term: String(data.term ?? "").slice(0, 60) }))
  .handler(async ({ data }) => {
    const { addPopularSearch } = await import("./admin.server");
    return addPopularSearch(data.term);
  });

export const adminDeletePopularSearch = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deletePopularSearch } = await import("./admin.server");
    return deletePopularSearch(data.id);
  });

export const adminMovePopularSearch = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; direction: "up" | "down" }) => ({
    id: String(data.id),
    direction: data.direction === "up" ? ("up" as const) : ("down" as const),
  }))
  .handler(async ({ data }) => {
    const { movePopularSearch } = await import("./admin.server");
    return movePopularSearch(data.id, data.direction);
  });


/* ---------- Site mode ---------- */

export const adminSetSiteMode = createServerFn({ method: "POST" })
  .inputValidator((data: { mode: string }) => ({ mode: String(data.mode) }))
  .handler(async ({ data }) => {
    const { setSiteMode } = await import("./admin.server");
    return setSiteMode(data.mode as "online" | "maintenance" | "coming_soon" | "closed");
  });

/* ---------- Cindy sessions & action history ---------- */

export const adminListCindySessions = createServerFn({ method: "POST" }).handler(async () => {
  const { listCindySessions } = await import("./admin.server");
  return listCindySessions();
});

export const adminSaveCindySession = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { id?: string | null; title: string; query: string; events: unknown[] }) => data,
  )
  .handler(async ({ data }) => {
    const { saveCindySession } = await import("./admin.server");
    return saveCindySession({
      id: data.id ?? null,
      title: data.title,
      query: data.query,
      events: data.events as never,
    });
  });

export const adminDeleteCindySession = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { deleteCindySession } = await import("./admin.server");
    return deleteCindySession(data.id);
  });

export const adminListActions = createServerFn({ method: "POST" }).handler(async () => {
  const { listActions } = await import("./admin.server");
  return listActions();
});

export const adminUndoAction = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { undoAction } = await import("./admin.server");
    return undoAction(data.id);
  });

export const adminRecordAction = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      action: string;
      entity: string;
      entity_id?: string | null;
      label: string;
      before_state?: unknown;
      after_state?: unknown;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { recordAction } = await import("./admin.server");
    return recordAction({
      action: data.action,
      entity: data.entity,
      entity_id: data.entity_id ?? null,
      label: data.label,
      before_state: (data.before_state ?? null) as never,
      after_state: (data.after_state ?? null) as never,
    });
  });
