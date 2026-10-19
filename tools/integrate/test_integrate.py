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
from integrate import frames as FR, normalise as N, cut as CU, wire as W, compare as CP, fx as FX, verify as V  # noqa: E402
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


# The source gate must reject negative labels before it resolves any media.
from types import SimpleNamespace
with tempfile.TemporaryDirectory() as approval_dir:
    labels = ['NOT PASS', 'BYPASS', 'Phil PASS pending', 'FAIL; previously PASS',
              'Phil PASS - pending', 'Phil PASS - not approved',
              'Phil PASS - revoked', 'Phil PASS - superseded',
              'Phil PASS - failed', 'Phil PASS - on hold', 'Phil PASS - redo']
    with open(os.path.join(approval_dir, 'clean-source-manifest.json'), 'w') as f:
        json.dump([dict(slot='idle', status=s) for s in labels], f)
    cfg = SimpleNamespace(review_dir=approval_dir, work=approval_dir, d={}, st=lambda _: {})
    rejected = V.verify(cfg, check_streams=False)
    ck('negative and pending PASS phrases never enter source verification',
       len(rejected['rejected']) == len(labels) and not rejected['states'] and not rejected['problems'])
ck('explicit Phil PASS and PASS labels remain accepted', V.approved_status('Phil PASS') and V.approved_status('PASS'))
with tempfile.TemporaryDirectory() as approval_dir:
    # Actual labels in the six manifests identified by Grok's compatibility review.
    real_labels = {
        'Brannus': 'Phil PASS - approved 16OCT2026',
        'Quorrel': 'Phil PASS - approved 16OCT2026',
        'Meridian': 'Phil PASS - corrected set approved 16OCT2026',
        'Rafe Marrow': 'Phil PASS - corrected set approved 16OCT2026',
        'Hobb Kilnmask': 'Phil PASS - final set approved for Claude handoff',
        'Kharos Bloomknife': 'Phil PASS - final set approved for Claude handoff',
    }
    with open(os.path.join(approval_dir, 'clean-source-manifest.json'), 'w') as f:
        # Supplying the required export type isolates approval from export-format errors.
        json.dump([dict(slot='idle', status=s, export='Without Watermark') for s in real_labels.values()] +
                  [dict(slot='idle', status='Phil PASS 16OCT2026', export='Without Watermark')], f)
    cfg = SimpleNamespace(review_dir=approval_dir, work=approval_dir, d={}, st=lambda _: {})
    accepted = V.verify(cfg, check_streams=False)
    ck('six annotated approval labels and the death-review date label reach media checks',
       not accepted['rejected'] and len(accepted['problems']) == 7 and
       all('silent twin missing' in p for p in accepted['problems']))

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
# SOUND rows: the proposal against the rows v1162 / v1175 moved by hand (engine moments as engine_moments.js measures them on each BASE)
from integrate import sound as SO  # noqa: E402
ENG = {'korvux': {'blue': dict(release=0.5193, land=0.8473, releaseCell=18, landCell=30), 'ult': dict(release=0.82, land=1.3667, releaseCell=29, landCell=48),
                  'green': dict(release=0.5193, land=0.5193, releaseCell=18, landCell=18)},
       'hobb': {'blue': dict(release=0.5193, land=0.5193, releaseCell=18, landCell=18), 'ult': dict(release=0.82, land=1.148, releaseCell=29, landCell=40)},
       'kharos': {'blue': dict(release=0.5193, land=0.5193, releaseCell=18, landCell=18), 'ult': dict(release=0.82, land=0.82, releaseCell=29, landCell=29)}}
ROWS = {'korvux': {'S0171': dict(slot='green', rule='land'), 'S0172': dict(slot='blue', rule='cast'), 'S0174': dict(slot='ult', rule='cast')},
        'hobb': {'S0245': dict(slot='blue', rule='cast'), 'S0246': dict(slot='ult', rule='cast')},
        'kharos': {'S0298': dict(slot='blue', rule='cast'), 'S0300': dict(slot='ult', rule='cast')}}
SHIPPED_SOUND = {'korvux': {'S0172': 'land', 'S0174': 'land'}, 'hobb': {'S0245': 'release', 'S0246': 'land'}, 'kharos': {'S0298': 'release', 'S0300': 'release'}}
for h in SHIPPED_SOUND:
    got = {k: v['rule'] for k, v in SO.propose(ROWS[h], ENG[h]).items()}
    ck('sound proposal %s = the shipped hand rows %s (a row already off cast is left alone)' % (h, SHIPPED_SOUND[h]), got == SHIPPED_SOUND[h], got)
ctl = {k: v['rule'] for k, v in SO.propose(ROWS['kharos'], dict(ENG['kharos'], ult=ENG['hobb']['ult'])).items()}
ck('CONTROL: give Kharos\' ult a landing after its release and the proposal moves S0300 to land', ctl['S0300'] == 'land', ctl)
ch, src = SO.decide({'S0174': 'release'}, ROWS['korvux'], ENG['korvux'])
ck('the config key decides over the proposal ({"S0174": "release"} -> only S0174, release); {} = no change', ch == {'S0174': 'release'} and src == 'config' and SO.decide({}, ROWS['korvux'], ENG['korvux'])[0] == {})
try:
    SO.decide({'S0999': 'land'}, ROWS['korvux'], ENG['korvux'])
    ck('CONTROL: a row that is not the hero\'s is refused', False)
except ValueError:
    ck('CONTROL: a row that is not the hero\'s is refused', True)
# the three text edits: BASE 1debe711's files -> v1162 31e692b9's (git objects, when the repo has them)
import subprocess  # noqa: E402
gs = lambda ref: subprocess.run(['git', 'show', ref], cwd=os.path.join(os.path.dirname(__file__), '..', '..'), capture_output=True).stdout.decode('utf-8')
m0, m1 = gs('1debe711:assets/audio/sfx/sfx_manifest.json'), gs('31e692b9:assets/audio/sfx/sfx_manifest.json')
if m0 and m1:
    KCH = {'S0172': 'land', 'S0174': 'land'}
    ck('manifest edit: 1debe711 + the Korvux rows = 31e692b9\'s sfx_manifest.json byte for byte', SO.edit_manifest(m0, KCH) == m1)
    ck('CONTROL: the unedited 1debe711 manifest is not 31e692b9\'s', m0 != m1)
    p0, p1 = gs('1debe711:emberweave-heroes.html'), gs('31e692b9:emberweave-heroes.html')
    sfx = lambda s: s[s.index('const SFX_DATA='):s.index('\n', s.index('const SFX_DATA='))]
    rk = {k: dict(slot=v['slot']) for k, v in ROWS['korvux'].items()}
    ck('page edit: 1debe711 + the Korvux rows = 31e692b9\'s SFX_DATA line', sfx(SO.edit_page(p0, 'korvux', rk, KCH)) == sfx(p1) and sfx(p0) != sfx(p1))
    b0 = gs('1debe711:tools/build_sfx.py')
    b2 = SO.edit_rules(b0, KCH, {'S0172': 'c1', 'S0174': 'c2'})
    NL = '\r\n' if '\r\n' in b0 else '\n'
    R0, R2 = SO.rules_dict(b0), SO.rules_dict(b2)
    ck('RULES edit: two new lines before the closing brace, the file\'s own line ends kept, every other entry unchanged',
       R2['S0172'] == {'rule': 'land'} and R2['S0174'] == {'rule': 'land'} and {k: v for k, v in R2.items() if k not in KCH} == R0 and
       b2.replace("    'S0172': {'rule': 'land'},                               # c1" + NL, '').replace("    'S0174': {'rule': 'land'},                               # c2" + NL, '') == b0, b2[b2.index("'S0172'") - 80:b2.index("'S0172'") + 200])
    b3 = SO.edit_rules(b2, {'S0172': 'release'}, {})
    ck('RULES edit on an existing line changes only its rule (no second line)', b3.count("'S0172'") == 1 and SO.rules_dict(b3)['S0172'] == {'rule': 'release'})
    try:
        SO.edit_page(p0, 'korvux', {'S0999': dict(slot='blue')}, {'S0999': 'land'})
        ck('CONTROL: a page edit for a row the page does not hold is refused', False)
    except ValueError:
        ck('CONTROL: a page edit for a row the page does not hold is refused', True)
else:
    print('  info no git objects for 1debe711 / 31e692b9 here: the byte checks against v1162 are skipped')
print(('FAIL ' if F else 'PASS ') + '%d checks' % P + (', %d failed' % F if F else ''))
sys.exit(1 if F else 0)
