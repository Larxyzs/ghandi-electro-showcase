/* Renders promo/animation/index.html frame by frame with Playwright (Chromium) and encodes with ffmpeg.
 *
 * COMP=v40 renders animation/v40.html into promo/out/v40/ (default: animation/index.html into promo/out/).
 *
 *   node promo/render.cjs cues                 -> promo/out/cues.json (sound cue list read by audio/build_audio.py)
 *   node promo/render.cjs snap 1.5 3.25 ...    -> promo/out/snaps/t<time>.png
 *   node promo/render.cjs video [workers] [sub] -> promo/out/video.mp4 (no audio, 1920x1080 @ 60 fps)
 *
 * Motion blur: with sub > 1 every output frame is the average of `sub` sub-frames spread over a
 * 180° shutter (half a frame), like a film camera.
 */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const COMP = process.env.COMP || "";
const OUT = path.join(ROOT, "out", COMP);
const PAGE = "file://" + path.join(ROOT, "animation", (COMP || "index") + ".html");
const W = 1920;
const H = 1080;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(PAGE);
  await page.waitForFunction(() => window.READY !== undefined);
  await page.evaluate(() => window.READY);
  if (errors.length) console.error("Page errors:\n" + errors.join("\n"));
  const meta = await page.evaluate(() => ({ fps: M.FPS, duration: M.DURATION }));
  return { page, meta };
}

async function seekShot(page, t, opts = {}) {
  await page.evaluate((tt) => window.seek(tt), t);
  return page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H }, ...opts });
}

function ffmpegSegment(file, fps, sub) {
  const blur = sub > 1 ? ["-vf", `tmix=frames=${sub},select='eq(mod(n\,${sub})\,${sub - 1})',setpts=N/(${fps}*TB)`, "-r", String(fps)] : [];
  const ff = spawn(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps * sub), "-c:v", "png", "-i", "-", ...blur, "-c:v", "libx264", "-preset", "medium", "-crf", "10", "-pix_fmt", "yuv444p", file],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg exited " + c)))));
  return { ff, done };
}

async function main() {
  const [mode = "snap", ...args] = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  if (mode === "cues") {
    const { page } = await openPage(browser);
    const cues = await page.evaluate(() => window.CUES);
    fs.writeFileSync(path.join(OUT, "cues.json"), JSON.stringify(cues, null, 1));
    console.log(`${cues.length} cues -> out/cues.json`);
  } else if (mode === "snap") {
    const dir = path.join(OUT, "snaps");
    fs.mkdirSync(dir, { recursive: true });
    const { page } = await openPage(browser);
    for (const a of args) {
      const t = parseFloat(a);
      const buf = await seekShot(page, t);
      const f = path.join(dir, `t${t.toFixed(3)}.png`);
      fs.writeFileSync(f, buf);
      console.log(f);
    }
  } else if (mode === "video") {
    const workers = parseInt(args[0] || "3", 10);
    const sub = parseInt(args[1] || "1", 10);
    const probe = await openPage(browser);
    const { fps, duration } = probe.meta;
    await probe.page.close();
    // RANGE=a,b (seconds) renders only part of the video, for quick checks
    const [ra, rb] = (process.env.RANGE || `0,${duration}`).split(",").map(Number);
    const first = Math.round(ra * fps);
    const total = Math.round(rb * fps) - first;
    const per = Math.ceil(total / workers);
    const segDir = path.join(OUT, "segments");
    fs.mkdirSync(segDir, { recursive: true });
    const t0 = Date.now();
    let doneFrames = 0;
    const segs = [];
    await Promise.all(
      Array.from({ length: workers }, async (_, w) => {
        const from = first + w * per;
        const to = Math.min(first + total, from + per);
        if (from >= to) return;
        const file = path.join(segDir, `seg${w}.mp4`);
        segs[w] = file;
        const { page } = await openPage(browser);
        const { ff, done } = ffmpegSegment(file, fps, sub);
        for (let f = from; f < to; f++) {
          for (let k = 0; k < sub; k++) {
            const offset = sub > 1 ? ((k + 0.5) / sub - 0.5) * (0.5 / fps) : 0;
            const buf = await seekShot(page, Math.max(0, f / fps + offset));
            if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
          }
          doneFrames++;
          if (doneFrames % 60 === 0) {
            const el = (Date.now() - t0) / 1000;
            process.stdout.write(`\r${doneFrames}/${total} frames  ${el.toFixed(0)}s elapsed  ~${((el / doneFrames) * (total - doneFrames)).toFixed(0)}s left   `);
          }
        }
        ff.stdin.end();
        await done;
        await page.close();
      }),
    );
    const list = path.join(segDir, "list.txt");
    fs.writeFileSync(list, segs.filter(Boolean).map((f) => `file '${f}'`).join("\n"));
    await new Promise((res, rej) => {
      const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", path.join(OUT, "video.mp4")], { stdio: "inherit" });
      ff.on("close", (c) => (c === 0 ? res() : rej(new Error("concat failed"))));
    });
    console.log(`\nvideo -> out/video.mp4 (${total} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
