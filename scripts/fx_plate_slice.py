#!/usr/bin/env python3
"""Slice a BLACK-background Hailuo FX plate into an Emberweave FX2 sheet.

  fx_plate_slice.py <clip.mp4> <name> <n> <cols> <cell> <dur>

Black plates key by luminance, not chroma: alpha = brightness, colour left intact.
That gives glow FX a soft additive-looking edge with no green fringe to de-spill.
"""
import sys, os, math, json, subprocess, tempfile, shutil
import numpy as np
from PIL import Image
from scipy import ndimage

OUT = '/home/claude/emberweave/repo2/assets/anim/fx'
PREV = '/home/claude/emberweave/_clip_prev'

def key_luma(rgb):
    a = rgb.astype(float)
    lum = 0.30 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    al = np.clip((lum - 14) / 90.0, 0, 1) ** 0.72     # lift the faint glow, keep the core solid
    al = ndimage.gaussian_filter(al, 0.6)
    # push the colour back up so the glow doesn't read grey once it's premultiplied away
    mx = a.max(2, keepdims=True)
    col = np.where(mx > 6, a * (255.0 / np.maximum(mx, 1)) * 0.55 + a * 0.45, a)
    return np.dstack([np.clip(col, 0, 255), np.clip(al, 0, 1) * 255]).astype(np.uint8)

def scrub_watermark(im):
    h = im.shape[0]; y0 = int(h * 0.855)
    band = im[y0:].astype(int)
    band[:] = 0                                        # black plate: the whole strip is watermark
    im[y0:] = band.astype(np.uint8)
    return im

def run(clip, name, n=18, cols=6, cell=200, dur=None, trim_head=2, trim_tail=4):
    tmp = tempfile.mkdtemp()
    try:
        subprocess.run(['ffmpeg', '-v', 'error', '-i', clip, os.path.join(tmp, 'f%04d.png'), '-y'], check=True)
        files = sorted(os.listdir(tmp))
        lo, hi = trim_head, len(files) - trim_tail
        idx = [lo + round(i * (hi - 1 - lo) / (n - 1)) for i in range(n)]
        cells = [key_luma(scrub_watermark(np.array(Image.open(os.path.join(tmp, files[i])).convert('RGB')).copy()))
                 for i in idx]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    def bbox(k, t=18):
        ys, xs = np.where(k[..., 3] > t)
        return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) else None
    bx = [b for b in (bbox(k) for k in cells) if b]
    X0 = min(b[0] for b in bx); Y0 = min(b[1] for b in bx)
    X1 = max(b[2] for b in bx); Y1 = max(b[3] for b in bx)
    pad = 8; W = (X1 - X0) + 2 * pad; H = (Y1 - Y0) + 2 * pad
    rows = math.ceil(n / cols)
    FW = FH = cell
    sheet = np.zeros((rows * FH, cols * FW, 4), np.uint8)
    for i, s in enumerate(cells):
        cc = np.zeros((max(W, H), max(W, H), 4), np.uint8)      # square-pad so the cell stays 1:1
        oy = (cc.shape[0] - H) // 2; ox = (cc.shape[1] - W) // 2
        src = s[Y0:Y1, X0:X1]
        cc[oy + pad:oy + pad + src.shape[0], ox + pad:ox + pad + src.shape[1]] = src
        cc = np.array(Image.fromarray(cc, 'RGBA').resize((FW, FH), Image.LANCZOS))
        r_, c_ = divmod(i, cols)
        sheet[r_ * FH:(r_ + 1) * FH, c_ * FW:(c_ + 1) * FW] = cc

    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f'{name}.webp')
    Image.fromarray(sheet, 'RGBA').save(p, 'WEBP', quality=84, method=6)
    if dur is None: dur = round(n / 12.0, 2)
    meta = dict(u=f'/assets/anim/fx/{name}.webp?v=1', n=n, fw=FW, fh=FH, cols=cols, rows=rows, dur=dur)

    os.makedirs(PREV, exist_ok=True)
    grey = np.array([70, 74, 82], np.uint8); gf = []
    for i in range(n):
        c, r = i % cols, i // cols
        cl = sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW].astype(float)
        al = cl[..., 3:4] / 255.
        comp = (cl[..., :3] * al + grey * (1 - al)).astype(np.uint8)
        gf.append(Image.fromarray(comp))
    gf[0].save(os.path.join(PREV, f'{name}.gif'), save_all=True, append_images=gf[1:],
               duration=int(1000 * dur / n), loop=0)
    return meta, int(os.path.getsize(p) // 1024)

if __name__ == '__main__':
    a = sys.argv
    meta, kb = run(a[1], a[2], int(a[3]) if len(a) > 3 else 18, int(a[4]) if len(a) > 4 else 6,
                   int(a[5]) if len(a) > 5 else 200, float(a[6]) if len(a) > 6 else None)
    print('META', json.dumps(meta), 'kb', kb)
