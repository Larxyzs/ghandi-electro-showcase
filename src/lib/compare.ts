import { useEffect, useState } from "react";
import { toast } from "sonner";

const KEY = "ghe-compare";
export const COMPARE_MAX = 4;

function read(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}
function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(KEY));
}

/** Comparator (max 4 products), saved in the browser. */
export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(KEY, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(KEY, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => {
      const cur = read();
      if (cur.includes(id)) return write(cur.filter((x) => x !== id));
      if (cur.length >= COMPARE_MAX) {
        toast.error("4 produits maximum", { description: "Retirez un produit du comparateur pour en ajouter un autre." });
        return;
      }
      write([...cur, id]);
    },
    remove: (id: string) => write(read().filter((x) => x !== id)),
    clear: () => write([]),
  };
}
