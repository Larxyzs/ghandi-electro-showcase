/* Boot: load fonts, build every scene, expose seek(t) and the sound cue list to the renderer. */
(function () {
  const stage = document.getElementById("stage");
  M.setStage(stage);
  M.el(stage, "defs", `<svg width="0" height="0"><defs>${ART.DEFS}</defs></svg>`);

  /** Global flash layer, above every scene. Scenes call FX.flash(t, dur, color, peak). */
  const FLASHES = [];
  window.FX = {
    flash(t, dur = 0.3, color = "#ffffff", peak = 1) {
      FLASHES.push({ t, dur, color, peak });
    },
  };

  const fonts = ["400 20px Roboto", "700 20px Roboto", "900 20px Roboto", "800 20px Unbounded", "600 20px 'Lexend Zetta'"];
  window.READY = Promise.all(fonts.map((f) => document.fonts.load(f))).then(() => {
    for (const build of window.SCENE_BUILDERS) build();
    M.scene(
      "fx",
      0,
      M.DURATION + 1,
      (root) => {
        const layer = M.el(root, "fill");
        layer.style.pointerEvents = "none";
        return (t) => {
          let o = 0;
          let c = "#ffffff";
          for (const f of FLASHES) {
            const d = t - f.t;
            if (d < 0 || d > f.dur) continue;
            const v = f.peak * Math.pow(1 - d / f.dur, 2);
            if (v > o) {
              o = v;
              c = f.color;
            }
          }
          layer.style.background = c;
          layer.style.opacity = o.toFixed(3);
        };
      },
      100,
    );
    window.seek = M.seek;
    window.CUES = M.CUES.slice().sort((a, b) => a.t - b.t);
    const q = new URLSearchParams(location.search);
    M.seek(q.has("t") ? parseFloat(q.get("t")) : 0);
    if (q.has("play")) {
      const start = performance.now();
      const loop = () => {
        M.seek(((performance.now() - start) / 1000) % M.DURATION);
        requestAnimationFrame(loop);
      };
      loop();
    }
    return true;
  });
})();
