# Ghandi Product Grabber — read me first

## What is this?

It is a little helper that lives inside Chrome (your internet browser).

You give it the link of a product on a brand website (like Whirlpool).
It opens the page by itself, looks at it, and writes down:

1. the **first photo** (the main one)
2. **all the other photos** of the slideshow
3. the **name** of the product
4. the **price**
5. the **whole "Caractéristiques" table** (every line: label + value)

Then you press **Copy**, go to your website, press **Paste**. Done.

It does **not** send your data anywhere. It only reads the brand pages and keeps
the result inside your Chrome.

---

## Part 1 — Put it in Chrome (do this only once)

You need the folder called **`chrome-extension`** on your computer.
(It is the folder that contains `manifest.json`, `app.html`, `recipes.js`…)

1. Open **Chrome**.
2. Click the address bar at the top. Type `chrome://extensions` and press **Enter**.
3. At the top right, find the switch called **Developer mode**. Click it so it turns **blue/on**.
4. Three new buttons appear on the left. Click **Load unpacked**.
5. A window opens. Find the **`chrome-extension`** folder. Click it once, then click **Select Folder**.
6. A new card called **Ghandi Product Grabber** appears. 🎉 It is installed.
7. Click the small **puzzle piece** 🧩 at the top right of Chrome, find **Ghandi Product Grabber**, and click the **pin** 📌 next to it.
   Now its blue **G** icon always stays at the top of Chrome.

> If you ever change a file inside the folder (for example to add a brand), go back to
> `chrome://extensions` and click the little **round arrow** ⟳ on the card. That wakes up the new version.

---

## Part 2 — Use it

1. Click the blue **G** icon. A page opens.
2. **Paste your links** in the big box. One link per line.
   (Example: `https://www.whirlpool.ma/...`) You can paste 10, or 200.
3. Click **Get the data**.
4. Small windows open and close by themselves. That is the extension visiting the pages.
   **Do not close this page.** Do not minimize the small windows.
   You can do something else on another Chrome window or another program.
5. Each product gets a card:
   - **Ready** (green) = it worked. You see the photo, the name, the price, how many photos and spec lines it found.
   - Yellow note "Heads up" = it worked, but something was missing (for example, no price on that page). Check it.
   - **Problem** (red) = it did not work. Click **Try again**.
6. Click **Copy the NEW ones**.
   (NEW = the ones you did not copy before. So you can do 50 now, 50 later, and never copy the same product twice.)
7. Go to your website → **Admin → Import en masse** (see Part 4), paste, and import.

Buttons you might like:
- **Show details** — shows exactly what was found for that product.
- **Copy this one** — copies just that product.
- **Download as a file** — saves everything in a file, in case copying does not work.
- **Speed** — "Careful" opens 1 page at a time, "Fast" opens 3. Fast is quicker, but if a website gets grumpy, use Careful.
- If you close the page by accident, **your results are still there** when you open it again.

---

## Part 3 — If something looks wrong

- **"This website has no recipe yet"** — the extension only knows the brands listed on the page
  ("Brands this extension knows"). To add one, read `HOW-TO-ADD-A-BRAND.md`.
- **A yellow "Heads up" about the specifications or pictures** — the brand page is built a bit differently
  than expected. Click **Copy problem report** on that card and paste it in the chat with Claude.
  The report tells Claude exactly how that page is built, so the recipe can be fixed in one minute.
- **Everything is red** — check your internet. Open one of the links in Chrome by hand. If the website shows a
  "Are you a robot?" test, the website is blocking automatic visits. Tell Claude.
- **Nothing happens when you click the G icon** — go to `chrome://extensions`, find the card, check that its switch is on, and click ⟳.

---

## Part 4 — Getting the data into your website

Your admin page needs a new tab called **Import en masse**. The text to give to Lovable is in
**`LOVABLE-PROMPT.md`**. Copy it, paste it in Lovable's chat, and Lovable builds the tab
(and removes Cindy, like you asked).

After that:

1. In the admin, open **Import en masse**.
2. Pick the **folder** where the products should go (for example *Réfrigérateurs → Whirlpool*).
3. **Paste** what you copied from the extension.
4. Click **Analyser**, check the little table, click **Importer**.

Tip: do one folder per batch. All the Whirlpool fridges first, then all the Whirlpool washing machines, and so on.

---

## What is in the folder?

| File | What it does (in kid words) |
| --- | --- |
| `manifest.json` | The ID card of the extension. Chrome reads it first. |
| `background.js` | Opens the control page when you click the G icon. |
| `app.html`, `app.css`, `app.js` | The control page you see and click. |
| `extractor.js` | The "eyes". It waits for the page, scrolls, opens hidden tables, reads everything. |
| `recipes.js` | The "recipes". One per brand. **This is the file you edit to add a brand.** |
| `icons/` | The little blue G pictures. |
| `HOW-TO-ADD-A-BRAND.md` | How to add a new brand. |
| `LOVABLE-PROMPT.md` | The message to paste into Lovable. |
