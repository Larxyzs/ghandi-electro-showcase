import { describe, expect, it, vi } from "vitest";
import type { BulkItem } from "../src/lib/bulk-import-types";

vi.mock("../src/lib/admin.server", () => ({ adminDb: async () => ({}) }));

// tiny in-memory database: products, product_nodes, extension_inbox_items
function fakeDb() {
  const t: Record<string, Record<string, unknown>[]> = {
    products: [],
    product_nodes: [],
    extension_inbox_items: [],
  };
  let calls = 0;
  let serial = 0;
  const from = (table: string) => {
    let op = "select";
    let rows: Record<string, unknown>[] = [];
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    let opts: Record<string, unknown> = {};
    const b = {
      select: () => b,
      in: (k: string, v: unknown[]) => {
        filters.push((r) => v.includes(r[k]));
        return b;
      },
      eq: (k: string, v: unknown) => {
        filters.push((r) => r[k] === v);
        return b;
      },
      neq: (k: string, v: unknown) => {
        filters.push((r) => r[k] !== v);
        return b;
      },
      insert: (v: Record<string, unknown>[]) => {
        op = "insert";
        rows = v;
        return b;
      },
      upsert: (v: Record<string, unknown>[], o: Record<string, unknown>) => {
        op = "upsert";
        rows = v;
        opts = o;
        return b;
      },
      delete: () => {
        op = "delete";
        return b;
      },
      then: (res: (v: unknown) => unknown) => {
        calls++;
        return Promise.resolve(run()).then(res);
      },
    };
    function run() {
      const all = t[table]!;
      if (op === "select")
        return { data: all.filter((r) => filters.every((f) => f(r))), error: null };
      if (op === "delete") {
        t[table] = all.filter((r) => !filters.every((f) => f(r)));
        return { error: null };
      }
      if (op === "insert") {
        const made = rows.map((r) => ({
          id: `p${serial++}`,
          created_at: new Date(Date.now() + serial).toISOString(),
          name_edited_by_hand: false,
          ...r,
        }));
        all.push(...made);
        return { data: made, error: null };
      }
      for (const r of rows) {
        const keys = String(opts.onConflict).split(",");
        const old = all.find((x) => keys.every((k) => x[k] === r[k]));
        if (old) {
          if (!opts.ignoreDuplicates) Object.assign(old, r);
        } else all.push({ ...r });
      }
      return { error: null };
    }
    return b;
  };
  return {
    db: { from, storage: { from: () => ({ remove: async () => ({}) }) } },
    t,
    calls: () => calls,
  };
}

const item = (i: number, extra: Partial<BulkItem> = {}): BulkItem =>
  ({
    key: `k${i}`,
    name: `Product ${i}`,
    brand: "LG",
    model: `M-${i}`,
    sourceUrl: `https://lg.com/p/${i}`,
    images: [`https://lg.com/i/${i}-a.jpg`, `https://lg.com/i/${i}-b.jpg`],
    specs: [],
    specGroups: [],
    category: "",
    price: 999,
    ...extra,
  }) as unknown as BulkItem;

describe("fast extension import", () => {
  it("creates 20 products in a few database calls, never with a price", async () => {
    const { importBulkChunkFast } = await import("../src/lib/bulk-import.server");
    const f = fakeDb();
    const res = await importBulkChunkFast(
      f.db as never,
      Array.from({ length: 20 }, (_, i) => item(i)),
      "node1",
    );
    expect(res.filter((r) => r.outcome === "created")).toHaveLength(20);
    expect(f.calls()).toBeLessThanOrEqual(10);
    expect(
      f.t.products.every(
        (p) => p.price === 0 && p.stock === 0 && p.availability === "out_of_stock",
      ),
    ).toBe(true);
    expect(f.t.products[3]!.gallery).toEqual([
      "https://lg.com/i/3-a.jpg",
      "https://lg.com/i/3-b.jpg",
    ]);
    expect(f.t.product_nodes).toHaveLength(20);
  });

  it("re-sending replaces the same product, keeps price and a hand-edited name, removes extra copies", async () => {
    const { importBulkChunkFast } = await import("../src/lib/bulk-import.server");
    const f = fakeDb();
    await importBulkChunkFast(f.db as never, [item(1)], "node1");
    const p = f.t.products[0]!;
    Object.assign(p, { price: 5000, stock: 3, name: "Nom du magasin", name_edited_by_hand: true });
    f.t.products.push({
      id: "dup",
      brand: "lg",
      model: "m-1",
      source_url: "https://other/1",
      created_at: "2999-01-01",
      name: "copy",
    });
    const res = await importBulkChunkFast(f.db as never, [item(1, { name: "New name" })], "node2");
    expect(res[0]!.outcome).toBe("updated");
    expect(f.t.products).toHaveLength(1);
    expect(f.t.products[0]).toMatchObject({
      id: p.id,
      price: 5000,
      stock: 3,
      name: "Nom du magasin",
      node_id: "node2",
    });
    expect(f.t.product_nodes).toEqual([{ product_id: p.id, node_id: "node2" }]);
  });

  it("refuses products without a name or a section", async () => {
    const { importBulkChunkFast } = await import("../src/lib/bulk-import.server");
    const f = fakeDb();
    const res = await importBulkChunkFast(f.db as never, [item(1, { name: "" }), item(2)], null);
    expect(res.map((r) => r.outcome)).toEqual(["problem", "problem"]);
  });
});
