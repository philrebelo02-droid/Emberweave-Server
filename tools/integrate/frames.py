"""FRAME MAPS: which source frame sits on every cell (the v1155 slim rules), and the proposals the planner makes for a new hero.

A state's frames come from its config, first match wins:
  frames   : an explicit spec ('0:124:2', '29,30,32') or list - used as written.
  segments : [[a, b, k], ...] - k frames spread evenly from a to b inclusive, concatenated (every specs_*.py r(a, b, k)).
  the rule for its kind:
    idle    : the whole clip, every 2nd frame, 62 @12 (Aureth / Carn / Korvux / Veyr: a clean 24-cell sub-loop plays at 4.6 fps - steppy).
              `idle: {loop: [a, L]}` takes 24 cells over a clean loop of L frames instead (v1155), only when 24 x 24 / L >= 8 fps.
    walk    : 36 cells over one stride of L frames from a: `walk: {from: a, len: L}` -> fps 36 x 24 / L, stride 0.12 x 36 / L, loop [0, 36].
    hit     : 15 @25 = the flinch (9 cells, onset -> peak) + the recovery (6 cells): `hit: {flinch: [a, b], recover: [c, d]}`.
    actions : 48 @24 with the contact cell on its source frame: `{contact: c, contactFrame: f, end: e, hold: 1}` ->
              hold 1: [0 .. f-2] on cells 0..c-2, f-1 / f / f+1 on c-1 / c / c+1 (the blow held), then [f+2 .. e];
              hold 0: [0 .. f-1] on cells 0..c-1, f on c, then [f+1 .. e].
The planner (propose()) fills in what a config leaves out, from the keyed frames, and marks each number as a PROPOSAL for the review page.
"""
import os

import numpy as np
from PIL import Image

from .common import lin, parse_spec

ACTIONS = ('attack', 'attackB', 'crit', 'green', 'blue', 'ult', 'passive', 'melee', 'critMelee')


def action_segments(n, c, f, e, hold):
    if hold:
        return [[0, f - 2, c - 1], [f - 1, f + 1, 3], [f + 2, e, n - c - 2]]
    return [[0, f - 1, c], [f, f, 1], [f + 1, e, n - c - 1]]


def frames_for(st, sc):
    """(frames, timing) for one state from its config block; timing = {fps, stride?, loop?} as BATTLE_ANIM writes it."""
    if 'frames' in sc:
        fr = parse_spec(sc['frames'])
    elif 'segments' in sc:
        fr = []
        for a, b, k in sc['segments']:
            fr += lin(a, b, k)
    elif st == 'idle':
        if sc.get('loop'):
            a, L = sc['loop']
            fr = [round(a + i * L / 24) for i in range(24)]
        else:
            fr = list(range(0, 124, 2))
    elif st == 'walk':
        a, L = sc['from'], sc['len']
        fr = [round(a + i * L / 36) for i in range(36)]
    elif st == 'hit':
        (a, b), (c, d) = sc['flinch'], sc['recover']
        fr = lin(a, b, 9) + lin(c, d, 6)
    else:
        n = sc.get('n', 48)
        fr = []
        for a, b, k in action_segments(n, sc['contact'], sc['contactFrame'], sc['end'], sc.get('hold', 1)):
            fr += lin(a, b, k)
    if st == 'walk':
        L = sc['len'] if 'len' in sc else None
        if L is None:
            raise SystemExit('walk: give walk.len (the stride in source frames) for its fps / stride')
        timing = dict(fps=36 * 24 / L, stride=0.12 * 36 / L, loop=[0, 36])
    elif st == 'idle':
        timing = dict(fps=sc.get('fps', 24 * 24 / sc['loop'][1] if sc.get('loop') else 12))
    elif st == 'hit':
        timing = dict(fps=sc.get('fps', 25))
    else:
        timing = dict(fps=sc.get('fps', 24))
    return fr, timing


# ---------------------------------------------------------------------------------------------------------------- proposals
def _small(work, st, n, size=(272, 180)):
    F = []
    for i in range(n):
        k = Image.open(os.path.join(work, 'keyed', st, 'k%03d.png' % i)).resize(size)
        F.append(np.asarray(k).astype(np.float32))
    F = np.array(F)
    A = F[..., 3] / 255
    return F[..., :3] * A[..., None], A


def loopfind(work, st, n=124, pmin=14, pmax=60):
    """loopfind.py: the most similar (a, a + p) pair = the clip's own loop / stride."""
    RGB, _ = _small(work, st, n)
    D = lambda i, j: float(np.abs(RGB[i] - RGB[j]).mean())
    cons = float(np.mean([D(i, i + 1) for i in range(n - 1)]))
    best = []
    for a in range(0, min(90, n)):
        for p in range(pmin, pmax):
            if a + p < n:
                best.append((D(a, a + p), a, p))
    best.sort()
    return dict(consecutive=round(cons, 3), best=[[round(d, 3), a, p] for d, a, p in best[:8]], f0_vs_last=round(D(0, n - 1), 3))


def motion(work, st, n=124):
    """per frame: distance from frame 0 (pose change) and from the previous frame (speed), alpha-weighted RGB on a 272x180 view."""
    RGB, A = _small(work, st, n)
    d0 = [float(np.abs(RGB[i] - RGB[0]).mean()) for i in range(n)]
    dv = [0.0] + [float(np.abs(RGB[i] - RGB[i - 1]).mean()) for i in range(1, n)]
    return np.array(d0), np.array(dv)


def reach(work, st, meas, n=124, facing=1):
    """per frame: how far the figure (alpha > 100) reaches past its frame-0 front edge, source px (the weapon out in front)."""
    f0 = meas['f0']
    out = []
    for i in range(n):
        a = np.asarray(Image.open(os.path.join(work, 'keyed', st, 'k%03d.png' % i)))[..., 3] > 100
        ys, xs = np.where(a)
        if not len(xs):
            out.append(0)
            continue
        out.append(int(xs.max() - f0['x1']) if facing > 0 else int(f0['x0'] - xs.min()))
    return np.array(out)


def propose(work, st, meas, engine_cell=None, n=124):
    """Numbers a reviewer confirms (never shipped unreviewed): walk stride, idle loop, hit flinch / recovery, action contact frame + end."""
    p = dict(state=st)
    if st == 'walk':
        lf = loopfind(work, st, n, pmin=24, pmax=70)
        d, a, L = lf['best'][0]
        p.update(kind='walk', walk={'from': a, 'len': L}, loopfind=lf, why='the most similar frame pair 24-70 apart = one stride')
    elif st == 'idle':
        lf = loopfind(work, st, n, pmin=40, pmax=123)
        d, a, L = lf['best'][0]
        clean = d <= 1.5 * lf['consecutive']
        fps = 24 * 24 / L
        p.update(kind='idle', loopfind=lf, idle=({'loop': [a, L]} if clean and fps >= 8 else {}),
                 why=('a clean %d-frame loop from f%d: 24 cells at %.1f fps' % (L, a, fps)) if clean and fps >= 8 else
                 'no clean loop that plays 24 cells at >= 8 fps (best %d frames, diff %.2f vs %.2f per frame): the whole clip 62 @12' % (L, d, lf['consecutive']))
    elif st == 'hit':
        d0, dv = motion(work, st, n)
        thr = max(2.0, 0.15 * d0.max())
        on = int(np.argmax(d0 > thr)) if (d0 > thr).any() else 10
        peak = int(on + np.argmax(d0[on:on + 30]))
        a, b = max(0, on - 2), peak
        back = [i for i in range(peak + 10, n) if d0[i] < 0.5 * d0[peak]]
        c = back[0] - 6 if back else min(n - 13, peak + 40)
        dd = min(n - 1, c + 12)
        p.update(kind='hit', hit={'flinch': [a, b], 'recover': [c, dd]}, why='onset f%d (pose change > %.1f), peak f%d, back to half the pose change by f%s' % (on, thr, peak, back[0] if back else '?'))
    else:
        d0, dv = motion(work, st, n)
        rc = reach(work, st, meas, n)
        lo, hi = 8, int(n * 0.75)
        cand = sorted(range(lo, hi), key=lambda i: -rc[i])[:3]
        # the blow: the frame of greatest reach whose speed has dropped (the weapon stops at full reach)
        f = int(cand[0]) if rc[cand[0]] > 20 else int(lo + np.argmax(dv[lo:hi]))
        settle = [i for i in range(f + 15, n) if d0[i] < max(1.0, 0.25 * d0[f])]
        e = settle[0] if settle else n - 1
        p.update(kind='action', contactFrame=f, end=int(min(n - 1, e)), contactCell=engine_cell, reach_top3=[[int(i), int(rc[i])] for i in cand],
                 speed_peak=int(lo + np.argmax(dv[lo:hi])), why='greatest reach past the frame-0 front edge (weapon out in front); end = back within 25% of the pose change')
    return p
