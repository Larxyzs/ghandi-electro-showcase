/* Page mock-ups rebuilt from the real site's components (src/components/SiteLayout.tsx, src/routes/index.tsx,
   src/routes/magasin.tsx, ProductCard, CatalogTile) with the same colours, font, texts and layout. */
(function (G) {
  const { icon } = M;
  const { logoMark, appliance, showroom, waIcon } = ART;

  const PHONE = "+212 661 194 525";
  const ADDRESS = "41 Boulevard Ghandi, Casablanca-Settat, Maroc";
  const SHIPPING = "Livraison gratuite à Casablanca, Mohammedia et Dar Bouazza";

  // Univers named after the site's own wording: "Froid, lavage, cuisson, TV et climatisation".
  const UNIVERS = [
    { name: "Froid", icon: "refrigerator", kids: ["Réfrigérateurs", "Congélateurs", "Réfrigérateurs combinés"] },
    { name: "Lavage", icon: "washing-machine", kids: ["Machines à laver", "Sèche-linge", "Lave-vaisselle"] },
    { name: "Cuisson", icon: "flame", kids: ["Cuisinières", "Fours", "Micro-ondes", "Hottes"] },
    { name: "TV", icon: "tv", kids: ["Téléviseurs", "Barres de son"] },
    { name: "Climatisation", icon: "air-vent", kids: ["Climatiseurs", "Ventilateurs"] },
  ];
  const BRANDS = ["Samsung", "LG", "Bosch", "Whirlpool", "Haier", "TCL", "Candy", "Franke"];

  function topBar(mobile = false) {
    if (mobile) {
      return `<div class="s-topbar m"><p>Paiement à la livraison · ${SHIPPING}</p></div>`;
    }
    return `<div class="s-topbar"><div class="s-shell s-row s-between">
      <p>${SHIPPING} · Paiement à la livraison</p>
      <nav><span>Notre magasin</span><span>Suivi de commande</span><span>Besoin d'aide ?</span><b>${icon("phone", 13, 2)} ${PHONE}</b></nav>
    </div></div>`;
  }

  function header() {
    return `<header class="s-header"><div class="s-shell s-head-grid">
      <div class="s-row s-gap10">${logoMark(44)}<span class="s-brandname">Ghandi Home Electro</span></div>
      <div class="s-search"><span class="s-ph">Rechercher un produit, une marque, une référence…</span><i>${icon("search", 18, 2.2)}</i></div>
      <div class="s-row s-icons">
        <span class="s-ico">${icon("map-pin", 20, 1.8)}<small>Notre magasin</small></span>
        <span class="s-ico">${icon("heart", 20, 1.8)}<small>Favoris</small></span>
        <span class="s-ico s-cart">${icon("shopping-cart", 20, 1.8)}<small>Panier</small><em class="s-badge">0</em></span>
        <span class="s-wa">${waIcon(16)} WhatsApp</span>
      </div>
    </div></header>`;
  }

  function universBar() {
    return `<nav class="s-nav"><div class="s-shell s-row">
      <span class="s-allbtn">${icon("menu", 16, 2.2)} Tous nos rayons</span>
      ${UNIVERS.map((u) => `<span class="s-navlink">${u.name}</span>`).join("")}
      <span class="s-navlink">Marques ${icon("chevron-down", 14, 2)}</span>
    </div></nav>`;
  }

  function megaMenu() {
    return `<div class="s-mega"><div class="s-shell s-row s-top s-gap32">
      <ul class="s-mega-list"><span class="s-mega-hl"></span>${UNIVERS.map(
        (u) => `<li>${icon(u.icon, 20, 1.8)}<span>${u.name}</span>${icon("chevron-right", 16, 2)}</li>`,
      ).join("")}</ul>
      <div class="s-mega-cols">${UNIVERS.slice(0, 4)
        .map(
          (u) => `<div><b>${u.kids[0]}</b><ul>${u.kids
            .slice(1)
            .concat(["Voir tout"])
            .map((k) => `<li>${k}</li>`)
            .join("")}</ul></div>`,
        )
        .join("")}</div>
    </div></div>`;
  }

  function hero(title = "Votre magasin d'électroménager à Casablanca", cta = "Voir le catalogue") {
    return `<div class="s-hero">${showroom()}<div class="s-hero-shade"></div>
      <div class="s-hero-txt"><h2>${title}</h2><span class="s-btn">${cta} ${icon("arrow-right", 16, 2.2)}</span></div>
      <div class="s-dots"><i class="on"></i><i></i><i></i></div></div>`;
  }

  function tile(u) {
    return `<div class="s-tile"><div class="s-tile-ic">${icon(u.icon, 40, 1.4)}</div><p>${u.name}</p></div>`;
  }

  function desktopHome() {
    return `<div class="site s-desktop">${topBar()}${header()}${universBar()}
      <div class="s-shell s-pt16">${hero()}</div>
      <section class="s-shell s-sec"><h2>Nos univers</h2><div class="s-tiles">${UNIVERS.map(tile).join("")}${tile({ name: "Micro-ondes", icon: "microwave" })}</div></section>
      <section class="s-shell s-sec"><h2>Nos marques</h2><div class="s-brands">${BRANDS.map((b) => `<span>${b}</span>`).join("")}</div></section>
      ${megaMenu()}
    </div>`;
  }

  /* Product cards use generic product types (no invented models or prices: "Prix sur demande" is the site's own label). */
  const CARDS = [
    { k: "fridge", b: "Samsung", n: "Réfrigérateur combiné" },
    { k: "sbs", b: "LG", n: "Réfrigérateur side by side" },
    { k: "fridge", b: "Bosch", n: "Réfrigérateur combiné" },
    { k: "sbs", b: "Haier", n: "Réfrigérateur multi-portes" },
    { k: "fridge", b: "Whirlpool", n: "Réfrigérateur combiné" },
    { k: "fridge", b: "Candy", n: "Réfrigérateur double porte" },
    { k: "sbs", b: "Samsung", n: "Réfrigérateur side by side" },
    { k: "fridge", b: "LG", n: "Réfrigérateur combiné" },
  ];
  function productCard(c) {
    return `<div class="s-card"><div class="s-card-img">${appliance(c.k)}</div><span class="s-fav">${icon("heart", 15, 2)}</span>
      <p class="s-card-brand">${c.b}</p><h3>${c.n}</h3><p class="s-card-price">Prix sur demande</p>
      <span class="s-card-btn">${icon("shopping-cart", 13, 2.2)} Ajouter au panier</span></div>`;
  }
  function catalogPage() {
    return `<div class="site s-desktop">${topBar()}${header()}${universBar()}
      <div class="s-shell s-pt16"><p class="s-crumbs">Accueil › <b>Froid</b></p><h1 class="s-h1">Froid</h1></div>
      <div class="s-shell s-catalog">
        <aside class="s-filters"><b>Marque</b>${BRANDS.slice(0, 6)
          .map((b, i) => `<label><i class="${i === 0 ? "on" : ""}"></i>${b}</label>`)
          .join("")}<b>Disponibilité</b><label><i></i>En stock</label><label><i></i>Disponible sur demande</label></aside>
        <div><div class="s-toolbar"><span>Trier : <b>Pertinence</b> ${icon("chevron-down", 14, 2)}</span><span class="s-view">${icon("menu", 16, 2)}</span></div>
          <div class="s-grid">${CARDS.map(productCard).join("")}</div></div>
      </div></div>`;
  }

  function miniMap() {
    return `<div class="s-minimap"><svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMid slice">
      <rect width="600" height="520" fill="#eef3f9"/>
      ${Array.from({ length: 6 }, (_, i) => `<path d="M-20 ${40 + i * 90} C 200 ${20 + i * 90}, 400 ${70 + i * 90}, 620 ${50 + i * 90}" stroke="#fff" stroke-width="12" fill="none"/>`).join("")}
      ${Array.from({ length: 7 }, (_, i) => `<path d="M${30 + i * 95} -20 C ${50 + i * 95} 200, ${10 + i * 95} 340, ${40 + i * 95} 540" stroke="#fff" stroke-width="10" fill="none"/>`).join("")}
      <path d="M260 -20 C 290 160, 300 260, 330 540" stroke="#1266e8" stroke-width="14" fill="none"/>
      <path d="M0 0 H230 C 180 60, 120 90, 0 120 Z" fill="#cfe2fb"/>
      <g transform="translate(276 196)"><path d="M24 62 C24 62 46 36 46 22 A22 22 0 0 0 2 22 C2 36 24 62 24 62Z" fill="#1266e8" stroke="#fff" stroke-width="3"/><circle cx="24" cy="22" r="8" fill="#fff"/></g>
    </svg></div>`;
  }
  const HOURS = [
    ["Lundi", "09h00 – 13h00 · 15h00 – 20h00"],
    ["Mardi", "09h00 – 13h00 · 15h00 – 20h00"],
    ["Mercredi", "09h00 – 13h00 · 15h00 – 20h00"],
    ["Jeudi", "09h00 – 13h00 · 15h00 – 20h00"],
    ["Vendredi", "09h00 – 13h00 · 15h00 – 20h00"],
    ["Samedi", "09h00 – 13h00 · 15h00 – 20h00"],
    ["Dimanche", "Fermé"],
  ];
  function storePage() {
    return `<div class="site s-desktop">${topBar()}${header()}${universBar()}
      <div class="s-shell s-pt16"><p class="s-crumbs">Accueil › <b>Notre magasin</b></p></div>
      <div class="s-shell s-store">
        <div class="s-panel s-p28">
          <h1 class="s-h1sm">Magasin Ghandi Home Electro – Casablanca</h1>
          <p class="s-line">${icon("map-pin", 16, 2)} ${ADDRESS}</p>
          <p class="s-line">${icon("phone", 16, 2)} ${PHONE}</p>
          <h2 class="s-h2sm">${icon("clock", 16, 2)} Horaires</h2>
          <table class="s-hours">${HOURS.map(([d, h]) => `<tr><td>${d}</td><td>${h}</td></tr>`).join("")}</table>
          <div class="s-row s-gap8 s-mt20"><span class="s-btn">${icon("navigation", 15, 2)} Itinéraire</span><span class="s-btn s-ghost">${icon("phone", 15, 2)} Appeler</span><span class="s-btn s-green">${waIcon(15)} WhatsApp</span></div>
        </div>
        ${miniMap()}
      </div></div>`;
  }

  /* ---------------- Phone (mobile layout) ---------------- */
  function mobileHome() {
    return `<div class="site s-mobile">
      <div class="m-status"><b>9:41</b><span>${icon("signal", 15, 2.4)}${icon("wifi", 15, 2.4)}${icon("battery-full", 20, 2)}</span></div>
      ${topBar(true)}
      <div class="m-header"><span class="m-burger">${icon("menu", 20, 2)}</span>${logoMark(40)}<span class="m-flex"></span>${icon("heart", 21, 1.8)}<span class="m-cart">${icon("shopping-cart", 21, 1.8)}</span></div>
      <div class="m-search"><span>Rechercher un produit, une marque…</span>${icon("search", 17, 2.2)}</div>
      <div class="m-body">
        <div class="m-hero">${showroom()}<div class="s-hero-shade"></div>
          <div class="m-hero-txt"><h2>Votre magasin d'électroménager à Casablanca</h2><span class="s-btn">Voir le catalogue ${icon("arrow-right", 14, 2.2)}</span></div>
          <div class="s-dots"><i class="on"></i><i></i><i></i></div></div>
        <h3 class="m-h">Nos univers</h3>
        <div class="m-tiles">${UNIVERS.map(tile).join("")}</div>
        <h3 class="m-h">Nos marques</h3>
        <div class="m-brands">${BRANDS.map((b) => `<span>${b}</span>`).join("")}</div>
        <div class="m-store s-panel"><b>Notre magasin</b><p>${icon("map-pin", 15, 2)} ${ADDRESS}</p><p>${icon("clock", 15, 2)} <b>Lundi – Samedi</b> : 9h00 – 13h00 · 15h00 – 20h00</p></div>
      </div>
    </div>`;
  }

  G.SITE = { UNIVERS, BRANDS, PHONE, ADDRESS, SHIPPING, desktopHome, catalogPage, storePage, mobileHome, hero, tile, productCard, megaMenu };
})(window);
