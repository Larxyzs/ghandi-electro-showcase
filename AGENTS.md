<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- The existing sitemap route reads all catalog IDs through paginated public queries and fails on query errors; omit lastmod without authoritative page-specific timestamps — prevents incomplete or misleading search discovery.
- Bulk product import logic lives only in `src/lib/bulk-import.server.ts` (`importBulkBatch`); UI and any future API endpoint must call it, never duplicate it — one place guarantees identical duplicate checks and image copying.
- Bulk imports use bounded parallel workers with shared-identity and folder-creation locks; photo workers stay within the per-invocation outbound budget — speeds independent products without racing duplicates or folder creation.
- Contact details and hours come only from `src/lib/company.ts` (`COMPANY` defaults merged with admin settings `site_settings.content.store` via `resolveCompany`/`useCompany`) — prevents mismatched information across pages.
- Products can live in any catalog level (`canHoldProducts` is always true); category pages list the whole subtree — menus show univers → famille → sous-famille and hide categories with no products (or `show_in_menu` off) for visitors via `visibleChildren`.
- Chrome extension endpoint is the TanStack server route `src/routes/api/public/ghandi-import.ts`; each push stores items in `extension_inbox_items` and immediately creates products via `importBulkBatch` in `replace` mode (no admin review, no bell — owner's choice; a product already on the site is replaced by the new version in the new section, other copies are purged; the shop price stays only when the new one has none); items with no matching section stay pending for the inbox page — keeps one import path.
- Extension keys are stored only as SHA-256 hashes in `extension_keys`; admin notifications poll (admin login is a cookie session, not database auth, so Realtime with RLS isn't usable).
- Deleting products (one product, a folder, a replaced duplicate) always goes through `purgeProducts` in `src/lib/product-purge.server.ts` — rows, section links, uploaded photos and extension inbox rows are removed for good; never delete from `products` directly.
- Renamed or moved categories keep their old URLs: a database trigger records old paths in `catalog_redirects`; `/produits/$` answers 301 from it and the extension push resolves old section names through it — never delete those rows casually.
- Listing pages (category, search, brand) share `ProductBrowser`, whose filters, sort, page and grid/list live in the URL search params — shared links and the back button keep working.
- Public visitor writes (newsletter, contact form, order tracking) are rate-limited through `allowAction` in `src/lib/rate-limit.server.ts` (hashed IP buckets in `rate_limits`).
- Editable site texts, banners, shortcuts, services and store info live in `site_settings.content` (type `SiteContent`); the site never invents legal or service text — empty fields stay hidden.
