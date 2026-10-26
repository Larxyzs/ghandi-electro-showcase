/* 40 s — final card (35.5 – 40 s): a blue iris opens over the floating city, the 3D logo lands on the
   downbeat with the slogan, one big WhatsApp button (with the number) is tapped, the address and hours stay
   readable, then the card switches off like a TV into the dark stage the video opens on, so it loops. */
const T_OFF = 39.35; // power-off of the final card

SCENE_BUILDERS.push(() =>
  M.scene(
    "final",
    35.5,
    40.5,
    (root) => {
      const { el, E, prog, lerp, cue, tf, shake, spring, icon } = M;
      const BLUE = ART.BLUE;
      const WA_GREEN = "#03a14a"; // the site's --whatsapp colour
      const T_HIT = 36.0;
      const T_TAP = 37.55;

      const bg = el(root, "fill");
      bg.style.background = "radial-gradient(circle at 50% 34%, #3a8dff 0%, #1266e8 45%, #0a48a8 100%)";
      const rays = el(root, "fill");
      rays.style.cssText += `inset:-700px;background:repeating-conic-gradient(from 0deg at 50% 50%, rgb(255 255 255 / .08) 0deg 5deg, transparent 5deg 15deg);
        -webkit-mask-image:radial-gradient(circle at 50% 50%, #000 0%, transparent 52%);`;
      const amb = FXL.ambient(root, { n: 18, colors: ["rgb(255 255 255 / .16)", "rgb(190 220 255 / .24)"], seed: 81 });
      const cam = el(root, "fill");
      cam.style.transformOrigin = "960px 420px";
      const Lk = V40.lockup(cam, { HS: 1.3, top: 62, wmTop: 380, wmSize: 100, tagTop: 566, tag: "L'électroménager qui fait vivre votre maison" });
      Lk.tag.style.font = "800 40px Unbounded";
      Lk.tag.style.letterSpacing = "-0.005em";
      Lk.tag.style.color = "#ffffff";
      const orbit = V40.orbits(cam, Lk.wrap, { x: 960, y: Lk.center.y, rx: 330, k: 0.25, speed: 3.4 });
      const fx = [
        FXL.lineBurst(cam, { x: 960, y: Lk.center.y, t0: T_HIT, n: 20, r0: 240, r1: 760, width: 8, dur: 0.55, seed: 85 }),
        FXL.shapeBurst(cam, { x: 960, y: Lk.center.y, t0: T_HIT, n: 30, speed: [700, 1600], colors: ["#ffffff", "#cfe3ff", "#9cc6ff"], seed: 86, gravity: 500 }),
        FXL.ringPulse(cam, { x: 960, y: Lk.center.y, t0: T_HIT + 0.08, r0: 120, r1: 820, width: 3, color: "rgb(255 255 255 / .6)", dur: 0.8 }),
      ];

      // one call to action: the WhatsApp button carries the number
      const BW = 900;
      const BH = 156;
      const BY = 662;
      const cta = el(cam, "abs");
      cta.style.cssText += `left:${960 - BW / 2}px;top:${BY}px;width:${BW}px;height:${BH}px;border-radius:999px;background:${WA_GREEN};overflow:hidden;
        display:flex;align-items:center;gap:30px;padding:0 56px;box-sizing:border-box;color:#fff;
        box-shadow:0 0 0 6px rgb(255 255 255 / .95), 0 34px 60px -24px rgb(2 20 60 / .7);`;
      cta.innerHTML = `<span style="flex:none;width:96px;height:96px;border-radius:50%;background:#fff;color:${WA_GREEN};display:grid;place-items:center">${ART.waIcon(62)}</span>
        <span style="line-height:1.05"><span style="display:block;font:700 33px Roboto;opacity:.95">Écrivez-nous sur WhatsApp</span>
        <span style="display:block;font:800 56px Unbounded;letter-spacing:-.01em;margin-top:8px;white-space:nowrap">${SITE.PHONE}</span></span>`;
      const sheen = el(cta, "abs");
      sheen.style.cssText += "left:0;top:-20px;width:180px;height:200px;background:linear-gradient(90deg, transparent, rgb(255 255 255 / .45), transparent);";
      const ripple = el(cam, "abs");
      ripple.style.cssText += "left:0;top:0;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:6px solid #fff;opacity:0;";
      const finger = el(cam, "abs");
      finger.style.cssText += "left:0;top:0;width:96px;height:120px;transform-origin:40px 6px;filter:drop-shadow(0 16px 18px rgb(2 20 60 / .45));opacity:0;";
      finger.innerHTML = ART.handTap;
      const TAP = { x: 1240, y: BY + 104 };
      const whiteout = el(root, "fill");
      whiteout.style.cssText += "background:#ffffff;opacity:0;";

      const info = el(cam, "abs");
      info.style.cssText += "left:0;top:862px;width:1920px;display:flex;justify-content:center;gap:44px;font:500 29px Roboto;color:#fff;";
      info.innerHTML = [
        ["globe", "ghandihomeelectro.com"],
        ["map-pin", "41 Boulevard Ghandi, Casablanca"],
      ]
        .map(([ic, txt]) => `<span style="display:flex;align-items:center;gap:12px"><span style="display:flex;color:#cfe3ff">${icon(ic, 30, 2.2)}</span>${txt}</span>`)
        .join("");
      const hours = el(cam, "abs");
      hours.style.cssText += "left:0;top:918px;width:1920px;text-align:center;font:500 26px Roboto;color:rgb(235 243 255 / .88);";
      hours.innerHTML = `${icon("clock", 26, 2).replace("<svg", '<svg style="vertical-align:-5px;margin-right:10px"')}Lundi – Samedi · 9h00 – 13h00 · 15h00 – 20h00`;
      const LT = [36.15, 36.21, 36.27, 36.33, 36.39, 36.45];

      cue(35.5, "whoosh", { dur: 0.5, gain: 0.9, rise: 1 });
      cue(T_HIT, "impact", { gain: 1.15 });
      cue(T_HIT, "subdrop", { gain: 1.0 });
      cue(T_HIT + 0.02, "shimmer", { dur: 1.2, gain: 0.5 });
      LT.forEach((t0, i) => cue(t0 + 0.12, "tick", { pitch: 1.1 + i * 0.08, gain: 0.35 }));
      cue(36.55, "swish", { gain: 0.45 });
      cue(36.85, "thud", { pitch: 0.9, gain: 0.7 });
      cue(36.87, "pop", { pitch: 1.1, gain: 0.6 });
      cue(T_TAP, "click", { gain: 0.9 });
      cue(T_TAP + 0.04, "pop", { pitch: 1.5, gain: 0.55 });
      cue(37.75, "tick", { pitch: 1.3, gain: 0.4 });
      cue(37.9, "tick", { pitch: 1.5, gain: 0.35 });
      cue(38.25, "shimmer", { dur: 0.7, gain: 0.45 });
      cue(T_OFF, "powerdown", { gain: 0.9 });
      FX.flash(T_HIT, 0.25, "#ffffff", 0.7);

      return (t) => {
        // iris opening from the centre over the floating city
        const ir = 1250 * E.inCubic(prog(t, 35.5, T_HIT));
        root.style.clipPath = t < T_HIT ? `circle(${ir.toFixed(1)}px at 960px 540px)` : "none";
        tf(rays, { r: t * 10, o: prog(t, T_HIT, T_HIT + 0.4) });
        amb(t, 1);
        const sh = shake(t, T_HIT, 0.5, 16, 22, 9);
        tf(cam, { x: sh.x, y: sh.y, r: sh.r, s: 1 + 0.03 * E.inOutSine(prog(t, 36.5, T_OFF)) });
        const slam = E.outExpo(prog(t, T_HIT, T_HIT + 0.35));
        const turn = -42 * (1 - E.outCubic(prog(t, T_HIT, T_HIT + 0.8))) + 18 * Math.sin((t - T_HIT - 0.4) * 1.7) * prog(t, T_HIT + 0.3, T_HIT + 1.0);
        tf(Lk.house, { s: lerp(2.2, 1, slam), ry: turn, rx: 9 * Math.sin((t - T_HIT) * 1.4) * prog(t, T_HIT + 0.3, T_HIT + 1.0), o: prog(t, T_HIT - 0.02, T_HIT + 0.04) });
        Lk.wrap.style.filter = slam < 0.97 ? `blur(${((1 - slam) * 18).toFixed(1)}px)` : "none";
        Lk.drum.style.transform = `rotate(${(Math.max(0, t - T_HIT) * 720).toFixed(1)}deg)`;
        fx.forEach((u) => u(t));
        orbit(t, T_HIT + 0.15);
        Lk.letters.forEach((s, i) => {
          const e = spring(t - LT[i], 3.2, 0.45);
          s.style.transform = `translate3d(0,${(90 * (1 - e)).toFixed(1)}px,0)`;
          s.style.opacity = prog(t, LT[i], LT[i] + 0.06).toFixed(3);
        });
        const sk = E.outCubic(prog(t, 36.45, 36.8));
        Lk.sub.style.opacity = sk.toFixed(3);
        Lk.subTxt.style.letterSpacing = lerp(0.9, 0.32, sk).toFixed(3) + "em";
        Lk.lines.forEach((l) => (l.style.transform = `scaleX(${E.outExpo(prog(t, 36.5, 36.9)).toFixed(3)})`));
        // slogan
        tf(Lk.tag, { y: 26 * (1 - E.outCubic(prog(t, 36.55, 36.9))), o: prog(t, 36.55, 36.75) });

        // WhatsApp button: pops, is tapped, then a sheen runs across it
        const ck = Math.max(0, spring(t - 36.85, 3, 0.5));
        const press = Math.sin(Math.PI * prog(t, T_TAP - 0.06, T_TAP + 0.1));
        tf(cta, { s: ck * (1 - 0.05 * press), o: prog(t, 36.85, 36.92) });
        tf(sheen, { x: lerp(-220, BW + 40, E.inOutCubic(prog(t, 38.25, 38.85))), skx: -20 });
        const fOn = t > T_TAP - 0.5 && t < T_TAP + 0.55;
        finger.style.opacity = fOn ? "1" : "0";
        if (fOn) {
          const away = 1 - E.outCubic(prog(t, T_TAP - 0.5, T_TAP - 0.08)) + E.inCubic(prog(t, T_TAP + 0.18, T_TAP + 0.55));
          finger.style.transform = `translate3d(${(TAP.x - 40 + 160 * away).toFixed(1)}px,${(TAP.y - 6 + 260 * away).toFixed(1)}px,0) scale(${(1.45 * (1 - 0.08 * press)).toFixed(3)})`;
        }
        const rp = prog(t, T_TAP, T_TAP + 0.5);
        ripple.style.opacity = rp > 0 && rp < 1 ? (1 - rp).toFixed(3) : "0";
        ripple.style.transform = `translate3d(${TAP.x}px,${TAP.y}px,0) scale(${(0.3 + 1.6 * E.outCubic(rp)).toFixed(3)})`;
        tf(info, { y: 20 * (1 - E.outCubic(prog(t, 37.75, 38.05))), o: prog(t, 37.75, 37.95) });
        tf(hours, { y: 20 * (1 - E.outCubic(prog(t, 37.9, 38.2))), o: prog(t, 37.9, 38.1) });

        // power-off: the card folds into a bright line, the line into a dot, the dot fades (loops into frame 0)
        if (t >= T_OFF) {
          const syk = 1 - 0.994 * E.inExpo(prog(t, T_OFF, T_OFF + 0.16));
          const sxk = 1 - 0.998 * E.inCubic(prog(t, T_OFF + 0.16, T_OFF + 0.3));
          root.style.transformOrigin = "960px 540px";
          root.style.transform = `scale(${sxk.toFixed(4)},${syk.toFixed(4)})`;
          whiteout.style.opacity = (0.9 * E.inCubic(prog(t, T_OFF, T_OFF + 0.14))).toFixed(3);
          root.style.opacity = (1 - prog(t, T_OFF + 0.3, T_OFF + 0.42)).toFixed(3);
        } else {
          root.style.transform = "";
          whiteout.style.opacity = "0";
          root.style.opacity = "1";
        }
      };
    },
    15,
  ),
);

/* Dark stage behind the power-off: the same background as frame 0, plus the glowing line and dot. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "loop-end",
    T_OFF - 0.05,
    40.5,
    (root) => {
      const { el, E, prog } = M;
      const navy = el(root, "fill");
      navy.style.background = "radial-gradient(circle at 50% 40%, #0e3277 0%, #061a45 50%, #020a1e 100%)";
      const line = el(root, "abs");
      line.style.cssText += "left:0;top:537px;width:1920px;height:6px;border-radius:6px;background:#fff;box-shadow:0 0 24px 8px rgb(150 200 255 / .9), 0 0 80px 24px rgb(47 125 255 / .6);transform-origin:960px 3px;opacity:0;";
      return (t) => {
        const sxk = 1 - 0.998 * E.inCubic(prog(t, T_OFF + 0.16, T_OFF + 0.3));
        const on = prog(t, T_OFF + 0.1, T_OFF + 0.16) * (1 - prog(t, T_OFF + 0.32, T_OFF + 0.46));
        line.style.opacity = on.toFixed(3);
        line.style.transform = `scale(${Math.max(sxk, 0.004).toFixed(4)},${(1 + 1.5 * prog(t, T_OFF + 0.26, T_OFF + 0.34)).toFixed(3)})`;
      };
    },
    14,
  ),
);
