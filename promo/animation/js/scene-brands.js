/* Scene 5 (14.5 – 17.5 s): eight brand slams on the 8th notes, alternating white/blue,
   each with its own entrance; then they settle into the site's "Nos marques" grid. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "brands",
    14.5,
    17.52,
    (root) => {
      const { el, E, prog, clamp, lerp, cue, tf, shake, spring, gravityDrop, squash } = M;
      const BLUE = ART.BLUE;
      const BRANDS = SITE.BRANDS;
      const T1 = 14.75;
      const STEP = 0.25;
      const T_GRID = T1 + BRANDS.length * STEP; // 16.75

      const bg = el(root, "fill");
      const stripes = el(root, "fill");
      stripes.style.cssText += "inset:-400px;background:repeating-linear-gradient(-28deg, rgb(255 255 255 / 0) 0 70px, rgb(255 255 255 / .07) 70px 140px);";
      const ghost = el(root, "abs hd");
      ghost.style.cssText += "left:0;top:350px;width:1920px;text-align:center;font-size:420px;font-weight:900;color:transparent;";

      const intro = el(root, "abs hd");
      intro.style.cssText += `left:0;top:470px;width:1920px;text-align:center;font-size:110px;color:${BLUE};`;
      intro.textContent = "Nos marques";

      const words = BRANDS.map((b) => {
        const w = el(root, "abs hd");
        w.style.cssText += "left:0;top:0;width:1920px;text-align:center;font-weight:900;";
        w.textContent = b;
        M.fitText(w, 1450, 300);
        w.style.top = 540 - parseFloat(w.style.fontSize) * 0.56 + "px";
        return w;
      });
      // per-letter spans for the staggered entrance (brand index 3)
      const staggerIdx = 3;
      words[staggerIdx].textContent = "";
      const letters = M.split(words[staggerIdx], BRANDS[staggerIdx]);
      words[staggerIdx].style.overflow = "hidden";
      // offset copies for the glitch entrance (brand index 7), drawn under the word
      const glitchIdx = 7;
      const ghosts = ["#9cc6ff", "#0a3f9c"].map((c) => {
        const g = el(root, "abs hd");
        g.style.cssText = words[glitchIdx].style.cssText + `color:${c};`;
        g.textContent = BRANDS[glitchIdx];
        root.insertBefore(g, words[glitchIdx]);
        return g;
      });

      const hudL = el(root, "abs");
      hudL.style.cssText += "left:80px;top:70px;font:700 22px Roboto;letter-spacing:.24em;text-transform:uppercase;";
      hudL.textContent = "Nos marques";
      const hudR = el(root, "abs hd");
      hudR.style.cssText += "left:auto;right:80px;top:66px;font-size:30px;";
      const prog8 = el(root, "abs");
      prog8.style.cssText += "left:80px;bottom:70px;width:1760px;height:5px;border-radius:5px;overflow:hidden;";
      const progFill = el(prog8, "fill");
      progFill.style.transformOrigin = "0 50%";

      // per-slam ray bursts (blue on white frames, white on blue frames)
      const slamFx = BRANDS.map((_, i) =>
        FXL.lineBurst(root, { x: 960, y: 540, t0: T1 + i * STEP, n: 16, r0: 560, r1: 980, width: 7, color: i % 2 ? "rgb(255 255 255 / .8)" : BLUE, dur: 0.26, seed: 60 + i, rot: i * 11 }),
      );

      // finale: a tilted 3D wall of brand tiles sliding in alternating directions
      const wall = el(root, "fill");
      wall.style.perspective = "1500px";
      const plane = el(wall, "abs");
      plane.style.cssText += "left:-700px;top:-260px;width:3320px;height:1600px;transform-origin:50% 50%;";
      const wallRows = [];
      for (let r = 0; r < 7; r++) {
        const row = el(plane, "abs");
        row.style.cssText += `left:0;top:${r * 225}px;display:flex;gap:28px;white-space:nowrap;`;
        let html = "";
        for (let k = 0; k < 16; k++) {
          const b = BRANDS[(k + r * 3) % BRANDS.length];
          const hot = (k + r) % 5 === 0;
          html += `<span style="flex:none;width:330px;height:180px;border-radius:28px;display:grid;place-items:center;font:900 52px Roboto;letter-spacing:-.01em;
            background:${hot ? BLUE : "#fff"};color:${hot ? "#fff" : "#0f172a"};box-shadow:0 26px 44px -28px rgb(11 57 140 / .55), inset 0 0 0 2px ${hot ? BLUE : "#e3ebf7"};">${b}</span>`;
        }
        row.innerHTML = html;
        wallRows.push(row);
      }
      const gridTitle = el(root, "abs hd");
      gridTitle.style.cssText += `left:0;top:470px;width:1920px;text-align:center;font-size:110px;color:#fff;`;
      gridTitle.innerHTML = `<span style="display:inline-block;background:${BLUE};padding:26px 64px 34px;border-radius:40px;box-shadow:0 40px 80px -30px rgb(4 21 58 / .6)">Nos marques</span>`;
      const titleBox = gridTitle.firstChild;

      /* ---------- sound ---------- */
      cue(14.58, "thud", { pitch: 0.9, gain: 0.7 });
      BRANDS.forEach((_, i) => {
        const t = T1 + i * STEP;
        cue(t - 0.05, "whoosh", { dur: 0.1, gain: 0.35, pan: i % 2 ? 0.5 : -0.5 });
        cue(t, "punch", { pitch: [1, 1.12, 0.95, 1.2, 1.05, 1.3, 1.1, 1.4][i], gain: 0.9 });
      });
      cue(glitchIdx * STEP + T1, "glitch", { dur: 0.2, gain: 0.5 });
      cue(T_GRID, "whoosh", { dur: 0.25, gain: 0.5 });
      cue(T_GRID + 0.02, "thud", { pitch: 1.1, gain: 0.6 });
      cue(T_GRID + 0.08, "pop", { pitch: 1.2, gain: 0.7 });
      cue(T_GRID + 0.05, "riserShort", { dur: 0.45, gain: 0.5 });
      cue(17.28, "whoosh", { dur: 0.25, gain: 0.6, pan: -0.3 });

      return (t) => {
        const idx = clamp(Math.floor((t - T1) / STEP), -1, BRANDS.length - 1);
        const inSlams = t >= T1 && t < T_GRID;
        const dark = inSlams && idx % 2 === 1;
        const gridOn = t >= T_GRID;
        bg.style.background = gridOn ? "radial-gradient(circle at 50% 40%, #ffffff 0%, #eef4ff 60%, #dde9fc 100%)" : dark ? BLUE : "#ffffff";
        stripes.style.display = dark ? "" : "none";
        tf(stripes, { x: ((t * 300) % 158) - 158 });
        const fg = dark ? "#ffffff" : BLUE;

        // intro title before the first slam
        const ik = E.outBack(prog(t, 14.52, 14.66));
        intro.style.display = t < T1 ? "" : "none";
        tf(intro, { s: lerp(0.6, 1, ik), o: prog(t, 14.52, 14.58) });

        hudL.style.display = hudR.style.display = prog8.style.display = inSlams ? "" : "none";
        hudL.style.color = hudR.style.color = fg;
        prog8.style.background = dark ? "rgb(255 255 255 / .25)" : "rgb(18 102 232 / .15)";
        progFill.style.background = fg;
        progFill.style.transform = `scaleX(${clamp((t - T1) / (T_GRID - T1)).toFixed(4)})`;
        hudR.textContent = `0${Math.max(0, idx) + 1} / 08`;

        // ghost outline of the current brand
        ghost.style.display = inSlams ? "" : "none";
        if (inSlams) {
          ghost.textContent = BRANDS[idx];
          ghost.style.webkitTextStroke = `3px ${dark ? "rgb(255 255 255 / .18)" : "rgb(18 102 232 / .12)"}`;
          tf(ghost, { x: lerp(160, -160, (t - T1 - idx * STEP) / STEP), s: 1.05 });
        }

        words.forEach((w, i) => {
          const a = T1 + i * STEP;
          const on = inSlams && i === idx;
          w.style.display = on ? "" : "none";
          if (!on) return;
          w.style.color = fg;
          const d = t - a;
          const k = clamp(d / 0.16);
          const drift = 1 + 0.05 * (d / STEP);
          let o = { s: drift };
          switch (i % 8) {
            case 0: {
              const e = E.outExpo(k);
              o = { s: lerp(1.7, 1, e) * drift, f: e < 0.96 ? `blur(${((1 - e) * 18).toFixed(1)}px)` : "none" };
              break;
            }
            case 1: {
              const e = E.outExpo(k);
              o = { x: lerp(900, 0, e), skx: lerp(-28, 0, e), s: drift, f: e < 0.96 ? `blur(${((1 - e) * 12).toFixed(1)}px)` : "none" };
              break;
            }
            case 2: {
              const h = gravityDrop(d, 520, 0.12, 0.12, 2);
              const q = squash(t, a + 0.12, 0.16, 6, 12);
              o = { y: -h, sx: (1 + q * 0.5) * drift, sy: (1 - q) * drift };
              break;
            }
            case 4: {
              const e = E.outBack(k);
              o = { r: lerp(-16, 0, e), s: lerp(0.3, 1, e) * drift };
              break;
            }
            case 5: {
              const e = E.outExpo(k);
              o = { y: lerp(-300, 0, e), sy: lerp(2.2, 1, e) * drift, sx: drift, o: e };
              break;
            }
            case 6: {
              const e = E.outExpo(k);
              o = { s: lerp(4, 1, e) * drift, o: e, f: e < 0.96 ? `blur(${((1 - e) * 20).toFixed(1)}px)` : "none" };
              break;
            }
            default:
              o = { s: drift };
          }
          tf(w, o);
        });
        letters.forEach((s, j) => {
          const a = T1 + staggerIdx * STEP + j * 0.012;
          const e = E.outBack(prog(t, a, a + 0.12));
          s.style.transform = `translate3d(0,${(240 * (1 - e)).toFixed(1)}px,0)`;
        });
        ghosts.forEach((g, j) => {
          const a = T1 + glitchIdx * STEP;
          const on = inSlams && idx === glitchIdx;
          g.style.display = on ? "" : "none";
          if (!on) return;
          const d = t - a;
          const amp = 40 * Math.exp(-d * 18);
          const jx = (j ? 1 : -1) * amp * (0.6 + 0.4 * Math.sin(d * 90));
          tf(g, { x: jx, y: (j ? -1 : 1) * amp * 0.25, o: 0.85 * Math.exp(-d * 10) });
        });

        slamFx.forEach((u) => u(t));

        // finale wall
        wall.style.display = gridOn ? "" : "none";
        const wk = E.outExpo(prog(t, T_GRID, T_GRID + 0.45));
        const out = E.inCubic(prog(t, 17.25, 17.5));
        tf(plane, { rx: lerp(62, 30, wk), r: -14, s: lerp(1.5, 1, wk) * (1 + 1.6 * out), o: 1 - out });
        wallRows.forEach((row, r) => tf(row, { x: (r % 2 ? -1 : 1) * (t - T_GRID) * 520 - 900 }));
        const gt = spring(t - T_GRID - 0.06, 3, 0.48);
        titleBox.style.transform = `scale(${Math.max(0, gt * (1 - out)).toFixed(4)}) rotate(${((1 - Math.min(1, gt)) * -8).toFixed(2)}deg)`;
        gridTitle.style.opacity = gridOn ? "1" : "0";

        const sh = shake(t, T1 + Math.max(0, idx) * STEP, 0.16, inSlams ? 9 : 0, 26, idx + 1);
        root.style.transform = `translate(${sh.x.toFixed(1)}px,${sh.y.toFixed(1)}px)`;
      };
    },
    5,
  ),
);
