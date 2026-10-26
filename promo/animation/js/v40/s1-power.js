/* 40 s — Scene 1 (0 – 4.5 s): the hook question is on screen from the very first frame ("Besoin d'un frigo ?",
   the noun flips on the beat), it is sucked into a power button that is pressed; a power wave switches on a
   whole field of appliance icons; they implode into a flash and the 3D logo lock-up lands as the answer. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "power",
    0,
    4.46,
    (root) => {
      const { el, E, prog, clamp, lerp, cue, tf, shake, gravityDrop, squash, sp, icon } = M;
      const C = { x: 960, y: 420 };
      const HOOK = [
        ["d'un frigo ?", 0.0],
        ["d'une clim ?", 0.5],
        ["d'une télé ?", 0.75],
      ];
      const T_COLLAPSE = 1.0; // the question is sucked into the power button
      const T_PRESS = 1.2;
      const T_WAVE = 1.25;
      const WAVE_SPEED = 2800;
      const T_IMPLODE = 1.72;
      const T_FLASH = 2.0;
      const T_REVEAL = 4.0; // a hole opens in the middle and reveals the city underneath

      /* ---------- dark power-on stage ---------- */
      const navy = el(root, "fill");
      navy.style.background = "radial-gradient(circle at 50% 40%, #0e3277 0%, #061a45 50%, #020a1e 100%)";
      const floor = FXL.gridFloor(root, { top: 560, color: "rgb(120 180 255 / .5)", speed: 240, cell: 80 });
      const dark = el(root, "fill");

      // field of appliance icons, switched on by the wave
      const ICONS = ["refrigerator", "washing-machine", "tv", "air-vent", "microwave", "flame", "fan", "snowflake", "coffee", "speaker", "droplets", "wind"];
      const field = el(dark, "fill");
      field.style.filter = "drop-shadow(0 0 8px rgb(150 195 255 / .9))";
      const cells = [];
      let k = 0;
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 14; col++) {
          const x = 30 + col * 142 + (row % 2) * 71;
          const y = 50 + row * 122;
          const d = Math.hypot(x - C.x, y - C.y);
          if (d < 190) continue;
          const e = el(field, "abs");
          e.innerHTML = icon(ICONS[k++ % ICONS.length], 52, 1.6);
          e.style.cssText += "color:#ffffff;";
          cells.push({ e, x: x - 26, y: y - 26, d, th: T_WAVE + d / WAVE_SPEED, tw: (row * 7 + col * 3) % 10 });
        }
      }
      const front = el(dark, "abs");
      front.style.cssText += "border-radius:50%;border:3px solid rgb(170 210 255 / .9);box-shadow:0 0 30px 6px rgb(80 150 255 / .6), inset 0 0 30px 6px rgb(80 150 255 / .4);";
      const arcs = [0, 1, 2, 3, 4, 5].map((i) => FXL.arc(dark, { segs: 14, amp: 30, width: 2.6, seed: 90 + i }));

      // hook: "Besoin" + a blue pill whose phrase rolls on the beat
      const hook = el(dark, "abs");
      hook.style.cssText += "left:0;top:0;width:1920px;height:1080px;transform-origin:960px 420px;";
      const h1 = el(hook, "abs hd");
      h1.style.cssText += "left:0;top:236px;width:1920px;text-align:center;font-size:150px;line-height:1;color:#fff;text-shadow:0 0 40px rgb(80 150 255 / .45);";
      h1.textContent = "Besoin";
      const PILL_Y = 418;
      const PILL_H = 150;
      const pill = el(hook, "abs");
      pill.style.cssText += `left:0;top:${PILL_Y}px;height:${PILL_H}px;border-radius:36px;background:${ART.BLUE};box-shadow:0 0 0 4px rgb(255 255 255 / .9), 0 0 60px 10px rgb(47 125 255 / .55);`;
      const roll = el(hook, "abs");
      roll.style.cssText += `left:0;top:${PILL_Y}px;width:1920px;height:${PILL_H}px;overflow:hidden;`;
      const phrases = HOOK.map(([txt]) => {
        const row = el(roll, "abs");
        row.style.cssText += `left:0;top:0;width:1920px;height:${PILL_H}px;text-align:center;`;
        const sp = el(row, "hd", txt, "span");
        sp.style.cssText += `display:inline-block;font-size:100px;line-height:${PILL_H}px;color:#fff;white-space:nowrap;`;
        return { row, sp };
      });

      // the power button
      const btn = el(dark, "abs");
      btn.style.cssText += `left:${C.x - 110}px;top:${C.y - 110}px;width:220px;height:220px;`;
      btn.innerHTML = `<svg viewBox="0 0 200 200" width="220" height="220" style="overflow:visible;filter:drop-shadow(0 0 10px #b9d8ff) drop-shadow(0 0 30px #2f7dff)">
        <circle class="pw-disc" cx="100" cy="100" r="92" fill="rgb(18 102 232 / .0)"/>
        <path class="pw" d="M135 39.4 A70 70 0 1 1 65 39.4" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"/>
        <path class="pw" d="M100 18 V96" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"/></svg>`;
      const pw = M.prepDraw(btn.querySelectorAll(".pw"));
      const disc = btn.querySelector(".pw-disc");
      const pressFx = [
        FXL.ringPulse(dark, { x: C.x, y: C.y, t0: T_WAVE, r0: 100, r1: 520, width: 4, color: "rgb(200 225 255 / .9)", dur: 0.6 }),
        FXL.ringPulse(dark, { x: C.x, y: C.y, t0: T_WAVE + 0.12, r0: 100, r1: 420, width: 2, color: "rgb(200 225 255 / .6)", dur: 0.6 }),
        FXL.lineBurst(dark, { x: C.x, y: C.y, t0: T_WAVE, n: 14, r0: 130, r1: 330, width: 6, color: "#dbeaff", dur: 0.4, seed: 96 }),
      ];

      /* ---------- logo stage (after the flash) ---------- */
      const blue = el(root, "fill");
      blue.style.background = "radial-gradient(circle at 50% 36%, #3a8dff 0%, #1266e8 45%, #0a48a8 100%)";
      const rays = el(blue, "fill");
      rays.style.cssText += `inset:-700px;background:repeating-conic-gradient(from 0deg at 50% 50%, rgb(255 255 255 / .08) 0deg 5deg, transparent 5deg 15deg);
        -webkit-mask-image:radial-gradient(circle at 50% 50%, #000 0%, transparent 52%);`;
      const amb = FXL.ambient(blue, { n: 16, colors: ["rgb(255 255 255 / .18)", "rgb(190 220 255 / .25)"], seed: 11 });
      const cam = el(blue, "fill");
      cam.style.transformOrigin = "960px 420px";
      const L = V40.lockup(cam, { HS: 1.5, top: 110, wmTop: 472, tagTop: 680 });
      const orbit = V40.orbits(cam, L.wrap, { x: 960, y: L.center.y, rx: 400, k: 0.25, speed: 3.6 });
      const logoFx = [
        FXL.lineBurst(cam, { x: 960, y: L.center.y, t0: T_FLASH, n: 20, r0: 260, r1: 780, width: 8, dur: 0.55, seed: 97 }),
        FXL.shapeBurst(cam, { x: 960, y: L.center.y, t0: T_FLASH, n: 30, speed: [700, 1600], colors: ["#ffffff", "#cfe3ff", "#9cc6ff"], seed: 98, gravity: 500 }),
        FXL.ringPulse(cam, { x: 960, y: L.center.y, t0: T_FLASH + 0.08, r0: 120, r1: 820, width: 3, color: "rgb(255 255 255 / .6)", dur: 0.8 }),
      ];
      const LT = [2.25, 2.33, 2.41, 2.49, 2.57, 2.65];


      /* ---------- sound ---------- */
      cue(0.0, "punch", { pitch: 0.85, gain: 1.0 });
      cue(0.0, "subdrop", { gain: 0.75 });
      HOOK.slice(1).forEach(([, t0], i) => {
        cue(t0, "pop", { pitch: 1.0 + i * 0.25, gain: 0.75 });
        cue(t0, "swish", { gain: 0.3 });
      });
      cue(T_COLLAPSE - 0.04, "swoosh", { dur: 0.2, gain: 0.6 });
      cue(T_COLLAPSE, "powerup", { dur: 0.22, gain: 0.6 });
      cue(T_PRESS, "click", { gain: 1.0 });
      cue(T_WAVE, "impact", { gain: 0.75 });
      cue(T_WAVE, "zap", { gain: 0.6 });
      cue(T_WAVE, "crackle", { dur: 0.45, gain: 0.8 });
      for (let i = 0; i < 6; i++) cue(T_WAVE + 0.05 + i * 0.06, "blip", { pitch: 1 + i * 0.15, gain: 0.35 });
      cue(T_IMPLODE - 0.05, "whoosh", { dur: 0.33, gain: 0.9, rise: 1 });
      cue(T_FLASH, "impact", { gain: 1.1 });
      cue(T_FLASH, "subdrop", { gain: 1.0 });
      cue(T_FLASH + 0.02, "shimmer", { dur: 1.0, gain: 0.5 });
      cue(2.1, "pop", { pitch: 0.75, gain: 0.6 });
      cue(2.2, "pop", { pitch: 1.0, gain: 0.6 });
      cue(2.3, "tick", { pitch: 1.3, gain: 0.5 });
      LT.forEach((t0, i) => cue(t0 + 0.16, "thud", { pitch: 0.9 + i * 0.07, gain: 0.7 }));
      cue(2.85, "shimmer", { dur: 0.6, gain: 0.45 });
      cue(3.05, "swish", { gain: 0.4 });
      cue(T_REVEAL - 0.05, "whoosh", { dur: 0.5, gain: 0.85, rise: 1 });
      FX.flash(T_FLASH, 0.3, "#ffffff", 1);

      return (t) => {
        const rv = E.inCubic(prog(t, T_REVEAL, T_REVEAL + 0.45));
        root.style.webkitMaskImage = rv > 0 ? `radial-gradient(circle at 50% 44%, transparent ${(1350 * rv).toFixed(1)}px, #000 ${(1350 * rv + 3).toFixed(1)}px)` : "none";
        const isDark = t < T_FLASH;
        dark.style.display = navy.style.display = isDark ? "" : "none";
        blue.style.display = isDark ? "none" : "";
        floor(t, isDark ? prog(t, 0.1, 0.6) : 0);

        if (isDark) {
          // hook: slams in on frame 0, the phrase flips on the beat, then everything is sucked into the button
          const col = E.inBack(prog(t, T_COLLAPSE, T_COLLAPSE + 0.14));
          hook.style.display = col < 1 ? "" : "none";
          if (col < 1) {
            const slam = 1 + 0.1 * (1 - E.outCubic(prog(t, 0, 0.22)));
            tf(hook, { s: slam * (1 - col), o: 1 - prog(t, T_COLLAPSE + 0.06, T_COLLAPSE + 0.14) });
            let idx = 0;
            HOOK.forEach(([, t0], i) => t >= t0 && (idx = i));
            phrases.forEach((ph, i) => {
              const tIn = HOOK[i][1];
              const tOut = i < HOOK.length - 1 ? HOOK[i + 1][1] : 99;
              const kin = i === 0 ? 1 : E.outBack(prog(t, tIn + 0.03, tIn + 0.19));
              const kout = E.outCubic(prog(t, tOut, tOut + 0.08));
              ph.row.style.display = t >= tIn - 0.001 && kout < 1 ? "" : "none";
              tf(ph.row, { y: PILL_H * (1 - kin) - PILL_H * kout });
            });
            // the pill's width springs from one phrase to the next
            const wOf = (i) => phrases[i].sp.offsetWidth + 110;
            const k = idx === 0 ? 1 : M.spring(t - HOOK[idx][1], 4, 0.55);
            const w = idx === 0 ? wOf(0) : lerp(wOf(idx - 1), wOf(idx), k);
            pill.style.width = w.toFixed(1) + "px";
            pill.style.left = (960 - w / 2).toFixed(1) + "px";
          }

          // button pops up and draws as the question collapses into it, is pressed, then implodes into the flash
          M.drawTo(pw, E.outCubic(prog(t, T_COLLAPSE, T_COLLAPSE + 0.18)));
          const pin = Math.max(0, M.spring(t - T_COLLAPSE, 3, 0.5));
          const press = t < T_PRESS ? pin : 1 + squash(t, T_PRESS, -0.16, 3.5, 7);
          const imp = E.inExpo(prog(t, T_IMPLODE, T_FLASH));
          tf(btn, { s: press * (1 + 0.6 * imp) });
          disc.setAttribute("fill", `rgb(18 102 232 / ${(0.55 * prog(t, T_PRESS, T_PRESS + 0.1)).toFixed(3)})`);
          pressFx.forEach((u) => u(t));
          const R = Math.max(0, (t - T_WAVE) * WAVE_SPEED);
          front.style.display = t > T_WAVE && t < T_IMPLODE + 0.05 ? "" : "none";
          front.style.width = front.style.height = 2 * R + "px";
          tf(front, { x: C.x - R, y: C.y - R, o: 1 - prog(t, T_WAVE + 0.5, T_IMPLODE) });
          arcs.forEach((u, i) => {
            const a = ((i * 60 + 15 + 25 * Math.sin(t * 3 + i)) * Math.PI) / 180;
            const rr = Math.min(R, 760);
            u(t + i * 0.37, { x: C.x + Math.cos(a) * 95, y: C.y + Math.sin(a) * 95 }, { x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr }, t > T_WAVE + 0.04 && t < T_IMPLODE - 0.05 && Math.floor(t * 24 + i) % 3 !== 0);
          });
          for (const c of cells) {
            const lit = t >= c.th;
            const pop = lit ? 1 + squash(t, c.th, 0.5, 3, 7) : 0.86;
            const q = E.inExpo(clamp((t - T_IMPLODE - c.d * 0.00008) / (T_FLASH - T_IMPLODE - 0.02)));
            const x = lerp(c.x, C.x - 26, q);
            const y = lerp(c.y, C.y - 26, q);
            const tw = 0.85 + 0.15 * Math.sin(t * 9 + c.tw);
            c.e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(pop * (1 - 0.7 * q)).toFixed(3)})`;
            c.e.style.opacity = (lit ? tw : 0.12 * prog(t, 0.2, 0.7)) * (1 - prog(t, T_FLASH - 0.06, T_FLASH)) + "";
            c.e.style.color = lit ? "#ffffff" : "#8fb6f0";
          }
          return;
        }

        /* logo lock-up */
        tf(rays, { r: t * 10, o: prog(t, T_FLASH, T_FLASH + 0.4) });
        amb(t, prog(t, T_FLASH, T_FLASH + 0.5));
        const sh = shake(t, T_FLASH, 0.5, 16, 22, 3);
        tf(cam, { x: sh.x, y: sh.y, r: sh.r, s: (1 + 0.04 * E.inOutSine(prog(t, 2.4, T_REVEAL))) * (1 - 0.55 * rv) });
        const slam = E.outExpo(prog(t, T_FLASH, T_FLASH + 0.35));
        const turn = -42 * (1 - E.outCubic(prog(t, T_FLASH, T_FLASH + 0.8))) + 16 * Math.sin((t - T_FLASH - 0.4) * 1.8) * prog(t, T_FLASH + 0.3, T_FLASH + 1.0);
        tf(L.house, { s: lerp(2.2, 1, slam), ry: turn, rx: 8 * Math.sin((t - T_FLASH) * 1.4) * prog(t, T_FLASH + 0.3, T_FLASH + 1.0) });
        L.wrap.style.filter = slam < 0.97 ? `blur(${((1 - slam) * 18).toFixed(1)}px)` : "none";
        const fs = sp(t, 2.1, 0, 1, 4, 0.38);
        const ws = sp(t, 2.2, 0, 1, 4, 0.38);
        const vs = sp(t, 2.3, 0, 1, 5, 0.4);
        L.fridge.style.transform = `scale(${(0.6 + 0.4 * fs).toFixed(3)}, ${fs.toFixed(3)})`;
        L.washer.style.transform = `scale(${(0.6 + 0.4 * ws).toFixed(3)}, ${ws.toFixed(3)})`;
        L.vent.style.transform = `scale(${vs.toFixed(3)})`;
        L.drum.style.transform = `rotate(${(Math.max(0, t - 2.2) * 720).toFixed(1)}deg)`;
        logoFx.forEach((u) => u(t));
        orbit(t, T_FLASH + 0.15);
        L.letters.forEach((s, i) => {
          const h = gravityDrop(t - LT[i], 200, 0.16, 0.16, 2);
          const q = squash(t, LT[i] + 0.16, 0.2, 5, 10);
          s.style.transform = `translate3d(0,${(-h).toFixed(1)}px,0) scale(${(1 + q * 0.6).toFixed(3)},${(1 - q).toFixed(3)})`;
          s.style.opacity = E.outQuad(prog(t, LT[i], LT[i] + 0.08)).toFixed(3);
        });
        const sk = E.outCubic(prog(t, 2.8, 3.15));
        L.sub.style.opacity = sk.toFixed(3);
        L.subTxt.style.letterSpacing = lerp(0.9, 0.32, sk).toFixed(3) + "em";
        L.lines.forEach((l) => (l.style.transform = `scaleX(${E.outExpo(prog(t, 2.85, 3.2)).toFixed(3)})`));
        tf(L.tag, { y: 24 * (1 - E.outCubic(prog(t, 3.05, 3.35))), o: prog(t, 3.05, 3.25) });

      };
    },
    20,
  ),
);
