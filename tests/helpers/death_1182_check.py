# v1180 hero deaths - pixel checks for tests/test_death_state.js (run with python -I).
# argv: <root> <json list of {k, parts:[{u,fw,fh,cols,rows,n,first}], idle:{u,fw,fh,cols,rows}}>
# per hero: each sheet's decoded size and file kind, the visible key lean over all its sheets, the pixels left in every cell (the ash ending), and the
# standing figure in death cell 0 and idle cell 0 (rows of alpha > 100, in each clip's own logical cell px) for the size + foot check;
# v1299: the plate-ghost pixels of every cell and each sheet's sha256 (the plate-residue checks).
import hashlib, json, os, struct, sys
import numpy as np
from PIL import Image
root = sys.argv[1]; items = json.load(open(sys.argv[2][1:], encoding='utf-8')) if sys.argv[2].startswith('@') else json.loads(sys.argv[2])   # v1190: @file (28 deaths x 6 sheets outgrew the command line)
def kind(p):
    d = open(p, 'rb').read(1 << 20); i = 12; out = []
    while i + 8 <= len(d):
        t = d[i:i + 4]; n = struct.unpack('<I', d[i + 4:i + 8])[0]; out.append(t.decode('ascii', 'replace')); i += 8 + n + (n & 1)
    return out
# v1299 PLATE GHOST: a plate flicker the old key could not explain came out as a FLAT light grey blotch (Hurne v1190 cell 6: 18.7% of cell 0).
# ghost px = drawn (alpha >= 128), neutral (max-min <= 10), mid-light (80 <= Y <= 170), flat (7x7 std of Y <= 4), opened twice (3x3) - numpy only
def _box(x, r):
    c = np.pad(x, ((r + 1, r), (r + 1, r)), mode='edge').cumsum(0).cumsum(1); n = 2 * r + 1
    return (c[n:, n:] - c[:-n, n:] - c[n:, :-n] + c[:-n, :-n]) / float(n * n)
def _morph(m, it, f):
    for _ in range(it):
        p = np.pad(m, 1, constant_values=(0 if f is np.logical_or else 1)); o = p[1:-1, 1:-1].copy()
        for dy in (0, 1, 2):
            for dx in (0, 1, 2): o = f(o, p[dy:dy + m.shape[0], dx:dx + m.shape[1]])
        m = o
    return m
def ghost_px(c):
    a = c.astype(np.float64); Y = a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114; ch = a[..., :3].max(-1) - a[..., :3].min(-1)
    sd = np.sqrt(np.maximum(_box(Y * Y, 3) - _box(Y, 3) ** 2, 0))
    g = (c[..., 3] >= 128) & (ch <= 10) & (Y >= 80) & (Y <= 170) & (sd <= 4)   # a plate shade sits near the plate's own brightness; a white cloak (Umbris, Y 170-236) is art
    return int(_morph(_morph(g, 2, np.logical_and), 2, np.logical_or).sum())
def fig(a):
    ys, xs = np.where(a > 100)
    return [int(ys.min()), int(ys.max()) + 1, float(xs.mean())] if len(xs) else None
res = {}
for it in items:
    if it.get('cell'):   # v1299 CONTROL: one stored cell (the v1190 Hurne flicker cell)
        c = np.asarray(Image.open(os.path.join(root, it['cell'])).convert('RGBA')); res[it['k']] = dict(ghost=ghost_px(c), vis=int((c[..., 3] >= 8).sum())); continue
    I = it['idle']; ghosts = []; shas = {}; sheets = []; cellpx = []; vis_n = 0; g_n = 0; m_n = 0; fig0 = None
    for P in it['parts']:
        f = os.path.join(root, P['u'].split('?')[0].lstrip('/')); im = Image.open(f).convert('RGBA'); a = np.asarray(im).astype(int)
        fw, fh, C = P['fw'], P['fh'], P['cols']
        cell = lambda i: a[(i // C) * fh:(i // C + 1) * fh, (i % C) * fw:(i % C + 1) * fw]
        cellpx += [int((cell(i)[..., 3] > 0).sum()) for i in range(P['n'])]
        ghosts += [ghost_px(cell(i)) for i in range(P['n'])]; shas[os.path.basename(f)] = hashlib.sha256(open(f, 'rb').read()).hexdigest()
        if P['first'] == 0: fig0 = fig(cell(0)[..., 3])
        vis = a[..., 3] >= 8; vis_n += int(vis.sum())
        g_n += int((((a[..., 1] - np.maximum(a[..., 0], a[..., 2])) > 24) & vis).sum()); m_n += int((((np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) > 24) & vis).sum())
        sheets.append(dict(u=P['u'], size=[im.width, im.height], kind=kind(f), bytes=os.path.getsize(f)))
    fi = os.path.join(root, I['u'].split('?')[0].lstrip('/')); si = Image.open(fi).convert('RGBA')
    sx = si.width / (I['fw'] * I['cols']); sy = si.height / (I['fh'] * I['rows'])
    ic = np.asarray(si.crop((0, 0, round(I['fw'] * sx), round(I['fh'] * sy))).resize((I['fw'], I['fh']), Image.LANCZOS))[..., 3].astype(int)
    ia = np.asarray(si).astype(int); iv = ia[..., 3] >= 8   # v1196: the hero's OWN approved idle art leaning to each plate colour (a peacock on green is green)
    ig = round(100.0 * int((((ia[..., 1] - np.maximum(ia[..., 0], ia[..., 2])) > 24) & iv).sum()) / max(1, int(iv.sum())), 4); im_ = round(100.0 * int((((np.minimum(ia[..., 0], ia[..., 2]) - ia[..., 1]) > 24) & iv).sum()) / max(1, int(iv.sum())), 4)
    res[it['k']] = dict(sheets=sheets, cellpx=cellpx, green_pct=round(100.0 * g_n / max(1, vis_n), 4), magenta_pct=round(100.0 * m_n / max(1, vis_n), 4),
                        death_fig0=fig0, idle_fig0=fig(ic), idle_green_pct=ig, idle_magenta_pct=im_, decoded_mb=round(sum(s['size'][0] * s['size'][1] * 4 for s in sheets) / 1048576, 2),
                        ghost=ghosts, sheet_sha=shas, idle_ghost=ghost_px(np.asarray(si.crop((0, 0, round(I['fw'] * sx), round(I['fh'] * sy))).resize((I['fw'], I['fh']), Image.LANCZOS))),
                        idle_vis=int((ic >= 8).sum()))
print(json.dumps(res))
