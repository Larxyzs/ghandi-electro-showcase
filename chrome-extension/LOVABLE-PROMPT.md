# Prompt to paste into Lovable

Copy everything between the two lines `=====` and paste it in Lovable's chat.
(Do it in one go. It is written for Lovable, so it is technical. You don't need to understand it.)

=====

I want you to do TWO things in the admin: (A) add a bulk product import fed by pasted text, then (B) remove "Cindy AI" completely. Do A first and make sure it works, then B. Do not touch the public product pages, the database tables, or any existing product data.

## A. New admin tab "Import en masse" (replaces the Cindy tab)

In `src/components/admin/AdminDashboard.tsx`, replace the "cindy" tab (label "Cindy AI") by a new tab `bulk` labeled **"Import en masse"** (same position, icon `Upload` or `ListPlus` from lucide). Also replace the blue banner at the top of the inventory tab ("Ajouter un produit avec Cindy" / `admin.cindy.*` i18n keys) by a banner with the same style that says "Importer des produits en masse" and opens the new tab. Create `src/components/admin/BulkImportPanel.tsx`. UI text in French, same visual style as the other admin panels (rounded-3xl cards, `bg-brand` buttons, mobile friendly).

### What the panel does

1. **Destination folder** (required): a select listing every node where `canHoldProducts(node.level)` is true (from `data.nodes`, `src/lib/catalog-types.ts`), each shown as its full path with `pathOf()`, e.g. "Réfrigérateurs › Combinés › Whirlpool". All imported products go in this folder.
2. **Big textarea**: "Collez ici le texte copié depuis l'extension Ghandi Product Grabber".
3. Optional fields applied to the whole batch: **Stock** (number, default 0), and a switch **"Ignorer les références déjà dans le catalogue"** (default ON).
4. Button **"Analyser"** parses the text and shows a preview table (no saving yet): thumbnail of `image_main`, name, brand, reference, price, number of photos (1 + `images_other.length`), number of spec rows, a checkbox per row (checked by default), and a red/yellow badge for problems. Add "tout cocher / tout décocher" and a counter "X produits prêts".
5. Button **"Importer"** saves the checked rows ONE BY ONE (sequentially, never all at once), with a progress bar "12 / 87", a status icon per row (waiting / saving / OK / error with the real error message), and at the end a summary "85 importés, 2 ignorés, 0 erreurs". Failed rows stay in the table with a **"Réessayer les erreurs"** button. One failing product must never stop the others. Allow leaving the textarea untouched after import and a "Nouvel import" button to reset.

### The text format to parse (produced by my Chrome extension)

It is JSON text:

```json
{
  "format": "ghandi-import-v1",
  "exported_at": "2026-10-07T10:00:00.000Z",
  "count": 1,
  "products": [
    {
      "brand": "Whirlpool",
      "name": "Réfrigérateur combiné WBMF 706564 XNA",
      "reference": "WBMF 706564 XNA",
      "price": 12990,
      "currency": "MAD",
      "image_main": "https://www.whirlpool.ma/content/dam/whirlpool/product-images/x/shot-1.png",
      "images_other": ["https://www.whirlpool.ma/content/dam/whirlpool/product-images/x/shot-2.png"],
      "specifications": [
        { "label": "Type de raccord", "value": "Intégré" },
        { "label": "Hauteur", "value": "193.5 cm" }
      ],
      "source_url": "https://www.whirlpool.ma/ma-fr/produits/..."
    }
  ]
}
```

Parsing rules (be forgiving, the user is not a developer):
- Accept the full object above, OR a bare array of products, OR a single product object.
- Accept several pasted blocks one after the other (split top-level JSON values, merge their `products`).
- Trim strings. `price` may be a number, a numeric string, or `null`/missing (then price = null). `reference`, `images_other`, `specifications` may be missing (treat as "" / [] / []).
- Remove spec rows whose label or value is empty.
- Row errors (row cannot be imported): missing `name`. Row warnings (importable): no `image_main`, no price, no specifications, no reference, `image_main` not starting with `https://`.
- If the text is not valid JSON, show a clear French message with the position of the problem instead of crashing.
- Duplicates inside the pasted text (same `reference`, or same `source_url`) → keep the first, mark the others "doublon".
- With the "ignorer" switch ON: skip rows whose `reference` already exists in `data.products` (compare `serial_number` case-insensitively and ignoring spaces/dashes); show them as "déjà présent".

### How to save one product

Call the existing server function `adminSaveProduct` (src/lib/admin.functions.ts, via `useServerFn`), exactly like the old Cindy `importProduct` did in `src/routes/admin.tsx`, with:

```
node_id:        the chosen folder id
name:           product.name
brand:          product.brand
serial_number:  product.reference
stock:          the batch stock
price:          product.price (number or null)
characteristics: ""
specifications: product.specifications            // [{label, value}]
imageUrl:       product.image_main                // cover photo (https URL, stored as is)
gallery:        product.images_other              // the other slideshow photos, WITHOUT the cover (same as Cindy did: gallery = images minus cover)
marketing_sections: []
source_url:     product.source_url
source_name:    product.brand + " (site officiel)"
featured:       false
imageData: null, imageName: null, removeImage: false
```

After each successful save call `recordActionFn` with `action: "product_create"`, `entity: "product"`, label `Produit importé : <name>`, like the old Cindy import did, so the existing undo/history keeps working. After the whole batch, call the same refresh function the admin already uses so the inventory shows the new products.

Put the pure parsing/validation code in a separate file `src/lib/bulk-import.ts` (no React) and add a vitest file `tests/bulk-import.test.ts` covering: full object, bare array, two concatenated blocks, missing price, invalid JSON, duplicates.

Note: the photos stay as links to the brand's own server (that's how the product form already stores `imageUrl` / `gallery` URLs). Don't download or re-upload them.

## B. Remove Cindy AI completely

Once A works, remove Cindy everywhere:
- The admin tabs "Cindy AI" and "API Cindy" (`SearchApiPanel`) and everything they render; `src/components/admin/cindy/*`; `src/components/live/CindyDock.tsx` and its use in `src/components/SiteLayout.tsx` (the floating assistant on the public site).
- The "Vérifier avec Cindy" button and its call to `/api/admin/check-image` in `src/components/admin/ImagePicker.tsx` (keep the rest of ImagePicker working).
- The API routes `src/routes/api/admin/cindy.ts`, `cindy-agent.ts`, `check-image.ts`; the server functions and helpers used only by Cindy (`cindy*.server.ts`, `cindy-types.ts`, `ai-tool-loop.server.ts`, `ai-config.server.ts`, `manufacturer-*.ts`, `product-gallery*.ts`, `import-url.server.ts`, `product-extract.server.ts`, `page-fetch.server.ts`, and the Cindy session / research-memory / search-API-settings functions in `admin.functions.ts` and `admin.server.ts`) — but ONLY delete a file or function after checking that nothing else imports it. Keep `catalog-types.ts` helpers like `dedupeGallery`, and keep `saveProduct`, `recordAction`, `adminDb`.
- All `admin.cindy.*` and `admin.tab.cindy` / `admin.tab.api` i18n keys (5 languages), and obsolete tests in `tests/` that only test removed code (`ai-tool-loop.test.ts`, `import-pipeline.test.ts`, `page-fetch.test.ts`, `product-gallery.test.ts`).
- IMPORTANT, keep this feature: the **undo history** ("Historique") and the **site restore points** ("Points de restauration" / snapshots) currently live inside the Cindy workspace. Before deleting it, move them into a small new admin tab "Historique" (same functions: `listActions`, `undoAction`, `listSnapshots`, `createSnapshot`, `restoreSnapshot`). Do not lose them.
- Do NOT drop or alter any database table or migration (Cindy tables can stay unused), and do not delete any stored data.

When done, make sure `bun run build` passes, the admin opens, the inventory works, and the new "Import en masse" tab imports a test product from the JSON above (use a test folder, then delete the test product).

=====
