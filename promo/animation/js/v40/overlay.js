/* 40 s — screen-space captions over the diorama. Every text stays up long enough to be read. */
SCENE_BUILDERS.push(() =>
  M.scene(
    "overlay",
    4.4,
    36.0,
    (root) => {
      const { el, E, prog, clamp, lerp, tf, spring, icon, cue } = M;
      const BLUE = ART.BLUE;
      const words = (txt, cls = "") =>
        txt
          .split(" ")
          .map((w) => `<span class="rvw ${cls}" style="display:inline-block">${w}</span>`)
          .join(" ");

      /** Glass card whose lines (.rv) and words (.rvw) reveal in sequence. */
      function card(o) {
        const c = el(root, "glass-card");
        c.style.cssText += `left:${o.x}px;top:${o.y}px;width:${o.w}px;padding:${o.pad || "34px 42px"};box-sizing:border-box;${o.css || ""}`;
        c.innerHTML = o.html;
        const items = [...c.querySelectorAll(".rv, .rvw")];
        return {
          c,
          update(t) {
            const vis = t > o.tIn - 0.01 && t < o.tOut + 0.35;
            c.style.display = vis ? "" : "none";
            if (!vis) return;
            const kin = E.outCubic(prog(t, o.tIn, o.tIn + 0.4));
            const kout = E.inCubic(prog(t, o.tOut, o.tOut + 0.32));
            tf(c, { y: 70 * (1 - kin) + 90 * kout, o: kin * (1 - kout), s: 0.96 + 0.04 * kin });
            items.forEach((it, i) => {
              const a = o.tIn + 0.12 + i * (o.step || 0.06);
              const k = E.outBack(prog(t, a, a + 0.35));
              it.style.transform = `translate3d(0,${(28 * (1 - k)).toFixed(1)}px,0)`;
              it.style.opacity = prog(t, a, a + 0.15).toFixed(3);
            });
          },
        };
      }
      /** Hand-drawn circle or underline around some words of a card, drawn on at t0 (laid out on first use). */
      function scribble(cardObj, pick, kind, t0, color = BLUE) {
        const host = cardObj.c;
        const wrap = el(host, "abs");
        wrap.style.cssText += "left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;";
        let shapes = null;
        return (t) => {
          if (host.style.display === "none" || t < t0 - 0.05) return;
          if (!shapes) {
            let x0 = 1e9;
            let y0 = 1e9;
            let x1 = -1e9;
            let y1 = -1e9;
            for (const e of pick(host)) {
              let x = 0;
              let y = 0;
              for (let n = e; n && n !== host; n = n.offsetParent) {
                x += n.offsetLeft;
                y += n.offsetTop;
              }
              x0 = Math.min(x0, x);
              y0 = Math.min(y0, y);
              x1 = Math.max(x1, x + e.offsetWidth);
              y1 = Math.max(y1, y + e.offsetHeight);
            }
            const w = x1 - x0;
            const h = y1 - y0;
            let d;
            if (kind === "circle") {
              const cx = (x0 + x1) / 2;
              const cy = (y0 + y1) / 2 + 2;
              const pts = [];
              for (let i = 0; i <= 44; i++) {
                const a = -2.5 + (i / 44) * Math.PI * 2 * 1.1;
                const wob = 1 + 0.05 * Math.sin(i * 1.3) + 0.04 * (i / 44);
                pts.push(`${(cx + Math.cos(a) * (w / 2 + 14) * wob).toFixed(1)} ${(cy + Math.sin(a) * (h / 2 + 9) * wob).toFixed(1)}`);
              }
              d = "M" + pts.join(" L");
            } else {
              const y = y1 + 2;
              d = `M ${x0 - 8} ${y + 7} C ${x0 + w * 0.3} ${y - 3}, ${x0 + w * 0.65} ${y + 9}, ${x1 + 12} ${y - 2} Q ${x1 + 2} ${y + 6} ${x1 - 18} ${y + 12}`;
            }
            wrap.innerHTML = `<svg width="10" height="10" style="position:absolute;left:0;top:0;overflow:visible"><path d="${d}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            shapes = M.prepDraw(wrap);
          }
          M.drawTo(shapes, E.inOutCubic(prog(t, t0, t0 + 0.42)));
        };
      }
      const chip = (ic, txt, extra = "") =>
        `<span class="rv" style="display:inline-flex;align-items:center;gap:12px;padding:12px 22px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 2px #dbe6f7;font:700 25px Roboto;color:#0f172a;${extra}">
          <span style="color:${BLUE};display:flex">${icon(ic, 26, 2.2)}</span>${txt}</span>`;
      const kicker = (txt) =>
        `<div class="rv" style="display:flex;align-items:center;gap:14px;font:700 21px Roboto;letter-spacing:.22em;color:${BLUE};text-transform:uppercase"><span style="width:46px;height:4px;border-radius:4px;background:${BLUE}"></span>${txt}</div>`;
      const feature = (ic, title, body, t0, t1, more = "", w = 1060) =>
        card({
          x: 70,
          y: 760,
          w,
          tIn: t0,
          tOut: t1,
          html: `<div style="display:flex;gap:28px;align-items:center">
            <span class="rv" style="flex:none;width:118px;height:118px;border-radius:32px;background:${BLUE};color:#fff;display:grid;place-items:center">${icon(ic, 66, 1.8)}</span>
            <div><div class="hd" style="font-size:54px;color:#0f172a;line-height:1.1;white-space:normal">${words(title)}</div>
            <div class="rv" style="font:400 30px Roboto;color:#5f6368;margin-top:10px">${body}</div>${more}</div></div>`,
        });

      /* brand mark (top right) during the whole diorama */
      const mark = el(root, "abs");
      mark.style.cssText += `left:auto;right:56px;top:44px;display:flex;align-items:center;gap:14px;padding:12px 22px 12px 14px;border-radius:999px;background:rgb(255 255 255 / .88);
        box-shadow:0 16px 36px -20px rgb(4 21 58 / .5);`;
      mark.innerHTML = `${ART.logoMark(46)}<span style="line-height:1"><b style="display:block;font:600 22px 'Lexend Zetta';letter-spacing:.05em;color:#3a3f47">GHANDI</b>
        <span style="font:600 9px 'Lexend Zetta';letter-spacing:.32em;color:${BLUE}">HOME ELECTRO</span></span>`;

      /* chapters */
      const cards = [
        card({
          x: 70,
          y: 560,
          w: 900,
          tIn: 5.9,
          tOut: 9.15,
          html: `<div class="hd" style="font-size:66px;line-height:1.12;color:#0f172a;white-space:normal">${words("Votre magasin d'électroménager")} ${words("à Casablanca", "blue")}</div>
            <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:26px">${chip("map-pin", "41 Boulevard Ghandi, Casablanca", "font-size:28px")}</div>`,
        }),
        card({
          x: 70,
          y: 70,
          w: 1010,
          tIn: 25.35,
          tOut: 28.05,
          html: `<div style="display:flex;gap:28px;align-items:center">
            <span class="rv" style="flex:none;width:118px;height:118px;border-radius:32px;background:${BLUE};color:#fff;display:grid;place-items:center">${icon("truck", 66, 1.8)}</span>
            <div><div class="hd" style="font-size:56px;color:#0f172a;line-height:1.1">${words("Livraison gratuite")}</div>
            <div class="rv" style="font:400 31px Roboto;color:#5f6368;margin-top:10px">À Casablanca, Mohammedia et Dar Bouazza.</div></div></div>`,
        }),
        feature("banknote", "Paiement à la livraison", "Vous payez à la réception.", 28.4, 30.85),
        feature(
          "headphones",
          "Conseil par téléphone et WhatsApp",
          "Nous vous aidons à choisir.",
          31.1,
          34.0,
          "",
          990,
        ),
      ];
      cards.forEach((c) => c.c.querySelectorAll(".blue").forEach((b) => (b.style.color = BLUE)));
      cards[3].c.style.top = "700px";
      const wordsOf = (txts) => (host) => [...host.querySelectorAll(".rvw")].filter((w) => txts.includes(w.textContent));
      [6.5, 25.95, 28.9, 31.7].forEach((t0) => cue(t0, "scribble", { gain: 0.6 }));
      const marks = [
        scribble(cards[0], wordsOf(["Casablanca"]), "underline", 6.5),
        scribble(cards[1], wordsOf(["gratuite"]), "circle", 25.95),
        scribble(cards[2], wordsOf(["à", "la", "livraison"]), "underline", 28.9),
        scribble(cards[3], wordsOf(["WhatsApp"]), "circle", 31.7),
      ];

      /* showroom: univers card with a rolling name */
      // names and the line under them use the site's wording: "Froid, lavage, cuisson, TV et climatisation"
      const ZN = [
        ["Froid", "Froid"],
        ["Lavage", "lavage"],
        ["Cuisson", "cuisson"],
        ["TV", "TV"],
        ["Climatisation", "climatisation"],
      ];
      const T_ZONE = [10.0, 11.0, 12.0, 13.0, 14.0];
      const uni = el(root, "glass-card");
      uni.style.cssText += "left:70px;top:770px;width:1000px;height:250px;padding:28px 40px;box-sizing:border-box;overflow:hidden;";
      uni.innerHTML = `${kicker("Nos univers")}<div class="u-count hd" style="position:absolute;right:40px;top:30px;font-size:26px;color:${BLUE}"></div>
        <div class="u-roll" style="position:relative;height:96px;margin-top:14px;overflow:hidden"></div><div class="u-sub" style="font:500 27px Roboto;color:#5f6368;margin-top:8px"></div>`;
      const roll = uni.querySelector(".u-roll");
      const uCount = uni.querySelector(".u-count");
      const uSub = uni.querySelector(".u-sub");
      uSub.innerHTML = ZN.map(([, w], i) => `<span class="u-w">${w}</span>${i < 3 ? ", " : i === 3 ? " et " : ""}`).join("");
      const uWords = [...uSub.querySelectorAll(".u-w")];
      const names = ZN.map(([n]) => {
        const d = el(roll, "abs hd");
        d.style.cssText += "font-size:84px;color:#0f172a;";
        d.textContent = n;
        return d;
      });

      /* brands: title card */
      const brandCard = el(root, "glass-card");
      brandCard.style.cssText += "left:50%;top:64px;width:660px;margin-left:-330px;padding:26px 40px;box-sizing:border-box;text-align:center;";
      brandCard.innerHTML = `<div class="hd" style="font-size:68px;color:#0f172a">Nos <span style="color:${BLUE}">marques</span></div>`;

      /* order in 3 steps (site wording from "Comment commander") */
      const STEPS = [
        ["shopping-cart", "Panier", "Ajoutez vos produits au panier."],
        ["truck", "Livraison", "Livraison à domicile ou retrait au magasin."],
        ["circle-check-big", "Confirmation", "Nous vous appelons pour confirmer."],
      ];
      const T_STEP = [18.5, 20.0, 21.5];
      const order = el(root, "abs");
      order.style.cssText += "left:70px;top:70px;width:920px;";
      order.innerHTML = `<div class="glass-card" style="position:relative;padding:26px 36px;margin-bottom:22px">${kicker("Commandez en ligne")}
        <div class="hd" style="font-size:54px;color:#0f172a;margin-top:12px;white-space:nowrap">Commander en <span style="color:${BLUE}">3 étapes</span></div></div>
        ${STEPS.map(
          ([ic, ti, tx], i) => `<div class="glass-card o-step" style="position:relative;display:flex;gap:22px;align-items:center;padding:22px 28px;margin-bottom:18px">
            <span class="o-num" style="flex:none;width:76px;height:76px;border-radius:50%;display:grid;place-items:center;font:800 32px Unbounded">${i + 1}</span>
            <span><b style="display:flex;align-items:center;gap:10px;font:700 34px Roboto;color:#0f172a"><span class="o-ic" style="display:flex">${icon(ic, 30, 2)}</span>${ti}</b>
            <span style="display:block;font:400 26px/1.3 Roboto;color:#5f6368;margin-top:4px">${tx}</span></span></div>`,
        ).join("")}`;
      const orderHead = order.firstElementChild;
      const steps = [...order.querySelectorAll(".o-step")];

      return (t) => {
        const inShow = t >= 9.5 && t < 18.0;
        tf(mark, { o: prog(t, 4.6, 5.0) * (1 - prog(t, 35.2, 35.5)), x: 30 * (1 - E.outCubic(prog(t, 4.6, 5.0))) });
        cards.forEach((c) => c.update(t));
        marks.forEach((m) => m(t));

        /* univers */
        const ushow = t > 9.75 && t < 14.95;
        uni.style.display = ushow ? "" : "none";
        if (ushow) {
          tf(uni, { y: 70 * (1 - E.outCubic(prog(t, 9.75, 10.1))) + 90 * E.inCubic(prog(t, 14.6, 14.9)), o: prog(t, 9.75, 9.95) * (1 - prog(t, 14.65, 14.9)) });
          let idx = 0;
          T_ZONE.forEach((tz, i) => t >= tz - 0.12 && (idx = i));
          uCount.textContent = `0${idx + 1} / 05`;
          names.forEach((n, i) => {
            const tIn = T_ZONE[i] - 0.12;
            const kin = i === 0 ? 1 : E.outCubic(prog(t, tIn, tIn + 0.3));
            const kout = i < 4 ? E.inCubic(prog(t, T_ZONE[i + 1] - 0.12, T_ZONE[i + 1] + 0.18)) : 0;
            n.style.display = t >= tIn - 0.01 || i === 0 ? "" : "none";
            tf(n, { y: 100 * (1 - kin) - 100 * kout });
          });
          uWords.forEach((w, i) => {
            const on = i === idx;
            w.style.color = on ? BLUE : i < idx ? "#0f172a" : "#9aa3ad";
            w.style.fontWeight = on ? "800" : "500";
          });
          tf(uSub, { o: prog(t, 9.9, 10.2) });
        }

        /* brands */
        const bshow = t > 15.25 && t < 18.0;
        brandCard.style.display = bshow ? "" : "none";
        if (bshow) {
          tf(brandCard, { y: -50 * (1 - E.outCubic(prog(t, 15.25, 15.6))) - 60 * E.inCubic(prog(t, 17.7, 17.95)), o: prog(t, 15.25, 15.45) * (1 - prog(t, 17.75, 17.95)) });
        }

        /* order steps */
        const oshow = t > 18.25 && t < 23.4;
        order.style.display = oshow ? "" : "none";
        if (oshow) {
          const kin = E.outCubic(prog(t, 18.25, 18.65));
          const kout = E.inCubic(prog(t, 23.0, 23.35));
          tf(orderHead, { x: -80 * (1 - kin) - 900 * kout, o: kin });
          steps.forEach((s, i) => {
            const a = 18.4 + i * 0.12;
            const k = E.outBack(prog(t, a, a + 0.4));
            const active = t >= T_STEP[i] && (i === 2 || t < T_STEP[i + 1]);
            const done = i < 2 && t >= T_STEP[i + 1];
            tf(s, { x: -120 * (1 - k) - 900 * E.inCubic(prog(t, 23.0 + i * 0.05, 23.35 + i * 0.05)), o: prog(t, a, a + 0.15), s: active ? 1.04 : 1 });
            s.style.background = active ? BLUE : "rgb(255 255 255 / .9)";
            s.querySelectorAll("b, span span").forEach((x) => (x.style.color = active ? "#fff" : ""));
            const num = s.querySelector(".o-num");
            num.style.background = active ? "#fff" : done ? BLUE : "#e9f1fd";
            num.style.color = active ? BLUE : done ? "#fff" : BLUE;
            num.textContent = done ? "✓" : String(i + 1);
            s.querySelector(".o-ic").style.color = active ? "#fff" : BLUE;
          });
        }
      };
    },
    10,
  ),
);
