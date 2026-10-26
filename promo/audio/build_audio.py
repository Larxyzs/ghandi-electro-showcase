#!/usr/bin/env python3
"""Soundtrack for the Ghandi Home Electro promo.

Everything is synthesised here (no samples, no licensed music):
  * an original 120 BPM track in D minor (A -> Dm  Bb  F  C ... -> F),
  * ~30 kinds of sound effects placed from the animation's cue list (promo/out/cues.json,
    written by `node promo/render.cjs cues`).

    python3 promo/audio/build_audio.py  ->  promo/out/audio.wav (48 kHz, stereo, 25 s)
"""
import json
import os

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
COMP = os.environ.get("COMP", "")  # "" = 25 s version, "v40" = 40 s version
DUR = 40.0 if COMP == "v40" else 25.0
N = int(SR * DUR)
BEAT = 0.5  # 120 BPM
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "out", COMP)


# ----------------------------------------------------------------------------- helpers
def tt(d):
    return np.arange(int(round(d * SR))) / SR


def noise(n, seed=0):
    return np.random.default_rng(seed).standard_normal(n)


def _sos(kind, f, order=2):
    nyq = SR / 2 * 0.98
    if kind == "bp":
        lo, hi = max(20.0, f[0]), min(f[1], nyq)
        if hi <= lo * 1.05:
            hi = lo * 1.05
        return signal.butter(order, [lo, hi], btype="bandpass", fs=SR, output="sos")
    f = min(max(20.0, f), nyq)
    return signal.butter(order, f, btype="lowpass" if kind == "lp" else "highpass", fs=SR, output="sos")


def filt(x, kind, f, order=2):
    return signal.sosfilt(_sos(kind, f, order), x)


def sweep(x, kind, fc, order=2, bw=2.0, block=128):
    """Time-varying filter: fc is an array (one cutoff / centre per sample)."""
    y = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        f = float(fc[min(i + block // 2, len(x) - 1)])
        s = _sos("bp", [f / np.sqrt(bw), f * np.sqrt(bw)], order) if kind == "bp" else _sos(kind, f, order)
        if zi is None:
            zi = np.zeros((s.shape[0], 2))
        y[i : i + block], zi = signal.sosfilt(s, x[i : i + block], zi=zi)
    return y


def cycles(freq, n):
    return np.cumsum(np.broadcast_to(np.asarray(freq, dtype=float), (n,))) / SR


def sine(freq, n, ph=0.0):
    return np.sin(2 * np.pi * (cycles(freq, n) + ph))


def saw(freq, n, ph=0.0):
    """Band-limited sawtooth (polyBLEP)."""
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    dt = f / SR
    p = (np.cumsum(dt) + ph) % 1.0
    y = 2 * p - 1
    m = p < dt
    x = p[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = p > 1 - dt
    x = (p[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y


def square(freq, n):
    return 0.5 * (saw(freq, n) - saw(freq, n, 0.5))


def edge(x, fi=0.002, fo=0.01):
    n = len(x)
    a = min(n, int(fi * SR))
    b = min(n, int(fo * SR))
    x = x.copy()
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def pan(x, p=0.0):
    a = (np.clip(np.asarray(p, dtype=float), -1, 1) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def st(x):
    return pan(x, 0.0) * np.sqrt(2)


def norm(x, peak=1.0):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def make_ir(dur=2.2, rt=1.7, seed=11, pre=0.012, bright=0.35):
    n = int(dur * SR)
    t = np.arange(n) / SR
    chans = []
    for k in range(2):
        x = noise(n, seed + k) * np.exp(-6.9 * t / rt)
        dark = filt(x, "lp", 2500)
        w = np.exp(-t / bright)
        x = x * w + dark * (1 - w)
        x = filt(x, "lp", 9000)
        x = np.concatenate([np.zeros(int(pre * SR)), x])
        chans.append(x)
    ir = np.stack(chans, axis=1)
    return ir / np.sqrt(np.sum(ir**2) / 2)


IR_ROOM = make_ir(1.0, 0.7, 21, 0.006, 0.12)
IR_HALL = make_ir(2.6, 2.2, 31, 0.018, 0.4)


def reverb(x, ir, wet=0.3, tail=None):
    """x: stereo array. Returns dry + wet (length grows by the IR tail)."""
    tail = ir.shape[0] if tail is None else int(tail * SR)
    n = x.shape[0] + tail
    out = np.zeros((n, 2))
    out[: x.shape[0]] += x
    for c in range(2):
        w = signal.fftconvolve(x[:, c], ir[:, c])[:n]
        out[: len(w), c] += wet * w
    return out


def bell(f, d, partials=((1, 1, 1.0), (2.0, 0.35, 0.55), (2.76, 0.25, 0.4), (4.07, 0.12, 0.25)), decay=0.9):
    t = tt(d)
    y = np.zeros_like(t)
    for ratio, amp, dec in partials:
        y += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / (decay * dec))
    return edge(y, 0.001, 0.02)


# ----------------------------------------------------------------------------- sound effects
def sfx_whoosh(dur=0.4, rise=0, pan_amt=0.0, seed=1, gain=1.0):
    n = int(dur * SR)
    u = np.arange(n) / n
    if rise:
        fc = 260 * 14 ** (u**1.3)
        amp = u**2.2
        amp = amp * np.minimum(1, (1 - u) * 40 + 0.0) + amp * (u > 0.97) * 0
    else:
        fc = 350 + 2600 * np.sin(np.pi * u) ** 1.4
        amp = np.sin(np.pi * u) ** 1.5
    x = noise(n, seed)
    y = sweep(x, "bp", fc, 2, 2.6) * 1.2
    air = sweep(noise(n, seed + 7), "hp", fc * 1.8) * 0.35
    body = filt(noise(n, seed + 3), "lp", 220) * 0.9
    y = (y + air + body) * amp
    p = pan_amt * (2 * u - 1) if pan_amt else 0.25 * np.sin(np.pi * u * 2) * 0.5
    return pan(edge(y, 0.003, 0.015), p) * gain


def sfx_swish(seed=2):
    d = 0.2
    n = int(d * SR)
    u = np.arange(n) / n
    fc = 1500 + 5000 * np.sin(np.pi * u**0.7)
    y = sweep(noise(n, seed), "bp", fc, 2, 2.0) * np.sin(np.pi * u) ** 2
    return pan(edge(y), 0.4 * (2 * u - 1)) * 1.3


def sfx_swoosh(dur=0.35, seed=4):
    n = int(dur * SR)
    u = np.arange(n) / n
    fc = 300 + 1800 * np.sin(np.pi * u)
    y = sweep(noise(n, seed), "bp", fc, 2, 3.0) * np.sin(np.pi * u) ** 1.8
    return pan(edge(y), -0.5 + u) * 0.9


def sfx_impact(big=1.0):
    d = 1.4
    t = tt(d)
    n = len(t)
    f = 38 + 120 * np.exp(-t / 0.045)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.5 * big))
    thump = np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.09) * 0.55
    nz = filt(noise(n, 5), "lp", 3200) * np.exp(-t / 0.07) * 0.65
    crack = filt(noise(n, 6), "hp", 2600) * np.exp(-t / 0.012) * 0.6
    x = np.tanh(1.8 * (sub + thump + nz + crack)) / np.tanh(1.8)
    y = reverb(st(edge(x, 0.0005, 0.05)), IR_HALL, 0.22)
    return y


def sfx_subdrop():
    d = 1.5
    t = tt(d)
    f = 30 + 70 * np.exp(-t / 0.35)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    x = np.tanh(2.2 * x) * 0.9
    return st(edge(x, 0.002, 0.1))


def sfx_hit(pitch=1.0):
    d = 0.6
    t = tt(d)
    n = len(t)
    f = 52 * pitch + 170 * pitch * np.exp(-t / 0.028)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    snap = filt(noise(n, 9), "bp", [1200, 7000]) * np.exp(-t / 0.035) * 0.55
    tone = np.sin(2 * np.pi * 587.3 * pitch * t) * np.exp(-t / 0.07) * 0.12
    x = np.tanh(1.5 * (body + snap + tone))
    return reverb(st(edge(x, 0.0005)), IR_ROOM, 0.25)


def sfx_punch(pitch=1.0):
    d = 0.5
    t = tt(d)
    n = len(t)
    f = 48 * pitch + 210 * pitch * np.exp(-t / 0.022)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.14)
    clap = np.zeros(n)
    for k, off in enumerate((0.0, 0.009, 0.019)):
        i = int(off * SR)
        seg = filt(noise(n - i, 30 + k), "bp", [900, 4500]) * np.exp(-np.arange(n - i) / SR / (0.012 if k < 2 else 0.06))
        clap[i:] += seg * 0.5
    x = np.tanh(1.7 * (body + clap))
    return reverb(st(edge(x, 0.0005)), IR_ROOM, 0.3)


def sfx_slam():
    d = 0.7
    t = tt(d)
    n = len(t)
    f = 44 + 80 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    x += filt(noise(n, 12), "lp", 1300) * np.exp(-t / 0.09) * 0.7
    x += filt(noise(n, 13), "bp", [2000, 6000]) * np.exp(-t / 0.01) * 0.3
    return reverb(st(edge(np.tanh(1.5 * x), 0.0005)), IR_ROOM, 0.3)


def sfx_thud(pitch=1.0):
    d = 0.3
    t = tt(d)
    n = len(t)
    f = 62 * pitch + 95 * pitch * np.exp(-t / 0.018)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.085)
    x += filt(noise(n, 14), "bp", [1500, 5000]) * np.exp(-t / 0.004) * 0.35
    x += filt(noise(n, 15), "lp", 600) * np.exp(-t / 0.03) * 0.4
    return st(edge(np.tanh(1.4 * x), 0.0005))


def sfx_pop(pitch=1.0):
    d = 0.15
    t = tt(d)
    n = len(t)
    f = 380 * pitch * (1 + 1.7 * (1 - np.exp(-t / 0.012)))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.032)
    x += filt(noise(n, 16), "hp", 3000) * np.exp(-t / 0.0015) * 0.35
    return st(edge(x, 0.0005, 0.01)) * 0.9


def sfx_tick(pitch=1.0):
    d = 0.06
    t = tt(d)
    n = len(t)
    x = filt(noise(n, 17), "bp", [2400 * pitch, 7000]) * np.exp(-t / 0.004)
    x += np.sin(2 * np.pi * 1900 * pitch * t) * np.exp(-t / 0.008) * 0.35
    return st(edge(x, 0.0003)) * 0.9


def _click_part(f, seed):
    t = tt(0.04)
    n = len(t)
    x = filt(noise(n, seed), "bp", [f * 0.7, f * 1.7]) * np.exp(-t / 0.0028)
    x += np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t / 0.005) * 0.4
    return x


def sfx_click():
    out = np.zeros(int(0.14 * SR))
    a = _click_part(2900, 18)
    b = _click_part(3700, 19) * 0.6
    out[: len(a)] += a
    i = int(0.07 * SR)
    out[i : i + len(b)] += b
    return st(edge(out, 0.0002)) * 1.1


def sfx_type(seed=0):
    r = np.random.default_rng(1000 + seed)
    t = tt(0.09)
    n = len(t)
    f = 1700 + 1500 * r.random()
    x = filt(noise(n, 200 + seed), "bp", [f * 0.6, f * 1.8]) * np.exp(-t / 0.005)
    x += np.sin(2 * np.pi * (170 + 90 * r.random()) * t) * np.exp(-t / 0.012) * 0.55
    j = int((0.028 + 0.015 * r.random()) * SR)
    x[j:] += filt(noise(n - j, 300 + seed), "bp", [2500, 6000]) * np.exp(-np.arange(n - j) / SR / 0.003) * 0.25
    return pan(edge(x, 0.0002), (r.random() - 0.5) * 0.5) * (0.75 + 0.35 * r.random())


def sfx_ding(pitch=1.0):
    f = 1174.66 * pitch  # D6
    d = 1.1
    out = np.zeros(int(d * SR))
    a = bell(f, 0.9, decay=0.7)
    b = bell(f * 1.5, 0.95, decay=0.75)
    out[: len(a)] += a
    i = int(0.085 * SR)
    out[i : i + len(b)] += b * 0.8
    return reverb(st(out), IR_HALL, 0.25, 1.0) * 0.55


def sfx_buzz():
    d = 0.38
    t = tt(d)
    n = len(t)
    motor = np.sign(np.sin(2 * np.pi * 148 * t)) * 0.6 + np.sin(2 * np.pi * 74 * t)
    motor = filt(motor, "lp", 900) * (1 + 0.5 * np.sin(2 * np.pi * 31 * t))
    gate = ((t < 0.15) | ((t > 0.21) & (t < 0.36))).astype(float)
    gate = np.convolve(gate, np.ones(240) / 240, mode="same")
    return st(edge(motor * gate)) * 0.45


def sfx_glass():
    d = 0.45
    t = tt(d)
    n = len(t)
    x = np.zeros(n)
    for f, dec, a in ((2350, 0.22, 1), (3720, 0.16, 0.7), (5180, 0.11, 0.5), (6900, 0.07, 0.35)):
        x += a * np.sin(2 * np.pi * f * t) * np.exp(-t / dec)
    x += filt(noise(n, 20), "hp", 4000) * np.exp(-t / 0.003)
    return reverb(st(edge(x, 0.0003) * 0.4), IR_ROOM, 0.3)


def sfx_fall(dur=0.3):
    n = int(dur * SR)
    u = np.arange(n) / n
    fc = 2600 * (0.15 ** u)
    y = sweep(noise(n, 21), "bp", fc, 2, 2.2) * (0.2 + 0.8 * u**1.5)
    y += np.sin(2 * np.pi * np.cumsum(1500 * (0.4**u)) / SR) * 0.12 * u
    return st(edge(y, 0.01, 0.01))


def sfx_crackle(dur=0.9, seed=22):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    r = np.random.default_rng(seed)
    out = np.zeros((n, 2))
    k = 0
    tc = 0.0
    while tc < dur:
        rate = 40 + 260 * (tc / dur) ** 1.2
        tc += r.exponential(1 / rate)
        i = int(tc * SR)
        if i >= n - 200:
            break
        ln = int(r.uniform(0.0005, 0.004) * SR)
        burst = filt(noise(ln, seed + k), "hp", 1500) * np.exp(-np.arange(ln) / ln * 4) * r.uniform(0.2, 1.0)
        out[i : i + ln] += pan(burst, r.uniform(-0.7, 0.7))
        k += 1
    flick = filt(noise(n, seed + 900), "lp", 25)
    flick = 0.5 + 0.5 * np.tanh(flick * 4)
    hum = filt(saw(100, n) + 0.5 * saw(150, n), "lp", 2200) * 0.22 * flick
    sizzle = filt(noise(n, seed + 901), "bp", [3500, 9000]) * 0.25 * flick
    env = np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.08) * (0.4 + 0.6 * u)
    out += st(hum + sizzle) * 0.7
    return out * env[:, None]


def sfx_zap():
    d = 0.25
    t = tt(d)
    n = len(t)
    mod = np.sin(2 * np.pi * 120 * t) * 9
    x = np.sin(2 * np.pi * 950 * t * (1 - 0.4 * t / d) + mod) * np.exp(-t / 0.06)
    x += filt(noise(n, 23), "hp", 2500) * np.exp(-t / 0.02) * 0.6
    return reverb(st(edge(x, 0.0005) * 0.6), IR_ROOM, 0.3)


def sfx_powerup(dur=0.55):
    n = int(dur * SR)
    u = np.arange(n) / n
    f = 55 * 8 ** u
    x = saw(f, n) * 0.6 + np.sin(2 * np.pi * np.cumsum(f / 2) / SR)
    x = sweep(x, "lp", 300 + 5000 * u**2)
    x *= u**1.2
    return st(edge(x, 0.01, 0.04)) * 0.5


def sfx_powerdown(dur=0.5):
    """TV switching off: a falling whine, a soft thump when the picture folds, a last static tick."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    f = 1400 * 0.04 ** u
    whine = sweep(saw(f, n) * 0.5 + np.sin(2 * np.pi * np.cumsum(f / 2) / SR), "lp", 200 + 5000 * (1 - u) ** 2)
    whine *= (1 - u) ** 0.7 * 0.6
    out = whine.copy()
    i = int(0.16 * SR)
    tb = tt(0.25)
    out[i : i + len(tb)] += (np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-tb / 0.02)) / SR) * np.exp(-tb / 0.08))[: n - i] * 0.8
    j = int(0.3 * SR)
    ts = tt(0.06)
    out[j : j + len(ts)] += (filt(noise(len(ts), 97), "hp", 3000) * np.exp(-ts / 0.01))[: n - j] * 0.4
    return st(edge(out, 0.002, 0.03))


def sfx_riser(dur=1.0):
    n = int(dur * SR)
    u = np.arange(n) / n
    out = np.zeros((n, 2))
    for c in range(2):
        nz = sweep(noise(n, 40 + c), "hp", 180 * 45 ** u, 2)
        out[:, c] += nz * u**2.4 * 0.9
    f = 110 * 8 ** u
    tone = sum(saw(f * (1 + d_), n) for d_ in (-0.006, 0.0, 0.007)) / 3
    tone = sweep(tone, "lp", 600 + 7000 * u**2)
    out += pan(tone * u**2 * 0.5, 0)
    return out * np.minimum(1, (1 - u) * 200)[:, None]


def sfx_shimmer(dur=0.8, seed=50):
    r = np.random.default_rng(seed)
    n = int((dur + 0.3) * SR)
    out = np.zeros((n, 2))
    count = int(45 * dur) + 6
    notes = [1174.66, 1396.91, 1760.0, 2349.32, 2793.83, 3520.0, 4698.64]
    for k in range(count):
        t0 = dur * r.random() ** 1.6
        f = notes[r.integers(len(notes))] * (1 + 0.003 * r.standard_normal())
        dd = r.uniform(0.05, 0.25)
        tone = np.sin(2 * np.pi * f * tt(dd * 3)) * np.exp(-tt(dd * 3) / dd) * r.uniform(0.2, 1.0)
        i = int(t0 * SR)
        j = min(n, i + len(tone))
        out[i:j] += pan(tone[: j - i], r.uniform(-0.8, 0.8))
    return reverb(out * 0.25, IR_HALL, 0.45, 1.2)


def sfx_scroll(dur=0.5):
    n = int((dur + 0.05) * SR)
    out = np.zeros(n)
    for k in range(14):
        u = k / 13
        tk = dur * (0.5 - 0.5 * np.cos(np.pi * u))
        tick = _click_part(2400 + 300 * np.sin(k), 60 + k) * 0.35
        i = int(tk * SR)
        out[i : i + len(tick)] += tick[: n - i]
    return st(out)


def sfx_blip(pitch=1.0):
    t = tt(0.07)
    f = 880 * pitch * (1 + 0.1 * t / 0.07)
    x = filt(square(f, len(t)), "lp", 4000) * np.exp(-t / 0.025)
    return st(edge(x, 0.0005)) * 0.5


def sfx_sonar():
    t = tt(1.2)
    f = 1174.66 * (1 - 0.02 * t)
    x = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.2 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR)) * np.exp(-t / 0.3)
    return reverb(st(edge(x, 0.002) * 0.5), IR_HALL, 0.5, 1.2)


def sfx_pindrop():
    t = tt(0.8)
    n = len(t)
    knock = (np.sin(2 * np.pi * 520 * t) * np.exp(-t / 0.05) + 0.6 * np.sin(2 * np.pi * 1180 * t) * np.exp(-t / 0.03)) * 0.7
    knock += filt(noise(n, 70), "bp", [1500, 5000]) * np.exp(-t / 0.004) * 0.4
    thud = np.sin(2 * np.pi * np.cumsum(55 + 80 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.12)
    boing = np.sin(2 * np.pi * np.cumsum(330 + 140 * np.exp(-t / 0.25) * np.sin(2 * np.pi * 13 * t)) / SR) * np.exp(-t / 0.22) * 0.3
    x = knock + thud + boing
    return reverb(st(edge(np.tanh(1.3 * x), 0.0005)), IR_ROOM, 0.25)


def sfx_truck(dur=0.75):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    f0 = 46 * (1.12 - 0.24 * u)
    eng = saw(f0, n) + 0.6 * saw(2 * f0, n) + 0.3 * square(3 * f0, n)
    eng = filt(eng, "lp", 520) * (1 + 0.35 * np.sin(2 * np.pi * 13 * t))
    road = filt(noise(n, 80), "lp", 900) * 0.5
    amp = np.exp(-(((u - 0.5) / 0.3) ** 2))
    return pan(edge((eng * 0.6 + road) * amp, 0.02, 0.05), -0.85 + 1.7 * u)


def sfx_horn():
    out = np.zeros(int(0.32 * SR))
    for k, t0 in enumerate((0.0, 0.16)):
        t = tt(0.12)
        x = square(392, len(t)) + square(494, len(t))
        x = filt(x, "lp", 2400) * 0.35
        x = edge(x, 0.004, 0.015)
        i = int(t0 * SR)
        out[i : i + len(x)] += x
    return st(out) * 0.6


def sfx_cash():
    d = 1.0
    n = int(d * SR)
    out = np.zeros(n)
    t = tt(0.12)
    clunk = filt(noise(len(t), 90), "lp", 1600) * np.exp(-t / 0.02) + np.sin(2 * np.pi * 120 * t) * np.exp(-t / 0.04) * 0.6
    out[: len(clunk)] += clunk * 0.8
    ch = bell(2093.0, 0.9, ((1, 1, 1.0), (1.26, 0.6, 0.8), (1.5, 0.5, 0.7), (2.0, 0.35, 0.5), (3.0, 0.15, 0.3)), decay=0.55)
    i = int(0.06 * SR)
    out[i : i + len(ch)] += ch * 0.55
    r = np.random.default_rng(91)
    for k in range(14):
        tk = 0.09 + 0.4 * r.random() ** 1.5
        tc = tt(0.03)
        tick = np.sin(2 * np.pi * r.uniform(4000, 8000) * tc) * np.exp(-tc / 0.006) * r.uniform(0.1, 0.35)
        j = int(tk * SR)
        out[j : j + len(tick)] += tick
    return reverb(st(edge(out, 0.0005)), IR_ROOM, 0.2)


def sfx_ring(dur=0.6):
    t = tt(dur)
    x = 0.5 * (np.sin(2 * np.pi * 1174.66 * t) + np.sin(2 * np.pi * 1480 * t))
    gate = (np.sin(2 * np.pi * 18 * t) > 0).astype(float)
    gate *= ((t < 0.26) | ((t > 0.32) & (t < 0.58))).astype(float)
    gate = np.convolve(gate, np.ones(120) / 120, mode="same")
    return st(filt(x * gate, "lp", 3500) * 0.35)


def sfx_glitch(dur=0.2, seed=95):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros(n)
    i = 0
    while i < n:
        ln = int(r.uniform(0.008, 0.03) * SR)
        if r.random() < 0.7:
            f = r.choice([220, 330, 440, 880, 1760])
            seg = saw(f, ln) * 0.6 + noise(ln, int(r.integers(1e6))) * 0.4
            hold = int(r.integers(4, 24))
            seg = np.repeat(seg[::hold], hold)[:ln]
            bits = r.integers(3, 6)
            seg = np.round(seg * 2**bits) / 2**bits
            out[i : i + len(seg)] += seg[: n - i] * r.uniform(0.4, 1)
        i += ln
    return pan(edge(out) * 0.35, 0)


SFX = {
    "whoosh": lambda c: sfx_whoosh(c.get("dur", 0.4), c.get("rise", 0), c.get("pan", 0.0), int(c["t"] * 100)),
    "swish": lambda c: sfx_swish(int(c["t"] * 100)),
    "swoosh": lambda c: sfx_swoosh(c.get("dur", 0.35), int(c["t"] * 100)),
    "impact": lambda c: sfx_impact(),
    "subdrop": lambda c: sfx_subdrop(),
    "hit": lambda c: sfx_hit(c.get("pitch", 1)),
    "punch": lambda c: sfx_punch(c.get("pitch", 1)),
    "slam": lambda c: sfx_slam(),
    "thud": lambda c: sfx_thud(c.get("pitch", 1)),
    "pop": lambda c: sfx_pop(c.get("pitch", 1)),
    "tick": lambda c: sfx_tick(c.get("pitch", 1)),
    "click": lambda c: sfx_click(),
    "type": lambda c: sfx_type(c.get("seed", 0)),
    "ding": lambda c: sfx_ding(c.get("pitch", 1)),
    "buzz": lambda c: sfx_buzz(),
    "glass": lambda c: sfx_glass(),
    "fall": lambda c: sfx_fall(c.get("dur", 0.3)),
    "crackle": lambda c: sfx_crackle(c.get("dur", 0.9)),
    "zap": lambda c: sfx_zap(),
    "powerup": lambda c: sfx_powerup(c.get("dur", 0.55)),
    "riser": lambda c: sfx_riser(c.get("dur", 1.0)),
    "riserShort": lambda c: sfx_riser(c.get("dur", 0.45)),
    "shimmer": lambda c: sfx_shimmer(c.get("dur", 0.8), int(c["t"] * 10)),
    "scroll": lambda c: sfx_scroll(c.get("dur", 0.5)),
    "blip": lambda c: sfx_blip(c.get("pitch", 1)),
    "sonar": lambda c: sfx_sonar(),
    "pinDrop": lambda c: sfx_pindrop(),
    "truck": lambda c: sfx_truck(c.get("dur", 0.75)),
    "horn": lambda c: sfx_horn(),
    "cash": lambda c: sfx_cash(),
    "ring": lambda c: sfx_ring(c.get("dur", 0.6)),
    "glitch": lambda c: sfx_glitch(c.get("dur", 0.2)),
    "powerdown": lambda c: sfx_powerdown(c.get("dur", 0.5)),
}

# Relative level of each effect family in the mix.
LEVEL = {
    "impact": 1.0, "subdrop": 0.8, "hit": 0.75, "punch": 0.85, "slam": 0.8, "thud": 0.7, "pop": 0.55, "tick": 0.4,
    "click": 0.6, "type": 0.45, "ding": 0.7, "buzz": 0.5, "glass": 0.5, "fall": 0.45, "crackle": 0.5, "zap": 0.6,
    "powerup": 0.6, "riser": 0.55, "riserShort": 0.4, "shimmer": 0.5, "scroll": 0.45, "blip": 0.35, "sonar": 0.55, "pinDrop": 0.85,
    "truck": 0.7, "horn": 0.55, "cash": 0.8, "ring": 0.45, "glitch": 0.5, "whoosh": 0.6, "swish": 0.45, "swoosh": 0.45,
    "powerdown": 0.6,
}


# ----------------------------------------------------------------------------- music
def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


CHORDS = {
    "Asus": [57, 62, 64],
    "A": [57, 61, 64],
    "Dm": [57, 62, 65, 69],
    "Bb": [58, 62, 65, 70],
    "F": [57, 60, 65, 69],
    "C": [55, 60, 64, 67],
    "Fadd9": [57, 60, 65, 67, 69, 72],
}
ROOT = {"Asus": 33, "A": 33, "Dm": 38, "Bb": 34, "F": 41, "C": 36, "Fadd9": 41}
# chord per bar (2 s); the intro builds on A (the dominant) and the drop lands on D minor
PROGRESSION = [(0.0, "Asus"), (1.5, "A"), (3.0, "Dm"), (5.0, "Bb"), (7.0, "F"), (9.0, "C"), (11.0, "Dm"), (13.0, "Bb"),
               (15.0, "F"), (17.0, "C"), (19.0, "Dm"), (21.0, "Bb"), (23.0, "Fadd9")]


def chord_at(t):
    name = PROGRESSION[0][1]
    for t0, c in PROGRESSION:
        if t >= t0 - 1e-6:
            name = c
    return name


def place(buf, x, t0, gain=1.0):
    i = int(round(t0 * SR))
    if x.ndim == 1:
        x = st(x)
    if i < 0:
        x = x[-i:]
        i = 0
    j = min(buf.shape[0], i + x.shape[0])
    if j > i:
        buf[i:j] += x[: j - i] * gain


def supersaw(f, n, voices=5, detune=0.012, seed=0):
    r = np.random.default_rng(seed)
    L = np.zeros(n)
    R = np.zeros(n)
    for k in range(voices):
        d = (k - (voices - 1) / 2) / max(1, (voices - 1) / 2) * detune
        v = saw(f * (1 + d), n, r.random())
        if k % 2:
            L += v
        else:
            R += v
        if k == voices // 2:
            L += v * 0.5
            R += v * 0.5
    return np.stack([L, R], axis=1) / voices


def inst_pad(notes, t0, dur, gain=0.18, cutoff=1600):
    n = int((dur + 0.8) * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for k, m in enumerate(notes):
        out += supersaw(mtof(m), n, 3, 0.008, k)
    lfo = cutoff * (1 + 0.25 * np.sin(2 * np.pi * 0.3 * (t + t0)))
    for c in range(2):
        out[:, c] = sweep(out[:, c], "lp", lfo, 2, block=512)
    env = np.minimum(1, t / 0.35) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.3))
    return out * env[:, None] * gain


def inst_stab(notes, t0, dur=0.22, gain=0.2, bright=1.0):
    n = int((dur + 0.25) * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for k, m in enumerate(notes):
        out += supersaw(mtof(m), n, 5, 0.014, 10 + k)
    fc = (1300 + 5200 * bright * np.exp(-t / 0.09))
    for c in range(2):
        out[:, c] = sweep(out[:, c], "lp", fc, 2, block=256)
    env = np.minimum(1, t / 0.004) * np.where(t < dur, np.exp(-t / (dur * 1.2)), np.exp(-dur / (dur * 1.2)) * np.exp(-(t - dur) / 0.06))
    return out * env[:, None] * gain


def inst_pluck(m, t0, gain=0.12, decay=0.16, panv=0.0):
    n = int((decay * 4) * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    x = saw(f, n) * 0.7 + square(f * 1.002, n) * 0.3
    x = sweep(x, "lp", 700 + 5200 * np.exp(-t / 0.05), 2)
    x *= np.exp(-t / decay) * np.minimum(1, t / 0.002)
    return pan(x, panv) * gain


def inst_bass(m, t0, dur, gain=0.32):
    n = int((dur + 0.05) * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    sub = np.sin(2 * np.pi * f * t)
    grit = sweep(saw(f, n), "lp", 380 + 900 * np.exp(-t / 0.05))
    env = np.minimum(1, t / 0.006) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.015))
    return st((sub * 0.8 + grit * 0.45) * env) * gain


def drum_kick(gain=1.0):
    t = tt(0.45)
    f = 48 + 135 * np.exp(-t / 0.032)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    x += filt(noise(len(t), 500), "hp", 2000) * np.exp(-t / 0.003) * 0.25
    return st(np.tanh(1.6 * x) * 0.9) * gain


def drum_clap(seed=600):
    t = tt(0.4)
    n = len(t)
    x = np.zeros(n)
    for k, off in enumerate((0.0, 0.011, 0.022, 0.031)):
        i = int(off * SR)
        x[i:] += filt(noise(n - i, seed + k), "bp", [900, 3200]) * np.exp(-np.arange(n - i) / SR / (0.008 if k < 3 else 0.11))
    return reverb(st(x * 0.5), IR_ROOM, 0.35)


def drum_snare(pitch=1.0, seed=700):
    t = tt(0.22)
    n = len(t)
    x = filt(noise(n, seed), "bp", [1400, 7000]) * np.exp(-t / 0.07) * 0.7
    x += np.sin(2 * np.pi * 190 * pitch * t) * np.exp(-t / 0.05) * 0.6
    return st(x)


def drum_hat(open_=False, seed=800):
    d = 0.25 if open_ else 0.06
    t = tt(d)
    x = filt(noise(len(t), seed), "bp", [7000, 13500]) * np.exp(-t / (0.08 if open_ else 0.014))
    return x * 0.4


def drum_crash(seed=900):
    t = tt(2.2)
    n = len(t)
    x = filt(noise(n, seed), "bp", [3500, 11000]) * np.exp(-t / 0.65)
    x += filt(noise(n, seed + 1), "bp", [5000, 10000]) * np.exp(-t / 0.25) * 0.5
    return reverb(pan(x * 0.35, 0.2), IR_HALL, 0.25)


def reverse_swell(dur=1.0, seed=950):
    t = tt(dur)
    x = filt(noise(len(t), seed), "hp", 2500) * np.exp(-t / (dur * 0.35))
    return st(x[::-1] * 0.35)


def build_music():
    mus = np.zeros((N + SR * 3, 2))
    drums = np.zeros_like(mus)
    kicks = []

    # --- pads (whole piece, changing with the progression)
    for k, (t0, c) in enumerate(PROGRESSION):
        t1 = PROGRESSION[k + 1][0] if k + 1 < len(PROGRESSION) else DUR + 0.5
        g = 0.13 if t0 < 3 else 0.11
        if 21.0 <= t0 < 23.0:
            g = 0.14
        if t0 >= 23.0:
            g = 0.16
        place(mus, inst_pad(CHORDS[c], t0, t1 - t0, g, 1100 if t0 < 1.5 else 1800), t0)
    # intro drone + reverse swell into the flash
    place(mus, st(np.sin(2 * np.pi * mtof(33) * tt(3.0)) * np.minimum(1, tt(3.0) / 0.8) * 0.12), 0.0)
    place(mus, reverse_swell(1.2), 1.5 - 1.2)

    # --- build-up 1.5 -> 3.0: filtered kicks, arp, snare roll
    for tb in (1.5, 2.0, 2.5):
        place(drums, st(filt(drum_kick(0.8)[:, 0], "lp", 400)), tb)
        kicks.append(tb)
    tr = 2.5
    step = 0.125
    while tr < 2.94:
        place(drums, drum_snare(1 + (tr - 2.5)), tr, 0.25 + 0.6 * (tr - 2.5) / 0.44)
        step = 0.0625 if tr >= 2.75 else 0.125
        tr += step
    for i in range(12):
        tn = 1.5 + i * 0.125
        notes = CHORDS["A"] + [69, 73]
        place(mus, inst_pluck(notes[i % len(notes)] + 12, tn, 0.05 + 0.05 * i / 12, 0.12, 0.4 * np.sin(i)), tn)
    place(mus, reverse_swell(0.5), 3.0 - 0.5)

    # --- main groove
    def groove_on(t):
        return (3.0 <= t < 10.75) or (11.0 <= t < 20.85)

    tb = 3.0
    while tb < 21.0:
        if groove_on(tb):
            place(drums, drum_kick(1.0), tb)
            kicks.append(tb)
        tb += BEAT
    tc = 3.5
    while tc < 21.0:
        if groove_on(tc):
            place(drums, drum_clap(int(tc * 10)), tc, 0.55)
        tc += 1.0
    for i in range(int((21.0 - 3.0) / 0.125)):
        th = 3.0 + i * 0.125
        if not groove_on(th):
            continue
        off = (i % 4) == 2
        h = drum_hat(off, 800 + i)
        place(drums, pan(h, 0.25 if i % 2 else -0.15), th, 0.55 if off else 0.22)
    # fills
    for k in range(8):
        place(drums, drum_snare(1.0 + k * 0.05, 710 + k), 6.5 + k * 0.0625, 0.15 + 0.06 * k)
    for k in range(8):
        place(drums, drum_snare(1.0 + k * 0.05, 720 + k), 10.5 + k * 0.03125, 0.12 + 0.05 * k)
    for t_c in (3.0, 7.0, 11.0, 15.0, 23.0):
        place(drums, drum_crash(900 + int(t_c)), t_c, 0.8 if t_c != 23.0 else 1.1)

    # bass: off-beat pumping 8ths + downbeat sub
    for i in range(int((21.0 - 3.0) / 0.25)):
        tn = 3.0 + i * 0.25
        if not groove_on(tn):
            continue
        root = ROOT[chord_at(tn)]
        if i % 2 == 1:
            place(mus, inst_bass(root + 12, tn, 0.2, 0.26), tn)
        elif i % 4 == 0:
            place(mus, inst_bass(root, tn, 0.22, 0.3), tn)

    # chord stabs: syncopated pattern in each bar + accents on the visual hits
    pattern = [0.0, 0.75, 1.5]
    bar = 3.0
    while bar < 21.0:
        for off in pattern:
            ts = bar + off
            if groove_on(ts):
                place(mus, inst_stab(CHORDS[chord_at(ts)], ts, 0.2, 0.15), ts)
        bar += 2.0
    for ts in (11.0, 11.5, 12.0, 12.5, 13.0):
        place(mus, inst_stab([n + 12 for n in CHORDS[chord_at(ts)]], ts, 0.18, 0.08, 1.2), ts)
    for i in range(8):
        ts = 14.75 + i * 0.25
        place(mus, inst_stab(CHORDS[chord_at(ts)], ts, 0.12, 0.1, 1.3), ts)

    # 16th-note pluck arpeggios
    def arp(t0, t1, octave=12, gain=0.07):
        i = 0
        tn = t0
        while tn < t1 - 1e-6:
            c = CHORDS[chord_at(tn)]
            seq = c + [c[1] + 12, c[2] + 12] if len(c) > 2 else c
            order = [0, 2, 1, 3, 2, 4, 3, 5]
            m = seq[order[i % len(order)] % len(seq)] + octave
            place(mus, inst_pluck(m, tn, gain, 0.13, 0.5 * np.sin(i * 0.9)), tn)
            i += 1
            tn += 0.125

    arp(7.0, 10.75, 12, 0.08)
    arp(11.0, 14.5, 12, 0.075)
    arp(17.5, 20.85, 12, 0.08)
    # break: sparse high plucks over Bb, then the final chord
    for k, tn in enumerate(np.arange(21.0, 22.9, 0.25)):
        c = CHORDS["Bb"]
        place(mus, inst_pluck(c[k % len(c)] + 24, tn, 0.05, 0.25, 0.6 * np.sin(k)), tn)
    tr = 22.5
    while tr < 22.97:
        place(drums, drum_snare(1 + (tr - 22.5) * 1.5, 760 + int(tr * 100)), tr, 0.2 + 0.7 * (tr - 22.5) / 0.47)
        tr += 0.125 if tr < 22.75 else 0.0625
    place(mus, reverse_swell(1.0, 960), 23.0 - 1.0)
    place(drums, drum_kick(1.2), 23.0)
    kicks.append(23.0)
    place(mus, inst_stab([n + 12 for n in CHORDS["Fadd9"]], 23.0, 0.6, 0.16, 1.4), 23.0)
    place(mus, inst_bass(ROOT["Fadd9"], 23.0, 1.6, 0.34), 23.0)
    for k, m in enumerate([77, 81, 84, 89]):
        place(mus, inst_pluck(m, 23.6 + k * 0.12, 0.06, 0.4, -0.5 + k * 0.33), 23.6 + k * 0.12)

    # sidechain pumping on the music bus from the kicks
    duck = np.ones(mus.shape[0])
    for tk in kicks:
        i = int(tk * SR)
        seg = 1 - 0.55 * np.exp(-np.arange(int(0.45 * SR)) / SR / 0.09)
        j = min(len(duck), i + len(seg))
        duck[i:j] = np.minimum(duck[i:j], seg[: j - i])
    mus *= duck[:, None]
    mus = reverb(mus, IR_HALL, 0.18)[: mus.shape[0]]
    out = mus + drums
    # tame the very top end of the music bus
    sos = _sos("lp", 15000, 2)
    out = np.stack([signal.sosfilt(sos, out[:, 0]), signal.sosfilt(sos, out[:, 1])], axis=1)
    return out[:N], kicks


# ----------------------------------------------------------------------------- music (40 s version)
CHORDS_V40 = dict(CHORDS, Bbmaj9=[58, 62, 65, 69, 72])
ROOT_V40 = dict(ROOT, Bbmaj9=34)
# 2-s bars from 2.0 s: logo and city on Dm, then the loop Dm Bb F C under the story, a breakdown on C and
# the final drop on Fadd9 at 36.0 s
PROG_V40 = [(0.0, "Asus"), (1.0, "A"), (2.0, "Dm"), (6.0, "Bb"), (8.0, "F"), (10.0, "C"), (12.0, "Dm"), (14.0, "Bb"),
            (16.0, "F"), (18.0, "C"), (20.0, "Dm"), (22.0, "Bb"), (24.0, "F"), (26.0, "C"), (28.0, "Dm"), (30.0, "Bb"),
            (32.0, "F"), (34.0, "C"), (36.0, "Fadd9"), (38.0, "Bbmaj9"), (39.0, "Fadd9")]
FULL_V40 = [(4.0, 9.0), (10.0, 14.5), (15.5, 17.5), (24.0, 34.0), (36.0, 39.0)]  # four on the floor
MID_V40 = [(18.5, 23.5)]  # backbeat (kick 1 and 3, clap 2 and 4) under the order steps
HALF_V40 = [(2.0, 3.5)]  # kick on 1 and 3 under the logo


def build_music_v40():
    mus = np.zeros((N + SR * 3, 2))
    drums = np.zeros_like(mus)
    kicks = []
    on = lambda t, spans: any(a - 1e-6 <= t < b - 1e-6 for a, b in spans)
    full = lambda t: on(t, FULL_V40)
    mid = lambda t: on(t, MID_V40)
    half = lambda t: on(t, HALF_V40)
    whole = lambda t: abs(t - np.floor(t + 1e-6)) < 1e-6

    def chord(t):
        name = PROG_V40[0][1]
        for t0, c in PROG_V40:
            if t >= t0 - 1e-6:
                name = c
        return name

    def kick(t, gain=1.0, lp=None):
        x = drum_kick(gain)
        if lp:
            x = st(filt(x[:, 0], "lp", lp))
        place(drums, x, t)
        kicks.append(t)

    def roll(t0, t1, gain0=0.15, gain1=0.85, seed=0):
        tr = t0
        while tr < t1 - 0.02:
            k = (tr - t0) / (t1 - t0)
            place(drums, drum_snare(1 + 0.5 * k, 740 + seed + int(tr * 100)), tr, gain0 + (gain1 - gain0) * k)
            tr += 0.125 if k < 0.5 else 0.0625

    def arp(t0, t1, octave=12, gain=0.07, step=0.125, order=(0, 2, 1, 3, 2, 4, 3, 5)):
        i = 0
        tn = t0
        while tn < t1 - 1e-6:
            c = CHORDS_V40[chord(tn)]
            seq = c + [c[1] + 12, c[2] + 12]
            m = seq[order[i % len(order)] % len(seq)] + octave
            place(mus, inst_pluck(m, tn, gain, 0.13, 0.5 * np.sin(i * 0.9)), tn)
            i += 1
            tn += step

    # --- pads, one per chord
    for k, (t0, c) in enumerate(PROG_V40):
        t1 = PROG_V40[k + 1][0] if k + 1 < len(PROG_V40) else DUR + 0.5
        g, cut = 0.1, 1800
        if t0 < 2.0:
            g, cut = 0.12, 1000
        elif t0 == 34.0:
            g, cut = 0.13, 2400  # breakdown: the pad carries the riser
        elif t0 >= 36.0:
            g, cut = 0.15, 2200
        place(mus, inst_pad(CHORDS_V40[c], t0, t1 - t0, g, cut), t0)

    # --- intro (0 - 2 s): the hook slams on frame 0, plucks on the phrase flips, the power-on arpeggio after
    # the press, a roll into the logo hit
    place(mus, st(np.sin(2 * np.pi * mtof(33) * tt(2.4)) * np.minimum(1, tt(2.4) / 0.25) * 0.12), 0.0)
    kick(0.0, 1.1)
    place(mus, inst_bass(ROOT_V40["A"], 0.0, 0.45, 0.32), 0.0)
    for tn, m in ((0.5, 81), (0.75, 85)):
        place(mus, inst_pluck(m, tn, 0.09, 0.2, 0.0), tn)
    for i in range(6):
        tn = 1.25 + i * 0.125
        notes = CHORDS_V40["A"] + [69, 73, 76]
        place(mus, inst_pluck(notes[i % len(notes)] + 12, tn, 0.05 + 0.05 * i / 6, 0.12, 0.4 * np.sin(i)), tn)
    for tb in (1.0, 1.5):
        kick(tb, 0.8, 400)
    roll(1.5, 2.0, 0.2, 0.8)
    place(mus, reverse_swell(1.2), 2.0 - 1.2)

    # --- hits that open sections, rolls and swells leading into them
    for t_c, g in ((2.0, 1.0), (4.0, 0.8), (10.0, 0.8), (15.5, 0.7), (18.5, 0.9), (24.0, 0.8), (28.0, 0.6), (36.0, 1.15)):
        place(drums, drum_crash(900 + int(t_c * 10)), t_c, g)
    for a, b in ((3.5, 4.0), (9.5, 10.0), (15.0, 15.5), (23.5, 24.0)):
        roll(a, b, 0.12, 0.6, int(a))
    for t_s, d in ((4.0, 0.5), (10.0, 0.5), (18.5, 0.45), (24.0, 0.5)):
        place(mus, reverse_swell(d, 960 + int(t_s)), t_s - d)
    place(mus, inst_stab([n + 12 for n in CHORDS_V40["Dm"]], 2.0, 0.5, 0.15, 1.4), 2.0)
    place(mus, inst_bass(ROOT_V40["Dm"], 2.0, 0.9, 0.34), 2.0)
    # the giant phone lands on the beat at 18.5 s
    kick(18.5, 1.2)
    place(mus, inst_bass(ROOT_V40["C"], 18.5, 0.45, 0.32), 18.5)

    # --- drums
    tb = 2.0
    while tb < DUR - 0.01:
        if full(tb) or ((half(tb) or mid(tb)) and whole(tb)):
            kick(tb, 1.0)
        tb += BEAT
    tc = 2.0
    while tc < DUR - 0.01:
        if ((full(tc) or mid(tc)) and abs((tc % 1.0) - 0.5) < 1e-6) or (half(tc) and abs((tc % 2.0) - 1.0) < 1e-6):
            place(drums, drum_clap(int(tc * 10)), tc, 0.55 if full(tc) else 0.45)
        tc += 0.5
    for i in range(int((DUR - 2.0) / 0.125)):
        th = 2.0 + i * 0.125
        sixteenth = i % 2 == 1
        if full(th):
            if sixteenth and not (24.0 <= th < 34.0):
                continue  # 16th ghost hats only in the delivery / advice stretch
            off = (i % 4) == 2
            place(drums, pan(drum_hat(off, 800 + i), 0.25 if i % 2 else -0.15), th, 0.55 if off else (0.14 if sixteenth else 0.22))
        elif (half(th) or mid(th)) and not sixteenth:
            off = (i % 4) == 2
            place(drums, pan(drum_hat(off and mid(th), 800 + i), 0.2), th, 0.4 if off and mid(th) else 0.2)

    # --- bass
    for i in range(int((DUR - 2.0) / 0.25)):
        tn = 2.0 + i * 0.25
        root = ROOT_V40[chord(tn)]
        if full(tn):
            if i % 2 == 1:
                place(mus, inst_bass(root + 12, tn, 0.2, 0.26), tn)
            elif i % 4 == 0:
                place(mus, inst_bass(root, tn, 0.22, 0.3), tn)
        elif mid(tn) and i % 2 == 0:
            place(mus, inst_bass(root + (12 if i % 4 == 2 else 0), tn, 0.4, 0.27), tn)
        elif half(tn) and i % 4 == 0 and tn >= 2.5:
            place(mus, inst_bass(root, tn, 0.85, 0.3), tn)

    # --- chord stabs: syncopated in the grooves, 8ths with the brand panels, accents on each univers
    bar = 4.0
    while bar < 39.0:
        for off in (0.0, 0.75, 1.5):
            ts = bar + off
            if full(ts) and not (15.5 <= ts < 17.5) and ts != 36.0:
                place(mus, inst_stab(CHORDS_V40[chord(ts)], ts, 0.2, 0.13), ts)
            elif mid(ts) and off:
                place(mus, inst_stab(CHORDS_V40[chord(ts)], ts, 0.16, 0.08, 0.8), ts)
        bar += 2.0
    for i in range(8):
        ts = 15.5 + i * 0.25
        place(mus, inst_stab([n + (12 if i >= 4 else 0) for n in CHORDS_V40[chord(ts)]], ts, 0.12, 0.11, 1.3), ts)
    for k, ts in enumerate((10.0, 11.0, 12.0, 13.0, 14.0)):
        place(mus, inst_stab([n + 12 for n in CHORDS_V40[chord(ts)]], ts, 0.25, 0.09, 1.2), ts)

    # --- plucks
    arp(6.0, 9.0, 12, 0.075)
    arp(10.0, 14.5, 12, 0.065, 0.25, (0, 2, 4, 2))
    arp(18.5, 23.5, 24, 0.06, 0.25, (0, 3, 1, 4))
    arp(19.0, 23.5, 12, 0.05, 0.5, (0, 2, 1))
    arp(24.0, 28.0, 12, 0.075)
    arp(30.0, 34.0, 12, 0.07)

    # --- breakdown (34 - 36 s): drums out, filtered pulses, long roll and swell into the drop
    for tb in (34.0, 34.5, 35.0, 35.5):
        kick(tb, 0.7, 300)
    roll(35.0, 36.0, 0.1, 0.9, 50)
    place(mus, sfx_riser(1.5) * 0.25, 34.5)
    place(mus, reverse_swell(1.0, 999), 35.0)

    # --- drop on Fadd9 (36 s) and the final card
    place(mus, inst_stab([n + 12 for n in CHORDS_V40["Fadd9"]], 36.0, 0.6, 0.16, 1.4), 36.0)
    place(mus, inst_bass(ROOT_V40["Fadd9"], 36.0, 1.6, 0.34), 36.0)
    for k, m in enumerate([77, 81, 84, 89]):
        place(mus, inst_pluck(m, 36.6 + k * 0.12, 0.06, 0.4, -0.5 + k * 0.33), 36.6 + k * 0.12)
    arp(37.0, 39.0, 24, 0.055)
    # last hit at 39 s, then the chord rings out under the fade
    kick(39.0, 1.15)
    place(drums, drum_crash(939), 39.0, 0.75)
    place(mus, inst_stab([n + 12 for n in CHORDS_V40["Fadd9"]], 39.0, 0.8, 0.15, 1.3), 39.0)
    place(mus, inst_bass(ROOT_V40["Fadd9"], 39.0, 1.0, 0.34), 39.0)
    for k, m in enumerate([77, 81, 84, 89, 93]):
        place(mus, inst_pluck(m, 39.1 + k * 0.09, 0.05, 0.45, -0.6 + k * 0.3), 39.1 + k * 0.09)

    # sidechain pumping on the music bus from the kicks
    duck = np.ones(mus.shape[0])
    for tk in kicks:
        i = int(tk * SR)
        seg = 1 - 0.55 * np.exp(-np.arange(int(0.45 * SR)) / SR / 0.09)
        j = min(len(duck), i + len(seg))
        duck[i:j] = np.minimum(duck[i:j], seg[: j - i])
    mus *= duck[:, None]
    mus = reverb(mus, IR_HALL, 0.18)[: mus.shape[0]]
    out = mus + drums
    sos = _sos("lp", 15000, 2)
    out = np.stack([signal.sosfilt(sos, out[:, 0]), signal.sosfilt(sos, out[:, 1])], axis=1)
    out = tape_stop(out, 39.35, 39.75)
    return out[:N], kicks


def tape_stop(x, t0, t1):
    """Playback slows linearly to a halt between t0 and t1 (pitch falls with it); silence after t1."""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    u = np.arange(i1 - i0) / SR
    T = t1 - t0
    pos = t0 + u - u * u / (2 * T)
    src = np.arange(x.shape[0]) / SR
    y = x.copy()
    for c in range(x.shape[1]):
        y[i0:i1, c] = np.interp(pos, src, x[:, c]) * np.sqrt(np.clip(1 - (u / T) ** 2, 0, 1))
    y[i1:] = 0
    return y


# ----------------------------------------------------------------------------- mix
def build_sfx(cues):
    bus = np.zeros((N + SR * 3, 2))
    for c in cues:
        fn = SFX.get(c["type"])
        if fn is None:
            print("unknown cue", c["type"])
            continue
        x = fn(c)
        if x.ndim == 1:
            x = st(x)
        x = norm(x, 1.0)
        place(bus, x, c["t"], c.get("gain", 1.0) * LEVEL.get(c["type"], 0.5))
    return bus[:N]


def limiter(x, ceiling=0.95, window=0.005):
    """Look-ahead peak limiter: gain = box-smoothed running minimum of the required gain,
    which never exceeds the required gain at a peak."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d

    w = int(window * SR)
    need = np.minimum(1.0, ceiling / np.maximum(np.max(np.abs(x), axis=1), 1e-9))
    g = uniform_filter1d(minimum_filter1d(need, 2 * w + 1), 2 * w + 1)
    return x * g[:, None]


def main():
    with open(os.path.join(OUT, "cues.json")) as f:
        cues = json.load(f)
    music, _ = build_music_v40() if COMP == "v40" else build_music()
    sfx = build_sfx(cues)
    music = norm(music, 0.5)
    # gentle ducking of the music under dense effects
    env = np.convolve(np.max(np.abs(sfx), axis=1), np.ones(int(0.05 * SR)) / (0.05 * SR), mode="same")
    duck = 1 - 0.35 * np.clip(env / (np.max(env) + 1e-9) * 2.5, 0, 1)
    mix = music * duck[:, None] + norm(sfx, 0.75)
    mix = filt(mix[:, 0], "hp", 28)[:, None] * [1, 0] + filt(mix[:, 1], "hp", 28)[:, None] * [0, 1]
    t = np.arange(N) / SR
    mix *= np.clip((DUR - t) / 0.35, 0, 1)[:, None]  # fade out over the last 0.35 s
    if COMP == "v40":
        mix *= 1.2  # the longer piece has more quiet stretches; bring it to the same loudness
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    mix = limiter(mix, 0.93)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "audio_raw.wav")
    wavfile.write(path, SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
    print("wrote", path, f"{len(cues)} cues")


if __name__ == "__main__":
    main()
