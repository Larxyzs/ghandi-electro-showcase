import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BulkItem, BulkOptions } from "../src/lib/bulk-import-types";

const state = vi.hoisted(() => ({
  products: [] as Record<string, unknown>[],
  nodes: [{ id: "folder", parent_id: null, name: "Froid", level: 0, slug: "froid" }],
  active: 0, peak: 0, serial: 0,
  removed: [] as string[],
}));
vi.mock("../src/lib/admin.server", () => ({ adminDb: async () => db }));

function query(table: string) {
  let operation = "select";
  let payload: Record<string, unknown> = {};
  const filters: [string, unknown][] = [];
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
    ilike: (key: string, value: string) => { filters.push([key, value]); return builder; },
    or: (value: string) => { filters.push(["model", value.split(",")[0]?.replace("model.ilike.", "")]); return builder; },
    limit: () => builder,
    maybeSingle: () => execute(true),
    single: () => execute(true),
    insert: (value: Record<string, unknown>) => { operation = "insert"; payload = value; return builder; },
    update: (value: Record<string, unknown>) => { operation = "update"; payload = value; return builder; },
    upsert: () => builder,
    delete: () => { operation = "delete"; return builder; },
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => execute(false).then(resolve, reject),
  };
  async function execute(single: boolean) {
    state.active++;
    state.peak = Math.max(state.peak, state.active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    state.active--;
    const rows: Record<string, unknown>[] = table === "products" ? state.products : table === "catalog_nodes" ? state.nodes : [];
    const matches = rows.filter((row) => filters.every(([key, value]) => String(row[key]).toLowerCase() === String(value).toLowerCase()));
    if (operation === "insert") {
      if (payload["name"] === "Fail") return { data: null, error: { message: "write failed" } };
      const row = { ...payload, id: `id-${state.serial++}` };
      rows.push(row);
      return { data: row, error: null };
    }
    if (operation === "update") matches.forEach((row) => Object.assign(row, payload));
    if (operation === "delete") matches.forEach((row) => rows.splice(rows.indexOf(row), 1));
    return { data: single ? matches[0] ?? null : matches, error: null };
  }
  return builder;
}
const db = {
  from: query,
  storage: { from: () => ({
    upload: async () => ({ error: null }),
    remove: async (paths: string[]) => { state.removed.push(...paths); return { error: null }; },
  }) },
};
import { importBulkBatch, previewBulk } from "../src/lib/bulk-import.server";
const opts: BulkOptions = { mode: "skip", folderId: "folder", fallbackId: null, createMissing: false, copyImages: false, dropForeignPrice: false };
const item = (key: string, extra: Partial<BulkItem> = {}): BulkItem => ({
  key, sourceUrl: `https://official.example/${key}`, brand: "Samsung", category: "Froid", name: key, model: key,
  priceText: "", priceValue: null, currency: "MAD", images: [], specs: [], specGroups: [], needsReview: false, ...extra,
});
beforeEach(() => {
  state.products = []; state.active = 0; state.peak = 0; state.serial = 0; state.removed = [];
  vi.unstubAllGlobals();
});
describe("parallel bulk imports", () => {
  it("runs independent products concurrently and keeps results in input order", async () => {
    const out = await importBulkBatch(Array.from({ length: 12 }, (_, i) => item(String(i))), opts);
    expect(out.map((r) => r.key)).toEqual(Array.from({ length: 12 }, (_, i) => String(i)));
    expect(out.every((r) => r.outcome === "created")).toBe(true);
    expect(state.peak).toBe(3);
    expect(state.products).toHaveLength(12);
  });
  it("serializes same source URL and brand/model duplicates without overwriting manual edits", async () => {
    const out = await importBulkBatch([item("a"), item("b", { sourceUrl: "https://official.example/a" }), item("c", { model: "a" })], opts);
    expect(out.map((r) => r.outcome)).toEqual(["created", "skipped", "skipped"]);
    expect(state.products).toHaveLength(1);
    expect(state.products[0]?.["name"]).toBe("a");
  });
  it("isolates write failures and preserves exact external gallery links and order", async () => {
    const images = ["https://official.example/a?$650_519_PNG$", "https://official.example/b?w=1200&s=abc"];
    const out = await importBulkBatch([item("ok", { images }), item("bad", { name: "Fail" })], opts);
    expect(out.map((r) => r.outcome)).toEqual(["created", "problem"]);
    expect(state.products[0]?.["gallery"]).toEqual(images);
  });
  it("copies photos concurrently, preserves slide order and retains a failed image's exact URL", async () => {
    let active = 0; let peak = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      active++; peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, url.includes("first") ? 15 : 2));
      active--;
      return new Response("image", { status: url.includes("failed") ? 403 : 200, headers: { "content-type": "image/png" } });
    });
    const images = ["https://official.example/first", "https://official.example/failed", "https://official.example/third"];
    const out = await importBulkBatch([item("a", { images })], { ...opts, copyImages: true });
    expect(peak).toBe(2);
    const gallery = state.products[0]?.["gallery"] as string[];
    expect(gallery[0]).toMatch(/\.png$/);
    expect(gallery[1]).toBe(images[1]);
    expect(gallery[2]).toMatch(/\.png$/);
    expect(out[0]?.warnings).toEqual([`Image non copiée : ${images[1]}`]);
  });
  it("previews existing products with bounded concurrent reads", async () => {
    state.products.push({ id: "old", source_url: "https://official.example/a", brand: "Samsung", model: "a" });
    const out = await previewBulk([item("a"), item("b", { model: "a" }), ...Array.from({ length: 6 }, (_, i) => item(String(i)))], opts);
    expect(out.slice(0, 2).map((r) => r.status)).toEqual(["exists", "exists"]);
    expect(state.peak).toBe(6);
  });
});