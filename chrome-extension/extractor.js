// =====================================================================
//  EXTRACTOR  —  runs INSIDE the brand's product page.
//
//  1. It waits until the page has really finished loading
//     (JavaScript pages build themselves after the first load).
//  2. It scrolls down, so "lazy" pictures and tables wake up.
//  3. It opens the "Caractéristiques" section if it is hidden.
//  4. It reads: name, price, reference, pictures, specifications.
//
//  You normally never need to edit this file. Brand-specific words live
//  in recipes.js.
// =====================================================================

globalThis.__ghandiExtract = async function ghandiExtract(options) {
  const opts = options || {};
  const warnings = [];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ------------------------------ tiny helpers ------------------------------ */

  const clean = (value) =>
    String(value || "")
      .replace(/[  ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const textOf = (el) => {
    if (!el) return "";
    return clean(el.innerText) || clean(el.textContent);
  };

  const fold = (value) =>
    clean(value)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const qsa = (selector, root) => {
    try {
      return Array.from((root || document).querySelectorAll(selector));
    } catch (e) {
      return [];
    }
  };

  const absoluteUrl = (raw) => {
    try {
      const url = new URL(String(raw).trim().replace(/&amp;/g, "&"), location.href).toString();
      return /^https?:\/\//i.test(url) ? url : "";
    } catch (e) {
      return "";
    }
  };

  const hostMatches = (host, domain) => host === domain || host.endsWith("." + domain);

  const recipe = (globalThis.GHANDI_RECIPES || []).find((r) => {
    const host = location.hostname.replace(/^www\./, "").toLowerCase();
    return (r.domains || []).some((d) => hostMatches(host, d.toLowerCase().replace(/^www\./, "")));
  });

  if (!recipe) {
    return { ok: false, error: "No recipe for this website yet (" + location.hostname + ")." };
  }

  const R = {
    waitFor: recipe.waitFor || [],
    name: recipe.name || [],
    price: recipe.price || [],
    reference: recipe.reference || [],
    images: Object.assign(
      { selectors: [], attributes: ["src"], mustContain: [], mustNotContain: [], sortBy: "", nextButton: [] },
      recipe.images || {},
    ),
    specs: Object.assign({ headings: [], openers: [], rows: null }, recipe.specs || {}),
  };

  const SPEC_WORDS = Array.from(
    new Set(
      ["caracteristiques", "specifications", "fiche technique", "donnees techniques", "specs"]
        .concat((R.specs.headings || []).map(fold))
        .filter(Boolean),
    ),
  );

  /* ------------------------------ waiting logic ------------------------------ */

  /** Waits until the page stops changing (no new elements for `quietMs`). */
  function settle(quietMs, maxMs) {
    return new Promise((resolve) => {
      let timer = setTimeout(done, quietMs);
      const limit = setTimeout(done, maxMs);
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(done, quietMs);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      function done() {
        clearTimeout(timer);
        clearTimeout(limit);
        observer.disconnect();
        resolve();
      }
    });
  }

  async function waitForPage() {
    const deadline = Date.now() + 30000;
    const wanted = R.waitFor.length ? R.waitFor : ["h1"];
    while (Date.now() < deadline) {
      const loaded = document.readyState === "complete";
      const ready = wanted.every((sel) => qsa(sel).length > 0);
      if (loaded && ready) return true;
      await sleep(400);
    }
    return false;
  }

  /** Scrolls the whole page slowly so lazy-loaded pictures and tables appear. */
  async function autoScroll() {
    const start = window.scrollY;
    let guard = 0;
    while (guard++ < 60) {
      const before = window.scrollY;
      window.scrollBy(0, Math.max(300, Math.floor(window.innerHeight * 0.8)));
      await sleep(220);
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom || window.scrollY === before) break;
    }
    window.scrollTo(0, start);
    await sleep(150);
  }

  /* ------------------------------ JSON-LD (backup source) ------------------------------ */

  function readJsonLd() {
    const found = [];
    for (const script of qsa("script[type='application/ld+json']")) {
      try {
        const data = JSON.parse(script.textContent || "null");
        const stack = Array.isArray(data) ? data.slice() : [data];
        while (stack.length) {
          const node = stack.pop();
          if (!node || typeof node !== "object") continue;
          if (Array.isArray(node["@graph"])) stack.push(...node["@graph"]);
          const type = [].concat(node["@type"] || []).join(",");
          if (/product/i.test(type)) found.push(node);
        }
      } catch (e) {
        /* ignore broken JSON-LD */
      }
    }
    return found[0] || null;
  }

  /* ------------------------------ PRICE ------------------------------ */

  function parsePrice(text) {
    const source = clean(text);
    const match = source.match(/\d{1,3}(?:[ .,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/);
    if (!match) return null;
    let digits = match[0].replace(/ /g, "");
    const lastDot = digits.lastIndexOf(".");
    const lastComma = digits.lastIndexOf(",");
    if (lastDot >= 0 && lastComma >= 0) {
      // "1.299,50" or "1,299.50": the LAST symbol is the decimal point
      const decimal = lastDot > lastComma ? "." : ",";
      const thousands = decimal === "." ? "," : ".";
      digits = digits.split(thousands).join("").replace(decimal, ".");
    } else if (lastDot >= 0 || lastComma >= 0) {
      const sep = lastDot >= 0 ? "." : ",";
      const parts = digits.split(sep);
      const groupedThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
      digits = groupedThousands ? parts.join("") : parts.join(".");
    }
    const value = Number(digits);
    if (!Number.isFinite(value)) return null;
    let currency = "";
    if (/\b(dh|dhs|mad)\b|درهم/i.test(source)) currency = "MAD";
    else if (/€|eur/i.test(source)) currency = "EUR";
    else if (/\$|usd/i.test(source)) currency = "USD";
    return { value, currency, raw: source };
  }

  function findPrice(jsonLd) {
    for (const selector of R.price) {
      for (const el of qsa(selector)) {
        if (el.closest("header, nav, footer")) continue;
        const attr = el.getAttribute("content") || el.getAttribute("data-price") || "";
        const parsed = parsePrice(attr || textOf(el));
        if (parsed && parsed.value > 0) return parsed;
      }
    }
    const offers = jsonLd && [].concat(jsonLd.offers || [])[0];
    if (offers && (offers.price || offers.lowPrice)) {
      const parsed = parsePrice(String(offers.price || offers.lowPrice));
      if (parsed && parsed.value > 0) {
        parsed.currency = offers.priceCurrency === "MAD" || offers.priceCurrency === "EUR" ? offers.priceCurrency : offers.priceCurrency || "";
        return parsed;
      }
    }
    const meta = document.querySelector("meta[itemprop='price'], meta[property='product:price:amount'], meta[property='og:price:amount']");
    if (meta && meta.getAttribute("content")) {
      const parsed = parsePrice(meta.getAttribute("content"));
      if (parsed && parsed.value > 0) return parsed;
    }
    return null;
  }

  /* ------------------------------ PICTURES ------------------------------ */

  const GLOBAL_BAD_IMAGE = /(^data:)|\.svg(\?|$)|\.gif(\?|$)|(^|[-_/.])(logo|icon|sprite|placeholder|spacer|pixel|badge|avatar|flag|loader|spinner|favicon)([-_/.]|$)|1x1/i;
  const BAD_SECTION =
    /(related|recommend|recommand|you-?may|also-?like|cross-?sell|up-?sell|similar|compar|bundle|accessor|footer|header|navigation|menu|breadcrumb|review|newsletter|cookie|promo|banner)/i;

  /** Picks the biggest address out of a "srcset" list. */
  function biggestFromSrcset(srcset) {
    let best = "";
    let bestSize = -1;
    for (const part of String(srcset || "").split(",")) {
      const [url, size] = part.trim().split(/\s+/);
      if (!url) continue;
      const n = parseFloat(size || "0") || 0;
      if (n >= bestSize) {
        best = url;
        bestSize = n;
      }
    }
    return best;
  }

  function imageUrlFrom(el, attributes) {
    for (const attr of attributes) {
      let value = el.getAttribute(attr);
      if (!value) continue;
      if (/srcset/i.test(attr)) value = biggestFromSrcset(value);
      const url = absoluteUrl(value);
      if (url) return url;
    }
    const picture = el.closest("picture");
    if (picture) {
      const source = picture.querySelector("source[srcset]");
      if (source) {
        const url = absoluteUrl(biggestFromSrcset(source.getAttribute("srcset")));
        if (url) return url;
      }
    }
    if (el.currentSrc) return absoluteUrl(el.currentSrc);
    return "";
  }

  /** Same picture in different sizes/queries gets the same key. */
  function imageKey(url) {
    try {
      const u = new URL(url);
      let path = u.pathname.toLowerCase().replace(/\/jcr:content.*$/, "");
      path = path
        .replace(/[-_]\d{2,5}x\d{2,5}(?=\.|$)/g, "")
        .replace(/\/\d{2,5}x\d{2,5}\//g, "/")
        .replace(/\.(jpe?g|png|webp|avif)$/g, "");
      return u.hostname.replace(/^www\./, "") + path;
    } catch (e) {
      return url;
    }
  }

  function collectImages(elements, sortBy) {
    const entries = [];
    elements.forEach((el, index) => {
      if (el.closest(".slick-cloned, .swiper-slide-duplicate, .owl-item.cloned")) return;
      const url = imageUrlFrom(el, R.images.attributes.length ? R.images.attributes : ["src"]);
      if (!url || GLOBAL_BAD_IMAGE.test(url)) return;
      const must = R.images.mustContain || [];
      if (must.length && !must.some((word) => url.toLowerCase().includes(word.toLowerCase()))) return;
      const mustNot = R.images.mustNotContain || [];
      if (mustNot.some((word) => url.toLowerCase().includes(word.toLowerCase()))) return;
      let order = index;
      if (sortBy) {
        const n = parseFloat(el.getAttribute(sortBy) || "");
        order = Number.isFinite(n) ? n : 100000 + index;
      }
      entries.push({ url, order });
    });
    entries.sort((a, b) => a.order - b.order);
    const seen = new Set();
    const urls = [];
    for (const entry of entries) {
      const key = imageKey(entry.url);
      if (seen.has(key)) continue;
      seen.add(key);
      urls.push(entry.url);
    }
    return urls;
  }

  async function findImages(jsonLd) {
    // 1) the recipe's own selectors
    let elements = [];
    for (const selector of R.images.selectors) elements.push(...qsa(selector));
    elements = Array.from(new Set(elements));

    // wake up hidden slides by clicking the "next" arrow
    if (R.images.nextButton && R.images.nextButton.length) {
      for (const selector of R.images.nextButton) {
        const button = qsa(selector).find((b) => !b.disabled);
        if (!button) continue;
        for (let i = 0; i < 25; i++) {
          button.click();
          await sleep(250);
        }
        break;
      }
      elements = [];
      for (const selector of R.images.selectors) elements.push(...qsa(selector));
      elements = Array.from(new Set(elements));
    }

    let urls = collectImages(elements, R.images.sortBy);
    if (urls.length) return { urls, how: "recipe" };

    // 2) smart guess: pictures inside something that looks like a gallery / slideshow
    const galleryBoxes = qsa(
      "[class*='gallery' i], [id*='gallery' i], [class*='carousel' i], [id*='carousel' i], [class*='slider' i], [class*='swiper' i], [class*='slick' i], [class*='product-image' i], [class*='zoom' i]",
    ).filter((box) => !BAD_SECTION.test((box.className || "") + " " + (box.id || "")));
    const guess = [];
    for (const box of galleryBoxes) guess.push(...qsa("img, source", box));
    const guessImgs = Array.from(new Set(guess)).filter((el) => !el.closest("[class*='related' i], [class*='recommend' i], header, nav, footer"));
    const saved = R.images.attributes;
    R.images.attributes = ["data-zoom-image", "data-large", "data-full", "data-src", "data-lazy", "src", "srcset"];
    urls = collectImages(guessImgs, "");
    R.images.attributes = saved;
    if (urls.length) {
      warnings.push("Pictures were found by guessing (the recipe selectors found nothing). Please check them.");
      return { urls, how: "guess" };
    }

    // 3) last resort: the page's "share" picture
    const backup = [];
    if (jsonLd && jsonLd.image) backup.push(...[].concat(jsonLd.image).map((i) => (typeof i === "string" ? i : i && i.url)));
    const og = document.querySelector("meta[property='og:image']");
    if (og) backup.push(og.getAttribute("content"));
    const urlsBackup = backup.map(absoluteUrl).filter(Boolean);
    if (urlsBackup.length) {
      warnings.push("Only the page's share picture was found (no slideshow). Please check it.");
      return { urls: urlsBackup.slice(0, 1), how: "share-picture" };
    }
    return { urls: [], how: "none" };
  }

  /* ------------------------------ SPECIFICATIONS ------------------------------ */

  const goodPair = (label, value) =>
    label &&
    value &&
    label.length >= 2 &&
    label.length <= 90 &&
    value.length <= 400 &&
    fold(label) !== fold(value);

  const tidyLabel = (label) => clean(label).replace(/\s*[:：]\s*$/, "");

  function pairsFromTable(table) {
    const pairs = [];
    for (const row of Array.from(table.rows || [])) {
      const cells = Array.from(row.cells || []);
      if (cells.length < 2) continue;
      const label = tidyLabel(textOf(cells[0]));
      const value = clean(cells.slice(1).map(textOf).filter(Boolean).join(" "));
      if (goodPair(label, value)) pairs.push({ label, value });
    }
    return pairs;
  }

  function pairsFromDl(dl) {
    const pairs = [];
    let label = "";
    for (const child of Array.from(dl.querySelectorAll("dt, dd"))) {
      if (child.tagName === "DT") {
        label = tidyLabel(textOf(child));
      } else if (label) {
        const value = textOf(child);
        if (goodPair(label, value)) pairs.push({ label, value });
        label = "";
      }
    }
    return pairs;
  }

  /** Tables made of <div>s or <li>s: a repeated "label + value" shape. */
  function pairsFromRows(root) {
    const best = [];
    const containers = [root].concat(qsa("ul, ol, div, section, tbody, dl", root));
    for (const container of containers) {
      const kids = Array.from(container.children);
      if (kids.length < 3 || kids.length > 300) continue;
      const pairs = [];
      for (const kid of kids) {
        let node = kid;
        let guard = 0;
        while (node.children.length === 1 && guard++ < 4) node = node.children[0];
        const parts = Array.from(node.children).filter((c) => textOf(c));
        if (parts.length === 2) {
          const label = tidyLabel(textOf(parts[0]));
          const value = textOf(parts[1]);
          if (goodPair(label, value)) pairs.push({ label, value });
        } else if (parts.length === 0) {
          const text = textOf(node);
          const m = text.match(/^([^:：]{2,80})\s*[:：]\s*(.+)$/);
          if (m && goodPair(tidyLabel(m[1]), clean(m[2]))) pairs.push({ label: tidyLabel(m[1]), value: clean(m[2]) });
        }
      }
      if (pairs.length >= 3 && pairs.length >= kids.length * 0.6 && pairs.length > best.length) {
        best.length = 0;
        best.push(...pairs);
      }
    }
    return best;
  }

  function dedupePairs(pairs) {
    const seen = new Set();
    const out = [];
    for (const pair of pairs) {
      const key = fold(pair.label) + "|" + fold(pair.value);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pair);
    }
    return out;
  }

  /** All label/value pairs found inside one element. */
  function pairsIn(el) {
    if (!el) return [];
    let pairs = [];
    const tables = el.matches && el.matches("table") ? [el] : qsa("table", el);
    for (const table of tables) {
      if (table.parentElement && table.parentElement.closest("table") && table !== el) continue;
      pairs.push(...pairsFromTable(table));
    }
    const dls = el.matches && el.matches("dl") ? [el] : qsa("dl", el);
    for (const dl of dls) pairs.push(...pairsFromDl(dl));
    if (pairs.length < 2) pairs = pairs.concat(pairsFromRows(el));
    return dedupePairs(pairs);
  }

  function headingLevel(el) {
    const m = /^H([1-6])$/.exec(el.tagName);
    return m ? Number(m[1]) : 0;
  }

  /** Elements whose short text is "Caractéristiques", "Spécifications"… */
  function findSpecHeadings() {
    const all = qsa("h1, h2, h3, h4, h5, h6, button, summary, [role='tab'], [aria-expanded], a, div, span, p, li, strong, legend");
    const found = new Set();
    for (const el of all) {
      if (el.closest("header, nav, footer")) continue;
      const own = fold(textOf(el));
      if (!own || own.length > 45) continue;
      if (!SPEC_WORDS.some((w) => own === w || own.startsWith(w + " ") || own === w + ":")) continue;
      // <h2><span>Caractéristiques</span></h2>: use the h2 / button itself
      const semantic = el.closest("h1, h2, h3, h4, h5, h6, button, summary, [role='tab']");
      found.add(semantic && fold(textOf(semantic)) === own ? semantic : el);
    }
    // wrappers have the same text as what they wrap: keep the innermost only
    const list = Array.from(found);
    return list.filter((el) => !list.some((other) => other !== el && el.contains(other)));
  }

  /** Pairs that live "under" a given heading. */
  function specsUnderHeading(heading) {
    // tab / accordion linked by aria-controls
    const controls = heading.getAttribute && heading.getAttribute("aria-controls");
    if (controls) {
      for (const id of controls.split(/\s+/)) {
        const panel = document.getElementById(id);
        const pairs = pairsIn(panel);
        if (pairs.length >= 2) return pairs;
      }
    }
    const details = heading.closest && heading.closest("details");
    if (details) {
      const pairs = pairsIn(details);
      if (pairs.length >= 2) return pairs;
    }

    const level = headingLevel(heading) || 7;
    let current = heading;
    for (let depth = 0; depth < 6 && current && current !== document.body; depth++) {
      const scope = [];
      let sibling = current.nextElementSibling;
      while (sibling) {
        // A real heading (h1-h6) of the same or higher rank starts the NEXT section.
        if (level < 7) {
          const firstHeading = headingLevel(sibling) ? sibling : sibling.querySelector("h1, h2, h3, h4, h5, h6");
          if (firstHeading && headingLevel(firstHeading) <= level && !SPEC_WORDS.includes(fold(textOf(firstHeading)))) break;
        }
        scope.push(sibling);
        sibling = sibling.nextElementSibling;
      }
      let pairs = [];
      for (const part of scope) pairs.push(...pairsIn(part));
      pairs = dedupePairs(pairs);
      if (pairs.length >= 2) return pairs;
      current = current.parentElement;
    }
    return [];
  }

  function allSpecsGuess() {
    // No heading worked: take the biggest label/value block on the page.
    let best = [];
    const roots = qsa("table, dl").filter((el) => !el.closest("header, nav, footer, [class*='related' i], [class*='recommend' i]"));
    for (const root of roots) {
      const pairs = pairsIn(root);
      if (pairs.length > best.length) best = pairs;
    }
    if (best.length < 3) {
      const guess = pairsFromRows(document.body);
      if (guess.length > best.length) best = guess;
    }
    return best.length >= 3 ? best : [];
  }

  function extractSpecsOnce() {
    // exact rows from the recipe (advanced)
    if (R.specs.rows && R.specs.rows.row) {
      const pairs = [];
      for (const row of qsa(R.specs.rows.row)) {
        const label = tidyLabel(textOf(row.querySelector(R.specs.rows.label)));
        const value = textOf(row.querySelector(R.specs.rows.value));
        if (goodPair(label, value)) pairs.push({ label, value });
      }
      if (pairs.length) return { pairs: dedupePairs(pairs), how: "recipe-rows" };
    }
    for (const heading of findSpecHeadings()) {
      const pairs = specsUnderHeading(heading);
      if (pairs.length >= 2) return { pairs, how: "heading" };
    }
    return { pairs: [], how: "none" };
  }

  async function findSpecs() {
    let result = extractSpecsOnce();
    if (result.pairs.length >= 2) return result;

    // The table may be hidden: open details, tabs and accordions.
    for (const d of qsa("details:not([open])")) {
      if (SPEC_WORDS.some((w) => fold(textOf(d)).slice(0, 120).includes(w))) d.open = true;
    }
    const openers = [];
    for (const selector of R.specs.openers) openers.push(...qsa(selector));
    for (const heading of findSpecHeadings()) {
      const clickable = heading.closest("button, summary, [role='tab'], [aria-expanded]") || heading;
      openers.push(clickable);
    }
    const tried = new Set();
    for (const opener of openers) {
      if (tried.has(opener) || tried.size >= 8) continue;
      tried.add(opener);
      if (opener.tagName === "A" && opener.getAttribute("href") && !opener.getAttribute("href").startsWith("#")) continue;
      if (opener.getAttribute("aria-expanded") === "true" || opener.getAttribute("aria-selected") === "true") continue;
      try {
        opener.scrollIntoView({ block: "center" });
        opener.click();
      } catch (e) {
        continue;
      }
      await sleep(700);
      await settle(500, 3000);
      result = extractSpecsOnce();
      if (result.pairs.length >= 2) return Object.assign(result, { how: "heading (after click)" });
    }

    const guess = allSpecsGuess();
    if (guess.length) {
      warnings.push("The specifications table was found by guessing. Please check it.");
      return { pairs: guess, how: "guess" };
    }
    return { pairs: [], how: "none" };
  }

  /* ------------------------------ REFERENCE & NAME ------------------------------ */

  function findFirstText(selectors, skip) {
    for (const selector of selectors) {
      for (const el of qsa(selector)) {
        if (el.closest("header, nav, footer")) continue;
        const text = textOf(el);
        if (text && text.length < 200 && !(skip && skip.test(text))) return text;
      }
    }
    return "";
  }

  /* ------------------------------ debug report ------------------------------ */

  function buildDebug(imageInfo, specInfo) {
    const short = (s, n) => String(s || "").slice(0, n);
    const imgs = qsa("img")
      .filter((img) => (img.naturalWidth || img.width || 0) >= 150 || /content\/dam|product|gallery|carousel/i.test(img.src || ""))
      .slice(0, 25)
      .map((img) => ({
        id: img.id || undefined,
        class: short(img.className, 60) || undefined,
        attrs: img.getAttributeNames().filter((n) => n.startsWith("data-")).slice(0, 8),
        src: short(img.currentSrc || img.src, 140),
        inside: short(img.parentElement && img.parentElement.className, 60),
      }));
    return {
      page: location.href,
      title: document.title,
      h1: qsa("h1").map(textOf).slice(0, 3),
      readyState: document.readyState,
      imageMethod: imageInfo.how,
      specMethod: specInfo.how,
      specHeadings: findSpecHeadings()
        .slice(0, 6)
        .map((h) => ({ tag: h.tagName, class: short(h.className, 60), text: short(textOf(h), 40) })),
      tables: qsa("table")
        .slice(0, 6)
        .map((t) => ({ class: short(t.className, 60), rows: (t.rows || []).length, first: short(textOf(t.rows && t.rows[0]), 80) })),
      dlCount: qsa("dl").length,
      images: imgs,
    };
  }

  /* ============================== MAIN FLOW ============================== */

  const pageReady = await waitForPage();
  if (!pageReady) warnings.push("The page did not finish loading in 30 seconds. Some data may be missing.");
  await settle(700, 5000);
  await autoScroll();
  await settle(900, 6000);

  const jsonLd = readJsonLd();

  // ---- pictures
  const imageInfo = await findImages(jsonLd);
  const [imageMain, ...imagesOther] = imageInfo.urls;
  if (!imageMain) warnings.push("No picture found.");

  // ---- specifications
  const specInfo = await findSpecs();
  if (specInfo.pairs.length === 0) warnings.push("No specifications table found.");

  // ---- name
  let name = findFirstText(R.name);
  if (!name && jsonLd && jsonLd.name) name = clean(jsonLd.name);
  if (!name) {
    const og = document.querySelector("meta[property='og:title']");
    name = clean(og && og.getAttribute("content"));
  }
  if (!name) warnings.push("No product name found.");

  // ---- price
  const price = findPrice(jsonLd);
  if (!price) warnings.push("No price found on this page.");

  // ---- reference
  let reference = findFirstText(R.reference, /^(r[ée]f[ée]rence|mod[èe]le|model|sku|code)\s*:?\s*$/i);
  reference = clean(reference.replace(/^(r[ée]f[ée]rence|r[ée]f\.?|mod[èe]le|model|sku|code produit|code)\s*[:#-]?\s*/i, ""));
  if (!reference && jsonLd) reference = clean(jsonLd.sku || jsonLd.mpn || "");
  if (!reference) {
    const row = specInfo.pairs.find((p) => /^(r[ée]f[ée]rence|r[ée]f\.?|mod[èe]le|model|code produit|sku|num[ée]ro de mod[èe]le)/i.test(fold(p.label)) || /^(reference|modele|model|code produit|sku|numero de modele)/.test(fold(p.label)));
    if (row) reference = row.value;
  }
  if (!reference) warnings.push("No model reference found.");

  const result = {
    ok: true,
    brand: recipe.brand,
    name,
    reference,
    price: price ? price.value : null,
    currency: price ? price.currency || "" : "",
    price_text: price ? price.raw : "",
    image_main: imageMain || "",
    images_other: imagesOther,
    specifications: specInfo.pairs,
    source_url: location.href,
    warnings,
  };
  if (warnings.length || opts.debug) result.debug = buildDebug(imageInfo, specInfo);
  return result;
};
