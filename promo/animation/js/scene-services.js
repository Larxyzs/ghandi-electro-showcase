/* Scene 6 (17.45 – 21.15 s): the four services from the site's footer, each card lighting up on the beat
   with its own micro-animation (truck, payment, pick-up, WhatsApp). Exits with a vertical swipe. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "services",
    17.45,
    21.15,
    (root) => {
      const { el, E, prog, clamp, lerp, cue, tf, spring, gravityDrop, squash, icon, wobble } = M;
      const BLUE = ART.BLUE;
      const T_EXIT = 20.85;
      const CARDS = [
        { ic: "truck", title: "Livraison gratuite", sub: "Casablanca, Mohammedia et Dar Bouazza", a: 18.0 },
        { ic: "banknote", title: "Paiement à la livraison", sub: "Vous payez à la réception", a: 18.75 },
        { ic: "store", title: "Retrait au magasin", sub: "41 Boulevard Ghandi, Casablanca", a: 19.5 },
        { ic: "headphones", title: "Conseil par téléphone et WhatsApp", sub: "Nous vous aidons à choisir", a: 20.25 },
      ];
      const CW = 410;
      const CH = 520;
      const GAP = 30;
      const X0 = 960 - (4 * CW + 3 * GAP) / 2;
      const Y0 = 300;

      const bg = el(root, "fill");
      bg.style.background = "linear-gradient(180deg, #ffffff 0%, #f1f6ff 60%, #e3edfd 100%)";
      const glow = el(root, "abs");
      glow.style.cssText += "width:900px;height:900px;border-radius:50%;background:radial-gradient(closest-side, rgb(18 102 232 / .14), transparent);";
      const content = el(root, "fill");

      const title = el(content, "abs hd");
      title.style.cssText += "left:0;top:120px;width:1920px;text-align:center;font-size:86px;color:#0f172a;overflow:hidden;padding:0.05em 0 0.15em;";
      const tWords = ["Nos", "services"].map((w, i) => {
        const s = el(title, "wd", null, "span");
        s.textContent = w;
        if (i) s.style.color = BLUE;
        if (!i) el(title, "", " ", "span");
        return { s, t0: 17.5 + i * 0.12 };
      });

      // entrance accents behind the title
      const introFx = [
        FXL.ringPulse(root, { x: 960, y: 540, t0: 17.46, r0: 40, r1: 1200, width: 0, color: "transparent", fill: "rgb(18 102 232 / .08)", dur: 0.7 }),
        FXL.lineBurst(content, { x: 960, y: 170, t0: 17.62, n: 14, r0: 300, r1: 620, width: 6, color: BLUE, dur: 0.4, seed: 79 }),
        FXL.ringPulse(content, { x: 960, y: 170, t0: 17.62, r0: 60, r1: 520, width: 3, color: "rgb(18 102 232 / .5)", dur: 0.6 }),
      ];
      root.insertBefore(root.lastChild, content);
      const wrap = el(content, "fill");
      wrap.style.perspective = "1800px";
      const cards = CARDS.map((c, i) => {
        const d = el(wrap, "card");
        d.style.cssText += `left:${X0 + i * (CW + GAP)}px;top:${Y0}px;width:${CW}px;height:${CH}px;overflow:hidden;transform-origin:50% 100%;`;
        const fillBlue = el(d, "fill");
        fillBlue.style.cssText += `background:linear-gradient(160deg, #2f86ff, ${BLUE} 55%, #0b4fb8);border-radius:28px;transform-origin:0 100%;`;
        const icw = el(d, "abs");
        icw.style.cssText += `left:36px;top:36px;width:112px;height:112px;border-radius:30px;background:#e9f1fd;color:${BLUE};display:grid;place-items:center;`;
        icw.innerHTML = icon(c.ic, 58, 1.8);
        const tt = el(d, "abs");
        tt.style.cssText += "left:36px;top:178px;width:340px;font:700 34px/1.18 Roboto;color:#0f172a;";
        tt.textContent = c.title;
        const st = el(d, "abs");
        st.style.cssText += "left:36px;width:340px;font:400 23px/1.35 Roboto;color:#5f6368;";
        st.textContent = c.sub;
        const stage = el(d, "abs");
        stage.style.cssText += `left:0;top:${CH - 170}px;width:${CW}px;height:170px;overflow:hidden;`;
        return { d, fillBlue, icw, tt, st, stage, ...c, i };
      });
      cards.forEach((c) => (c.st.style.top = 178 + c.tt.offsetHeight + 14 + "px"));
      cards.forEach((c, i) => {
        c.num = el(c.d, "abs hd");
        c.num.style.cssText += "right:30px;left:auto;top:34px;font-size:44px;font-weight:800;";
        c.num.textContent = "0" + (i + 1);
      });

      // progress rail under the cards: fills up and a glowing dot hops from service to service
      const RAIL_Y = Y0 + CH + 64;
      const cx = (i) => X0 + i * (CW + GAP) + CW / 2;
      const rail = el(content, "abs");
      rail.style.cssText += `left:${cx(0)}px;top:${RAIL_Y - 3}px;width:${cx(3) - cx(0)}px;height:6px;border-radius:6px;background:#dbe6f7;`;
      const railFill = el(rail, "fill");
      railFill.style.cssText += `background:${BLUE};border-radius:6px;transform-origin:0 50%;`;
      const nodes = cards.map((c, i) => {
        const n = el(content, "abs");
        n.style.cssText += `left:${cx(i) - 14}px;top:${RAIL_Y - 14}px;width:28px;height:28px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 5px #dbe6f7;`;
        return n;
      });
      const dot = el(content, "abs");
      dot.style.cssText += `width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:${BLUE};box-shadow:0 0 0 8px rgb(18 102 232 / .2),0 0 24px ${BLUE};`;
      const actFx = cards.map((c, i) => [
        FXL.lineBurst(content, { x: cx(i), y: RAIL_Y, t0: c.a, n: 10, r0: 24, r1: 90, width: 5, color: BLUE, dur: 0.35, seed: 70 + i }),
        FXL.ringPulse(content, { x: cx(i), y: RAIL_Y, t0: c.a, r0: 14, r1: 70, width: 3, color: BLUE, dur: 0.5 }),
        FXL.shapeBurst(content, { x: cx(i), y: Y0 + 120, t0: c.a + 0.02, n: 12, speed: [300, 700], angle: [200, 340], colors: [BLUE, "#7fb2ff", "#0b57c4"], seed: 75 + i, gravity: 1200, size: [8, 16] }),
      ]).flat();

      /* card 1: delivery truck */
      const C1 = cards[0];
      const road = el(C1.stage, "abs");
      road.style.cssText += "left:24px;right:24px;top:128px;height:4px;border-radius:4px;background:rgb(255 255 255 / .35);";
      const truck = el(C1.stage, "abs");
      truck.style.cssText += "left:0;top:30px;";
      truck.innerHTML = icon("truck", 96, 1.7);
      const speed = [0, 1, 2].map((k) => {
        const s = el(C1.stage, "abs");
        s.style.cssText += `top:${62 + k * 18}px;height:4px;border-radius:4px;background:rgb(255 255 255 / .7);`;
        return s;
      });
      const puffs = M.burst(C1.stage, { n: 10, seed: 61, x: 60, y: 120, t0: 18.12, life: 0.6, speed: [40, 140], angle: [160, 220], size: [8, 18], gravity: -60, drag: 2, colors: ["rgb(255 255 255 / .55)"] });

      /* card 2: payment — note flips, check draws */
      const C2 = cards[1];
      const note = el(C2.stage, "abs");
      note.style.cssText += "left:60px;top:22px;";
      note.innerHTML = icon("banknote", 110, 1.6);
      const check2 = el(C2.stage, "abs");
      check2.style.cssText += "left:236px;top:30px;";
      check2.innerHTML = icon("circle-check-big", 96, 1.8);
      const check2s = M.prepDraw(check2);
      const coins = M.burst(C2.stage, { n: 14, seed: 77, x: 115, y: 80, t0: 18.86, life: 0.7, speed: [250, 520], angle: [215, 325], size: [12, 20], gravity: 1100, drag: 1.2, colors: ["#ffffff", "#cfe3ff"] });

      /* card 3: pick-up — parcel drops into the store */
      const C3 = cards[2];
      const store = el(C3.stage, "abs");
      store.style.cssText += "left:44px;top:26px;";
      store.innerHTML = icon("store", 110, 1.6);
      const parcel = el(C3.stage, "abs");
      parcel.style.cssText += "left:236px;top:44px;transform-origin:50% 100%;";
      parcel.innerHTML = icon("package", 86, 1.8);

      /* card 4: advice — phone rings, WhatsApp bubble */
      const C4 = cards[3];
      const ph = el(C4.stage, "abs");
      ph.style.cssText += "left:30px;top:30px;";
      ph.innerHTML = icon("phone-call", 84, 1.8);
      const bubble = el(C4.stage, "abs");
      bubble.style.cssText += "left:138px;top:18px;width:236px;padding:12px 14px;border-radius:18px 18px 18px 4px;background:#fff;color:#0f172a;font:500 17px/1.3 Roboto;box-shadow:0 10px 20px -10px rgb(0 0 0 / .4);transform-origin:0 100%;";
      bubble.innerHTML = `<span style="display:flex;align-items:center;gap:6px;font-weight:700;margin-bottom:4px;color:var(--wa)">${ART.waIcon(16)} WhatsApp</span>Bonjour, j'aimerais avoir des informations sur vos produits.`;

      /* ---------- sound ---------- */
      tWords.forEach((w, i) => cue(w.t0 + 0.14, "thud", { pitch: 0.95 + i * 0.1, gain: 0.7 }));
      cards.forEach((c, i) => cue(17.58 + i * 0.08, "swish", { gain: 0.35 + i * 0.05, pan: -0.6 + i * 0.4 }));
      cards.forEach((c, i) => cue(c.a, "hit", { pitch: 1.1 + i * 0.1, gain: 0.55 }));
      cards.forEach((c, i) => i && cue(c.a - 0.2, "blip", { pitch: 1 + i * 0.25, gain: 0.5 }));
      cue(18.06, "truck", { dur: 0.75, gain: 0.85 });
      cue(18.55, "horn", { gain: 0.6 });
      cue(18.86, "cash", { gain: 0.9 });
      cue(19.08, "tick", { pitch: 1.6, gain: 0.5 });
      cue(19.62, "fall", { dur: 0.16, gain: 0.5 });
      cue(19.78, "thud", { pitch: 1.0, gain: 0.8 });
      cue(20.3, "ring", { dur: 0.5, gain: 0.6 });
      cue(20.52, "ding", { pitch: 1.5, gain: 0.55 });
      cue(T_EXIT, "whoosh", { dur: 0.32, gain: 0.95, rise: 1 });

      return (t) => {
        // exit: everything swipes up while the map scene comes in from below
        const ex = E.inOutQuart(prog(t, T_EXIT, T_EXIT + 0.3));
        const push0 = E.inOutSine(prog(t, 17.6, 20.9));
        tf(content, { y: -1080 * ex, s: 1 + 0.05 * push0, f: ex > 0.02 && ex < 0.98 ? `blur(${(Math.sin(Math.PI * ex) * 10).toFixed(1)}px)` : "none" });
        const act = cards.find((c) => t >= c.a && t < c.a + 0.75) || null;
        const gx = act ? X0 + act.i * (CW + GAP) + CW / 2 : 960;
        tf(glow, { x: gx - 450, y: 560 - 450, o: act ? 1 : 0.5 });

        tWords.forEach((w) => {
          const hh = gravityDrop(t - w.t0, 130, 0.14, 0.12, 2);
          const qq = squash(t, w.t0 + 0.14, 0.15, 5, 10);
          w.s.style.transform = `translate3d(0,${(-hh).toFixed(1)}px,0) scale(${(1 + qq * 0.5).toFixed(3)},${(1 - qq).toFixed(3)})`;
          w.s.style.opacity = t < w.t0 ? "0" : "1";
        });

        cards.forEach((c, i) => {
          const a0 = 17.58 + i * 0.08;
          const s = spring(t - a0, 2.4, 0.55);
          const on = t >= c.a && t < c.a + 0.75;
          const lit = E.outCubic(prog(t, c.a, c.a + 0.18)) * (1 - E.inCubic(prog(t, c.a + 0.62, c.a + 0.8)));
          tf(c.d, { y: lerp(620, 0, s) - 18 * lit, rx: lerp(-55, 0, s), s: 1 + 0.045 * lit, o: prog(t, a0, a0 + 0.08) });
          c.d.style.zIndex = on ? "2" : "1";
          c.fillBlue.style.transform = `scaleY(${lit.toFixed(4)})`;
          c.fillBlue.style.opacity = lit > 0.001 ? "1" : "0";
          const white = lit > 0.8; // switch text colour only once the blue fill covers it
          c.tt.style.color = white ? "#ffffff" : "#0f172a";
          c.st.style.color = white ? "rgb(255 255 255 / .9)" : "#5f6368";
          c.icw.style.background = white ? "#ffffff" : "#e9f1fd";
          tf(c.icw, { s: 1 + 0.18 * Math.sin(Math.PI * prog(t, c.a, c.a + 0.3)), r: 10 * Math.sin(Math.PI * 2 * prog(t, c.a, c.a + 0.3)) });
          // the illustration rests in pale blue and turns white when the card lights up
          c.stage.style.color = white ? "#ffffff" : BLUE;
          c.stage.style.opacity = (0.22 + 0.78 * lit).toFixed(3);
        });

        introFx.forEach((u) => u(t));
        // progress rail, hopping dot, numbers, activation bursts, slow camera push
        const k = cards.reduce((a, c, i) => a + (i ? E.inOutCubic(prog(t, c.a - 0.22, c.a)) : 0), 0);
        railFill.style.transform = `scaleX(${(k / 3).toFixed(4)})`;
        const dx = cx(0) + k * (CW + GAP);
        const hop = cards.reduce((a, c, i) => a + (i ? Math.sin(Math.PI * prog(t, c.a - 0.22, c.a)) : 0), 0);
        tf(dot, { x: dx, y: RAIL_Y - 60 * hop, o: prog(t, 17.9, 18.0), s: 1 + 0.25 * hop });
        nodes.forEach((n, i) => {
          const hit = t >= cards[i].a;
          n.style.boxShadow = hit ? `inset 0 0 0 5px ${BLUE}` : "inset 0 0 0 5px #dbe6f7";
          tf(n, { s: 1 + M.squash(t, cards[i].a, 0.45, 4, 8), o: prog(t, 17.6 + i * 0.08, 17.75 + i * 0.08) });
        });
        rail.style.opacity = prog(t, 17.6, 17.9).toFixed(3);
        cards.forEach((c) => {
          const lit = t >= c.a && t < c.a + 0.78;
          c.num.style.color = lit ? "rgb(255 255 255 / .55)" : "#dbe6f7";
        });
        actFx.forEach((u) => u(t));
        content.style.transformOrigin = "960px 560px";

        // card 1: truck drives through
        const tk = prog(t, 18.06, 18.5);
        const tx = lerp(-130, 150, E.outBack(tk)); // drives in and parks
        tf(truck, { x: tx, y: -Math.abs(Math.sin(t * 38)) * 4 * (tk > 0 && tk < 1 ? 1 : 0) });
        speed.forEach((s, k) => {
          s.style.left = tx - 70 - k * 14 + "px";
          s.style.width = 60 + k * 10 + "px";
          s.style.opacity = (tk > 0 && tk < 1 ? 0.8 - k * 0.2 : 0).toFixed(3);
        });
        puffs(t);
        // card 2
        tf(note, { ry: 360 * E.outCubic(prog(t, 18.8, 19.15)), y: -16 * Math.sin(Math.PI * prog(t, 18.8, 19.15)) });
        M.drawTo(check2s, E.outCubic(prog(t, 19.05, 19.3)));
        coins(t);
        // card 3
        const ph3 = gravityDrop(t - 19.62, 160, 0.16, 0.2, 2);
        const q3 = squash(t, 19.78, 0.2, 5, 9);
        tf(parcel, { y: -ph3, sx: 1 + q3 * 0.5, sy: 1 - q3, o: t > 19.6 ? 1 : 0 });
        tf(store, { s: 1 + 0.06 * Math.sin(Math.PI * prog(t, 19.78, 19.95)) });
        // card 4
        tf(ph, { r: wobble(t, 20.3, 14, 9, 4) * (t < 20.8 ? 1 : 0) });
        const bs = spring(t - 20.5, 3, 0.5);
        tf(bubble, { s: Math.max(0, bs), o: prog(t, 20.5, 20.55) });
      };
    },
    6,
  ),
);
