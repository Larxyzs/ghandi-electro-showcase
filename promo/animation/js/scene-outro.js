/* Scene 7 (20.85 – 25 s): swipe up onto a stylised Casablanca map, streets draw, the pin drops on
   Boulevard Ghandi with sonar rings, the store card types the address; then a blue iris opens on
   the final logo lock-up with phone, website and address. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "outro",
    20.85,
    25.5,
    (root) => {
      const { el, E, prog, clamp, lerp, cue, tf, shake, spring, gravityDrop, squash, icon } = M;
      const BLUE = ART.BLUE;
      const T_IN = 20.85;
      const PIN = { x: 1330, y: 760 }; // on the boulevard, in map coordinates
      const SCREEN_PIN = { x: 700, y: 640 };
      const T_LAND = 21.5;
      const T_IRIS = 22.5;
      const T_HIT = 23.0;

      /* ---------- map ---------- */
      const mapLayer = el(root, "fill");
      mapLayer.style.background = "linear-gradient(180deg, #dfeafb 0%, #eef3f9 40%)";
      const mapStage = el(mapLayer, "fill");
      mapStage.style.perspective = "1400px";
      mapStage.style.perspectiveOrigin = `${SCREEN_PIN.x}px ${SCREEN_PIN.y}px`;
      const mapCam = el(mapStage, "fill");
      mapCam.style.transformOrigin = `${SCREEN_PIN.x}px ${SCREEN_PIN.y}px`;
      const map = el(mapCam, "abs");
      map.innerHTML = ART.cityMap();
      map.style.transformOrigin = "0 0";
      const streets = M.prepDraw(map.querySelectorAll(".street, .avenue"));
      const blvd = M.prepDraw(map.querySelectorAll(".blvd, .blvd-base"));
      const blvdText = map.querySelector("textPath").parentNode;

      const fog = el(mapLayer, "fill");
      fog.style.background = "linear-gradient(180deg, #e6effc 0%, rgb(230 239 252 / .85) 14%, rgb(230 239 252 / 0) 34%)";
      const pinShadow = el(mapLayer, "abs");
      pinShadow.style.cssText += "width:90px;height:26px;border-radius:50%;background:radial-gradient(closest-side, rgb(4 21 58 / .45), transparent);";
      const rings = [0, 1, 2].map(() => {
        const r = el(mapLayer, "abs");
        r.style.cssText += `border-radius:50%;border:5px solid ${BLUE};`;
        return r;
      });
      const pin = el(mapLayer, "abs");
      pin.innerHTML = ART.pinSVG;
      pin.style.cssText += "width:120px;height:160px;transform-origin:60px 156px;filter:drop-shadow(0 10px 12px rgb(4 21 58 / .3));";

      const card = el(mapLayer, "card");
      card.style.cssText += "left:880px;top:330px;width:820px;padding:40px 46px;box-sizing:border-box;transform-origin:0% 60%;border-radius:32px;";
      card.innerHTML = `<div style="display:flex;align-items:center;gap:12px;font:700 22px Roboto;letter-spacing:.22em;color:${BLUE}">${icon("store", 28, 2)} NOTRE MAGASIN</div>
        <div class="addr hd" style="font-size:60px;margin-top:20px;color:#0f172a;min-height:62px"></div>
        <div class="city" style="font:500 32px Roboto;color:#5f6368;margin-top:14px">Casablanca, Maroc</div>
        <div style="height:2px;background:#e3e6e8;margin:26px 0 22px"></div>
        <div class="h1" style="display:flex;align-items:center;gap:14px;font:400 27px Roboto;color:#0f172a">${icon("clock", 30, 2).replace("<svg", `<svg style="color:${BLUE}"`)}<b>Lundi – Samedi</b>&nbsp;9h00 – 13h00 · 15h00 – 20h00</div>
        <div class="h2" style="display:flex;align-items:center;gap:14px;font:400 27px Roboto;color:#5f6368;margin-top:12px;padding-left:44px">Dimanche : Fermé</div>`;
      const addr = card.querySelector(".addr");
      const city = card.querySelector(".city");
      const hrs = [card.querySelector(".h1"), card.querySelector(".h2")];
      const ADDR = "41 Boulevard Ghandi";

      /* ---------- final lock-up ---------- */
      const fin = el(root, "fill");
      const finBg = el(fin, "fill");
      finBg.style.background = "radial-gradient(circle at 50% 38%, #3a8dff 0%, #1266e8 45%, #0a48a8 100%)";
      const rays = el(fin, "fill");
      rays.style.cssText += `inset:-700px;background:repeating-conic-gradient(from 0deg at 50% 50%, rgb(255 255 255 / .08) 0deg 5deg, transparent 5deg 15deg);
        -webkit-mask-image:radial-gradient(circle at 50% 50%, #000 0%, transparent 52%);`;
      const bokeh = [];
      const r = M.rng(99);
      for (let i = 0; i < 40; i++) {
        const b = el(fin, "pt");
        const s = 3 + r() * 9;
        b.style.cssText += `width:${s}px;height:${s}px;background:#dbeaff;box-shadow:0 0 ${s * 2}px #9cc6ff;`;
        bokeh.push({ b, x: r() * 1920, y: r() * 1080, v: 30 + r() * 70, a: 10 + r() * 30, f: 0.3 + r() * 0.8, ph: r() * 6, o: 0.2 + r() * 0.5 });
      }
      const lock = el(fin, "fill");
      lock.style.transformOrigin = "960px 420px";
      const HS = 1.45;
      const house3dWrap = el(lock, "fill");
      house3dWrap.style.perspective = "1100px";
      house3dWrap.style.perspectiveOrigin = "960px 260px";
      const house = el(house3dWrap, "abs");
      house.style.cssText += `left:${960 - 120 * HS}px;top:96px;width:${240 * HS}px;height:${220 * HS}px;`;
      house.innerHTML = ART.logoHouse({ ink: "#ffffff", fill: "#ffffff", detail: BLUE, hl: "#b7d3ff", vent: "#ffffff" });
      const drum = house.querySelector(".lh-drum");
      // extrusion: darker copies stacked behind the white face
      house.style.transformStyle = "preserve-3d";
      const front = house.firstElementChild;
      for (let i = 12; i >= 1; i--) {
        const layer = el(null, "fill");
        const shade = i > 9 ? "#082f74" : "#0b4fb8";
        layer.innerHTML = ART.logoHouse({ ink: shade, fill: shade, detail: shade, hl: shade, vent: shade });
        layer.style.transform = `translateZ(${-i * 3.2}px)`;
        house.insertBefore(layer, front);
      }
      front.style.transform = "translateZ(0.5px)";
      const finFx = [
        FXL.lineBurst(fin, { x: 960, y: 260, t0: T_HIT, n: 20, r0: 260, r1: 760, width: 8, dur: 0.5, seed: 81 }),
        FXL.shapeBurst(fin, { x: 960, y: 300, t0: T_HIT, n: 30, speed: [700, 1600], colors: ["#ffffff", "#cfe3ff", "#9cc6ff"], seed: 82, gravity: 500 }),
        FXL.ringPulse(fin, { x: 960, y: 260, t0: T_HIT + 0.1, r0: 120, r1: 760, width: 3, color: "rgb(255 255 255 / .6)", dur: 0.8 }),
      ];
      const ORB = { x: 960, y: 262, rx: 330, k: 0.26 };
      const orbits = [-12, 14].map((rot, i) => {
        const o = el(lock, "abs");
        o.style.cssText += `left:${ORB.x - ORB.rx}px;top:${ORB.y - ORB.rx * ORB.k}px;width:${2 * ORB.rx}px;height:${2 * ORB.rx * ORB.k}px;border-radius:50%;border:2px solid rgb(255 255 255 / .35);`;
        lock.insertBefore(o, house3dWrap);
        const e = el(lock, "abs");
        e.style.cssText += "width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#fff;box-shadow:0 0 12px 4px #b9d8ff,0 0 30px 10px #2f7dff;";
        return { o, e, rot, ph: i * Math.PI };
      });
      const wm = el(lock, "abs wm");
      wm.style.cssText += "left:0;width:1920px;top:444px;color:#fff;";
      const wmMain = el(wm, "wm-main");
      wmMain.style.fontSize = "108px";
      const letters = M.split(wmMain, "GHANDI");
      const sub = el(wm, "wm-sub");
      const l1 = el(sub, "", null, "i");
      el(sub, "", "HOME ELECTRO", "span");
      const l2 = el(sub, "", null, "i");
      [l1, l2].forEach((i) => (i.style.background = "#cfe3ff"));
      sub.style.color = "#dbeaff";
      const tagline = el(lock, "abs");
      tagline.style.cssText += "left:0;width:1920px;top:648px;text-align:center;font:500 34px Roboto;color:rgb(235 243 255 / .95);";
      tagline.textContent = "Électroménager et TV à Casablanca";
      const pillsRow = el(lock, "abs");
      pillsRow.style.cssText += "left:0;width:1920px;top:752px;display:flex;justify-content:center;gap:24px;";
      const PILLS = [
        { ic: "phone", txt: SITE.PHONE, t0: 23.62 },
        { ic: "globe", txt: "ghandihomeelectro.com", t0: 23.74 },
        { ic: "map-pin", txt: "41 Boulevard Ghandi, Casablanca", t0: 23.86 },
      ].map((p) => {
        const d = el(pillsRow, "pill");
        d.style.cssText += `background:#fff;color:#0f172a;font-size:30px;padding:18px 30px;box-shadow:0 20px 40px -20px rgb(2 20 60 / .6);`;
        d.innerHTML = `<span style="color:${BLUE}">${icon(p.ic, 32, 2.2)}</span>${p.txt}`;
        return { d, ...p };
      });
      const shine = el(lock, "abs");
      shine.style.cssText += `left:0;top:70px;width:300px;height:660px;background:linear-gradient(90deg, transparent, rgb(255 255 255 / .5), transparent);
        mix-blend-mode:overlay;-webkit-mask-image:linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent);`;
      const ring = el(fin, "abs");
      ring.style.cssText += "border-radius:50%;border:6px solid #fff;";
      const burstA = M.burst(fin, { n: 60, seed: 5, x: 960, y: 300, t0: T_HIT, life: 1.1, speed: [500, 1500], size: [4, 11], gravity: 400, drag: 2.4, colors: ["#ffffff", "#cfe3ff", "#9cc6ff"], shape: "streak" });

      /* ---------- sound ---------- */
      for (let i = 0; i < 10; i++) cue(21.05 + i * 0.05, "blip", { pitch: 1 + (i % 5) * 0.12, gain: 0.3 });
      cue(21.12, "swoosh", { dur: 0.4, gain: 0.5 });
      cue(21.1, "swoosh", { dur: 1.1, gain: 0.35 }); // camera tilts over the map
      cue(T_LAND - 0.22, "fall", { dur: 0.22, gain: 0.6 });
      cue(T_LAND, "pinDrop", { gain: 1.0 });
      [0, 0.25, 0.5].forEach((d) => cue(T_LAND + d, "sonar", { gain: 0.45 - d * 0.4 }));
      cue(21.62, "pop", { pitch: 1.0, gain: 0.7 });
      for (let i = 0; i < ADDR.length; i++) if (ADDR[i] !== " ") cue(21.74 + i * 0.022, "type", { seed: 40 + i, gain: 0.5 });
      cue(22.18, "tick", { pitch: 1.3, gain: 0.45 });
      cue(22.27, "tick", { pitch: 1.45, gain: 0.45 });
      cue(22.15, "riser", { dur: T_HIT - 22.15, gain: 0.9 });
      cue(T_IRIS, "whoosh", { dur: 0.45, gain: 0.9, rise: 1 });
      cue(T_HIT, "impact", { gain: 1.1 });
      cue(T_HIT, "subdrop", { gain: 1.0 });
      cue(T_HIT + 0.02, "shimmer", { dur: 1.2, gain: 0.55 });
      letters.forEach((_, i) => cue(23.1 + i * 0.045, "tick", { pitch: 1.1 + i * 0.08, gain: 0.35 }));
      cue(23.45, "swish", { gain: 0.4 });
      PILLS.forEach((p, i) => cue(p.t0, "pop", { pitch: 1.1 + i * 0.15, gain: 0.7 }));
      cue(24.12, "shimmer", { dur: 0.6, gain: 0.45 });
      FX.flash(T_HIT, 0.25, "#ffffff", 0.75);

      return (t) => {
        // vertical swipe in (matches the services scene going up)
        const ex = E.inOutQuart(prog(t, T_IN, T_IN + 0.3));
        tf(mapLayer, { y: 1080 * (1 - ex), f: ex > 0.02 && ex < 0.98 ? `blur(${(Math.sin(Math.PI * ex) * 10).toFixed(1)}px)` : "none" });

        // map camera: slow push-in centred on the pin
        const ms = lerp(0.72, 1.0, E.outCubic(prog(t, T_IN, 22.5)));
        const mx = SCREEN_PIN.x - PIN.x * ms;
        const my = SCREEN_PIN.y - PIN.y * ms;
        tf(map, { x: mx, y: my, s: ms });
        const tilt = E.inOutCubic(prog(t, 21.05, 22.35));
        tf(mapCam, { rx: 38 * tilt, r: -6 * tilt });
        fog.style.opacity = tilt.toFixed(3);
        streets.forEach((s, i) => {
          const a = 21.0 + ((i >> 1) % 12) * 0.03; // avenue casing and fill are consecutive: keep them together
          M.drawTo([s], E.outCubic(prog(t, a, a + 0.45)));
        });
        M.drawTo(blvd, E.inOutCubic(prog(t, 21.1, 21.5)));
        blvdText.style.opacity = prog(t, 21.4, 21.6).toFixed(3);

        // pin drop + sonar
        const ph = gravityDrop(t - (T_LAND - 0.22), 600, 0.22, 0.14, 2);
        const q = squash(t, T_LAND, 0.2, 5, 9);
        tf(pin, { x: SCREEN_PIN.x - 60, y: SCREEN_PIN.y - 156 - ph, sx: 1 + q * 0.5, sy: 1 - q, o: t > T_LAND - 0.22 ? 1 : 0 });
        const shs = clamp(1 - ph / 600);
        tf(pinShadow, { x: SCREEN_PIN.x - 45, y: SCREEN_PIN.y - 13, s: 0.4 + 0.6 * shs, o: t > T_LAND - 0.22 ? shs : 0 });
        rings.forEach((rg, i) => {
          const rp = prog(t, T_LAND + i * 0.25, T_LAND + i * 0.25 + 0.9);
          const rr = 20 + 200 * E.outCubic(rp);
          rg.style.width = 2 * rr + "px";
          rg.style.height = 0.62 * rr + "px";
          tf(rg, { x: SCREEN_PIN.x - rr, y: SCREEN_PIN.y - 0.31 * rr, o: rp > 0 && rp < 1 ? 1 - rp : 0 });
        });

        // store card
        const cs = spring(t - 21.62, 2.8, 0.5);
        tf(card, { s: Math.max(0, cs), o: prog(t, 21.62, 21.68), x: -60 * (1 - cs) });
        const n = clamp(Math.floor((t - 21.74) / 0.022) + 1, 0, ADDR.length);
        addr.textContent = ADDR.slice(0, n) + (t > 21.72 && t < 22.25 && Math.floor(t * 8) % 2 === 0 ? "|" : "");
        tf(city, { y: 14 * (1 - E.outCubic(prog(t, 22.1, 22.3))), o: prog(t, 22.1, 22.25) });
        hrs.forEach((h, i) => tf(h, { x: -24 * (1 - E.outCubic(prog(t, 22.18 + i * 0.09, 22.4 + i * 0.09))), o: prog(t, 22.18 + i * 0.09, 22.3 + i * 0.09) }));

        // iris into the final lock-up, opening from the pin head
        const ir = 2300 * E.inCubic(prog(t, T_IRIS, T_HIT));
        fin.style.display = t >= T_IRIS ? "" : "none";
        fin.style.clipPath = t < T_HIT ? `circle(${ir.toFixed(1)}px at ${SCREEN_PIN.x}px ${SCREEN_PIN.y - 100}px)` : "none";
        mapLayer.style.display = t < T_HIT ? "" : "none";

        // final lock-up
        for (const k of bokeh) {
          const y = ((((k.y - k.v * t) % 1180) + 1180) % 1180) - 50;
          k.b.style.transform = `translate3d(${(k.x + Math.sin(t * k.f + k.ph) * k.a).toFixed(1)}px,${y.toFixed(1)}px,0)`;
          k.b.style.opacity = k.o.toFixed(3);
        }
        tf(rays, { r: t * 10, o: prog(t, T_HIT, T_HIT + 0.4) });
        const sh = shake(t, T_HIT, 0.5, 16, 22, 9);
        const slam = E.outExpo(prog(t, T_HIT, T_HIT + 0.35));
        const settle = 1 + 0.03 * E.inOutSine(prog(t, 23.4, 25.0));
        const turn = -42 * (1 - E.outCubic(prog(t, T_HIT, T_HIT + 0.8))) + 20 * Math.sin((t - T_HIT - 0.4) * 2.0) * prog(t, T_HIT + 0.3, T_HIT + 1.0);
        tf(house, { s: lerp(2.2, 1, slam), ry: turn, rx: 10 * Math.sin((t - T_HIT) * 1.5) * prog(t, T_HIT + 0.3, T_HIT + 1.0), o: prog(t, T_HIT - 0.02, T_HIT + 0.04) });
        house3dWrap.style.filter = slam < 0.97 ? `blur(${((1 - slam) * 18).toFixed(1)}px)` : "none";
        finFx.forEach((u) => u(t));
        const oin = E.outBack(prog(t, T_HIT + 0.15, T_HIT + 0.55));
        orbits.forEach((ob) => {
          const vis = t > T_HIT + 0.15;
          ob.o.style.opacity = vis ? (0.9 * oin).toFixed(3) : "0";
          tf(ob.o, { r: ob.rot, s: 0.5 + 0.5 * oin });
          const th = (t - T_HIT) * 3.8 + ob.ph;
          const a = (ob.rot * Math.PI) / 180;
          const ex = ORB.rx * Math.cos(th) * (0.5 + 0.5 * oin);
          const ey = ORB.rx * ORB.k * Math.sin(th) * (0.5 + 0.5 * oin);
          ob.e.style.transform = `translate3d(${(ORB.x + ex * Math.cos(a) - ey * Math.sin(a)).toFixed(1)}px,${(ORB.y + ex * Math.sin(a) + ey * Math.cos(a)).toFixed(1)}px,0)`;
          ob.e.style.opacity = vis ? ((Math.sin(th) > 0 ? 1 : 0.3) * oin).toFixed(3) : "0";
        });
        drum.style.transform = `rotate(${(Math.max(0, t - T_HIT) * 720).toFixed(1)}deg)`;
        tf(lock, { x: sh.x, y: sh.y, r: sh.r, s: settle });
        letters.forEach((s, i) => {
          const a = 23.1 + i * 0.045;
          const e = spring(t - a, 3.2, 0.45);
          s.style.transform = `translate3d(0,${(90 * (1 - e)).toFixed(1)}px,0)`;
          s.style.opacity = prog(t, a, a + 0.06).toFixed(3);
        });
        const sk = E.outCubic(prog(t, 23.35, 23.7));
        sub.style.opacity = sk.toFixed(3);
        [l1, l2].forEach((i) => (i.style.transform = `scaleX(${E.outExpo(prog(t, 23.38, 23.75)).toFixed(3)})`));
        tf(tagline, { y: 24 * (1 - E.outCubic(prog(t, 23.45, 23.75))), o: prog(t, 23.45, 23.65) });
        PILLS.forEach((p) => tf(p.d, { s: Math.max(0, spring(t - p.t0, 3, 0.5)), o: prog(t, p.t0, p.t0 + 0.05) }));
        const sp = prog(t, 24.1, 24.6);
        tf(shine, { x: lerp(300, 1500, E.inOutCubic(sp)), skx: -20, o: sp > 0 && sp < 1 ? 1 : 0 });
        const rp = prog(t, T_HIT, T_HIT + 0.6);
        const rr = 40 + 900 * E.outCubic(rp);
        ring.style.width = ring.style.height = 2 * rr + "px";
        tf(ring, { x: 960 - rr, y: 300 - rr, o: rp > 0 && rp < 1 ? Math.pow(1 - rp, 1.5) : 0 });
        burstA(t);
      };
    },
    7,
  ),
);
