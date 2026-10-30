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
  7. oases   the 4 oasis sites (one 220-grid 2x2 in world size), nearest to their old offsets from the tree, all on island land
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
GRID_COLS = 1000
GRID_ROWS = 596
COLS, ROWS = GRID_COLS, GRID_ROWS
OLD_COLS = 220             # the grid the castle, the World Tree core, the oases and the mine bands were first sized on: their world
                           # size never changes, so each is measured in 220-grid squares (sq() grid squares each)
TILE = 512
WEBP_Q = 92
TREE_FRAMES = 28
REGION_BY_QUADRANT = {(-1, -1): 'crystor', (1, -1): 'draymon', (-1, 1): 'tefron', (1, 1): 'alumron'}
ZONE_CODE = {'crystor': 'A', 'draymon': 'B', 'tefron': 'C', 'alumron': 'D', 'worldtree': 'T',
             'wildN': 'n', 'wildS': 's', 'wildE': 'e', 'wildW': 'w'}
OLD_OASIS = {'north': (109, 97), 'south': (109, 121), 'east': (121, 109), 'west': (97, 109)}  # v878 layout on the 220 grid, tree core 108..111


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
        self.patches = []   # (x0, y0, rgb float32 HxWx3, alpha HxW)

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
        if (r, c) in self.tiles:
            im = np.asarray(Image.open(self.tiles[(r, c)][2]).convert('RGB'))
        else:
            W, H = self.realm; x0, y0 = c * 4096, r * 4096; w, h = min(4096, W - x0), min(4096, H - y0)
            s = self.preview.size[0] / W
            box = (x0 * s, y0 * s, (x0 + w) * s, (y0 + h) * s)
            im = np.asarray(self.preview.resize((w, h), Image.LANCZOS, box=box))
        self.cache[(r, c)] = im
        return im

    def read(self, x0, y0, x1, y1):
        """RGB uint8 of master rect [x0,x1) x [y0,y1); outside the realm is black (never shown: the view is clamped)."""
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
        for px, py, rgb, al in self.patches:
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
            master.patches.append((int(x), int(y), np.ascontiguousarray(arr[..., :3]), np.ascontiguousarray(arr[..., 3])))
            out.append({'name': name, 'version': c.get('version'), 'topleftPx': [x, y], 'sizePx': [w, h],
                        'cxPx': x + w / 2, 'cyPx': y + h / 2, '_alpha': np.ascontiguousarray(arr[..., 3])})
    # further zips in the same format ("REALM <v> new city overlays.zip": one '<City> placement.json' per city with topleft_v25,
    # size_v25, overlay_1x.file). A PROVISIONAL city (in its file name or status) is held back until Grok sends its final file.
    held = []
    for extra in sorted(glob.glob(os.path.join(src, 'REALM %s * city overlays.zip' % v))):
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
                master.patches.append((int(x), int(y), np.ascontiguousarray(arr[..., :3]), np.ascontiguousarray(arr[..., 3])))
                out.append({'name': name, 'version': 'proposal', 'topleftPx': [x, y], 'sizePx': [w, h], 'cxPx': x + w / 2, 'cyPx': y + h / 2,
                            'source': os.path.basename(extra), '_alpha': np.ascontiguousarray(arr[..., 3])})
    log('cities: %d overlays baked in (%s)%s' % (len(out), ', '.join(o['name'] for o in out), ('; held (provisional): ' + ', '.join(held)) if held else ''))
    return out


CITY_COVER = 0.30   # a grid square is city when more than 30 % of it is the overlay's opaque pixels (alpha, not the bounding box)


def city_cells(c, X0, top_cells, cpx):   # top_cells: the grid row at realm y = 0
    """The grid squares a city overlay covers (Phil 30 Oct 2026: "the city should not be able to be teleported onto").
    A square counts when more than CITY_COVER of its area is opaque overlay (alpha >= 128)."""
    al = c['_alpha'] >= 128
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
            if al[ay0:ay1, ax0:ax1].sum() > CITY_COVER * cpx * cpx:
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
    p = os.path.join(out, 'sea-pad.webp'); Image.fromarray(np.ascontiguousarray(t)).save(p, 'WEBP', quality=WEBP_Q, method=6); files['sea-pad.webp'] = p


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
        c['cells'] = city_cells(c, X0, -off, cpx); del c['_alpha']
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
    cover = np.asarray(Image.open(files['cover.webp']).convert('RGB'))   # decoded, the same bytes either way
    # the mask is ALWAYS measured on the saved WebP tiles, so a full build and a --reuse-tiles run give the same zones
    small = {}
    for L in levels:
        if L['width'] <= 10000:
                pic_ = Image.new('RGB', (L['width'], L['height']))
                for r in range(L['rows']):
                    for c in range(L['cols']):
                        pic_.paste(Image.open(files['tiles/z%d/r%02dc%02d.webp' % (L['z'], r, c)]).convert('RGB'), (c * TILE, r * TILE))
                small[L['z']] = np.asarray(pic_)
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

    # ---- 7. oases: one 220-grid 2x2 in world size (OAS x OAS squares), all on island land, outside the core and off any city,
    # nearest to the old offset from the tree (OLD_OASIS converted to this grid)
    OAS = even_round(2 * SQ)
    core = {(x, y) for x in range(core_box[0], core_box[2] + 1) for y in range(core_box[1], core_box[3] + 1)}
    city_set = {(cx, cy) for c in cities for cx, cy in c['cells']}
    if city_set & core:
        sys.exit('a city overlay covers the World Tree core: %s' % sorted(city_set & core))
    ok = (zone == 'T').astype(np.int32)
    for (x, y) in core | city_set:
        if 0 <= x < COLS and 0 <= y < ROWS:
            ok[y, x] = 0
    ii = np.pad(ok, ((1, 0), (1, 0))).cumsum(0).cumsum(1)     # integral image: a whole OAS x OAS block is island land
    full = (ii[OAS:, OAS:] - ii[:-OAS, OAS:] - ii[OAS:, :-OAS] + ii[:-OAS, :-OAS]) == OAS * OAS
    oases = []
    for d, (ox, oy) in OLD_OASIS.items():
        ox, oy = ox * SQ, oy * SQ - grid_top
        best = None
        for y, x in zip(*np.nonzero(full)):
            if True:
                x, y = int(x), int(y)
                # keep each oasis on its own side of the tree
                ccx, ccy = x + OAS / 2 - C, y + OAS / 2 - TR
                side = {'north': ccy < 0 and abs(ccy) >= abs(ccx), 'south': ccy > 0 and abs(ccy) >= abs(ccx),
                        'east': ccx > 0 and abs(ccx) >= abs(ccy), 'west': ccx < 0 and abs(ccx) >= abs(ccy)}[d]
                if not side:
                    continue
                dist = (x - ox) ** 2 + (y - oy) ** 2
                if best is None or dist < best[0]:
                    best = (dist, x, y)
        if not best:
            sys.exit('no %dx%d island land for the %s oasis' % (OAS, OAS, d))
        oases.append({'direction': d, 'x': best[1], 'y': best[2]})
    log('oases:', oases)

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
    realm = {
        'version': v, 'dev': master.dev, 'built': time.strftime('%Y-%m-%d %H:%M'), 'cols': COLS, 'rows': ROWS,
        'gridTop': round(grid_top, 6), 'foot': FOOT, 'oldSquareCells': round(SQ, 6),
        'source': {'positions': os.path.basename(pos_f), 'preview': os.path.basename(prev_f),
                   'zips': [os.path.basename(z) for z in master.zips], 'missingMasterTiles': master.missing,
                   'realmPx': [RW, RH], 'cropX': [round(X0, 2), round(X0 + WW, 2)], 'cellPxMaster': round(cpx, 4)},
        'realmTop': round(top_cells, 4), 'realmHeight': round(h_cells, 4),
        'tile': TILE, 'levels': levels,
        'tree': {'cx': C, 'cy': round(TR, 4), 'coreCells': CORE, 'core': core_box, 'sideCells': round(tree_side_cells, 4), 'frames': TREE_FRAMES,
                 'matchRms': tl['rms'], 'patchRealmPx': patch_box},
        'islets': [dict(o, id='isle-%02d' % (k + 1), rewards=[]) for k, o in enumerate(sorted(islets, key=lambda o: (-o['cells'], o['cy'], o['cx'])))],
        'oasisCells': OAS, 'oases': oases, 'labels': labels, 'zoneCells': counts, 'landFraction': a.land_frac,
        'cities': [dict(c, cx=round((c['cxPx'] - X0) / cpx, 3), cy=round(c['cyPx'] / cpx - off, 3)) for c in cities],
    }
    # tree frames (RGBA) at z1 resolution, the same square box as the baked tree
    tdir = os.path.join(out, 'tree'); os.makedirs(tdir, exist_ok=True)
    L1 = levels[0]
    tpx = int(round(tl["side"] * L1["scale"]))
    for i in range(1, TREE_FRAMES + 1):
        fr = Image.open(os.path.join(MAP_FINAL, '05 World Tree', 'frames', 'wt_%02d.png' % i)).convert('RGBA').resize((tpx, tpx), Image.LANCZOS)
        p = os.path.join(tdir, 'wt_%02d.webp' % i); fr.save(p, 'WEBP', quality=WEBP_Q, method=6); files['tree/wt_%02d.webp' % i] = p
    blocked = sorted([(x, y) for y in range(ROWS) for x in range(COLS) if zone[y, x] == '.' or (x, y) in city_set], key=lambda t: (t[1], t[0]))
    bj = {'about': 'Squares no castle, mine or teleport may use: every sea and off-realm cell of Grok\'s realm map %s, and every city square (generated by tools/realm/build_realm.py - never hand-edit; re-run it). Keys are cellKey "x,y" (col,row) on the %dx%d (cols x rows) grid.' % (v, COLS, ROWS),
          'source': 'land/sea mask of the realm art (Grok landalpha water rule), a cell is land when >= %d%% of it is land; a cell is city when > %d%% of it is a city overlay\'s opaque pixels (alpha >= 128)' % (round(a.land_frac * 100), round(CITY_COVER * 100)),
          'version': v, 'count': len(blocked), 'cells': ['%d,%d' % t for t in blocked]}
    bp = os.path.join(out, 'world-terrain-blocked.json')
    with open(bp, 'w', newline='\n') as f:
        f.write('{\n"about": %s,\n"source": %s,\n"version": %s,\n"count": %d,\n"cells": [\n%s\n]\n}\n' % (
            json.dumps(bj['about']), json.dumps(bj['source']), json.dumps(v), len(blocked), ',\n'.join(json.dumps(c) for c in bj['cells'])))
    op = os.path.join(out, 'world-oasis-layout.json')
    with open(op, 'w', newline='\n') as f:
        f.write('[\n' + ',\n'.join('  {"direction":"%s","x":%d,"y":%d}' % (o['direction'], o['x'], o['y']) for o in oases) + '\n]\n')
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
    meta = {k: realm[k] for k in ('version', 'built', 'dev', 'cols', 'rows', 'gridTop', 'foot', 'oldSquareCells', 'realmTop', 'realmHeight', 'tile', 'levels', 'tree', 'oasisCells', 'oases', 'labels', 'islets', 'cities')}
    return MODULE_JS.replace('%(v)s', realm['version']).replace('%(meta)s', json.dumps(meta, separators=(',', ':'))).replace(
        '%(rle)s', json.dumps(rle_rows, separators=(',', ':')).replace('","', '",\n"'))


MODULE_JS = r'''/* GENERATED by tools/realm/build_realm.py from Grok's realm %(v)s - never hand-edit; re-run the build.
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
// a square a castle, mine or teleport may use: land that is not a city
function isOpen(cx,cy){return isLand(cx,cy)&&!isCity(cx,cy);}
function landZone(cx,cy){return CODE_ZONE[code(cx,cy)]||null;}
// a sea or off-realm cell belongs to the wild by its direction from the World Tree (it is blocked anyway)
function zoneOfCell(cx,cy){const z=landZone(cx,cy);if(z)return z;const dx=cx+0.5-META.tree.cx,dy=cy+0.5-META.tree.cy;
  return Math.abs(dy)>=Math.abs(dx)?(dy>0?'wildS':'wildN'):(dx>0?'wildE':'wildW');}
const _cells={};
// every open (non-city) land cell of a zone, row by row (top to bottom, left to right) - the order placement walks
function zoneCells(zone){if(_cells[zone])return _cells[zone];const out=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(landZone(x,y)===zone&&!isCity(x,y))out.push([x,y]);return _cells[zone]=out;}
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
const api={META,GEO,code,isLand,isCity,cityAt,isOpen,landZone,zoneOfCell,zoneCells,blockedKeys,CODE_ZONE};
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
