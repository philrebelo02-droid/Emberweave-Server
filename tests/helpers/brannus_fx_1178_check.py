# Brannus spell FX sheets (tests/test_brannus_quorrel_1178.js): the green-key fringe, measured, with a CONTROL.
#   edge = alpha 8..200, body = alpha > 200
#   GREEN = G > max(R,B) + 24 (visible green, the v1160 measure)
#   OLIVE = a DARK yellow-green: hue 55-75 deg, saturation > 0.20, value 0.08-0.45 - the plate left inside a semi-transparent colour and despilled
#           (the despill caps G at max(R,B), so a leaked plate reads as hue ~60 at low value). These clips OWN bright yellow (Arena Lock's glowing chain
#           line, Rim Breaker's spark, the Rampage's fireball), so the v1171 olive band (hue 55-180 at any value) would count the art itself; the dark
#           band is what a leak looks like and the art never is.
#   TEAL = hue 75-180, saturation > 0.2, value > 0.08 (G tied with B over R: the other side of a despilled plate) - these clips own none
#   CONTROL: the same sheet with 35% of the plate (0,254,0) mixed back into every edge pixel and despilled the v1160 way must read as OLIVE
#   usage: python -I brannus_fx_1178_check.py <sheet.webp>...   prints JSON {name: {...}}
import sys, os, json
import numpy as np
from PIL import Image


def measure(a):
    a = a.astype(np.float64); al = a[..., 3]; e = (al >= 8) & (al <= 200); b = al > 200
    r, g, bb = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx = np.maximum(np.maximum(r, g), bb); mn = np.minimum(np.minimum(r, g), bb); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - bb) / d) % 6, np.where(mx == g, (bb - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, d / (mx + 1e-9), 0)
    olive = (h >= 55) & (h <= 75) & (s > 0.20) & (mx > 0.08) & (mx <= 0.45)
    teal = (h > 75) & (h <= 180) & (s > 0.20) & (mx > 0.08)
    yellow = (h >= 45) & (h <= 75) & (s > 0.20) & (mx > 0.45)
    green = a[..., 1] > np.maximum(a[..., 0], a[..., 2]) + 24
    pc = lambda m, z: round(100.0 * float((m & z).sum()) / max(1, int(z.sum())), 4)
    return dict(edge=int(e.sum()), green_edge=pc(green, e), green_body=pc(green, b), olive_edge=pc(olive, e), olive_body=pc(olive, b), teal_edge=pc(teal, e), teal_body=pc(teal, b), yellow_all=pc(yellow, e | b))


out = {}
for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGBA'))
    m = measure(a)
    c = a.astype(np.float64).copy(); e = (c[..., 3] >= 8) & (c[..., 3] <= 200)
    for k, p in enumerate((0.0, 254.0, 0.0)): c[..., k] = np.where(e, 0.65 * c[..., k] + 0.35 * p, c[..., k])
    c[..., 1] = np.where(e, np.minimum(c[..., 1], np.maximum(c[..., 0], c[..., 2])), c[..., 1])
    m['control_olive_edge'] = measure(np.clip(np.round(c), 0, 255).astype(np.uint8))['olive_edge']
    w, h = Image.open(f).size
    m['size'] = [w, h]; m['bytes'] = os.path.getsize(f)
    out[os.path.basename(f)] = m
print(json.dumps(out, indent=0))
