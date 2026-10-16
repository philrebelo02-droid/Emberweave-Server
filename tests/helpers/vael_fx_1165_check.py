# Vael spell FX sheets (tests/test_vael_deepcleft_fx_1165.js): the green-key fringe, measured, with a CONTROL.
#   edge = alpha 8..200, body = alpha > 200
#   GREEN = G > max(R,B) + 24 (visible green, the v1160 measure)
#   OLIVE = hue 55-180 deg, saturation > 0.20, value > 0.08 - plate left inside a semi-transparent colour and despilled to yellow-green, which the
#           GREEN measure cannot see (a despill caps G at max(R,B)); these clips own no green or yellow (tan dust, red blood, bronze shields)
#   VIOLET = hue 250-335, saturation > 0.25 - the green's complement a 4:2:0 soft edge keeps after the unmix (these clips own no violet)
#   CONTROL: the same sheet with 35% of the plate (0,254,0) mixed back into every edge pixel and despilled the v1160 way must read as OLIVE
#   usage: python -I vael_fx_1165_check.py <sheet.webp>...   prints JSON {name: {...}}
import sys, os, json
import numpy as np
from PIL import Image


def measure(a):
    a = a.astype(np.float64); al = a[..., 3]; e = (al >= 8) & (al <= 200); b = al > 200
    r, g, bb = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx = np.maximum(np.maximum(r, g), bb); mn = np.minimum(np.minimum(r, g), bb); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - bb) / d) % 6, np.where(mx == g, (bb - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, d / (mx + 1e-9), 0)
    olive = (h >= 55) & (h <= 180) & (s > 0.20) & (mx > 0.08)
    violet = (h >= 250) & (h <= 335) & (s > 0.25) & (mx > 0.08)
    green = a[..., 1] > np.maximum(a[..., 0], a[..., 2]) + 24
    pc = lambda m, z: round(100.0 * float((m & z).sum()) / max(1, int(z.sum())), 4)
    return dict(edge=int(e.sum()), green_edge=pc(green, e), green_body=pc(green, b), olive_edge=pc(olive, e), olive_body=pc(olive, b), violet_edge=pc(violet, e), violet_body=pc(violet, b))


out = {}
for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGBA'))
    m = measure(a)
    c = a.astype(np.float64).copy(); e = (c[..., 3] >= 8) & (c[..., 3] <= 200)
    for k, p in enumerate((0.0, 254.0, 0.0)): c[..., k] = np.where(e, 0.65 * c[..., k] + 0.35 * p, c[..., k])
    c[..., 1] = np.where(e, np.minimum(c[..., 1], np.maximum(c[..., 0], c[..., 2])), c[..., 1])
    m['control_olive_edge'] = measure(np.clip(np.round(c), 0, 255).astype(np.uint8))['olive_edge']
    v = a.astype(np.float64).copy(); v[..., 2] = np.where(e, np.maximum(v[..., 2], 0.8 * v[..., 0]), v[..., 2]); v[..., 1] = np.where(e, np.minimum(v[..., 1], 0.5 * v[..., 0]), v[..., 1])   # CONTROL: the unmix's violet put back on the edges
    m['control_violet_edge'] = measure(np.clip(np.round(v), 0, 255).astype(np.uint8))['violet_edge']
    w, h = Image.open(f).size
    m['size'] = [w, h]; m['bytes'] = os.path.getsize(f)
    out[os.path.basename(f)] = m
print(json.dumps(out))
