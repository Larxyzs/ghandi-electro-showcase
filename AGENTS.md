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
- Bulk product import logic lives only in `src/lib/bulk-import.server.ts` (`importBulkBatch`); UI and any future API endpoint must call it, never duplicate it — one place guarantees identical duplicate checks and image copying.
- Shop contact details (phone, WhatsApp, hours, address) come only from `src/lib/company.ts` — prevents mismatched numbers across pages.
- Products can live in any catalog level (`canHoldProducts` is always true); category pages list the whole subtree — the menu tree is two levels deep.
