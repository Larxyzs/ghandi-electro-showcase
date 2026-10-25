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

      /* ---------- camera keyframes ---------- */
      // sx/sy: where the focus point sits on screen (lets captions keep their side of the frame free)
      const K = (t, x, y, z, zoom, yaw, pitch, ease = E.inOutCubic, sx = 960, sy = 540) => ({ t, x, y, z, zoom, yaw, pitch, ease, sx, sy });
      const ZZ = 1.5; // showroom zone close-ups: products centre-right, univers card bottom-left
      const KEYS = [
        K(4.0, 300, 200, 0, 0.4, -34, 56),
        K(5.6, 250, 190, 20, 0.62, -40, 56, E.outCubic, 1080, 470),
        K(8.75, 220, 235, 50, 0.95, -50, 55, E.inOutSine, 1240, 400),
        K(9.5, 220, 300, 55, 7.5, -48, 50, E.inCubic, 960, 540),
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
        z: 290,
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
        z: 330,
        w: 190,
        h: 190,
        html: `<div style="position:absolute;inset:0;border-radius:50%;background:${BLUE};color:#fff;display:grid;place-items:center;box-shadow:0 0 0 14px rgb(18 102 232 / .2), 0 24px 40px -16px rgb(4 21 58 / .5)">${icon("phone-call", 96, 1.8)}</div>`,
      });
      const waBubble = W.billboard(C.city, {
        x: 363,
        y: 348,
        z: 650,
        w: 560,
        h: 170,
        html: `<div style="position:absolute;left:0;bottom:0;width:540px;padding:20px 26px;box-sizing:border-box;border-radius:28px 28px 28px 6px;background:#fff;box-shadow:0 24px 40px -16px rgb(4 21 58 / .45);font:500 27px/1.3 Roboto;color:#0f172a">
          <div style="display:flex;align-items:center;gap:10px;color:#25a85a;font-weight:700;margin-bottom:6px">${ART.waIcon(28)} WhatsApp</div>Bonjour, j'aimerais avoir des informations sur vos produits.</div>`,
      });
      const waves = [0, 1, 2].map(() => W.billboard(C.city, { x: 220, y: 165, z: 330, w: 10, h: 10, css: `border-radius:50%;border:5px solid ${BLUE};` }));

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
      cue(4.75, "thud", { pitch: 0.75, gain: 0.8 });
      cue(5.15, "pop", { pitch: 1.1, gain: 0.6 });
      cue(5.2, "fall", { dur: 0.22, gain: 0.5 });
      cue(5.42, "pinDrop", { gain: 0.9 });
      [0, 0.25, 0.5].forEach((d) => cue(5.42 + d, "sonar", { gain: 0.35 - d * 0.3 }));
      cue(8.85, "whoosh", { dur: 0.65, gain: 1.0, rise: 1 });
      cue(T_SHOW, "impact", { gain: 0.7 });
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

      return (t) => {
        /* camera */
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
        const sk = M.addShake(shake(t, T_SHOW, 0.35, 10, 20, 3), shake(t, T_LAND, 0.32, 10, 22, 5), shake(t, 28.7, 0.25, 6, 24, 7));
        W.camera({ ...cam, sx: (cam.sx || 960) + sk.x, sy: (cam.sy || 540) + sk.y });
        amb(t, 1);

        const inShow = t >= T_SHOW && t < T_PHONE;
        C.city.style.display = inShow ? "none" : "";
        C.show.g.style.display = inShow ? "" : "none";
        bg.style.background = inShow
          ? "radial-gradient(circle at 50% 30%, #ffffff 0%, #eaf2fd 60%, #d6e5fa 100%)"
          : "radial-gradient(circle at 50% 28%, #f6f9ff 0%, #e4eefc 55%, #cfe0f8 100%)";

        if (!inShow) {
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
          const ks = Math.max(0.001, spring(t - 4.6, 2, 0.42));
          C.store.g.style.transform = `translate3d(${L.store.x}px,${L.store.y}px,0) scale3d(1,1,${ks.toFixed(4)})`;
          const sg = Math.max(0, spring(t - 5.1, 3, 0.45));
          sh0.style.opacity = t > 5.1 ? "1" : "0";
          sh0.style.filter = `drop-shadow(0 0 ${(18 * (0.6 + 0.4 * Math.sin(t * 4))).toFixed(1)}px rgb(18 102 232 / .7))`;
          sh0.style.transform = `${signBase} translate(150px,48px) scale(${sg.toFixed(3)}) translate(-150px,-48px)`;

          /* shop pin */
          const ph = M.gravityDrop(t - 5.2, 600, 0.22, 0.14, 2);
          pinStore.p.z = 290 + ph;
          pinStore.extra = `scale(${(1 + squash(t, 5.42, 0.18, 5, 9)).toFixed(3)},${(1 - squash(t, 5.42, 0.18, 5, 9)).toFixed(3)})`;
          pinStore.update();
          pinStore.d.style.opacity = t > 5.2 && t < 8.9 ? "1" : "0";
          pinRings.forEach((rg, i) => {
            const rp = prog(t, 5.42 + i * 0.25, 5.42 + i * 0.25 + 0.9);
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
          callIcon.p.z = 330 + 12 * Math.sin(t * 2.4);
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
          waBubble.p.z = 650 + 10 * Math.sin(t * 2);
          waBubble.update();
          waBubble.d.style.transformOrigin = "0% 100%";
          waBubble.d.style.opacity = t > 31.45 && t < T_ISLAND + 0.6 ? "1" : "0";
        } else {
          /* showroom */
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
            const on = t >= T_BRAND + i * 0.25;
            const flash = on ? Math.exp(-(t - T_BRAND - i * 0.25) * 6) : 0;
            const pulse = t > 17.5 ? 0.5 + 0.5 * Math.sin((t - 17.5) * 10) : 0;
            p.style.background = on ? BLUE : "#eef4fc";
            p.style.color = on ? "#fff" : "#9fb3cc";
            p.style.boxShadow = on ? `0 0 ${(30 + 40 * flash + 20 * pulse).toFixed(0)}px rgb(18 102 232 / ${(0.4 + 0.5 * flash).toFixed(2)})` : "inset 0 0 0 3px #dbe6f7";
            p.style.transform = `scale(${(1 + 0.12 * flash).toFixed(3)})`;
          });
        }
      };
    },
    5,
  ),
);
