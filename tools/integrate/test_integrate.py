"""Unit checks of the pipeline's own rules (no Archive, no GPU, ~10 s): python -I tools/integrate/test_integrate.py
Each rule is checked against a number a shipped release used, and each check has a CONTROL that must fail.
The end-to-end proof (Korvux v1162 re-cut byte for byte) is tools/integrate/README.md 'Proof'.
"""
import json
import os
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from integrate import frames as FR, normalise as N, cut as CU, wire as W, compare as CP, fx as FX  # noqa: E402
from integrate.common import parse_spec, lin, num  # noqa: E402

P = F = 0


def ck(name, ok, detail=''):
    global P, F
    if ok:
        P += 1
        print('  ok  ' + name)
    else:
        F += 1
        print('  FAIL ' + name + (' - ' + str(detail)[:400] if detail else ''))


# frame maps: the v1162 Korvux maps (specs_korvux.py) from the pipeline's rules
KORVUX = json.load(open(os.path.join(os.path.dirname(__file__), 'heroes', 'korvux_1162.json')))
SHIPPED = {  # tools/specs.json of v1162, as shipped
    'attack': '0,2,4,5,7,9,11,12,14,16,18,20,21,23,25,27,29,30,32,34,36,38,39,41,43,45,46,48,50,51,52,53,54,57,60,62,65,68,71,74,76,79,82,85,88,90,93,96',
    'walk': '29,30,32,33,35,36,37,39,40,42,43,44,46,47,48,50,51,53,54,55,57,58,60,61,62,64,65,66,68,69,71,72,73,75,76,78',
    'hit': '26,28,30,31,33,35,36,38,40,84,86,89,91,94,96',
    'ult': '0,1,2,3,4,6,7,8,9,10,11,12,13,14,16,17,18,19,20,21,22,23,24,25,27,28,29,30,31,32,33,35,37,40,42,44,46,49,51,53,55,58,60,62,64,66,68,72'}
for st, spec in SHIPPED.items():
    fr, t = FR.frames_for(st, KORVUX['states'][st])
    ck('frame map %s = v1162 (%d cells)' % (st, len(fr)), fr == parse_spec(spec), fr)
fr, t = FR.frames_for('idle', {})
ck('idle default = the whole clip every 2nd frame, 62 @12', fr == list(range(0, 124, 2)) and t['fps'] == 12)
fr, t = FR.frames_for('walk', {'from': 29, 'len': 50})
ck('walk 36 cells, fps 17.28, stride 0.0864, loop [0,36] (v1162)', len(fr) == 36 and num(t['fps']) == '17.28' and num(t['stride']) == '0.0864' and t['loop'] == [0, 36])
fr, _ = FR.frames_for('attack', {'contact': 27, 'contactFrame': 51, 'end': 100, 'hold': 1})
ck('a hold-1 action puts its contact frame on its contact cell, 48 cells (Hobb attack c27 = f51)', len(fr) == 48 and fr[27] == 51 and fr[26] == 50 and fr[28] == 52)
fr, _ = FR.frames_for('green', {'contact': 18, 'contactFrame': 53, 'end': 112, 'hold': 0})
ck('a hold-0 action: Hobb green = r(0,52,18) + [53] + r(54,112,29) (v1175 specs_hk.py)', fr == lin(0, 52, 18) + [53] + lin(54, 112, 29))
fr0, _ = FR.frames_for('attack', {'contact': 27, 'contactFrame': 51, 'end': 100, 'hold': 0})
fr1, _ = FR.frames_for('attack', {'contact': 27, 'contactFrame': 51, 'end': 100, 'hold': 1})
ck('CONTROL: a hold-0 map is not the hold-1 map (contact frame still on cell 27)', fr0 != fr1 and fr0[27] == 51)
# the Korvux fit grid holds the v1162 candidates
g = N.k_grid(647 / 929)
ck('k grid around the height ratio holds 0.698 and 0.700 (the v1162 fit)', any(abs(k - 0.698) < 1e-9 for k in g) and any(abs(k - 0.700) < 1e-9 for k in g))
# fit_scale recovers a known scale + shift on a synthetic figure; CONTROL: the unscaled figure fits worse
I = np.zeros((300, 400), bool)
I[60:260, 170:230] = True
I[90:140, 120:280] = True
RI = Image.fromarray((I * 255).astype(np.uint8))
k_true = 0.8
S = np.asarray(RI.resize((round(400 * k_true), round(300 * k_true)), Image.BILINEAR)) > 127
T = np.zeros((300, 400), bool)
T[30:30 + S.shape[0], 50:50 + S.shape[1]] = S
iou, k, ox, oy = N.fit_scale(I, T, N.k_grid(0.8))
ck('fit_scale recovers x0.800 and the shift (50, 30) at IoU 1', abs(k - 0.8) < 1e-9 and (ox, oy) == (50, 30) and iou > 0.999, (iou, k, ox, oy))
iou1, *_ = N.fit_scale(I, T, [1.0])
ck('CONTROL: at x1.0 the same figure fits worse (IoU %.3f)' % iou1, iou1 < 0.8)
# BATTLE_ANIM line format = the live page's (v1162 walk / blue lines)
o = W.entry_obj(type('C', (), {'hero': 'korvux', 'version': '1162', 'st': lambda self, s: KORVUX['states'][s]})(), 'walk',
                dict(n=36, fw=365, fh=255, cols=5, rows=8, figH=234, feet=247, cx=172.5, top=13, timing=dict(fps=36 * 24 / 50, stride=0.12 * 36 / 50, loop=[0, 36])))
ck('entry line = the live walk line', W.entry_line('walk', o).strip() == "walk:{u:'/assets/anim/korvux/korvux_walk_1162.webp?v=1162',n:36,fw:365,fh:255,cols:5,rows:8,loop:[0,36],figH:234,feet:247,cx:172.5,fps:17.28,stride:0.0864,flip:false,top:13}", W.entry_line('walk', o))
o = W.entry_obj(type('C', (), {'hero': 'korvux', 'version': '1162', 'st': lambda self, s: KORVUX['states'][s]})(), 'blue',
                dict(n=48, fw=363, fh=204, cols=5, rows=10, figH=169, feet=190, cx=169.0, top=21, timing=dict(fps=24)))
ck('entry line = the live blue line (cx 169.0 written 169, contact 30)', W.entry_line('blue', o).strip() == "blue:{u:'/assets/anim/korvux/korvux_blue_1162.webp?v=1162',n:48,fw:363,fh:204,cols:5,rows:10,figH:169,feet:190,cx:169,fps:24,flip:false,top:21,contact:30}")
ck('data equality: 169.0 == 169, CONTROL 169.1 != 169', CP._eq({'cx': 169.0}, {'cx': 169}) and not CP._eq({'cx': 169.1}, {'cx': 169}))
# block patch on a synthetic CRLF page: only the hero's block changes
page = 'x\r\nconst BATTLE_ANIM = {\r\n  aaa:{\r\n    idle:{u:1}\r\n  },\r\n  korvux:{\r\n    idle:{u:2},\r\n    walk:{u:3}\r\n  },\r\n  zzz:{\r\n    idle:{u:4}\r\n  }\r\n};\r\n'
cfg = type('C', (), {'hero': 'korvux', 'version': '9', 'order': ['idle'], 'name': 'K', 'review': 'R', 'states': {'idle': {}}, 'd': {'pageNote': 'note'}})()
s2 = W.patch_block(page, cfg, {'idle': {'u': '/n', 'n': 1}})
ck('the hero block is replaced, its neighbours untouched', "  aaa:{\r\n    idle:{u:1}\r\n  },\r\n  korvux:{\r\n    /* note */\r\n    idle:{u:'/n',n:1}\r\n  },\r\n  zzz:{" in s2 and s2.endswith("  zzz:{\r\n    idle:{u:4}\r\n  }\r\n};\r\n"), s2)
# fringe: a planted green rim is seen; CONTROL a clean edge reads 0
a = np.zeros((40, 40, 4), np.uint8)
a[10:30, 10:30] = (200, 120, 80, 255)
a[9, 10:30] = (60, 160, 60, 120)
f1 = CU.fringe(a)
a[9, 10:30] = (160, 120, 80, 120)
f0 = CU.fringe(a)
ck('fringe sees a planted green rim (%.1f%% of edge px > 24) and a clean edge reads 0' % f1['edge_gt24'], f1['edge_gt24'] > 50 and f0['edge_gt24'] == 0)
# FX: the green key against an art with no green, its fringe and the placement measures
with tempfile.TemporaryDirectory() as d:
    raw = os.path.join(d, 'raw')
    os.makedirs(raw)
    for i in range(6):
        im = np.zeros((300, 400, 3), np.uint8)
        im[:] = (0, 250, 0)
        yy, xx = np.mgrid[0:300, 0:400]
        disc = np.hypot(xx - 200 - 10 * i, yy - 150) < 60
        im[disc] = (220, 120, 40)
        Image.fromarray(im).save(os.path.join(raw, 'f%03d.png' % (i + 1)))
    o = dict(plate='green', d0=40.0, d1=150.0, ext=-30.0, ratio=None, deviol=True, crop=None, ramp=0.8, fade=[0, 0, 0, 0], border=12, frames='0:6', perspective=False)
    G, rep = FX.cut_fx(raw, os.path.join(d, 'o.webp'), os.path.join(d, 'm.webp'), o)
    pl = FX.place(G, rep, o)
    ck('FX key: an orange disc on a green plate keys with no visible green (%.4f%%)' % rep['fringe_q95']['green_edge'], rep['fringe_q95']['green_edge'] == 0 and rep['fringe_q95']['green_body'] == 0)
    ck('FX place: the disc is centred, dw ~ its diameter share, the art drifts right (painted right)', abs(pl['disc']['cy'] - 0.5) < 0.05 and 0.5 < pl['disc']['dw'] < 1.0 and pl['facing']['painted'] == 'right', pl)
    e = dict(file='t_16oct', show={'state': 'green', 'cell': 7}, placement='ground', life={'mode': 'real', 'fps2': 12})
    line = FX.js(FX.fx2_entry(e, rep, pl, '9'))
    ck('FX2_DEF entry carries spawn, the disc and real-time life', 'spawn:7' in line and 'disc:{' in line and 'rt:true' in line and 'fps2:12' in line, line)
print(('FAIL ' if F else 'PASS ') + '%d checks' % P + (', %d failed' % F if F else ''))
sys.exit(1 if F else 0)
