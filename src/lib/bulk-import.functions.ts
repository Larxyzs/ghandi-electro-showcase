import { createServerFn } from "@tanstack/react-start";
import type { BulkItem, BulkOptions } from "./bulk-import-types";

type Input = { items: BulkItem[]; options: BulkOptions };
const validate = (data: Input) => {
  if (!Array.isArray(data?.items) || data.items.length > 50) throw new Error("BAD_INPUT");
  return data;
};

export const adminBulkPreview = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => {
    if (!Array.isArray(data?.items) || data.items.length > 2000) throw new Error("BAD_INPUT");
    return data;
  })
  .handler(async ({ data }) => {
    const { previewBulk } = await import("./bulk-import.server");
    return previewBulk(data.items, data.options);
  });

export const adminBulkImport = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const { importBulkBatch } = await import("./bulk-import.server");
    return importBulkBatch(data.items, data.options);
  });
