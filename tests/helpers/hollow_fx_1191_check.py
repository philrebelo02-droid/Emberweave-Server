# Hollow spell FX sheets (tests/test_hollow_fx_1191.js; a copy of mirelle_fx_1174_check.py): the key fringe, measured, with CONTROLS.
#   edge = alpha 8..200, body = alpha > 200
#   GREEN plate:   visible green G > max(R,B) + 24; OLIVE = hue 55-150, saturation > 0.20 (plate left in a soft edge and despilled; the art is
#                  blood crimson / void black-violet)
#   MAGENTA plate: visible magenta = min(R,B) - G > 60 with R >= 0.85 B (the plate's hue; the feathers are teal / blue / coral)
#   CONTROL: 35% of the plate mixed back into every edge pixel must read as olive (green sheets) / magenta (the ult)
import sys, os, json
import numpy as np
from PIL import Image


def measure(a):
    a = a.astype(np.float64); al = a[..., 3]; e = (al >= 8) & (al <= 200); b = al > 200
    r, g, bb = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx = np.maximum(np.maximum(r, g), bb); mn = np.minimum(np.minimum(r, g), bb); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - bb) / d) % 6, np.where(mx == g, (bb - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, d / (mx + 1e-9), 0)
    olive = (h >= 55) & (h <= 150) & (s > 0.20) & (mx > 0.08)
    green = a[..., 1] > np.maximum(a[..., 0], a[..., 2]) + 24
    mag = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1] > 60) & (a[..., 0] >= 0.85 * a[..., 2])
    pc = lambda m, z: round(100.0 * float((m & z).sum()) / max(1, int(z.sum())), 4)
    return dict(edge=int(e.sum()), green_edge=pc(green, e), green_body=pc(green, b), olive_edge=pc(olive, e), olive_body=pc(olive, b), magenta_edge=pc(mag, e), magenta_body=pc(mag, b))


def mixed(a, plate, despill):
    c = a.astype(np.float64).copy(); e = (c[..., 3] >= 8) & (c[..., 3] <= 200)
    for k, p in enumerate(plate): c[..., k] = np.where(e, 0.65 * c[..., k] + 0.35 * p, c[..., k])
    if despill: c[..., 1] = np.where(e, np.minimum(c[..., 1], np.maximum(c[..., 0], c[..., 2])), c[..., 1])
    return np.clip(np.round(c), 0, 255).astype(np.uint8)


out = {}
for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGBA'))
    m = measure(a)
    m['control_olive_edge'] = measure(mixed(a, (0.0, 254.0, 0.0), True))['olive_edge']
    m['control_green_edge'] = measure(mixed(a, (0.0, 254.0, 0.0), False))['green_edge']   # the plate left un-despilled reads as visible green
    m['control_magenta_edge'] = measure(mixed(a, (252.0, 0.0, 253.0), False))['magenta_edge']
    m['size'] = list(Image.open(f).size); m['bytes'] = os.path.getsize(f)
    out[os.path.basename(f)] = m
print(json.dumps(out))
