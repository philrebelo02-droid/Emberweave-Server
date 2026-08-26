#!/usr/bin/env python3
"""Slice a Hailuo green-screen mp4 into an Emberweave sprite sheet.

  clip_slice.py <clip.mp4> <key> <state> <outdir> [n] [fps]

- extracts every frame with ffmpeg
- scrubs the MINIMAX/Hailuo watermark (bright pixels in the bottom band)
- chroma-keys + de-spills
- crops to the union bbox of the sampled frames, packs 6 columns
- measures figH / feet / cx from FRAME 0 (the shared start frame), so every state
  of a character lands on the same ground line at the same scale
"""
import sys, os, math, json, subprocess, tempfile, shutil
import numpy as np
from PIL import Image
from scipy import ndimage

GREEN = np.array([16, 163, 68], float)   # #10A344

def key_frame(rgb):
    a = rgb.astype(float); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = np.sqrt(((a - GREEN) ** 2).sum(2))
    al = np.clip((d - 55) / 45, 0, 1)
    spill = (g > r + 34) & (g > b + 34) & (d < 120)
    al = np.where(spill, 0, al)
    al = np.where(al < 0.28, 0, al)
    m = al > 0.4
    lbl, nn = ndimage.label(m)
    if nn > 0:
        sz = ndimage.sum(m, lbl, range(1, nn + 1)); mx = sz.max()
        keep = np.zeros(m.shape, bool)
        for ci in range(1, nn + 1):
            if sz[ci - 1] > max(20, 0.015 * mx): keep |= (lbl == ci)
        body = ndimage.binary_dilation(keep, iterations=2)
        al = np.where(body, al, 0)
    al = ndimage.gaussian_filter(al, 0.5)
    a8 = al * 255.0
    a8 = np.where(a8 <= 22, 0.0, np.where(a8 >= 200, 255.0, 255.0 * ((a8 - 22) / 178.0) ** 0.55))
    al = a8 / 255.0
    fr = (al > 0) & (g > r + 8) & (g > b + 8)
    g2 = np.where(fr, np.maximum(r, b), g)
    return np.dstack([r, g2, b, np.clip(al, 0, 1) * 255]).astype(np.uint8)

def scrub_watermark(im):
    """The Hailuo bug is bright text in the bottom ~110px. Paint it back to chroma."""
    h = im.shape[0]; y0 = int(h * 0.855)
    band = im[y0:].astype(int)
    bright = (band[..., 0] > 150) & (band[..., 1] > 175) & (band[..., 2] > 150)
    bright = ndimage.binary_dilation(bright, iterations=3)
    band[bright] = GREEN.astype(int)
    im[y0:] = band.astype(np.uint8)
    return im

def run(clip, key, state, outdir, n=24, fps=None, trim_head=2, trim_tail=6):
    tmp = tempfile.mkdtemp()
    try:
        subprocess.run(['ffmpeg', '-v', 'error', '-i', clip, os.path.join(tmp, 'f%04d.png'), '-y'], check=True)
        files = sorted(os.listdir(tmp))
        lo, hi = trim_head, len(files) - trim_tail
        idx = [lo + round(i * (hi - 1 - lo) / (n - 1)) for i in range(n)]
        # frame 0 of the source is the reference pose (the uploaded start frame)
        ref_raw = np.array(Image.open(os.path.join(tmp, files[0])).convert('RGB'))
        ref = key_frame(scrub_watermark(ref_raw.copy()))
        cells = [ref] + [key_frame(scrub_watermark(np.array(Image.open(os.path.join(tmp, files[i])).convert('RGB')).copy())) for i in idx]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    def bbox(k, t=40):
        ys, xs = np.where(k[..., 3] > t)
        return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) else None

    bx = [b for b in (bbox(k) for k in cells) if b]
    X0 = min(b[0] for b in bx); Y0 = min(b[1] for b in bx)
    X1 = max(b[2] for b in bx); Y1 = max(b[3] for b in bx)
    pad = 6; W = (X1 - X0) + 2 * pad; H = (Y1 - Y0) + 2 * pad
    cap = 300.0; ds = min(1.0, cap / max(W, H))
    FW = round(W * ds); FH = round(H * ds)

    frames = cells[1:]                       # the reference frame is measurement only
    cols = 6; rows = math.ceil(n / cols)
    sheet = np.zeros((rows * FH, cols * FW, 4), np.uint8)
    for i, s in enumerate(frames):
        cc = np.zeros((H, W, 4), np.uint8)
        src = s[Y0:Y1, X0:X1]
        cc[pad:pad + src.shape[0], pad:pad + src.shape[1]] = src
        cc = np.array(Image.fromarray(cc, 'RGBA').resize((FW, FH), Image.LANCZOS))
        r_, c_ = divmod(i, cols)
        sheet[r_ * FH:(r_ + 1) * FH, c_ * FW:(c_ + 1) * FW] = cc

    rb = bbox(ref, 60)
    ys, xs = np.where(ref[..., 3] > 60)
    figH = int((rb[3] - rb[1]) * ds)
    feet = int(((rb[3] - Y0) + pad) * ds)
    cx = int(((xs.mean() - X0) + pad) * ds)

    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f'{key}_{state}.webp')
    Image.fromarray(sheet, 'RGBA').save(out, 'WEBP', quality=84, method=6)

    if fps is None:
        fps = {'walk': 14, 'attack': 20, 'hit': 16, 'idle': 8}.get(state, 12)
    meta = dict(u=f'/assets/anim/{key}/{key}_{state}.webp?v=1', n=n, fw=FW, fh=FH,
                cols=cols, rows=rows, figH=figH, feet=feet, cx=cx, fps=fps, flip=False)
    if state == 'attack': meta['hold'] = 0.9
    if state in ('green', 'blue', 'cast'): meta['hold'] = 0.8

    # preview gif on the game's grey so the key can be eyeballed
    prev = '/home/claude/emberweave/_clip_prev'; os.makedirs(prev, exist_ok=True)
    grey = np.array([70, 74, 82], np.uint8); gf = []
    for i in range(n):
        c, r = i % cols, i // cols
        cl = sheet[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW].astype(float)
        al = cl[..., 3:4] / 255.
        comp = (cl[..., :3] * al + grey * (1 - al)).astype(np.uint8)
        img = Image.fromarray(comp); img.thumbnail((240, 240)); gf.append(img)
    gf[0].save(os.path.join(prev, f'{key}_{state}.gif'), save_all=True,
               append_images=gf[1:], duration=int(1000 / fps), loop=0)
    return meta, int(os.path.getsize(out) // 1024)


if __name__ == '__main__':
    a = sys.argv
    n = int(a[5]) if len(a) > 5 else 24
    fps = float(a[6]) if len(a) > 6 else None
    meta, kb = run(a[1], a[2], a[3], a[4], n, fps)
    print('META', json.dumps(meta), 'kb', kb)
