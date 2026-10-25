/* Scene 3 (6.88 – 11.0 s): desktop browser slams in, the address is typed, the home page loads,
   the camera pushes in while the cursor opens "Tous nos rayons", then a 3D carousel presents
   the catalogue page and the store page. Ends with a blue bar wipe. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "desktop",
    6.88,
    11.0,
    (root) => {
      const { el, E, prog, clamp, lerp, cue, tf, shake, spring, icon } = M;
      const BLUE = ART.BLUE;
      const BW = 1500;
      const BH = 874;
      const BX = (1920 - BW) / 2;
      const BY = (1080 - BH) / 2;
      const PS = BW / 1440; // page scale inside the browser
      const URL = "ghandihomeelectro.com";

      /* ---------- background ---------- */
      const bg = el(root, "fill");
      bg.style.background = "radial-gradient(circle at 30% 20%, #ffffff 0%, #eef4ff 55%, #dfeafc 100%)";
      const dots = el(root, "fill");
      dots.style.cssText += "inset:-100px;background-image:radial-gradient(rgb(18 102 232 / .18) 1.6px, transparent 1.8px);background-size:46px 46px;";
      const rings = [0, 1, 2].map((i) => {
        const r = el(root, "abs");
        const s = 700 + i * 420;
        r.style.cssText += `left:${1500 - s / 2}px;top:${180 - s / 2}px;width:${s}px;height:${s}px;border-radius:50%;border:${3 - i * 0.6}px solid rgb(18 102 232 / ${0.16 - i * 0.04});`;
        return r;
      });

      /* ---------- camera + browsers ---------- */
      const cam = el(root, "fill");
      const world = el(cam, "fill");
      world.style.perspective = "2600px";
      world.style.perspectiveOrigin = "50% 42%";

      function browser(html, url, typed) {
        const b = el(world, "browser");
        b.style.left = BX + "px";
        b.style.top = BY + "px";
        const bar = el(b, "bar");
        const back = icon("chevron-right", 20, 2).replace('d="m9 18 6-6-6-6"', 'd="m15 18-6-6 6-6"');
        bar.innerHTML = `<div class="dots"><i></i><i></i><i></i></div>
          <span style="color:#9aa3ad;display:flex;gap:10px">${back}${icon("chevron-right", 20, 2)}${icon("rotate-cw", 18, 2)}</span>`;
        const u = el(bar, "url");
        u.innerHTML = `<span class="lock">${icon("lock", 15, 2.2)}</span>`;
        const txt = el(u, "", typed ? "" : url, "span");
        const caret = el(u, "caret", null, "span");
        if (!typed) caret.style.display = "none";
        const view = el(b, "view");
        const page = el(view, "page");
        page.innerHTML = html;
        page.style.transform = `scale(${PS})`;
        const load = el(b, "load");
        load.style.width = "0";
        b.style.transformOrigin = "50% 50%";
        return { b, txt, caret, page, load, view };
      }
      const W1 = browser(SITE.desktopHome(), URL, true);
      const W2 = browser(SITE.catalogPage(), URL + "/produits/froid", false);
      const W3 = browser(SITE.storePage(), URL + "/magasin", false);

      // home page parts that load in sequence
      const P = W1.page.querySelector(".site");
      const parts = [...P.children].filter((c) => !c.classList.contains("s-mega"));
      const mega = P.querySelector(".s-mega");
      const megaItems = [...mega.querySelectorAll(".s-mega-list li, .s-mega-cols > div")];
      const hl = mega.querySelector(".s-mega-hl");
      const heroTitle = P.querySelector(".s-hero-txt h2");
      const heroBtn = P.querySelector(".s-hero-txt .s-btn");
      const allBtn = P.querySelector(".s-allbtn");
      // catalogue cards pop in when that page comes to the front
      const cards = [...W2.page.querySelectorAll(".s-card")];
      const storeRows = [...W3.page.querySelectorAll(".s-hours tr, .s-line, .s-store .s-btn")];

      // screen positions measured on the flat layout (before any transform)
      const centerOf = (node) => {
        const r = node.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      const btnPos = centerOf(allBtn);
      const listLis = [...mega.querySelectorAll(".s-mega-list li")];
      const liPos = listLis.map(centerOf);
      const liTop = listLis.map((li) => li.offsetTop);
      const FOCUS = { x: btnPos.x + 330, y: btnPos.y + 150 };

      /* ---------- cursor ---------- */
      // impact accents: rays around the browser when it slams, a burst on the click, rays behind the carousel
      const back = el(root, "fill");
      root.insertBefore(back, cam);
      const deskFx = [
        FXL.lineBurst(back, { x: 960, y: 540, t0: 6.97, n: 22, r0: 760, r1: 1200, width: 7, color: BLUE, dur: 0.5, seed: 41 }),
        FXL.lineBurst(cam, { x: btnPos.x, y: btnPos.y, t0: 8.56, n: 9, r0: 34, r1: 110, width: 5, color: BLUE, dur: 0.35, seed: 42 }),
        FXL.lineBurst(back, { x: 960, y: 420, t0: 9.5, n: 18, r0: 600, r1: 980, width: 6, color: "#7fb2ff", dur: 0.45, seed: 43 }),
        FXL.lineBurst(back, { x: 960, y: 420, t0: 10.15, n: 18, r0: 600, r1: 980, width: 6, color: "#7fb2ff", dur: 0.45, seed: 44, rot: 10 }),
        FXL.ringPulse(back, { x: 960, y: 420, t0: 10.15, r0: 300, r1: 900, width: 3, color: "rgb(18 102 232 / .45)", dur: 0.6 }),
      ];
      // the address types in big letters in the empty page, then flies up into the address bar
      const bigUrl = el(root, "abs hd");
      bigUrl.style.cssText += `left:0;top:0;font-size:86px;color:${BLUE};white-space:nowrap;transform-origin:0 50%;`;
      const bigTxt = el(bigUrl, "", "", "span");
      const bigCaret = el(bigUrl, "", null, "span");
      bigCaret.style.cssText += `display:inline-block;width:8px;height:0.9em;margin-left:6px;background:${BLUE};vertical-align:-0.08em;border-radius:4px;`;
      bigTxt.textContent = URL;
      const bigW = bigUrl.offsetWidth;
      const bigH = bigUrl.offsetHeight;
      const urlBox = W1.txt.getBoundingClientRect();
      const cursor = el(cam, "cursor", ART.cursorArrow);
      const ripple = el(cam, "ripple");

      /* ---------- captions ---------- */
      const cap = el(root, "abs");
      cap.style.cssText += "left:120px;top:812px;z-index:5;";
      const capLines = [
        [["Tout", 10.0], ["l'électroménager", 10.1]],
        [["en", 10.24], ["quelques", 10.32, true], ["clics.", 10.4, true]],
      ];
      const capWords = [];
      capLines.forEach((ln) => {
        const row = el(cap, "hd");
        row.style.cssText += "font-size:76px;line-height:1.14;color:#0f172a;overflow:hidden;padding:0.05em 0.2em 0.14em 0;margin:-0.05em 0 -0.14em;position:relative;";
        ln.forEach(([w, t0, hlt], i) => {
          const s = el(row, "wd", null, "span");
          s.textContent = w;
          if (hlt) s.style.color = "#fff";
          capWords.push({ s, t0, hl: hlt });
          if (i < ln.length - 1) el(row, "", " ", "span");
        });
      });
      const marker = el(cap, "abs");
      marker.style.cssText += `background:${BLUE};border-radius:14px;transform-origin:0 50%;z-index:-1;`;

      /* ---------- wipe to the next scene (blue bars) ---------- */
      const bars = [
        { c: "#9cc6ff", delay: 0 },
        { c: "#2f86ff", delay: 0.05 },
        { c: BLUE, delay: 0.1 },
      ].map((b) => {
        const d = el(root, "abs");
        d.style.cssText += `top:-100px;height:1280px;width:3400px;background:${b.c};transform-origin:0 0;z-index:10;`;
        return { d, ...b };
      });

      /* ---------- sound ---------- */
      cue(6.95, "slam", { gain: 0.9 });
      for (let i = 0; i < URL.length; i++) cue(7.06 + i * 0.022, "type", { seed: i, gain: 0.55 });
      cue(7.56, "click", { gain: 0.8 });
      cue(7.6, "swoosh", { dur: 0.4, gain: 0.5 });
      cue(8.02, "pop", { pitch: 1.3, gain: 0.5 });
      cue(8.15, "whoosh", { dur: 0.35, gain: 0.45 });
      cue(8.55, "click", { gain: 1.0 });
      cue(8.58, "swoosh", { dur: 0.3, gain: 0.55 });
      cue(8.92, "tick", { pitch: 1.2, gain: 0.6 });
      cue(9.07, "tick", { pitch: 1.35, gain: 0.6 });
      cue(9.15, "whoosh", { dur: 0.4, gain: 0.85 });
      cue(9.2, "whoosh", { dur: 0.35, gain: 0.6, pan: 0.6 });
      cue(9.5, "slam", { gain: 0.5 });
      for (let i = 0; i < 8; i++) cue(9.52 + i * 0.03, "tick", { pitch: 1.5 + i * 0.05, gain: 0.25 });
      cue(9.85, "whoosh", { dur: 0.35, gain: 0.8, pan: -0.4 });
      cue(10.15, "slam", { gain: 0.5 });
      capWords.forEach((w, i) => cue(w.t0 + 0.14, "thud", { pitch: 1 + i * 0.06, gain: 0.55 }));
      cue(10.36, "swish", { gain: 0.7 });
      cue(10.55, "whoosh", { dur: 0.5, gain: 1.0, rise: 1 });

      // carousel slots: [x, y, z, rotateY, rotateX, scale]
      const FLAT = [0, 0, 0, 0, 0, 1];
      const C = [0, -120, 0, 0, 0, 0.72];
      const L = [-800, -120, -480, 38, 0, 0.72];
      const R = [800, -120, -480, -38, 0, 0.72];
      const OFFL = [-1900, -120, -1000, 55, 0, 0.72];
      const OFFR = [1900, -120, -1000, -55, 0, 0.72];
      const FAR_R = [2600, -120, -1300, -60, 0, 0.72];
      const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
      const place = (w, p, o = 1, blur = 0) =>
        tf(w.b, { x: p[0], y: p[1], z: p[2], ry: p[3], rx: p[4], s: p[5], o, f: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : "none" });

      return (t) => {
        tf(dots, { x: -t * 20, y: -t * 8 });
        rings.forEach((r, i) => tf(r, { s: 1 + 0.04 * Math.sin(t * 1.4 + i), r: t * (8 + i * 4) }));

        /* --- camera punch-in on the menu --- */
        const zin = E.inOutCubic(prog(t, 8.12, 8.48));
        const zout = E.inOutCubic(prog(t, 9.08, 9.32));
        const zk = zin * (1 - zout);
        const sh = M.addShake(shake(t, 7.0, 0.3, 10, 22, 7), shake(t, 8.55, 0.18, 4, 30, 3));
        cam.style.transformOrigin = `${FOCUS.x}px ${FOCUS.y}px`;
        tf(cam, { x: sh.x + (960 - FOCUS.x) * zk, y: sh.y + (520 - FOCUS.y) * zk, s: 1 + 0.62 * zk });

        /* --- browser 1: slam + typing + load --- */
        const sl = E.outExpo(prog(t, 6.95, 7.3));
        const a1 = E.inOutCubic(prog(t, 9.15, 9.5));
        const b1 = E.inOutCubic(prog(t, 9.85, 10.15));
        let p1 = mix(FLAT, L, a1);
        p1 = mix(p1, OFFL, b1);
        p1[5] *= lerp(1.22, 1, sl);
        place(W1, p1, prog(t, 6.95, 7.0) * (1 - prog(t, 10.05, 10.15)), (1 - sl) * 14 + b1 * (1 - b1) * 30);
        const n = clamp(Math.floor((t - 7.06) / 0.022) + 1, 0, URL.length);
        W1.txt.textContent = URL.slice(0, n);
        W1.caret.style.opacity = t < 7.56 ? "1" : "0";
        const lp = prog(t, 7.56, 7.9);
        W1.load.style.width = (100 * E.outCubic(lp)).toFixed(2) + "%";
        W1.load.style.opacity = t > 7.56 && t < 7.98 ? (1 - prog(t, 7.9, 7.98)).toFixed(3) : "0";
        parts.forEach((c, i) => {
          const a = 7.62 + i * 0.07;
          const k = E.outCubic(prog(t, a, a + 0.3));
          tf(c, { y: 40 * (1 - k), o: k });
        });
        const ht = E.outCubic(prog(t, 7.86, 8.12));
        tf(heroTitle, { y: 24 * (1 - ht), o: ht });
        tf(heroBtn, { s: Math.max(0, spring(t - 8.02, 3.2, 0.45)), o: prog(t, 8.02, 8.06) });

        /* --- cursor → "Tous nos rayons" → mega menu --- */
        const cm = E.inOutCubic(prog(t, 8.1, 8.5));
        let cx = lerp(1500, btnPos.x + 30, cm) - Math.sin(cm * Math.PI) * 60;
        let cy = lerp(900, btnPos.y + 8, cm) + Math.sin(cm * Math.PI) * 40;
        if (t > 8.75) {
          const k1 = E.inOutCubic(prog(t, 8.78, 8.92));
          const k2 = E.inOutCubic(prog(t, 8.94, 9.07));
          cx = lerp(lerp(btnPos.x + 30, liPos[1].x + 20, k1), liPos[2].x + 30, k2);
          cy = lerp(lerp(btnPos.y + 8, liPos[1].y + 4, k1), liPos[2].y + 4, k2);
        }
        const click = 1 - 0.18 * Math.sin(Math.PI * prog(t, 8.53, 8.63));
        const cOn = t > 8.1 && t < 9.2;
        tf(cursor, { x: cx - 6, y: cy - 4, s: click, o: cOn ? prog(t, 8.1, 8.16) * (1 - prog(t, 9.12, 9.2)) : 0 });
        const rp = prog(t, 8.55, 8.95);
        const rr = 10 + 70 * E.outCubic(rp);
        ripple.style.width = ripple.style.height = 2 * rr + "px";
        tf(ripple, { x: btnPos.x - rr, y: btnPos.y - rr, o: rp > 0 && rp < 1 ? 1 - rp : 0 });

        const mo = E.outCubic(prog(t, 8.58, 8.82));
        const mc = prog(t, 9.12, 9.24);
        mega.style.display = t > 8.58 && mc < 1 ? "" : "none";
        mega.style.clipPath = `inset(0 0 ${(100 * (1 - mo)).toFixed(2)}% 0)`;
        tf(mega, { y: -14 * (1 - mo), o: 1 - mc });
        megaItems.forEach((it, i) => {
          const a = 8.62 + i * 0.025;
          const k = E.outCubic(prog(t, a, a + 0.2));
          tf(it, { x: -18 * (1 - k), o: k });
        });
        hl.style.top = lerp(lerp(liTop[0], liTop[1], E.outCubic(prog(t, 8.86, 8.96))), liTop[2], E.outCubic(prog(t, 9.02, 9.12))) + "px";

        /* --- carousel: catalogue to the front, then the store page --- */
        const a2 = E.inOutCubic(prog(t, 9.18, 9.52));
        const a3 = E.inOutCubic(prog(t, 9.28, 9.62));
        const p2 = mix(mix(OFFR, C, a2), L, b1);
        const p3 = mix(mix(FAR_R, R, a3), C, b1);
        W2.b.style.display = t > 9.17 ? "" : "none";
        W3.b.style.display = t > 9.27 ? "" : "none";
        place(W2, p2, prog(t, 9.18, 9.24), a2 * (1 - a2) * 40 + b1 * (1 - b1) * 30);
        place(W3, p3, prog(t, 9.28, 9.34), a3 * (1 - a3) * 40 + b1 * (1 - b1) * 30);
        W1.b.style.zIndex = t < 9.3 ? "3" : "1";
        W2.b.style.zIndex = t < 10.0 ? "2" : "1";
        W3.b.style.zIndex = t < 10.0 ? "1" : "3";
        cards.forEach((c, i) => {
          const a = 9.45 + (i % 4) * 0.04 + Math.floor(i / 4) * 0.08;
          tf(c, { y: 30 * (1 - E.outBack(prog(t, a, a + 0.28))), o: prog(t, a, a + 0.12) });
        });
        storeRows.forEach((r, i) => {
          const a = 10.1 + i * 0.025;
          tf(r, { x: -20 * (1 - E.outCubic(prog(t, a, a + 0.25))), o: prog(t, a, a + 0.15) });
        });

        /* --- captions --- */
        capWords.forEach((w) => {
          const hh = M.gravityDrop(t - w.t0, 110, 0.14, 0.12, 2);
          const qq = M.squash(t, w.t0 + 0.14, 0.14, 5, 10);
          w.s.style.transform = `translate3d(0,${(-hh).toFixed(1)}px,0) scale(${(1 + qq * 0.5).toFixed(3)},${(1 - qq).toFixed(3)})`;
          w.s.style.opacity = t < w.t0 ? "0" : "1";
        });
        const hlWords = capWords.filter((w) => w.hl);
        const first = hlWords[0].s;
        const last = hlWords[hlWords.length - 1].s;
        marker.style.left = first.offsetLeft - 18 + "px";
        marker.style.top = first.parentElement.offsetTop + first.offsetTop - 2 + "px";
        marker.style.width = last.offsetLeft + last.offsetWidth - first.offsetLeft + 36 + "px";
        marker.style.height = first.offsetHeight + 8 + "px";
        marker.style.transform = `scaleX(${E.outExpo(prog(t, 10.3, 10.6)).toFixed(4)})`;

        deskFx.forEach((u) => u(t));
        // big typed address -> address bar
        const fly = E.inOutCubic(prog(t, 7.5, 7.68));
        const bx = lerp(960 - bigW / 2, urlBox.left, fly);
        const by = lerp(560 - bigH / 2, urlBox.top + urlBox.height / 2 - bigH / 2, fly);
        bigTxt.textContent = URL.slice(0, n);
        bigCaret.style.opacity = fly < 0.05 && Math.floor(t * 8) % 2 === 0 ? "1" : fly < 0.05 && n < URL.length ? "1" : "0";
        tf(bigUrl, { x: bx, y: by, s: lerp(1, 16 / 86, fly), o: t > 7.04 && t < 7.7 ? 1 - prog(t, 7.62, 7.7) : 0 });

        /* --- wipe out --- */
        bars.forEach((b) => {
          const k = E.inOutCubic(prog(t, 10.55 + b.delay, 10.98));
          tf(b.d, { x: lerp(2300, -900, k), skx: -18 });
        });
      };
    },
    3,
  ),
);
