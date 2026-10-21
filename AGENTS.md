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
- Shop contact details (phone, WhatsApp, hours, address) come only from `src/lib/company.ts` — prevents mismatched numbers across pages.
- Products can live in any catalog level (`canHoldProducts` is always true); category pages list the whole subtree — the menu tree is two levels deep.
- Chrome extension endpoint is the TanStack server route `src/routes/api/public/ghandi-import.ts`; each push stores items in `extension_inbox_items` and immediately creates products via `importBulkBatch` in `refresh` mode (no admin review, no bell — owner's choice; known products are updated but keep their shop price); items with no matching section stay pending for the inbox page — keeps one import path.
- Extension keys are stored only as SHA-256 hashes in `extension_keys`; admin notifications poll (admin login is a cookie session, not database auth, so Realtime with RLS isn't usable).
