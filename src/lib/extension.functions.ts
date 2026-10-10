import { createServerFn } from "@tanstack/react-start";

const id = (d: { id: string }) => {
  if (typeof d?.id !== "string" || !d.id) throw new Error("BAD_INPUT");
  return { id: d.id };
};

export const extListKeys = createServerFn({ method: "GET" }).handler(async () => (await import("./extension.server")).listKeys());
export const extCreateKey = createServerFn({ method: "POST" })
  .inputValidator((d: { label: string }) => ({ label: String(d?.label ?? "").slice(0, 80) }))
  .handler(async ({ data }) => (await import("./extension.server")).createKey(data.label));
export const extRevokeKey = createServerFn({ method: "POST" }).inputValidator(id)
  .handler(async ({ data }) => (await import("./extension.server")).revokeKey(data.id));
export const extListBatches = createServerFn({ method: "GET" }).handler(async () => (await import("./extension.server")).listBatches());
export const extReady = createServerFn({ method: "GET" }).handler(async () => (await import("./extension.server")).readyCount());
export const extCancelBatch = createServerFn({ method: "POST" }).inputValidator(id)
  .handler(async ({ data }) => (await import("./extension.server")).cancelBatch(data.id));
export const extGetBatch = createServerFn({ method: "POST" }).inputValidator(id)
  .handler(async ({ data }) => (await import("./extension.server")).getBatch(data.id));
export const extMarkItems = createServerFn({ method: "POST" })
  .inputValidator((d: { batchId: string; rows: { id: string; status: "imported" | "skipped"; productId?: string | null }[] }) => {
    if (typeof d?.batchId !== "string" || !Array.isArray(d.rows) || d.rows.length > 500) throw new Error("BAD_INPUT");
    return { batchId: d.batchId, rows: d.rows.filter((r) => r.status === "imported" || r.status === "skipped") };
  })
  .handler(async ({ data }) => (await import("./extension.server")).markItems(data.batchId, data.rows));
