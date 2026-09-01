import { useCallback, useSyncExternalStore } from "react";
import { translateContent, textHash } from "@/lib/translate.functions";
import { useI18n, type LangCode } from "@/lib/i18n";

/**
 * Translates database-driven text (category names, product names,
 * characteristics, specifications) into the visitor's language.
 *
 * - French is the source language, so `fr` is a pass-through.
 * - Results are memoised in memory + localStorage and, server-side, in the
 *   `content_translations` table, so a string is only ever translated once.
 * - While a translation is in flight the original French text is shown.
 */

const memory = new Map<string, string>(); // `${lang}\u0000${source}` -> translation
const requested = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let queue = new Map<LangCode, Set<string>>();
let timer: ReturnType<typeof setTimeout> | null = null;

const storageKey = (lang: LangCode) => `ghe-tr-${lang}`;
const loadedLangs = new Set<LangCode>();

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}

function hydrate(lang: LangCode) {
  if (loadedLangs.has(lang) || typeof window === "undefined") return;
  loadedLangs.add(lang);
  try {
    const raw = window.localStorage.getItem(storageKey(lang));
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [source, value] of Object.entries(parsed)) {
      memory.set(`${lang}\u0000${source}`, value);
      requested.add(`${lang}\u0000${source}`);
    }
  } catch {
    /* corrupted cache — ignore */
  }
}

function persist(lang: LangCode) {
  if (typeof window === "undefined") return;
  try {
    const prefix = `${lang}\u0000`;
    const out: Record<string, string> = {};
    let count = 0;
    for (const [key, value] of memory) {
      if (!key.startsWith(prefix)) continue;
      out[key.slice(prefix.length)] = value;
      count += 1;
      if (count > 2000) break;
    }
    window.localStorage.setItem(storageKey(lang), JSON.stringify(out));
  } catch {
    /* quota / private mode */
  }
}

async function flush() {
  timer = null;
  const batches = queue;
  queue = new Map();
  for (const [lang, texts] of batches) {
    const list = Array.from(texts);
    for (let i = 0; i < list.length; i += 60) {
      const chunk = list.slice(i, i + 60);
      try {
        const result = await translateContent({ data: { lang, texts: chunk } });
        for (const [source, value] of Object.entries(result.translations)) {
          memory.set(`${lang}\u0000${source}`, value);
        }
        persist(lang);
        notify();
      } catch {
        // allow a later retry for this chunk
        for (const text of chunk) requested.delete(`${lang}\u0000${text}`);
      }
    }
  }
}

function request(lang: LangCode, source: string) {
  const key = `${lang}\u0000${source}`;
  if (requested.has(key)) return;
  requested.add(key);
  const set = queue.get(lang) ?? new Set<string>();
  set.add(source);
  queue.set(lang, set);
  if (timer === null) timer = setTimeout(() => void flush(), 60);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Longest text we bother sending to the translator. */
const MAX_LENGTH = 1200;

/** Pure references / model numbers never need translating. */
function isTranslatable(value: string) {
  const text = value.trim();
  if (text.length < 2 || text.length > MAX_LENGTH) return false;
  return /[a-zA-ZÀ-ÿ\u0600-\u06FF]{3}/.test(text);
}

/**
 * Returns a translator for dynamic (database) strings.
 * Usage: `const tr = useDynamicText(); <p>{tr(product.name)}</p>`
 */
export function useDynamicText() {
  const { lang } = useI18n();
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  hydrate(lang);

  return useCallback(
    (value: string | null | undefined): string => {
      const source = (value ?? "").trim();
      if (!source || lang === "fr") return value ?? "";
      if (!isTranslatable(source)) return source;
      const hit = memory.get(`${lang}\u0000${source}`);
      if (hit) return hit;
      if (typeof window !== "undefined") request(lang, source);
      return source;
    },
    [lang],
  );
}

export { textHash };
