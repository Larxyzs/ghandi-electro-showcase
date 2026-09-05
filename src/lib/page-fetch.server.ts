/**
 * Official page retrieval — deterministic, no AI, no search engine.
 *
 * One exact URL in, the real HTML of that exact URL out. Difficult
 * manufacturer sites (403 on plain requests, JavaScript-rendered galleries) go
 * through legitimate fallbacks: a second request with a different ordinary
 * browser profile, then a public page-reader that renders the page.
 *
 * Nothing here ever substitutes another source: when the page cannot be read,
 * the real failure is thrown so Cindy and the admin see it.
 */

export type FetchMethod = "direct" | "direct-alt" | "reader" | "reader-retry";

export type FetchedPage = {
  url: string;
  finalUrl: string;
  html: string;
  method: FetchMethod;
  status: number;
};

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FIREFOX_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0";

const TIMEOUT_MS = 25_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Plain HTML text, scripts/styles removed — used for evidence checking. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|dd|dt|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

async function attempt(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ ok: true; html: string; finalUrl: string; status: number } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, message: `HTTP ${res.status}` };
    }
    const html = await res.text();
    if (html.trim().length < 200) return { ok: false, status: res.status, message: "PAGE_EMPTY" };
    return { ok: true, html, finalUrl: res.url || url, status: res.status };
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : "NETWORK" };
  }
}

/** True when the HTML looks like a shell whose content is built by JavaScript. */
export function looksJavaScriptRendered(html: string): boolean {
  const text = htmlToText(html);
  if (text.length > 1500) return false;
  return /__NEXT_DATA__|id=["\']root["\']|id=["\']app["\']|window\.__NUXT__|ng-app|data-reactroot/i.test(html);
}

/**
 * True when the raw HTML is technically a 200 but has no usable product page in
 * it (almost no text, no images, no structured data): the browser-rendered
 * fallback must still run.
 */
export function looksIncompletePage(html: string): boolean {
  if (looksJavaScriptRendered(html)) return true;
  const text = htmlToText(html);
  if (text.length < 400) return true;
  const hasImages = /<img\b|og:image|application\/ld\+json/i.test(html);
  return !hasImages && text.length < 1200;
}

/**
 * Retrieves one exact official page. Order: ordinary request, ordinary request
 * with another browser profile, then a rendering page-reader for
 * JavaScript-heavy or 403 pages. No CAPTCHA, login or protection bypass.
 */
export async function fetchOfficialPage(
  url: string,
  options: { signal?: AbortSignal; allowReader?: boolean } = {},
): Promise<FetchedPage> {
  if (!/^https?:\/\//i.test(url)) throw new Error(`BAD_URL: ${url}`);
  const failures: string[] = [];

  const base = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
    "Upgrade-Insecure-Requests": "1",
  };

  /** Best imperfect HTML kept aside: used only if every fallback fails. */
  let fallbackHtml: { html: string; finalUrl: string; status: number; method: FetchMethod } | null = null;

  for (const [method, headers] of [
    ["direct", { ...base, "User-Agent": CHROME_UA }],
    ["direct-alt", { ...base, "User-Agent": FIREFOX_UA, "Accept-Language": "en-US,en;q=0.9,fr;q=0.7" }],
  ] as [FetchMethod, Record<string, string>][]) {
    for (let tries = 0; tries < 2; tries += 1) {
      const result = await attempt(url, headers, options.signal);
      if (result.ok) {
        // A 200 that is only a JavaScript shell, or has no readable product
        // content, is NOT accepted: the rendering fallback takes over.
        if (options.allowReader !== false && looksIncompletePage(result.html)) {
          fallbackHtml = { html: result.html, finalUrl: result.finalUrl, status: result.status, method };
          failures.push(`${method}: PAGE_INCOMPLETE (rendu JavaScript)`);
          break;
        }
        return { url, finalUrl: result.finalUrl, html: result.html, method, status: result.status };
      }
      failures.push(`${method}: ${result.message}`);
      // Retry only transient failures; a 403/404 will not change on retry.
      if (!(result.status === 0 || result.status === 429 || result.status >= 500)) break;
      await sleep(1200 * (tries + 1));
    }
    if (fallbackHtml) break;
  }

  if (options.allowReader !== false) {
    const key = (process.env["JINA_API_KEY"] ?? "").trim();
    // Two legitimate rendering attempts: normal render, then a slower render
    // that waits for the gallery to appear. No CAPTCHA, login or protection
    // bypass — only the public page, executed as a browser would.
    const variants: { method: FetchMethod; headers: Record<string, string> }[] = [
      {
        method: "reader",
        headers: { Accept: "text/html", "x-respond-with": "html", "x-timeout": "25" },
      },
      {
        method: "reader-retry",
        headers: {
          Accept: "text/html",
          "x-respond-with": "html",
          "x-timeout": "45",
          "x-no-cache": "true",
          "x-wait-for-selector": "img",
          "x-target-selector": "body",
          "x-set-cookie": "",
        },
      },
    ];
    for (const variant of variants) {
      const headers = { ...variant.headers };
      if (key) headers["Authorization"] = `Bearer ${key}`;
      if (!headers["x-set-cookie"]) delete headers["x-set-cookie"];
      const reader = await attempt(`https://r.jina.ai/${url}`, headers, options.signal);
      if (reader.ok && !looksIncompletePage(reader.html)) {
        return { url, finalUrl: url, html: reader.html, method: variant.method, status: reader.status };
      }
      failures.push(`${variant.method}: ${reader.ok ? "PAGE_INCOMPLETE" : reader.message}`);
    }
  }

  // Every legitimate attempt failed. If a plain request did return some HTML we
  // hand it back (marked with its method) rather than losing the page entirely.
  if (fallbackHtml && htmlToText(fallbackHtml.html).length >= 400) {
    return {
      url,
      finalUrl: fallbackHtml.finalUrl,
      html: fallbackHtml.html,
      method: fallbackHtml.method,
      status: fallbackHtml.status,
    };
  }

  throw new Error(`OFFICIAL_PAGE_INACCESSIBLE: ${url} — ${failures.join(" | ")}`);
}
