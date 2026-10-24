/* Scene 2 (2.7 – 7.0 s): revealed through the washer door. The phone drops and lands, the headline
   drops word by word, notifications drop onto the screen, the page scrolls, then a zoom into the screen. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "phone",
    2.7,
    7.0,
    (root) => {
      const { el, tw, E, prog, clamp, lerp, cue, tf, shake, gravityDrop, squash, spring, wobble, icon } = M;
      const BLUE = ART.BLUE;
      const TL = 3.25; // phone lands
      const T_FALL = 0.3;
      const PX = 1430; // phone centre x
      const PTOP = 112;
      const GROUND = PTOP + 874;

      /* ---------- background ---------- */
      const bg = el(root, "fill");
      bg.style.background = "#ffffff";
      const grid = el(root, "fill");
      grid.style.cssText += `inset:-120px;background-image:linear-gradient(#e8f0fc 2px, transparent 2px),linear-gradient(90deg,#e8f0fc 2px, transparent 2px);background-size:80px 80px;`;
      const blobs = [
        { x: 1380, y: 520, s: 980, c: "rgb(18 102 232 / .16)" },
        { x: 260, y: 980, s: 760, c: "rgb(18 102 232 / .10)" },
        { x: 640, y: 80, s: 560, c: "rgb(90 162 255 / .12)" },
      ].map((b) => {
        const d = el(root, "abs");
        d.style.cssText += `left:${b.x - b.s / 2}px;top:${b.y - b.s / 2}px;width:${b.s}px;height:${b.s}px;border-radius:50%;background:radial-gradient(closest-side, ${b.c}, transparent);`;
        return d;
      });
      const ghost = el(root, "abs hd");
      ghost.textContent = "GHANDI HOME ELECTRO";
      ghost.style.cssText += "top:690px;left:0;font-size:300px;font-weight:900;color:transparent;-webkit-text-stroke:3px #dfe9fb;";

      const cam = el(root, "fill");
      cam.style.transformOrigin = `${PX}px 540px`;

      /* ---------- headline ---------- */
      const head = el(cam, "abs");
      head.style.cssText += "left:130px;top:250px;width:1060px;";
      const kicker = el(head, "");
      kicker.style.cssText += `display:flex;align-items:center;gap:14px;font:700 24px Roboto;letter-spacing:.22em;color:${BLUE};text-transform:uppercase;margin-bottom:26px;`;
      kicker.innerHTML = `<span style="width:56px;height:4px;border-radius:4px;background:${BLUE}"></span>Bienvenue chez Ghandi Home Electro`;
      const LINES = [
        [["Votre", 3.5], ["magasin", 3.625]],
        [["d'électroménager", 3.75]],
        [["à", 4.0], ["Casablanca", 4.125, true]],
      ];
      const probe = el(head, "hd");
      probe.textContent = "d'électroménager";
      const fs = M.fitText(probe, 1040, 110);
      probe.remove();
      const words = [];
      LINES.forEach((ln) => {
        // each line is a mask: words drop into it from above and bounce on its baseline
        const row = el(head, "hd");
        row.style.cssText += `font-size:${fs}px;line-height:1.16;color:#0f172a;overflow:hidden;padding:0.05em 0.2em 0.16em 0;margin:-0.05em 0 -0.16em;`;
        ln.forEach(([w, t0, hl], i) => {
          const s = el(row, "wd", null, "span");
          s.textContent = w;
          if (hl) s.style.color = BLUE;
          if (i < ln.length - 1) el(row, "", " ", "span");
          words.push({ s, t0, rot: (i % 2 ? 1 : -1) * (6 + 5 * ((t0 * 7) % 1)) });
        });
      });
      const casa = words[words.length - 1].s;
      const swoosh = el(head, "abs");
      swoosh.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 600 60" preserveAspectRatio="none"><path d="M8 40 C 140 18, 300 14, 592 30" stroke="${BLUE}" stroke-width="14" fill="none" stroke-linecap="round"/></svg>`;
      const swooshPath = swoosh.querySelectorAll("path");
      M.prepDraw(swoosh);

      // chips
      const chips = [
        { ic: "map-pin", txt: "41 Boulevard Ghandi, Casablanca", t0: 4.5 },
        { ic: "phone", txt: SITE.PHONE, t0: 4.62 },
      ].map((c, i) => {
        const d = el(head, "pill");
        d.style.cssText += `position:absolute;left:${i ? 600 : 0}px;background:#fff;color:#0f172a;font-size:26px;box-shadow:0 14px 30px -16px rgb(11 57 140 / .45),inset 0 0 0 2px #dbe6f7;`;
        d.innerHTML = `<span style="color:${BLUE}">${icon(c.ic, 30, 2.2)}</span>${c.txt}`;
        d.style.transformOrigin = "0% 50%";
        return { d, ...c };
      });

      /* ---------- phone ---------- */
      const stagePhone = el(cam, "fill");
      stagePhone.style.perspective = "2200px";
      const shadow = el(stagePhone, "abs");
      shadow.style.cssText += `left:${PX - 230}px;top:${GROUND - 26}px;width:460px;height:52px;border-radius:50%;background:radial-gradient(closest-side, rgb(4 21 58 / .38), transparent);`;
      const phone = el(stagePhone, "phone");
      phone.style.left = PX - 210 + "px";
      phone.style.top = PTOP + "px";
      [
        [-5, 170, 32],
        [-5, 230, 62],
        [-5, 306, 62],
        [420, 250, 96],
      ].forEach(([x, y, h]) => {
        const b = el(phone, "btn");
        b.style.cssText += `left:${x}px;top:${y}px;height:${h}px;`;
      });
      const screen = el(phone, "screen");
      const scroll = el(screen, "abs");
      scroll.innerHTML = SITE.mobileHome();
      el(screen, "island");
      const fab = el(screen, "fab", ART.waIcon(28));
      fab.style.cssText += "right:18px;bottom:34px;";
      el(screen, "glare");

      // notifications
      const NOTIFS = [
        { t0: 4.75, title: "Livraison gratuite", body: "À Casablanca, Mohammedia et Dar Bouazza." },
        { t0: 5.25, title: "Paiement à la livraison", body: "Vous payez à la réception." },
        { t0: 5.75, title: "Conseil par téléphone et WhatsApp", body: "Nous vous aidons à choisir." },
      ].map((n) => {
        const d = el(screen, "notif");
        d.innerHTML = `<div class="app">${ART.logoMark(30)}</div><div style="flex:1;min-width:0"><div class="meta"><span>GHANDI HOME ELECTRO</span><span>maintenant</span></div><b>${n.title}</b><p>${n.body}</p></div>`;
        return { d, ...n };
      });
      const NH = NOTIFS.map((n) => n.d.offsetHeight);

      // landing FX
      const dust = [
        M.burst(stagePhone, { n: 26, seed: 21, x: PX - 150, y: GROUND - 4, t0: TL, life: 0.7, speed: [250, 900], angle: [180, 215], size: [5, 14], gravity: 900, drag: 3.5, colors: [BLUE, "#7fb2ff", "#cfe0fb"] }),
        M.burst(stagePhone, { n: 26, seed: 22, x: PX + 150, y: GROUND - 4, t0: TL, life: 0.7, speed: [250, 900], angle: [-35, 0], size: [5, 14], gravity: 900, drag: 3.5, colors: [BLUE, "#7fb2ff", "#cfe0fb"] }),
      ];
      const ring = el(stagePhone, "abs");
      ring.style.cssText += `border-radius:50%;border:4px solid ${BLUE};`;

      // floating category bubbles around the phone
      const BUB = [
        { ic: "refrigerator", x: 330, y: -300, t0: 3.38 },
        { ic: "washing-machine", x: 360, y: 20, t0: 3.46 },
        { ic: "tv", x: 320, y: 330, t0: 3.54 },
        { ic: "air-vent", x: -300, y: -390, t0: 3.62 },
        { ic: "flame", x: -330, y: 360, t0: 3.7 },
      ].map((b, i) => {
        const d = el(cam, "abs");
        d.style.cssText += `left:${PX + b.x - 56}px;top:${540 + b.y - 56}px;width:112px;height:112px;border-radius:32px;background:#fff;color:${BLUE};display:grid;place-items:center;
          box-shadow:0 24px 40px -22px rgb(11 57 140 / .55), inset 0 0 0 2px #e3ecfa;`;
        d.innerHTML = icon(b.ic, 54, 1.6);
        return { d, ...b, ph: i * 1.3 };
      });

      /* ---------- sound ---------- */
      cue(2.95, "fall", { dur: 0.3, gain: 0.8 });
      cue(TL, "impact", { gain: 0.95 });
      cue(TL, "glass", { gain: 0.6 });
      cue(3.38, "pop", { pitch: 1.1, gain: 0.5 });
      cue(3.5, "pop", { pitch: 1.25, gain: 0.45 });
      cue(3.62, "pop", { pitch: 1.4, gain: 0.45 });
      cue(3.36, "swish", { gain: 0.45 });
      words.forEach((w, i) => cue(w.t0 + 0.17, "thud", { pitch: 0.8 + i * 0.05, gain: 0.9 }));
      cue(4.33, "swish", { gain: 0.8 });
      chips.forEach((c, i) => cue(c.t0, "pop", { pitch: 1.2 + i * 0.2, gain: 0.7 }));
      NOTIFS.forEach((n, i) => {
        cue(n.t0, "ding", { pitch: [1, 1.1892, 1.4983][i], gain: 0.75 }); // D6, F6, A6: in key with the music
        cue(n.t0, "buzz", { gain: 0.6 });
      });
      cue(5.85, "scroll", { dur: 0.5, gain: 0.6 });
      cue(5.95, "swish", { gain: 0.5 });
      cue(6.38, "whoosh", { dur: 0.6, gain: 1.0, rise: 1 });
      FX.flash(6.9, 0.3, "#ffffff", 1);

      return (t) => {
        // reveal through the washer door
        const door = SHARED.door;
        if (t < 3.05) {
          const R = door.r * door.zoomAt(t);
          root.style.clipPath = `circle(${R.toFixed(1)}px at ${door.x}px ${door.y}px)`;
        } else root.style.clipPath = "none";

        // background parallax
        tf(grid, { x: -t * 30, y: -t * 12 });
        blobs.forEach((b, i) => tf(b, { x: Math.sin(t * 0.7 + i) * 40, y: Math.cos(t * 0.6 + i * 2) * 30 }));
        tf(ghost, { x: 200 - t * 110 });

        // camera: impact shake, then the dive into the phone
        const sh = M.addShake(shake(t, TL, 0.45, 16, 20, 4), shake(t, 4.17, 0.2, 5, 26, 1));
        const zp = E.inCubic(prog(t, 6.45, 7.0));
        const zoom = Math.exp(Math.log(9) * zp);
        cam.style.transformOrigin = `${lerp(PX, PX, zp)}px ${lerp(540, 470, zp)}px`;
        tf(cam, { x: sh.x + (960 - PX) * E.inOutCubic(prog(t, 6.4, 6.9)), y: sh.y, r: sh.r, s: zoom });

        // phone fall + land
        const h = gravityDrop(t - (TL - T_FALL), 1250, T_FALL, 0.07, 2);
        const q = squash(t, TL, 0.07, 5.5, 9);
        const falling = t < TL;
        const v = falling ? (2 * 1250 * clamp((t - (TL - T_FALL)) / T_FALL)) / T_FALL : 0;
        const buzz = NOTIFS.reduce((a, n) => a + wobble(t, n.t0, 5, 24, 12), 0);
        const ry = -9 + 4 * Math.sin(t * 1.1) * prog(t, TL, TL + 0.6);
        const rot = -11 * (1 - prog(t, TL - T_FALL, TL)) + wobble(t, TL, 3.2, 2.6, 6);
        tf(phone, {
          x: buzz,
          y: -h,
          r: rot,
          ry: ry * (1 - prog(t, 6.4, 6.9)),
          rx: 3 * (1 - prog(t, 6.4, 6.9)),
          sx: 1 + q * 0.5,
          sy: 1 - q,
          f: v > 600 ? `blur(${Math.min(18, v / 420).toFixed(1)}px)` : "none",
        });
        const sp = clamp(1 - h / 900);
        tf(shadow, { sx: 0.4 + 0.6 * sp, sy: 0.4 + 0.6 * sp, o: 0.2 + 0.8 * sp });
        dust.forEach((u) => u(t));
        const rp = prog(t, TL, TL + 0.55);
        const rr = 60 + 560 * E.outCubic(rp);
        ring.style.left = PX - rr + "px";
        ring.style.top = GROUND - rr * 0.18 + "px";
        ring.style.width = 2 * rr + "px";
        ring.style.height = 0.36 * rr + "px";
        ring.style.opacity = rp > 0 && rp < 1 ? (1 - rp).toFixed(3) : "0";

        // screen scroll
        const sc = 560 * E.inOutCubic(prog(t, 5.85, 6.35));
        tf(scroll, { y: -sc });

        // notifications drop from the top of the screen and stack
        NOTIFS.forEach((n, i) => {
          if (t < n.t0) {
            n.d.style.display = "none";
            return;
          }
          n.d.style.display = "";
          let y = lerp(-140, 62, spring(t - n.t0, 2.6, 0.55));
          NOTIFS.forEach((m, j) => {
            if (j > i) y += (NH[j] + 10) * spring(t - m.t0, 2.6, 0.6);
          });
          const out = E.inBack(prog(t, 5.95 + (2 - i) * 0.05, 6.3 + (2 - i) * 0.05));
          y -= 700 * out;
          const s = lerp(0.86, 1, spring(t - n.t0, 3, 0.5));
          tf(n.d, { y, s, o: prog(t, n.t0, n.t0 + 0.08) });
        });

        // headline words drop with bounce
        tf(kicker, { x: -60 * (1 - E.outCubic(prog(t, 3.36, 3.7))), o: prog(t, 3.36, 3.6) });
        words.forEach((w) => {
          const hh = gravityDrop(t - w.t0, fs * 1.45, 0.17, 0.12, 2);
          const qq = squash(t, w.t0 + 0.17, 0.16, 5, 10);
          const r = w.rot * (1 - prog(t, w.t0, w.t0 + 0.17));
          w.s.style.transform = `translate3d(0,${(-hh).toFixed(1)}px,0) rotate(${r.toFixed(2)}deg) scale(${(1 + qq * 0.5).toFixed(3)},${(1 - qq).toFixed(3)})`;
          w.s.style.opacity = t < w.t0 ? "0" : "1";
        });
        // underline under "Casablanca"
        const cl = casa.offsetLeft;
        const ct = casa.offsetTop + casa.offsetHeight;
        swoosh.style.left = cl + "px";
        swoosh.style.top = ct - 8 + "px";
        swoosh.style.width = casa.offsetWidth + "px";
        swoosh.style.height = "34px";
        M.drawTo(swooshPath, E.outCubic(prog(t, 4.33, 4.6)));
        chips.forEach((c, i) => {
          const s = spring(t - c.t0, 3.2, 0.45);
          c.d.style.top = ct + 60 + "px";
          tf(c.d, { s: Math.max(0, s), o: prog(t, c.t0, c.t0 + 0.05) });
        });
        // words leave to the left before the dive
        const outp = E.inExpo(prog(t, 6.38, 6.68));
        tf(head, { x: -1500 * outp, f: outp > 0.02 ? `blur(${(outp * 16).toFixed(1)}px)` : "none" });

        // bubbles
        BUB.forEach((b) => {
          const s = spring(t - b.t0, 3, 0.42);
          const bob = Math.sin(t * 2.2 + b.ph) * 10;
          const away = E.inExpo(prog(t, 6.38, 6.7));
          tf(b.d, { x: b.x * 1.6 * away, y: bob + b.y * 1.6 * away, s: Math.max(0, s), r: Math.sin(t * 1.5 + b.ph) * 6, o: 1 - away });
        });
      };
    },
    2,
  ),
);
