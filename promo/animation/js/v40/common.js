/* Shared pieces of the 40-second version. */
(function (G) {
  const { el } = M;

  /** Logo lock-up: extruded 3D house, GHANDI wordmark, HOME ELECTRO line and a tagline. */
  function lockup(parent, o) {
    const c = Object.assign({ HS: 1.5, top: 110, wmTop: 470, wmSize: 110, tagTop: 676, tag: "Électroménager et TV à Casablanca" }, o);
    const wrap = el(parent, "fill");
    wrap.style.perspective = "1100px";
    wrap.style.perspectiveOrigin = `960px ${c.top + 110 * c.HS}px`;
    const house = el(wrap, "abs");
    house.style.cssText += `left:${960 - 120 * c.HS}px;top:${c.top}px;width:${240 * c.HS}px;height:${220 * c.HS}px;transform-style:preserve-3d;`;
    house.innerHTML = ART.logoHouse({ ink: "#ffffff", fill: "#ffffff", detail: ART.BLUE, hl: "#b7d3ff", vent: "#ffffff" });
    const front = house.firstElementChild;
    const parts = {
      fridge: front.querySelector(".lh-fridge"),
      washer: front.querySelector(".lh-washer"),
      vent: front.querySelector(".lh-vent"),
      drum: front.querySelector(".lh-drum"),
    };
    [parts.fridge, parts.washer, parts.vent].forEach((g) => {
      g.style.transformBox = "fill-box";
      g.style.transformOrigin = "50% 100%";
    });
    // extrusion: darker copies stacked behind the white face
    for (let i = 12; i >= 1; i--) {
      const layer = el(null, "fill");
      const shade = i > 9 ? "#082f74" : "#0b4fb8";
      layer.innerHTML = ART.logoHouse({ ink: shade, fill: shade, detail: shade, hl: shade, vent: shade });
      layer.style.transform = `translateZ(${-i * 3.2}px)`;
      house.insertBefore(layer, front);
    }
    front.style.transform = "translateZ(0.5px)";

    const wm = el(parent, "abs wm");
    wm.style.cssText += `left:0;width:1920px;top:${c.wmTop}px;color:#fff;`;
    const main = el(wm, "wm-main");
    main.style.fontSize = c.wmSize + "px";
    const letters = M.split(main, "GHANDI");
    const sub = el(wm, "wm-sub");
    const l1 = el(sub, "", null, "i");
    const subTxt = el(sub, "", "HOME ELECTRO", "span");
    const l2 = el(sub, "", null, "i");
    [l1, l2].forEach((i) => (i.style.background = "#cfe3ff"));
    sub.style.color = "#dbeaff";
    const tag = el(parent, "abs");
    tag.style.cssText += `left:0;width:1920px;top:${c.tagTop}px;text-align:center;font:500 34px Roboto;color:rgb(235 243 255 / .95);`;
    tag.textContent = c.tag;
    return { wrap, house, ...parts, letters, sub, subTxt, lines: [l1, l2], tag, center: { x: 960, y: c.top + 110 * c.HS } };
  }

  /** Electron orbits around a point (the "electro" motif). Returns update(t, t0). */
  function orbits(parent, before, o) {
    const c = Object.assign({ x: 960, y: 280, rx: 380, k: 0.25, speed: 4 }, o);
    const list = [-13, 15].map((rot, i) => {
      const ring = el(parent, "abs");
      ring.style.cssText += `left:${c.x - c.rx}px;top:${c.y - c.rx * c.k}px;width:${2 * c.rx}px;height:${2 * c.rx * c.k}px;border-radius:50%;border:2px solid rgb(255 255 255 / .36);`;
      if (before) parent.insertBefore(ring, before);
      const e = el(parent, "abs");
      e.style.cssText += "width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;background:#fff;box-shadow:0 0 12px 4px #b9d8ff,0 0 32px 10px #2f7dff;";
      return { ring, e, rot, ph: i * Math.PI };
    });
    return (t, t0) => {
      const k = M.E.outBack(M.prog(t, t0, t0 + 0.4));
      for (const ob of list) {
        const vis = t > t0;
        ob.ring.style.opacity = vis ? (0.9 * k).toFixed(3) : "0";
        M.tf(ob.ring, { r: ob.rot, s: 0.5 + 0.5 * k });
        const th = (t - t0) * c.speed + ob.ph;
        const a = (ob.rot * Math.PI) / 180;
        const ex = c.rx * Math.cos(th) * (0.5 + 0.5 * k);
        const ey = c.rx * c.k * Math.sin(th) * (0.5 + 0.5 * k);
        ob.e.style.transform = `translate3d(${(c.x + ex * Math.cos(a) - ey * Math.sin(a)).toFixed(1)}px,${(c.y + ex * Math.sin(a) + ey * Math.cos(a)).toFixed(1)}px,0)`;
        ob.e.style.opacity = vis ? ((Math.sin(th) > 0 ? 1 : 0.3) * k).toFixed(3) : "0";
      }
    };
  }

  /** Readable caption: words drop into line masks; a blue marker can sit behind some words. */
  function caption(parent, o) {
    const c = Object.assign({ x: 120, y: 820, size: 70, color: "#0f172a", lines: [], marker: "#1266e8" }, o);
    const box = el(parent, "abs");
    box.style.cssText += `left:${c.x}px;top:${c.y}px;z-index:5;`;
    const words = [];
    c.lines.forEach((ln) => {
      const row = el(box, "hd");
      row.style.cssText += `font-size:${c.size}px;line-height:1.16;color:${c.color};overflow:hidden;padding:0.05em 0.2em 0.15em 0;margin:-0.05em 0 -0.15em;position:relative;`;
      ln.forEach(([w, t0, hl], i) => {
        const s = el(row, "wd", null, "span");
        s.textContent = w;
        if (hl) s.style.color = "#fff";
        words.push({ s, t0, hl });
        if (i < ln.length - 1) el(row, "", " ", "span");
      });
    });
    const hlw = words.filter((w) => w.hl);
    const marker = el(box, "abs");
    marker.style.cssText += `background:${c.marker};border-radius:14px;transform-origin:0 50%;z-index:-1;`;
    return (t, tOut = 1e9) => {
      const out = M.E.inCubic(M.prog(t, tOut, tOut + 0.3));
      words.forEach((w) => {
        const hh = M.gravityDrop(t - w.t0, c.size * 1.5, 0.15, 0.12, 2);
        const qq = M.squash(t, w.t0 + 0.15, 0.14, 5, 10);
        w.s.style.transform = `translate3d(0,${(-hh + out * c.size * 1.4).toFixed(1)}px,0) scale(${(1 + qq * 0.5).toFixed(3)},${(1 - qq).toFixed(3)})`;
        w.s.style.opacity = t < w.t0 ? "0" : "1";
      });
      if (hlw.length) {
        const a = hlw[0].s;
        const b = hlw[hlw.length - 1].s;
        marker.style.left = a.offsetLeft - 16 + "px";
        marker.style.top = a.parentElement.offsetTop + a.offsetTop - 2 + "px";
        marker.style.width = b.offsetLeft + b.offsetWidth - a.offsetLeft + 32 + "px";
        marker.style.height = a.offsetHeight + 6 + "px";
        const mk = M.E.outExpo(M.prog(t, hlw[0].t0 + 0.05, hlw[0].t0 + 0.4)) * (1 - M.E.inCubic(M.prog(t, tOut - 0.05, tOut + 0.2)));
        marker.style.transform = `scaleX(${mk.toFixed(4)})`;
      }
      box.style.display = t < (words[0] ? words[0].t0 - 0.05 : 0) || out >= 1 ? "none" : "";
    };
  }

  G.V40 = { lockup, orbits, caption };
})(window);
