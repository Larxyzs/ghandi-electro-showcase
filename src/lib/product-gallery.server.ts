/**
 * Server entry point of the authoritative gallery pipeline.
 *
 * It only loads the manufacturer's verified extraction rules from the registry
 * and hands them to the pure `extractProductGallery()`. Nothing else may
 * produce a saved gallery.
 */
import { extractProductGallery, type GalleryIdentity, type GalleryResult } from "./product-gallery";

export async function resolveProductGallery(
  html: string,
  baseUrl: string,
  identity: GalleryIdentity = {},
): Promise<GalleryResult> {
  const { rulesForOfficialUrl } = await import("./manufacturer-rules.server");
  let rules = null;
  try {
    rules = await rulesForOfficialUrl(baseUrl);
  } catch {
    /* no registry access ⇒ review, never a guessed gallery */
  }
  return extractProductGallery(html, baseUrl, identity, rules);
}
