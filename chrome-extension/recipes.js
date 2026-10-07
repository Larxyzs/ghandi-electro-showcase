// =====================================================================
//  RECIPES  —  one recipe per brand website.
//
//  A recipe tells the extension WHERE to look on that brand's pages.
//  To add a brand: copy the "TEMPLATE" block at the bottom of this list,
//  paste it right below the last recipe (don't forget the comma!),
//  and change the words. Full guide: HOW-TO-ADD-A-BRAND.md
//
//  Each list of "selectors" is tried from top to bottom.
//  The first one that finds something wins.
//  If a recipe finds nothing, the extension still tries smart guesses.
// =====================================================================

globalThis.GHANDI_RECIPES = [
  // -------------------------------------------------------------------
  //  WHIRLPOOL
  // -------------------------------------------------------------------
  {
    brand: "Whirlpool",

    // Website addresses that belong to this brand (without "www.")
    domains: ["whirlpool.ma", "whirlpool.com", "whirlpool.fr"],

    // The page counts as "fully loaded" when ALL of these exist.
    waitFor: ["img[data-modal-id='product-carousel'], img[id^='product-info-image-']"],

    // Product name
    name: ["h1"],

    // Price (many Whirlpool pages show none — then it stays empty)
    price: [
      "[itemprop='price']",
      "[class*='product-price' i]",
      "[class*='price' i] [class*='current' i]",
      "[class*='price' i]",
    ],

    // Model reference (like "WBMF 706564 XNA")
    reference: [
      "[itemprop='sku']",
      "[class*='model-number' i]",
      "[class*='product-model' i]",
      "[class*='product-code' i]",
      "[class*='sku' i]",
    ],

    // The slideshow pictures
    images: {
      // Where the slideshow pictures are
      selectors: ["img[data-modal-id='product-carousel']", "img[id^='product-info-image-']"],
      // Which part of the <img> holds the big picture (best first)
      attributes: ["data-page-main-image", "data-image-desktop", "data-zoom-image", "data-src", "src"],
      // The picture address must contain one of these words
      mustContain: ["/content/dam/"],
      // ...and none of these
      mustNotContain: [],
      // Put the pictures in the order given by this attribute (leave "" for page order)
      sortBy: "data-view-index",
      // Arrow button of the slideshow, clicked to wake up hidden slides (optional)
      nextButton: [],
    },

    // The "Caractéristiques" table
    specs: {
      // Titles that mark the start of the table (accents and capitals don't matter)
      headings: ["caractéristiques", "spécifications", "fiche technique", "données techniques"],
      // Buttons to click if the table is hidden behind a tab or accordion (optional)
      openers: [
        "button[aria-controls*='specif' i]",
        "button[aria-controls*='caract' i]",
        "[role='tab'][id*='specif' i]",
        "[role='tab'][id*='caract' i]",
      ],
      // Advanced (optional): exact selectors for the rows.
      // rows: { row: "table.specs tr", label: "th", value: "td" },
    },
  },

  // -------------------------------------------------------------------
  //  TEMPLATE  —  copy everything from the "{" below to its "}," and
  //  paste it just above this comment. Then change the words.
  //  (This block is switched off: its domain is a fake one.)
  // -------------------------------------------------------------------
  /*
  {
    brand: "NameOfTheBrand",
    domains: ["brand-website.com"],
    waitFor: ["h1"],
    name: ["h1"],
    price: ["[class*='price' i]"],
    reference: ["[class*='sku' i]"],
    images: {
      selectors: [".gallery img", ".slider img"],
      attributes: ["data-zoom-image", "data-src", "src"],
      mustContain: [],
      mustNotContain: [],
      sortBy: "",
      nextButton: [],
    },
    specs: {
      headings: ["caractéristiques", "spécifications"],
      openers: [],
    },
  },
  */
];
