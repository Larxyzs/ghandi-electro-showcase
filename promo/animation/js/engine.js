/* Deterministic motion engine: every frame is a pure function of the time t (seconds).
   No CSS animations, no wall clock — the renderer calls seek(t) for each frame. */
(function (G) {
  const FPS = 60;
  const DURATION = 25;
  const W = 1920;
  const H = 1080;
  const BPM = 120;
  const BEAT = 60 / BPM;

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));

  const E = {
    lin: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inQuart: (x) => x * x * x * x,
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
    outQuint: (x) => 1 - Math.pow(1 - x, 5),
    inOutQuint: (x) => (x < 0.5 ? 16 * Math.pow(x, 5) : 1 - Math.pow(-2 * x + 2, 5) / 2),
    inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: (x) =>
      x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
    outBack: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
    outBackBig: (x) => 1 + 3.6 * Math.pow(x - 1, 3) + 2.6 * Math.pow(x - 1, 2),
    inBack: (x) => 2.70158 * x * x * x - 1.70158 * x * x,
    outCirc: (x) => Math.sqrt(1 - Math.pow(x - 1, 2)),
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    outSine: (x) => Math.sin((x * Math.PI) / 2),
  };

  /** Tween: value going from `from` to `to` between times a and b. */
  const tw = (t, a, b, from, to, ease = E.outCubic) => lerp(from, to, ease(prog(t, a, b)));

  /** Damped spring step response (0 → 1, overshoots). dt = seconds since start. */
  function spring(dt, freq = 3, damp = 0.4) {
    if (dt <= 0) return 0;
    const w = 2 * Math.PI * freq;
    const z = damp;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * dt) * (Math.cos(wd * dt) + ((z * w) / wd) * Math.sin(wd * dt));
  }
  /** Spring from a to b starting at t0. */
  const sp = (t, t0, a, b, freq = 3, damp = 0.4) => lerp(a, b, spring(t - t0, freq, damp));

  /** Decaying wobble: 0 → ±amp oscillation → 0. Good for squash/stretch after an impact. */
  function wobble(t, t0, amp = 1, freq = 5, decay = 6) {
    const d = t - t0;
    if (d < 0) return 0;
    return amp * Math.exp(-decay * d) * Math.sin(2 * Math.PI * freq * d);
  }

  /** Squash amount right after an impact at t0 (starts at amp, rings down). */
  function squash(t, t0, amp = 0.2, freq = 5, decay = 9) {
    const d = t - t0;
    if (d < 0) return 0;
    return amp * Math.exp(-decay * d) * Math.cos(2 * Math.PI * freq * d);
  }

  /** Height above the ground of an object dropped from h0, landing after tFall, then bouncing. */
  function gravityDrop(dt, h0, tFall, restitution = 0.22, bounces = 3) {
    if (dt <= 0) return h0;
    if (dt < tFall) {
      const u = dt / tFall;
      return h0 * (1 - u * u);
    }
    let t = dt - tFall;
    let h = h0 * restitution;
    let T = 2 * tFall * Math.sqrt(restitution);
    for (let i = 0; i < bounces; i++) {
      if (t < T) {
        const u = t / T;
        return 4 * h * u * (1 - u);
      }
      t -= T;
      h *= restitution;
      T *= Math.sqrt(restitution);
    }
    return 0;
  }

  /** Camera shake offsets that fade out over `dur`. */
  function shake(t, t0, dur, amp, freq = 22, seed = 1) {
    const d = t - t0;
    if (d < 0 || d > dur) return { x: 0, y: 0, r: 0 };
    const env = Math.pow(1 - d / dur, 2) * amp;
    const k = 2 * Math.PI * freq * d;
    return {
      x: env * (0.6 * Math.sin(k + seed) + 0.4 * Math.sin(1.73 * k + seed * 2.1)),
      y: env * (0.6 * Math.cos(1.31 * k + seed * 3.7) + 0.4 * Math.sin(2.07 * k + seed)),
      r: env * 0.035 * Math.sin(0.87 * k + seed * 5.3),
    };
  }
  function addShake(...list) {
    return list.reduce((a, s) => ({ x: a.x + s.x, y: a.y + s.y, r: a.r + s.r }), { x: 0, y: 0, r: 0 });
  }

  /** Seeded PRNG (mulberry32). */
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Smooth 1-D value noise in [-1, 1]. */
  function noise1(x, seed = 0) {
    const i = Math.floor(x);
    const f = x - i;
    const h = (n) => {
      const s = Math.sin((n + seed * 101.3) * 127.1) * 43758.5453;
      return (s - Math.floor(s)) * 2 - 1;
    };
    const u = f * f * (3 - 2 * f);
    return lerp(h(i), h(i + 1), u);
  }

  /* ---------- Sound cues: the audio track is generated from this list ---------- */
  const CUES = [];
  function cue(t, type, opts = {}) {
    CUES.push({ t: Math.round(t * 10000) / 10000, type, ...opts });
  }

  /* ---------- DOM helpers ---------- */
  function el(parent, cls = "", html = null, tag = "div") {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  const NS = "http://www.w3.org/2000/svg";
  function svgEl(parent, tag, attrs = {}) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /** Apply a transform/opacity/filter state to an element. */
  function tf(e, o) {
    const x = o.x || 0;
    const y = o.y || 0;
    const z = o.z || 0;
    const s = o.s == null ? 1 : o.s;
    const sx = (o.sx == null ? 1 : o.sx) * s;
    const sy = (o.sy == null ? 1 : o.sy) * s;
    let t = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px)`;
    if (o.rx) t += ` rotateX(${o.rx.toFixed(3)}deg)`;
    if (o.ry) t += ` rotateY(${o.ry.toFixed(3)}deg)`;
    if (o.r) t += ` rotate(${o.r.toFixed(3)}deg)`;
    if (o.skx) t += ` skewX(${o.skx.toFixed(3)}deg)`;
    if (sx !== 1 || sy !== 1) t += ` scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
    e.style.transform = t;
    if (o.o != null) e.style.opacity = clamp(o.o).toFixed(3);
    if (o.blur != null) e.style.filter = o.blur > 0.05 ? `blur(${o.blur.toFixed(2)}px)` : "none";
    if (o.f != null) e.style.filter = o.f;
  }
  const show = (e, on) => {
    e.style.visibility = on ? "visible" : "hidden";
  };

  /** Split text into inline-block spans (chars or words). Returns the spans. */
  function split(parent, text, mode = "chars", cls = "ch") {
    const out = [];
    if (mode === "words") {
      text.split(" ").forEach((w, i, arr) => {
        const s = el(parent, cls, null, "span");
        s.textContent = w;
        out.push(s);
        if (i < arr.length - 1) el(parent, "sp", " ", "span");
      });
    } else {
      for (const c of text) {
        const s = el(parent, cls, null, "span");
        if (c === " ") {
          s.innerHTML = "&nbsp;";
          s.classList.add("space");
        } else s.textContent = c;
        out.push(s);
      }
    }
    return out;
  }

  /** Lucide-style icon markup. */
  function icon(name, size = 24, stroke = 2, extra = "") {
    const body = (G.ICONS && G.ICONS[name]) || "";
    return `<svg class="ic ic-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;
  }

  /* ---------- Scenes ---------- */
  const SCENES = [];
  let stage = null;
  function setStage(s) {
    stage = s;
  }
  function scene(name, t0, t1, setup, z = 0) {
    const root = el(stage, "scene scene-" + name);
    root.style.zIndex = String(z);
    const s = { name, t0, t1, root, update: null };
    s.update = setup(root, s) || (() => {});
    SCENES.push(s);
    return s;
  }
  function seek(t) {
    for (const s of SCENES) {
      const on = t >= s.t0 && t < s.t1;
      s.root.style.display = on ? "" : "none";
      if (on) s.update(t, t - s.t0);
    }
  }

  /* ---------- Deterministic particles ---------- */
  /** A burst of particles (DOM dots). Positions are analytic: no simulation state. */
  function burst(parent, opts) {
    const o = Object.assign(
      {
        n: 24,
        seed: 1,
        x: 0,
        y: 0,
        t0: 0,
        life: 0.8,
        speed: [300, 900],
        angle: [0, 360],
        size: [4, 10],
        gravity: 900,
        drag: 3,
        colors: ["#ffffff"],
        cls: "pt",
        shape: "dot",
        spin: 0,
      },
      opts,
    );
    const r = rng(o.seed);
    const parts = [];
    for (let i = 0; i < o.n; i++) {
      const a = ((o.angle[0] + r() * (o.angle[1] - o.angle[0])) * Math.PI) / 180;
      const v = o.speed[0] + r() * (o.speed[1] - o.speed[0]);
      const size = o.size[0] + r() * (o.size[1] - o.size[0]);
      const e = el(parent, o.cls + " " + o.shape);
      e.style.width = size + "px";
      e.style.height = (o.shape === "streak" ? size * 0.25 : size) + "px";
      e.style.background = o.colors[Math.floor(r() * o.colors.length)];
      parts.push({ e, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size, life: o.life * (0.6 + 0.4 * r()), rot: r() * 360, a });
    }
    return function update(t) {
      const d = t - o.t0;
      for (const p of parts) {
        if (d < 0 || d > p.life) {
          p.e.style.opacity = "0";
          continue;
        }
        const k = o.drag;
        const f = (1 - Math.exp(-k * d)) / k;
        const x = o.x + p.vx * f;
        const y = o.y + p.vy * f + 0.5 * o.gravity * d * d;
        const u = d / p.life;
        const sc = 1 - u * 0.7;
        let rot = p.rot + o.spin * d;
        if (o.shape === "streak") rot = (Math.atan2(p.vy * Math.exp(-k * d) + o.gravity * d, p.vx * Math.exp(-k * d)) * 180) / Math.PI;
        p.e.style.transform = `translate3d(${(x - p.size / 2).toFixed(1)}px,${(y - p.size / 2).toFixed(1)}px,0) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
        p.e.style.opacity = (1 - u * u).toFixed(3);
      }
    };
  }

  /** Prepare every stroked shape inside `root` (or a list of shapes) for a draw-on animation (pathLength = 1). */
  function prepDraw(root) {
    const shapes = root.querySelectorAll ? root.querySelectorAll("path, rect, circle, line, polyline, polygon, ellipse") : root;
    shapes.forEach((s) => {
      s.setAttribute("pathLength", "1");
      s.style.strokeDasharray = "1 1";
      s.style.strokeDashoffset = "1";
    });
    return shapes;
  }
  /** Draw progress 0..1 for shapes prepared by prepDraw. */
  function drawTo(shapes, p) {
    const v = (1 - clamp(p)).toFixed(4);
    const vis = p > 0.001 ? "visible" : "hidden"; // round caps would otherwise show a dot at 0
    shapes.forEach((s) => {
      s.style.strokeDashoffset = v;
      s.style.visibility = vis;
    });
  }

  /** Shrink a single-line element's font until it fits maxW (fonts must be loaded). */
  function fitText(e, maxW, maxSize) {
    const keep = [e.style.display, e.style.width];
    e.style.display = "inline-block";
    e.style.width = "auto";
    e.style.fontSize = maxSize + "px";
    const w = e.getBoundingClientRect().width;
    if (w > maxW) e.style.fontSize = (maxSize * maxW) / w + "px";
    [e.style.display, e.style.width] = keep;
    return parseFloat(e.style.fontSize);
  }

  G.SCENE_BUILDERS = [];
  G.SHARED = {};

  G.M = {
    FPS, DURATION, W, H, BPM, BEAT,
    clamp, lerp, prog, E, tw, spring, sp, wobble, squash, gravityDrop, shake, addShake, rng, noise1, prepDraw, drawTo, fitText,
    CUES, cue, el, svgEl, tf, show, split, icon, SCENES, scene, seek, setStage, burst,
  };
})(window);
