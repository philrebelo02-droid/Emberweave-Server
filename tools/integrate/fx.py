"""SPELL FX: a Phil-approved Grok Imagine render (_fx2_accepted/<hero>_<slot>_<name>_<date>.mp4, effect only, 1168x768, 24 fps, plate green or
magenta) -> a game sheet + its FX2_DEF / FX16_ART entries. The v1171 / v1174 route (fx16_cut.py), every knob recorded in the report.

KEY  (per frame, the plate = the median of the four 32x32 corners: Imagine plates drift)
  green   : alpha from the green the pixel LACKS against an art that owns no green: alpha = (kx - ex - 25) / (kx - 25 - EXT), ex = G - max(R,B),
            kx the plate's; or RATIO c (the art's own G is c x its max(R,B)): alpha = (1 - (G - c max(M,0)) / G_plate - 0.03) / 0.97.
            Colour un-mixed (obs = a T + (1-a) plate), G held to max(R,B).
  magenta : RGB distance d0..d1; pink (R, B both above G, R >= 0.7 B) pulled to the art's violet. DEMAG on both; DEVIOL (green plates whose art owns
            no violet: a 4:2:0 violet soft edge gets B pulled to G).
  crop    : the alpha > 8 union + 8 px, or CROP cx,cy,r (a square round the blast, its outer (1-RAMP) ramped); FADE l,r,t,b on frame-edge sides; the
            clip's outer BORDER px dropped (encoder specks).
SHEET : one premultiplied Lanczos per cell, the largest grid within 2048 x 2048; lossless master + WebP q95 (alpha bit-exact), <= 4 MB.
FRINGE: visible green (G > max(R,B) + 24), olive (G >= R > B, warm-green tint) and violet (hue 250-335, s > 0.2) shares of edge / body px.
PLACE (measured on the widest frame; the config may pin any of them):
  ground  -> disc {cx, cy, dw, dh}: the art's centre and the radius holding 95% of its alpha (and the half-alpha radius, for the reviewer);
             the page lays it FLAT (v448 disc rule) with the rim = the kit radius.
  upright -> anchor [x, y] (cell fractions from the left / the bottom): the art's ground contact = the alpha-weighted x of its lowest band, the
             row where 2% of its alpha lies below; size = the cell height in hero heights from `heightOfArt` (the brief's "1.15 x his height").
  fieldWide -> no plate: the kit's fieldWide flag badges each unit it touches (v591); the sheet is the badge.
SPAWN : the cast clip's cell the art appears on (FX2_DEF spawn + FX16_ART st) - default proposal: that state's contact cell (the release).
LIFE  : real time once (rt, fps2 12, dur = n / 12), `fit` to the buff (fade 0.3 s), `hold` [F0, F1] stretched; fadeR for a fade-out tail.
FACING: the art's painted travel (its centroid x over the first half): painted to the right = the page's upright mirroring (_fxMirror) is right;
        painted to the left needs `paint` / a flipped anchor.
"""
import hashlib
import json
import math
import os
import re
import subprocess

import numpy as np
from PIL import Image

from .common import LIMIT, FILE_MAX, parse_spec, log, die, save_json, load_json, num, read_page, write_page, sha256


def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def extract(src, raw):
    os.makedirs(raw, exist_ok=True)
    if len([f for f in os.listdir(raw) if f.endswith('.png')]) == 0:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-fps_mode', 'passthrough', os.path.join(raw, 'f%03d.png')], check=True)
    return len([f for f in os.listdir(raw) if f.endswith('.png')])


def _demag(x):
    x = x.astype(np.float64)
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    p = (np.minimum(r, b) - g > 60) & (r >= 0.85 * b)
    x[..., 0] = np.where(p, g + 0.5 * (b - g), r)
    return x


def _hue_sat(x):
    x = x.astype(np.float64)
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, d / (mx + 1e-9), 0)
    return h, s


def _deviol(x):
    x = x.astype(np.float64)
    h, s = _hue_sat(x)
    p = (h >= 250) & (h <= 335) & (s > 0.2)
    x[..., 2] = np.where(p, np.minimum(x[..., 2], x[..., 1]), x[..., 2])
    return x


def key_frame(raw, f, o):
    a = np.asarray(Image.open(os.path.join(raw, 'f%03d.png' % (f + 1))).convert('RGB')).astype(np.float64)
    P = np.median(np.concatenate([a[:32, :32].reshape(-1, 3), a[:32, -32:].reshape(-1, 3), a[-32:, :32].reshape(-1, 3), a[-32:, -32:].reshape(-1, 3)]), 0)
    d = np.sqrt(((a - P) ** 2).sum(-1))
    al = np.clip((d - o['d0']) / (o['d1'] - o['d0']), 0, 1)
    if o['plate'] == 'green':
        ex = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
        kx = P[1] - max(P[0], P[2])
        if o.get('ratio'):
            c = float(o['ratio'])
            M = np.maximum(a[..., 0], a[..., 2]) - max(P[0], P[2])
            al = np.clip(((1 - (a[..., 1] - c * np.maximum(M, 0)) / max(1, P[1])) - 0.03) / 0.97, 0, 1)
        else:
            al = np.clip((kx - ex - 25) / max(1, kx - 25 - o['ext']), 0, 1)
    fg = np.clip((a - (1 - al[..., None]) * P) / np.maximum(al[..., None], 1e-3), 0, 255)
    if o['plate'] == 'green':
        fg[..., 1] = np.minimum(fg[..., 1], np.maximum(fg[..., 0], fg[..., 2]))
    else:
        r, g, b = fg[..., 0], fg[..., 1], fg[..., 2]
        pink = (r > g + 12) & (b > g + 12) & (r >= 0.7 * b)
        fg[..., 0] = np.where(pink, np.minimum(r, g + 0.55 * (b - g)), r)
    fg = _demag(fg)
    if o.get('deviol'):
        fg = _deviol(fg)
    a8 = np.round(al * 255)
    a8[a8 < 4] = 0
    B, FADE = o['border'], o['fade']
    if B:
        if not FADE[0]:
            a8[:, :B] = 0
        if not FADE[1]:
            a8[:, -B:] = 0
        if not FADE[2]:
            a8[:B, :] = 0
        if not FADE[3]:
            a8[-B:, :] = 0
    out = np.dstack([fg, a8])
    out[a8 == 0, :3] = 0
    return out, P


def fringe_fx(a):
    a = a.astype(int)
    al = a[..., 3]
    e = (al >= 8) & (al <= 200)
    body = al > 200
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = g - np.maximum(r, b) > 24
    olive = (g >= r) & (r > b + 12) & (g > b + 24)
    h, s = _hue_sat(a[..., :3])
    viol = (h >= 250) & (h <= 335) & (s > 0.2)
    pc = lambda m, w: round(100 * float((m & w).sum()) / max(1, int(w.sum())), 4)
    return dict(edge_px=int(e.sum()), green_edge=pc(green, e), green_body=pc(green, body), olive_edge=pc(olive, e), olive_body=pc(olive, body), violet_edge=pc(viol, e), violet_body=pc(viol, body))


def cut_fx(raw, out, master, o):
    frames = parse_spec(o['frames'])
    n = len(frames)
    K, plates = {}, {}
    for f in sorted(set(frames)):
        K[f], plates[f] = key_frame(raw, f, o)
    H, Wd = K[frames[0]].shape[:2]
    m = np.zeros((H, Wd), bool)
    for f in K:
        m |= K[f][..., 3] > 8
    ys, xs = np.where(m)
    X0, Y0, X1, Y1 = max(0, xs.min() - 8), max(0, ys.min() - 8), min(Wd, xs.max() + 9), min(H, ys.max() + 9)
    RAD = None
    if o.get('crop'):
        ccx, ccy, cr = [float(v) for v in o['crop']]
        X0, Y0, X1, Y1 = int(max(0, ccx - cr)), int(max(0, ccy - cr)), int(min(Wd, ccx + cr)), int(min(H, ccy + cr))
        yy, xx = np.mgrid[Y0:Y1, X0:X1]
        rr = np.hypot(xx - ccx, yy - ccy)
        r0 = float(o.get('ramp', 0.8)) * cr
        RAD = np.clip((cr - rr) / (cr - r0), 0, 1)
    Wc, Hc = X1 - X0, Y1 - Y0
    ramp = np.ones((Hc, Wc)) if RAD is None else RAD.copy()
    for side, px in zip('lrtb', o['fade']):
        if not px:
            continue
        t = np.clip(np.arange(px) / px, 0, 1)
        if side == 'l':
            ramp[:, :px] *= t[None, :]
        if side == 'r':
            ramp[:, -px:] *= t[::-1][None, :]
        if side == 't':
            ramp[:px, :] *= t[:, None]
        if side == 'b':
            ramp[-px:, :] *= t[::-1][:, None]
    best = None
    for cols in range(1, n + 1):
        rows = math.ceil(n / cols)
        S = min(1.0, LIMIT / (cols * Wc), LIMIT / (rows * Hc))
        FW, FH = math.floor(Wc * S), math.floor(Hc * S)
        k = (FW * FH, -(cols * rows - n))
        if best is None or k > best[0]:
            best = (k, cols, rows, FW, FH)
    _, C, R, FW, FH = best
    G = np.zeros((R * FH, C * FW, 4), np.uint8)
    cache = {}
    for i, f in enumerate(frames):
        if f not in cache:
            c = K[f][Y0:Y1, X0:X1].copy()
            c[..., 3] = np.round(c[..., 3] * ramp)
            cell = c / 255.0
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
            if o['plate'] == 'green':
                px[..., 1] = np.minimum(px[..., 1], np.maximum(px[..., 0], px[..., 2]))
            px[..., :3] = np.clip(np.round(_deviol(_demag(px[..., :3])) if o.get('deviol') else _demag(px[..., :3])), 0, 255).astype(np.uint8)
            px[px[..., 3] == 0, :3] = 0
            cache[f] = px
        r, c = divmod(i, C)
        G[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW] = cache[f]
    os.makedirs(os.path.dirname(master), exist_ok=True)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    Image.fromarray(G, 'RGBA').save(master, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    assert (np.asarray(Image.open(master).convert('RGBA')) == G).all()
    Image.fromarray(G, 'RGBA').save(out, 'WEBP', quality=95, method=6, alpha_quality=100, exact=False)
    q = np.asarray(Image.open(out).convert('RGBA'))
    assert (q[..., 3] == G[..., 3]).all(), 'q95 alpha not bit-exact'
    assert os.path.getsize(out) <= FILE_MAX and C * FW <= LIMIT and R * FH <= LIMIT
    marg = []
    for i in range(n):
        r, c = divmod(i, C)
        a = G[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW, 3]
        yy, xx = np.where(a > 0)
        marg.append(int(min(xx.min(), yy.min(), FW - 1 - xx.max(), FH - 1 - yy.max())) if len(xx) else 999)
    return G, dict(n=n, frames=frames, box=[int(X0), int(Y0), int(X1), int(Y1)], src=[Wd, H], fw=FW, fh=FH, cols=C, rows=R, sheet=[C * FW, R * FH],
                   scale=round(FW / Wc, 5), bytes=os.path.getsize(out), master_bytes=os.path.getsize(master), min_margin=min(marg),
                   empty_cells=[i for i, x in enumerate(marg) if x == 999], plate0=[round(v, 1) for v in plates[frames[0]]],
                   fringe_master=fringe_fx(G), fringe_q95=fringe_fx(q))


def _cell(G, rep, i):
    r, c = divmod(i, rep['cols'])
    return G[r * rep['fh']:(r + 1) * rep['fh'], c * rep['fw']:(c + 1) * rep['fw']]


def place(G, rep, o):
    """placement numbers from the sheet itself (cell px / fractions)."""
    n = rep['n']
    areas = [float((_cell(G, rep, i)[..., 3] > 32).sum()) for i in range(n)]
    wi = int(np.argmax(areas))
    A = _cell(G, rep, wi)[..., 3].astype(np.float64) / 255
    fw, fh = rep['fw'], rep['fh']
    yy, xx = np.mgrid[0:fh, 0:fw]
    tot = A.sum() + 1e-9
    cx, cy = float((A * xx).sum() / tot), float((A * yy).sum() / tot)
    out = dict(widest_cell=wi, centre=[round(cx / fw, 4), round(cy / fh, 4)])
    # ground: the radius holding 95% of the alpha (in an ellipse with the cell's aspect: painted in perspective) and the half-alpha radius
    asp = (fh / fw) if o.get('perspective') else 1.0
    rr = np.hypot(xx - cx, (yy - cy) / max(asp, 1e-6))
    order = np.argsort(rr.ravel())
    cum = np.cumsum(A.ravel()[order]) / tot
    r95 = float(rr.ravel()[order][np.searchsorted(cum, 0.95)])
    rb = np.arange(0, int(rr.max()) + 1)
    ring = [A[(rr >= r) & (rr < r + 1)].mean() if ((rr >= r) & (rr < r + 1)).any() else 0 for r in rb]
    peak = float(max(ring))
    half = next((float(r) for r, v in zip(rb, ring) if r > int(np.argmax(ring)) and v < 0.5 * peak), r95)
    out['disc'] = dict(cx=round(cx / fw, 4), cy=round(cy / fh, 4), dw=round(2 * r95 / fw, 4), dh=round(2 * r95 * asp / fh, 4), r95_px=round(r95, 1), r_half_px=round(half, 1))
    # upright: the ground contact (the lowest band's alpha-weighted x; the row with 2% of the alpha below it), the art's height share
    rows = A.sum(1)
    cr = np.cumsum(rows[::-1]) / tot
    yb = fh - 1 - int(np.searchsorted(cr, 0.02))
    band = A[max(0, yb - max(2, fh // 25)):yb + 1]
    bx = float((band * xx[:band.shape[0]]).sum() / (band.sum() + 1e-9))
    ytop = int(np.argmax(np.cumsum(rows) / tot > 0.02))
    out['anchor'] = [round(bx / fw, 4), round(1 - yb / fh, 4)]
    out['art_height_frac'] = round((yb - ytop) / fh, 4)
    if o.get('heightOfArt'):
        out['size'] = round(float(o['heightOfArt']) / max(out['art_height_frac'], 1e-6), 4)
    # facing: the alpha centroid's x travel over the first half of the clip
    xs = []
    for i in range(0, max(2, n // 2)):
        a = _cell(G, rep, i)[..., 3].astype(np.float64)
        if a.sum() > 0:
            xs.append(float((a * xx).sum() / a.sum()))
    drift = (xs[-1] - xs[0]) / fw if len(xs) > 1 else 0
    out['facing'] = dict(drift=round(drift, 4), painted='right' if drift > 0.03 else 'left' if drift < -0.03 else 'none')
    return out


FX16_MODES = {'ground': 'disc', 'aim': 'aim', 'claws': 'claws', 'upright': 'puff', 'fit': 'fit', 'hold': 'hold', 'ally': 'ally', 'over': 'over'}


def fx2_entry(e, rep, pl, ver):
    """the FX2_DEF line, in the v1171 / v1174 field order."""
    o = dict(u='/assets/anim/fx/%s.webp?v=%s' % (e['file'], ver), n=rep['n'], fw=rep['fw'], fh=rep['fh'], cols=rep['cols'], rows=rep['rows'])
    life = e.get('life', {'mode': 'real'})
    o['dur'] = round(rep['n'] / life.get('fps2', 12), 4)
    o['rt'] = True
    if life.get('mode', 'real') == 'real':
        o['fps2'] = life.get('fps2', 12)
    sp = e.get('show') or {}
    if sp.get('cell') is not None:
        o['spawn'] = sp['cell']
    plc = e.get('placement', 'ground')
    if plc in ('ground', 'aim'):
        d = e.get('disc') or pl['disc']
        o['disc'] = dict(cx=d['cx'], cy=d['cy'], dw=d['dw'], dh=d['dh'])
    elif plc in ('upright', 'fit', 'hold', 'ally', 'over', 'claws'):
        o['anchor'] = e.get('anchor') or pl['anchor']
        o['size'] = e.get('size') or pl.get('size') or 1.0
    if life.get('mode') == 'fit':
        o['fade'] = life.get('fade', 0.3)
    if life.get('mode') == 'hold':
        o['hold'] = life['hold']
        o['fade'] = life.get('fade', 24)
    if life.get('fadeR'):
        o['fadeR'] = life['fadeR']
    for k, v in (e.get('extra') or {}).items():
        o[k] = v
    return o


def js(v):
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, str):
        return "'%s'" % v
    if isinstance(v, list):
        return '[' + ','.join(js(x) for x in v) + ']'
    if isinstance(v, dict):
        return '{' + ','.join('%s:%s' % (k, js(x)) for k, x in v.items()) + '}'
    return num(v)


def _close(s, a):
    """index of the brace closing the object opened just before s[a] (skips strings and /* */ comments)."""
    d, i, q = 1, a, None
    while i < len(s):
        c = s[i]
        if q:
            if c == chr(92):   # a backslash escapes the next character
                i += 2
                continue
            if c == q:
                q = None
        elif s.startswith('/*', i):
            i = s.index('*/', i) + 2
            continue
        elif c in '\'"`':
            q = c
        elif c == '{':
            d += 1
        elif c == '}':
            d -= 1
            if d == 0:
                return i
        i += 1
    die('unbalanced braces')


def kit_tag(s, hero, slot, key, val):
    """set key:val on KITS.<hero>.<green|blue> (or HERO_ULT_ART.<hero> for the ult) - the display tag the FX16 painter / the v591 badge path reads."""
    if slot == 'ult':
        i = s.index('const HERO_ULT_ART={')
        m = re.compile(r'[{ ,]%s:\{' % re.escape(hero)).search(s, i)
        if not m or m.start() > s.index('\n', i):
            die("HERO_ULT_ART.%s not found - add the hero's ult art entry by hand" % hero)
        a = m.end()
    else:
        i = s.index('const KITS={')
        m = re.compile(r'\n[ \t]+%s:\{' % re.escape(hero)).search(s, i)
        if not m:
            die('KITS.%s not found' % hero)
        end = _close(s, m.end())
        m2 = re.compile(r'\b%s:\{' % slot).search(s, m.end(), end)
        if not m2:
            die('KITS.%s.%s not found' % (hero, slot))
        a = m2.end()
    close = _close(s, a)
    body = s[a:close]
    tag = '%s:%s' % (key, js(val))
    mk = re.search(r"(?<![\w.])%s:('[^']*'|[^,}\s]*)" % key, body)
    if mk:
        return s[:a] + body[:mk.start()] + tag + body[mk.end():] + s[close:]
    return s[:a] + tag + ',' + s[a:]


def stage(cfg_path, stage_name, tree=None, only=None):
    C = load_json(cfg_path)
    hero, ver = C['hero'], str(C['version'])
    work = C.get('work') or os.path.join(r'C:\Users\Home\Downloads\ew-sweep\integrate', '%s-fx-%s' % (hero, ver))
    os.makedirs(work, exist_ok=True)
    runp = os.path.join(work, 'fx_run.json')
    R = load_json(runp, {})
    log(work, '== fx %s %s v%s' % (stage_name, hero, ver))
    src_root = C.get('srcRoot', os.path.join(os.environ.get('EW_ARCHIVE', r'C:\Users\Home\OneDrive\Desktop\Emberweave Archive'), 'Game Art', '_fx2_accepted'))
    for e in C['fx']:
        if only and e['name'] not in only:
            continue
        name = e['name']
        src = e['src'] if os.path.isabs(e['src']) else os.path.join(src_root, e['src'])
        r = R.setdefault(name, {})
        if stage_name in ('verify', 'all'):
            if not os.path.exists(src):
                die('%s: no source %s' % (name, src))
            r['src'] = src
            r['sha256'] = sha256(src)
            r['md5'] = md5(src)
            if e.get('md5') and not r['md5'].startswith(e['md5']):
                die('%s: md5 %s is not the approved %s' % (name, r['md5'][:8], e['md5']))
            log(work, 'fx verify %-12s md5 %s sha256 %s' % (name, r['md5'][:8], r['sha256'][:12]))
        if stage_name in ('cut', 'all'):
            raw = os.path.join(work, 'raw', name)
            nf = extract(src, raw)
            o = dict(plate=e.get('plate', 'green'), d0=e.get('d0', 40.0), d1=e.get('d1', 150.0), ext=e.get('ext', -30.0), ratio=e.get('ratio'), deviol=e.get('deviol', False),
                     crop=e.get('crop'), ramp=e.get('ramp', 0.8), fade=e.get('fadeEdges', [0, 0, 0, 0]), border=e.get('border', 12), frames=e.get('frames', '0:%d:2' % nf),
                     perspective=e.get('perspective', False), heightOfArt=e.get('heightOfArt'))
            out = os.path.join(work, 'sheets', '%s.webp' % e['file'])
            master = os.path.join(work, 'masters', '%s_lossless.webp' % e['file'])
            G, rep = cut_fx(raw, out, master, o)
            rep['knobs'] = {k: v for k, v in o.items() if k != 'frames'}
            rep['place'] = place(G, rep, o)
            r['cut'] = rep
            fm, fq = rep['fringe_master'], rep['fringe_q95']
            log(work, 'fx cut %-12s n %d grid %dx%d sheet %dx%d %.2f MB  visible green q95 %.4f%%  olive edge %.3f%%  violet edge %.3f%% body %.3f%%' % (
                name, rep['n'], rep['cols'], rep['rows'], rep['sheet'][0], rep['sheet'][1], rep['bytes'] / 1e6, fq['green_edge'], fq['olive_edge'], fq['violet_edge'], fq['violet_body']))
            log(work, 'fx place %-12s %s' % (name, json.dumps(rep['place'])))
            if fq['green_edge'] > 0.005 or fq['green_body'] > 0:
                log(work, 'fx PROBLEM %s: visible green left (plate in the colour)' % name)
        if stage_name in ('wire', 'all') and tree:
            rep = r.get('cut') or die('cut %s first' % name)
            o = fx2_entry(e, rep, rep['place'], ver)
            line = '  %s:%s,' % (e['key'], js(o))
            note = e.get('pageNote') or ('v%s %s (Grok, Phil approved; %s md5 %s, %s plate): clip frames %s; %s; shows on %s cell %s.' % (
                ver, e.get('title', name), os.path.basename(r['src']), r['md5'][:8], e.get('plate', 'green').upper(), e.get('frames', 'all'),
                e.get('placement', 'ground'), (e.get('show') or {}).get('state'), (e.get('show') or {}).get('cell')))
            s = read_page(tree)
            m = re.search(r'\r\n  %s:\{[^\r\n]*' % re.escape(e['key']), s[s.index('FX2_DEF'):])
            full = line + '   /* ' + note + ' */'
            if m:
                a0 = s.index('FX2_DEF') + m.start() + 2
                s = s[:a0] + full + s[a0 + len(m.group(0)) - 2:]
            else:
                die('%s: FX2_DEF.%s not found - add a new key by hand once (the page needs its painter path)' % (name, e['key']))
            if e.get('ownFx'):
                mode = FX16_MODES[e.get('placement', 'ground')] if e.get('placement') != 'fieldWide' else None
                if mode:
                    ent = "%s:{k:'%s',st:'%s',mode:'%s'%s}" % (e['ownFx'], e['key'], (e.get('show') or {}).get('state', 'green'), mode, ',atRelease:true' if e.get('atRelease') else '')
                    i = s.index('const FX16_ART={')
                    j = s.index('};', i)
                    blk = s[i:j]
                    if re.search(r'\b%s:\{' % re.escape(e['ownFx']), blk):
                        blk2 = re.sub(r'\b%s:\{[^}]*\}' % re.escape(e['ownFx']), ent, blk)
                    else:
                        blk2 = blk + ',\r\n  ' + ent
                    s = s[:i] + blk2 + s[j:]
            slot = (e.get('show') or {}).get('state')
            if e.get('ownFx') and slot:
                s = kit_tag(s, hero, slot, 'ownFx', e['ownFx'])
            if e.get('placement') == 'fieldWide' and slot:
                s = kit_tag(s, hero, slot, 'fieldWide', e.get('fieldWide', 'enemies'))
            write_page(tree, s)
            r['wire'] = dict(line=line, fx16=e.get('ownFx'))
            log(work, 'fx wire %s' % line[:300])
        save_json(runp, R)
    return R
