"""v1141 condense check (run by tests/test_condense_1141.js). Prints one JSON object.

For every sheet in assets/anim/tiers_1141.json and every tier it lists:
  * the file decodes to exactly the W x H the table declares, as LOSSLESS WebP;
  * every cell, put back at its tc rectangle inside an empty cell of the untrimmed size, hashes to the cell manifest
    (tools/condense_cells_1141.json, the sha256 of the UNTRIMMED cell at that tier) - so a trimmed cell is pixel-identical
    to the untrimmed one, and nothing visible was cut;
  * a control copy with one visible pixel changed must FAIL the same check.
For a sample of sheets (--regen N) the untrimmed phone cells are rebuilt from the high source with the build's own
resampler and must hash to the manifest too (the manifest is the source, not a copy of the output).
Usage: py -I tools/condense_verify.py <worktree> [--regen N]"""
import json, os, random, sys
import numpy as np
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
import condense_sheets as C


def check(root, path, tier, e, man, poke=False):
    url, W, H, cols, rows, tc = e
    f = os.path.join(root, url.split('?')[0].lstrip('/'))
    if C.webp_kind(f) != 'lossless': return 'not lossless'
    a = np.asarray(Image.open(f).convert('RGBA')).copy()
    if a.shape[1] != W or a.shape[0] != H: return 'size %dx%d != %dx%d' % (a.shape[1], a.shape[0], W, H)
    m = man[tier]; cw, ch = m['cw'], m['ch']; x0, y0, w, h = m['rect']
    if tc is None:
        if (x0, y0, w, h) != (0, 0, cw, ch): return 'untrimmed entry with a trim rect'
    elif abs(tc[0] - x0 / cw) > 1e-5 or abs(tc[1] - y0 / ch) > 1e-5 or abs(tc[2] - w / cw) > 1e-5 or abs(tc[3] - h / ch) > 1e-5: return 'tc mismatch'
    n = len(m['cells'])
    if W != w * cols or H != h * rows or cols * rows < n: return 'layout %dx%d of %dx%d cells != %dx%d' % (cols, rows, w, h, W, H)
    if poke:   # the control: one visible pixel of cell 0 nudged
        ys, xs = np.nonzero(a[:h, :w, 3] > 0)
        if len(ys): a[ys[0], xs[0], 0] ^= 1
    for i in range(n):
        r, q = divmod(i, cols)
        full = np.zeros((ch, cw, 4), np.uint8); full[y0:y0 + h, x0:x0 + w] = a[r * h:(r + 1) * h, q * w:(q + 1) * w]
        if C.cell_hash(full) != m['cells'][i]: return 'cell %d differs' % i
    return None


def main():
    root = os.path.abspath(sys.argv[1]); regen = int(sys.argv[sys.argv.index('--regen') + 1]) if '--regen' in sys.argv else 0
    tiers = json.load(open(os.path.join(root, 'assets/anim/tiers_' + C.VER + '.json')))['sheets']
    man = json.load(open(os.path.join(here, 'condense_cells_' + C.VER + '.json')))
    bad, n, ctl = [], 0, None
    for p, e in sorted(tiers.items()):
        for t in e:
            n += 1; err = check(root, p, t, e[t], man[p])
            if err: bad.append([p, t, err])
            if ctl is None:
                ctl = check(root, p, t, e[t], man[p], poke=True)
    regen_bad, sample, src_bad = [], [], []
    # a trimmed HIGH file is checked against its own source file directly (no trust in the manifest): same visible cells
    tables = None
    for p, e in sorted(tiers.items()):
        if 'h' not in e: continue
        if tables is None:
            tables = json.loads(__import__('subprocess').run(['node', os.path.join(here, 'dump_clips.js'), root, '-'], capture_output=True, text=True, check=True).stdout)
            decl = {}
            for c in tables['clips'] + tables['fx2']:
                if c.get('u'): decl.setdefault(c['u'].split('?')[0], c)
        c = decl[p]; cols = c.get('cols') or c['n']; rows = c.get('rows') or 1
        a = np.asarray(Image.open(os.path.join(root, p.lstrip('/'))).convert('RGBA'))
        cells, cw, ch = C.cells_of(a, cols, rows, min(c['n'], cols * rows), c['fw'], c['fh'])
        if [C.cell_hash(x) for x in cells] != man[p]['h']['cells']: src_bad.append(p)
    if regen:
        tables = json.loads(__import__('subprocess').run(['node', os.path.join(here, 'dump_clips.js'), root, '-'], capture_output=True, text=True, check=True).stdout)
        decl = {}
        for c in tables['clips'] + tables['fx2']:
            if c.get('u'): decl.setdefault(c['u'].split('?')[0], c)
        ps = sorted(p for p in tiers if 'p' in tiers[p]); random.Random(1141).shuffle(ps); sample = ps[:regen]
        for p in sample:
            c = decl[p]; cols = c.get('cols') or c['n']; rows = c.get('rows') or 1
            a = np.asarray(Image.open(os.path.join(root, p.lstrip('/'))).convert('RGBA'))
            cells, cw, ch = C.cells_of(a, cols, rows, min(c['n'], cols * rows), c['fw'], c['fh'])
            m = man[p]['p']
            got = [C.cell_hash(C.resample_cell(x, m['cw'], m['ch'])) for x in cells[:len(m['cells'])]]
            if got != m['cells']: regen_bad.append(p)
    print(json.dumps({'checked': n, 'sheets': len(tiers), 'bad': bad[:20], 'nbad': len(bad), 'control': ctl, 'regen': sample, 'regen_bad': regen_bad, 'high_src_checked': sum(1 for e in tiers.values() if 'h' in e), 'high_src_bad': src_bad}))


if __name__ == '__main__':
    main()
