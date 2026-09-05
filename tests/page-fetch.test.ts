import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOfficialPage, looksIncompletePage, looksJavaScriptRendered } from "../src/lib/page-fetch.server";
import { checkPageIdentity, modelFromUrlPath } from "../src/lib/page-identity";

const URL_OK = "https://www.samsung.com/n_africa/refrigerators/rb34t672eww-ef/";

const fullPage = (model: string) =>
  `<html><head><link rel="canonical" href="https://www.samsung.com/n_africa/refrigerators/${model.toLowerCase()}-ef/"></head>
  <body><h1>${model}</h1><div class="pd-gallery"><img src="https://images.samsung.com/${model}_001.jpg"></div>
  <p>${"Réfrigérateur combiné No Frost avec compartiment fraîcheur. ".repeat(30)}</p></body></html>`;

const jsShell = `<html><body><div id="root"></div><script src="/app.js"></script></body></html>`;

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: unknown, init: unknown) =>
    handler(String(input), (init ?? {}) as RequestInit),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe("official page retrieval", () => {
  it("returns a normal 200 page directly, without any fallback", async () => {
    const spy = mockFetch(() => new Response(fullPage("RB34T672EWW"), { status: 200 }));
    const page = await fetchOfficialPage(URL_OK);
    expect(page.method).toBe("direct");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(page.html).toContain("RB34T672EWW");
  });

  it("falls back to the rendered reader on a 403, keeping the exact URL", async () => {
    const seen: string[] = [];
    mockFetch((url) => {
      seen.push(url);
      if (url.startsWith("https://r.jina.ai/")) {
        return new Response(fullPage("RB34T672EWW"), { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    });
    const page = await fetchOfficialPage(URL_OK);
    expect(page.method).toBe("reader");
    expect(page.url).toBe(URL_OK);
    expect(seen.some((u) => u === `https://r.jina.ai/${URL_OK}`)).toBe(true);
    // never a search engine or retailer substitute
    expect(seen.some((u) => /google|serper|bing|jumia|amazon/i.test(u))).toBe(false);
  });

  it("does not accept a JavaScript shell as the product page", async () => {
    mockFetch((url) =>
      url.startsWith("https://r.jina.ai/")
        ? new Response(fullPage("RB34T672EWW"), { status: 200 })
        : new Response(jsShell, { status: 200 }),
    );
    const page = await fetchOfficialPage(URL_OK);
    expect(page.method).toBe("reader");
    expect(page.html).toContain("pd-gallery");
  });

  it("retries the rendered request once when the first render is still empty", async () => {
    let renders = 0;
    mockFetch((url) => {
      if (url.startsWith("https://r.jina.ai/")) {
        renders += 1;
        return renders === 1
          ? new Response(jsShell, { status: 200 })
          : new Response(fullPage("RB34T672EWW"), { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    });
    const page = await fetchOfficialPage(URL_OK);
    expect(page.method).toBe("reader-retry");
    expect(renders).toBe(2);
  });

  it("fails with OFFICIAL_PAGE_INACCESSIBLE and keeps the exact URL attached", async () => {
    mockFetch(() => new Response("Forbidden", { status: 403 }));
    await expect(fetchOfficialPage(URL_OK)).rejects.toThrow(/OFFICIAL_PAGE_INACCESSIBLE/);
    await expect(fetchOfficialPage(URL_OK)).rejects.toThrow(URL_OK);
  });

  it("flags incomplete raw HTML", () => {
    expect(looksJavaScriptRendered(jsShell)).toBe(true);
    expect(looksIncompletePage("<html><body><p>Chargement…</p></body></html>")).toBe(true);
    expect(looksIncompletePage(fullPage("RB34T672EWW"))).toBe(false);
  });
});

describe("product identity survives fallbacks", () => {
  it("reads the model reference out of the requested URL", () => {
    expect(modelFromUrlPath(URL_OK)).toBe("RB34T672EWW");
    expect(modelFromUrlPath("https://www.lg.com/fr/lave-linge/lg-f4wv910p2/")).toBe("F4WV910P2");
  });

  it("accepts a page that really is the requested product", () => {
    const check = checkPageIdentity({
      requestedUrl: URL_OK,
      finalUrl: URL_OK,
      html: fullPage("RB34T672EWW"),
      pageText: "Réfrigérateur RB34T672EWW/EF",
      identity: { model: "RB34T672EWW" },
    });
    expect(check.ok).toBe(true);
  });

  it("rejects a redirect that lands on another model", () => {
    const check = checkPageIdentity({
      requestedUrl: URL_OK,
      finalUrl: "https://www.samsung.com/n_africa/refrigerators/rt38k5530s8-mr/",
      html: fullPage("RT38K5530S8"),
      pageText: "Réfrigérateur RT38K5530S8 Top Mount",
      identity: { model: "RT38K5530S8" },
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("WRONG_PRODUCT");
    expect(check.urlModel).toBe("RB34T672EWW");
  });
});
