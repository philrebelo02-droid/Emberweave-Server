"""CUT + ENCODE: keyed frames -> one sheet per state (cut_v1160.py / cut_ng.py, the route every release since Aureth v1153 shipped).

  unmix : the hero owns no plate green, so green ABOVE max(R,B) is the plate seen through a glow:  ex = G - max(R,B),
          a = 1 - clip((ex - 10) / (Kfull - 10)), T = (obs - (1-a) key) / a; alpha = min(cs10 alpha, a); T's G held to max(T.R, T.B).
          unmixSoft (Veyr v1160 on): only where cs10's alpha < 250 (his art may own cyan-green inside the opaque body).
          refUnmix 'r,g,b' (Deepcleft's dust): a light cloud dissolving into the plate keeps its own colour and thins out.
  despill: DESPILL_ALL on the native cell, again after the resample (the Lanczos lobe).
  crop  : the alpha > 40 union box of the listed frames + frame 0, + pad source px (a GHOST state uses alpha > 8: its faint figure sets it).
  size  : ONE premultiplied Lanczos per cell to the largest cell whose grid fits 2048 x 2048, the standing figure never above maxFig px.
  encode: a lossless MASTER (byte-checked) and the game sheet at WebP q95 (method 6, alpha_quality 100, exact off): alpha bit-exact to
          the master, <= 4 MB.
  anchors (normalise.py): feet = round((sole - Y0) sy), figH = round(height sy), top = feet - figH, cx = (cx - X0) sx to 0.1 px.
  fringe: edge px (alpha 8..200) with G above max(R,B) by > 4 / 12 / 24, master and q95; the gate is master > 24 = 0 and q95 > 24 <= 0.005%.
"""
import json
import math
import os

import numpy as np
from PIL import Image

from .common import LIMIT, FILE_MAX, parse_spec

BG = np.array([38, 34, 46], np.float32)   # the battle floor tone the psnr is measured on


def fringe(a):
    a = a.astype(int)
    al = a[..., 3]
    e = (al >= 8) & (al <= 200)
    body = al > 200
    g = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    ne = max(1, int(e.sum()))
    nb = max(1, int(body.sum()))
    return dict(edge_px=int(e.sum()), **{'edge_gt%d' % t: round(100 * float(((g > t) & e).sum()) / ne, 4) for t in (4, 12, 24)},
                body_gt4=round(100 * float(((g > 4) & body).sum()) / nb, 4), body_gt24=round(100 * float(((g > 24) & body).sum()) / nb, 5))


def cut_state(work, st, spec, anchors, out, master, unmix_soft=False, ref_unmix=None, pad=24, maxfig=240.0, ghost=False, maxfig_h=None):
    frames = parse_spec(spec)
    n = len(frames)
    with open(os.path.join(work, 'measure_%s.json' % st)) as f:
        M = json.load(f)
    SOFT = bool(unmix_soft)
    REF = np.array([float(v) for v in ref_unmix.split(',')]) if ref_unmix else None
    SW, SH = Image.open(os.path.join(work, 'raw', st, 'f001.png')).size
    use = sorted(set(frames) | {0})
    boxes = M['bbox8'] if ghost else M['bbox']
    bx = [boxes[i] for i in use if boxes[i]]
    X0, Y0 = min(b[0] for b in bx) - pad, min(b[1] for b in bx) - pad
    X1, Y1 = max(b[2] for b in bx) + pad, max(b[3] for b in bx) + pad
    X0, Y0 = max(0, X0), max(0, Y0)
    X1, Y1 = min(SW, X1), min(SH, Y1)
    Wc, Hc = X1 - X0, Y1 - Y0
    fh_src = maxfig_h if maxfig_h else anchors['h']
    best = None
    for cols in range(1, n + 1):
        rows = math.ceil(n / cols)
        S = min(1.0, LIMIT / (cols * Wc), LIMIT / (rows * Hc), maxfig / fh_src)
        FW, FH = math.floor(Wc * S), math.floor(Hc * S)
        key = (FW * FH, -(cols * rows - n), -max(cols * FW, rows * FH))
        if best is None or key > best[0]:
            best = (key, cols, rows, FW, FH)
    _, C, R, FW, FH = best
    sx, sy = FW / Wc, FH / Hc
    G = np.zeros((R * FH, C * FW, 4), np.uint8)
    K = np.array(M['key'], np.float64)
    KFULL = K[1] - max(K[0], K[2])
    cache = {}
    unmixed = 0
    for i, f in enumerate(frames):
        if f not in cache:
            k = np.asarray(Image.open(os.path.join(work, 'keyed', st, 'k%03d.png' % f)).convert('RGBA'))[Y0:Y1, X0:X1].astype(np.float64)
            raw = np.asarray(Image.open(os.path.join(work, 'raw', st, 'f%03d.png' % (f + 1))).convert('RGB'))[Y0:Y1, X0:X1].astype(np.float64)
            ex = raw[..., 1] - np.maximum(raw[..., 0], raw[..., 2])
            asp = 1.0 - np.clip((ex - 10) / (KFULL - 10), 0, 1)
            if REF is not None:
                d = REF - K
                a_ref = np.clip(((raw - K) * d).sum(-1) / (d * d).sum(), 0, 1)
                asp = np.where((ex > 10) & (raw.max(-1) > 120), np.minimum(asp, a_ref), asp)
            inv = 1.0 / np.maximum(asp, 0.02)
            T = np.clip((raw - (1 - asp[..., None]) * K) * inv[..., None], 0, 255)
            sage = None
            if REF is not None:
                sage = (raw.max(-1) > 120) & (raw[..., 1] > raw[..., 0]) & (raw[..., 1] - raw[..., 2] > 15) & (raw[..., 0] - raw[..., 2] > 10)
                lum = lambda x: x[..., 0] * 0.299 + x[..., 1] * 0.587 + x[..., 2] * 0.114
                T = np.where(sage[..., None], np.clip(REF[None, None, :] * (lum(T) / lum(REF[None, None, :]))[..., None], 0, 255), T)
            T[..., 1] = np.minimum(T[..., 1], np.maximum(T[..., 0], T[..., 2]))
            u = (asp < 0.999) & (k[..., 3] > 0)
            if sage is not None:
                u |= sage & (k[..., 3] > 0)
            if SOFT:
                u &= (k[..., 3] < 250)
                asp = np.where(u | (k[..., 3] == 0), asp, 1.0)
            unmixed += int(u.sum())
            k[..., :3] = np.where(u[..., None], T, k[..., :3])
            k[..., 3] = np.minimum(k[..., 3], np.round(asp * 255))
            R_, G_, B_ = k[..., 0], k[..., 1], k[..., 2]
            over = np.clip(G_ - np.maximum(R_, B_), 0, None).astype(np.int16).astype(np.float64)
            k[..., 1] = np.clip(G_ - over, 0, 255)
            k[..., 0] = np.clip(R_ + np.floor(over * 0.10), 0, 255)
            k[..., 2] = np.clip(B_ + np.floor(over * 0.10), 0, 255)
            cell = k / 255.0
            al = cell[..., 3:4]
            pm = np.concatenate([cell[..., :3] * al, al], -1)
            ch = [np.asarray(Image.fromarray((pm[..., j] * 65535).astype(np.uint16).astype(np.int32), 'I').resize((FW, FH), Image.LANCZOS)).astype(np.float64) / 65535 for j in range(4)]
            a2 = np.clip(ch[3], 0, 1)
            rgb = np.stack([np.clip(ch[j], 0, 1) for j in range(3)], -1)
            rgb = np.where(a2[..., None] > 1e-4, np.clip(rgb / np.maximum(a2[..., None], 1e-4), 0, 1), 0)
            a8 = np.round(a2 * 255)
            a8[a8 < 4] = 0
            px = np.dstack([np.round(rgb * 255), a8]).astype(np.uint8)
            px[a8 == 0, :3] = 0
            mx = np.maximum(px[..., 0], px[..., 2])
            px[..., 1] = np.minimum(px[..., 1], mx)
            cache[f] = px
        r, c = divmod(i, C)
        G[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = cache[f]
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    os.makedirs(os.path.dirname(master) or '.', exist_ok=True)
    Image.fromarray(G, 'RGBA').save(master, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    back = np.asarray(Image.open(master).convert('RGBA'))
    assert back.shape == G.shape and (back == G).all(), 'lossless encode is not byte-identical'
    Image.fromarray(G, 'RGBA').save(out, 'WEBP', quality=95, method=6, alpha_quality=100, exact=False)
    assert os.path.getsize(out) <= FILE_MAX, 'over 4 MB q95'
    q = np.asarray(Image.open(out).convert('RGBA'))
    assert q.shape == G.shape and (q[..., 3] == G[..., 3]).all(), 'q95 alpha is not bit-exact to the master'
    assert C * FW <= LIMIT and R * FH <= LIMIT
    vis = G[..., 3] > 0
    comp = lambda a: a[..., :3].astype(np.float32) * (a[..., 3:4] / 255.0) + BG * (1 - a[..., 3:4] / 255.0)
    mse = float(((comp(G) - comp(q)) ** 2)[vis].mean())
    psnr = 99.0 if mse == 0 else 10 * math.log10(255 * 255 / mse)
    marg = []
    for i in range(n):
        r, c = divmod(i, C)
        a = G[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW, 3]
        ys, xs = np.where(a > 0)
        marg.append(int(min(xs.min(), ys.min(), FW - 1 - xs.max(), FH - 1 - ys.max())) if len(xs) else 999)
    figH_exact = anchors['h'] * sy
    feet = round((anchors['sole'] - Y0) * sy)
    figH = round(figH_exact)
    top = feet - figH
    cx = round((anchors['cx'] - X0) * sx, 1)
    ghost_alpha = None
    if ghost:
        ghost_alpha = []
        for c_ in (0, n // 2 - 4, n // 2 + 6, n - 1):
            r, c2 = divmod(c_, C)
            a = G[r * FH:(r + 1) * FH, c2 * FW:(c2 + 1) * FW, 3]
            m = a > 8
            ghost_alpha.append([c_, int(m.sum()), round(float(a[m].mean()), 1) if m.any() else 0])
    return dict(state=st, n=n, frames=frames, box=[X0, Y0, X1, Y1], pad=pad, cell_native=[Wc, Hc], fw=FW, fh=FH, cols=C, rows=R, sheet=[C * FW, R * FH],
                sx=round(sx, 5), sy=round(sy, 5), top=top, feet=feet, cx=cx, figH=figH, figH_exact=round(figH_exact, 3), encode='q95',
                bytes=os.path.getsize(out), master_bytes=os.path.getsize(master), psnr=round(psnr, 2), min_margin=min(marg), empty_cells=[i for i, x in enumerate(marg) if x == 999],
                unmixed_px=unmixed, fringe_master=fringe(G), fringe_q95=fringe(q), ghost_alpha=ghost_alpha, unmix_soft=SOFT, ref_unmix=ref_unmix, maxfig=maxfig)
