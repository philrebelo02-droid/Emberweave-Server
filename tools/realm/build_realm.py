#!/usr/bin/env python3
"""Emberweave realm map swap - one repeatable build from a Grok realm version folder.

Phil, 30 Oct 2026: "for now we take what grok has and swap out world anvil. Also put this map in game. Swap out the old one."
                   "We will keep swapping it when he makes big leaps in progress"
So every new Grok realm version is ONE re-run of this script plus a look, never a rebuild by hand.

    python -I tools/realm/build_realm.py --src "<Archive>/Game Art/EMBERWEAVE MAP FINAL/EXPANSION 25OCT2026" --version v13
        [--out "<Archive>/Game Art/EMBERWEAVE MAP FINAL/IN GAME/realm-v13"]   (default: that path)
        [--install <game worktree>]     copy the built files into the game, byte-identical, backing up what they replace
        [--allow-dev-fill]              v12 only: fill master tiles missing on this PC from the composite preview (DEV, never ships)
        [--max-scale 0.5]               deepest pyramid level as a fraction of the master (0.5 = half the master pixels)

What it does, in order (every stage writes into --out, the Archive copy; --install then copies those exact bytes):
  1. reads   REALM layout <v> positions.json, REALM composite preview <v>.jpg, REALM <v> master tiles part*.zip
  2. grid    GRID_COLS x GRID_ROWS square cells (1000 x 596 since v1227; 220 x 220 before) over the 0..100 % world space:
             the columns span the realm's width, cropped left/right so the World Tree trunk lands exactly on the world
             centre (x = 50 %), and the rows span the realm art's own height (not the sea margin above and below it)
  3. tree    the baked tree is replaced by the tree-free island (WorldTree A2 landsize oases tight.png), so the in-game
             tree can be drawn per cycle state from the Phil-approved frames (05 World Tree/frames/wt_NN.png)
  4. tiles   a zoom pyramid of 512 px WebP tiles (z1 = max-scale, z2 = half that, ...) + one cover picture
  5. mask    land/sea per cell from the pyramid itself (saturated blue/turquoise water, as Grok's landalpha)
  6. zones   the 4 largest land masses = the 4 home regions (by quadrant), the island under the tree = worldtree,
             every other islet = wild N/S/E/W by its direction from the tree; sea + off-realm cells are blocked,
             and so is every city square (> 30 % of it covered by the city overlay alpha)
  7. oases   the 4 ponds Grok painted on the World Tree island ARE the oases (v1228): each measured from the z2 pixels (flood fill
             from a seed inside the pond), its cells island land, blocked like a city square, a garrison site like the cities
  8. data    world-realm.js (shared client/server module), world-terrain-blocked.json, world-oasis-layout.json,
             realm.json (manifest with sha256 of every file), previews for the look
World Anvil: tools/realm/worldanvil_map.py.  Castle relocation check: node tools/realm/relocation_check.js.
"""
import argparse, glob, hashlib, io, json, math, os, re, shutil, sys, tempfile, time, zipfile
import numpy as np
import cv2
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ARCHIVE = r'C:\Users\Home\OneDrive\Desktop\Emberweave Archive'
MAP_FINAL = os.path.join(ARCHIVE, 'Game Art', 'EMBERWEAVE MAP FINAL')
TO_DELETE = r'C:\Emberweave\_to_delete'
# THE GRID: these two numbers are the whole grid of the game. The client and the server read them from world-realm.js META
# (cols, rows), which this build writes; change them (or pass --cols / --rows) and re-run the build, nothing else.
# v1227 (Phil 30 Oct 2026: "The tiles need to be roughly 2x smaller. Basically cut these tiles in 1/4. Then fix the zoom to that
# level." then "about 1000 wide by about 600 tall", the realm's own shape): 1000 columns; 596 rows = the art's height at that width
# (20400 / (34229.5 / 1000)). --rows 0 derives the rows from --cols.
# v1229 (Phil 30 Oct 2026: "Tiles are too small, please make the map like 800x 500 instead"): 800 columns; 477 rows = the art's height
# at that width (20400 / (34229.5 / 800) = 476.8, rounded up so the rows cover the art).
GRID_COLS = 800
GRID_ROWS = 477
COLS, ROWS = GRID_COLS, GRID_ROWS
OLD_COLS = 220             # the grid the castle, the World Tree core, the oases and the mine bands were first sized on: their world
                           # size never changes, so each is measured in 220-grid squares (sq() grid squares each)
TILE = 512
WEBP_Q = 92
TREE_FRAMES = 28
REGION_BY_QUADRANT = {(-1, -1): 'crystor', (1, -1): 'draymon', (-1, 1): 'tefron', (1, 1): 'alumron'}
ZONE_CODE = {'crystor': 'A', 'draymon': 'B', 'tefron': 'C', 'alumron': 'D', 'worldtree': 'T',
             'wildN': 'n', 'wildS': 's', 'wildE': 'e', 'wildW': 'w'}
# v1228 (Phil 30 Oct 2026: "There of 2 of each oasis" / "The drawn one should be garrisonable like the cities"): the oases are the 4 ponds
# Grok painted on the island (diagonals of the tree). A seed inside each pond in world-percent (grid-free) and the flood-fill colour range
# that follows that pond's own water without leaking into the grass rim (checked on PREVIEW ponds <v>.jpg).
POND_SEEDS = {'nw': (44.54, 46.72, 44), 'ne': (55.35, 46.19, 15), 'sw': (45.15, 52.06, 44), 'se': (54.83, 52.32, 44)}   # x %, y %, range
POND_NAMES = {'nw': 'North-west Oasis', 'ne': 'North-east Oasis', 'sw': 'South-west Oasis', 'se': 'South-east Oasis'}


def measure_ponds(files, level, X0_unused, grid_top, top_cells, cpx_unused, out, v):
    """Each painted pond's cells (>= 50 % pond pixels) on the grid, from the level's own tiles around the island."""
    cp = level['cellPx']; off = grid_top - top_cells
    res = {}; sheet = []
    for key, (sxp, syp, tol) in POND_SEEDS.items():
        scx, scy = sxp / 100 * COLS, (syp / 100 * COLS) - grid_top          # seed in cells
        bx0, by0, bx1, by1 = int(scx) - 30, int(scy) - 30, int(scx) + 30, int(scy) + 30
        px0, py0 = int(round(bx0 * cp)), int(round((by0 + off) * cp)); px1, py1 = int(round(bx1 * cp)), int(round((by1 + off) * cp))
        im = Image.new('RGB', (px1 - px0, py1 - py0))
        for r in range(max(0, py0 // TILE), py1 // TILE + 1):
            for c in range(max(0, px0 // TILE), px1 // TILE + 1):
                k = 'tiles/z%d/r%02dc%02d.webp' % (level['z'], r, c)
                if k in files and os.path.exists(files[k]):
                    im.paste(Image.open(files[k]).convert('RGB'), (c * TILE - px0, r * TILE - py0))
        a = cv2.GaussianBlur(np.asarray(im), (0, 0), 3)
        sx, sy = int((scx - bx0) * cp), int((scy - by0) * cp)
        m = np.zeros((a.shape[0] + 2, a.shape[1] + 2), np.uint8)
        cv2.floodFill(a.copy(), m, (sx, sy), (0, 0, 0), (tol,) * 3, (tol,) * 3, 4 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8))
        mk = m[1:-1, 1:-1] > 0
        mk = cv2.morphologyEx(mk.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))) > 0
        inv = mk.astype(np.uint8) * 255; m2 = np.zeros((inv.shape[0] + 2, inv.shape[1] + 2), np.uint8); cv2.floodFill(inv, m2, (0, 0), 255); mk = mk | (inv == 0)
        if mk[0].any() or mk[-1].any() or mk[:, 0].any() or mk[:, -1].any():
            sys.exit('pond %s leaks out of its 60-cell window: lower its colour range' % key)
        cells = []
        for cy in range(by0, by1):
            for cx in range(bx0, bx1):
                ax0, ay0 = int(round((cx - bx0) * cp)), int(round((cy - by0) * cp)); ax1, ay1 = int(round((cx - bx0 + 1) * cp)), int(round((cy - by0 + 1) * cp))
                if mk[ay0:ay1, ax0:ax1].mean() >= 0.5:
                    cells.append([cx, cy])
        ys, xs = np.nonzero(mk)
        res[key] = {'cells': cells, 'cx': round(bx0 + xs.mean() / cp, 2), 'cy': round(by0 + ys.mean() / cp, 2)}
        vis = np.asarray(im).copy(); vis[mk] = (vis[mk] * 0.45 + np.array([255, 0, 255]) * 0.55).astype(np.uint8)
        sheet.append(Image.fromarray(vis).resize((360, 360)))
    S = Image.new('RGB', (360 * len(sheet), 360))
    for i, t in enumerate(sheet):
        S.paste(t, (i * 360, 0))
    S.save(os.path.join(out, 'PREVIEW ponds %s.jpg' % v), quality=86)
    return res


def sq():
    """Grid squares per side of one 220-grid square (4.545 at 1000 columns). Things that are not a grid square keep their size."""
    return COLS / OLD_COLS


def even_round(v):
    return max(2, 2 * int(round(v / 2)))


CASTLE_CELLS = 1   # Phil 30 Oct 2026: a castle fits ONE square ("not 4"), drawn inside it (its centre); a mine sits ON an intersection


def foot():
    """Castle side in grid squares (META.foot): 1 - a castle fits one square and stands at the cell centre."""
    return CASTLE_CELLS


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


# ---------------------------------------------------------------- 1. sources
class Master:
    """Random-access reads of the realm master from Grok's 4096 px tiles (zips), with the tree patch applied."""

    def __init__(self, src, version, allow_dev_fill, preview):
        self.realm = None
        self.tiles = {}
        self.tmp = tempfile.mkdtemp(prefix='realm-' + version + '-')
        zips = sorted(glob.glob(os.path.join(src, 'REALM %s master tiles part*.zip' % version)))
        if not zips:
            sys.exit('no "REALM %s master tiles part*.zip" in %s' % (version, src))
        pat = re.compile(r'r(\d+)c(\d+) x(\d+) y(\d+)\.png$')
        for z in zips:
            with zipfile.ZipFile(z) as zf:
                for n in zf.namelist():
                    m = pat.search(n)
                    if not m:
                        continue
                    out = os.path.join(self.tmp, os.path.basename(n))
                    if not os.path.exists(out):
                        with zf.open(n) as fi, open(out, 'wb') as fo:
                            shutil.copyfileobj(fi, fo)
                    r, c, x, y = map(int, m.groups())
                    self.tiles[(r, c)] = (x, y, out)
        self.zips = zips
        self.preview = preview
        self.allow_dev_fill = allow_dev_fill
        self.cache = {}
        self.patches = []   # (x0, y0, rgb float32 HxWx3, alpha HxW, kind)
        self.override = None; self.override_tiles = set()

    def use_master_png(self, path, tiles):
        """v1229: Grok's full-size master PNG for the listed 4096 tiles only (the others are byte-identical to the zips)."""
        log('master: %s for tiles %s' % (os.path.basename(path), ','.join('r%dc%d' % t for t in sorted(tiles))))
        im = Image.open(path).convert('RGB')
        if self.realm and im.size != self.realm:
            sys.exit('%s is %s, the realm is %s' % (path, im.size, self.realm))
        self.override = np.asarray(im); self.override_tiles = set(tiles); self.cache = {}

    def set_realm(self, w, h):
        self.realm = (w, h)
        rows = int(math.ceil(h / 4096)); cols = int(math.ceil(w / 4096))
        self.missing = [(r, c) for r in range(rows) for c in range(cols) if (r, c) not in self.tiles]
        self.dev = bool(self.missing)
        if self.missing and not self.allow_dev_fill:
            sys.exit('master tiles missing on this PC: %s (zip parts %s present). Get every part, or --allow-dev-fill for a DEV build.'
                     % (self.missing, [os.path.basename(z) for z in self.zips]))
        if self.missing:
            log('DEV BUILD: %d of %d master tiles missing, filled from the %dpx preview (soft, never ships): %s'
                % (len(self.missing), rows * cols, self.preview.size[0], self.missing))

    def _tile(self, r, c):
        if (r, c) in self.cache:
            return self.cache[(r, c)]
        if len(self.cache) > 6:
            self.cache.pop(next(iter(self.cache)))
        if (r, c) in self.override_tiles:
            im = self.override[r * 4096:(r + 1) * 4096, c * 4096:(c + 1) * 4096]
        elif (r, c) in self.tiles:
            im = np.asarray(Image.open(self.tiles[(r, c)][2]).convert('RGB'))
        else:
            W, H = self.realm; x0, y0 = c * 4096, r * 4096; w, h = min(4096, W - x0), min(4096, H - y0)
            s = self.preview.size[0] / W
            box = (x0 * s, y0 * s, (x0 + w) * s, (y0 + h) * s)
            im = np.asarray(self.preview.resize((w, h), Image.LANCZOS, box=box))
        self.cache[(r, c)] = im
        return im

    def read(self, x0, y0, x1, y1, cities=True):
        """RGB uint8 of master rect [x0,x1) x [y0,y1); outside the realm is black (never shown: the view is clamped).
        cities=False: the base art under the city overlays (the tree patch still applies)."""
        W, H = self.realm
        out = np.zeros((y1 - y0, x1 - x0, 3), np.uint8)
        for r in range(max(0, y0 // 4096), min((H - 1) // 4096, (y1 - 1) // 4096) + 1):
            for c in range(max(0, x0 // 4096), min((W - 1) // 4096, (x1 - 1) // 4096) + 1):
                t = self._tile(r, c)
                tx0, ty0 = c * 4096, r * 4096
                ax0, ay0 = max(x0, tx0), max(y0, ty0)
                ax1, ay1 = min(x1, tx0 + t.shape[1]), min(y1, ty0 + t.shape[0])
                if ax1 > ax0 and ay1 > ay0:
                    out[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0] = t[ay0 - ty0:ay1 - ty0, ax0 - tx0:ax1 - tx0]
        for px, py, rgb, al, *kind in self.patches:
            if not cities and kind and kind[0] == 'city':
                continue
            ph, pw = al.shape
            ax0, ay0, ax1, ay1 = max(x0, px), max(y0, py), min(x1, px + pw), min(y1, py + ph)
            if ax1 > ax0 and ay1 > ay0:
                dst = out[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0].astype(np.float32)
                a = al[ay0 - py:ay1 - py, ax0 - px:ax1 - px][..., None].astype(np.float32)
                if al.dtype == np.uint8:
                    a = a / 255.0
                src = rgb[ay0 - py:ay1 - py, ax0 - px:ax1 - px].astype(np.float32)
                out[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0] = np.clip(dst * (1 - a) + src * a + 0.5, 0, 255).astype(np.uint8)
        return out


# ---------------------------------------------------------------- 3. the tree
def tree_layout(src, pos):
    """Where the baked tree sits in the realm (px), measured by template-matching the approved frame wt_28."""
    wt = [l for l in pos['layers'] if l['id'] == 'WorldTree'][0]
    k = float(wt.get('display_scale', wt['w'] / wt['source_size'][0]))
    with_tree = os.path.join(src, wt['file'])
    tree_free = os.path.join(src, 'WorldTree A2 landsize oases tight.png')
    if not os.path.exists(tree_free):
        sys.exit('tree-free island missing: ' + tree_free)
    a = Image.open(with_tree).convert('RGB'); b = Image.open(tree_free).convert('RGB')
    if a.size != b.size:
        sys.exit('tree-free island %s is not the same canvas as %s' % (b.size, a.size))
    A = np.asarray(a).astype(np.int16); B = np.asarray(b).astype(np.int16)
    diff = np.abs(A - B).sum(-1) > 30
    ys, xs = np.nonzero(diff)
    if not len(xs):
        sys.exit('the island with the tree and the tree-free island are identical - no baked tree found')
    dbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    frame = Image.open(os.path.join(MAP_FINAL, '05 World Tree', 'frames', 'wt_28.png'))
    q = 4; srcq = cv2.resize(A.astype(np.float32), (A.shape[1] // q, A.shape[0] // q), interpolation=cv2.INTER_AREA)
    best = None
    dcx, dcy = (dbox[0] + dbox[2]) / 2, (dbox[1] + dbox[3]) / 2
    for sc in np.arange(0.80, 1.42, 0.02):
        sz = int(round(frame.size[0] * sc / q)); f = np.asarray(frame.resize((sz, sz), Image.LANCZOS)).astype(np.float32)
        m = (f[..., 3:] > 200).astype(np.float32).repeat(3, 2)
        x0 = int(dcx / q - sz / 2 - 50); y0 = int(dcy / q - sz / 2 - 50)
        reg = srcq[max(0, y0):y0 + sz + 100, max(0, x0):x0 + sz + 100]
        if reg.shape[0] < sz or reg.shape[1] < sz:
            continue
        r = cv2.matchTemplate(reg, f[..., :3], cv2.TM_SQDIFF, mask=m)
        mn, _, loc, _ = cv2.minMaxLoc(r); mn /= m.sum()
        if best is None or mn < best[0]:
            best = (mn, float(sc), (max(0, x0) + loc[0]) * q, (max(0, y0) + loc[1]) * q)
    _, sc, fx, fy = best
    side_src = frame.size[0] * sc
    cx_src, cy_src = fx + side_src / 2, fy + side_src / 2
    return {'layer': wt, 'k': k, 'scale_src': sc, 'rms': round(math.sqrt(best[0]), 1), 'diff_box_src': dbox,
            'centre': (wt['x'] + cx_src * k, wt['y'] + cy_src * k), 'side': side_src * k,
            'tree_free': tree_free, 'layer_file': with_tree}


def tree_patch(master, tl):
    """The tree-free island (resampled exactly as Grok's composite placed the island) over the baked tree ONLY: the alpha is the
    tree's own footprint (where the with-tree and tree-free sources differ, grown 40 px, feathered), and the patch is colour-
    matched to the master's own pixels in a ring just outside it, so a repainted master (v25) shows no seam."""
    wt, k = tl['layer'], tl['k']
    x0s, y0s, x1s, y1s = tl['diff_box_src']
    pad = 160
    x0s, y0s, x1s, y1s = max(0, x0s - pad), max(0, y0s - pad), x1s + pad, y1s + pad
    rx0, ry0 = int(math.floor(wt['x'] + x0s * k)), int(math.floor(wt['y'] + y0s * k))
    rx1, ry1 = int(math.ceil(wt['x'] + x1s * k)), int(math.ceil(wt['y'] + y1s * k))
    W, H = wt['w'], wt['h']
    free = Image.open(tl['tree_free']).convert('RGB').resize((W, H), Image.LANCZOS)
    withtree = Image.open(tl['layer_file']).convert('RGB').resize((W, H), Image.LANCZOS)
    sl = (slice(ry0 - wt['y'], ry1 - wt['y']), slice(rx0 - wt['x'], rx1 - wt['x']))
    rgb = np.asarray(free).astype(np.float32)[sl]
    diff = (np.abs(np.asarray(withtree).astype(np.int16)[sl] - np.asarray(free).astype(np.int16)[sl]).sum(-1) > 30).astype(np.uint8)
    diff = cv2.morphologyEx(diff, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    grow = cv2.dilate(diff, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (81, 81)))
    al = np.clip(cv2.GaussianBlur(grow.astype(np.float32), (0, 0), 14) * 1.6, 0, 1)
    # colour match: the master's own pixels in a ring just outside the footprint vs the patch there
    ring = (cv2.dilate(grow, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (121, 121))) > 0) & (al < 0.02)
    here = master.read(rx0, ry0, rx1, ry1).astype(np.float32)
    # Grok's own tree-free repaint of this version, when he has pushed one: "REALM <v> tree-free patch.png" + ".json" {"topleft_px":[x,y]}
    own = tl.get('own_patch')
    if own:
        oi = np.asarray(Image.open(own[0]).convert('RGB')).astype(np.float32); ox, oy = own[1]
        if ox <= rx0 and oy <= ry0 and ox + oi.shape[1] >= rx1 and oy + oi.shape[0] >= ry1:
            rgb = oi[ry0 - oy:ry1 - oy, rx0 - ox:rx1 - ox].copy(); ring = np.zeros_like(ring)   # his pixels need no colour match
            log('tree: using the own tree-free patch of this version: ' + os.path.basename(own[0]))
        else:
            log('tree: %s does not cover the tree box %s - ignored' % (os.path.basename(own[0]), (rx0, ry0, rx1, ry1)))
    if ring.sum() > 500:
        for ch in range(3):
            m_ = here[..., ch][ring]; p_ = rgb[..., ch][ring]
            sd = p_.std() or 1.0
            rgb[..., ch] = (rgb[..., ch] - p_.mean()) * (m_.std() / sd) + m_.mean()
        rgb = np.clip(rgb, 0, 255)
    master.patches.append((rx0, ry0, rgb.astype(np.float32), al.astype(np.float32)))
    return (rx0, ry0, rx1, ry1)


CITY_FIX_DIRS = ['city overlays mask fix v2 30OCT2026']   # Grok's alpha-only fixes (same placement), newest last


def city_mask_fix(src, name, topleft, size):
    """v1229: the alpha of '<City> overlay 1x_v2.png' (Grok's mask fix: RGB untouched, same placement) when one exists, else None."""
    for d in reversed(CITY_FIX_DIRS):
        f = os.path.join(src, d, '%s overlay 1x_v2.png' % name); pj = os.path.join(src, d, '%s placement_v2.json' % name)
        if not os.path.exists(f):
            continue
        if os.path.exists(pj):
            p = json.load(open(pj))
            if list(p.get('topleft_v25', topleft)) != list(topleft) or list(p.get('size_v25', size)) != list(size):
                sys.exit('%s mask fix: placement %s/%s differs from %s/%s' % (name, p.get('topleft_v25'), p.get('size_v25'), topleft, size))
        im = Image.open(f).convert('RGBA')
        if im.size != tuple(size):
            im = im.resize(tuple(size), Image.LANCZOS)
        log('cities: %s alpha from %s/%s' % (name, d, os.path.basename(f)))
        return np.ascontiguousarray(np.asarray(im)[..., 3])
    return None


def city_patches(master, src, v, pos):
    """Grok's city overlays (RGBA, separate from the master) baked into the in-game tiles at their placements.
    v25: positions.json 'cities_v25' {name: {topleft_px, size_px, overlay_1x, ...}} + 'REALM v25 city overlays.zip'."""
    key = next((k for k in pos if k.startswith('cities') and isinstance(pos[k], dict)), None)
    czip = os.path.join(src, 'REALM %s city overlays.zip' % v)
    if not key or not os.path.exists(czip):
        log('cities: none in this version (no %s / no positions "cities*")' % os.path.basename(czip))
        return []
    out = []
    with zipfile.ZipFile(czip) as zf:
        names = set(zf.namelist())
        for name, c in sorted(pos[key].items()):
            f = c.get('overlay_1x')
            if f not in names:
                sys.exit('city %s: %s not in %s' % (name, f, czip))
            im = Image.open(io.BytesIO(zf.read(f))).convert('RGBA')
            w, h = c['size_px']
            if im.size != (w, h):
                im = im.resize((w, h), Image.LANCZOS)
            arr = np.asarray(im)
            x, y = c['topleft_px']
            fixed = city_mask_fix(src, name, (int(x), int(y)), (w, h))
            if fixed is not None:
                arr = np.dstack([arr[..., :3], fixed])
            master.patches.append((int(x), int(y), np.ascontiguousarray(arr[..., :3]), np.ascontiguousarray(arr[..., 3]), 'city'))
            out.append({'name': name, 'version': c.get('version') if fixed is None else 'mask v2', 'topleftPx': [x, y], 'sizePx': [w, h],
                        'cxPx': x + w / 2, 'cyPx': y + h / 2, 'source': os.path.basename(czip), 'overlay3x': c.get('overlay_3x'),
                        '_alpha': np.ascontiguousarray(arr[..., 3])})
    # further zips in the same format ("REALM <v> new city overlays.zip": one '<City> placement.json' per city with topleft_v25,
    # size_v25, overlay_1x.file). A PROVISIONAL city (in its file name or status) is held back until Grok sends its final file.
    held = []
    # v1231: also 'REALM <v> new city overlays part2.zip' / 'part3.zip' (Ochreth FINAL, Hallowrime, Lanternmere / Skarrow FINAL); sorted, the
    # parts come before the first zip, so a FINAL city is taken before its held PROVISIONAL copy
    for extra in sorted(glob.glob(os.path.join(src, 'REALM %s * city overlays*.zip' % v))):
        with zipfile.ZipFile(extra) as zf:
            for pj in [n for n in zf.namelist() if n.endswith('placement.json')]:
                c = json.loads(zf.read(pj).decode('utf-8'))
                name = c.get('city') or pj.replace(' placement.json', '')
                if 'PROVISIONAL' in pj.upper() or 'PROVISIONAL' in str(c.get('status', '')).upper():
                    held.append(name); continue
                if any(o['name'] == name for o in out):
                    continue
                im = Image.open(io.BytesIO(zf.read(c['overlay_1x']['file']))).convert('RGBA')
                w, h = c['size_v25']
                if im.size != (w, h):
                    im = im.resize((w, h), Image.LANCZOS)
                arr = np.asarray(im); x, y = c['topleft_v25']
                fixed = city_mask_fix(src, name, (int(x), int(y)), (w, h))
                if fixed is not None:
                    arr = np.dstack([arr[..., :3], fixed])
                master.patches.append((int(x), int(y), np.ascontiguousarray(arr[..., :3]), np.ascontiguousarray(arr[..., 3]), 'city'))
                out.append({'name': name, 'version': 'proposal', 'topleftPx': [x, y], 'sizePx': [w, h], 'cxPx': x + w / 2, 'cyPx': y + h / 2,
                            'source': os.path.basename(extra), 'overlay3x': (c.get('overlay_3x') or {}).get('file'), '_alpha': np.ascontiguousarray(arr[..., 3])})
    log('cities: %d overlays baked in (%s)%s' % (len(out), ', '.join(o['name'] for o in out), ('; held (provisional): ' + ', '.join(held)) if held else ''))
    return out


# v1229 (Phil 30 Oct 2026: "Some squares are sneaky and are next to the city"): a square is a city square only when at least half of it
# is the city's SOLID footprint (alpha >= 200, not the soft feathered edge). v1231 (Phil: a lake / stilt-house city "seems this city is
# able to be teleported on"): whatever the base art underneath - v1229's 'not water under it' test dropped every square of a city built
# over water, and inland lake water is land in the zone mask, so those squares became open land.
CITY_COVER = 0.50
CITY_ALPHA = 200


def city_cells(c, X0, top_cells, cpx, master=None):   # top_cells: the grid row at realm y = 0
    """The grid squares a city overlay covers (Phil 30 Oct 2026: "the city should not be able to be teleported onto").
    A square counts when at least CITY_COVER of it is solid overlay (alpha >= CITY_ALPHA)."""
    al = c['_alpha'] >= CITY_ALPHA
    x, y = c['topleftPx']; h, w = al.shape
    cells = []
    for cy in range(int(math.floor(top_cells + y / cpx)), int(math.ceil(top_cells + (y + h) / cpx))):
        for cx in range(int(math.floor((x - X0) / cpx)), int(math.ceil((x + w - X0) / cpx))):
            if not (0 <= cx < COLS and 0 <= cy < ROWS):
                continue
            mx0, my0 = X0 + cx * cpx, (cy - top_cells) * cpx            # the square's box in master px
            ax0, ay0 = int(round(max(mx0, x) - x)), int(round(max(my0, y) - y))
            ax1, ay1 = int(round(min(mx0 + cpx, x + w) - x)), int(round(min(my0 + cpx, y + h) - y))
            if ax1 <= ax0 or ay1 <= ay0:
                continue
            if al[ay0:ay1, ax0:ax1].sum() >= CITY_COVER * cpx * cpx:
                cells.append([cx, cy])
    return cells


# ---------------------------------------------------------------- 5. land / sea
def water_mask(rgb):
    """Grok's landalpha water rule (realm_comp_v12.py): saturated blue/turquoise only, not snow or ice."""
    a = rgb.astype(np.int32); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (((b - r > 18) & (b >= g - 10)) | ((g - r > 25) & (b - r > 25))) & ((r + g + b) < 480) & ((b - r) > 0.18 * b)


def sea_pad(cover, out, files):
    """A seamless open-sea tile from the realm's own outer margin (the top-left corner of the cover, mirrored 2x2), drawn past the
    realm's edges when the whole map is narrower or shorter than the screen (Phil: "Max zoom out should be able to see the full map")."""
    k = 44
    q = cover[3:3 + k, 3:3 + k]
    if water_mask(q).mean() < 0.98:
        sys.exit('sea pad: the cover corner is not open sea')
    t = np.concatenate([np.concatenate([q, q[:, ::-1]], 1), np.concatenate([q[::-1], q[::-1, ::-1]], 1)], 0)
    # v1228 (Phil 30 Oct 2026: "the ingame ocean when you zoom out expanded isnt the same blue as the rest of the ocean"): the corner patch
    # is a little darker than the sea along the realm's left and right edges, where the pad meets it - shift the pad's mean colour to
    # the mean of the open-sea pixels in a 2 % strip at each side edge (texture kept)
    s = max(4, int(cover.shape[1] * 0.02))
    strips = np.concatenate([cover[:, :s].reshape(-1, 3), cover[:, -s:].reshape(-1, 3)], 0)
    strips = strips[water_mask(strips.reshape(-1, 1, 3)).reshape(-1)]
    t = np.clip(t.astype(np.float32) + (strips.astype(np.float32).mean(0) - t.reshape(-1, 3).astype(np.float32).mean(0)) + 0.5, 0, 255).astype(np.uint8)
    p = os.path.join(out, 'sea-pad.webp'); Image.fromarray(np.ascontiguousarray(t)).save(p, 'WEBP', quality=WEBP_Q, method=6); files['sea-pad.webp'] = p


def build_detail2x(folder, src, master, levels, files, X0, out, cities, RW, RH):
    """v1231 (Phil: "you didnt add groks art?"): a SPARSE z0 level at 2x the master (scale 2.0) from Grok's detail2x tiles, only where
    a 512 px z0 tile lies wholly inside the detail. The city overlays are separate from Grok's tiles, so each z0 tile gets them baked in
    from their 3x art (at 2x), the same overlays the other levels carry."""
    L1 = levels[0]; s = 2.0 * L1['scale']   # z0 scale relative to the master (1.0 master -> 2.0)
    pat = re.compile(r'r(\d+)c(\d+) x(\d+) y(\d+)')
    det = []
    for f in sorted(glob.glob(os.path.join(folder, '*detail2x r*c* x* y*.png'))):
        m = pat.search(os.path.basename(f)); r_, c_, mx, my = map(int, m.groups())
        det.append({'file': f, 'r': r_, 'c': c_, 'x0': mx, 'y0': my, 'x1': mx + 4096, 'y1': my + 4096, 'sha256': sha(f)})
    if not det:
        sys.exit('--detail2x: no detail tiles in ' + folder)
    def covered(x0, y0, x1, y1):   # master rect wholly inside the union of detail tiles (detail tiles are on the 4096 grid)
        for yy in range(int(y0 // 4096), int((y1 - 1e-6) // 4096) + 1):
            for xx in range(int(x0 // 4096), int((x1 - 1e-6) // 4096) + 1):
                if not any(d['x0'] == xx * 4096 and d['y0'] == yy * 4096 for d in det):
                    return False
        return True
    W0, H0 = int(round((RW - X0) * s)), int(round(RH * s))
    cols0, rows0 = int(math.ceil(W0 / TILE)), int(math.ceil(H0 / TILE))
    want = []
    for d in det:
        for r in range(int(d['y0'] * s // TILE), int(math.ceil(d['y1'] * s / TILE))):
            for c in range(int((d['x0'] - X0) * s // TILE), int(math.ceil((d['x1'] - X0) * s / TILE))):
                mx0, my0 = X0 + c * TILE / s, r * TILE / s
                if covered(mx0, my0, mx0 + TILE / s, my0 + TILE / s) and (r, c) not in want:
                    want.append((r, c))
    # the city overlays at 2x from their 3x art
    zips = {}
    def zip_of(name):
        if name not in zips:
            zips[name] = zipfile.ZipFile(os.path.join(src, name))
        return zips[name]
    cache = {}
    def city2x(c):
        if c['name'] in cache:
            return cache[c['name']]
        w, h = c['sizePx']; im = None
        for d in reversed(CITY_FIX_DIRS):   # Grok's mask fix v2 3x art
            f = os.path.join(src, d, '%s overlay 3x_v2.png' % c['name'])
            if os.path.exists(f):
                im = Image.open(f).convert('RGBA'); break
        if im is None and c.get('overlay3x') and c.get('source'):
            im = Image.open(io.BytesIO(zip_of(c['source']).read(c['overlay3x']))).convert('RGBA')
        if im is None:
            sys.exit('no 3x overlay for ' + c['name'])
        im = np.asarray(im.resize((int(round(w * s)), int(round(h * s))), Image.LANCZOS)).astype(np.float32)
        cache[c['name']] = im; return im
    os.makedirs(os.path.join(out, 'tiles', 'z0'), exist_ok=True)
    big = {}
    for r, c in want:
        mx0, my0 = X0 + c * TILE / s, r * TILE / s
        tile = np.zeros((TILE, TILE, 3), np.float32)
        for d in det:   # the tile may span two detail tiles
            ax0, ay0 = max(mx0, d['x0']), max(my0, d['y0']); ax1, ay1 = min(mx0 + TILE / s, d['x1']), min(my0 + TILE / s, d['y1'])
            if ax1 <= ax0 or ay1 <= ay0:
                continue
            if d['file'] not in big:
                big[d['file']] = np.asarray(Image.open(d['file']).convert('RGB'))
            D = big[d['file']]
            dx0, dy0 = int(round((ax0 - d['x0']) * s)), int(round((ay0 - d['y0']) * s)); dx1, dy1 = int(round((ax1 - d['x0']) * s)), int(round((ay1 - d['y0']) * s))
            tx0, ty0 = int(round((ax0 - mx0) * s)), int(round((ay0 - my0) * s))
            tile[ty0:ty0 + dy1 - dy0, tx0:tx0 + dx1 - dx0] = D[dy0:dy1, dx0:dx1]
        for cty in cities:
            x, y = cty['topleftPx']; w, h = cty['sizePx']
            if x >= mx0 + TILE / s or x + w <= mx0 or y >= my0 + TILE / s or y + h <= my0:
                continue
            ov = city2x(cty); ox0, oy0 = int(round((x - mx0) * s)), int(round((y - my0) * s))
            sx0, sy0 = max(0, -ox0), max(0, -oy0); tx0, ty0 = max(0, ox0), max(0, oy0)
            ww, hh = min(ov.shape[1] - sx0, TILE - tx0), min(ov.shape[0] - sy0, TILE - ty0)
            if ww <= 0 or hh <= 0:
                continue
            o = ov[sy0:sy0 + hh, sx0:sx0 + ww]; al = o[..., 3:4] / 255.0
            tile[ty0:ty0 + hh, tx0:tx0 + ww] = tile[ty0:ty0 + hh, tx0:tx0 + ww] * (1 - al) + o[..., :3] * al
        p = os.path.join(out, 'tiles', 'z0', 'r%02dc%02d.webp' % (r, c))
        Image.fromarray(np.clip(tile + 0.5, 0, 255).astype(np.uint8)).save(p, 'WEBP', quality=WEBP_Q, method=6)
        files['tiles/z0/r%02dc%02d.webp' % (r, c)] = p
    want.sort()
    log('detail2x: z0 %d tiles (scale %.1f, %.1f px a square) from %s' % (len(want), s, L1['cellPx'] * 2, ', '.join('r%dc%d' % (d['r'], d['c']) for d in det)))
    return {'z': 0, 'scale': s, 'cellPx': L1['cellPx'] * 2, 'width': W0, 'height': H0, 'cols': cols0, 'rows': rows0,
            'tiles': ['%d,%d' % t for t in want], 'sources': [{k: d[k] for k in ('r', 'c', 'x0', 'y0', 'sha256')} | {'file': os.path.basename(d['file'])} for d in det]}


def rerender(master, levels, files, X0, out, rects):
    """v1229: re-render only the pyramid tiles over the given realm-px rects (a city mask fix, Grok's floating island), the same way
    build_pyramid makes them: z1 from the master, z2 from each z1 tile halved, z3.. from the level above (with a one-tile margin), cover."""
    L1 = levels[0]; inv = 1 / L1['scale']; done = {}
    def save(z, r, c, arr):
        p = files['tiles/z%d/r%02dc%02d.webp' % (z, r, c)]; Image.fromarray(np.ascontiguousarray(arr)).save(p, 'WEBP', quality=WEBP_Q, method=6)
    def load(z, r, c):
        return np.asarray(Image.open(files['tiles/z%d/r%02dc%02d.webp' % (z, r, c)]).convert('RGB'))
    # z1 tiles touching any rect (realm px -> z1 px)
    want = set()
    for (x0, y0, x1, y1) in rects:
        lx0, ly0, lx1, ly1 = (x0 - X0) * L1['scale'], y0 * L1['scale'], (x1 - X0) * L1['scale'], y1 * L1['scale']
        for r in range(max(0, int(ly0 // TILE)), min(L1['rows'] - 1, int(ly1 // TILE)) + 1):
            for c in range(max(0, int(lx0 // TILE)), min(L1['cols'] - 1, int(lx1 // TILE)) + 1):
                want.add((r, c))
    for r, c in sorted(want):
        lx0, ly0 = c * TILE, r * TILE
        lx1, ly1 = min(L1['width'], lx0 + TILE), min(L1['height'], ly0 + TILE)
        mx0, my0 = int(math.floor(X0 + lx0 * inv)), int(math.floor(ly0 * inv))
        mx1, my1 = int(math.ceil(X0 + lx1 * inv)), int(math.ceil(ly1 * inv))
        raw = Image.fromarray(master.read(mx0, my0, mx1, my1))
        box = ((X0 + lx0 * inv) - mx0, ly0 * inv - my0, (X0 + lx1 * inv) - mx0, ly1 * inv - my0)
        save(1, r, c, np.asarray(raw.resize((lx1 - lx0, ly1 - ly0), Image.LANCZOS, box=box)))
    log('rerender: z1 %d tiles' % len(want))
    prev = want
    for i, L in enumerate(levels[1:], start=1):
        P = levels[i - 1]; nxt = {(r // 2, c // 2) for r, c in prev}
        if i >= 2:   # a margin: z3.. came from a whole-image resize, so neighbours feel each change a little
            nxt = {(r + dr, c + dc) for r, c in nxt for dr in (-1, 0, 1) for dc in (-1, 0, 1) if 0 <= r + dr < L['rows'] and 0 <= c + dc < L['cols']}
        for r, c in sorted(nxt):
            if i == 1:   # z2 tile = four z1 tiles, each halved on its own (build_pyramid)
                t = np.zeros((min(TILE, L['height'] - r * TILE), min(TILE, L['width'] - c * TILE), 3), np.uint8)
                for dr in (0, 1):
                    for dc in (0, 1):
                        pr, pc = 2 * r + dr, 2 * c + dc
                        if pr >= P['rows'] or pc >= P['cols']:
                            continue
                        src = load(P['z'], pr, pc); h2 = np.asarray(Image.fromarray(src).resize(((src.shape[1] + 1) // 2, (src.shape[0] + 1) // 2), Image.LANCZOS))
                        oy, ox = dr * TILE // 2, dc * TILE // 2
                        hh, ww = min(h2.shape[0], t.shape[0] - oy), min(h2.shape[1], t.shape[1] - ox)
                        t[oy:oy + hh, ox:ox + ww] = h2[:hh, :ww]
            else:        # the level above's 2x2 block plus a one-tile margin, resized, cropped
                r0, c0, r1, c1 = max(0, 2 * r - 1), max(0, 2 * c - 1), min(P['rows'] - 1, 2 * r + 2), min(P['cols'] - 1, 2 * c + 2)
                big = np.zeros(((r1 - r0 + 1) * TILE, (c1 - c0 + 1) * TILE, 3), np.uint8)
                for pr in range(r0, r1 + 1):
                    for pc in range(c0, c1 + 1):
                        s = load(P['z'], pr, pc); big[(pr - r0) * TILE:(pr - r0) * TILE + s.shape[0], (pc - c0) * TILE:(pc - c0) * TILE + s.shape[1]] = s
                hb = min(big.shape[0], P['height'] - r0 * TILE); wb = min(big.shape[1], P['width'] - c0 * TILE); big = big[:hb, :wb]
                # the whole-level resize maps level-above px p to p * L.height / P.height
                sy, sx = L['height'] / P['height'], L['width'] / P['width']
                small = np.asarray(Image.fromarray(big).resize((max(1, int(round(wb * sx))), max(1, int(round(hb * sy)))), Image.LANCZOS))
                oy, ox = int(round(r * TILE - r0 * TILE * sy)), int(round(c * TILE - c0 * TILE * sx))
                th, tw = min(TILE, L['height'] - r * TILE), min(TILE, L['width'] - c * TILE)
                t = small[oy:oy + th, ox:ox + tw]
                if t.shape[0] != th or t.shape[1] != tw:
                    t = np.asarray(Image.fromarray(t).resize((tw, th), Image.LANCZOS))
            save(L['z'], r, c, t)
        log('rerender: z%d %d tiles' % (L['z'], len(nxt)))
        prev = nxt
    # the cover is the last level, whole
    Lz = levels[-1]; cov = Image.new('RGB', (Lz['width'], Lz['height']))
    for r in range(Lz['rows']):
        for c in range(Lz['cols']):
            cov.paste(Image.open(files['tiles/z%d/r%02dc%02d.webp' % (Lz['z'], r, c)]).convert('RGB'), (c * TILE, r * TILE))
    cov.save(files['cover.webp'], 'WEBP', quality=WEBP_Q, method=6)


def build_pyramid(master, levels, tiles_dir, files, X0, out):
    # z1 straight from the master; the next level is kept whole in memory (small) and the rest come from it
    L1 = levels[0]
    nxt = np.zeros((levels[1]['height'], levels[1]['width'], 3), np.uint8) if len(levels) > 1 else None

    def save_tile(z, r, c, arr):
        d = os.path.join(tiles_dir, 'z%d' % z); os.makedirs(d, exist_ok=True)
        p = os.path.join(d, 'r%02dc%02d.webp' % (r, c))
        Image.fromarray(arr).save(p, 'WEBP', quality=WEBP_Q, method=6)
        files['tiles/z%d/r%02dc%02d.webp' % (z, r, c)] = p

    inv = 1 / L1['scale']
    for r in range(L1['rows']):
        for c in range(L1['cols']):
            lx0, ly0 = c * TILE, r * TILE
            lx1, ly1 = min(L1['width'], lx0 + TILE), min(L1['height'], ly0 + TILE)
            mx0, my0 = int(math.floor(X0 + lx0 * inv)), int(math.floor(ly0 * inv))
            mx1, my1 = int(math.ceil(X0 + lx1 * inv)), int(math.ceil(ly1 * inv))
            raw = Image.fromarray(master.read(mx0, my0, mx1, my1))
            box = ((X0 + lx0 * inv) - mx0, ly0 * inv - my0, (X0 + lx1 * inv) - mx0, ly1 * inv - my0)
            t = np.asarray(raw.resize((lx1 - lx0, ly1 - ly0), Image.LANCZOS, box=box))
            save_tile(1, r, c, t)
            if nxt is not None:
                h2 = Image.fromarray(t).resize(((lx1 - lx0 + 1) // 2, (ly1 - ly0 + 1) // 2), Image.LANCZOS)
                nxt[ly0 // 2:ly0 // 2 + h2.size[1], lx0 // 2:lx0 // 2 + h2.size[0]] = np.asarray(h2)[:levels[1]['height'] - ly0 // 2, :levels[1]['width'] - lx0 // 2]
        log('z1 row %d/%d' % (r + 1, L1['rows']))
    whole = nxt
    small = {}
    for L in levels[1:]:
        if whole.shape[1] != L['width'] or whole.shape[0] != L['height']:
            whole = np.asarray(Image.fromarray(whole).resize((L['width'], L['height']), Image.LANCZOS))
        for r in range(L['rows']):
            for c in range(L['cols']):
                save_tile(L['z'], r, c, np.ascontiguousarray(whole[r * TILE:(r + 1) * TILE, c * TILE:(c + 1) * TILE]))
        last = whole
        if L['width'] <= 5000:
            small[L['z']] = whole
        whole = np.asarray(Image.fromarray(whole).resize(((L['width'] + 1) // 2, (L['height'] + 1) // 2), Image.LANCZOS))
    cover = last
    cp = os.path.join(out, 'cover.webp'); Image.fromarray(cover).save(cp, 'WEBP', quality=WEBP_Q, method=6); files['cover.webp'] = cp
    return cover, small


def main():
    global COLS, ROWS
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--version', required=True)
    ap.add_argument('--out')
    ap.add_argument('--install')
    ap.add_argument('--allow-dev-fill', action='store_true')
    ap.add_argument('--max-scale', type=float, default=1.0)   # v1226 shipped z1 = the master (1.0)
    ap.add_argument('--land-frac', type=float, default=0.5)
    ap.add_argument('--reuse-tiles', action='store_true', help='keep the pyramid already in --out; rebuild only the data (mask, zones, oases, module)')
    ap.add_argument('--cols', type=int, default=GRID_COLS, help='grid columns (GRID_COLS)')
    ap.add_argument('--master-png', help='a full-size master PNG (Grok) for the tiles named by --master-png-tiles')
    ap.add_argument('--master-png-tiles', default='', help='4096 master tiles taken from --master-png, e.g. r1c3,r1c4')
    ap.add_argument('--mask-from', help="v1231: take the land / zone mask and the islets from this world-realm.js (the live build), not from the tiles - a repaint (Grok's float, a city overlay) never moves the coast")
    ap.add_argument('--ponds-from', help='v1231: keep the ponds of this world-oasis-layout.json (measured once; a re-encoded tile must not move them)')
    ap.add_argument('--detail2x', help="v1231: a folder of Grok's detail2x tiles ('REALM <v> float detail2x rRcC xX yY ....png', 8192 px, master x2): build a sparse z0 level there")
    ap.add_argument('--rerender', default='', help='with --reuse-tiles: re-render the pyramid tiles over these realm-px rects x0,y0,x1,y1;...')
    ap.add_argument('--rows', type=int, default=GRID_ROWS, help='grid rows (GRID_ROWS); 0 = the art height at --cols')
    a = ap.parse_args()
    if a.cols < OLD_COLS or a.cols % 2:
        sys.exit('--cols must be even and at least %d' % OLD_COLS)
    COLS = a.cols
    SQ, FOOT = sq(), foot()
    v = a.version
    out = a.out or os.path.join(MAP_FINAL, 'IN GAME', 'realm-' + v)
    os.makedirs(out, exist_ok=True)
    pos_f = os.path.join(a.src, 'REALM layout %s positions.json' % v)
    prev_f = os.path.join(a.src, 'REALM composite preview %s.jpg' % v)
    for f in (pos_f, prev_f):
        if not os.path.exists(f):
            sys.exit('missing ' + f)
    pos = json.load(open(pos_f))
    RW, RH = pos['realm']
    preview = Image.open(prev_f).convert('RGB')
    master = Master(a.src, v, a.allow_dev_fill, preview)
    master.set_realm(RW, RH)

    # ---- 3. tree (measured before the grid: the grid is centred on it)
    tl = tree_layout(a.src, pos)
    op, oj = os.path.join(a.src, 'REALM %s tree-free patch.png' % v), os.path.join(a.src, 'REALM %s tree-free patch.json' % v)
    if os.path.exists(op) and os.path.exists(oj):
        tl['own_patch'] = (op, json.load(open(oj))['topleft_px'])
    tcx, tcy = tl['centre']
    log('tree: centre %.1f,%.1f realm px, side %.0f px, frame scale %.3f, match rms %.1f' % (tcx, tcy, tl['side'], tl['scale_src'], tl['rms']))
    patch_box = tree_patch(master, tl)
    if a.master_png:
        master.use_master_png(a.master_png, [tuple(map(int, re.match(r'r(\d+)c(\d+)$', t).groups())) for t in a.master_png_tiles.split(',') if t])
    cities = city_patches(master, a.src, v, pos)

    # ---- 2. grid: COLS square cells across, trunk on the world centre (x = 50 %); ROWS rows over the art's own height
    half = min(tcx, RW - tcx)
    WW = 2 * half                     # world width in realm px
    cpx = WW / COLS                   # realm px per cell
    X0 = tcx - half                   # realm px at world x = 0
    top_cells = COLS / 2 - tcy / cpx  # realm y = 0, in cells from the top of the square 0..100 % world (the client places the art by it)
    h_cells = RH / cpx
    ROWS = a.rows or int(math.ceil(h_cells - 1e-6))
    if ROWS + 1e-6 < h_cells:
        sys.exit('%d rows do not cover the art (%.2f rows of it at %d columns): raise GRID_ROWS' % (ROWS, h_cells, COLS))
    grid_top = top_cells - (ROWS - h_cells) / 2   # grid row 0, in cells from the world top: the rows are centred on the art
    if grid_top < 0 or grid_top + ROWS > COLS:
        sys.exit('the grid leaves the square world (top %.2f, %d rows of %d)' % (grid_top, ROWS, COLS))
    off = grid_top - top_cells        # realm y of grid row r = (r + off) * cpx
    log('grid: %d x %d, %.3f realm px per cell, crop x %.1f..%.1f of %d, grid rows from %.3f (art %.3f..%.3f); castle %d squares, one 220-square = %.3f'
        % (COLS, ROWS, cpx, X0, X0 + WW, RW, grid_top, top_cells, top_cells + h_cells, FOOT, SQ))
    for c in cities:
        c['cells'] = city_cells(c, X0, -off, cpx, master); del c['_alpha']
    log('city squares (blocked for castles and teleports): ' + ', '.join('%s %d' % (c['name'], len(c['cells'])) for c in cities))

    # ---- 4. pyramid. Level n has scale max_scale / 2**(n-1) of the master.
    levels = []
    s = a.max_scale
    n = 1
    while True:
        lw, lh = int(round(WW * s)), int(round(RH * s))
        levels.append({'z': n, 'scale': s, 'cellPx': cpx * s, 'width': lw, 'height': lh,
                       'cols': int(math.ceil(lw / TILE)), 'rows': int(math.ceil(lh / TILE))})
        if lw <= 2400:
            break
        s /= 2; n += 1
    tiles_dir = os.path.join(out, 'tiles')
    files = {}
    if a.reuse_tiles:
        for L in levels:
            for r in range(L['rows']):
                for c in range(L['cols']):
                    k = 'tiles/z%d/r%02dc%02d.webp' % (L['z'], r, c); files[k] = os.path.join(out, k)
                    if not os.path.exists(files[k]):
                        sys.exit('--reuse-tiles: missing ' + files[k])
        files['cover.webp'] = os.path.join(out, 'cover.webp')
        log('reusing the pyramid files in %s' % out)
    elif os.path.exists(tiles_dir):
        bak = os.path.join(TO_DELETE, 'realm-build-%s-%s' % (v, time.strftime('%d%b%Y-%H%M%S')))
        os.makedirs(bak, exist_ok=True); shutil.move(tiles_dir, os.path.join(bak, 'tiles'))
        log('previous tiles moved to', bak)
    if not a.reuse_tiles:
        build_pyramid(master, levels, tiles_dir, files, X0, out)
    # the mask is ALWAYS measured on the saved WebP tiles, so a full build and a --reuse-tiles run give the same zones.
    # v1229: with --rerender the mask is measured on the tiles as they were BEFORE the re-render, so a repaint that hangs art over the sea
    # (Grok's floating World Tree island: its rock underside, falls and mist) never turns sea cells into land
    small = {}
    for L in levels:
        if L['width'] <= 10000:
                pic_ = Image.new('RGB', (L['width'], L['height']))
                for r in range(L['rows']):
                    for c in range(L['cols']):
                        pic_.paste(Image.open(files['tiles/z%d/r%02dc%02d.webp' % (L['z'], r, c)]).convert('RGB'), (c * TILE, r * TILE))
                small[L['z']] = np.asarray(pic_)
    if a.reuse_tiles and a.rerender:
        rerender(master, levels, files, X0, out, [tuple(map(int, r.split(','))) for r in a.rerender.split(';') if r])
    detail = build_detail2x(a.detail2x, a.src, master, levels, files, X0, out, cities, RW, RH) if a.detail2x else None
    cover = np.asarray(Image.open(files['cover.webp']).convert('RGB'))   # decoded, the same bytes either way
    sea_pad(cover, out, files)
    log('pyramid: ' + ', '.join('z%d %dx%d (%d tiles, %.1f px/cell)' % (L['z'], L['width'], L['height'], L['cols'] * L['rows'], L['cellPx']) for L in levels))

    # ---- 5. land mask per cell from the second level (whole picture in memory) or z1 if there is only one
    # the largest level that is at most 10000 px wide (8.6 px per cell at 1000 columns): enough to measure, small enough for memory
    bz = min(small) if small else levels[-1]["z"]
    base = [L for L in levels if L['z'] == bz][0]
    pic = small.get(bz, cover)
    wat = water_mask(pic)
    land_px = (~wat).astype(np.uint8)
    land_px = cv2.morphologyEx(land_px, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    frac = np.zeros((ROWS, COLS), np.float32)
    bc = base['cellPx']
    for cy in range(ROWS):
        py0 = (cy + off) * bc; py1 = py0 + bc
        if py0 < -1e-6 or py1 > pic.shape[0] + 0.5:
            continue   # a row only partly inside the realm is sea margin: blocked
        py0 = max(0.0, py0)
        for cx in range(COLS):
            px0 = cx * bc; px1 = px0 + bc
            frac[cy, cx] = land_px[int(py0):int(math.ceil(py1)), int(px0):int(math.ceil(px1))].mean()
    land = frac >= a.land_frac
    if FOOT > 1:
        # v1227: a speck of land too small for one castle (no FOOT x FOOT block of land) is sea, as a sub-square speck was at 220
        K = FOOT
        blk = np.ones((ROWS - K + 1, COLS - K + 1), bool)
        for j in range(K):
            for i in range(K):
                blk &= land[j:ROWS - K + 1 + j, i:COLS - K + 1 + i]
        _, lab0 = cv2.connectedComponents(land.astype(np.uint8), connectivity=4)
        keep = np.unique(lab0[:ROWS - K + 1, :COLS - K + 1][blk])
        specks = int((land & ~np.isin(lab0, keep)).sum())
        land &= np.isin(lab0, keep)
        log('land specks smaller than one castle (no %dx%d land block) -> sea: %d cells' % (K, K, specks))

    # ---- 6. zones. v1227: WHICH land mass is which zone is decided on the 220 grid, exactly as v1226 did (the 4 largest masses =
    # the home regions by quadrant, the tree's island, the rest wild by direction), so a finer grid never moves a coast cove or a
    # thin channel's far side into another zone; each fine land cell takes the zone of the 220-square it lies in (a fine land mass
    # whose 220-squares are all sea is a new islet: wild by its direction from the tree)
    ob = bc * SQ; otop = top_cells / SQ             # 220-grid cell size in base px; realm y = 0 in 220-grid rows
    ofrac = np.zeros((OLD_COLS, OLD_COLS), np.float32)
    for cy in range(int(math.floor(otop)), min(OLD_COLS, int(math.ceil(otop + h_cells / SQ)))):
        py0 = (cy - otop) * ob; py1 = py0 + ob
        if py0 < 0 or py1 > pic.shape[0]:
            continue
        for cx in range(OLD_COLS):
            px0 = cx * ob; px1 = px0 + ob
            ofrac[cy, cx] = land_px[int(py0):int(math.ceil(py1)), int(px0):int(math.ceil(px1))].mean()
    oland = ofrac >= a.land_frac
    n_o, lab_o, st_o, cen_o = cv2.connectedComponentsWithStats(oland.astype(np.uint8), connectivity=4)
    comps_o = sorted(range(1, n_o), key=lambda i: -st_o[i, 4])
    OC = OLD_COLS // 2
    tree_o = lab_o[OC, OC] or lab_o[OC - 1, OC - 1]
    if not tree_o:
        sys.exit('the World Tree centre cell is not land - the tree must stand on its island')
    ozone = np.full((OLD_COLS, OLD_COLS), '.', dtype='<U1')
    big = [i for i in comps_o if i != tree_o][:4]
    seen = set()
    for i in big:
        qx = -1 if cen_o[i][0] < OC else 1; qy = -1 if cen_o[i][1] < OC else 1
        key = REGION_BY_QUADRANT[(qx, qy)]
        if key in seen:
            sys.exit('two of the four largest land masses sit in the same quadrant (%s): check the art' % key)
        seen.add(key); ozone[lab_o == i] = ZONE_CODE[key]
    ozone[lab_o == tree_o] = 'T'

    def wild_dir(dx, dy):
        return ('wildS' if dy > 0 else 'wildN') if abs(dy) >= abs(dx) else ('wildE' if dx > 0 else 'wildW')
    for i in comps_o:
        if i in big or i == tree_o:
            continue
        ozone[lab_o == i] = ZONE_CODE[wild_dir(cen_o[i][0] - OC, cen_o[i][1] - OC)]
    C = COLS // 2; TR = COLS / 2 - grid_top   # the trunk: x on the column corner C, y on grid row TR (296.9 at 1000 x 596)
    CORE = even_round(4 * SQ)                 # the World Tree core: 4x4 squares of the 220 grid in world size (18x18 at 1000)
    core_box = [C - CORE // 2, int(round(TR)) - CORE // 2, C + CORE // 2 - 1, int(round(TR)) + CORE // 2 - 1]   # inclusive
    # every fine cell's 220-square
    oxs = np.clip(((np.arange(COLS) + 0.5) / SQ).astype(int), 0, OLD_COLS - 1)
    oys = np.clip(((np.arange(ROWS) + 0.5 + grid_top) / SQ).astype(int), 0, OLD_COLS - 1)
    inherited = ozone[np.ix_(oys, oxs)]
    n_cc, lab, st, cen = cv2.connectedComponentsWithStats(land.astype(np.uint8), connectivity=4)
    zone = np.full((ROWS, COLS), '.', dtype='<U1')
    zone[land] = inherited[land]
    islets = []   # Phil 30 Oct 2026: the small islands are the wild - players go there, good rewards there soon
    for i in range(1, n_cc):
        m = lab == i
        if (zone[m] == '.').all():   # a fine-only speck island: wild by its direction
            zone[m] = ZONE_CODE[wild_dir(cen[i][0] - C, cen[i][1] - TR)]
        else:                        # land whose own 220-square was sea takes its mass's majority zone
            vals, cnt = np.unique(zone[m][zone[m] != '.'], return_counts=True)
            zone[m & (zone == '.')] = vals[int(np.argmax(cnt))]
    if zone[int(TR), C] != 'T' and zone[int(TR), C - 1] != 'T':
        sys.exit('the World Tree trunk is not on the worldtree island')
    # the islets: each wild land mass of this grid
    wl = np.isin(zone, [ZONE_CODE[k] for k in ('wildN', 'wildS', 'wildE', 'wildW')])
    n_w, lab_w, st_w, cen_w = cv2.connectedComponentsWithStats(wl.astype(np.uint8), connectivity=4)
    for i in range(1, n_w):
        ys, xs = np.nonzero(lab_w == i)
        key = {v: k for k, v in ZONE_CODE.items()}[zone[ys[0], xs[0]]]
        islets.append({'zone': key, 'cells': int(st_w[i, 4]), 'cx': round(float(cen_w[i][0]), 2), 'cy': round(float(cen_w[i][1]), 2),
                       'box': [int(st_w[i, 0]), int(st_w[i, 1]), int(st_w[i, 2]), int(st_w[i, 3])]})
    comps = list(range(1, n_w + 5))
    counts = {k: int((zone == c).sum()) for k, c in ZONE_CODE.items()}
    log('zones (land cells):', counts, 'islets', len(comps) - 5)
    for k in ('crystor', 'draymon', 'tefron', 'alumron', 'worldtree'):
        if counts[k] < 100:
            sys.exit('zone %s has only %d land cells' % (k, counts[k]))

    if a.mask_from:
        js = open(a.mask_from, encoding='utf-8').read()
        pm = json.loads(re.search(r'const META=(\{.*?\});\n', js, re.S).group(1)); prle = json.loads(re.search(r'const RLE=(\[.*?\]);\n', js, re.S).group(1))
        if pm['cols'] != COLS or pm['rows'] != ROWS:
            sys.exit('--mask-from is a %dx%d realm, this build is %dx%d' % (pm['cols'], pm['rows'], COLS, ROWS))
        for y, row in enumerate(prle):
            xs = []
            for ch, n in re.findall(r'([.A-Za-z])(\d*)', row):
                xs.extend([ch] * (int(n) if n else 1))
            zone[y, :] = xs
        islets = [{k: o[k] for k in ('zone', 'cells', 'cx', 'cy', 'box')} for o in pm['islets']]
        counts = {k: int((zone == c).sum()) for k, c in ZONE_CODE.items()}
        log('mask: land / zones / islets kept from ' + a.mask_from)
    # ---- 7. oases (v1228): Grok's 4 painted ponds, measured from the pixels; their cells are island land (zone T), blocked like a city
    core = {(x, y) for x in range(core_box[0], core_box[2] + 1) for y in range(core_box[1], core_box[3] + 1)}
    city_set = {(cx, cy) for c in cities for cx, cy in c['cells']}
    if city_set & core:
        sys.exit('a city overlay covers the World Tree core: %s' % sorted(city_set & core))
    pl = [L for L in levels if L['z'] == 2][0] if len(levels) > 1 else levels[0]
    ponds = measure_ponds(files, pl, X0, grid_top, top_cells, cpx, out, v)
    if a.ponds_from:   # the measured ponds of the live build: same cells, same centres
        for o in json.load(open(a.ponds_from)):
            ponds[o['direction']] = {'cells': [list(c) for c in o['cells']], 'cx': o['cx'], 'cy': o['cy']}
        log('ponds: kept from ' + a.ponds_from)
    # v1228 (Phil 30 Oct 2026: "does the tree seem off center?"): the drawn World Tree stands in the MIDDLE of the four painted ponds - the
    # nearest grid corner to their average (the art's baked tree is painted out, so only the drawn frame and the core move; the crop
    # and the tiles stay as they are, centred on where Grok's tree was)
    TCX = int(round(sum(p['cx'] for p in ponds.values()) / len(ponds))); TCY = int(round(sum(p['cy'] for p in ponds.values()) / len(ponds)))
    log('tree: moved from %.2f,%.2f to the middle of the ponds %d,%d (cells)' % (C, TR, TCX, TCY))
    core_box = [TCX - CORE // 2, TCY - CORE // 2, TCX + CORE // 2 - 1, TCY + CORE // 2 - 1]
    core = {(x, y) for x in range(core_box[0], core_box[2] + 1) for y in range(core_box[1], core_box[3] + 1)}
    if not all(zone[y, x] == 'T' for x, y in core):
        sys.exit('the World Tree core at %d,%d is not all island land' % (TCX, TCY))
    if city_set & core:
        sys.exit('a city overlay covers the World Tree core: %s' % sorted(city_set & core))
    # the water cells the grid mask already took out of the island (enclosed '.' holes) that touch a pond belong to that pond
    sea_cc, sea_lab = cv2.connectedComponents((zone == '.').astype(np.uint8), connectivity=4)
    border = set(np.unique(np.concatenate([sea_lab[0], sea_lab[-1], sea_lab[:, 0], sea_lab[:, -1]]))) - {0}
    oases = []
    for key in ('nw', 'ne', 'sw', 'se'):
        p = ponds[key]; pc = [list(c) for c in p['cells']]
        touch = {int(sea_lab[y + dy, x + dx]) for x, y in pc for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1))} - {0} - border
        if touch:
            have = {tuple(c) for c in pc}
            for y, x in zip(*np.nonzero(np.isin(sea_lab, list(touch)))):
                if (int(x), int(y)) not in have: pc.append([int(x), int(y)]); have.add((int(x), int(y)))
            pc.sort(key=lambda c: (c[1], c[0]))
        if any((x, y) in core or (x, y) in city_set for x, y in pc):
            sys.exit('the %s pond overlaps the tree core or a city' % key)
        ring = {(x + dx, y + dy) for x, y in pc for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - {tuple(c) for c in pc}
        if not all(zone[y, x] == 'T' for x, y in ring):
            sys.exit('the %s pond is not inside the World Tree island' % key)
        for x, y in pc:
            zone[y, x] = 'T'   # the pond is part of the island (a garrison site on it), never open sea
        xs, ys = [c[0] for c in pc], [c[1] for c in pc]
        oases.append({'id': 'oasis-' + key, 'direction': key, 'name': POND_NAMES[key], 'kind': 'oasis', 'garrison': True,
                      'x': min(xs), 'y': min(ys), 'w': max(xs) - min(xs) + 1, 'h': max(ys) - min(ys) + 1,
                      'cx': p['cx'], 'cy': p['cy'], 'cells': pc})
    counts = {k: int((zone == c).sum()) for k, c in ZONE_CODE.items()}
    pond_set = {(x, y) for o in oases for x, y in o['cells']}
    # v1231: a city's squares never overlap another city, a pond or the tree core, and most of them are land
    seen_c = {}
    for c in cities:
        cs = {tuple(p) for p in c['cells']}
        for o, ocs in seen_c.items():
            if cs & ocs:
                sys.exit('cities %s and %s share %d squares' % (c['name'], o, len(cs & ocs)))
        if cs & pond_set or cs & core:
            sys.exit('city %s touches a pond or the World Tree core' % c['name'])
        land_share = sum(1 for x, y in cs if zone[y, x] != '.') / max(1, len(cs))
        if land_share < 0.6:   # a city built over water (stilts, a harbour): its squares are blocked all the same - reported, not refused
            log('city %s: %.0f %% of its squares are over sea (its overlay paints them solid)' % (c['name'], 100 * (1 - land_share)))
        seen_c[c['name']] = cs
    for c in cities:
        c['kind'] = 'city'; c['garrison'] = True   # v1228: cities and oases are the same kind of site (a guild garrison site)
    log('oases (painted ponds):', [(o['id'], o['x'], o['y'], o['w'], o['h'], len(o['cells']), o['cx'], o['cy']) for o in oases])

    # ---- 8. data
    rows = [''.join(zone[y]) for y in range(ROWS)]

    def rle(s):
        o = []; i = 0
        while i < len(s):
            j = i
            while j < len(s) and s[j] == s[i]:
                j += 1
            o.append(s[i] + (str(j - i) if j - i > 1 else '')); i = j
        return ''.join(o)

    labels = {}
    for k, c in ZONE_CODE.items():
        ys, xs = np.nonzero(zone == c)
        if len(xs):
            # the land cell nearest the zone's centroid, so the label sits on the land
            mx, my = xs.mean(), ys.mean(); j = int(np.argmin((xs - mx) ** 2 + (ys - my) ** 2))
            labels[k] = [int(xs[j]), int(ys[j])]
    tree_side_cells = tl['side'] / cpx
    # v1229: a speck of land inside a painted pond became part of that pond (island T): it is no islet of the wild any more
    islets_kept = [o for o in islets if (zone[o['box'][1]:o['box'][1] + o['box'][3], o['box'][0]:o['box'][0] + o['box'][2]] == ZONE_CODE[o['zone']]).any()]
    realm = {
        'version': v, 'dev': master.dev, 'built': time.strftime('%Y-%m-%d %H:%M'), 'cols': COLS, 'rows': ROWS,
        'gridTop': round(grid_top, 6), 'foot': FOOT, 'oldSquareCells': round(SQ, 6),
        'source': {'positions': os.path.basename(pos_f), 'preview': os.path.basename(prev_f),
                   'zips': [os.path.basename(z) for z in master.zips], 'missingMasterTiles': master.missing,
                   'realmPx': [RW, RH], 'cropX': [round(X0, 2), round(X0 + WW, 2)], 'cellPxMaster': round(cpx, 4)},
        'realmTop': round(top_cells, 4), 'realmHeight': round(h_cells, 4),
        'tile': TILE, 'levels': levels, 'detail': detail,
        'tree': {'cx': TCX, 'cy': TCY, 'artCx': C, 'artCy': round(TR, 4), 'coreCells': CORE, 'core': core_box, 'sideCells': round(tree_side_cells, 4), 'frames': TREE_FRAMES,
                 'matchRms': tl['rms'], 'patchRealmPx': patch_box},
        'islets': [dict(o, id='isle-%02d' % (k + 1), rewards=[]) for k, o in enumerate(sorted(islets_kept, key=lambda o: (-o['cells'], o['cy'], o['cx'])))],
        'oases': oases, 'labels': labels, 'zoneCells': counts, 'landFraction': a.land_frac,
        'cities': [dict(c, cx=round((c['cxPx'] - X0) / cpx, 3), cy=round(c['cyPx'] / cpx - off, 3)) for c in cities],
    }
    # tree frames (RGBA) at z1 resolution, the same square box as the baked tree
    tdir = os.path.join(out, 'tree'); os.makedirs(tdir, exist_ok=True)
    L1 = levels[0]
    tpx = int(round(tl["side"] * L1["scale"]))
    for i in range(1, TREE_FRAMES + 1):
        fr = Image.open(os.path.join(MAP_FINAL, '05 World Tree', 'frames', 'wt_%02d.png' % i)).convert('RGBA').resize((tpx, tpx), Image.LANCZOS)
        p = os.path.join(tdir, 'wt_%02d.webp' % i); fr.save(p, 'WEBP', quality=WEBP_Q, method=6); files['tree/wt_%02d.webp' % i] = p
    blocked = sorted([(x, y) for y in range(ROWS) for x in range(COLS) if zone[y, x] == '.' or (x, y) in city_set or (x, y) in pond_set], key=lambda t: (t[1], t[0]))
    bj = {'about': 'Squares no castle, mine or teleport may use: every sea and off-realm cell of Grok\'s realm map %s, and every garrison-site square: cities and oases (generated by tools/realm/build_realm.py - never hand-edit; re-run it). Keys are cellKey "x,y" (col,row) on the %dx%d (cols x rows) grid.' % (v, COLS, ROWS),
          'source': 'land/sea mask of the realm art (Grok landalpha water rule), a cell is land when >= %d%% of it is land; a cell is city when > %d%% of it is a city overlay\'s opaque pixels (alpha >= 128)' % (round(a.land_frac * 100), round(CITY_COVER * 100)),
          'version': v, 'count': len(blocked), 'cells': ['%d,%d' % t for t in blocked]}
    bp = os.path.join(out, 'world-terrain-blocked.json')
    with open(bp, 'w', newline='\n') as f:
        f.write('{\n"about": %s,\n"source": %s,\n"version": %s,\n"count": %d,\n"cells": [\n%s\n]\n}\n' % (
            json.dumps(bj['about']), json.dumps(bj['source']), json.dumps(v), len(blocked), ',\n'.join(json.dumps(c) for c in bj['cells'])))
    op = os.path.join(out, 'world-oasis-layout.json')
    with open(op, 'w', newline='\n') as f:
        f.write('[\n' + ',\n'.join('  ' + json.dumps({k: o[k] for k in ('id', 'direction', 'name', 'kind', 'garrison', 'x', 'y', 'w', 'h', 'cx', 'cy', 'cells')}, separators=(',', ':')) for o in oases) + '\n]\n')
    js = render_module(realm, [rle(r) for r in rows])
    jp = os.path.join(out, 'world-realm.js')
    with open(jp, 'w', newline='\n') as f:
        f.write(js)
    # previews for the look: the mask and the zones over the cover
    zprev = cover.copy().astype(np.float32)
    colors = {'A': (90, 170, 255), 'B': (110, 230, 110), 'C': (60, 220, 200), 'D': (255, 190, 60), 'T': (200, 120, 255),
              'n': (255, 255, 255), 's': (255, 255, 255), 'e': (255, 255, 255), 'w': (255, 255, 255), '.': (255, 40, 40)}
    cc = levels[-1]['cellPx']
    over = np.zeros_like(zprev)
    for y in range(ROWS):
        y0 = int((y + off) * cc); y1 = int((y + 1 + off) * cc)
        if y1 <= 0 or y0 >= zprev.shape[0]:
            continue
        for x in range(COLS):
            over[max(0, y0):y1, int(x * cc):int((x + 1) * cc)] = (0, 0, 0) if (x, y) in city_set else colors[zone[y, x]]
    mix = np.clip(zprev * 0.62 + over * 0.38, 0, 255).astype(np.uint8)
    pp = os.path.join(out, 'PREVIEW zones %s.jpg' % v); Image.fromarray(mix).save(pp, quality=88)
    realm['files'] = {k: sha(p) for k, p in sorted(files.items())}
    for k, p in (('world-realm.js', jp), ('world-terrain-blocked.json', bp), ('world-oasis-layout.json', op)):
        realm['files'][k] = sha(p)
    mp = os.path.join(out, 'realm.json')
    with open(mp, 'w', newline='\n') as f:
        json.dump(realm, f, indent=1)
    total = sum(os.path.getsize(p) for p in files.values())
    log('built %s -> %s (%d picture files, %.1f MB)%s' % (v, out, len(files), total / 1e6, ' DEV' if master.dev else ''))
    if a.install:
        install(out, realm, a.install)


def render_module(realm, rle_rows):
    """The shared client/server realm module. Pure data + lookups + the grid geometry; generated, never hand-edited."""
    meta = {k: realm[k] for k in ('version', 'built', 'dev', 'cols', 'rows', 'gridTop', 'foot', 'oldSquareCells', 'realmTop', 'realmHeight', 'tile', 'levels', 'detail', 'tree', 'oases', 'labels', 'islets', 'cities')}
    meta['cities'] = [{k: v for k, v in c.items() if k not in ('overlay3x',)} for c in meta['cities']]
    return MODULE_JS.replace('%(v)s', realm['version']).replace('%(meta)s', json.dumps(meta, separators=(',', ':'))).replace(
        '%(rle)s', json.dumps(rle_rows, separators=(',', ':')).replace('","', '",\n"'))


MODULE_JS = r'''/* GENERATED by tools/realm/build_realm.py from realm %(v)s - never hand-edit; re-run the build.
   The realm map in game (Phil 30 Oct 2026: "put this map in game. Swap out the old one"). Shared by the client
   (window.EmberweaveRealm) and the server (require). Zone codes per cell: A crystor, B draymon, C tefron, D alumron,
   T worldtree island, n/s/e/w wild islets, '.' sea or off-realm (blocked). A city square (META.cities[].cells; Phil
   30 Oct 2026: "the city should not be able to be teleported onto") keeps its zone but is blocked like the sea.
   THE GRID (v1227): META.cols x META.rows square cells - set by GRID_COLS / GRID_ROWS in the build, nothing else. Positions
   are world-percent of the square 0..100 world (never migrated); the columns span x 0..100, the rows the art's own band
   (grid row 0 starts META.gridTop cells below the world top). GEO turns positions into cells for every caller. */
(function(root){
'use strict';
const META=%(meta)s;
const RLE=%(rle)s;
const CODE_ZONE={A:'crystor',B:'draymon',C:'tefron',D:'alumron',T:'worldtree',n:'wildN',s:'wildS',e:'wildE',w:'wildW'};
const COLS=META.cols, ROWS=META.rows, GRID=new Uint8Array(COLS*ROWS);
const CODES='.ABCDTnsew';
if(RLE.length!==ROWS)throw Error('world-realm has '+RLE.length+' rows, META says '+ROWS);
RLE.forEach((row,y)=>{let x=0;const re=/([.A-Za-z])(\d*)/g;let m;while((m=re.exec(row))){const n=m[2]?+m[2]:1,c=CODES.indexOf(m[1]);for(let i=0;i<n;i++)GRID[y*COLS+x++]=c;}if(x!==COLS)throw Error('world-realm row '+y+' has '+x+' cells');});
function code(cx,cy){return cx>=0&&cy>=0&&cx<COLS&&cy<ROWS?CODES[GRID[cy*COLS+cx]]:'.';}
function isLand(cx,cy){return code(cx,cy)!=='.';}
const CITY=new Map();(META.cities||[]).forEach(c=>(c.cells||[]).forEach(([x,y])=>CITY.set(x+','+y,c.name)));
function cityAt(cx,cy){return CITY.get(cx+','+cy)||null;}
function isCity(cx,cy){return CITY.has(cx+','+cy);}
// v1228: garrison sites - the cities and the oases (the painted ponds) are the same kind of site (garrison:true, kind city|oasis);
// a site square is blocked for castles, mines and teleports
const SITE=new Map();[...(META.cities||[]),...(META.oases||[])].forEach(s=>(s.cells||[]).forEach(([x,y])=>SITE.set(x+','+y,s)));
function siteAt(cx,cy){const s=SITE.get(cx+','+cy);return s?{kind:s.kind||'city',name:s.name,id:s.id||null,garrison:s.garrison!==false}:null;}
function isSite(cx,cy){return SITE.has(cx+','+cy);}
function isOasis(cx,cy){const s=SITE.get(cx+','+cy);return !!s&&s.kind==='oasis';}
// a square a castle, mine or teleport may use: land that is not a garrison site (city or oasis)
function isOpen(cx,cy){return isLand(cx,cy)&&!isSite(cx,cy);}
function landZone(cx,cy){return CODE_ZONE[code(cx,cy)]||null;}
// a sea or off-realm cell belongs to the wild by its direction from the World Tree (it is blocked anyway)
function zoneOfCell(cx,cy){const z=landZone(cx,cy);if(z)return z;const dx=cx+0.5-META.tree.cx,dy=cy+0.5-META.tree.cy;
  return Math.abs(dy)>=Math.abs(dx)?(dy>0?'wildS':'wildN'):(dx>0?'wildE':'wildW');}
const _cells={};
// every open (non-site) land cell of a zone, row by row (top to bottom, left to right) - the order placement walks
function zoneCells(zone){if(_cells[zone])return _cells[zone];const out=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(landZone(x,y)===zone&&!isSite(x,y))out.push([x,y]);return _cells[zone]=out;}
// sea, off-realm and city squares - the same set as the server's world-terrain-blocked.json
function blockedKeys(){const out=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!isOpen(x,y))out.push(x+','+y);return out;}
// ---- GEO: world-percent <-> cells. A castle is FOOT x FOOT cells (META.foot = 1: one square, at its centre) - anchorX/anchorY give
// its (top-left) cell, cornerX/cornerY the position of the castle that starts there (a cell centre when FOOT is 1)
const CELL=100/COLS, Y0=META.gridTop*CELL, FOOT=META.foot, OLD_SQUARE=100/220, CORE=META.tree.core;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function col(x){return clamp(Math.round(x/CELL-0.5),0,COLS-1);}
function row(y){return clamp(Math.round((y-Y0)/CELL-0.5),0,ROWS-1);}
function xOf(c){return (c+0.5)*CELL;}
function yOf(r){return Y0+(r+0.5)*CELL;}
function anchorX(x){return clamp(Math.round(x/CELL-FOOT/2),0,COLS-FOOT);}
function anchorY(y){return clamp(Math.round((y-Y0)/CELL-FOOT/2),0,ROWS-FOOT);}
function cornerX(a){return (a+FOOT/2)*CELL;}
function cornerY(a){return Y0+(a+FOOT/2)*CELL;}
function footCells(ax,ay){const out=[];for(let j=0;j<FOOT;j++)for(let i=0;i<FOOT;i++)out.push([ax+i,ay+j]);return out;}
function footprint(x,y){return footCells(anchorX(x),anchorY(y));}
function footKeys(x,y){return footprint(x,y).map(c=>c[0]+','+c[1]);}
function coreCell(cx,cy){return cx>=CORE[0]&&cx<=CORE[2]&&cy>=CORE[1]&&cy<=CORE[3];}
// march distance in 220-grid squares (one castle side): march times never depend on the grid
function marchSquares(a,b){return Math.max(1,Math.round(Math.hypot(b.x-a.x,b.y-a.y)/OLD_SQUARE));}
// a mine stands ON a grid intersection (Phil 30 Oct 2026: "The mines don't go in the squares"): vertex (vx,vy), one square in size,
// touching the four cells around it - those four are its cells for occupancy
function mineX(vx){return vx*CELL;}
function mineY(vy){return Y0+vy*CELL;}
function vertexX(x){return clamp(Math.round(x/CELL),1,COLS-1);}
function vertexY(y){return clamp(Math.round((y-Y0)/CELL),1,ROWS-1);}
function mineCellsAt(vx,vy){return [[vx-1,vy-1],[vx,vy-1],[vx-1,vy],[vx,vy]];}
function mineKeys(x,y){return mineCellsAt(vertexX(x),vertexY(y)).map(c=>c[0]+','+c[1]);}
const GEO={COLS,ROWS,CELL,Y0,FOOT,OLD_SQUARE,CORE,col,row,xOf,yOf,anchorX,anchorY,cornerX,cornerY,footCells,footprint,footKeys,coreCell,marchSquares,
  mineX,mineY,vertexX,vertexY,mineCellsAt,mineKeys};
const api={META,GEO,code,isLand,isCity,cityAt,isSite,isOasis,siteAt,isOpen,landZone,zoneOfCell,zoneCells,blockedKeys,CODE_ZONE};
if(typeof module==='object'&&module.exports)module.exports=api;else root.EmberweaveRealm=api;
})(typeof globalThis==='object'?globalThis:this);
'''


def install(out, realm, repo):
    """Copy the Archive build into the game, byte-identical; everything it replaces is backed up first."""
    v = realm['version']
    plan = [('world-realm.js', 'world-realm.js'),
            ('world-terrain-blocked.json', 'server/world-terrain-blocked.json'),
            ('world-oasis-layout.json', 'server/world-oasis-layout.json')]
    dst_root = os.path.join(repo, 'assets', 'img', 'world-map', 'realm-' + v)
    bak = os.path.join(TO_DELETE, 'realm-install-%s-%s' % (v, time.strftime('%d%b%Y-%H%M%S')))
    for src_rel, dst_rel in plan:
        d = os.path.join(repo, dst_rel)
        if os.path.exists(d):
            os.makedirs(os.path.dirname(os.path.join(bak, dst_rel)), exist_ok=True); shutil.copy2(d, os.path.join(bak, dst_rel))
        shutil.copyfile(os.path.join(out, src_rel), d)
    if os.path.exists(dst_root):
        os.makedirs(bak, exist_ok=True); shutil.move(dst_root, os.path.join(bak, 'realm-' + v))
    for rel in [k for k in realm['files'] if k.startswith(('tiles/', 'tree/')) or k in ('cover.webp', 'sea-pad.webp')]:
        d = os.path.join(dst_root, rel); os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copyfile(os.path.join(out, rel), d)
    shutil.copyfile(os.path.join(out, 'realm.json'), os.path.join(dst_root, 'realm.json'))
    bad = [k for k, h in realm['files'].items()
           if sha(os.path.join(dst_root, k) if k.startswith(('tiles/', 'tree/')) or k in ('cover.webp', 'sea-pad.webp') else os.path.join(repo, dict(plan)[k])) != h]
    if bad:
        sys.exit('install mismatch vs the Archive build: %s' % bad[:5])
    log('installed %s into %s (%d files byte-identical to the Archive; replaced files backed up in %s)' % (v, repo, len(realm['files']), bak))


if __name__ == '__main__':
    main()
