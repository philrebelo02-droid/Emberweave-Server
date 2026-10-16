"""EXTRACT + KEY: the silent twin -> raw/<st>/fNNN.png (every frame, passthrough) -> cs10-keyed keyed/<st>/kNNN.png + measure_<st>.json.

The keyer is the shared cs10.py (Archive Pipeline tools) exactly as measure.py ran it for Carn ... Hobb / Kharos: the plate = the median
of frame 0's 4-px border, SHEET_LOSSLESS + ALPHA_SOFT + ALPHA_FLOOR 4. Recorded per frame: the alpha > 40 box (the crop), and for a
GHOST state (a semi-transparent passive, Kharos's camouflage) also the alpha > 8 box, so a faint figure still sets the crop. Frame 0's
standing figure (alpha > 60: top, sole, cx) is the anchor reference. The four 120x60 corners are counted for a watermark (must be 0).
"""
import json
import os
import subprocess
from concurrent.futures import ProcessPoolExecutor

import numpy as np
from PIL import Image

from .common import PIPELINE_TOOLS, log, die

CS10_ENV = dict(SHEET_LOSSLESS='1', ALPHA_SOFT='1', ALPHA_FLOOR='4')


def extract(cfg, ver_res, states=None, jobs=4):
    todo = []
    for st, v in ver_res['states'].items():
        if states and st not in states:
            continue
        d = os.path.join(cfg.work, 'raw', st)
        if os.path.isdir(d) and len([f for f in os.listdir(d) if f.endswith('.png')]) == v['frames']:
            continue
        os.makedirs(d, exist_ok=True)
        for f in os.listdir(d):
            os.remove(os.path.join(d, f))
        todo.append((st, v['silent'], d))
    procs = []
    for st, src, d in todo:   # ffmpeg decodes one clip per process, `jobs` at a time
        procs.append((st, subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-i', src, '-fps_mode', 'passthrough', os.path.join(d, 'f%03d.png')])))
        if len(procs) >= jobs:
            st0, p0 = procs.pop(0)
            if p0.wait():
                die('ffmpeg failed on ' + st0)
    for st0, p0 in procs:
        if p0.wait():
            die('ffmpeg failed on ' + st0)
    counts = {}
    for st, v in ver_res['states'].items():
        if states and st not in states:
            continue
        n = len([f for f in os.listdir(os.path.join(cfg.work, 'raw', st)) if f.endswith('.png')])
        counts[st] = n
        if n != v['frames']:
            die('%s: %d frames extracted, manifest says %d' % (st, n, v['frames']))
    log(cfg.work, 'extract ' + ' '.join('%s %d' % kv for kv in counts.items()))
    return counts


def _key_state(args):
    work, st, n, cs10_dir, ghost = args
    for k, v in CS10_ENV.items():
        os.environ[k] = v
    import sys
    sys.path.insert(0, cs10_dir)
    import cs10
    raw = os.path.join(work, 'raw', st)
    kd = os.path.join(work, 'keyed', st)
    os.makedirs(kd, exist_ok=True)
    im = np.asarray(Image.open(os.path.join(raw, 'f001.png')).convert('RGB')).astype(int)
    border = np.concatenate([im[:4].reshape(-1, 3), im[-4:].reshape(-1, 3), im[:, :4].reshape(-1, 3), im[:, -4:].reshape(-1, 3)])
    key = tuple(int(v) for v in np.median(border, axis=0))
    cs10.set_chroma(key)
    res = dict(key=key, bbox=[], bbox8=[], alpha_mean=[], small=[])
    for i in range(n):
        rgb = np.asarray(Image.open(os.path.join(raw, 'f%03d.png' % (i + 1))).convert('RGB'))
        k = cs10.key_frame(rgb)
        Image.fromarray(k, 'RGBA').save(os.path.join(kd, 'k%03d.png' % i), compress_level=1)
        a = k[..., 3]
        ys, xs = np.where(a > 40)
        res['bbox'].append([int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1] if len(xs) else None)
        ys8, xs8 = np.where(a > 8)
        res['bbox8'].append([int(xs8.min()), int(ys8.min()), int(xs8.max()) + 1, int(ys8.max()) + 1] if len(xs8) else None)
        m = a > 8
        res['alpha_mean'].append([int(m.sum()), round(float(a[m].mean()), 1) if m.any() else 0])
        if i == 0:
            ys, xs = np.where(a > 60)
            res['f0'] = dict(top=int(ys.min()), sole=int(ys.max()) + 1, cx=float(xs.mean()), x0=int(xs.min()), x1=int(xs.max()) + 1)
        if i in (0, 40, 80, n - 1):
            c = [rgb[:60, :120], rgb[:60, -120:], rgb[-60:, :120], rgb[-60:, -120:]]
            res.setdefault('corners', []).append(int(sum((np.abs(x.astype(int) - np.array(key)).sum(-1) > 90).sum() for x in c)))
    res['size'] = [int(im.shape[1]), int(im.shape[0])]
    res['ghost'] = bool(ghost)
    with open(os.path.join(work, 'measure_%s.json' % st), 'w') as f:
        json.dump(res, f)
    return st, res['key'], res['f0'], res['corners']


def key_all(cfg, ver_res, states=None, jobs=8, cs10_dir=PIPELINE_TOOLS, force=False):
    todo = []
    for st, v in ver_res['states'].items():
        if states and st not in states:
            continue
        mp = os.path.join(cfg.work, 'measure_%s.json' % st)
        if os.path.exists(mp) and not force:
            continue
        todo.append((cfg.work, st, v['frames'], cs10_dir, bool(cfg.st(st).get('ghost'))))
    if todo:
        with ProcessPoolExecutor(max_workers=min(jobs, len(todo))) as ex:
            for st, key, f0, corners in ex.map(_key_state, todo):
                log(cfg.work, 'key %-8s plate %s f0 top %d sole %d cx %.1f corners %s' % (st, key, f0['top'], f0['sole'], f0['cx'], corners))
    out = {}
    for st in ver_res['states']:
        if states and st not in states:
            continue
        with open(os.path.join(cfg.work, 'measure_%s.json' % st)) as f:
            M = json.load(f)
        if any(M.get('corners', [])):
            log(cfg.work, 'key PROBLEM %s: %s non-plate px in the corners (a watermark?)' % (st, M['corners']))
        out[st] = M
    return out
