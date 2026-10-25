/* Scene 4 (11.0 – 14.6 s): on blue, the five univers roll in on the beat (3D word roll + flipping icon card),
   then they land as the site's white "Nos univers" tiles. Ends with a white iris. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "univers",
    11.0,
    14.6,
    (root) => {
      const { el, E, prog, clamp, lerp, cue, tf, shake, spring, icon } = M;
      const BLUE = ART.BLUE;
      const T0 = 11.0;
      const STEP = 0.5;
      const ITEMS = [
        { w: "Froid", ic: "refrigerator", sub: "Réfrigérateurs · Congélateurs" },
        { w: "Lavage", ic: "washing-machine", sub: "Machines à laver · Sèche-linge · Lave-vaisselle" },
        { w: "Cuisson", ic: "flame", sub: "Cuisinières · Fours · Micro-ondes · Hottes" },
        { w: "TV", ic: "tv", sub: "Téléviseurs · Barres de son" },
        { w: "Climatisation", ic: "air-vent", sub: "Climatiseurs · Ventilateurs" },
      ];
      const T_TILES = T0 + ITEMS.length * STEP; // 13.5

      /* ---------- background ---------- */
      const bg = el(root, "fill");
      bg.style.background = "radial-gradient(circle at 50% 46%, #3a8dff 0%, #1266e8 45%, #0a48a8 100%)";
      const pulse = el(root, "fill");
      pulse.style.background = "radial-gradient(circle at 50% 50%, rgb(255 255 255 / .22), transparent 60%)";
      const marq = el(root, "abs");
      marq.style.cssText += "left:-600px;top:-500px;width:3200px;height:2200px;transform-origin:50% 50%;";
      const rowsM = [];
      const iconsList = ["refrigerator", "washing-machine", "flame", "tv", "air-vent", "microwave", "snowflake", "fan"];
      for (let r = 0; r < 9; r++) {
        const row = el(marq, "");
        row.style.cssText += "display:flex;gap:90px;height:240px;align-items:center;color:rgb(255 255 255 / .09);white-space:nowrap;";
        let html = "";
        for (let i = 0; i < 26; i++) html += icon(iconsList[(i + r * 3) % iconsList.length], 110, 1.4);
        row.innerHTML = html;
        rowsM.push(row);
      }
      // streaks continuing the wipe from the previous scene
      const streaks = ["#5aa2ff", "#9cc6ff"].map((c) => {
        const d = el(root, "abs");
        d.style.cssText += `top:-100px;height:1280px;width:260px;background:${c};transform-origin:0 0;`;
        return d;
      });

      /* ---------- word roll ---------- */
      // kinetic outline bands top and bottom, a beat burst behind the word, confetti when the tiles land
      const BAND = "FROID · LAVAGE · CUISSON · TV · CLIMATISATION · ";
      const bands = [
        FXL.marquee(root, { text: BAND, size: 92, stroke: "2px rgb(255 255 255 / .22)", speed: 420, y: -6, gap: 0, reps: 4 }),
        FXL.marquee(root, { text: BAND, size: 92, stroke: "2px rgb(255 255 255 / .22)", speed: -420, y: 978, gap: 0, reps: 4 }),
      ];
      const beatFx = ITEMS.map((_, i) => [
        FXL.lineBurst(root, { x: 960, y: 650, t0: T0 + i * STEP, n: 18, r0: 330, r1: 760, width: 6, color: "rgb(255 255 255 / .75)", dur: 0.38, seed: 50 + i, rot: i * 9 }),
        FXL.ringPulse(root, { x: 960, y: 350, t0: T0 + i * STEP + 0.03, r0: 90, r1: 260, width: 4, color: "rgb(255 255 255 / .8)", dur: 0.45 }),
      ]).flat();
      const tileFx = FXL.shapeBurst(root, { x: 960, y: 535, t0: T_TILES + 0.4, n: 30, speed: [700, 1500], colors: ["#ffffff", "#cfe3ff", "#9cc6ff"], seed: 58, gravity: 900 });
      const label = el(root, "abs pill");
      label.style.cssText += "left:960px;top:150px;color:#fff;font-size:26px;letter-spacing:.2em;text-transform:uppercase;box-shadow:inset 0 0 0 2px rgb(255 255 255 / .6);";
      label.innerHTML = "Nos univers";
      const counter = el(root, "abs hd");
      counter.style.cssText += "left:120px;top:520px;font-size:40px;color:rgb(255 255 255 / .9);";
      const cardWrap = el(root, "abs");
      cardWrap.style.cssText += "left:860px;top:250px;width:200px;height:200px;perspective:900px;";
      const card = el(cardWrap, "fill");
      card.style.cssText += "border-radius:52px;background:#fff;display:grid;place-items:center;color:" + BLUE + ";box-shadow:0 30px 50px -24px rgb(2 20 60 / .6);";
      const cardIcons = ITEMS.map((it) => {
        const d = el(card, "abs");
        d.style.cssText += "left:30px;top:30px;width:140px;height:140px;";
        d.innerHTML = icon(it.ic, 140, 1.5);
        return { d, shapes: M.prepDraw(d) };
      });
      const slot = el(root, "abs");
      slot.style.cssText += "left:0;top:440px;width:1920px;height:420px;overflow:hidden;";
      const words = ITEMS.map((it) => {
        const w = el(slot, "abs hd");
        w.textContent = it.w.toUpperCase();
        w.style.cssText += "left:0;top:0;width:1920px;text-align:center;color:#fff;font-weight:900;";
        M.fitText(w, 1500, 250);
        w.style.top = 210 - parseFloat(w.style.fontSize) * 0.5 + "px";
        return w;
      });
      const subs = ITEMS.map((it) => {
        const s = el(root, "abs");
        s.style.cssText += "left:0;top:812px;width:1920px;text-align:center;font:500 34px Roboto;color:rgb(255 255 255 / .9);letter-spacing:.01em;";
        s.textContent = it.sub;
        return s;
      });
      const bar = el(root, "abs");
      bar.style.cssText += "left:760px;top:900px;width:400px;height:6px;border-radius:6px;background:rgb(255 255 255 / .25);overflow:hidden;";
      const barFill = el(bar, "fill");
      barFill.style.cssText += "background:#fff;transform-origin:0 50%;";

      /* ---------- tiles (as on the home page) ---------- */
      const title = el(root, "abs hd");
      title.style.cssText += "left:0;top:226px;width:1920px;text-align:center;font-size:84px;color:#fff;";
      title.textContent = "Nos univers";
      const tiles = ITEMS.map((it, i) => {
        const d = el(root, "abs");
        const x = 960 - (5 * 250 + 4 * 28) / 2 + i * 278;
        d.style.cssText += `left:${x}px;top:390px;width:250px;height:290px;border-radius:26px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;
          box-shadow:0 30px 50px -26px rgb(2 20 60 / .65);`;
        d.innerHTML = `<span style="color:${BLUE}">${icon(it.ic, 110, 1.4)}</span><b style="font:700 30px Roboto;color:#0f172a">${it.w}</b>`;
        return { d, t0: T_TILES + 0.05 + i * 0.07, x };
      });
      const tagline = el(root, "abs");
      tagline.style.cssText += "left:0;top:740px;width:1920px;text-align:center;font:500 36px Roboto;color:rgb(255 255 255 / .92);";
      tagline.textContent = "Froid, lavage, cuisson, TV et climatisation";

      // white iris into the brands scene
      const iris = el(root, "abs");
      iris.style.cssText += "border-radius:50%;background:#fff;";

      /* ---------- sound ---------- */
      cue(T0, "impact", { gain: 0.8 });
      ITEMS.forEach((_, i) => {
        const t = T0 + i * STEP;
        if (i) cue(t - 0.04, "whoosh", { dur: 0.18, gain: 0.55, pan: 0 });
        cue(t, "hit", { pitch: 1 + i * 0.08, gain: 0.8 });
        cue(t + 0.02, "swish", { gain: 0.35 });
      });
      cue(T_TILES - 0.05, "whoosh", { dur: 0.3, gain: 0.6 });
      tiles.forEach((tl, i) => cue(tl.t0 + 0.06, "pop", { pitch: 1 + i * 0.12, gain: 0.65 }));
      cue(14.0, "shimmer", { dur: 0.4, gain: 0.35 });
      cue(14.3, "whoosh", { dur: 0.3, gain: 0.8, rise: 1 });

      return (t) => {
        const lt = t - T0;
        // background motion
        const beat = (lt % 0.5) / 0.5;
        pulse.style.opacity = (0.25 + 0.75 * Math.pow(1 - beat, 3)).toFixed(3);
        tf(marq, { r: -14, s: 1 + 0.02 * Math.sin(t) });
        rowsM.forEach((r, i) => tf(r, { x: (i % 2 ? -1 : 1) * (lt * 140) - (i % 2 ? 0 : 600) }));
        bands.forEach((u) => u(t));
        beatFx.forEach((u) => u(t));
        tileFx(t);
        streaks.forEach((d, i) => {
          const k = E.outCubic(prog(t, T0 + i * 0.04, T0 + 0.35 + i * 0.04));
          tf(d, { x: lerp(-200 + i * 300, -2400, k), skx: -18 });
        });
        const sh = shake(t, T0, 0.35, 12, 22, 5);
        root.style.transform = `translate(${sh.x.toFixed(1)}px,${sh.y.toFixed(1)}px)`;

        // which univers is current
        const idx = clamp(Math.floor(lt / STEP), 0, ITEMS.length - 1);
        const inWords = t < T_TILES;
        const outW = E.inBack(prog(t, T_TILES - 0.1, T_TILES + 0.06));

        tf(label, { x: -label.offsetWidth / 2, s: Math.max(0, spring(t - T0 - 0.05, 3, 0.5)) * (1 - outW), o: 1 - outW });
        counter.textContent = `0${idx + 1} / 05`;
        tf(counter, { o: inWords ? prog(t, T0 + 0.1, T0 + 0.3) * (1 - outW) : 0 });
        tf(cardWrap, { s: Math.max(0, spring(t - T0, 3.2, 0.45)) * (1 - outW), y: -30 * outW });

        // card flips 180° on each change; the icon draws itself
        const sinceChange = lt - idx * STEP;
        const flip = idx === 0 ? 1 : E.outBack(clamp(sinceChange / 0.32));
        tf(card, { ry: (1 - flip) * -180 * (idx % 2 ? 1 : -1) });
        cardIcons.forEach((c, i) => {
          c.d.style.display = i === idx ? "" : "none";
          if (i === idx) M.drawTo(c.shapes, E.outCubic(clamp((sinceChange - 0.05) / 0.35)));
        });

        words.forEach((w, i) => {
          const tIn = T0 + i * STEP;
          const tOut = tIn + STEP;
          if (!inWords && i !== ITEMS.length - 1) {
            w.style.display = "none";
            return;
          }
          const kin = i === 0 ? E.outExpo(prog(t, tIn, tIn + 0.25)) : E.outCubic(prog(t, tIn - 0.04, tIn + 0.2));
          const kout = i === ITEMS.length - 1 ? 0 : E.inCubic(prog(t, tOut - 0.06, tOut + 0.12));
          const vis = t >= tIn - 0.05 && kout < 1;
          w.style.display = vis ? "" : "none";
          if (!vis) return;
          // vertical slot-machine roll inside the mask, with motion blur while moving
          const mv = Math.max(Math.sin(Math.PI * kin), Math.sin(Math.PI * kout));
          const blur = i === 0 ? (1 - kin) * 14 : mv * 9;
          const f = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : "none";
          if (i === 0) tf(w, { s: lerp(1.3, 1, kin) * (1 - 0.3 * kout), y: -420 * kout, o: kin, f });
          else if (i === ITEMS.length - 1) tf(w, { y: 420 * (1 - kin) - 420 * outW, s: 1 - 0.3 * outW, f });
          else tf(w, { y: 420 * (1 - kin) - 420 * kout, f });
        });
        subs.forEach((s, i) => {
          const tIn = T0 + i * STEP + 0.05;
          const on = i === idx && inWords;
          const k = E.outCubic(prog(t, tIn, tIn + 0.2));
          s.style.display = on ? "" : "none";
          tf(s, { y: 20 * (1 - k), o: k * (1 - outW) });
        });
        barFill.style.transform = `scaleX(${clamp(lt / (ITEMS.length * STEP)).toFixed(4)})`;
        tf(bar, { o: 1 - outW });

        // tiles
        const tt = E.outBack(prog(t, T_TILES, T_TILES + 0.35));
        tf(title, { y: 60 * (1 - tt), o: prog(t, T_TILES + 0.02, T_TILES + 0.12) * (1 - prog(t, 14.3, 14.42)) });
        tiles.forEach((tl, i) => {
          const s = spring(t - tl.t0, 2.8, 0.5);
          const away = E.inBack(prog(t, 14.28 + i * 0.03, 14.5 + i * 0.03));
          tf(tl.d, {
            y: lerp(420, 0, s) - 900 * away,
            r: (1 - s) * (i % 2 ? 14 : -14),
            o: prog(t, tl.t0, tl.t0 + 0.06),
          });
        });
        tf(tagline, { y: 30 * (1 - E.outCubic(prog(t, 13.95, 14.2))), o: prog(t, 13.95, 14.15) * (1 - prog(t, 14.3, 14.4)) });

        const ir = 2200 * E.inCubic(prog(t, 14.34, 14.6));
        iris.style.width = iris.style.height = 2 * ir + "px";
        tf(iris, { x: 960 - ir, y: 540 - ir, o: ir > 1 ? 1 : 0 });
      };
    },
    4,
  ),
);
