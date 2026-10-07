// =====================================================================
//  CONTROL PAGE  —  the screen you click on.
//
//  For every link you paste, it:
//   1. opens the page in a small helper window,
//   2. waits for it to load,
//   3. runs extractor.js inside the page (that reads the data),
//   4. saves the result and closes nothing until the whole run is over.
//
//  Results are saved in the browser, so closing this tab will not lose them.
// =====================================================================

const STORAGE_KEY = "ghandi_items";
const EXPORT_FORMAT = "ghandi-import-v1";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @type {{id:string,url:string,status:'queued'|'working'|'done'|'error',result?:any,error?:string,copied?:boolean,rev:number}[]} */
let items = [];
let running = false;
let stopRequested = false;
let helperWindows = [];
const expanded = new Set();

/* ------------------------------ saving ------------------------------ */

let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ [STORAGE_KEY]: items });
  }, 250);
}

async function loadItems() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  items = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  for (const item of items) {
    if (item.status === "working") item.status = "queued"; // interrupted last time
    item.rev = (item.rev || 0) + 1;
  }
}

function touch(item) {
  item.rev = (item.rev || 0) + 1;
  saveSoon();
  scheduleRender();
}

/* ------------------------------ helpers ------------------------------ */

function recipeForUrl(url) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch (e) {
    return null;
  }
  return (
    (globalThis.GHANDI_RECIPES || []).find((r) =>
      (r.domains || []).some((d) => host === d || host.endsWith("." + d)),
    ) || null
  );
}

function parseLinks(text) {
  const found = String(text || "").match(/https?:\/\/[^\s"'<>,]+/gi) || [];
  const seen = new Set();
  const out = [];
  for (const raw of found) {
    const url = raw.replace(/[).;]+$/, "").split("#")[0];
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

function exportProduct(r) {
  return {
    brand: r.brand,
    name: r.name,
    reference: r.reference,
    price: r.price,
    currency: r.currency,
    image_main: r.image_main,
    images_other: r.images_other,
    specifications: r.specifications,
    source_url: r.source_url,
  };
}

function buildExport(list) {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      exported_at: new Date().toISOString(),
      count: list.length,
      products: list.map((item) => exportProduct(item.result)),
    },
    null,
    2,
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/* ------------------------------ helper windows ------------------------------ */

async function ensureHelperTab(worker, index) {
  if (worker.tabId) {
    try {
      await chrome.tabs.get(worker.tabId);
      return worker.tabId;
    } catch (e) {
      worker.tabId = null;
    }
  }
  const win = await chrome.windows.create({
    url: "about:blank",
    type: "popup",
    width: 560,
    height: 680,
    left: 30 + index * 70,
    top: 30 + index * 70,
    focused: false,
  });
  worker.windowId = win.id;
  worker.tabId = win.tabs && win.tabs[0] ? win.tabs[0].id : null;
  if (!worker.tabId) throw new Error("Could not open a helper window.");
  return worker.tabId;
}

async function closeHelperWindows() {
  for (const worker of helperWindows) {
    if (worker.windowId) {
      try {
        await chrome.windows.remove(worker.windowId);
      } catch (e) {
        /* already closed */
      }
    }
  }
  helperWindows = [];
}

function openPage(tabId, url, timeoutMs) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (value) => {
      if (finished) return;
      finished = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve(value);
    };
    const listener = (id, info, tab) => {
      if (id === tabId && info.status === "complete" && tab.url && tab.url !== "about:blank") finish(tab);
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(async () => {
      try {
        finish(await chrome.tabs.get(tabId));
      } catch (e) {
        finish(null);
      }
    }, timeoutMs);
    chrome.tabs.update(tabId, { url }).catch(() => finish(null));
  });
}

/* ------------------------------ one product ------------------------------ */

async function scrapeOnce(worker, index, url) {
  const tabId = await ensureHelperTab(worker, index);
  const tab = await openPage(tabId, url, 45000);
  if (!tab) throw new Error("Could not open the page.");
  if (String(tab.url).startsWith("chrome-error://")) throw new Error("The page could not be reached (no internet, or the link is wrong).");

  await chrome.scripting.executeScript({ target: { tabId }, files: ["recipes.js", "extractor.js"] });
  const run = chrome.scripting.executeScript({
    target: { tabId },
    func: (options) => globalThis.__ghandiExtract(options),
    args: [{}],
  });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("The page took too long.")), 120000));
  const [injection] = await Promise.race([run, timeout]);
  const result = injection && injection.result;
  if (!result) throw new Error("The page gave no answer.");
  if (!result.ok) throw new Error(result.error || "Could not read the page.");
  if (!result.name && !result.image_main) {
    throw new Error("Nothing found on this page. Is it really a product page? (Or the site blocked us.)");
  }
  return result;
}

async function processItem(item, worker, index) {
  item.status = "working";
  item.error = "";
  touch(item);
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (stopRequested) break;
    try {
      item.result = await scrapeOnce(worker, index, item.url);
      item.status = "done";
      item.copied = false;
      touch(item);
      return;
    } catch (e) {
      lastError = e;
      await sleep(1500);
    }
  }
  if (stopRequested && !lastError) {
    item.status = "queued";
  } else {
    item.status = "error";
    item.error = lastError ? lastError.message || String(lastError) : "Stopped.";
  }
  touch(item);
}

/* ------------------------------ the run ------------------------------ */

async function runQueue() {
  if (running) return;
  running = true;
  stopRequested = false;
  const total = items.filter((i) => i.status === "queued").length;
  if (total === 0) {
    running = false;
    return;
  }
  updateControls();

  const workerCount = Math.min(Number($("workers").value) || 1, 4);
  helperWindows = Array.from({ length: workerCount }, () => ({ windowId: null, tabId: null }));

  await Promise.all(
    helperWindows.map(async (worker, index) => {
      while (!stopRequested) {
        const next = items.find((i) => i.status === "queued");
        if (!next) break;
        next.status = "working"; // claim it
        await processItem(next, worker, index);
        await sleep(600 + Math.random() * 900);
      }
    }),
  );

  await closeHelperWindows();
  running = false;
  stopRequested = false;
  updateControls();
  const left = items.filter((i) => i.status === "queued").length;
  const bad = items.filter((i) => i.status === "error").length;
  setStatus(
    left > 0
      ? `Stopped. ${left} link(s) are still waiting. Click "Get the data" to continue.`
      : bad > 0
        ? `Finished. ${bad} link(s) had a problem (see the red cards below).`
        : "Finished! Everything worked. Now click “Copy the NEW ones”.",
    bad > 0 || left > 0 ? "" : "ok",
  );
}

/* ------------------------------ screen ------------------------------ */

function setStatus(text, kind) {
  const el = $("status");
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

function updateControls() {
  $("go").disabled = running;
  $("stop").hidden = !running;
  $("workers").disabled = running;
  const done = items.filter((i) => i.status === "done").length;
  const bad = items.filter((i) => i.status === "error").length;
  const waiting = items.filter((i) => i.status === "queued" || i.status === "working").length;
  const fresh = items.filter((i) => i.status === "done" && !i.copied).length;
  $("count").textContent = items.length
    ? `${done} ready · ${fresh} not copied yet · ${waiting} waiting · ${bad} with a problem`
    : "Nothing yet.";
  $("copyNew").disabled = fresh === 0;
  $("copyAll").disabled = done === 0;
  $("download").disabled = done === 0;
  $("retry").hidden = bad === 0 || running;
  const bar = $("barWrap");
  bar.hidden = !running && waiting === 0;
  const finished = done + bad;
  $("bar").style.width = items.length ? Math.round((finished / items.length) * 100) + "%" : "0%";
}

let renderTimer = null;
function scheduleRender() {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    renderList();
  }, 120);
}

function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  for (const kid of kids.flat()) if (kid) node.append(kid);
  return node;
}

const STATUS_TEXT = { queued: "Waiting", working: "Working…", done: "Ready", error: "Problem" };

function buildCard(item) {
  const r = item.result;
  const thumb = el("div", { class: "thumb" });
  if (r && r.image_main) {
    thumb.style.backgroundImage = `url("${r.image_main}")`;
  } else {
    thumb.textContent = item.status === "error" ? "⚠️" : item.status === "working" ? "⏳" : "…";
  }

  const body = el("div", {});
  body.append(
    el(
      "h3",
      {},
      el("span", { class: "pill " + item.status, text: STATUS_TEXT[item.status] }),
      r && r.name ? r.name : item.url,
    ),
  );
  if (r) {
    const price = r.price !== null && r.price !== undefined ? `${r.price} ${r.currency || ""}`.trim() : "no price";
    body.append(
      el("div", {
        class: "meta",
        text: `${r.brand}${r.reference ? " · " + r.reference : ""} · ${price} · ${1 + (r.images_other || []).length} photo(s) · ${r.specifications.length} spec row(s)${item.copied ? " · copied ✔" : ""}`,
      }),
    );
  }
  body.append(el("div", { class: "url", text: item.url }));
  if (item.status === "error") body.append(el("div", { class: "err", text: item.error }));
  if (r && r.warnings && r.warnings.length) {
    body.append(el("div", { class: "warn", text: "Heads up: " + r.warnings.join(" ") }));
  }

  const actions = el("div", { class: "actions" });
  if (item.status === "done") {
    actions.append(
      el("button", {
        text: expanded.has(item.id) ? "Hide details" : "Show details",
        onclick: () => {
          if (expanded.has(item.id)) expanded.delete(item.id);
          else expanded.add(item.id);
          touch(item);
        },
      }),
      el("button", {
        text: "Copy this one",
        onclick: async () => {
          await copyText(buildExport([item]));
          item.copied = true;
          touch(item);
          flash("Copied 1 product.");
        },
      }),
    );
    if (r.debug) {
      actions.append(
        el("button", {
          text: "Copy problem report",
          title: "Send this to the person who fixes the recipe",
          onclick: async () => {
            await copyText(JSON.stringify({ url: item.url, warnings: r.warnings, debug: r.debug }, null, 2));
            flash("Report copied. Paste it in the chat with Claude.");
          },
        }),
      );
    }
  }
  if (item.status === "error") {
    actions.append(
      el("button", {
        text: "Try again",
        onclick: () => {
          item.status = "queued";
          touch(item);
          updateControls();
          void runQueue();
        },
      }),
    );
  }
  actions.append(
    el("button", {
      text: "Remove",
      onclick: () => {
        items = items.filter((i) => i.id !== item.id);
        saveSoon();
        const node = document.querySelector(`[data-id="${item.id}"]`);
        if (node) node.remove();
        updateControls();
      },
    }),
  );

  const card = el("article", { class: "item " + item.status, "data-id": item.id, "data-rev": String(item.rev) }, thumb, body, actions);
  if (r && expanded.has(item.id)) card.append(el("pre", { class: "json", text: JSON.stringify(exportProduct(r), null, 2) }));
  return card;
}

function renderList() {
  const list = $("list");
  const existing = new Map(Array.from(list.children).map((node) => [node.getAttribute("data-id"), node]));
  let previous = null;
  for (const item of items) {
    let node = existing.get(item.id);
    if (!node || node.getAttribute("data-rev") !== String(item.rev)) {
      const fresh = buildCard(item);
      if (node) node.replaceWith(fresh);
      node = fresh;
    }
    existing.delete(item.id);
    // keep order
    const wanted = previous ? previous.nextSibling : list.firstChild;
    if (node !== wanted) list.insertBefore(node, wanted);
    previous = node;
  }
  for (const stale of existing.values()) stale.remove();
  updateControls();
}

let flashTimer = null;
function flash(text) {
  const msg = $("copyMsg");
  msg.textContent = text;
  msg.className = "status ok";
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (msg.textContent = ""), 6000);
}

/* ------------------------------ buttons ------------------------------ */

function addLinks() {
  const urls = parseLinks($("links").value);
  if (urls.length === 0) return { added: 0, skipped: 0, unsupported: 0 };
  let added = 0;
  let skipped = 0;
  let unsupported = 0;
  for (const url of urls) {
    const existing = items.find((i) => i.url === url);
    if (existing) {
      if (existing.status === "error") {
        existing.status = "queued";
        touch(existing);
        added++;
      } else {
        skipped++;
      }
      continue;
    }
    const recipe = recipeForUrl(url);
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      url,
      status: recipe ? "queued" : "error",
      error: recipe ? "" : "This website has no recipe yet. See HOW-TO-ADD-A-BRAND.md.",
      rev: 1,
    };
    if (!recipe) unsupported++;
    else added++;
    items.push(item);
  }
  $("links").value = "";
  saveSoon();
  renderList();
  return { added, skipped, unsupported };
}

$("go").addEventListener("click", () => {
  const typed = $("links").value.trim();
  const { added, skipped, unsupported } = typed ? addLinks() : { added: 0, skipped: 0, unsupported: 0 };
  const waiting = items.filter((i) => i.status === "queued").length;
  if (waiting === 0) {
    setStatus(
      typed
        ? unsupported
          ? "These links are from a website with no recipe yet (see the red cards)."
          : "Those links were already done."
        : "Paste at least one link first (it must start with https://).",
      "bad",
    );
    return;
  }
  const bits = [`Working on ${waiting} link(s)…`];
  if (skipped) bits.push(`${skipped} already done were skipped.`);
  setStatus(bits.join(" "));
  void runQueue();
});

$("stop").addEventListener("click", () => {
  stopRequested = true;
  setStatus("Stopping after the pages that are open right now…");
});

$("copyNew").addEventListener("click", async () => {
  const list = items.filter((i) => i.status === "done" && !i.copied);
  if (!list.length) return;
  if (await copyText(buildExport(list))) {
    list.forEach((i) => {
      i.copied = true;
      touch(i);
    });
    flash(`Copied ${list.length} product(s). Now paste them in your website.`);
  } else {
    flash("Copy did not work. Try “Download as a file”.");
  }
});

$("copyAll").addEventListener("click", async () => {
  const list = items.filter((i) => i.status === "done");
  if (!list.length) return;
  if (await copyText(buildExport(list))) {
    list.forEach((i) => {
      i.copied = true;
      touch(i);
    });
    flash(`Copied ${list.length} product(s). Now paste them in your website.`);
  } else {
    flash("Copy did not work. Try “Download as a file”.");
  }
});

$("download").addEventListener("click", () => {
  const list = items.filter((i) => i.status === "done");
  if (!list.length) return;
  const blob = new Blob([buildExport(list)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ghandi-products-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  flash(`Downloaded ${list.length} product(s).`);
});

$("retry").addEventListener("click", () => {
  items.filter((i) => i.status === "error" && recipeForUrl(i.url)).forEach((i) => {
    i.status = "queued";
    touch(i);
  });
  void runQueue();
});

$("clearAll").addEventListener("click", () => {
  const fresh = items.filter((i) => i.status === "done" && !i.copied).length;
  const message = fresh
    ? `You have ${fresh} product(s) that you have NOT copied yet. Delete everything anyway?`
    : "Delete everything in the list below?";
  if (!confirm(message)) return;
  stopRequested = true;
  items = [];
  expanded.clear();
  saveSoon();
  renderList();
  setStatus("");
});

/* ------------------------------ start ------------------------------ */

(async function start() {
  const brands = (globalThis.GHANDI_RECIPES || []).map((r) => r.brand);
  $("brands").textContent = brands.length ? "Brands this extension knows: " + brands.join(", ") + "." : "";
  await loadItems();
  renderList();
  const waiting = items.filter((i) => i.status === "queued").length;
  if (waiting) setStatus(`${waiting} link(s) are waiting from last time. Click “Get the data” to continue.`);
})();
