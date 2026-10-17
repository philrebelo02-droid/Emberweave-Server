"""v1141 CONDENSE (Phil 15 Oct 2026, items 1 + 4: "make the game smaller without lowering quality").

Builds the PHONE tier of the battle sprite sheets and trims wasted transparent space - LOSSLESSLY (Phil did not approve
GPU-compressed textures, a lossy re-encode or lower-bitrate sound).

PHONE TIER ("p", used when the page picks ART_TIER 'phone'):
  * every cell is resampled ON ITS OWN (premultiplied alpha, Lanczos, so no invisible colour or neighbouring cell bleeds in)
    to k x its size, then TRIMMED (see below) and the cells are laid out in the most square grid that holds them (a tall
    6 x 8 sheet of wide cells wastes the 2048 px side budget); saved as LOSSLESS WebP;
  * k is the smallest of
      k2x  - 2 texels for every device pixel the cell is drawn at on a phone at zoom 1 (Phil: "at least 2x the measured
             on-screen pixels"; MEASURED in the muted 844x390 @3x rig, tools/condense_measure_1141.json), and
      kmem - the v1140 phone memory budget: never more texture memory than texSheetK() (v1140) already uploads for this
             sheet on a phone, and never over 2048 px per side - or, where v1140 itself goes past 2048 to keep a 160 px figure,
             never past what v1140 uploads (its 4096 cap);
    so a phone NEVER holds more memory than v1140 and, because the trimmed square sheet spends that memory on figure instead
    of padding, nearly always shows MORE figure pixels than v1140 did;
  * a phone file is only shipped when it is no bigger to download than the file it replaces (and under the v1140 4 MB file
    cap); otherwise the phone keeps the v1140 path for that sheet (the original file, resized on load).
  * idle and walk are not tiered: the Heroes panel, the world map walkers, the battle-loader cards and the Emberdraft
    carousel paint those two sheets themselves from the original file.
  * spell-effect sheets (FX2_DEF) keep their grid and are not trimmed (their quads are placed by a dozen spell-specific
    code paths); only resampled, where the phone draws them small.

HIGH TIER ("h", desktop and big tablets): the current files. A sheet whose source is ALREADY lossless is trimmed (a pure crop, so
  the file shrinks with no re-encode loss); a lossy source is left exactly as it is (cropping it would need a re-encode).

TRIM: the union of every cell's visible pixels (alpha > 0) plus a 6 px transparent margin (the mipmap guard cs10 used) is kept;
  the rest of each cell was transparent padding. The page draws a trimmed cell into its logical place: tc = the kept rectangle
  as fractions of the cell, so the clip's cells, timing, anchors (cx/feet/top/ax) and contact frames are untouched data and
  every visible pixel is identical to the untrimmed cell at the same tier (tests/test_condense_1141.js).

DUPLICATE HELD FRAMES are not folded: the audit found 247 of 35,401 cells held, nearly all in spell-effect sheets whose sources
  are lossy, so folding them saves < 1% and would need a re-encode.

Output: <stem>_p1141.webp / <stem>_t1141.webp next to each original, assets/anim/tiers_1141.json
  { "v":"1141", "sheets": { "<original path>": { "p": [url, W, H, cols, rows, tc|null], "h": [...] } } }
and tools/condense_cells_1141.json (the hash of every UNTRIMMED cell at each tier, for the test), tools/condense_report_1141.json.

Usage: py -I tools/condense_sheets.py <worktree> [--only key,...] [--dry] [--ship-bigger]
  --ship-bigger also ships phone files that are a bigger download than their lossy original (the phone then never decodes the
  full-size sheet; costs bytes - see the v1141 report).
"""
import hashlib, json, math, os, subprocess, sys
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image

VER = '1141'
MARGIN = 6            # transparent px kept around the trimmed figure (mipmap levels 0-2 never reach a neighbour cell)
TEXELS_PER_PX = 2.0   # Phil: the phone tier keeps at least 2x the measured on-screen pixels
K_SKIP = 0.97         # a phone copy within 3% of the original size is not worth a second file
FILE_MAX = 4_000_000  # the v1140 file ratchet: a new battle sheet is <= 2048 px per side and <= 4 MB
SIDE_MAX = 2048
NOT_TIERED = ('idle', 'walk')
SHIP_BIGGER = False   # --ship-bigger: also ship a phone file that is a BIGGER download than its (lossy) original
# v1140's phone budget, texSheetK() in emberweave-heroes.html
TEX_SHEET_MAX, TEX_FIG_FLOOR, TEX_SHEET_HARD = 2048, 160, 4096


def tex_sheet_k(fw, fh, cols, rows, fig_frac):
    side = max(fw * cols, fh * rows); fig = fig_frac * fh if fig_frac > 0 else 0
    k_side = TEX_SHEET_MAX / side; k_floor = TEX_FIG_FLOOR / fig if fig > 0 else 0
    return min(1.0, max(k_side, k_floor), TEX_SHEET_HARD / side)


def webp_kind(p):
    import struct
    with open(p, 'rb') as f:
        d = f.read(1 << 20)
    i = 12
    while i + 8 <= len(d):
        t = d[i:i + 4]; n = struct.unpack('<I', d[i + 4:i + 8])[0]; i += 8 + n + (n & 1)
        if t == b'ANIM': return 'animated'
        if t == b'VP8L': return 'lossless'
        if t == b'VP8 ': return 'lossy'
    return 'unknown'


def cells_of(a, cols, rows, n, cw=None, ch=None):
    H, W = a.shape[:2]; cw = cw or W // cols; ch = ch or H // rows
    return [a[(i // cols) * ch:(i // cols + 1) * ch, (i % cols) * cw:(i % cols + 1) * cw] for i in range(n)], cw, ch


def resample_cell(cell, nw, nh):
    if cell.shape[1] == nw and cell.shape[0] == nh:
        return clear_hidden(cell)
    im = Image.fromarray(np.ascontiguousarray(cell), 'RGBA').convert('RGBa')   # premultiplied: invisible colour never bleeds in
    out = np.asarray(im.resize((nw, nh), Image.LANCZOS).convert('RGBA')).copy()
    out[out[:, :, 3] == 0] = 0
    return out


def clear_hidden(c):
    v = np.ascontiguousarray(c).copy(); v[v[:, :, 3] == 0] = 0
    return v


def cell_hash(c):
    """hash of what a cell SHOWS: every pixel's RGBA, the colour under a fully transparent pixel taken as 0 (never drawn - the
    browser premultiplies a decoded sheet, so that colour is 0 on the GPU from either file)"""
    return hashlib.sha256(clear_hidden(c).tobytes()).hexdigest()[:24]


def bbox_union(cells):
    x0 = y0 = 10 ** 9; x1 = y1 = -1
    for c in cells:
        al = c[:, :, 3] > 0
        ys = np.nonzero(al.any(1))[0]; xs = np.nonzero(al.any(0))[0]
        if len(ys):
            y0 = min(y0, ys[0]); y1 = max(y1, ys[-1]); x0 = min(x0, xs[0]); x1 = max(x1, xs[-1])
    return None if x1 < 0 else (int(x0), int(y0), int(x1), int(y1))


def trim_rect(cells, cw, ch):
    b = bbox_union(cells)
    if not b:
        return (0, 0, cw, ch)
    x0, y0, x1, y1 = b
    x0 = max(0, x0 - MARGIN); y0 = max(0, y0 - MARGIN); x1 = min(cw - 1, x1 + MARGIN); y1 = min(ch - 1, y1 + MARGIN)
    return (x0, y0, x1 - x0 + 1, y1 - y0 + 1)


def square_grid(n, w, h):
    """cols x rows holding n cells of w x h with the smallest longest side"""
    best = None
    for c in range(1, n + 1):
        r = -(-n // c); side = max(c * w, r * h)
        if best is None or side < best[0] or (side == best[0] and c * r < best[1] * best[2]):
            best = (side, c, r)
    return best[1], best[2]


def assemble(cells, cols, rows, w, h):
    out = np.zeros((h * rows, w * cols, 4), np.uint8)
    for i, c in enumerate(cells):
        r, q = divmod(i, cols); out[r * h:(r + 1) * h, q * w:(q + 1) * w] = c
    return out


def save_lossless(a, p):
    Image.fromarray(a, 'RGBA').save(p, 'WEBP', lossless=True, quality=100, method=6, exact=True)


def build(job):
    root, s, dry = job
    rel = s['u'].split('?')[0].lstrip('/'); src = os.path.join(root, rel); stem = os.path.splitext(src)[0]
    a = np.asarray(Image.open(src).convert('RGBA'))
    cols, rows, fw, fh = s['cols'], s['rows'], s['fw'], s['fh']; n = min(s['n'], cols * rows)
    out = {'u': s['u'], 'src_bytes': os.path.getsize(src), 'W': a.shape[1], 'H': a.shape[0], 'n': n, 'hashes': {}}
    if a.shape[1] != fw * cols or a.shape[0] != fh * rows:
        out['err'] = 'declared %dx%d cells x %dx%d != file %dx%d' % (fw, fh, cols, rows, a.shape[1], a.shape[0]); return out
    cells, cw, ch = cells_of(a, cols, rows, n, fw, fh)
    if s.get('trimHigh'):
        x0, y0, w, h = trim_rect(cells, cw, ch)
        if w * h <= 0.92 * cw * ch:
            t = [clear_hidden(c[y0:y0 + h, x0:x0 + w]) for c in cells]
            dst = stem + '_t' + VER + '.webp'
            if not dry: save_lossless(assemble(t, cols, rows, w, h), dst)
            out['h'] = {'file': os.path.relpath(dst, root).replace('\\', '/'), 'W': w * cols, 'H': h * rows, 'c': cols, 'r': rows,
                        'tc': [x0 / cw, y0 / ch, w / cw, h / ch], 'bytes': os.path.getsize(dst) if not dry else 0}
            out['hashes']['h'] = {'cw': cw, 'ch': ch, 'rect': [x0, y0, w, h], 'cells': [cell_hash(c) for c in cells]}
    k = s.get('k')
    if k:
        trim, repack = s.get('trimPhone', True), s.get('repack', True)
        for attempt in range(6):
            pw, ph = max(1, round(cw * k)), max(1, round(ch * k))
            full = [resample_cell(c, pw, ph) for c in cells]
            x0, y0, w, h = trim_rect(full, pw, ph) if trim else (0, 0, pw, ph)
            c2, r2 = square_grid(n, w, h) if repack else (cols, rows)
            side, area, budget = max(c2 * w, r2 * h), c2 * w * r2 * h, s.get('memBudget')
            smax = s.get('sideMax') or SIDE_MAX
            if side <= smax and (not budget or area <= budget): break
            k *= min(smax / side, math.sqrt(budget / area) if budget else 1.0, 1.0) * 0.999   # the 6 px margin is bigger at a smaller scale
        t = [c[y0:y0 + h, x0:x0 + w] for c in full]
        dst = stem + '_p' + VER + '.webp'
        if not dry: save_lossless(assemble(t, c2, r2, w, h), dst)
        out['p'] = {'file': os.path.relpath(dst, root).replace('\\', '/'), 'W': w * c2, 'H': h * r2, 'c': c2, 'r': r2, 'k': k,
                    'tc': ([x0 / pw, y0 / ph, w / pw, h / ph] if trim else None), 'bytes': os.path.getsize(dst) if not dry else 0,
                    'fig': (s['figH'] * ph / fh) if s.get('figH') else None, 'below': bool(s.get('kFloor') and ph / fh < s['kFloor'] * 0.995)}
        out['hashes']['p'] = {'cw': pw, 'ch': ph, 'rect': [x0, y0, w, h], 'cols': c2, 'cells': [cell_hash(c) for c in full]}
    return out


def plan_sheets(root, tables, drawn):
    sheets = {}
    for c in tables['clips']:
        if c.get('u') and c.get('fw') and str(c['u']).startswith('/assets/'):
            p = c['u'].split('?')[0]
            e = sheets.setdefault(p, dict(c, kind='clip', cols=c.get('cols') or c['n'], rows=c.get('rows') or 1, states=set()))
            e['states'].add(c['st'])
    for c in tables['fx2']:
        if c.get('u') and c.get('fw') and str(c['u']).startswith('/assets/'):
            sheets.setdefault(c['u'].split('?')[0], dict(c, kind='fx2', cols=c.get('cols') or c['n'], rows=c.get('rows') or 1, states={'fx'}))
    # on-screen FIGURE px of each key at zoom 1 on the phone = drawn cell px * figH / fh (every figH clip of a key shares the figure size)
    fig_px = {}
    for p, s in sheets.items():
        d = drawn.get(p)
        if d and s['kind'] == 'clip' and s.get('figH'):
            fig_px[s['key']] = max(fig_px.get(s['key'], 0), d * s['figH'] / s['fh'])
    hero_max = max([v for k, v in fig_px.items() if not any(x['key'] == k and x.get('mon') for x in tables['clips'])] or [0])
    plan = {}
    for p, s in sorted(sheets.items()):
        src = os.path.join(root, p.lstrip('/'))
        if not os.path.exists(src): continue
        kind = webp_kind(src)
        e = {'key': s['key'], 'kind': s['kind'], 'states': sorted(s['states']), 'src': kind, 'bytes': os.path.getsize(src),
             'u': s['u'], 'n': s['n'], 'fw': s['fw'], 'fh': s['fh'], 'cols': s['cols'], 'rows': s['rows'], 'figH': s.get('figH')}
        plan[p] = e
        if kind == 'animated' or (s['states'] & set(NOT_TIERED)):
            e['skip'] = 'idle/walk sheet (painted by the UI from the original)' if kind != 'animated' else 'animated'; continue
        ff = (s['figH'] / s['fh']) if s.get('figH') else 0
        kv = tex_sheet_k(s['fw'], s['fh'], s['cols'], s['rows'], ff)
        e['kV1140'] = kv
        k2 = None
        if s['kind'] == 'clip' and s.get('figH'):
            f = fig_px.get(s['key']) or (hero_max if not s.get('mon') else None)
            if f: k2 = TEXELS_PER_PX * f / s['figH']; e['figOnScreen'] = f
        elif drawn.get(p):
            k2 = TEXELS_PER_PX * drawn[p] / s['fh']; e['cellOnScreen'] = drawn[p]
        e['k2x'] = k2
        if s['kind'] == 'clip':
            e['trimHigh'] = (kind == 'lossless')
            # memory: never more than v1140 uploads; the trimmed square sheet spends it on figure, so k may rise above kv
            e['memBudget'] = round(s['fw'] * kv) * s['cols'] * round(s['fh'] * kv) * s['rows']
            # v1140's own rule lets a sheet go past 2048 (to 4096) only where 2048 would cut the figure under 160 px; a phone file may do the same, never more
            e['sideMax'] = max(SIDE_MAX, max(round(s['fw'] * kv) * s['cols'], round(s['fh'] * kv) * s['rows']))
        k = min([x for x in (1.0, k2) if x is not None])
        if s['kind'] == 'fx2': k = min(k, kv)
        e['kWant'] = k
    return plan


def main():
    global SHIP_BIGGER
    root = os.path.abspath(sys.argv[1]); dry = '--dry' in sys.argv; SHIP_BIGGER = '--ship-bigger' in sys.argv
    only = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
    here = os.path.dirname(os.path.abspath(__file__))
    tables = json.loads(subprocess.run(['node', os.path.join(here, 'dump_clips.js'), root, '-'], capture_output=True, text=True, check=True).stdout)
    drawn = json.load(open(os.path.join(here, 'condense_measure_' + VER + '.json')))['drawn']
    plan = plan_sheets(root, tables, drawn)
    # pass 1: trim at k = 1 to learn each clip sheet's trimmed shape, then set k under the memory budget
    jobs = []
    for p, e in plan.items():
        if only and e['key'] not in only: continue
        if e.get('skip') or 'kWant' not in e: continue
        jobs.append((p, e))
    with ProcessPoolExecutor(max(2, (os.cpu_count() or 4) - 2)) as ex:
        shapes = dict(zip([p for p, _ in jobs], ex.map(shape_of, [(root, e) for _, e in jobs], chunksize=2)))
    build_jobs = []
    for p, e in jobs:
        sh = shapes[p]; spec = {'u': e['u'], 'cols': e['cols'], 'rows': e['rows'], 'n': e['n'], 'fw': e['fw'], 'fh': e['fh'], 'figH': e['figH'],
                                'trimHigh': e.get('trimHigh'), 'trimPhone': e['kind'] == 'clip', 'repack': e['kind'] == 'clip',
                                'memBudget': e.get('memBudget'), 'sideMax': e.get('sideMax'), 'kFloor': e.get('kV1140') if e['kind'] == 'clip' else None}
        k = e['kWant']
        if e['kind'] == 'clip' and sh:
            tw, th = sh['w'] / e['fw'], sh['h'] / e['fh']                     # trimmed fraction of the cell
            c2, r2 = square_grid(e['n'], tw, th)
            area1 = c2 * r2 * (tw * e['fw']) * (th * e['fh'])                 # trimmed square sheet at k = 1, px
            kmem = math.sqrt(e['memBudget'] / area1)
            kside = e['sideMax'] / max(c2 * tw * e['fw'], r2 * th * e['fh'])
            e['kMem'], e['kSide'] = kmem, kside
            # never fewer figure px than a phone gets today (v1140), never more memory than it uploads today, never over 2048 px
            k = min(max(min(k, kmem), e['kV1140']), kside)
            if k < e['kV1140'] * 0.999:
                e['skip'] = 'cannot match v1140 within 2048 px'; k = None
        if k is not None and k > K_SKIP and not (e['kind'] == 'clip' and sh and (sh['w'] * sh['h'] < 0.92 * e['fw'] * e['fh'])):
            k = None                                                           # nothing to gain on the phone
        spec['k'] = k; e['k'] = k
        if k or spec['trimHigh']: build_jobs.append((root, spec, dry))
    with ProcessPoolExecutor(max(2, (os.cpu_count() or 4) - 2)) as ex:
        res = list(ex.map(build, build_jobs, chunksize=1))
    tiers, cellsman, built = {}, {}, []
    for r in res:
        p = r['u'].split('?')[0]; e = plan[p]; ent = {}
        if r.get('err'): e['err'] = r['err']; built.append({'path': p, 'err': r['err']}); continue
        hb = r['src_bytes']
        if 'h' in r:
            if r['h']['bytes'] < r['src_bytes']:
                ent['h'] = ['/' + r['h']['file'] + '?v=' + VER, r['h']['W'], r['h']['H'], r['h']['c'], r['h']['r'], [round(x, 6) for x in r['h']['tc']]]
                hb = r['h']['bytes']
            elif not dry: os.remove(os.path.join(root, r['h']['file']))
        if 'p' in r:
            ok = (SHIP_BIGGER or r['p']['bytes'] <= r['src_bytes']) and r['p']['bytes'] <= FILE_MAX and max(r['p']['W'], r['p']['H']) <= (e.get('sideMax') or SIDE_MAX) and not r['p']['below']
            e['pBytes'] = r['p']['bytes']; e['pShipped'] = ok
            if ok:
                ent['p'] = ['/' + r['p']['file'] + '?v=' + VER, r['p']['W'], r['p']['H'], r['p']['c'], r['p']['r'],
                            [round(x, 6) for x in r['p']['tc']] if r['p']['tc'] else None]
            elif not dry: os.remove(os.path.join(root, r['p']['file']))
        if ent:
            tiers[p] = ent; cellsman[p] = {t: r['hashes'][t] for t in ent}
        built.append({'path': p, 'src_bytes': r['src_bytes'], 'W': r['W'], 'H': r['H'],
                      'h': ({k2: r['h'][k2] for k2 in ('W', 'H', 'bytes')} if 'h' in ent else None),
                      'p': ({k2: r['p'][k2] for k2 in ('W', 'H', 'bytes', 'k', 'fig', 'c', 'r')} if 'p' in r else None), 'pShipped': 'p' in ent})
    if not dry:
        json.dump({'v': VER, 'sheets': tiers}, open(os.path.join(root, 'assets/anim/tiers_' + VER + '.json'), 'w'), separators=(',', ':'), sort_keys=True)
        json.dump(cellsman, open(os.path.join(here, 'condense_cells_' + VER + '.json'), 'w'), separators=(',', ':'), sort_keys=True)
        # the v1140 ratchet: an oversize original with a phone file is never loaded by a phone, so it leaves the frozen list (only shrinks)
        bl = os.path.join(root, 'tests/fixtures/sheet_size_baseline_1140.json')
        if os.path.exists(bl):
            B = json.load(open(bl, encoding='utf8')); n0 = len(B['files'])
            B['files'] = [f for f in B['files'] if not (f in tiers and 'p' in tiers[f])]
            if 'v1141' not in B['note']:
                B['note'] += ' v1141: an original with a phone tier file (assets/anim/tiers_1141.json) leaves the list - phones load the tier file.'
            with open(bl, 'w', encoding='utf8', newline=chr(10)) as fh: json.dump(B, fh, indent=1); fh.write(chr(10))
            print('baseline', n0, '->', len(B['files']))
    json.dump({'plan': plan, 'built': built}, open(os.path.join(here, 'condense_report_' + VER + '.json'), 'w'), indent=0, default=float)
    print('sheets', len(plan), 'built', len(res), 'tiered', len(tiers), 'phone', sum(1 for t in tiers.values() if 'p' in t), 'high-trim', sum(1 for t in tiers.values() if 'h' in t))
    if not dry:   # v1191: the phone's compressed copies are built FROM these tier files - rebuild them (cached: only changed sheets are encoded)
        subprocess.run([sys.executable, '-I', os.path.join(here, 'astc_sheets.py'), root], check=False)


def shape_of(job):
    root, e = job
    a = np.asarray(Image.open(os.path.join(root, e['u'].split('?')[0].lstrip('/'))).convert('RGBA'))
    if a.shape[1] != e['fw'] * e['cols'] or a.shape[0] != e['fh'] * e['rows']: return None
    cells, cw, ch = cells_of(a, e['cols'], e['rows'], min(e['n'], e['cols'] * e['rows']), e['fw'], e['fh'])
    x0, y0, w, h = trim_rect(cells, cw, ch)
    return {'x0': x0, 'y0': y0, 'w': w, 'h': h}


if __name__ == '__main__':
    main()
