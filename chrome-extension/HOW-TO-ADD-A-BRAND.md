# How to add a new brand

Think of a **recipe** like a treasure map for ONE website.
It says: "the product name is *here*, the photos are *there*, the table is *over there*."

Every brand builds its website differently, so every brand needs its own map.
The maps all live in one file: **`recipes.js`**.

There are two ways. Pick the easy one.

---

## The easy way (recommended): ask Claude

Tell Claude (in the chat):

1. The brand name (for example "LG").
2. **Two or three product links** from that brand.

Claude writes the recipe, you paste it into `recipes.js`, click ⟳ in `chrome://extensions`, and test.
If the first try is not perfect, click **Copy problem report** on the card and paste it in the chat.
Claude fixes the recipe.

---

## The do-it-yourself way (7 steps)

### Step 1 — Open `recipes.js`
Open it with **Notepad** (Windows) or **TextEdit** (Mac).
Please do not use Word.

### Step 2 — Copy the template
At the bottom you see a block between `/*` and `*/`. That block is the **TEMPLATE** (switched off).
Copy everything from the `{` to the `},`.

### Step 3 — Paste it **above** the template comment
Paste your copy right after the `},` that closes the previous brand.

> ⚠️ Every brand block must end with a **comma** `,`. Forgetting a comma is the #1 mistake.

### Step 4 — Change the words

```js
{
  brand: "LG",                          // the name shown on the card
  domains: ["lg.com"],                  // the website address, without "www."
  waitFor: ["h1"],                      // "the page is ready when this exists"
  name: ["h1"],                         // where the product name is
  price: ["[class*='price' i]"],        // where the price is
  reference: ["[class*='sku' i]"],      // where the model reference is
  images: {
    selectors: [".gallery img"],        // where the slideshow photos are
    attributes: ["data-zoom-image", "src"], // which part of the photo holds the BIG picture
    mustContain: [],                    // optional: the photo address must contain this word
    mustNotContain: [],                 // optional: ...and must NOT contain these words
    sortBy: "",                         // optional: an attribute that gives the order
    nextButton: [],                     // optional: the slideshow's "next" arrow
  },
  specs: {
    headings: ["caractéristiques", "spécifications"], // the title above the table
    openers: [],                        // optional: button to click to open the table
  },
},
```

### Step 5 — How do I find the "selectors"?
A selector is just the address of a thing on the page.

1. Open a product page of that brand in Chrome.
2. **Right-click** on the product name → **Inspect**. A panel opens on the side, with the name highlighted.
3. Look at the highlighted line. It looks like `<h1 class="product-title">`.
   The selector for it is `h1.product-title` (the tag, a dot, then the class).
   If the thing has an `id` like `id="price"`, the selector is `#price`.
4. Do the same for a photo of the slideshow (right-click the photo → Inspect).
   Look at the line: it often has words like `src`, `data-src`, `data-zoom-image`. Those are the "attributes".
   Put the one that holds the **biggest** picture first.
5. To test a selector: in the panel, click the **Console** tab, type
   `document.querySelectorAll("YOUR SELECTOR").length` and press Enter.
   A number bigger than 0 means "found it".

> You do **not** have to be perfect. If a list finds nothing, the extension makes smart guesses
> (it looks for anything that looks like a gallery, a price, a "Caractéristiques" title).
> Yellow "Heads up" notes tell you when it had to guess.

### Step 6 — Save the file
Press **Ctrl+S** (Windows) or **Cmd+S** (Mac). Keep the name `recipes.js`.

### Step 7 — Wake up the extension
Go to `chrome://extensions`, find **Ghandi Product Grabber**, click the round arrow ⟳.
Then open the control page, paste one link from the new brand, and check the card.

---

## If you break something

If the extension says "no recipe" for **every** brand or does nothing, there is probably a typo in `recipes.js`
(a missing comma, a missing quote `"`, or a missing bracket).
Open `chrome://extensions`: if the card has a red **Errors** button, click it and send the message to Claude.
Or just undo your last change.

## What each word means

| Word | Meaning |
| --- | --- |
| `brand` | Name written on the card and sent to your website. |
| `domains` | Addresses of the brand's websites. The extension picks the recipe from the link you paste. |
| `waitFor` | The extension waits (up to 30 seconds) until these things exist on the page. This is how it waits for JavaScript. |
| `name`, `price`, `reference` | Lists of places to look. The first one that works wins. |
| `images.selectors` | Where the slideshow photos are. |
| `images.attributes` | Which part of each photo holds the big picture. |
| `images.mustContain` / `mustNotContain` | Filters, to throw away logos or banners. |
| `images.sortBy` | Order the photos by this attribute (for example `data-view-index`). |
| `images.nextButton` | Some slideshows only load a photo when you click "next". Give the arrow here and the extension clicks it for you. |
| `specs.headings` | The title above the table: "Caractéristiques", "Spécifications"… |
| `specs.openers` | Button to click when the table is hidden behind a tab or "+" sign. |
| `specs.rows` | Advanced: exact rows, for example `{ row: "table.specs tr", label: "th", value: "td" }`. |

## Brands waiting in line

Whirlpool ✅ first · then LG, Candy, TCL, Samsung, Haier, Bosch (one by one, with the help of Claude).
