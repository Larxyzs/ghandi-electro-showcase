/* 40 s — final card (35.5 – 40 s): a blue iris opens over the floating city, the 3D logo lands on the
   downbeat, then the tagline, the call to action and the contact pills stay on screen to be read. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "final",
    35.5,
    40.5,
    (root) => {
      const { el, E, prog, lerp, cue, tf, shake, spring, squash, gravityDrop, sp, icon } = M;
      const BLUE = ART.BLUE;
      const T_HIT = 36.0;

      const bg = el(root, "fill");
      bg.style.background = "radial-gradient(circle at 50% 34%, #3a8dff 0%, #1266e8 45%, #0a48a8 100%)";
      const rays = el(root, "fill");
      rays.style.cssText += `inset:-700px;background:repeating-conic-gradient(from 0deg at 50% 50%, rgb(255 255 255 / .08) 0deg 5deg, transparent 5deg 15deg);
        -webkit-mask-image:radial-gradient(circle at 50% 50%, #000 0%, transparent 52%);`;
      const amb = FXL.ambient(root, { n: 18, colors: ["rgb(255 255 255 / .16)", "rgb(190 220 255 / .24)"], seed: 81 });
      const cam = el(root, "fill");
      cam.style.transformOrigin = "960px 420px";
      const Lk = V40.lockup(cam, { HS: 1.3, top: 62, wmTop: 380, wmSize: 100, tagTop: 576 });
      const orbit = V40.orbits(cam, Lk.wrap, { x: 960, y: Lk.center.y, rx: 330, k: 0.25, speed: 3.4 });
      const fx = [
        FXL.lineBurst(cam, { x: 960, y: Lk.center.y, t0: T_HIT, n: 20, r0: 240, r1: 760, width: 8, dur: 0.55, seed: 85 }),
        FXL.shapeBurst(cam, { x: 960, y: Lk.center.y, t0: T_HIT, n: 30, speed: [700, 1600], colors: ["#ffffff", "#cfe3ff", "#9cc6ff"], seed: 86, gravity: 500 }),
        FXL.ringPulse(cam, { x: 960, y: Lk.center.y, t0: T_HIT + 0.08, r0: 120, r1: 820, width: 3, color: "rgb(255 255 255 / .6)", dur: 0.8 }),
      ];
      const cta = el(cam, "abs hd");
      cta.style.cssText += "left:0;top:650px;width:1920px;text-align:center;font-size:46px;color:#fff;white-space:nowrap;";
      cta.innerHTML = `Commandez en ligne <span style="opacity:.75">ou sur</span> WhatsApp`;
      const pills = el(cam, "abs");
      pills.style.cssText += "left:0;top:760px;width:1920px;display:flex;justify-content:center;gap:24px;";
      const PILLS = [
        ["phone", SITE.PHONE, 37.3],
        ["globe", "ghandihomeelectro.com", 37.42],
        ["map-pin", "41 Boulevard Ghandi, Casablanca", 37.54],
      ].map(([ic, txt, t0]) => {
        const d = el(pills, "pill");
        d.style.cssText += "background:#fff;color:#0f172a;font-size:30px;padding:18px 30px;box-shadow:0 20px 40px -20px rgb(2 20 60 / .6);";
        d.innerHTML = `<span style="color:${BLUE}">${icon(ic, 32, 2.2)}</span>${txt}`;
        return { d, t0 };
      });
      const hours = el(cam, "abs");
      hours.style.cssText += "left:0;top:870px;width:1920px;text-align:center;font:500 28px Roboto;color:rgb(235 243 255 / .9);";
      hours.innerHTML = `${icon("clock", 26, 2).replace("<svg", '<svg style="vertical-align:-5px;margin-right:10px"')}Lundi – Samedi · 9h00 – 13h00 · 15h00 – 20h00`;
      const shine = el(cam, "abs");
      shine.style.cssText += `left:0;top:40px;width:300px;height:620px;background:linear-gradient(90deg, transparent, rgb(255 255 255 / .5), transparent);
        mix-blend-mode:overlay;-webkit-mask-image:linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent);`;
      const LT = [36.15, 36.21, 36.27, 36.33, 36.39, 36.45];

      cue(35.5, "whoosh", { dur: 0.5, gain: 0.9, rise: 1 });
      cue(T_HIT, "impact", { gain: 1.15 });
      cue(T_HIT, "subdrop", { gain: 1.0 });
      cue(T_HIT + 0.02, "shimmer", { dur: 1.2, gain: 0.5 });
      LT.forEach((t0, i) => cue(t0 + 0.12, "tick", { pitch: 1.1 + i * 0.08, gain: 0.35 }));
      cue(36.6, "swish", { gain: 0.4 });
      cue(36.95, "thud", { pitch: 1.0, gain: 0.6 });
      PILLS.forEach((p, i) => cue(p.t0, "pop", { pitch: 1.1 + i * 0.15, gain: 0.7 }));
      cue(37.8, "tick", { pitch: 1.4, gain: 0.4 });
      cue(38.4, "shimmer", { dur: 0.7, gain: 0.45 });
      FX.flash(T_HIT, 0.25, "#ffffff", 0.7);

      return (t) => {
        // iris opening from the centre over the floating city
        const ir = 1250 * E.inCubic(prog(t, 35.5, T_HIT));
        root.style.clipPath = t < T_HIT ? `circle(${ir.toFixed(1)}px at 960px 540px)` : "none";
        tf(rays, { r: t * 10, o: prog(t, T_HIT, T_HIT + 0.4) });
        amb(t, 1);
        const sh = shake(t, T_HIT, 0.5, 16, 22, 9);
        tf(cam, { x: sh.x, y: sh.y, r: sh.r, s: 1 + 0.035 * E.inOutSine(prog(t, 36.5, 40)) });
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
        tf(Lk.tag, { y: 24 * (1 - E.outCubic(prog(t, 36.6, 36.9))), o: prog(t, 36.6, 36.8) });
        const ck = Math.max(0, spring(t - 36.9, 3, 0.5));
        tf(cta, { s: ck, o: prog(t, 36.9, 36.96) });
        PILLS.forEach((p) => tf(p.d, { s: Math.max(0, spring(t - p.t0, 3, 0.5)), o: prog(t, p.t0, p.t0 + 0.05) }));
        tf(hours, { y: 20 * (1 - E.outCubic(prog(t, 37.8, 38.1))), o: prog(t, 37.8, 38.0) });
        const shp = prog(t, 38.35, 38.9);
        tf(shine, { x: lerp(300, 1500, E.inOutCubic(shp)), skx: -20, o: shp > 0 && shp < 1 ? 1 : 0 });
      };
    },
    15,
  ),
);
