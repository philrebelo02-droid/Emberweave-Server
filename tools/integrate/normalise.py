"""NORMALISE: one size, one spot - the Korvux method (v1162).

The reference figure is the reference state's frame 0 (idle by default): its standing silhouette (alpha > 60) gives top / sole / cx in
source px (cx to 0.1 px, as v1162). Every state is filmed either on the same reference as idle (the manifest's `reference` label says
so; frame 0 is then the same standing figure) or on another one (Korvux's attack / crit / blue / ult on the extra-headroom reference,
x0.698-0.700 smaller).

  same reference : the state's anchors ARE idle's (k 1, no shift). Checked: the fitted scale must still come out 1 +- 0.012.
  other reference: idle's frame-0 silhouette (alpha > 100) is scaled by k (multiples of 0.002 within +-0.012 of the height ratio) and
                   shifted (centroid, then +-3 px) to the best IoU with the state's frame 0; idle's top / sole / cx mapped through that
                   (k, shift) are the state's anchors (2 places), and the standing figure there is idle's height x k.

The cut then puts these into the sheet: feet = round((sole - Y0) sy), figH = round(height sy), top = feet - figH, cx = (cx - X0) sx
to 0.1 px. Assuming the framings match when they do not draws the other states ~30% small (the control in the test).
"""
import os

import numpy as np
from PIL import Image

from .common import log


def _mask(work, st, f=0, thr=100):
    return np.asarray(Image.open(os.path.join(work, 'keyed', st, 'k%03d.png' % f)))[..., 3] > thr


def fit_scale(I, T, ks):
    """ref_scale_fit.py (v1162): idle's mask I scaled by each k (bilinear, > 127), centroid-aligned on T, best of +-3 px; strict > keeps the first best."""
    RI = Image.fromarray((I * 255).astype(np.uint8))
    ty, tx = np.where(T)
    best = (0,)
    for k in ks:
        S = np.asarray(RI.resize((round(RI.width * k), round(RI.height * k)), Image.BILINEAR)) > 127
        ys, xs = np.where(S)
        oy0, ox0 = round(ty.mean() - ys.mean()), round(tx.mean() - xs.mean())
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                C = np.zeros_like(T)
                yy, xx = ys + oy0 + dy, xs + ox0 + dx
                ok = (yy >= 0) & (yy < T.shape[0]) & (xx >= 0) & (xx < T.shape[1])
                C[yy[ok], xx[ok]] = True
                i = (C & T).sum() / (C | T).sum()
                if i > best[0]:
                    best = (i, k, ox0 + dx, oy0 + dy)
    return best


def k_grid(k0, half=0.012, step=0.002):
    c = round(k0 / step) * step
    n = int(round(half / step))
    return [c + step * j for j in range(-n, n + 1)]


def normalise(cfg, ver_res, meas):
    ref_st = cfg.d.get('referenceState', 'idle')
    R = meas[ref_st]['f0']
    r_top, r_sole = float(R['top']), float(R['sole'])
    r_cx = round(R['cx'], 1) if cfg.d.get('refCxDecimals', 1) == 1 else float(R['cx'])
    r_h = r_sole - r_top
    ref_label = ver_res['states'][ref_st].get('reference')
    I = _mask(cfg.work, ref_st)
    out = {'ref': dict(state=ref_st, top=r_top, sole=r_sole, cx=r_cx, h=r_h, label=ref_label), 'states': {}}
    for st in meas:
        f0 = meas[st]['f0']
        label = ver_res['states'][st].get('reference')
        ov = cfg.st(st).get('framing')            # 'same' / 'fit' (override the manifest label)
        same = (ov == 'same') or (ov is None and label == ref_label) or st == ref_st
        T = _mask(cfg.work, st)
        k0 = (f0['sole'] - f0['top']) / r_h
        if st == ref_st:
            fit = (1.0, 1.0, 0, 0)
        else:
            fit = fit_scale(I, T, k_grid(k0))
        iou, k, ox, oy = fit
        e = dict(label=label, f0=dict(top=f0['top'], sole=f0['sole'], cx=round(f0['cx'], 2)), fit=dict(k=round(float(k), 4), iou=round(float(iou), 4), ox=int(ox), oy=int(oy)))
        if same:
            e.update(framing='same', k=1.0, top=r_top, sole=r_sole, cx=r_cx, h=r_h)
            if abs(k - 1) > 0.0121:
                e['problem'] = 'labelled the same reference as %s but frame 0 fits at x%.3f' % (ref_st, k)
        else:
            e.update(framing='fit', k=round(float(k), 4), top=round(r_top * k + oy, 2), sole=round(r_sole * k + oy, 2), cx=round(r_cx * k + ox, 2), h=r_h * k)
            if iou < 0.9:
                e['problem'] = 'best fit IoU %.3f < 0.9 (frame 0 is not the standing figure? give it framing/anchors in the config)' % iou
        man = cfg.st(st).get('anchors')           # explicit [top, sole, cx, k] in source px (attack B's own start-frame reference)
        if man:
            e.update(framing='manual', top=man[0], sole=man[1], cx=man[2], k=man[3] if len(man) > 3 else 1.0, h=(man[1] - man[0]) if len(man) < 4 else r_h * man[3])
        out['states'][st] = e
        log(cfg.work, 'normalise %-8s %-6s k %.4f (fit x%.3f IoU %.4f) top %.2f sole %.2f cx %.2f%s' % (
            st, e['framing'], e['k'], k, iou, e['top'], e['sole'], e['cx'], ('  PROBLEM ' + e['problem']) if e.get('problem') else ''))
    return out
