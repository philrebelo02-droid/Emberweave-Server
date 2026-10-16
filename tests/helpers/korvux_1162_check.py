# v1162 Korvux eight - pixel checks for tests/test_korvux_anim_eight.js (run: python -I korvux_1162_check.py <repo root> <json args>)
# 1. SCALE + ANCHOR as the engine draws a state: the cell that shows source frame 0 (his standing reference pose) scaled so figH = 300 px,
#    its (cx, feet) on one point - against idle's: IoU as drawn, and the best scale (0.97-1.03) / x / y shift around it. Same size, same
#    spot = best scale 1.00 (within 0.01) and a best shift within 2 px. Each state's anchors come from the page (argument 'anim').
# 2. Ember Cleave: the crescent tip of the named FX cells (the leading end of the stroke as painted; the hit cell = the flash point) mapped
#    through the page's _fx22ChopAxe transform (the fit, as painted or mirrored) into blue-sheet px from his foot anchor (x right, y up).
import json, math, os, sys
import numpy as np
from PIL import Image
ROOT = sys.argv[1]; A = json.loads(sys.argv[2])
out = {}
def sheet(u): return Image.open(os.path.join(ROOT, u.split('?')[0].lstrip('/'))).convert('RGBA')
def drawn(st, c, k=1.0, dx=0, dy=0, H=300):
    r = A['anim'][st]; q, p = divmod(c, r['cols']); im = sheet(r['u']).crop((p * r['fw'], q * r['fh'], (p + 1) * r['fw'], (q + 1) * r['fh']))
    s = H / r['figH'] * k; a = np.asarray(im.resize((max(1, round(r['fw'] * s)), max(1, round(r['fh'] * s))), Image.BILINEAR))[..., 3] > 100
    C = np.zeros((520, 960), bool); ox = round(480 - r['cx'] * s) + dx; oy = round(440 - r['feet'] * s) + dy
    ys, xs = np.where(a); ys = ys + oy; xs = xs + ox; ok = (ys >= 0) & (ys < 520) & (xs >= 0) & (xs < 960); C[ys[ok], xs[ok]] = True; return C
iou = lambda a, b: float((a & b).sum() / max(1, (a | b).sum()))
if 'cells0' in A:
    ref = drawn('idle', A['cells0']['idle']); out['scale'] = {}
    for st, c in A['cells0'].items():
        base = drawn(st, c); best = (iou(base, ref), 0, 0, 1.0)
        for k in (0.97, 0.98, 0.99, 1.0, 1.01, 1.02, 1.03):
            for dx in range(-6, 7, 2):
                for dy in range(-6, 7, 2):
                    i = iou(drawn(st, c, k, dx, dy), ref)
                    if i > best[0] + 1e-9: best = (i, dx, dy, k)
        out['scale'][st] = dict(iou=round(iou(base, ref), 4), best_iou=round(best[0], 4), dx=best[1], dy=best[2], k=best[3])
if 'fx' in A:
    F = A['fx']; im = np.asarray(Image.open(os.path.join(ROOT, F['u'].split('?')[0].lstrip('/'))).convert('RGBA')); fw, fh, cols = F['fw'], F['fh'], F['cols']
    def cell(c): q, p = divmod(c, cols); return im[q * fh:(q + 1) * fh, p * fw:(p + 1) * fw, 3] > 60
    ys, xs = np.where(cell(26)); M = np.c_[2 * xs, 2 * ys, np.ones(len(xs))]; ccx, ccy, cc0 = np.linalg.lstsq(M, xs ** 2 + ys ** 2, rcond=None)[0]
    def tip(c):
        if c == F['hit']: return (F['flash'][0] * fw, (1 - F['flash'][1]) * fh)
        ys, xs = np.where(cell(c)); ang = np.degrees(np.arctan2(-(ys - ccy), xs - ccx)) % 360; un = np.where(ang < 20, ang + 360, ang)
        sel = un >= np.percentile(un, 99.5) - 2; return (float(xs[sel].mean()), float(ys[sel].mean()))
    def model(p, fit, mir):   # _fx22ChopAxe for a hero facing RIGHT (sx = 1): UV mirrored or not, material.rotation = -rot, centre + cc (image y down)
        px, py = p; px = fw - px if mir else px; dx, dy = fit['k'] * (px - fw / 2), fit['k'] * (py - fh / 2); th = math.radians(-fit['rot'])
        c, s = math.cos(th), math.sin(th); x = dx * c + dy * s; y = -dx * s + dy * c; return (fit['cc'][0] + x, -(fit['cc'][1] + y))
    out['fx'] = {}
    for name, job in F['jobs'].items():
        out['fx'][name] = [[round(v, 1) for v in model(tip(c), job['fit'], job['mir'])] for c in job['cells']]
print(json.dumps(out))
