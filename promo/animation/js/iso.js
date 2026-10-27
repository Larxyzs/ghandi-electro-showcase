/* Isometric 3D diorama engine built from CSS 3D transforms.
   World units are pixels; the ground is the XY plane and +Z points up.
   With the camera yaw around -45°, the visible faces of a box are its top, its south face (y = depth,
   facing +Y) and its west face (x = 0, facing -X), so only those three are built. */
(function (G) {
  const { el } = M;

  const SHADE = {
    white: { top: "#ffffff", west: "#e2eaf6", south: "#cad9ee" },
    cloud: { top: "#f7faff", west: "#e9f0fa", south: "#dbe5f4" },
    pale: { top: "#e8f0fc", west: "#d3e1f6", south: "#bed2f0" },
    sky: { top: "#bcd6ff", west: "#9cc2fb", south: "#83b1f6" },
    blue: { top: "#3d8cff", west: "#1a6ef0", south: "#0b55c6" },
    deep: { top: "#1f63d6", west: "#0e4bb0", south: "#093a8c" },
    navy: { top: "#22314d", west: "#18243b", south: "#101a2c" },
    steel: { top: "#d9e1ea", west: "#bcc7d4", south: "#a6b3c3" },
    glass: { top: "#7fb2ff", west: "#3f86ee", south: "#2c6fd6" },
  };

  function world(parent, o = {}) {
    const viewport = el(parent, "fill");
    viewport.style.perspective = (o.perspective || 6000) + "px";
    viewport.style.perspectiveOrigin = "960px 540px";
    viewport.style.overflow = "hidden";
    const root = el(viewport, "abs iso-g");
    root.style.cssText += "left:0;top:0;width:0;height:0;";
    const bills = [];
    let cam = { x: 0, y: 0, z: 0, zoom: 1, yaw: -45, pitch: 58, sx: 960, sy: 540 };
    const W = {
      viewport,
      root,
      cam: () => cam,
      /** Camera looking at (x, y, z). */
      camera(c) {
        cam = Object.assign({ sx: 960, sy: 540 }, c);
        root.style.transform =
          `translate3d(${cam.sx}px,${cam.sy}px,0) scale3d(${cam.zoom},${cam.zoom},${cam.zoom}) ` +
          `rotateX(${cam.pitch}deg) rotateZ(${cam.yaw}deg) translate3d(${-cam.x}px,${-cam.y}px,${-cam.z}px)`;
        for (const b of bills) b.update();
      },
      group(parent = root, x = 0, y = 0, z = 0) {
        const g = el(parent, "abs iso-g");
        g.style.transform = `translate3d(${x}px,${y}px,${z}px)`;
        return g;
      },
      /** Box with top, south and west faces. `faces` may hold HTML for top/south/west. */
      box(parent, b) {
        const c = typeof b.c === "string" ? SHADE[b.c] : b.c || SHADE.white;
        const g = el(parent || root, "abs iso-g");
        g.style.transform = `translate3d(${b.x}px,${b.y}px,${b.z || 0}px)`;
        const top = el(g, "abs iso-f");
        top.style.cssText += `width:${b.w}px;height:${b.d}px;background:${c.top};transform:translateZ(${b.h}px);`;
        const south = el(g, "abs iso-f");
        south.style.cssText += `width:${b.w}px;height:${b.h}px;background:${c.south};transform:translate3d(0,${b.d}px,${b.h}px) rotateX(-90deg);`;
        const west = el(g, "abs iso-f");
        west.style.cssText += `width:${b.d}px;height:${b.h}px;background:${c.west};transform:translate3d(0,0,${b.h}px) rotateZ(90deg) rotateX(-90deg);`;
        if (b.top) top.innerHTML = b.top;
        if (b.south) south.innerHTML = b.south;
        if (b.west) west.innerHTML = b.west;
        if (b.r) [top].forEach((f) => (f.style.borderRadius = b.r + "px"));
        return { g, top, south, west, b };
      },
      /** Flat rectangle lying on the ground (or at height z). */
      plane(parent, p) {
        const d = el(parent || root, "abs iso-f");
        d.style.cssText += `width:${p.w}px;height:${p.d}px;background:${p.bg || "#fff"};transform:translate3d(${p.x}px,${p.y}px,${p.z || 0}px);${p.css || ""}`;
        if (p.html) d.innerHTML = p.html;
        return d;
      },
      /** Upright plane facing south (+Y), standing on the line y at height z. */
      wall(parent, p) {
        const d = el(parent || root, "abs iso-f");
        d.style.cssText += `width:${p.w}px;height:${p.h}px;background:${p.bg || "transparent"};transform:translate3d(${p.x}px,${p.y}px,${(p.z || 0) + p.h}px) rotateX(-90deg);${p.css || ""}`;
        if (p.html) d.innerHTML = p.html;
        return d;
      },
      /** Element that always faces the camera, anchored by its bottom-centre at (x, y, z). */
      billboard(parent, p) {
        const g = el(parent || root, "abs iso-g");
        const d = el(g, "abs");
        d.style.cssText += `width:${p.w}px;height:${p.h}px;left:${-p.w / 2}px;top:${-p.h}px;transform-origin:50% 100%;${p.css || ""}`;
        if (p.html) d.innerHTML = p.html;
        const bb = {
          g,
          d,
          p,
          extra: "",
          update() {
            g.style.transform = `translate3d(${bb.p.x}px,${bb.p.y}px,${bb.p.z || 0}px) rotateZ(${-cam.yaw}deg) rotateX(${-cam.pitch}deg) ${bb.extra}`;
          },
        };
        bills.push(bb);
        bb.update();
        return bb;
      },
      /** Screen position of a world point (uses a hidden marker; call after camera()). */
      marker(parent, x, y, z) {
        const m = el(parent || root, "abs");
        m.style.cssText += `width:2px;height:2px;transform:translate3d(${x}px,${y}px,${z}px);`;
        return () => {
          const r = m.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        };
      },
    };
    return W;
  }

  /* ---------- reusable models ---------- */

  /** Simple round tree: trunk + crown billboard. */
  function tree(W, parent, x, y, s = 1) {
    const g = W.group(parent, 0, 0, 0);
    W.plane(g, { x: x - 26 * s, y: y - 8 * s, z: 0.6, w: 60 * s, d: 30 * s, bg: "rgb(9 40 100 / .12)", css: "border-radius:50%;" });
    const b = W.billboard(g, {
      x,
      y,
      z: 0,
      w: 64 * s,
      h: 96 * s,
      html: `<svg viewBox="0 0 64 96" width="${64 * s}" height="${96 * s}"><rect x="28" y="56" width="8" height="40" rx="3" fill="#7d8fa8"/>
        <circle cx="32" cy="36" r="30" fill="#5aa2ff"/><circle cx="24" cy="28" r="12" fill="#8fc0ff" opacity=".8"/></svg>`,
    });
    return { g, b };
  }

  /** Car: body box + cabin box. Returns { g } to move with translate/rotate. */
  function car(W, parent, color = "white") {
    const g = W.group(parent, 0, 0, 0);
    W.plane(g, { x: -4, y: 4, z: 0.6, w: 78, d: 40, bg: "rgb(9 40 100 / .14)", css: "border-radius:8px;" });
    W.box(g, { x: 0, y: 0, z: 4, w: 72, d: 36, h: 18, c: color });
    W.box(g, { x: 16, y: 4, z: 22, w: 34, d: 28, h: 14, c: "glass" });
    return g;
  }

  /** Delivery van in the shop colours with the logo on its side. */
  function van(W, parent) {
    const g = W.group(parent, 0, 0, 0);
    W.plane(g, { x: -6, y: 6, z: 0.6, w: 150, d: 66, bg: "rgb(9 40 100 / .16)", css: "border-radius:10px;" });
    // wheels
    [
      [18, 52],
      [104, 52],
    ].forEach(([x, y]) => W.box(g, { x, y, z: 0, w: 22, d: 8, h: 18, c: "navy" }));
    // cargo body (blue) + cab (white)
    W.box(g, {
      x: 0,
      y: 0,
      z: 12,
      w: 104,
      d: 58,
      h: 62,
      c: "blue",
      south: `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:6px;color:#fff;font:800 13px Unbounded;letter-spacing:.02em">
        <span style="width:26px;height:26px">${ART.logoHouse({ ink: "#fff", fill: "#fff", detail: ART.BLUE, hl: "#b7d3ff", vent: "#fff" })}</span>GHANDI</div>`,
      top: `<div style="position:absolute;inset:6px;border-radius:6px;background:#5aa2ff"></div>`,
    });
    W.box(g, { x: 104, y: 4, z: 12, w: 40, d: 50, h: 42, c: "white", south: `<div style="position:absolute;left:6px;top:6px;width:22px;height:16px;border-radius:3px;background:#3f86ee"></div>` });
    W.box(g, { x: 104, y: 6, z: 54, w: 26, d: 46, h: 2, c: "glass" });
    return g;
  }

  /** Palm tree (Boulevard Ghandi and the corniche are lined with them): curved trunk + fronds billboard. */
  function palm(W, parent, x, y, s = 1, seed = 0) {
    const g = W.group(parent, 0, 0, 0);
    W.plane(g, { x: x - 34 * s, y: y - 10 * s, z: 0.6, w: 76 * s, d: 34 * s, bg: "rgb(9 40 100 / .12)", css: "border-radius:50%;" });
    const lean = ((seed * 37) % 11) - 5;
    const fronds = [-150, -115, -80, -45, -10, 25]
      .map((a, i) => {
        const r = (a * Math.PI) / 180;
        const L = 44 + ((i * 7 + seed) % 3) * 6;
        const ex = 60 + Math.cos(r) * L;
        const ey = 46 + Math.sin(r) * L * 0.75 + 18;
        const cx = 60 + Math.cos(r) * L * 0.55;
        const cy = 46 + Math.sin(r) * L * 0.55 - 10;
        return `<path d="M60 46 Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${i % 2 ? "#5aa2ff" : "#3d8cff"}" stroke-width="11" stroke-linecap="round"/>`;
      })
      .join("");
    const b = W.billboard(g, {
      x,
      y,
      z: 0,
      w: 120 * s,
      h: 170 * s,
      html: `<svg viewBox="0 0 120 170" width="${120 * s}" height="${170 * s}" style="overflow:visible">
        <path d="M60 170 C ${60 + lean} 120, ${58 - lean} 90, 60 48" fill="none" stroke="#8ea4c4" stroke-width="9" stroke-linecap="round"/>
        <path d="M60 170 C ${60 + lean} 120, ${58 - lean} 90, 60 48" fill="none" stroke="#b9c8dd" stroke-width="9" stroke-dasharray="3 7" stroke-linecap="butt"/>
        ${fronds}<circle cx="60" cy="47" r="7" fill="#2a6fd6"/></svg>`,
    });
    return { g, b };
  }

  /** Pedestrian billboard (head + body), anchored at the feet. */
  function person(W, parent, shirt = "#1266e8", seed = 0) {
    const skin = ["#f1c8a0", "#d9a77a", "#b98258", "#e8b98e"][seed % 4];
    const legs = ["#22314d", "#3b4a66", "#1a2740"][seed % 3];
    const b = W.billboard(parent, {
      x: 0,
      y: 0,
      z: 0,
      w: 22,
      h: 48,
      html: `<svg viewBox="0 0 22 48" width="22" height="48"><rect class="lg1" x="6" y="30" width="4.5" height="17" rx="2.2" fill="${legs}"/><rect class="lg2" x="11.5" y="30" width="4.5" height="17" rx="2.2" fill="${legs}"/>
        <rect x="4" y="13" width="14" height="20" rx="6" fill="${shirt}"/><circle cx="11" cy="7.5" r="5.6" fill="${skin}"/></svg>`,
    });
    b.d.style.transformOrigin = "50% 100%";
    return b;
  }

  /** Bird: two wings that flap (rotated per frame by the caller through .wings). */
  function bird(W, parent) {
    const b = W.billboard(parent, {
      x: 0,
      y: 0,
      z: 0,
      w: 40,
      h: 20,
      html: `<svg viewBox="0 0 40 20" width="40" height="20" style="overflow:visible"><g class="w1"><path d="M20 12 Q 12 4 2 8" fill="none" stroke="#22314d" stroke-width="2.6" stroke-linecap="round"/></g>
        <g class="w2"><path d="M20 12 Q 28 4 38 8" fill="none" stroke="#22314d" stroke-width="2.6" stroke-linecap="round"/></g></svg>`,
    });
    b.wings = [b.d.querySelector(".w1"), b.d.querySelector(".w2")];
    b.wings.forEach((w) => (w.style.transformOrigin = "20px 12px"));
    return b;
  }

  G.ISO = { world, SHADE, tree, palm, person, bird, car, van };
})(window);
