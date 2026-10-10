import { useEffect, useState } from "react";

/** Small browser-saved id lists (favourites, recently viewed). */
function makeStore(key: string, max: number) {
  const read = (): string[] => {
    try {
      const v = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  const write = (ids: string[]) => {
    window.localStorage.setItem(key, JSON.stringify(ids.slice(0, max)));
    window.dispatchEvent(new Event(key));
  };
  const useIds = () => {
    const [ids, setIds] = useState<string[]>([]);
    useEffect(() => {
      const sync = () => setIds(read());
      sync();
      window.addEventListener(key, sync);
      window.addEventListener("storage", sync);
      return () => {
        window.removeEventListener(key, sync);
        window.removeEventListener("storage", sync);
      };
    }, []);
    return ids;
  };
  return { read, write, useIds };
}

const fav = makeStore("ghe-favorites", 200);
const recent = makeStore("ghe-recent", 12);

export const useFavorites = fav.useIds;
export function toggleFavorite(id: string) {
  const ids = fav.read();
  fav.write(ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids]);
}

export const useRecent = recent.useIds;
export function pushRecent(id: string) {
  recent.write([id, ...recent.read().filter((x) => x !== id)]);
}
