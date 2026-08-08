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

export const adminCreateCategory = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string }) => ({ name: String(data.name ?? "").slice(0, 80) }))
  .handler(async ({ data }) => {
    const { createCategory } = await import("./admin.server");
    if (!data.name.trim()) throw new Error("EMPTY_NAME");
    return createCategory(data.name);
  });

export const adminRenameCategory = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; name: string }) => ({
    id: String(data.id),
    name: String(data.name ?? "").slice(0, 80),
  }))
  .handler(async ({ data }) => {
    const { renameCategory } = await import("./admin.server");
    if (!data.name.trim()) throw new Error("EMPTY_NAME");
    return renameCategory(data.id, data.name);
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: String(data.id) }))
  .handler(async ({ data }) => {
    const { deleteCategory } = await import("./admin.server");
    return deleteCategory(data.id);
  });

export type AdminProductInput = {
  id?: string;
  category_id: string;
  name: string;
  brand: string;
  serial_number: string;
  stock: number;
  price: number | null;
  description: string;
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
    if (!data.category_id) throw new Error("NO_CATEGORY");
    return saveProduct({
      ...data,
      brand: data.brand ?? "",
      stock: Number.isFinite(data.stock) ? data.stock : 0,
      serial_number: data.serial_number ?? "",
      description: data.description ?? "",
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
