/* Vector artwork: Ghandi Home Electro logo, appliance illustrations, showroom, map, cursors.
   Everything is drawn in SVG so it stays sharp at any zoom. */
(function (G) {
  const BLUE = "#1266e8";
  const LOGO_BLUE = "#0875f6";

  /** Shared gradients — rendered once in an always-visible <svg> so every inline SVG can reference them. */
  const DEFS = `
  <linearGradient id="gBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient>
  <linearGradient id="gBodySide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f7f9fc"/><stop offset=".55" stop-color="#ffffff"/><stop offset="1" stop-color="#d9e1eb"/></linearGradient>
  <linearGradient id="gSteel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9c4d0"/><stop offset=".5" stop-color="#f4f7fa"/><stop offset="1" stop-color="#9eabba"/></linearGradient>
  <radialGradient id="gGlass" cx=".38" cy=".35" r=".75"><stop offset="0" stop-color="#3f6fb8"/><stop offset=".55" stop-color="#173a73"/><stop offset="1" stop-color="#0a1a38"/></radialGradient>
  <linearGradient id="gScreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f86ff"/><stop offset=".5" stop-color="#1150c4"/><stop offset="1" stop-color="#0b1f5c"/></linearGradient>
  <linearGradient id="gDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3442"/><stop offset="1" stop-color="#12171f"/></linearGradient>
  <radialGradient id="gShadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0b1a33" stop-opacity=".35"/><stop offset="1" stop-color="#0b1a33" stop-opacity="0"/></radialGradient>
  <linearGradient id="gWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1c40"/><stop offset=".75" stop-color="#123574"/><stop offset="1" stop-color="#0e2a5c"/></linearGradient>
  <linearGradient id="gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2753"/><stop offset="1" stop-color="#06142f"/></linearGradient>
  <linearGradient id="gCone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe2ff" stop-opacity=".28"/><stop offset="1" stop-color="#cfe2ff" stop-opacity="0"/></linearGradient>
  <linearGradient id="gReflect" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="mReflect" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#gReflect)"/></mask>
  <linearGradient id="gPin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b8bff"/><stop offset="1" stop-color="#0b57c4"/></linearGradient>
  <filter id="fGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="mbX" x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur id="mbXb" stdDeviation="0 0"/></filter>
  <filter id="mbY" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur id="mbYb" stdDeviation="0 0"/></filter>`;

  /* ---------------- Logo ---------------- */
  // House geometry (viewBox 0 0 240 220): apex (120,14), eaves (14,104)/(226,104), walls x=34/206, floor y=206.
  const HOUSE_LEFT = "M120 206 H58 Q34 206 34 182 V88 L120 14";
  const HOUSE_RIGHT = "M120 206 H182 Q206 206 206 182 V88 L120 14";
  const EAVE_LEFT = "M34 87 L14 104";
  const EAVE_RIGHT = "M206 87 L226 104";
  const CHIMNEY = "M170 56 V30 H184 V68";

  /** Full logo house. `ink` = outline colour, `fill` = appliance colour, `detail` = details on appliances. */
  function logoHouse({ ink = LOGO_BLUE, fill = LOGO_BLUE, detail = "#ffffff", hl = "#69a9ff", vent = "#3d4149", cls = "" } = {}) {
    return `<svg class="logo-house ${cls}" viewBox="0 0 240 220" fill="none">
      <g class="lh-outline" stroke="${ink}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
        <path class="lh-left" d="${HOUSE_LEFT}"/>
        <path class="lh-right" d="${HOUSE_RIGHT}"/>
        <path class="lh-eave lh-eave-l" d="${EAVE_LEFT}"/>
        <path class="lh-eave lh-eave-r" d="${EAVE_RIGHT}"/>
        <path class="lh-chimney" d="${CHIMNEY}"/>
      </g>
      <g class="lh-vent"><rect x="104" y="56" width="32" height="26" rx="3" fill="${vent}"/>
        <path d="M110 64 H130 M110 69 H130 M110 74 H130" stroke="${detail === "#ffffff" ? "#cfd5dd" : detail}" stroke-width="2.4" stroke-linecap="round"/></g>
      <g class="lh-fridge"><rect x="56" y="94" width="58" height="102" rx="6" fill="${fill}"/>
        <rect x="63" y="102" width="10" height="46" rx="3" fill="${hl}"/>
        <path d="M58 156 H112" stroke="${detail}" stroke-opacity=".55" stroke-width="2.5"/></g>
      <g class="lh-washer"><rect x="120" y="118" width="66" height="78" rx="6" fill="${fill}"/>
        <path d="M126 130 H146" stroke="${detail}" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>
        <circle cx="175" cy="130" r="3" fill="${detail}" fill-opacity=".7"/>
        <circle class="lh-door" cx="153" cy="165" r="19" stroke="${detail}" stroke-width="5"/>
        <g class="lh-drum" style="transform-origin:153px 165px"><circle cx="153" cy="165" r="10" fill="${hl}"/>
          <path d="M147 165 a6 6 0 0 1 6 -6" stroke="${detail}" stroke-width="2.5" stroke-linecap="round"/></g></g>
    </svg>`;
  }

  /** Small static logo for site headers. */
  function logoMark(size = 44, ink = LOGO_BLUE) {
    return `<span class="logo-mark" style="width:${size}px;height:${size}px">${logoHouse({ ink, fill: ink })}</span>`;
  }

  /** Wordmark lines: GHANDI / — HOME ELECTRO — */
  function wordmark(color = "#3a3f47", sub = LOGO_BLUE) {
    return `<div class="wm"><div class="wm-main" style="color:${color}">GHANDI</div>
      <div class="wm-sub" style="color:${sub}"><i style="background:${sub}"></i><span>HOME ELECTRO</span><i style="background:${sub}"></i></div></div>`;
  }

  /* ---------------- Appliances ---------------- */
  const shadow = (cx, cy, rx, ry = 7) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#gShadow)"/>`;

  const APPLIANCES = {
    fridge: {
      vb: "0 0 120 252",
      body: `${shadow(60, 245, 56)}
        <rect x="8" y="6" width="104" height="232" rx="12" fill="url(#gBodySide)" stroke="#c3cdd9" stroke-width="1.5"/>
        <path d="M9 150 H111" stroke="#b5c0ce" stroke-width="2.2"/>
        <rect x="92" y="40" width="7" height="72" rx="3.5" fill="url(#gSteel)"/>
        <rect x="92" y="162" width="7" height="44" rx="3.5" fill="url(#gSteel)"/>
        <rect x="22" y="34" width="32" height="17" rx="3" fill="#0f2547"/>
        <rect x="26" y="39" width="12" height="7" rx="1.5" fill="#5ea0ff"/><rect x="41" y="39" width="9" height="7" rx="1.5" fill="#2f6fd6"/>
        <rect x="15" y="14" width="9" height="216" rx="4.5" fill="#fff" opacity=".6"/>
        <rect x="16" y="237" width="12" height="7" rx="2" fill="#7e8b9b"/><rect x="92" y="237" width="12" height="7" rx="2" fill="#7e8b9b"/>`,
    },
    sbs: {
      vb: "0 0 190 252",
      body: `${shadow(95, 245, 90)}
        <rect x="6" y="6" width="178" height="232" rx="12" fill="url(#gBodySide)" stroke="#c3cdd9" stroke-width="1.5"/>
        <path d="M95 7 V237" stroke="#b5c0ce" stroke-width="2.2"/>
        <rect x="84" y="56" width="6" height="120" rx="3" fill="url(#gSteel)"/><rect x="100" y="56" width="6" height="120" rx="3" fill="url(#gSteel)"/>
        <rect x="24" y="48" width="44" height="64" rx="6" fill="url(#gDark)"/>
        <rect x="31" y="56" width="30" height="9" rx="2" fill="#5ea0ff"/><rect x="38" y="80" width="16" height="24" rx="3" fill="#0a0e14"/>
        <rect x="13" y="14" width="9" height="216" rx="4.5" fill="#fff" opacity=".6"/>
        <rect x="14" y="237" width="14" height="7" rx="2" fill="#7e8b9b"/><rect x="162" y="237" width="14" height="7" rx="2" fill="#7e8b9b"/>`,
    },
    washer: {
      vb: "0 0 140 168",
      body: `${shadow(70, 161, 66)}
        <rect x="6" y="4" width="128" height="152" rx="12" fill="url(#gBodySide)" stroke="#c3cdd9" stroke-width="1.5"/>
        <path d="M7 34 H133" stroke="#c6d0dc" stroke-width="2"/>
        <rect x="16" y="12" width="36" height="13" rx="3" fill="#0f2547"/><rect x="20" y="16" width="16" height="5" rx="1" fill="#5ea0ff"/>
        <circle cx="88" cy="19" r="3" fill="${BLUE}"/><circle cx="110" cy="19" r="8.5" fill="url(#gSteel)" stroke="#a9b5c3"/>
        <circle cx="70" cy="95" r="45" fill="url(#gSteel)"/>
        <circle cx="70" cy="95" r="36" fill="url(#gGlass)"/>
        <g class="drum" style="transform-origin:70px 95px"><rect x="66" y="62" width="8" height="10" rx="3" fill="#6f9be0" opacity=".7"/>
          <rect x="66" y="62" width="8" height="10" rx="3" fill="#6f9be0" opacity=".7" transform="rotate(120 70 95)"/>
          <rect x="66" y="62" width="8" height="10" rx="3" fill="#6f9be0" opacity=".7" transform="rotate(240 70 95)"/></g>
        <path d="M45 82 A28 28 0 0 1 76 66" stroke="#fff" stroke-opacity=".55" stroke-width="4" fill="none" stroke-linecap="round"/>`,
    },
    tv: {
      vb: "0 0 300 200",
      body: `${shadow(150, 194, 110, 6)}
        <rect x="4" y="4" width="292" height="168" rx="6" fill="#0d1117"/>
        <rect x="9" y="9" width="282" height="158" rx="3" fill="url(#gScreen)"/>
        <path d="M9 120 C70 90 120 140 180 110 S260 70 291 96 V167 H9Z" fill="#fff" opacity=".12"/>
        <path d="M9 140 C80 120 140 160 200 136 S270 110 291 124 V167 H9Z" fill="#fff" opacity=".1"/>
        <circle cx="222" cy="58" r="26" fill="#fff" opacity=".1"/>
        <path d="M128 172 L116 188 H184 L172 172Z" fill="#2b3442"/><rect x="92" y="186" width="116" height="6" rx="3" fill="#1d2430"/>`,
    },
    ac: {
      vb: "0 0 300 96",
      body: `<rect x="4" y="4" width="292" height="70" rx="24" fill="url(#gBody)" stroke="#c3cdd9" stroke-width="1.5"/>
        <path d="M22 58 H278" stroke="#c8d1dd" stroke-width="3" stroke-linecap="round"/>
        <path d="M30 66 H270" stroke="#d6dee8" stroke-width="2" stroke-linecap="round"/>
        <rect x="226" y="20" width="44" height="14" rx="4" fill="#0f2547"/>
        <text x="248" y="31" text-anchor="middle" font-family="Roboto" font-weight="700" font-size="10" fill="#5ea0ff">24°</text>
        <rect x="20" y="16" width="120" height="6" rx="3" fill="#fff" opacity=".8"/>`,
    },
    cooker: {
      vb: "0 0 150 186",
      body: `${shadow(75, 180, 70)}
        <rect x="8" y="8" width="134" height="16" rx="4" fill="url(#gDark)"/>
        <ellipse cx="42" cy="9" rx="16" ry="3.5" fill="#0a0e14"/><ellipse cx="108" cy="9" rx="16" ry="3.5" fill="#0a0e14"/>
        <rect x="6" y="22" width="138" height="152" rx="8" fill="url(#gBodySide)" stroke="#c3cdd9" stroke-width="1.5"/>
        <circle cx="28" cy="38" r="6" fill="url(#gSteel)" stroke="#a9b5c3"/><circle cx="52" cy="38" r="6" fill="url(#gSteel)" stroke="#a9b5c3"/>
        <circle cx="98" cy="38" r="6" fill="url(#gSteel)" stroke="#a9b5c3"/><circle cx="122" cy="38" r="6" fill="url(#gSteel)" stroke="#a9b5c3"/>
        <rect x="66" y="33" width="18" height="10" rx="2" fill="#0f2547"/>
        <rect x="22" y="56" width="106" height="7" rx="3.5" fill="url(#gSteel)"/>
        <rect x="16" y="70" width="118" height="94" rx="7" fill="#e6ebf2" stroke="#c9d2de"/>
        <rect x="28" y="84" width="94" height="58" rx="6" fill="url(#gGlass)"/>
        <path d="M36 96 H70" stroke="#fff" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/>`,
    },
    microwave: {
      vb: "0 0 176 108",
      body: `${shadow(88, 102, 82, 6)}
        <rect x="4" y="4" width="168" height="92" rx="10" fill="url(#gBodySide)" stroke="#c3cdd9" stroke-width="1.5"/>
        <rect x="14" y="14" width="108" height="72" rx="6" fill="url(#gGlass)"/>
        <path d="M22 26 H64" stroke="#fff" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/>
        <rect x="132" y="16" width="30" height="12" rx="2" fill="#0f2547"/><rect x="136" y="19" width="14" height="6" rx="1" fill="#5ea0ff"/>
        <g fill="#cfd8e3"><rect x="132" y="36" width="12" height="7" rx="2"/><rect x="150" y="36" width="12" height="7" rx="2"/>
        <rect x="132" y="48" width="12" height="7" rx="2"/><rect x="150" y="48" width="12" height="7" rx="2"/>
        <rect x="132" y="60" width="12" height="7" rx="2"/><rect x="150" y="60" width="12" height="7" rx="2"/></g>
        <rect x="132" y="72" width="30" height="10" rx="3" fill="${BLUE}"/>`,
    },
  };

  function appliance(kind, cls = "") {
    const a = APPLIANCES[kind];
    return `<svg class="appl appl-${kind} ${cls}" viewBox="${a.vb}">${a.body}</svg>`;
  }
  /** Nested <svg> placed inside another SVG at (x, y) with a given height (keeps aspect ratio). */
  function applianceAt(kind, x, y, h, extra = "") {
    const a = APPLIANCES[kind];
    const [, , vw, vh] = a.vb.split(" ").map(Number);
    const w = (vw / vh) * h;
    return `<svg x="${x}" y="${y - h}" width="${w}" height="${h}" viewBox="${a.vb}" ${extra}>${a.body}</svg>`;
  }

  /* ---------------- Showroom (hero banner illustration) ---------------- */
  function showroom() {
    const floorY = 560;
    let wallPanels = "";
    for (let i = 0; i < 9; i++) {
      wallPanels += `<rect x="${560 + i * 120}" y="0" width="64" height="${floorY}" fill="#ffffff" opacity="${0.025 + (i % 2) * 0.02}"/>`;
    }
    let cones = "";
    [760, 1010, 1260, 1480].forEach((x) => {
      cones += `<polygon points="${x - 18},0 ${x + 18},0 ${x + 120},${floorY} ${x - 120},${floorY}" fill="url(#gCone)"/>
        <ellipse cx="${x}" cy="4" rx="26" ry="5" fill="#e8f1ff" opacity=".9"/>`;
    });
    const items =
      applianceAt("tv", 880, 240, 190) +
      applianceAt("ac", 1240, 120, 74) +
      applianceAt("fridge", 690, floorY, 290) +
      applianceAt("sbs", 840, floorY, 300) +
      applianceAt("washer", 1090, floorY, 176) +
      applianceAt("washer", 1260, floorY, 176) +
      applianceAt("cooker", 1430, floorY, 190);
    return `<svg class="showroom" viewBox="0 0 1600 686" preserveAspectRatio="xMidYMid slice">
      <rect width="1600" height="${floorY}" fill="url(#gWall)"/>
      ${wallPanels}
      <rect y="${floorY}" width="1600" height="${686 - floorY}" fill="url(#gFloor)"/>
      ${cones}
      ${items}
      <g transform="translate(0 ${floorY * 2}) scale(1 -1)" opacity=".18">${applianceAt("fridge", 690, floorY, 290)}${applianceAt("sbs", 840, floorY, 300)}${applianceAt("washer", 1090, floorY, 176)}${applianceAt("washer", 1260, floorY, 176)}${applianceAt("cooker", 1430, floorY, 190)}</g>
      <rect y="${floorY}" width="1600" height="${686 - floorY}" fill="url(#gFloor)" opacity=".55"/>
      <path d="M0 ${floorY} H1600" stroke="#5ea0ff" stroke-opacity=".35" stroke-width="2"/>
    </svg>`;
  }

  /* ---------------- City map (stylised, not to scale) ---------------- */
  function cityMap() {
    const r = M.rng(41);
    const Wm = 3200;
    const Hm = 1500;
    let blocks = "";
    let streets = "";
    // gently rotated grid of blocks
    for (let gx = 0; gx < 20; gx++) {
      for (let gy = 0; gy < 10; gy++) {
        const x = gx * 170 + (gy % 2) * 30 - 60;
        const y = gy * 150 - 40;
        const w = 130 + r() * 20;
        const h = 112 + r() * 14;
        blocks += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="10" fill="${r() < 0.12 ? "#dcebfc" : "#e6edf6"}"/>`;
      }
    }
    // secondary streets (drawn on as the scene starts)
    for (let i = 0; i < 9; i++) {
      const y = 110 + i * 150 + r() * 10;
      streets += `<path class="street" d="M-50 ${y.toFixed(0)} C ${600} ${(y + 30 - r() * 60).toFixed(0)}, ${1600} ${(y - 30 + r() * 60).toFixed(0)}, ${Wm + 50} ${(y + 20).toFixed(0)}" stroke="#ffffff" stroke-width="16" fill="none"/>`;
    }
    for (let i = 0; i < 18; i++) {
      const x = 120 + i * 180 + r() * 12;
      streets += `<path class="street" d="M${x.toFixed(0)} -50 C ${(x + 30 - r() * 60).toFixed(0)} 500, ${(x - 30 + r() * 60).toFixed(0)} 1000, ${(x + 25).toFixed(0)} ${Hm + 50}" stroke="#ffffff" stroke-width="14" fill="none"/>`;
    }
    // main avenues
    const avenues = [
      "M-50 1220 C 500 1120, 1100 1060, 3250 560",
      "M300 -50 C 520 400, 640 900, 900 1550",
      "M2100 -50 C 1950 500, 1900 1000, 2000 1550",
    ];
    let mains = "";
    avenues.forEach((d) => {
      mains += `<path class="avenue" d="${d}" stroke="#d2dcea" stroke-width="34" fill="none" stroke-linecap="round"/><path class="avenue" d="${d}" stroke="#ffffff" stroke-width="26" fill="none" stroke-linecap="round"/>`;
    });
    const ocean = `M0 0 H1250 C 1150 120, 1010 170, 900 250 C 760 350, 640 330, 520 430 C 380 540, 230 560, 0 640 Z`;
    return `<svg class="citymap" viewBox="0 0 ${Wm} ${Hm}" width="${Wm}" height="${Hm}">
      <rect width="${Wm}" height="${Hm}" fill="#eef3f9"/>
      ${blocks}
      ${streets}
      ${mains}
      <path d="${ocean}" fill="#cfe2fb"/>
      <path d="${ocean}" fill="none" stroke="#b4d0f6" stroke-width="10"/>
      <path d="M140 160 q40 -14 80 0 t80 0 M520 110 q40 -14 80 0 t80 0 M260 330 q40 -14 80 0 t80 0" stroke="#a9c8f3" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>
      <text x="380" y="190" font-family="Roboto" font-style="italic" font-size="44" fill="#7fa9e6" letter-spacing="6">Océan Atlantique</text>
      <path id="blvd" class="blvd-base" d="M1180 -60 C 1260 300, 1300 520, 1330 760 S 1420 1200, 1500 1560" stroke="#bcd3f4" stroke-width="40" fill="none" stroke-linecap="round"/>
      <path class="blvd" d="M1180 -60 C 1260 300, 1300 520, 1330 760 S 1420 1200, 1500 1560" stroke="${BLUE}" stroke-width="26" fill="none" stroke-linecap="round"/>
      <text font-family="Roboto" font-weight="700" font-size="30" fill="#ffffff" letter-spacing="3" dy="10"><textPath href="#blvd" startOffset="12%">BOULEVARD GHANDI</textPath></text>
      <text x="1480" y="1110" font-family="Roboto" font-weight="700" font-size="64" fill="#9fb3cc" letter-spacing="18">CASABLANCA</text>
    </svg>`;
  }

  /* ---------------- Cursors & glyphs ---------------- */
  const cursorArrow = `<svg class="cursor-arrow" viewBox="0 0 28 34" width="40" height="48"><path d="M3 2 L3 27 L9.5 20.8 L14 31 L18.6 29 L14.2 19.2 L23 19.2 Z" fill="#fff" stroke="#111" stroke-width="2" stroke-linejoin="round"/></svg>`;
  const handTap = `<svg class="hand" viewBox="0 0 64 80" width="96" height="120"><path d="M22 34 V10 a6 6 0 0 1 12 0 v20 l2-1 a6 6 0 0 1 8 3 l1 2 a6 6 0 0 1 8 3 l1 2 a6 6 0 0 1 8 4 v16 c0 12 -8 21 -20 21 h-6 c-8 0 -13 -4 -17 -10 L8 50 a6 6 0 0 1 9 -7 Z" fill="#fff" stroke="#0f172a" stroke-width="3" stroke-linejoin="round"/></svg>`;
  // Same glyph as the site's WhatsApp button (src/components/WhatsAppFloating.tsx).
  const WA_PATH =
    "M16.03 4C9.4 4 4.03 9.37 4.03 16c0 2.11.55 4.09 1.5 5.81L4 28l6.35-1.5A11.94 11.94 0 0 0 16.03 28c6.63 0 12-5.37 12-12s-5.37-12-12-12Zm0 21.8c-1.83 0-3.55-.5-5.03-1.36l-.36-.21-3.77.89.9-3.67-.23-.38A9.75 9.75 0 0 1 6.23 16c0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.8-9.8 9.8Zm5.5-7.3c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.22-.65.07-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.47.13-.62.15-.15.33-.38.5-.58.13-.15.2-.28.3-.47.1-.2.05-.37-.03-.52-.07-.15-.65-1.6-.9-2.18-.23-.55-.47-.48-.65-.48h-.55c-.2 0-.5.07-.76.37-.26.3-1 1-1 2.42s1.03 2.8 1.18 3c.15.2 2.03 3.22 4.95 4.4 2.42.98 2.9.8 3.43.75.53-.05 1.7-.7 1.94-1.37.24-.68.24-1.25.17-1.37-.07-.12-.27-.2-.57-.35Z";
  const waIcon = (size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="currentColor"><path d="${WA_PATH}"/></svg>`;

  const pinSVG = `<svg class="pin-svg" viewBox="0 0 120 160" width="120" height="160">
    <path d="M60 156 C 60 156, 112 92, 112 56 A52 52 0 0 0 8 56 C 8 92, 60 156, 60 156 Z" fill="url(#gPin)" stroke="#ffffff" stroke-width="6"/>
    <circle cx="60" cy="56" r="30" fill="#ffffff"/>
    <g transform="translate(36 34) scale(0.2)">${logoHouse().replace('class="logo-house "', 'class="logo-house" width="240" height="220"')}</g>
  </svg>`;

  G.ART = { DEFS, BLUE, LOGO_BLUE, logoHouse, logoMark, wordmark, appliance, applianceAt, showroom, cityMap, cursorArrow, handTap, waIcon, pinSVG, HOUSE_LEFT, HOUSE_RIGHT };
})(window);
