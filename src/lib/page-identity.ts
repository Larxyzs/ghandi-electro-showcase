/**
 * Product identity survival check — pure, deterministic, no AI.
 *
 * A browser-rendered fallback, a redirect or a localisation switch can quietly
 * land on ANOTHER product page. Before anything is extracted we verify that the
 * page we finally read is still the page the admin asked for.
 */

import { alnum } from "./product-gallery";

export type IdentityCheck = {
  ok: boolean;
  /** Model code read from the requested URL, when it carries one. */
  urlModel: string;
  reason: string;
};

/** A model-looking token inside a URL slug ("…/rb34t672eww-ef/", "…/WW90T534DAW"). */
export function modelFromUrlPath(url: string): string {
  let path = url;
  try {
    const parsed = new URL(url);
    path = `${parsed.pathname}`;
  } catch {
    /* keep the raw value */
  }
  const tokens = decodeURIComponent(path)
    .split(/[/?#&=_.]+/)
    .flatMap((part) => part.split("-"))
    .map((token) => token.trim())
    .filter(Boolean);
  // The longest token that mixes letters and digits is the model reference.
  let best = "";
  for (const token of tokens) {
    const value = alnum(token);
    if (value.length < 5) continue;
    if (!/\d/.test(value) || !/[A-Z]/.test(value)) continue;
    if (value.length > best.length) best = value;
  }
  return best;
}

/** Canonical URL declared by the page itself, if any. */
export function canonicalFromHtml(html: string, baseUrl: string): string {
  const match =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
  if (!match) return "";
  try {
    return new URL((match[1] ?? "").trim(), baseUrl).toString();
  } catch {
    return "";
  }
}

const related = (a: string, b: string) =>
  a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));

/**
 * True when the retrieved page is still the requested product.
 *
 * A page is rejected when the requested URL clearly names a model and that
 * model appears neither in the extracted identity, nor in the page text, nor in
 * the page's own canonical URL — i.e. we ended up on a different product.
 */
export function checkPageIdentity(input: {
  requestedUrl: string;
  finalUrl?: string;
  html?: string;
  pageText?: string;
  identity?: { model?: string; name?: string };
}): IdentityCheck {
  const urlModel = modelFromUrlPath(input.requestedUrl);
  if (!urlModel) {
    return { ok: true, urlModel: "", reason: "l'URL ne contient pas de référence à vérifier" };
  }

  const html = input.html ?? "";
  const canonical = html ? canonicalFromHtml(html, input.finalUrl || input.requestedUrl) : "";
  const identityModel = alnum(input.identity?.model ?? "");
  const identityName = alnum(input.identity?.name ?? "");
  const textHay = alnum((input.pageText ?? "").slice(0, 200_000));
  const finalHay = alnum(decodeURIComponent(input.finalUrl ?? ""));
  const canonicalHay = alnum(decodeURIComponent(canonical));

  if (related(identityModel, urlModel)) return { ok: true, urlModel, reason: "" };
  if (identityName.includes(urlModel)) return { ok: true, urlModel, reason: "" };
  if (textHay.includes(urlModel)) return { ok: true, urlModel, reason: "" };
  if (finalHay.includes(urlModel)) return { ok: true, urlModel, reason: "" };
  if (canonicalHay.includes(urlModel)) return { ok: true, urlModel, reason: "" };

  const landed = identityModel || modelFromUrlPath(canonical || input.finalUrl || "") || "?";
  return {
    ok: false,
    urlModel,
    reason: `WRONG_PRODUCT: l'URL demandée désigne ${urlModel} mais la page lue correspond à ${landed}`,
  };
}
