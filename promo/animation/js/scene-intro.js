/* Scene 1 (0 – 3.05 s): power-on line, sparks trace the logo house, flash to blue, letters drop, zoom through the washer door. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "intro",
    0,
    3.06,
    (root) => {
      const { el, tw, E, prog, clamp, lerp, cue, tf, shake, gravityDrop, squash, sp } = M;
      const HS = 1.75; // house box (240x220 viewBox) drawn at 1.75x
      const HX = 960 - 120 * HS;
      const HY = 180;
      const DOOR = { x: HX + 153 * HS, y: HY + 165 * HS };
      const FLOOR_Y = HY + 206 * HS;
      const APEX = { x: HX + 120 * HS, y: HY + 14 * HS };
      const T_DRAW0 = 0.55;
      const T_DRAW1 = 1.5;
      const T_ZOOM = 2.7;

      const navy = el(root, "fill");
      navy.style.background = "radial-gradient(circle at 50% 45%, #0e3277 0%, #061a45 48%, #020a1e 100%)";
      const blue = el(root, "fill");
      blue.style.background = "radial-gradient(circle at 50% 40%, #3a8dff 0%, #1266e8 42%, #0a48a8 100%)";
      const rays = el(root, "fill");
      rays.style.cssText += `inset:-600px;background:repeating-conic-gradient(from 0deg at 50% 50%, rgb(255 255 255 / .09) 0deg 5deg, transparent 5deg 15deg);
        -webkit-mask-image:radial-gradient(circle at 50% 50%, #000 0%, transparent 55%);`;
      const dots = el(root, "fill");
      dots.style.cssText += "inset:-200px;background-image:radial-gradient(rgb(255 255 255 / .16) 1.4px, transparent 1.6px);background-size:44px 44px;";

      // drifting bokeh
      const bokeh = [];
      const r = M.rng(7);
      for (let i = 0; i < 46; i++) {
        const b = el(root, "pt");
        const s = 3 + r() * 9;
        b.style.cssText += `width:${s}px;height:${s}px;background:#cfe3ff;box-shadow:0 0 ${s * 2}px #8fc0ff;`;
        bokeh.push({ b, x: r() * 1920, y: r() * 1080, v: 20 + r() * 60, a: 10 + r() * 40, f: 0.3 + r() * 0.8, ph: r() * 6, o: 0.15 + r() * 0.45 });
      }

      const cam = el(root, "fill");
      cam.style.transformOrigin = `${DOOR.x}px ${DOOR.y}px`;

      // power line + seed dot
      const line = el(cam, "abs");
      line.style.cssText += `top:${FLOOR_Y - 2}px;height:4px;border-radius:4px;background:#fff;box-shadow:0 0 14px 3px #9cc6ff,0 0 44px 12px #2f7dff;`;
      const seed = el(cam, "abs");
      seed.style.cssText += `left:${960 - 9}px;top:${FLOOR_Y - 9}px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 0 16px 6px #9cc6ff,0 0 60px 20px #2f7dff;`;

      // logo house
      const houseBox = el(cam, "abs");
      houseBox.style.cssText += `left:${HX}px;top:${HY}px;width:${240 * HS}px;height:${220 * HS}px;`;
      houseBox.innerHTML = ART.logoHouse({ ink: "#ffffff", fill: "#ffffff", detail: ART.BLUE, hl: "#b7d3ff", vent: "#ffffff" });
      const svg = houseBox.querySelector("svg");
      const left = svg.querySelector(".lh-left");
      const right = svg.querySelector(".lh-right");
      const eaves = svg.querySelectorAll(".lh-eave");
      const chim = svg.querySelector(".lh-chimney");
      const fridge = svg.querySelector(".lh-fridge");
      const washer = svg.querySelector(".lh-washer");
      const vent = svg.querySelector(".lh-vent");
      const drum = svg.querySelector(".lh-drum");
      [fridge, washer, vent].forEach((g) => {
        g.style.transformBox = "fill-box";
        g.style.transformOrigin = "50% 100%";
      });
      const LL = left.getTotalLength();
      const LR = right.getTotalLength();
      const outline = [left, right];
      outline.forEach((p) => p.setAttribute("pathLength", "1"));
      [...eaves, chim].forEach((p) => p.setAttribute("pathLength", "1"));
      [left, right, chim, ...eaves].forEach((p) => {
        p.style.strokeDasharray = "1 1";
      });

      const drawP = (t) => E.inOutSine(prog(t, T_DRAW0, T_DRAW1));
      const zoomAt = (t) => Math.exp(Math.log(52) * E.inCubic(prog(t, T_ZOOM, 3.05)));
      // the next scene is revealed through the washer door while the camera dives into it
      SHARED.door = { x: DOOR.x, y: DOOR.y, r: 16.5 * HS, zoomAt };
      const pt = (path, L, f) => {
        const q = path.getPointAtLength(clamp(f) * L);
        return { x: HX + q.x * HS, y: HY + q.y * HS };
      };

      // spark heads with comet trails + emitted sparks
      const sparks = [left, right].map((path, si) => {
        const L = si ? LR : LL;
        const head = el(cam, "abs");
        head.style.cssText += "width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#fff;box-shadow:0 0 14px 5px #b9d8ff,0 0 46px 16px #2f7dff;";
        const trail = [];
        for (let k = 0; k < 16; k++) {
          const d = el(cam, "abs");
          const s = 12 - k * 0.6;
          d.style.cssText += `width:${s}px;height:${s}px;margin:${-s / 2}px 0 0 ${-s / 2}px;border-radius:50%;background:#dbeaff;box-shadow:0 0 10px #6fa8ff;`;
          trail.push(d);
        }
        const emitters = [];
        for (let i = 0; i < 16; i++) {
          const te = T_DRAW0 + 0.03 + i * 0.055;
          const p = pt(path, L, drawP(te));
          emitters.push(
            M.burst(cam, { n: 6, seed: 100 + si * 50 + i, x: p.x, y: p.y, t0: te, life: 0.38, speed: [160, 520], size: [3, 7], gravity: 1400, drag: 2.5, colors: ["#ffffff", "#bcd8ff", "#7fb2ff"], shape: "streak" }),
          );
        }
        return { path, L, head, trail, emitters };
      });

      // shockwave ring + anamorphic flare at the apex (flash moment)
      const ring = el(cam, "abs");
      ring.style.cssText += "border-radius:50%;border:5px solid #fff;box-shadow:0 0 24px #9cc6ff, inset 0 0 24px #9cc6ff;";
      const flare = el(cam, "abs");
      flare.style.cssText += `left:${APEX.x - 900}px;top:${APEX.y - 5}px;width:1800px;height:10px;border-radius:10px;
        background:radial-gradient(closest-side, #ffffff, rgb(160 200 255 / .8) 35%, rgb(47 125 255 / 0) 100%);`;
      const halo = el(cam, "abs");
      halo.style.cssText += `left:${960 - 700}px;top:${HY + 110 * HS - 700}px;width:1400px;height:1400px;border-radius:50%;
        background:radial-gradient(closest-side, rgb(255 255 255 / .35), rgb(160 200 255 / .12) 45%, transparent 70%);`;
      cam.insertBefore(halo, cam.firstChild);
      const flashBurst = M.burst(cam, { n: 40, seed: 9, x: APEX.x, y: APEX.y, t0: T_DRAW1, life: 0.9, speed: [400, 1300], size: [3, 9], gravity: 500, drag: 2.6, colors: ["#ffffff", "#cfe3ff", "#8fc0ff"], shape: "streak" });

      // wordmark
      const wm = el(cam, "abs wm");
      wm.style.cssText += `left:0;width:1920px;top:${HY + 398}px;color:#fff;`;
      const main = el(wm, "wm-main");
      main.style.fontSize = "112px";
      const letters = M.split(main, "GHANDI");
      const sub = el(wm, "wm-sub");
      const l1 = el(sub, "", null, "i");
      const subTxt = el(sub, "", "HOME ELECTRO", "span");
      const l2 = el(sub, "", null, "i");
      [l1, l2].forEach((i) => (i.style.background = "#cfe3ff"));
      sub.style.color = "#dbeaff";
      const tag = el(cam, "abs");
      tag.style.cssText += `left:0;width:1920px;top:${HY + 610}px;text-align:center;font:500 32px Roboto;color:rgb(235 243 255 / .92);letter-spacing:.02em;`;
      tag.textContent = "Électroménager et TV à Casablanca";

      const LETTER_T = [1.75, 1.875, 2.0, 2.125, 2.25, 2.375];
      const FALL = 0.2;

      /* ---- sound ---- */
      cue(0.02, "zap", { gain: 0.7 });
      cue(0.1, "powerup", { dur: 0.55 });
      cue(T_DRAW0, "crackle", { dur: T_DRAW1 - T_DRAW0 });
      cue(0.45, "riser", { dur: T_DRAW1 - 0.45, gain: 0.8 });
      cue(T_DRAW1, "impact", { gain: 1.0 });
      cue(T_DRAW1, "subdrop", { gain: 0.9 });
      cue(T_DRAW1 + 0.02, "shimmer", { dur: 0.8, gain: 0.5 });
      cue(1.56, "pop", { pitch: 0.75 });
      cue(1.66, "pop", { pitch: 1.0 });
      cue(1.76, "tick", { pitch: 1.3 });
      LETTER_T.forEach((lt, i) => cue(lt + FALL, "thud", { pitch: 0.9 + i * 0.07, gain: 0.85 }));
      cue(2.45, "shimmer", { dur: 0.6, gain: 0.55 });
      cue(T_ZOOM - 0.02, "whoosh", { dur: 0.42, gain: 1.0, pan: 0, rise: 1 });
      FX.flash(T_DRAW1, 0.22, "#ffffff", 0.9);

      return (t) => {
        // background
        const toBlue = prog(t, T_DRAW1 - 0.02, T_DRAW1 + 0.1);
        blue.style.opacity = toBlue.toFixed(3);
        rays.style.opacity = (0.9 * prog(t, T_DRAW1, T_DRAW1 + 0.5)).toFixed(3);
        tf(rays, { r: t * 12 });
        tf(dots, { s: 1 + t * 0.03, o: 0.25 + 0.5 * prog(t, 0, 1.5) });
        for (const k of bokeh) {
          const y = (((k.y - k.v * t) % 1180) + 1180) % 1180 - 50;
          const x = k.x + Math.sin(t * k.f + k.ph) * k.a;
          k.b.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
          k.b.style.opacity = (k.o * prog(t, 0.3, 1.2)).toFixed(3);
        }

        // camera: shake on flash + zoom through the washer door
        const sh = shake(t, T_DRAW1, 0.5, 14, 24, 2);
        const z = zoomAt(t);
        const drift = 1 + 0.025 * E.inOutSine(prog(t, 1.5, T_ZOOM));
        tf(cam, { x: sh.x, y: sh.y, r: sh.r, s: z * drift });

        // seed dot + power line
        const seedS = tw(t, 0, 0.14, 0, 1, E.outBack) * (1 - prog(t, 0.5, 0.62));
        tf(seed, { s: seedS, o: seedS > 0.01 ? 1 : 0 });
        const grow = tw(t, 0.12, 0.5, 0, 1500, E.outExpo);
        const shrink = E.inCubic(prog(t, 0.55, 0.82));
        const lw = grow * (1 - shrink);
        line.style.left = (960 - lw / 2).toFixed(1) + "px";
        line.style.width = lw.toFixed(1) + "px";
        line.style.opacity = t < 0.12 || lw < 1 ? "0" : "1";

        // outline drawing
        const p = drawP(t);
        left.style.strokeDashoffset = (1 - p).toFixed(4);
        right.style.strokeDashoffset = (1 - p).toFixed(4);
        const pe = E.outCubic(prog(t, T_DRAW1 - 0.02, T_DRAW1 + 0.12));
        M.drawTo(eaves, pe);
        M.drawTo([chim], E.outCubic(prog(t, T_DRAW1 - 0.1, T_DRAW1 + 0.1)));
        const glow = t < T_DRAW1 ? 1 : lerp(1, 0.35, prog(t, T_DRAW1, T_DRAW1 + 0.6));
        svg.style.filter = `drop-shadow(0 0 ${(10 * glow).toFixed(1)}px rgb(170 205 255 / ${glow.toFixed(2)})) drop-shadow(0 0 ${(32 * glow).toFixed(1)}px rgb(47 125 255 / ${(0.9 * glow).toFixed(2)}))`;
        svg.style.opacity = t < T_DRAW0 ? "0" : "1";

        for (const s of sparks) {
          const on = t >= T_DRAW0 && t <= T_DRAW1 + 0.02;
          const hp = pt(s.path, s.L, p);
          s.head.style.display = on ? "" : "none";
          if (on) s.head.style.transform = `translate3d(${hp.x}px,${hp.y}px,0) scale(${(1 + 0.25 * Math.sin(t * 90)).toFixed(3)})`;
          s.trail.forEach((d, k) => {
            const tk = t - (k + 1) * 0.011;
            const vis = on && tk > T_DRAW0;
            d.style.display = vis ? "" : "none";
            if (!vis) return;
            const q = pt(s.path, s.L, drawP(tk));
            d.style.transform = `translate3d(${q.x}px,${q.y}px,0)`;
            d.style.opacity = (0.85 * (1 - k / 16)).toFixed(3);
          });
          s.emitters.forEach((u) => u(t));
        }
        flashBurst(t);

        // shockwave + flare + halo
        const rp = prog(t, T_DRAW1, T_DRAW1 + 0.5);
        const rr = 20 + 760 * E.outCubic(rp);
        ring.style.left = (APEX.x - rr).toFixed(1) + "px";
        ring.style.top = (APEX.y - rr).toFixed(1) + "px";
        ring.style.width = ring.style.height = (2 * rr).toFixed(1) + "px";
        ring.style.opacity = rp > 0 && rp < 1 ? Math.pow(1 - rp, 1.5).toFixed(3) : "0";
        const fp = prog(t, T_DRAW1 - 0.04, T_DRAW1 + 0.45);
        tf(flare, { sx: 0.2 + 1.2 * E.outExpo(fp), sy: 1 + 2 * (1 - fp), o: fp > 0 && fp < 1 ? Math.pow(1 - fp, 1.4) : 0 });
        halo.style.opacity = (0.9 * prog(t, T_DRAW1, T_DRAW1 + 0.4) * (0.85 + 0.15 * Math.sin(t * 6))).toFixed(3);

        // appliances pop up inside the house
        const fs = sp(t, 1.56, 0, 1, 4, 0.38);
        const ws = sp(t, 1.66, 0, 1, 4, 0.38);
        const vs = sp(t, 1.76, 0, 1, 5, 0.4);
        fridge.style.transform = `scale(${(0.6 + 0.4 * fs).toFixed(3)}, ${fs.toFixed(3)})`;
        washer.style.transform = `scale(${(0.6 + 0.4 * ws).toFixed(3)}, ${ws.toFixed(3)})`;
        vent.style.transform = `scale(${vs.toFixed(3)})`;
        fridge.style.opacity = t < 1.56 ? "0" : "1";
        washer.style.opacity = t < 1.66 ? "0" : "1";
        vent.style.opacity = t < 1.76 ? "0" : "1";
        drum.style.transform = `rotate(${(Math.max(0, t - 1.66) * 900).toFixed(1)}deg)`;

        // letters drop
        letters.forEach((s, i) => {
          const lt = LETTER_T[i];
          const h = gravityDrop(t - lt, 210, FALL, 0.16, 2);
          const q = squash(t, lt + FALL, 0.22, 5, 10);
          s.style.transform = `translate3d(0,${(-h).toFixed(1)}px,0) scale(${(1 + q * 0.6).toFixed(3)},${(1 - q).toFixed(3)}) rotate(${((1 - prog(t, lt, lt + FALL)) * (i % 2 ? 14 : -14)).toFixed(2)}deg)`;
          s.style.opacity = E.outQuad(prog(t, lt, lt + 0.09)).toFixed(3);
        });
        const sp1 = E.outCubic(prog(t, 2.45, 2.85));
        sub.style.opacity = sp1.toFixed(3);
        subTxt.style.letterSpacing = lerp(0.9, 0.32, sp1).toFixed(3) + "em";
        [l1, l2].forEach((i) => (i.style.transform = `scaleX(${E.outExpo(prog(t, 2.5, 2.9)).toFixed(3)})`));
        const tp = E.outCubic(prog(t, 2.58, 2.9));
        tf(tag, { y: 26 * (1 - tp), o: tp });
      };
    },
    1,
  ),
);
