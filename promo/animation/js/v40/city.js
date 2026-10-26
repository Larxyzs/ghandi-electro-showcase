/* 40 s — the 3D diorama: a floating slab of Casablanca with Boulevard Ghandi, the shop, streets,
   trees, cars, the customer's house, the giant phone plaza, the delivery van, and (further east)
   the inside of the showroom. Pure construction; the timeline lives in world.js. */
(function (G) {
  const { el, rng, icon } = M;
  const { SHADE } = ISO;
  const BLUE = ART.BLUE;

  // Layout (world px). Ground is z = 0.
  const L = {
    slab: { x: -1400, y: -1100, w: 3600, d: 2700 },
    blvd: { y: 330, d: 120 }, // Boulevard Ghandi runs west-east
    streetA: { x: 900, w: 100 }, // north-south streets
    streetB: { x: -700, w: 100 },
    streetC: { y: 1180, d: 100 }, // southern street
    store: { x: 30, y: 55, w: 380, d: 215, h: 196 }, // the real building at 41 Boulevard Ghandi
    house: { x: 1040, y: 560, w: 190, d: 170, h: 110 },
    phone: { x: -250, y: 830, w: 300, d: 650 },
    show: { x: 4200, y: 0, w: 1640, d: 980 }, // showroom interior
    // neighbouring towns of the delivery zone, floating islands east and west of the city
    sats: [
      { name: "Mohammedia", x: 2840, y: 20, w: 860, d: 720, seed: 515 },
      { name: "Dar Bouazza", x: -2600, y: -260, w: 860, d: 720, seed: 616 },
    ],
  };

  function build(W) {
    const R = W.root;
    /** Box building with window bands on its taller faces. */
    const building = (parent, x, y, w, d, h, c) => {
      const shade = SHADE[c];
      const b = W.box(parent, { x, y, w, d, h, c: { top: shade.top, west: shade.west, south: shade.south } });
      if (h > 120) {
        const win = "repeating-linear-gradient(0deg, transparent 0 18px, rgb(63 134 238 / .45) 18px 30px), ";
        b.south.style.background = `${win}${shade.south}`;
        b.west.style.background = `${win}${shade.west}`;
        [b.south, b.west].forEach((f) => {
          f.style.backgroundSize = "100% 48px";
          f.style.backgroundPosition = "0 14px";
        });
      }
      return b;
    };
    const city = W.group(R);
    const out = { L, city, buildings: [], trees: [], cars: [] };

    /* ---- slab, roads, sidewalks ---- */
    out.slab = W.box(city, { x: L.slab.x, y: L.slab.y, z: -90, w: L.slab.w, d: L.slab.d, h: 90, c: { top: "#eef4fc", west: "#1a6ef0", south: "#0b55c6" } });
    const road = "#d3e0f2";
    const dash = (vertical) =>
      `repeating-linear-gradient(${vertical ? "180deg" : "90deg"}, #ffffff 0 34px, transparent 34px 70px)`;
    const roads = W.group(city, 0, 0, 0.5);
    const S = L.slab;
    // sidewalks then asphalt
    W.plane(roads, { x: S.x, y: L.blvd.y - 30, w: S.w, d: L.blvd.d + 60, bg: "#ffffff" });
    W.plane(roads, { x: S.x, y: L.blvd.y, w: S.w, d: L.blvd.d, bg: road, z: 0.3 });
    W.plane(roads, { x: S.x, y: L.blvd.y + L.blvd.d / 2 - 3, w: S.w, d: 6, z: 0.6, bg: dash(false) });
    [L.streetA, L.streetB].forEach((s) => {
      W.plane(roads, { x: s.x - 22, y: S.y, w: s.w + 44, d: S.d, bg: "#ffffff", z: 0.1 });
      W.plane(roads, { x: s.x, y: S.y, w: s.w, d: S.d, bg: road, z: 0.4 });
      W.plane(roads, { x: s.x + s.w / 2 - 3, y: S.y, w: 6, d: S.d, z: 0.7, bg: dash(true) });
    });
    W.plane(roads, { x: S.x, y: L.streetC.y - 20, w: S.w, d: L.streetC.d + 40, bg: "#ffffff", z: 0.05 });
    W.plane(roads, { x: S.x, y: L.streetC.y, w: S.w, d: L.streetC.d, bg: road, z: 0.35 });
    // painted street name on the boulevard
    [-560, 520].forEach((x) =>
      W.plane(roads, {
        x,
        y: L.blvd.y + 70,
        w: 520,
        d: 40,
        z: 0.8,
        html: `<div style="font:800 30px Unbounded;letter-spacing:.18em;color:#ffffff;white-space:nowrap;line-height:40px">BOULEVARD GHANDI</div>`,
      }),
    );
    // zebra crossing in front of the shop
    W.plane(roads, { x: 170, y: L.blvd.y, w: 110, d: L.blvd.d, z: 0.7, bg: "repeating-linear-gradient(90deg, #ffffff 0 14px, transparent 14px 26px)" });

    /* ---- buildings (rise from the ground when the city is revealed) ---- */
    const r = rng(404);
    const reserved = [
      [20, 0, 400, 330], // the shop
      [L.house.x - 30, L.house.y - 40, L.house.w + 90, L.house.d + 90],
      [L.phone.x - 380, L.phone.y - 380, 760, 760],
      [-200, 480, 460, 260], // van stop + plaza edge
    ];
    const blocks = [
      [-1380, -1080, 660, 1380],
      [-580, -1080, 1460, 1370],
      [1020, -1080, 1160, 1370],
      [-1380, 500, 660, 660],
      [-580, 500, 1460, 660],
      [1020, 500, 1160, 660],
      [-1380, 1300, 3560, 380],
    ];
    const hit = (x, y, w, d) => reserved.some(([rx, ry, rw, rd]) => x < rx + rw && x + w > rx && y < ry + rd && y + d > ry);
    // between the camera and the customer's house only low buildings, so the delivery stays in view
    const low = (x, y, w, d) => x < 1200 && x + w > 490 && y < 1170 && y + d > 460;
    const palette = ["white", "white", "white", "pale", "cloud", "sky"];
    blocks.forEach(([bx, by, bw, bd]) => {
      for (let y = by + 20; y < by + bd - 120; y += 230) {
        for (let x = bx + 20; x < bx + bw - 120; x += 240) {
          const w = 130 + r() * 80;
          const d = 130 + r() * 70;
          if (hit(x, y, w, d) || x + w > S.x + S.w - 30 || y + d > S.y + S.d - 30 || r() < 0.12) continue;
          const tall = r();
          const h = low(x, y, w, d) ? Math.min(70, 50 + tall * tall * 300) : 50 + tall * tall * 300;
          const c = palette[Math.floor(r() * palette.length)];
          const bx2 = building(city, x, y, w, d, h, c);
          // rooftop detail on taller blocks
          if (h > 180 && r() < 0.6) W.box(bx2.g, { x: 20, y: 20, z: h, w: 40, d: 40, h: 24, c: "steel" });
          const shadow = W.plane(city, { x: x + 10, y: y + d - 4, z: 0.9, w: w * 0.9, d: 40 + h * 0.12, bg: "rgb(9 40 100 / .10)" });
          out.buildings.push({ g: bx2.g, x, y, w, d, h, shadow, dist: Math.hypot(x + w / 2 - 220, y + d / 2 - 165) });
        }
      }
    });

    /* ---- the shop: the real building at 41 Boulevard Ghandi (glass front on two floors, six blue
       pillars, overhanging flat roof, bay with blinds over the entrance, "41" above the door, railing) ---- */
    const st = L.store;
    const shop = buildShop(W, city, st);
    out.store = shop;
    // forecourt
    W.plane(city, { x: st.x - 20, y: st.y + st.d, z: 0.7, w: st.w + 40, d: 30, bg: "#e3ecf9" });

    /* ---- trees along the boulevard ---- */
    for (let x = -1300; x < 2150; x += 190) {
      if (Math.abs(x - L.streetA.x - 50) < 120 || Math.abs(x - L.streetB.x - 50) < 120) continue;
      [L.blvd.y - 18, L.blvd.y + L.blvd.d + 18].forEach((y, k) => {
        if (k === 0 && x > -60 && x < 440) return; // keep the shop front clear
        const tr = ISO.tree(W, city, x + (k ? 95 : 0), y, 0.9);
        out.trees.push({ ...tr, x: x + (k ? 95 : 0), y, dist: Math.hypot(x - 220, y - 165) });
      });
    }

    /* ---- traffic ---- */
    const carColors = ["white", "sky", "white", "pale", "white", "blue"];
    carColors.forEach((c, i) => {
      const g = ISO.car(W, city, c);
      out.cars.push({ g, lane: i % 2, speed: 260 + (i * 37) % 120, off: i * 610 });
    });

    /* ---- the customer's house ---- */
    const H = L.house;
    const houseG = W.group(city, H.x, H.y, 0);
    const hb = W.box(houseG, {
      x: 0,
      y: 0,
      w: H.w,
      d: H.d,
      h: H.h,
      c: "white",
      west: `<div class="house-door" style="position:absolute;left:62px;bottom:0;width:46px;height:78px;border-radius:6px 6px 0 0;background:#0b55c6;transform-origin:0 50%"></div>
        <div style="position:absolute;left:14px;top:22px;width:34px;height:30px;border-radius:4px;background:#7fb2ff"></div>
        <div style="position:absolute;right:14px;top:22px;width:34px;height:30px;border-radius:4px;background:#7fb2ff"></div>`,
      south: `<div style="position:absolute;left:30px;top:24px;width:48px;height:34px;border-radius:4px;background:#7fb2ff"></div><div style="position:absolute;right:30px;top:24px;width:48px;height:34px;border-radius:4px;background:#7fb2ff"></div>`,
    });
    W.box(houseG, { x: -14, y: -14, z: H.h, w: H.w + 28, d: H.d + 28, h: 14, c: "blue" });
    W.box(houseG, { x: 40, y: 40, z: H.h + 14, w: H.w - 80, d: H.d - 80, h: 34, c: "blue" });
    W.plane(city, { x: H.x - 70, y: H.y + 40, z: 0.8, w: 70, d: 90, bg: "#e3ecf9" }); // front path
    out.house = { g: houseG, door: hb.west.querySelector(".house-door"), doorPt: { x: H.x - 10, y: H.y + 85 } };

    /* ---- giant phone lying in the plaza (turned 45° so its screen reads upright) ---- */
    const P = L.phone;
    const plaza = W.plane(city, { x: P.x - 380, y: P.y - 380, z: 0.75, w: 760, d: 760, bg: "radial-gradient(closest-side, #d6e6fb, #e9f1fc 70%, #eef4fc)", css: "border-radius:50%;" });
    const phoneG = W.group(city, P.x, P.y, 0);
    phoneG.style.transform = `translate3d(${P.x}px,${P.y}px,0) rotateZ(45deg)`;
    const phShadow = W.plane(phoneG, { x: -P.w / 2 + 16, y: -P.d / 2 + 22, z: 0.9, w: P.w, d: P.d, bg: "rgb(9 40 100 / .18)", css: "border-radius:46px;" });
    const ph = W.box(phoneG, { x: -P.w / 2, y: -P.d / 2, w: P.w, d: P.d, h: 24, c: "navy" });
    ph.top.style.borderRadius = "46px";
    const inset = 32;
    ph.south.style.width = P.w - 2 * inset + "px";
    ph.south.style.transform = `translate3d(${inset}px,${P.d}px,24px) rotateX(-90deg)`;
    ph.west.style.width = P.d - 2 * inset + "px";
    ph.west.style.transform = `translate3d(0,${inset}px,24px) rotateZ(90deg) rotateX(-90deg)`;
    ph.top.style.background = "linear-gradient(145deg,#3a414d,#0d1015 45%,#2a3039)";
    const scr = el(ph.top, "abs");
    scr.style.cssText += `left:12px;top:12px;width:${P.w - 24}px;height:${P.d - 24}px;border-radius:36px;overflow:hidden;background:#fff;`;
    const sc = (P.w - 24) / 390;
    const ui = el(scr, "abs");
    ui.style.cssText += `width:390px;height:${(P.d - 24) / sc}px;transform:scale(${sc});transform-origin:0 0;`;
    ui.innerHTML = phoneScreens();
    // landing rings on the plaza
    const phRings = [0, 1].map(() => W.plane(phoneG, { x: 0, y: 0, z: 1.2, w: 10, d: 10, css: `border-radius:60px;border:8px solid ${BLUE};opacity:0` }));
    out.phone = { g: phoneG, body: ph.g, shadow: phShadow, rings: phRings, ui, scr: (n) => ui.querySelector(`.ps-${n}`), plaza };

    /* ---- delivery van ---- */
    out.van = ISO.van(W, city);
    out.box = W.group(city, 0, 0, 0);
    const parcel = W.box(out.box, {
      x: -28,
      y: -24,
      w: 56,
      d: 48,
      h: 44,
      c: "white",
      top: `<div style="position:absolute;left:0;right:0;top:20px;height:8px;background:${BLUE}"></div>`,
      south: `<div style="position:absolute;inset:0;display:grid;place-items:center"><span style="width:26px;height:24px">${ART.logoHouse()}</span></div>`,
    });
    out.parcel = parcel;

    /* ---- delivery zone: two floating islands, pins and flight arcs from the shop ---- */
    out.sats = L.sats.map((s) => {
      const g = W.group(city, s.x, s.y, 0);
      W.box(g, { x: 0, y: 0, z: -70, w: s.w, d: s.d, h: 70, c: { top: "#eef4fc", west: "#1a6ef0", south: "#0b55c6" } });
      W.plane(g, { x: 0, y: s.d - 150, w: s.w, d: 70, z: 0.4, bg: road });
      W.plane(g, { x: 0, y: s.d - 118, w: s.w, d: 6, z: 0.6, bg: dash(false) });
      const cx = s.w / 2 - 40;
      const cy = s.d / 2 - 60;
      const disc = W.plane(g, {
        x: cx - 190,
        y: cy - 190,
        z: 0.8,
        w: 380,
        d: 380,
        css: `border-radius:50%;background:radial-gradient(closest-side, rgb(18 102 232 / .32), rgb(18 102 232 / .1) 74%, transparent 75%);box-shadow:inset 0 0 0 10px rgb(18 102 232 / .5);`,
      });
      // buildings along the back (north and east) edges keep the pin in the middle clear
      const rr = rng(s.seed);
      const spots = [];
      for (let x = 30; x < s.w - 150; x += 172) spots.push([x, 26]);
      for (let y = 200; y < s.d - 300; y += 172) spots.push([s.w - 168, y]);
      spots.forEach(([x, y]) => {
        const h = 60 + rr() * rr() * 230;
        building(g, x, y, 118 + rr() * 26, 118 + rr() * 26, h, ["white", "white", "pale", "cloud", "sky"][Math.floor(rr() * 5)]);
      });
      const trees = [
        [70, s.d - 200],
        [210, s.d - 196],
        [s.w - 120, s.d - 200],
        [60, 260],
      ].map(([x, y]) => ISO.tree(W, g, x, y, 0.9));
      return { ...s, g, disc, trees, px: s.x + cx, py: s.y + cy };
    });
    const pin = (label, x, y, z, big) => {
      const b = W.billboard(city, {
        x,
        y,
        z,
        w: 900,
        h: 420,
        html: `<div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center">
          <div style="background:${big ? BLUE : "#fff"};color:${big ? "#fff" : "#0f172a"};font:800 ${big ? 96 : 90}px Unbounded;padding:24px 52px;border-radius:999px;white-space:nowrap;box-shadow:0 30px 60px -24px rgb(4 21 58 / .5), inset 0 0 0 7px ${BLUE}">${label}</div>
          <svg width="150" height="200" viewBox="0 0 120 160" style="margin-top:12px"><path d="M60 156 C 60 156, 112 92, 112 56 A52 52 0 0 0 8 56 C 8 92, 60 156, 60 156 Z" fill="${BLUE}" stroke="#fff" stroke-width="8"/><circle cx="60" cy="56" r="22" fill="#fff"/></svg></div>`,
        css: "transform-origin:50% 100%;",
      });
      b.z0 = z;
      return b;
    };
    out.pins = [pin("Casablanca", 220, 165, 330, true), ...out.sats.map((s) => pin(s.name, s.px, s.py, 0, false))];
    // dashed flight arcs from the shop roof to each island, drawn on upright planes
    out.routes = out.sats.map((s) => {
      const a = { x: 220, y: 165, z: 225 };
      const b = { x: s.px, y: s.py, z: 0 };
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const peak = 420;
      const H = peak + 30;
      const zc = (4 * peak - a.z - b.z) / 2;
      const path = `M0 ${H - a.z} Q ${len / 2} ${H - zc} ${len} ${H - b.z}`;
      const d = el(city, "abs iso-f");
      d.style.cssText += `width:${len}px;height:${H}px;overflow:visible;transform:translate3d(${a.x}px,${a.y}px,${H}px) rotateZ(${(ang * 180) / Math.PI}deg) rotateX(-90deg);`;
      d.innerHTML = `<svg width="${len}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible">
        <path d="${path}" fill="none" stroke="#ffffff" stroke-width="30" stroke-linecap="round" opacity=".75"/>
        <path class="arc-dash" d="${path}" fill="none" stroke="${BLUE}" stroke-width="16" stroke-linecap="round" stroke-dasharray="44 36"/></svg>`;
      const at = (u) => {
        const x = u * len;
        return { x: a.x + Math.cos(ang) * x, y: a.y + Math.sin(ang) * x, z: (1 - u) * (1 - u) * a.z + 2 * u * (1 - u) * zc + u * u * b.z };
      };
      // a small van icon that keeps travelling along the arc
      const rider = W.billboard(city, {
        x: a.x,
        y: a.y,
        z: a.z,
        w: 110,
        h: 110,
        html: `<div style="position:absolute;inset:0;border-radius:50%;background:${BLUE};color:#fff;display:grid;place-items:center;box-shadow:0 0 0 9px #ffffff, 0 18px 30px -12px rgb(4 21 58 / .5)">${icon("truck", 58, 2.2)}</div>`,
      });
      rider.d.style.top = "-55px";
      return { d, dash: d.querySelector(".arc-dash"), len, at, rider };
    });

    /* ---- clouds drifting over the city (only seen in the wide shots) ---- */
    const cloudSVG = `<svg viewBox="0 0 360 170" width="100%" height="100%"><g fill="#ffffff"><circle cx="112" cy="98" r="58"/><circle cx="186" cy="72" r="72"/><circle cx="262" cy="104" r="52"/><rect x="58" y="100" width="254" height="62" rx="31"/></g>
      <rect x="58" y="138" width="254" height="24" rx="12" fill="#e4eefc"/></svg>`;
    // placed so that none of them drifts over the shop in the wide shots
    out.clouds = [
      [-1300, -900, 650, 1.35, 10],
      [1700, -900, 720, 1.1, 12],
      [2100, 700, 640, 1.3, 9],
      [-1600, 300, 600, 1.15, 14],
      [900, 1500, 580, 1.2, 11],
      [-200, -1300, 760, 1.0, 13],
    ].map(([x, y, z, k, speed]) => {
      const shadow = W.plane(city, { x: x - 170 * k, y: y - 60 * k, z: 1.1, w: 340 * k, d: 130 * k, bg: "radial-gradient(closest-side, rgb(9 40 100 / .09), transparent)", css: "border-radius:50%;" });
      const b = W.billboard(city, { x, y, z, w: 360 * k, h: 170 * k, html: cloudSVG, css: "filter:drop-shadow(0 22px 26px rgb(9 40 100 / .14));" });
      return { b, shadow, x, y, z, k, speed };
    });

    /* ---- showroom interior (separate set, east of the city) ---- */
    out.show = buildShowroom(W);
    return out;
  }

  /** The shop, modelled on the real building, in the video's blue and white. Every part is its own group
      so world.js can assemble it piece by piece. Origin: the building's back-left corner on the ground. */
  function buildShop(W, parent, st) {
    const g = W.group(parent, st.x, st.y, 0);
    const F1 = 100; // ground floor height
    const SLAB = 10;
    const F2 = st.h - F1 - SLAB; // upper floor
    const COLS = [20, 80, 140, 200, 240, 316]; // pillar centres (x)
    const DOOR = { x: 258, w: 36, h: 80 };
    const BAY = { x: 226, w: st.w - 226 + 4, d: 18 }; // over the entrance, a little forward of the front
    const glass = "linear-gradient(180deg, #e6f1ff 0%, #b9d6ff 100%)";
    const mullions = (step) => `repeating-linear-gradient(90deg, transparent 0 ${step - 3}px, rgb(255 255 255 / .95) ${step - 3}px ${step}px)`;
    const reflect = "linear-gradient(115deg, transparent 18%, rgb(255 255 255 / .5) 21%, transparent 29%, transparent 58%, rgb(255 255 255 / .3) 61%, transparent 68%)";
    const appl = (k, h, x, bottom, extra = "") =>
      `<span style="position:absolute;left:${x}px;bottom:${bottom}px;height:${h}px;display:block;${extra}">${ART.appliance(k).replace("<svg", `<svg style="height:${h}px;width:auto"`)}</span>`;
    /** A glazed face: interior (appliances, ceiling lights), dimmer that lifts when the lights go on,
        mullions, reflections, and a sheen that sweeps across. */
    const glassFace = (w, h, inner, step = 38) => `
      <div style="position:absolute;inset:0;background:${glass}"></div>
      <div class="st-in" style="position:absolute;inset:0">${inner}</div>
      <div class="st-lamp" style="position:absolute;left:8px;right:8px;top:6px;height:3px;border-radius:3px;background:#ffffff;box-shadow:0 0 10px 3px rgb(255 248 225 / .9);opacity:0"></div>
      <div class="st-dim" style="position:absolute;inset:0;background:rgb(28 70 150 / .32)"></div>
      <div class="st-glow" style="position:absolute;inset:0;background:linear-gradient(180deg, rgb(255 252 240 / .5), rgb(255 255 255 / .08));opacity:0"></div>
      <div style="position:absolute;inset:0;background:${mullions(step)}"></div>
      <div style="position:absolute;inset:0;background:${reflect}"></div>
      <div class="st-sheen" style="position:absolute;top:-10px;left:0;width:70px;height:${h + 20}px;background:linear-gradient(90deg, transparent, rgb(255 255 255 / .8), transparent);transform:translateX(-120px) skewX(-18deg)"></div>`;

    // floor plate
    const plate = W.box(g, { x: -8, y: -8, w: st.w + 16, d: st.d + 16, h: 6, c: { top: "#f4f8ff", west: "#cfdcf0", south: "#b9cbe6" } });
    // ground floor: showroom behind glass, the entrance and the "41" plaque
    const f1Inner =
      appl("fridge", 64, 12, 6) + appl("sbs", 66, 46, 6) + appl("fridge", 62, 94, 6) + appl("washer", 40, 132, 6) + appl("washer", 40, 164, 6) +
      appl("tv", 34, 200, 40) + appl("cooker", 46, 306, 6) + appl("microwave", 24, 340, 30) + appl("ac", 18, 196, 76);
    const f1South =
      glassFace(st.w, F1, f1Inner) +
      `<div style="position:absolute;left:${DOOR.x}px;bottom:0;width:${DOOR.w}px;height:${DOOR.h}px;background:#16294f;border-radius:3px 3px 0 0">
        <div style="position:absolute;left:4px;right:4px;top:4px;bottom:0;background:linear-gradient(180deg,#cfe2ff,#8fbaf7)"></div>
        <div style="position:absolute;left:${DOOR.w / 2 - 1}px;top:4px;bottom:0;width:2px;background:#16294f"></div></div>
      <div class="st-41" style="position:absolute;left:${DOOR.x + 4}px;top:4px;width:${DOOR.w - 8}px;height:14px;border-radius:3px;background:#16294f;color:#fff;font:800 11px/14px Roboto;text-align:center">41</div>`;
    const f1West = glassFace(st.d, F1, appl("washer", 40, 30, 6) + appl("fridge", 62, 90, 6) + appl("tv", 32, 150, 40), 36);
    const f1 = W.box(g, { x: 0, y: 0, z: 6, w: st.w, d: st.d, h: F1 - 6, c: "white", south: f1South, west: f1West });
    // slab between the floors
    const slab = W.box(g, { x: -2, y: -2, z: F1, w: st.w + 4, d: st.d + 4, h: SLAB, c: { top: "#ffffff", west: "#f1f6fd", south: "#ffffff" } });
    slab.south.style.borderBottom = slab.west.style.borderBottom = "2px solid #c9d8ee";
    // upper floor
    const f2Inner = appl("tv", 30, 20, 4) + appl("fridge", 50, 70, 4) + appl("washer", 32, 110, 4) + appl("tv", 30, 150, 4) + appl("ac", 16, 30, 52) + appl("ac", 16, 150, 52);
    const f2 = W.box(g, { x: 0, y: 0, z: F1 + SLAB, w: st.w, d: st.d, h: F2, c: "white", south: glassFace(st.w, F2, f2Inner), west: glassFace(st.d, F2, appl("fridge", 50, 60, 4) + appl("tv", 30, 120, 4), 36) });
    // the bay over the entrance: aluminium band on top, glass with blinds below
    const bay = W.box(g, {
      x: BAY.x,
      y: st.d - 4,
      z: F1 + 4,
      w: BAY.w,
      d: BAY.d + 4,
      h: F2 + SLAB - 4,
      c: { top: "#ffffff", west: "#e9f0fa", south: "#eef4fc" },
      south: `<div style="position:absolute;left:0;right:0;top:0;height:34px;background:repeating-linear-gradient(90deg, #f4f8ff 0 36px, #d3e0f3 36px 38px), #f4f8ff;border-bottom:2px solid #c9d8ee"></div>
        <div style="position:absolute;left:0;right:0;top:36px;bottom:0;background:repeating-linear-gradient(180deg, rgb(255 255 255 / .9) 0 3px, transparent 3px 7px), ${glass}"></div>
        <div class="st-glow" style="position:absolute;left:0;right:0;top:36px;bottom:0;background:rgb(255 252 240 / .35);opacity:0"></div>
        <div style="position:absolute;left:0;right:0;top:36px;bottom:0;background:${mullions(30)}"></div>
        <div style="position:absolute;inset:0;background:linear-gradient(90deg, transparent 70%, rgb(9 40 100 / .14))"></div>
        <div class="st-sheen" style="position:absolute;top:-10px;left:0;width:60px;height:120px;background:linear-gradient(90deg, transparent, rgb(255 255 255 / .8), transparent);transform:translateX(-120px) skewX(-18deg)"></div>`,
    });
    // overhanging flat roof with a blue line under the fascia, and small rooftop units
    const roof = W.box(g, {
      x: -14,
      y: -12,
      z: st.h,
      w: st.w + 28,
      d: st.d + 34,
      h: 16,
      c: { top: "#f4f8ff", west: "#e3ecf8", south: "#f7faff" },
    });
    roof.south.style.background = roof.west.style.background = `linear-gradient(180deg, #ffffff 0 70%, #dfe9f7 70% 82%, ${BLUE} 82%)`;
    [
      [40, 24, 18, 18, 24],
      [300, 40, 46, 30, 16],
      [256, 40, 34, 30, 16],
    ].forEach(([x, y, w, d, h]) => W.box(roof.g, { x, y, z: 16, w, d, h, c: "steel" }));
    // six blue pillars in front of the glass (gradients fake the round shape)
    const cols = COLS.map((cx) => {
      // one cylinder across both visible faces: highlight on the shared corner
      const b = W.box(g, { x: cx - 7, y: st.d + 6, w: 14, d: 14, h: st.h, c: "blue" });
      b.south.style.background = "linear-gradient(90deg, #a9d0ff 0%, #3a8bff 30%, #0e4bb0 72%, #072e75 100%)";
      b.west.style.background = "linear-gradient(90deg, #072e75 0%, #1a6ef0 62%, #7fb5ff 100%)";
      b.top.style.borderRadius = "50%";
      return b;
    });
    // entrance steps and the railing along the sidewalk (gap at the entrance)
    W.plane(g, { x: DOOR.x - 10, y: st.d, z: 0.9, w: DOOR.w + 20, d: 30, bg: "#22314d" });
    const rail = [
      [-12, 248],
      [DOOR.x + DOOR.w + 12, st.w + 14 - (DOOR.x + DOOR.w + 12)],
    ].map(([x, w]) => {
      const base = W.box(g, { x, y: st.d + 28, w, d: 6, h: 7, c: "navy" });
      const fence = W.wall(g, {
        x,
        y: st.d + 31,
        z: 7,
        w,
        h: 22,
        css: `background:repeating-linear-gradient(55deg, transparent 0 9px, #b8c9e2 9px 11px), repeating-linear-gradient(-55deg, transparent 0 9px, #b8c9e2 9px 11px);border-top:3px solid #9fb4d4;`,
      });
      return { base, fence };
    });
    // rooftop sign, turned towards the camera
    const sign = el(g, "abs iso-f");
    sign.style.cssText += `width:300px;height:96px;border-radius:18px;background:${BLUE};display:flex;align-items:center;gap:14px;padding:0 18px;
      box-shadow:0 0 0 6px #ffffff;transform:translate3d(${st.w / 2}px,${st.d * 0.5}px,${st.h + 16 + 96}px) rotateZ(45deg) rotateX(-90deg) translateX(-150px);`;
    sign.innerHTML = `<span style="flex:none;width:68px;height:62px">${ART.logoHouse({ ink: "#fff", fill: "#fff", detail: BLUE, hl: "#b7d3ff", vent: "#fff" })}</span>
      <span style="color:#fff;line-height:1"><b style="display:block;font:600 30px 'Lexend Zetta';letter-spacing:.06em">GHANDI</b><span style="font:600 11px 'Lexend Zetta';letter-spacing:.3em">HOME ELECTRO</span></span>`;
    // dust ring for the roof landing (world space, around the footprint)
    const dust = W.plane(parent, { x: 0, y: 0, z: 1.3, w: 10, d: 10, css: "border-radius:40px;border:10px solid rgb(255 255 255 / .9);box-shadow:0 0 18px rgb(18 102 232 / .35);opacity:0" });
    const faces = [f1.south, f1.west, f2.south, f2.west, bay.south];
    return {
      g,
      sign,
      plate,
      f1,
      slab,
      f2,
      bay,
      roof,
      cols,
      rail,
      dust,
      faces,
      plaque: f1.south.querySelector(".st-41"),
      door: { x: st.x + DOOR.x + DOOR.w / 2, y: st.y + st.d, z: DOOR.h / 2 },
      F1,
      SLAB,
      F2,
      top: st.h + 16, // roof surface
    };
  }

  function phoneScreens() {
    const head = `<div class="m-status"><b>9:41</b><span>${icon("signal", 15, 2.4)}${icon("wifi", 15, 2.4)}${icon("battery-full", 20, 2)}</span></div>
      <div class="m-header"><span class="m-burger">${icon("menu", 20, 2)}</span>${ART.logoMark(40)}<span class="m-flex"></span>${icon("heart", 21, 1.8)}
      <span class="m-cart" style="position:relative">${icon("shopping-cart", 21, 1.8)}<em class="s-badge ps-badge" style="right:-8px;top:-8px">1</em></span></div>`;
    const steps = (n) => `<div style="display:flex;justify-content:space-between;margin:6px 16px 14px;padding:12px 14px;border:1px solid #e3e6e8;border-radius:10px;font:500 13px Roboto">
      ${["Panier", "Livraison", "Confirmation"]
        .map((l, i) => `<span style="display:flex;align-items:center;gap:6px;color:${i + 1 === n ? "#0f172a" : "#8a9096"}"><i style="width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font:700 11px Roboto;font-style:normal;background:${i + 1 <= n ? BLUE : "#f1f3f5"};color:${i + 1 <= n ? "#fff" : "#8a9096"}">${i + 1 < n ? "✓" : i + 1}</i>${l}</span>`)
        .join("")}</div>`;
    const product = `<div class="ps ps-1 site s-mobile" style="position:absolute;inset:0">${head}
      <div style="margin:4px 16px 0;height:290px;border:1px solid #e3e6e8;border-radius:12px;display:grid;place-items:center;background:#fff">${ART.appliance("fridge").replace("<svg", '<svg style="height:252px;width:auto"')}</div>
      <p style="margin:12px 16px 0;font:500 11px Roboto;letter-spacing:.06em;color:#8a9096;text-transform:uppercase">Samsung</p>
      <p style="margin:2px 16px 0;font:700 21px Roboto">Réfrigérateur combiné</p>
      <p style="margin:6px 16px 0;font:700 16px Roboto;color:#5f6368">Prix sur demande</p>
      <div class="ps-add" style="margin:14px 16px 0;padding:14px;border-radius:8px;background:${BLUE};color:#fff;font:700 16px Roboto;display:flex;justify-content:center;gap:8px">${icon("shopping-cart", 18, 2.2)} Ajouter au panier</div>
      <div style="margin:10px 16px 0;display:grid;grid-template-columns:1fr 1fr;gap:10px;font:700 13px/1.2 Roboto">
        <div style="padding:11px 8px;border-radius:8px;background:#25a85a;color:#fff;display:flex;justify-content:center;align-items:center;gap:6px;text-align:center">${ART.waIcon(16)} Commander sur WhatsApp</div>
        <div style="padding:11px 8px;border-radius:8px;box-shadow:inset 0 0 0 1.5px #0f172a;display:flex;justify-content:center;align-items:center;gap:6px">${icon("phone", 15, 2.2)} Appeler</div></div>
      <div style="margin:14px 16px 0;padding:12px 14px;border-radius:8px;background:#f3f6fa;font:400 13px/1.35 Roboto;color:#0f172a">
        ${[
          ["truck", "Livraison gratuite à Casablanca, Mohammedia et Dar Bouazza"],
          ["banknote", "Paiement à la livraison"],
          ["store", "Retrait au magasin : 41 Boulevard Ghandi, Casablanca"],
        ]
          .map(([ic, tx], i) => `<div style="display:flex;gap:8px;align-items:flex-start;${i ? "margin-top:8px" : ""}"><span style="color:${BLUE};flex:none;margin-top:1px">${icon(ic, 15, 2.2)}</span>${tx}</div>`)
          .join("")}</div></div>`;
    const delivery = `<div class="ps ps-2 site s-mobile" style="position:absolute;inset:0;background:#fff">${head}${steps(2)}
      <p style="margin:6px 16px 10px;font:700 20px Roboto">Mode de réception</p>
      <div class="ps-opt ps-opt1" style="margin:0 16px 10px;padding:16px;border-radius:10px;display:flex;gap:12px;align-items:center;font:700 16px Roboto">${icon("truck", 24, 2)} Livraison à domicile</div>
      <div class="ps-opt ps-opt2" style="margin:0 16px 18px;padding:16px;border-radius:10px;display:flex;gap:12px;align-items:center;font:700 16px Roboto;box-shadow:inset 0 0 0 2px #e3e6e8">${icon("store", 24, 2)} Retrait au magasin</div>
      ${["Nom complet", "Téléphone", "Adresse"].map((f) => `<div style="margin:0 16px 10px;padding:14px;border-radius:8px;box-shadow:inset 0 0 0 1px #d5d9dc;color:#8a9096;font:400 15px Roboto">${f}</div>`).join("")}
      <div style="margin:4px 16px;padding:12px;border-radius:8px;background:#f1f6fe;color:#5f6368;font:400 14px Roboto">Ville : <b style="color:#0f172a">Casablanca</b></div></div>`;
    const confirm = `<div class="ps ps-3 site s-mobile" style="position:absolute;inset:0;background:#fff">${head}${steps(3)}
      <div style="margin:30px auto 0;width:150px;height:150px;border-radius:50%;background:#e9f1fd;display:grid;place-items:center;color:${BLUE}" class="ps-check">${icon("circle-check-big", 96, 1.8)}</div>
      <p style="margin:26px 24px 0;text-align:center;font:700 22px Roboto">Vérifiez et validez</p>
      <p style="margin:10px 30px 0;text-align:center;font:400 16px/1.45 Roboto;color:#5f6368">Nous vous appelons pour confirmer la commande. Paiement à la livraison.</p>
      <div style="margin:26px 16px 0;padding:15px;border-radius:8px;background:${BLUE};color:#fff;font:700 16px Roboto;text-align:center">Valider la commande</div></div>`;
    return product + delivery + confirm;
  }

  function buildShowroom(W) {
    const S = L.show;
    const g = W.group(W.root, S.x, S.y, 0);
    const out = { g, zones: [], walls: {} };
    // floor slab with tiles
    const floor = W.box(g, { x: 0, y: 0, z: -40, w: S.w, d: S.d, h: 40, c: { top: "#f4f8fe", west: "#1a6ef0", south: "#0b55c6" } });
    floor.top.style.background = "linear-gradient(#e3ecf9 2px, transparent 2px) 0 0 / 90px 90px, linear-gradient(90deg, #e3ecf9 2px, transparent 2px) 0 0 / 90px 90px, #f7faff";
    // back walls (their inner faces are the visible ones)
    const north = W.box(g, { x: 0, y: -30, w: S.w + 30, d: 30, h: 330, c: { top: "#ffffff", west: "#d8e4f6", south: "#ffffff" } });
    north.south.style.background = "linear-gradient(180deg, #ffffff, #eaf2fd)";
    const east = W.box(g, { x: S.w, y: 0, w: 30, d: S.d, h: 330, c: { top: "#ffffff", west: "#e2ecfa", south: "#d8e4f6" } });
    out.walls = { north, east };
    // brand wall on the north wall
    const brands = el(north.south, "abs");
    brands.style.cssText += "left:70px;top:46px;right:70px;display:grid;grid-template-columns:repeat(4,1fr);gap:22px;";
    out.brandPanels = SITE.BRANDS.map((b) => {
      const p = el(brands, "");
      p.style.cssText += `height:96px;border-radius:18px;display:grid;place-items:center;font:900 40px Roboto;letter-spacing:-.01em;background:#eef4fc;color:#9fb3cc;box-shadow:inset 0 0 0 3px #dbe6f7;`;
      p.textContent = b;
      return p;
    });
    const wallTitle = el(north.south, "abs");
    wallTitle.style.cssText += `left:0;right:0;top:278px;text-align:center;font:800 26px Unbounded;letter-spacing:.3em;color:${BLUE};`;
    wallTitle.textContent = "NOS MARQUES";
    // ceiling lights (glowing discs on the wall top) and a promo stripe on the east wall
    east.west.style.background = `linear-gradient(180deg, #ffffff 0 60%, #e9f1fd 60%)`;
    east.west.innerHTML = `<div style="position:absolute;left:60px;right:60px;top:60px;height:120px;border-radius:20px;background:${BLUE};display:flex;align-items:center;justify-content:center;gap:18px;color:#fff;font:800 30px Unbounded">
      <span style="width:80px;height:72px">${ART.logoHouse({ ink: "#fff", fill: "#fff", detail: BLUE, hl: "#b7d3ff", vent: "#fff" })}</span>GHANDI</div>`;

    // product zones on podiums along the room
    const ZONES = [
      { name: "Froid", items: [["fridge", 90, 200], ["sbs", 140, 205], ["fridge", 90, 190]] },
      { name: "Lavage", items: [["washer", 100, 112], ["washer", 100, 112], ["washer", 100, 112]] },
      { name: "Cuisson", items: [["cooker", 105, 128], ["microwave", 120, 74], ["cooker", 105, 128]] },
      { name: "TV", items: [["tv", 230, 152]] },
      { name: "Climatisation", items: [["ac", 230, 74]] },
    ];
    ZONES.forEach((z, i) => {
      const zx = 60 + i * 310;
      const zy = 470;
      const glow = W.plane(g, { x: zx - 70, y: zy - 60, z: 0.5, w: 410, d: 380, css: "border-radius:50%;background:radial-gradient(closest-side, rgb(18 102 232 / .38), rgb(18 102 232 / .12) 60%, transparent);opacity:0;" });
      const ring = W.plane(g, { x: 0, y: 0, z: 0.7, w: 10, d: 10, css: `border-radius:50%;border:7px solid ${BLUE};opacity:0;` });
      const zg = W.group(g, zx, zy, 0);
      W.box(zg, { x: 0, y: 0, w: 270, d: 260, h: 16, c: { top: "#ffffff", west: "#dbe6f7", south: "#c6d7ef" } });
      const items = [];
      const S_ = 0.72;
      const mult = (k) => (k === "tv" || k === "ac" ? 1.45 : 1);
      let cx = 135 - (z.items.reduce((a, it) => a + it[1] * S_ * mult(it[0]), 0) + 8 * (z.items.length - 1)) / 2;
      z.items.forEach(([k, w, h]) => {
        const ww = w * S_ * mult(k);
        const hh = Math.round(h * S_ * mult(k));
        const isAc = k === "ac";
        const baseZ = isAc ? 120 : 16;
        const dd = k === "tv" || isAc ? 26 : Math.min(70, ww);
        const ig = W.group(zg, cx, 130 - dd / 2 + (isAc ? 30 : 0), baseZ);
        const front = ART.appliance(k).replace("<svg", `<svg style="width:100%;height:100%" preserveAspectRatio="none"`);
        const bx = W.box(ig, { x: 0, y: 0, w: ww, d: dd, h: hh, c: k === "tv" ? "navy" : "white", south: front });
        bx.south.style.background = "transparent";
        if (isAc) W.box(zg, { x: cx + ww * 0.45, y: 130 + dd / 2 + 30, z: 16, w: 14, d: 14, h: 104, c: "steel" });
        items.push(ig);
        cx += ww + 8;
      });
      const label = W.billboard(g, {
        x: zx + 135,
        y: zy + 130,
        z: 250,
        w: 360,
        h: 80,
        html: `<div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);background:${BLUE};color:#fff;font:800 34px Unbounded;padding:12px 26px;border-radius:999px;white-space:nowrap;box-shadow:0 18px 36px -16px rgb(4 21 58 / .5)">${z.name}</div>`,
      });
      out.zones.push({ ...z, g: zg, items, label, glow, ring, cx: zx + 135, cy: zy + 130, x: S.x + zx + 135, y: S.y + zy + 130 });
    });
    return out;
  }

  G.CITY = { build, L };
})(window);
