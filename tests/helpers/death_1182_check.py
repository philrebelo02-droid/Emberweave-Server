# v1180 hero deaths - pixel checks for tests/test_death_state.js (run with python -I).
# argv: <root> <json list of {k, parts:[{u,fw,fh,cols,rows,n,first}], idle:{u,fw,fh,cols,rows}}>
# per hero: each sheet's decoded size and file kind, the visible key lean over all its sheets, the pixels left in every cell (the ash ending), and the
# standing figure in death cell 0 and idle cell 0 (rows of alpha > 100, in each clip's own logical cell px) for the size + foot check.
import json, os, struct, sys
import numpy as np
from PIL import Image
root = sys.argv[1]; items = json.load(open(sys.argv[2][1:], encoding='utf-8')) if sys.argv[2].startswith('@') else json.loads(sys.argv[2])   # v1190: @file (28 deaths x 6 sheets outgrew the command line)
def kind(p):
    d = open(p, 'rb').read(1 << 20); i = 12; out = []
    while i + 8 <= len(d):
        t = d[i:i + 4]; n = struct.unpack('<I', d[i + 4:i + 8])[0]; out.append(t.decode('ascii', 'replace')); i += 8 + n + (n & 1)
    return out
def fig(a):
    ys, xs = np.where(a > 100)
    return [int(ys.min()), int(ys.max()) + 1, float(xs.mean())] if len(xs) else None
res = {}
for it in items:
    I = it['idle']; sheets = []; cellpx = []; vis_n = 0; g_n = 0; m_n = 0; fig0 = None
    for P in it['parts']:
        f = os.path.join(root, P['u'].split('?')[0].lstrip('/')); im = Image.open(f).convert('RGBA'); a = np.asarray(im).astype(int)
        fw, fh, C = P['fw'], P['fh'], P['cols']
        cell = lambda i: a[(i // C) * fh:(i // C + 1) * fh, (i % C) * fw:(i % C + 1) * fw]
        cellpx += [int((cell(i)[..., 3] > 0).sum()) for i in range(P['n'])]
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
                        death_fig0=fig0, idle_fig0=fig(ic), idle_green_pct=ig, idle_magenta_pct=im_, decoded_mb=round(sum(s['size'][0] * s['size'][1] * 4 for s in sheets) / 1048576, 2))
print(json.dumps(res))
