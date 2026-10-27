/* 40 s — the diorama timeline (4 – 36 s): the city builds itself, the shop rises on Boulevard Ghandi,
   the camera dives through the shop door into the showroom (five univers, then the brand wall), comes
   back out to the giant phone (order in 3 steps), follows the delivery van to a home, rises over the
   shop for phone and WhatsApp advice, and pulls back to the floating city. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "world",
    4.0,
    36.0,
    (root) => {
      const { el, E, prog, clamp, lerp, cue, tf, spring, squash, wobble, icon, shake } = M;
      const BLUE = ART.BLUE;

      const bg = el(root, "fill");
      bg.style.background = "radial-gradient(circle at 50% 28%, #f6f9ff 0%, #e4eefc 55%, #cfe0f8 100%)";
      const amb = FXL.ambient(root, { n: 14, colors: ["rgb(18 102 232 / .14)", "rgb(90 162 255 / .2)"], seed: 61 });
      const W = ISO.world(root, { perspective: 6000 });
      const C = CITY.build(W);
      const L = C.L;
      const SHOWX = L.show.x;
      const zoneX = (i) => SHOWX + 60 + i * 310 + 135;
      const T_SHOW = 9.5; // cut into the showroom
      const T_ZONE = [10.0, 11.0, 12.0, 13.0, 14.0]; // camera lands on each univers on the beat
      const T_BRAND = 15.5; // brand panels light on 8th notes
      const T_PHONE = 18.0; // back outside, at the giant phone
      const T_STEP = [18.5, 20.0, 21.5];
      const T_BOX = 22.9;
      const T_VAN = 23.9;
      const MAP = { x: 420, y: 260 }; // delivery map: the city between its two neighbouring islands
      const T_SAT = [25.75, 25.95]; // islands rise
      const T_PIN = [25.6, 26.15, 26.4]; // Casablanca, Mohammedia, Dar Bouazza pins drop
      const T_ARC = [26.25, 26.5]; // flight arcs draw
      const PIN_S = 1.45; // pins read at map zoom
      const T_DROP = 18.0; // the giant phone falls into the plaza and lands on the beat
      const FALL = 0.5;
      const T_LAND = T_DROP + FALL;
      const T_ARRIVE = 28.1;
      const T_ADVICE = 30.0;
      const T_ISLAND = 34.0;
      // the shop assembles itself on the beat grid (120 BPM)
      const SH = {
        plate: 4.5,
        cols: [4.5, 4.5625, 4.625, 4.6875, 4.75, 4.8125],
        f1: 4.75,
        slab: 4.875,
        f2: 4.9,
        bay: 5.0,
        roof: 5.0, // falls for 0.25 s
        land: 5.25,
        rail: [5.25, 5.3125],
        plaque: 5.375,
        lights: [5.5, 5.5625],
        sheen: [5.625, 7.5, 31.2],
        sign: 5.75,
        pin: 5.75, // lands at 6.0
      };
      const DOOR = C.store.door;

      /* ---------- camera keyframes ---------- */
      // sx/sy: where the focus point sits on screen (lets captions keep their side of the frame free)
      const K = (t, x, y, z, zoom, yaw, pitch, ease = E.inOutCubic, sx = 960, sy = 540) => ({ t, x, y, z, zoom, yaw, pitch, ease, sx, sy });
      const ZZ = 1.5; // showroom zone close-ups: products centre-right, univers card bottom-left
      const KEYS = [
        K(4.0, 300, 200, 0, 0.42, -34, 56),
        K(4.75, 220, 175, 70, 1.35, -38, 56, E.outCubic, 960, 620),
        K(5.75, 220, 175, 80, 1.45, -44, 55, E.inOutSine, 960, 630),
        // hero shot: crane down to an almost street-level view of the facade, slow orbit while the card reads
        K(6.4, 232, 250, 120, 1.22, -24, 75, E.inOutCubic, 1350, 600),
        K(8.6, 250, 255, 110, 1.38, -12, 78, E.inOutSine, 1350, 600),
        // and straight in through the door
        K(9.5, DOOR.x, DOOR.y + 30, DOOR.z, 7.5, -8, 80, E.inCubic, 960, 540),
        K(9.5, SHOWX + 140, 680, 110, 2.1, -40, 50, E.inCubic, 1000, 450),
        K(T_ZONE[0], zoneX(0), 600, 110, ZZ, -40, 48, E.outCubic, 1120, 470),
        ...[1, 2, 3, 4].flatMap((i) => [
          K(T_ZONE[i] - 0.4, zoneX(i - 1), 600, 110, ZZ, -40 + i, 48, E.inOutSine, 1120, 470),
          K(T_ZONE[i], zoneX(i), 600, 110, ZZ, -40 + i, 48, E.inOutCubic, 1120, 470),
        ]),
        K(14.6, zoneX(4), 600, 110, ZZ, -36, 48, E.inOutSine, 1120, 470),
        // brand wall seen from the front, the room's floor and products below it
        K(15.25, SHOWX + 835, 0, 175, 1.0, -7, 70, E.inOutCubic, 960, 560),
        K(17.95, SHOWX + 835, 0, 175, 1.06, 5, 70, E.inOutSine, 960, 560),
        // the giant phone, seen from higher up so its screen reads
        K(18.0, L.phone.x, L.phone.y, 0, 1.8, -45, 40, E.inOutCubic, 1420, 560),
        K(18.5, L.phone.x, L.phone.y, 0, 1.45, -45, 40, E.outCubic, 1420, 560),
        K(22.9, L.phone.x + 20, L.phone.y - 20, 0, 1.5, -43, 41, E.inOutSine, 1420, 560),
        K(23.75, -300, 470, 20, 1.15, -44, 57, E.inOutCubic, 960, 540),
      ];
      const KEYS2 = [
        K(25.2, 0, 0, 0, 1.05, -45, 56), // x/y follow the van until here
        K(26.1, MAP.x, MAP.y, 0, 0.29, -45, 56, E.inOutCubic, 960, 575),
        K(27.6, MAP.x, MAP.y, 0, 0.305, -42, 56, E.inOutSine, 960, 575),
        K(28.35, 990, 650, 30, 1.35, -48, 55, E.inOutCubic, 1250, 500),
        K(30.0, 1000, 650, 30, 1.42, -47, 55, E.inOutSine, 1250, 500),
        // the shop low in frame: ringing phone above it, WhatsApp bubble above that
        K(30.85, 220, 175, 140, 0.95, -52, 50, E.inOutCubic, 1300, 740),
        K(34.0, 220, 175, 140, 1.0, -46, 50, E.inOutSine, 1300, 740),
        K(35.5, 420, 220, 0, 0.3, -24, 58, E.inOutCubic, 960, 540),
        K(36.0, 420, 220, 0, 0.27, -20, 58, E.inOutSine, 960, 540),
      ];
      function interp(keys, t) {
        if (t <= keys[0].t) return keys[0];
        for (let i = 1; i < keys.length; i++) {
          const a = keys[i - 1];
          const b = keys[i];
          if (t < b.t) {
            if (b.t === a.t) return b;
            const k = b.ease(prog(t, a.t, b.t));
            return {
              x: lerp(a.x, b.x, k),
              y: lerp(a.y, b.y, k),
              z: lerp(a.z, b.z, k),
              zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), k)),
              yaw: lerp(a.yaw, b.yaw, k),
              pitch: lerp(a.pitch, b.pitch, k),
              sx: lerp(a.sx, b.sx, k),
              sy: lerp(a.sy, b.sy, k),
            };
          }
        }
        return keys[keys.length - 1];
      }

      /* ---------- delivery van path ---------- */
      // the van's origin is its rear-left corner; it drives on the right (south lane eastbound,
      // west lane of street A southbound) and stops by the house door
      const VAN0 = { x: -360, y: 392 };
      const TURN = { x: 800, y: 392 };
      const BEND = { x: 955, y: 452 };
      const STOP = { x: 955, y: 548 };
      function vanAt(t) {
        if (t < 26.3) return { x: lerp(VAN0.x, TURN.x, E.inOutSine(prog(t, T_VAN, 26.3))), y: VAN0.y, r: 0 };
        if (t < 26.7) {
          const k = E.inOutSine(prog(t, 26.3, 26.7));
          return { x: lerp(TURN.x, BEND.x, Math.sin((k * Math.PI) / 2)), y: lerp(TURN.y, BEND.y, 1 - Math.cos((k * Math.PI) / 2)), r: 90 * k };
        }
        return { x: BEND.x, y: lerp(BEND.y, STOP.y, E.outCubic(prog(t, 26.7, T_ARRIVE))), r: 90 };
      }

      /* ---------- per-element animation state ---------- */
      const buildRise = (d) => 4.05 + d / 2400;
      const sh0 = C.store.sign;
      const signBase = sh0.style.transform;
      const doorPt = C.house.doorPt;
      const pinStore = W.billboard(C.city, {
        x: 220,
        y: 165,
        z: 330,
        w: 120,
        h: 160,
        html: ART.pinSVG,
        css: "filter:drop-shadow(0 14px 16px rgb(4 21 58 / .35));",
      });
      const pinRings = [0, 1, 2].map(() => W.plane(C.city, { x: 0, y: 0, z: 1, w: 10, d: 10, css: `border-radius:50%;border:6px solid ${BLUE};` }));
      // finger that taps the phone screen: drawn over the 3D world, pinned to the projected tap point
      const finger = el(root, "abs");
      finger.style.cssText += "left:0;top:0;width:96px;height:120px;transform-origin:40px 6px;filter:drop-shadow(0 14px 16px rgb(4 21 58 / .35));opacity:0;";
      finger.innerHTML = ART.handTap;
      const tapRing = el(root, "abs");
      tapRing.style.cssText += `left:0;top:0;width:100px;height:100px;margin:-50px 0 0 -50px;border-radius:50%;border:5px solid ${BLUE};opacity:0;`;
      // payment + advice billboards
      const cash = W.billboard(C.city, {
        x: doorPt.x - 40,
        y: doorPt.y,
        z: 140,
        w: 260,
        h: 170,
        html: `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:12px">
          <span style="width:120px;height:120px;border-radius:30px;background:#fff;color:${BLUE};display:grid;place-items:center;box-shadow:0 16px 30px -14px rgb(4 21 58 / .5)">${icon("banknote", 76, 1.8)}</span>
          <span style="width:92px;height:92px;border-radius:50%;background:${BLUE};color:#fff;display:grid;place-items:center;box-shadow:0 16px 30px -14px rgb(4 21 58 / .5)">${icon("check", 56, 3)}</span></div>`,
      });
      const callIcon = W.billboard(C.city, {
        x: 220,
        y: 165,
        z: 370,
        w: 190,
        h: 190,
        html: `<div style="position:absolute;inset:0;border-radius:50%;background:${BLUE};color:#fff;display:grid;place-items:center;box-shadow:0 0 0 14px rgb(18 102 232 / .2), 0 24px 40px -16px rgb(4 21 58 / .5)">${icon("phone-call", 96, 1.8)}</div>`,
      });
      const waBubble = W.billboard(C.city, {
        x: 363,
        y: 348,
        z: 690,
        w: 560,
        h: 170,
        html: `<div style="position:absolute;left:0;bottom:0;width:540px;padding:20px 26px;box-sizing:border-box;border-radius:28px 28px 28px 6px;background:#fff;box-shadow:0 24px 40px -16px rgb(4 21 58 / .45);font:500 27px/1.3 Roboto;color:#0f172a">
          <div style="display:flex;align-items:center;gap:10px;color:#25a85a;font-weight:700;margin-bottom:6px">${ART.waIcon(28)} WhatsApp</div>Bonjour, j'aimerais avoir des informations sur vos produits.</div>`,
      });
      const waves = [0, 1, 2].map(() => W.billboard(C.city, { x: 220, y: 165, z: 370, w: 10, h: 10, css: `border-radius:50%;border:5px solid ${BLUE};` }));

      /* ---------- extra motion design ---------- */
      // speed lines whenever the camera moves fast (driven by the camera's own speed)
      const speedLines = FXL.warp(root, { n: 44, color: "rgb(18 102 232 / .45)", width: 4, speed: 3400, len: 320, inner: 220, x: 960, y: 540, seed: 71 });
      // 2D bursts pinned to projected 3D points
      const fxLayer = el(root, "fill");
      const markAt = (x, y, z) => W.marker(C.city, x, y, z);
      const BURSTS = [
        { t0: SH.land, at: markAt(220, 285, 0), n: 26, colors: ["#ffffff", "#cfe3ff", "#9cc6ff"], angle: [195, 345], speed: [300, 800], gravity: 1100, size: [8, 18] },
        { t0: 22.27, at: null, n: 42, colors: [BLUE, "#0b55c6", "#03a14a", "#5aa2ff"], angle: [0, 360], speed: [500, 1300], gravity: 600, size: [16, 30] },
        { t0: 28.72, at: markAt(C.house.doorPt.x - 30, C.house.doorPt.y, 40), n: 30, colors: [BLUE, "#0b55c6", "#5aa2ff", "#ffffff"], angle: [0, 360], speed: [350, 1000], gravity: 500, size: [14, 26] },
      ].map((b, i) => ({ ...b, fx: FXL.shapeBurst(fxLayer, { x: 0, y: 0, t0: b.t0, n: b.n, colors: b.colors, angle: b.angle, speed: b.speed, gravity: b.gravity, size: b.size, seed: 120 + i }), ring: FXL.ringPulse(fxLayer, { x: 0, y: 0, t0: b.t0, r0: 30, r1: 220, width: 5, color: i ? BLUE : "#ffffff", dur: 0.55 }) }));
      // white puffs behind the van while it drives
      const puffs = [0, 1, 2, 3, 4, 5].map(() => W.billboard(C.city, { x: 0, y: 0, z: 10, w: 40, h: 40, css: "border-radius:50%;background:radial-gradient(circle at 38% 36%, #ffffff 0 30%, #bcd4f3);box-shadow:0 4px 10px rgb(9 40 100 / .18);opacity:0;" }));
      // people: walkers on the sidewalks and the corniche, and two shoppers walking into the shop
      const WALK = [
        { y: 316, x0: -1300, x1: 2100, v: 38, ph: 0 },
        { y: 326, x0: 2100, x1: -1300, v: 33, ph: 800 },
        { y: 312, x0: -1300, x1: 2100, v: 41, ph: 1900 },
        { y: 470, x0: 2100, x1: -1300, v: 36, ph: 300 },
        { y: 466, x0: -1300, x1: 2100, v: 30, ph: 1400 },
        { y: 474, x0: -1300, x1: 2100, v: 34, ph: 2600 },
        { y: -1215, x0: -800, x1: 2100, v: 34, ph: 500 },
        { y: -1205, x0: 2100, x1: -800, v: 37, ph: 1500 },
        { y: -1222, x0: -800, x1: 2100, v: 28, ph: 2400 },
        { y: 322, x0: 2100, x1: -1300, v: 40, ph: 2900 },
      ];
      const SHOPPERS = [
        { t0: 6.0, t1: 7.6, a: { x: 120, y: 318 }, b: { x: DOOR.x - 6, y: DOOR.y + 4 } },
        { t0: 6.9, t1: 8.5, a: { x: 560, y: 322 }, b: { x: DOOR.x + 6, y: DOOR.y + 4 } },
      ];
      const people = C.people.map((pb, i) => ({ pb, legs: [pb.d.querySelector(".lg1"), pb.d.querySelector(".lg2")], i }));
      // a soft vignette and a sun glint that sweeps across the wide shots
      const vig = el(root, "fill");
      vig.style.cssText += "background:radial-gradient(ellipse at 50% 46%, transparent 58%, rgb(9 40 100 / .17) 100%);";
      const sun = el(root, "abs");
      sun.style.cssText += "left:0;top:-300px;width:520px;height:1700px;background:linear-gradient(90deg, transparent, rgb(255 255 255 / .42), transparent);opacity:0;";
      const SUN = [4.25, 25.4, 34.3];
      const storeFaces = C.store.faces;
      const glows = (box) => [...box.south.querySelectorAll(".st-glow, .st-lamp"), ...box.west.querySelectorAll(".st-glow, .st-lamp")];
      const dims = (box) => [...box.south.querySelectorAll(".st-dim"), ...box.west.querySelectorAll(".st-dim")];
      const LIGHTS = [
        { t0: SH.lights[0], on: [...glows(C.store.f1)], off: dims(C.store.f1) },
        { t0: SH.lights[1], on: [...glows(C.store.f2), ...C.store.bay.south.querySelectorAll(".st-glow")], off: dims(C.store.f2) },
      ];
      const sheens = storeFaces.map((f) => ({ d: f.querySelector(".st-sheen"), w: f.offsetWidth || parseFloat(f.style.width) }));

      // phone UI geometry (screen-local -> world) for the finger and the box
      const P = L.phone;
      const scl = (P.w - 24) / 390;
      const uiToWorld = (u, v) => {
        const lx = -P.w / 2 + 12 + u * scl;
        const ly = -P.d / 2 + 12 + v * scl;
        const c = Math.SQRT1_2;
        return { x: P.x + lx * c - ly * c, y: P.y + lx * c + ly * c };
      };
      const centerOf = (node) => {
        let u = node.offsetWidth / 2;
        let v = node.offsetHeight / 2;
        for (let n = node; n && !n.classList.contains("ps"); n = n.offsetParent) {
          u += n.offsetLeft;
          v += n.offsetTop;
        }
        return { u, v };
      };
      const tapAdd = centerOf(C.phone.scr(1).querySelector(".ps-add"));
      const tapOpt = centerOf(C.phone.scr(2).querySelector(".ps-opt1"));
      const tapOk = centerOf(C.phone.scr(3).querySelector(".ps-check").nextElementSibling.nextElementSibling.nextElementSibling);
      const TAPS = [
        { t: 19.1, ...uiToWorld(tapAdd.u, tapAdd.v) },
        { t: 20.6, ...uiToWorld(tapOpt.u, tapOpt.v) },
        { t: 22.25, ...uiToWorld(tapOk.u, tapOk.v) },
      ].map((tp) => ({ ...tp, mark: W.marker(C.city, tp.x, tp.y, 24) }));
      BURSTS[1].at = TAPS[2].mark;
      const screens = [1, 2, 3].map((n) => C.phone.scr(n));
      const addBtn = screens[0].querySelector(".ps-add");
      const badges = C.phone.ui.querySelectorAll(".ps-badge");
      const opt1 = screens[1].querySelector(".ps-opt1");
      const check = screens[2].querySelector(".ps-check");
      const okBtn = screens[2].lastElementChild;

      /* ---------- sound ---------- */
      C.buildings
        .filter((b, i) => i % 3 === 0)
        .forEach((b, i) => cue(buildRise(b.dist), "blip", { pitch: 0.8 + ((i * 7) % 9) * 0.07, gain: 0.18 }));
      cue(4.05, "swoosh", { dur: 1.0, gain: 0.45 });
      cue(SH.plate, "thud", { pitch: 0.7, gain: 0.6 });
      SH.cols.forEach((t0, i) => cue(t0, "pop", { pitch: 0.75 + i * 0.12, gain: 0.55 }));
      cue(SH.f1, "glass", { gain: 0.5 });
      cue(SH.f1, "swoosh", { dur: 0.3, gain: 0.35 });
      cue(SH.f2, "glass", { gain: 0.45 });
      cue(SH.bay, "swish", { gain: 0.4 });
      cue(SH.roof, "fall", { dur: 0.25, gain: 0.45 });
      cue(SH.land, "slam", { gain: 0.85 });
      cue(SH.land, "thud", { pitch: 0.6, gain: 0.7 });
      SH.rail.forEach((t0) => cue(t0 + 0.02, "tick", { pitch: 1.0, gain: 0.35 }));
      cue(SH.plaque, "tick", { pitch: 1.5, gain: 0.45 });
      SH.lights.forEach((t0) => cue(t0, "click", { gain: 0.55 }));
      cue(SH.lights[0], "shimmer", { dur: 0.6, gain: 0.35 });
      cue(SH.sheen[0], "swish", { gain: 0.35 });
      cue(SH.sign, "pop", { pitch: 1.1, gain: 0.6 });
      cue(SH.pin, "fall", { dur: 0.25, gain: 0.5 });
      cue(SH.pin + 0.25, "pinDrop", { gain: 0.9 });
      [0, 0.25, 0.5].forEach((d) => cue(SH.pin + 0.25 + d, "sonar", { gain: 0.35 - d * 0.3 }));
      cue(22.27, "shimmer", { dur: 0.7, gain: 0.45 });
      cue(28.72, "shimmer", { dur: 0.6, gain: 0.35 });
      cue(8.85, "whoosh", { dur: 0.65, gain: 1.0, rise: 1 });
      cue(T_SHOW, "impact", { gain: 0.7 });
      FX.flash(T_SHOW, 0.22, "#ffffff", 0.75); // smooth the cut into the showroom
      FX.flash(T_PHONE, 0.16, "#ffffff", 0.55); // and the whip to the phone
      T_ZONE.forEach((tz, i) => {
        cue(tz - 0.4, "whoosh", { dur: 0.35, gain: 0.35, pan: 0.5 });
        cue(tz - 0.2, "pop", { pitch: 0.9 + i * 0.1, gain: 0.55 });
        cue(tz - 0.05, "ding", { pitch: [1, 1.1892, 1.4983, 1.3348, 2][i], gain: 0.35 });
      });
      cue(14.6, "whoosh", { dur: 0.6, gain: 0.6 });
      for (let i = 0; i < 8; i++) cue(T_BRAND + i * 0.25, "punch", { pitch: 1 + (i % 4) * 0.1, gain: 0.7 });
      cue(17.5, "shimmer", { dur: 0.5, gain: 0.45 });
      cue(T_PHONE - 0.25, "whoosh", { dur: 0.3, gain: 0.8, rise: 1 });
      cue(T_DROP + 0.05, "fall", { dur: FALL - 0.05, gain: 0.55 });
      cue(T_LAND, "slam", { gain: 0.75 });
      cue(T_LAND, "thud", { pitch: 0.7, gain: 0.8 });
      TAPS.forEach((tp, i) => {
        cue(tp.t, "click", { gain: 0.9 });
        cue(tp.t + 0.05, "pop", { pitch: 1.2 + i * 0.15, gain: 0.5 });
      });
      cue(20.0, "swish", { gain: 0.45 });
      cue(21.5, "swish", { gain: 0.45 });
      cue(21.8, "ding", { pitch: 1.4983, gain: 0.5 });
      cue(T_BOX, "pop", { pitch: 0.8, gain: 0.7 });
      cue(T_BOX + 0.3, "whoosh", { dur: 0.45, gain: 0.6, pan: 0.4 });
      cue(23.72, "thud", { pitch: 0.9, gain: 0.7 });
      cue(T_VAN, "truck", { dur: 2.4, gain: 0.8 });
      cue(T_VAN + 0.1, "horn", { gain: 0.5 });
      cue(25.25, "whoosh", { dur: 0.8, gain: 0.6 });
      T_PIN.forEach((t0, i) => {
        cue(t0, "fall", { dur: 0.22, gain: 0.4 });
        cue(t0 + 0.22, "pinDrop", { gain: 0.8 });
        cue(t0 + 0.24, "pop", { pitch: 1 + i * 0.2, gain: 0.55 });
      });
      T_SAT.forEach((t0, i) => {
        cue(t0, "swoosh", { dur: 0.5, gain: 0.5, pan: i ? -0.5 : 0.5 });
        cue(t0 + 0.32, "thud", { pitch: 0.8 + i * 0.1, gain: 0.6 });
      });
      T_ARC.forEach((t0, i) => cue(t0, "swish", { gain: 0.45, pan: i ? -0.4 : 0.4 }));
      cue(26.45, "truck", { dur: 1.6, gain: 0.5 });
      cue(27.5, "whoosh", { dur: 0.8, gain: 0.55 });
      cue(28.4, "fall", { dur: 0.3, gain: 0.4 });
      cue(28.7, "thud", { pitch: 1.0, gain: 0.7 });
      cue(28.75, "click", { gain: 0.5 });
      cue(28.85, "cash", { gain: 0.95 });
      cue(T_ADVICE + 0.05, "whoosh", { dur: 0.8, gain: 0.7 });
      cue(31.0, "ring", { dur: 0.6, gain: 0.6 });
      cue(31.7, "ring", { dur: 0.6, gain: 0.45 });
      cue(31.45, "ding", { pitch: 1.4983, gain: 0.55 });
      cue(T_ISLAND, "whoosh", { dur: 1.4, gain: 0.7 });
      cue(T_ISLAND + 0.1, "riserShort", { dur: 1.4, gain: 0.5 });

      function camAt(t) {
        let cam = t < 23.75 ? interp(KEYS, t) : null;
        if (!cam) {
          const v = vanAt(t);
          const follow = { ...interp(KEYS2, t) };
          if (t < 25.2) {
            const k = E.inOutCubic(prog(t, 23.75, 24.3));
            follow.x = lerp(-300, v.x + 60, k);
            follow.y = lerp(470, v.y + 30, k);
            follow.zoom = lerp(1.15, 1.05, k);
            follow.yaw = lerp(-44, -45, k);
            follow.pitch = lerp(57, 56, k);
            follow.z = lerp(20, 0, k);
          } else if (t < 26.1) {
            const k = E.inOutCubic(prog(t, 25.2, 26.1));
            const v0 = vanAt(25.2);
            follow.x = lerp(v0.x + 60, MAP.x, k);
            follow.y = lerp(v0.y + 30, MAP.y, k);
          }
          cam = follow;
        }
        return cam;
      }

      return (t) => {
        /* camera */
        let cam = camAt(t);
        if (window.__CAM) cam = Object.assign({}, cam, window.__CAM); // debug: look at the set from a fixed camera
        // the camera bumps very slightly on every kick of the groove (music sections with four-on-the-floor)
        const GROOVE = [
          [4.0, 9.0],
          [10.0, 14.5],
          [15.5, 17.5],
          [24.0, 34.0],
        ];
        if (GROOVE.some(([a, b]) => t >= a && t < b)) {
          const beat = Math.floor(t * 2 + 1e-6) / 2;
          cam = { ...cam, zoom: cam.zoom * (1 + 0.009 * Math.exp(-(t - beat) * 22)) };
        }
        const sk = M.addShake(shake(t, T_SHOW, 0.35, 10, 20, 3), shake(t, T_LAND, 0.32, 10, 22, 5), shake(t, 28.7, 0.25, 6, 24, 7), shake(t, SH.land, 0.3, 9, 22, 11));
        W.camera({ ...cam, sx: (cam.sx || 960) + sk.x, sy: (cam.sy || 540) + sk.y });
        amb(t, 1);
        // speed lines from the camera's zoom, pan and turn speed
        const c0 = camAt(t - 1 / 30);
        const c1 = camAt(t); // without the beat bump, which must not trigger speed lines
        const vz = Math.abs(Math.log(c1.zoom / c0.zoom)) * 30;
        const vp = (Math.hypot(c1.x - c0.x, c1.y - c0.y) * 30 * c1.zoom) / 1000;
        const vy = (Math.abs(c1.yaw - c0.yaw) * 30) / 100;
        speedLines(t, clamp(0.5 * vz + 0.3 * vp + vy - 0.3));
        // bursts
        BURSTS.forEach((b) => {
          if (t < b.t0 - 0.01 || t > b.t0 + 1.2) {
            b.fx(-1);
            b.ring(-1);
            return;
          }
          const pt = b.at();
          b.fx(t, pt.x, pt.y);
          b.ring(t, pt.x, pt.y);
        });

        const inShow = t >= T_SHOW && t < T_PHONE;
        C.city.style.display = inShow ? "none" : "";
        C.show.g.style.display = inShow ? "" : "none";
        bg.style.background = inShow
          ? "radial-gradient(circle at 50% 30%, #ffffff 0%, #eaf2fd 60%, #d6e5fa 100%)"
          : "radial-gradient(circle at 50% 28%, #f6f9ff 0%, #e4eefc 55%, #cfe0f8 100%)";

        // sun glint over the wide shots
        let sp0 = -1;
        SUN.forEach((ts) => {
          const p = prog(t, ts, ts + 0.9);
          if (p > 0 && p < 1) sp0 = p;
        });
        sun.style.opacity = sp0 < 0 || inShow ? "0" : (0.9 * Math.sin(Math.PI * sp0)).toFixed(3);
        if (sp0 >= 0) sun.style.transform = `translate3d(${lerp(-700, 2100, E.inOutSine(sp0)).toFixed(1)}px,0,0) rotate(20deg)`;

        if (!inShow) {
          /* the corniche: rolling swell and foam, the mosque rises with the city */
          C.corniche.waves.style.backgroundPosition = `${((t * 42) % 104).toFixed(1)}px 0, 0 0`;
          C.corniche.foam.style.backgroundPosition = `${((t * 26) % 24).toFixed(1)}px 0, 0 0`;
          const mk = Math.max(0.001, spring(t - 4.2, 2.0, 0.5));
          C.corniche.mosque.style.transform = `scale3d(1,1,${mk.toFixed(4)})`;

          /* people walking (feet bob, legs swing), shoppers walking into the shop */
          people.forEach(({ pb, legs, i }) => {
            let x;
            let y;
            let dir;
            let op = 1;
            if (i < WALK.length) {
              const w = WALK[i];
              const span = Math.abs(w.x1 - w.x0);
              const s0 = (((t * w.v + w.ph) % span) + span) % span;
              dir = w.x1 > w.x0 ? 1 : -1;
              x = w.x0 + dir * s0;
              y = w.y;
            } else {
              const sh = SHOPPERS[i - WALK.length];
              const k = prog(t, sh.t0, sh.t1);
              x = lerp(sh.a.x, sh.b.x, k);
              y = lerp(sh.a.y, sh.b.y, k);
              dir = sh.b.x > sh.a.x ? 1 : -1;
              op = t < sh.t0 || t > sh.t1 + 0.05 ? 0 : 1 - prog(t, sh.t1 - 0.25, sh.t1);
            }
            const st = Math.sin(t * 9 + i * 1.7);
            pb.p.x = x;
            pb.p.y = y;
            pb.p.z = Math.abs(st) * 2.5;
            pb.extra = `scaleX(${dir})`;
            pb.update();
            pb.d.style.opacity = op.toFixed(3);
            legs[0].style.transform = `translateY(${(-2.2 * st).toFixed(2)}px)`;
            legs[1].style.transform = `translateY(${(2.2 * st).toFixed(2)}px)`;
          });

          /* a few birds crossing the city */
          C.birds.forEach((bd, i) => {
            const u = t - 4 + i * 0.35;
            bd.p.x = -1500 + u * 120 + (i % 2) * 60;
            bd.p.y = 500 - u * 60 + i * 40;
            bd.p.z = 520 + 30 * Math.sin(u * 1.3 + i);
            bd.update();
            const f = 34 * Math.sin(t * 13 + i * 1.1);
            bd.wings[0].style.transform = `rotate(${f.toFixed(1)}deg)`;
            bd.wings[1].style.transform = `rotate(${(-f).toFixed(1)}deg)`;
          });

          /* clouds: only in the wide shots */
          const cz = clamp((0.85 - cam.zoom) / 0.3) * prog(t, 4.2, 4.9);
          C.clouds.forEach((cl) => {
            const x = cl.x + (t - 4) * cl.speed;
            cl.b.p.x = x;
            cl.b.update();
            cl.b.d.style.opacity = cz.toFixed(3);
            cl.shadow.style.transform = `translate3d(${(x - 170 * cl.k).toFixed(1)}px,${cl.y - 60 * cl.k}px,1.1px)`;
            cl.shadow.style.opacity = cz.toFixed(3);
          });

          /* city build-up */
          for (const b of C.buildings) {
            const k = Math.max(0.001, spring(t - buildRise(b.dist), 2.2, 0.5));
            b.g.style.transform = `translate3d(${b.x}px,${b.y}px,0) scale3d(1,1,${k.toFixed(4)})`;
            b.shadow.style.opacity = clamp(k).toFixed(3);
          }
          for (const tr of C.trees) {
            const k = Math.max(0, spring(t - (4.5 + tr.dist / 3000), 3, 0.45));
            tr.b.extra = `scale(${k.toFixed(3)})`;
            tr.b.update();
          }
          /* the shop assembles itself: plate, pillars, glass floors, bay, roof slam, railing, "41",
             lights on, sheen, sign, pin */
          const S = C.store;
          const st = L.store;
          const grow = (box, t0, f = 2.6, d = 0.45) => {
            const k = Math.max(0.001, spring(t - t0, f, d));
            const b = box.b;
            box.g.style.transform = `translate3d(${b.x}px,${b.y}px,${b.z || 0}px) scale3d(1,1,${k.toFixed(4)})`;
            box.g.style.visibility = t > t0 ? "visible" : "hidden";
          };
          const pk = Math.max(0.001, spring(t - SH.plate, 2.4, 0.5));
          const pb = S.plate.b;
          S.plate.g.style.transform = `translate3d(${pb.x + pb.w / 2}px,${pb.y + pb.d / 2}px,0) scale3d(${pk.toFixed(4)},${pk.toFixed(4)},1) translate3d(${-pb.w / 2}px,${-pb.d / 2}px,0)`;
          S.plate.g.style.visibility = t > SH.plate ? "visible" : "hidden";
          S.cols.forEach((c, i) => grow(c, SH.cols[i], 2.8, 0.4));
          grow(S.f1, SH.f1);
          grow(S.slab, SH.slab, 3, 0.5);
          grow(S.f2, SH.f2);
          const bk = Math.max(0, spring(t - SH.bay, 2.6, 0.5));
          const bb = S.bay.b;
          S.bay.g.style.transform = `translate3d(${bb.x}px,${(bb.y - 22 * (1 - bk)).toFixed(1)}px,${bb.z}px)`;
          S.bay.g.style.visibility = t > SH.bay ? "visible" : "hidden";
          const rb = S.roof.b;
          const rh = M.gravityDrop(t - SH.roof, 520, SH.land - SH.roof, 0.08, 1);
          S.roof.g.style.transform = `translate3d(${rb.x}px,${rb.y}px,${(rb.z + rh).toFixed(1)}px)`;
          S.roof.g.style.visibility = t > SH.roof ? "visible" : "hidden";
          const dp = prog(t, SH.land, SH.land + 0.7);
          const de = 30 + 260 * E.outCubic(dp);
          S.dust.style.width = st.w + 2 * de + "px";
          S.dust.style.height = st.d + 2 * de + "px";
          S.dust.style.transform = `translate3d(${st.x - de}px,${st.y - de}px,1.3px)`;
          S.dust.style.opacity = dp > 0 && dp < 1 ? (0.9 * (1 - dp) * (1 - dp)).toFixed(3) : "0";
          S.rail.forEach((r, i) => {
            grow(r.base, SH.rail[i], 3, 0.5);
            const k = clamp(spring(t - SH.rail[i] - 0.03, 3, 0.5));
            r.fence.style.clipPath = `inset(${((1 - k) * 100).toFixed(1)}% 0 0 0)`;
          });
          S.plaque.style.transform = `scaleY(${clamp(E.outBack(prog(t, SH.plaque, SH.plaque + 0.22)), 0, 1.3).toFixed(3)})`;
          LIGHTS.forEach((lt) => {
            const k = prog(t, lt.t0, lt.t0 + 0.14);
            const v = k > 0 && k < 1 && Math.floor(t * 60) % 2 ? 0.35 * k : k; // a quick flicker as they come on
            lt.on.forEach((e) => (e.style.opacity = v.toFixed(3)));
            lt.off.forEach((e) => (e.style.opacity = (1 - v).toFixed(3)));
          });
          let sp = -1;
          SH.sheen.forEach((ts) => {
            const p = prog(t, ts, ts + 0.55);
            if (p > 0 && p < 1) sp = E.inOutCubic(p);
          });
          sheens.forEach((sn) => (sn.d.style.transform = `translateX(${(sp < 0 ? -140 : lerp(-140, sn.w + 60, sp)).toFixed(1)}px) skewX(-18deg)`));
          const sg = Math.max(0, spring(t - SH.sign, 3, 0.45));
          sh0.style.opacity = t > SH.sign ? "1" : "0";
          sh0.style.filter = `drop-shadow(0 0 ${(18 * (0.6 + 0.4 * Math.sin(t * 4))).toFixed(1)}px rgb(18 102 232 / .7))`;
          sh0.style.transform = `${signBase} translate(150px,48px) scale(${sg.toFixed(3)}) translate(-150px,-48px)`;

          /* shop pin */
          const pinLand = SH.pin + 0.25;
          const ph = M.gravityDrop(t - SH.pin, 600, 0.25, 0.14, 2);
          pinStore.p.z = 330 + ph;
          pinStore.extra = `scale(${(1 + squash(t, pinLand, 0.18, 5, 9)).toFixed(3)},${(1 - squash(t, pinLand, 0.18, 5, 9)).toFixed(3)})`;
          pinStore.update();
          pinStore.d.style.opacity = t > SH.pin && t < 8.9 ? "1" : "0";
          pinRings.forEach((rg, i) => {
            const rp = prog(t, pinLand + i * 0.25, pinLand + i * 0.25 + 0.9);
            const rr = 20 + 260 * E.outCubic(rp);
            rg.style.width = rg.style.height = 2 * rr + "px";
            rg.style.transform = `translate3d(${220 - rr}px,${300 - rr}px,1px)`;
            rg.style.opacity = rp > 0 && rp < 1 ? (1 - rp).toFixed(3) : "0";
          });

          /* traffic (north lane westbound, never in the van's lane) */
          C.cars.forEach((c, i) => {
            const span = 3600;
            const s = (((t * c.speed + c.off) % span) + span) % span;
            if (i < 4) c.g.style.transform = `translate3d(${(2200 - s).toFixed(1)}px,${(i % 2 ? 378 : 372).toFixed(0)}px,0) rotateZ(180deg)`;
            else c.g.style.transform = `translate3d(${(L.streetB.x + 62).toFixed(0)}px,${(-1100 + s * 0.75).toFixed(1)}px,0) rotateZ(90deg)`;
          });

          /* the giant phone drops into the plaza */
          const phn = C.phone;
          const fallH = M.gravityDrop(t - T_DROP, 1500, FALL, 0.05, 2);
          const tilt = 24 * (1 - E.outCubic(prog(t, T_DROP, T_LAND)));
          const pq = squash(t, T_LAND, 0.05, 6, 10);
          phn.body.style.display = t > T_DROP ? "" : "none";
          phn.body.style.transform = `translate3d(0,0,${fallH.toFixed(1)}px) rotateX(${tilt.toFixed(2)}deg) scale3d(${(1 + pq).toFixed(4)},${(1 + pq).toFixed(4)},1) translate3d(${-P.w / 2}px,${-P.d / 2}px,0)`;
          phn.shadow.style.opacity = t > T_DROP ? (1 - fallH / 1500).toFixed(3) : "0";
          phn.rings.forEach((rg, i) => {
            const rp = prog(t, T_LAND + i * 0.08, T_LAND + i * 0.08 + 0.45);
            const e = 14 + 120 * E.outCubic(rp);
            rg.style.width = P.w + 2 * e + "px";
            rg.style.height = P.d + 2 * e + "px";
            rg.style.transform = `translate3d(${-P.w / 2 - e}px,${-P.d / 2 - e}px,1.2px)`;
            rg.style.opacity = rp > 0 && rp < 1 ? ((i ? 0.45 : 0.85) * (1 - rp) * (1 - rp)).toFixed(3) : "0";
          });

          /* phone screens + finger taps */
          const scrIdx = t < T_STEP[1] ? 0 : t < T_STEP[2] ? 1 : 2;
          screens.forEach((s, i) => {
            const enter = i === 0 ? 1 : E.outCubic(prog(t, T_STEP[i], T_STEP[i] + 0.3));
            s.style.display = i <= scrIdx ? "" : "none";
            s.style.transform = `translateX(${((1 - enter) * 390).toFixed(1)}px)`;
          });
          const tap = TAPS.find((tp) => t > tp.t - 0.45 && t < tp.t + 0.5) || null;
          const fingerOn = tap && t > 18.6 && t < 22.8;
          finger.style.opacity = fingerOn ? "1" : "0";
          tapRing.style.opacity = "0";
          if (fingerOn) {
            const pt = tap.mark();
            const press = Math.sin(Math.PI * prog(t, tap.t - 0.07, tap.t + 0.09));
            const away = 1 - E.outCubic(prog(t, tap.t - 0.45, tap.t - 0.1)) + E.inCubic(prog(t, tap.t + 0.2, tap.t + 0.5));
            const s = cam.zoom * 0.95 * (1 - 0.1 * press) * (1 + 0.12 * away);
            finger.style.transform = `translate3d(${(pt.x - 40 + 90 * away).toFixed(1)}px,${(pt.y - 6 + 130 * away).toFixed(1)}px,0) scale(${s.toFixed(3)})`;
            const rp = prog(t, tap.t, tap.t + 0.45);
            if (rp > 0 && rp < 1) {
              tapRing.style.opacity = (1 - rp).toFixed(3);
              tapRing.style.transform = `translate3d(${pt.x.toFixed(1)}px,${pt.y.toFixed(1)}px,0) scale(${(0.3 + 1.2 * E.outCubic(rp)).toFixed(3)})`;
            }
          }
          addBtn.style.filter = `brightness(${(1 + 0.4 * Math.sin(Math.PI * prog(t, 19.05, 19.3))).toFixed(3)})`;
          badges.forEach((bd) => {
            bd.style.display = t > 19.2 ? "" : "none";
            bd.style.transform = `scale(${(1 + squash(t, 19.2, 0.6, 4, 8)).toFixed(3)})`;
          });
          const sel = t > 20.6;
          opt1.style.boxShadow = sel ? `inset 0 0 0 3px ${BLUE}` : "inset 0 0 0 2px #e3e6e8";
          opt1.style.background = sel ? "#e9f1fd" : "#fff";
          check.style.transform = `scale(${Math.max(0, spring(t - 21.8, 3, 0.45)).toFixed(3)})`;
          okBtn.style.filter = `brightness(${(1 + 0.4 * Math.sin(Math.PI * prog(t, 22.2, 22.45))).toFixed(3)})`;

          /* parcel: out of the phone, into the van, out at the house */
          const v = vanAt(t);
          const cargo = (vv) => ({ x: vv.x + 52 * Math.cos((vv.r * Math.PI) / 180) - 29 * Math.sin((vv.r * Math.PI) / 180), y: vv.y + 52 * Math.sin((vv.r * Math.PI) / 180) + 29 * Math.cos((vv.r * Math.PI) / 180) });
          let bx = null;
          if (t >= T_BOX && t < 23.72) {
            const up = E.outBack(prog(t, T_BOX, T_BOX + 0.3));
            const fly = E.inOutSine(prog(t, T_BOX + 0.3, 23.72));
            const c0 = cargo(vanAt(T_BOX));
            bx = { x: lerp(P.x, c0.x, fly), y: lerp(P.y, c0.y, fly), z: 24 + 150 * up * (1 - fly) + 260 * Math.sin(Math.PI * fly) * 0.5 + 40 * fly, r: 360 * fly };
          } else if (t >= 28.35 && t < 31) {
            const c1 = cargo(vanAt(T_ARRIVE));
            const hop = E.inOutSine(prog(t, 28.35, 28.7));
            bx = { x: lerp(c1.x, doorPt.x - 40, hop), y: lerp(c1.y, doorPt.y, hop), z: 40 * (1 - hop) + 120 * Math.sin(Math.PI * hop), r: 0 };
          }
          C.box.style.display = bx ? "" : "none";
          if (bx) C.box.style.transform = `translate3d(${bx.x}px,${bx.y}px,${bx.z}px) rotateZ(${bx.r}deg)`;
          C.van.style.display = t > 22.5 ? "" : "none";
          C.van.style.transform = `translate3d(${v.x}px,${v.y}px,${(Math.abs(Math.sin(t * 30)) * 1.5 * (t > T_VAN && t < T_ARRIVE ? 1 : 0)).toFixed(2)}px) rotateZ(${v.r}deg)`;
          puffs.forEach((pf, i) => {
            const period = 0.36;
            const age = (((t - T_VAN + i * (period / puffs.length)) % period) + period) % period;
            const born = t - age;
            const moving = born > T_VAN && born < T_ARRIVE - 0.2;
            pf.d.style.opacity = moving ? (0.85 * (1 - age / period)).toFixed(3) : "0";
            if (!moving) return;
            const vb = vanAt(born);
            const ra = (vb.r * Math.PI) / 180;
            pf.p.x = vb.x - 6 * Math.cos(ra) - 44 * Math.sin(ra);
            pf.p.y = vb.y - 6 * Math.sin(ra) + 44 * Math.cos(ra);
            pf.p.z = 8 + 50 * age;
            pf.extra = `scale(${(0.35 + 1.6 * (age / period)).toFixed(3)})`;
            pf.update();
          });
          // the van's back sits at its origin: shift so the parcel lands in the cargo area
          const door = C.house.door;
          door.style.transform = `scaleX(${(1 - 0.75 * E.outCubic(prog(t, 28.7, 29.0))).toFixed(3)})`;
          const ck = Math.max(0, spring(t - 28.85, 3, 0.45));
          cash.extra = `scale(${ck.toFixed(3)})`;
          cash.p.z = 150 + 10 * Math.sin(t * 3);
          cash.update();
          cash.d.style.opacity = t > 28.85 && t < 30.4 ? "1" : "0";

          /* delivery zone: islands rise, pins drop, arcs draw and a van icon flies each one */
          C.sats.forEach((st, i) => {
            const vis = t > T_SAT[i];
            st.g.style.display = vis ? "" : "none";
            if (!vis) return;
            const k = spring(t - T_SAT[i], 1.7, 0.55);
            st.g.style.transform = `translate3d(${st.x}px,${st.y}px,${(-2600 * (1 - k) + 7 * Math.sin(t * 1.7 + i * 2)).toFixed(1)}px)`;
            st.disc.style.opacity = (prog(t, T_SAT[i] + 0.3, T_SAT[i] + 0.6) * (0.75 + 0.25 * Math.sin(t * 5 + i))).toFixed(3);
            st.trees.forEach((tr, j) => {
              tr.b.extra = `scale(${Math.max(0, spring(t - T_SAT[i] - 0.3 - j * 0.06, 3, 0.45)).toFixed(3)})`;
              tr.b.update();
            });
          });
          C.pins.forEach((pn, i) => {
            const t0 = T_PIN[i];
            const q = squash(t, t0 + 0.22, 0.22, 5, 9);
            const out = E.inBack(prog(t, 27.7, 28.0));
            const sc = PIN_S * (1 - out);
            pn.p.z = pn.z0 + M.gravityDrop(t - t0, 1100, 0.22, 0.14, 2);
            pn.extra = `scale(${(sc * (1 + q)).toFixed(3)},${(sc * (1 - q)).toFixed(3)})`;
            pn.update();
            pn.d.style.opacity = t > t0 && out < 1 ? "1" : "0";
          });
          C.routes.forEach((rt, i) => {
            const k = E.inOutCubic(prog(t, T_ARC[i], T_ARC[i] + 0.7));
            const on = k > 0 && t < 28.05;
            rt.d.style.display = on ? "" : "none";
            if (on) {
              rt.d.style.clipPath = `inset(-80px ${((1 - k) * rt.len).toFixed(1)}px -80px -80px)`;
              rt.d.style.opacity = (1 - prog(t, 27.75, 28.05)).toFixed(3);
              rt.dash.setAttribute("stroke-dashoffset", (-t * 170).toFixed(1));
            }
            const u = E.inOutSine(prog(t, T_ARC[i] + 0.55, T_ARC[i] + 1.4));
            const ride = t > T_ARC[i] + 0.55 && t < T_ARC[i] + 1.55;
            rt.rider.d.style.opacity = ride ? "1" : "0";
            if (ride) {
              const pt = rt.at(u);
              Object.assign(rt.rider.p, pt);
              rt.rider.extra = `scale(${(2.1 * Math.min(1, u * 8, (1.55 - (t - T_ARC[i])) * 7)).toFixed(3)})`;
              rt.rider.update();
            }
          });

          /* advice: call icon ringing above the shop, WhatsApp bubble */
          const ci = Math.max(0, spring(t - 30.9, 2.8, 0.45));
          callIcon.extra = `scale(${ci.toFixed(3)}) rotate(${(wobble(t, 31.0, 14, 8, 3) + wobble(t, 31.7, 12, 8, 3)).toFixed(2)}deg)`;
          callIcon.p.z = 370 + 12 * Math.sin(t * 2.4);
          callIcon.update();
          callIcon.d.style.opacity = t > 30.9 && t < T_ISLAND + 0.6 ? "1" : "0";
          waves.forEach((wv, i) => {
            const p = ((t - 31.0 - i * 0.33) % 1.0 + 1.0) % 1.0;
            const on = t > 31.0 + i * 0.33 && t < T_ISLAND;
            const rr = 100 + 80 * p;
            wv.d.style.width = wv.d.style.height = 2 * rr + "px";
            wv.d.style.left = -rr + "px";
            wv.d.style.top = -rr - 95 + "px";
            wv.d.style.opacity = on ? (1 - p).toFixed(3) : "0";
            wv.p.z = callIcon.p.z;
            wv.update();
          });
          const wb = Math.max(0, spring(t - 31.45, 3, 0.48));
          waBubble.extra = `scale(${wb.toFixed(3)})`;
          waBubble.p.z = 690 + 10 * Math.sin(t * 2);
          waBubble.update();
          waBubble.d.style.transformOrigin = "0% 100%";
          waBubble.d.style.opacity = t > 31.45 && t < T_ISLAND + 0.6 ? "1" : "0";
        } else {
          /* showroom */
          C.show.shoppers.forEach((pb, i) => {
            const sw = Math.sin(t * 2.2 + i * 1.9);
            pb.extra = `scale(${(2.6 * (i % 2 ? -1 : 1)).toFixed(2)},2.6) rotate(${(1.5 * sw).toFixed(2)}deg)`;
            pb.update();
          });
          C.show.zones.forEach((z, i) => {
            const ta = T_ZONE[i] - 0.3;
            z.items.forEach((g, j) => {
              const k = Math.max(0.001, spring(t - ta - j * 0.08, 2.6, 0.45));
              g.style.scale = `1 1 ${k.toFixed(4)}`;
            });
            const lk = Math.max(0, spring(t - (T_ZONE[i] - 0.15), 3, 0.45)) * (1 - E.inBack(prog(t, 14.7, 15.0)));
            z.label.extra = `scale(${lk.toFixed(3)})`;
            const next = i < 4 ? T_ZONE[i + 1] : 14.9;
            z.glow.style.opacity = (prog(t, T_ZONE[i] - 0.25, T_ZONE[i] + 0.05) * (1 - prog(t, next - 0.25, next + 0.05))).toFixed(3);
            const rp = prog(t, T_ZONE[i] - 0.12, T_ZONE[i] + 0.6);
            const rr = 140 + 170 * E.outCubic(rp);
            z.ring.style.width = z.ring.style.height = 2 * rr + "px";
            z.ring.style.transform = `translate3d(${z.cx - rr}px,${z.cy - rr}px,0.7px)`;
            z.ring.style.opacity = rp > 0 && rp < 1 ? (0.85 * (1 - rp)).toFixed(3) : "0";
            z.label.p.z = 250 + 8 * Math.sin(t * 3 + i);
            z.label.update();
          });
          C.show.brandPanels.forEach((p, i) => {
            const tb = T_BRAND + i * 0.25;
            const on = t >= tb;
            const flash = on ? Math.exp(-(t - tb) * 6) : 0;
            const pulse = t > 17.5 ? 0.5 + 0.5 * Math.sin((t - 17.5) * 10) : 0;
            const fp = prog(t, tb - 0.07, tb + 0.07); // the panel flips over; the lit side shows from the beat
            const flip = fp > 0 && fp < 1 ? Math.abs(Math.cos(Math.PI * fp)) : 1;
            p.style.background = on ? BLUE : "#eef4fc";
            p.style.color = on ? "#fff" : "#9fb3cc";
            p.style.boxShadow = on ? `0 0 ${(30 + 40 * flash + 20 * pulse).toFixed(0)}px rgb(18 102 232 / ${(0.4 + 0.5 * flash).toFixed(2)})` : "inset 0 0 0 3px #dbe6f7";
            p.style.transform = `scale(${(1 + 0.12 * flash).toFixed(3)},${(flip * (1 + 0.12 * flash)).toFixed(3)})`;
          });
        }
      };
    },
    5,
  ),
);
