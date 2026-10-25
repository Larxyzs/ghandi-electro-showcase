/* Reusable motion-graphics accents: line bursts, ring pulses, electric arcs, shape confetti,
   perspective grid floors and text marquees. Each builder returns update(t). */
(function (G) {
  const { el, E, prog, clamp, lerp, rng } = M;

  /** Radial burst of rounded lines shooting out from (x, y) and retracting. */
  function lineBurst(parent, o) {
    const c = Object.assign({ n: 10, r0: 40, r1: 230, width: 7, color: "#fff", dur: 0.45, rot: 0, jitter: 0, seed: 1, z: "" }, o);
    const r = rng(c.seed);
    const lines = [];
    for (let i = 0; i < c.n; i++) {
      const d = el(parent, "abs");
      d.style.cssText += `height:${c.width}px;border-radius:${c.width}px;background:${c.color};transform-origin:0 50%;${c.z}`;
      const a = ((c.rot + (i * 360) / c.n + (r() - 0.5) * c.jitter) * Math.PI) / 180;
      lines.push({ d, a, k: 0.75 + 0.5 * r() });
    }
    return (t, x = c.x, y = c.y) => {
      const p = (t - c.t0) / c.dur;
      for (const l of lines) {
        if (p <= 0 || p >= 1) {
          l.d.style.opacity = "0";
          continue;
        }
        const span = c.r1 * l.k - c.r0;
        const head = c.r0 + span * E.outExpo(clamp(p * 1.15));
        const tail = c.r0 + span * E.outCubic(clamp((p - 0.12) / 0.88));
        const len = Math.max(0, head - tail);
        l.d.style.width = len.toFixed(1) + "px";
        l.d.style.opacity = (p > 0.65 ? (1 - p) / 0.35 : 1).toFixed(3); // fade the retracting tails
        l.d.style.transform = `translate3d(${(x + Math.cos(l.a) * tail).toFixed(1)}px,${(y + Math.sin(l.a) * tail - c.width / 2).toFixed(1)}px,0) rotate(${((l.a * 180) / Math.PI).toFixed(2)}deg)`;
      }
    };
  }

  /** Expanding ring (border stays thin, fades out). */
  function ringPulse(parent, o) {
    const c = Object.assign({ r0: 10, r1: 300, width: 5, color: "#fff", dur: 0.6, sy: 1, fill: "" }, o);
    const d = el(parent, "abs");
    d.style.cssText += `border-radius:50%;border:${c.width}px solid ${c.color};${c.fill ? `background:${c.fill};` : ""}`;
    return (t) => {
      const p = (t - c.t0) / c.dur;
      if (p <= 0 || p >= 1) {
        d.style.opacity = "0";
        return;
      }
      const rr = lerp(c.r0, c.r1, E.outCubic(p));
      d.style.width = 2 * rr + "px";
      d.style.height = 2 * rr * c.sy + "px";
      d.style.transform = `translate3d(${(c.x - rr).toFixed(1)}px,${(c.y - rr * c.sy).toFixed(1)}px,0)`;
      d.style.opacity = Math.pow(1 - p, 1.3).toFixed(3);
    };
  }

  /** Confetti of small geometric shapes (dots, squares, rings, plus signs). */
  function shapeBurst(parent, o) {
    const c = Object.assign({ n: 18, speed: [300, 900], life: 0.9, gravity: 700, drag: 2.4, size: [10, 22], colors: ["#fff"], seed: 3, angle: [0, 360] }, o);
    const r = rng(c.seed);
    const parts = [];
    for (let i = 0; i < c.n; i++) {
      const kind = ["dot", "square", "ring", "plus"][i % 4];
      const s = c.size[0] + r() * (c.size[1] - c.size[0]);
      const col = c.colors[Math.floor(r() * c.colors.length)];
      const d = el(parent, "abs");
      if (kind === "dot") d.style.cssText += `width:${s * 0.6}px;height:${s * 0.6}px;border-radius:50%;background:${col};`;
      if (kind === "square") d.style.cssText += `width:${s * 0.6}px;height:${s * 0.6}px;border-radius:3px;background:${col};`;
      if (kind === "ring") d.style.cssText += `width:${s}px;height:${s}px;border-radius:50%;border:3px solid ${col};box-sizing:border-box;`;
      if (kind === "plus") d.innerHTML = `<svg width="${s}" height="${s}" viewBox="0 0 20 20"><path d="M10 2v16M2 10h16" stroke="${col}" stroke-width="4" stroke-linecap="round"/></svg>`;
      const a = ((c.angle[0] + r() * (c.angle[1] - c.angle[0])) * Math.PI) / 180;
      const v = c.speed[0] + r() * (c.speed[1] - c.speed[0]);
      parts.push({ d, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s, spin: (r() - 0.5) * 720, life: c.life * (0.7 + 0.3 * r()) });
    }
    return (t) => {
      const dt = t - c.t0;
      for (const p of parts) {
        if (dt <= 0 || dt >= p.life) {
          p.d.style.opacity = "0";
          continue;
        }
        const f = (1 - Math.exp(-c.drag * dt)) / c.drag;
        const x = c.x + p.vx * f;
        const y = c.y + p.vy * f + 0.5 * c.gravity * dt * dt;
        const u = dt / p.life;
        const sc = u < 0.15 ? u / 0.15 : 1 - Math.pow((u - 0.15) / 0.85, 2) * 0.6;
        p.d.style.transform = `translate3d(${(x - p.s / 2).toFixed(1)}px,${(y - p.s / 2).toFixed(1)}px,0) rotate(${(p.spin * dt).toFixed(1)}deg) scale(${sc.toFixed(3)})`;
        p.d.style.opacity = (1 - u * u).toFixed(3);
      }
    };
  }

  /** Flickering electric arc between two points (re-drawn every frame from a seeded jitter). */
  function arc(parent, o) {
    const c = Object.assign({ segs: 12, amp: 26, width: 3, color: "#ffffff", glow: "#7fb2ff", seed: 1 }, o);
    const box = el(parent, "fill");
    box.innerHTML = `<svg width="1920" height="1080" style="position:absolute;left:0;top:0;overflow:visible"><polyline fill="none" stroke="${c.color}" stroke-width="${c.width}" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 6px ${c.glow}) drop-shadow(0 0 16px ${c.glow})"/></svg>`;
    const poly = box.querySelector("polyline");
    return (t, a, b, on = true) => {
      if (!on) {
        poly.setAttribute("points", "");
        return;
      }
      const frame = Math.floor(t * 30); // arcs re-strike 30 times a second
      const r = rng(c.seed * 977 + frame * 131);
      const pts = [];
      const nx = -(b.y - a.y);
      const ny = b.x - a.x;
      const nl = Math.hypot(nx, ny) || 1;
      for (let i = 0; i <= c.segs; i++) {
        const u = i / c.segs;
        const env = Math.sin(Math.PI * u);
        const off = (r() - 0.5) * 2 * c.amp * env;
        pts.push(`${(a.x + (b.x - a.x) * u + (nx / nl) * off).toFixed(1)},${(a.y + (b.y - a.y) * u + (ny / nl) * off).toFixed(1)}`);
      }
      poly.setAttribute("points", pts.join(" "));
    };
  }

  /** Perspective grid floor that scrolls toward the viewer. */
  function gridFloor(parent, o) {
    const c = Object.assign({ color: "rgb(120 180 255 / .45)", top: 560, speed: 160, cell: 90 }, o);
    const wrap = el(parent, "abs");
    wrap.style.cssText += `left:0;top:${c.top}px;width:1920px;height:${1080 - c.top}px;perspective:520px;overflow:hidden;
      -webkit-mask-image:linear-gradient(to bottom, transparent 0%, transparent 40%, rgb(0 0 0 / .6) 62%, #000 85%);`;
    const plane = el(wrap, "abs");
    plane.style.cssText += `left:-1600px;top:${1080 - c.top - 2400}px;width:5120px;height:2400px;transform-origin:50% 100%;
      background-image:linear-gradient(${c.color} 2px, transparent 2px),linear-gradient(90deg, ${c.color} 2px, transparent 2px);background-size:${c.cell}px ${c.cell}px;`;
    return (t, opacity = 1) => {
      plane.style.backgroundPosition = `0 ${((t * c.speed) % c.cell).toFixed(1)}px`;
      plane.style.transform = "rotateX(76deg)";
      wrap.style.opacity = opacity.toFixed(3);
    };
  }

  /** Row of repeated text scrolling horizontally. */
  function marquee(parent, o) {
    const c = Object.assign({ text: "", size: 120, color: "#fff", stroke: "", speed: 200, y: 0, gap: 60, weight: 900, reps: 8 }, o);
    const row = el(parent, "abs hd");
    row.style.cssText += `left:0;top:${c.y}px;font-size:${c.size}px;font-weight:${c.weight};white-space:nowrap;display:flex;gap:${c.gap}px;
      color:${c.stroke ? "transparent" : c.color};${c.stroke ? `-webkit-text-stroke:${c.stroke};` : ""}`;
    row.innerHTML = Array.from({ length: c.reps }, () => `<span>${c.text}</span>`).join("");
    let w = 0;
    return (t) => {
      if (!w) w = row.firstChild.offsetWidth + c.gap;
      const x = -(((t * c.speed) % w) + w) % w;
      row.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    };
  }

  /** "Warp speed" lines streaming out of (x, y) — for zoom transitions. */
  function warp(parent, o) {
    const c = Object.assign({ n: 48, color: "#1266e8", width: 4, speed: 2600, len: 260, seed: 21, inner: 120 }, o);
    const r = rng(c.seed);
    const lines = [];
    for (let i = 0; i < c.n; i++) {
      const d = el(parent, "abs");
      d.style.cssText += `height:${c.width}px;border-radius:${c.width}px;background:${c.color};transform-origin:0 50%;`;
      lines.push({ d, a: r() * Math.PI * 2, off: r(), v: 0.6 + 0.8 * r(), w: 0.4 + 0.6 * r() });
    }
    return (t, amount) => {
      for (const l of lines) {
        if (amount <= 0.01) {
          l.d.style.opacity = "0";
          continue;
        }
        const range = 1400;
        const dist = c.inner + (((t * c.speed * l.v) / range + l.off) % 1) * range;
        const len = c.len * l.w * amount * (0.4 + dist / range);
        l.d.style.width = len.toFixed(1) + "px";
        l.d.style.transform = `translate3d(${(c.x + Math.cos(l.a) * dist).toFixed(1)}px,${(c.y + Math.sin(l.a) * dist).toFixed(1)}px,0) rotate(${((l.a * 180) / Math.PI).toFixed(2)}deg)`;
        l.d.style.opacity = Math.min(1, amount * 1.5).toFixed(3);
      }
    };
  }

  G.FXL = { lineBurst, ringPulse, shapeBurst, arc, gridFloor, marquee, warp };
})(window);
