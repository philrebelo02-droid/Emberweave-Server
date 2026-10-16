"""COMPARE: is a pipeline run the same as a shipped release? (the proof that the pipeline reproduces hand-made work)

  --against <tree | git:<sha>>   the release's page + sheets (a worktree; a git: ref reads the page and the sheets from git)
  --archive-masters <dir>        the release's lossless masters (Game Art/Heroes/<Hero>/sprite sheets/<release>/masters (lossless))
Compared: each q95 game sheet and lossless master byte for byte (sha256), then - if bytes differ - decoded pixels (alpha equal? max RGB diff);
the frame maps and cut geometry against the release's cut_report.json / frame_maps.json beside the masters; BATTLE_ANIM.<hero> as data
(deep equal) and as page text (each state's line). Writes <work>/compare.json and prints one line per item.
"""
import hashlib
import io
import json
import os
import re
import subprocess

import numpy as np
from PIL import Image

from .common import REPO, log, die, sha256, load_json, save_json
from .wire import entry_obj, entry_line, dump


def _git_bytes(repo, sha, rel):
    return subprocess.run(['git', 'show', '%s:%s' % (sha, rel)], cwd=repo, capture_output=True, check=True).stdout


def _px(b):
    return np.asarray(Image.open(io.BytesIO(b)).convert('RGBA')).astype(int)


def _same(mine_b, theirs_b):
    if hashlib.sha256(mine_b).digest() == hashlib.sha256(theirs_b).digest():
        return dict(bytes='identical')
    a, b = _px(mine_b), _px(theirs_b)
    if a.shape != b.shape:
        return dict(bytes='differ', pixels='shape %s vs %s' % (a.shape, b.shape))
    d = np.abs(a - b)
    return dict(bytes='differ', alpha_equal=bool((a[..., 3] == b[..., 3]).all()), max_rgb=int(d[..., :3].max()), max_alpha=int(d[..., 3].max()),
                px_diff=int((d.max(-1) > 0).sum()))


def _eq(a, b, tol=0):
    """data equality as the page sees it: 169.0 == 169 (JS has one number type); tol for diagnostics."""
    if isinstance(a, bool) or isinstance(b, bool):
        return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= tol
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_eq(a[k], b[k], tol) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_eq(x, y, tol) for x, y in zip(a, b))
    return a == b


def stage_compare(cfg, a):
    if not a.against:
        die('compare needs --against <tree | git:<sha>>')
    r = cfg.run()
    cut = r.get('cut') or die('run cut first')
    H, V = cfg.hero, cfg.version
    order = cfg.order or list(cut)
    git = a.against.startswith('git:')
    sha = a.against[4:] if git else None
    tree = REPO if git else os.path.abspath(a.against)
    out = dict(against=a.against, sheets={}, masters={}, frames={}, geometry={}, table={}, lines={})
    for st in order:
        rel = 'assets/anim/%s/%s_%s_%s.webp' % (H, H, st, V)
        mine = open(os.path.join(cfg.work, 'sheets', '%s_%s_%s.webp' % (H, st, V)), 'rb').read()
        theirs = _git_bytes(tree, sha, rel) if git else open(os.path.join(tree, rel), 'rb').read()
        out['sheets'][st] = _same(mine, theirs)
        if a.archive_masters:
            mp = os.path.join(a.archive_masters, '%s_%s_%s_lossless.webp' % (H, st, V))
            if os.path.exists(mp):
                out['masters'][st] = _same(open(os.path.join(cfg.work, 'masters', '%s_%s_%s_lossless.webp' % (H, st, V)), 'rb').read(), open(mp, 'rb').read())
    if a.archive_masters:
        rel_dir = os.path.dirname(os.path.abspath(a.archive_masters))
        fm = load_json(os.path.join(rel_dir, 'frame_maps.json'), {})
        cr = load_json(os.path.join(rel_dir, 'cut_report.json'), {})
        for st in order:
            if st in fm:
                out['frames'][st] = 'identical' if fm[st] == cut[st]['frames'] else 'differ'
            if st in cr:
                keys = ('box', 'fw', 'fh', 'cols', 'rows', 'sx', 'sy', 'top', 'feet', 'cx', 'figH', 'figH_exact')
                # figH_exact is a diagnostic (v1162 wrote it from the 5-place sy; the shipped figH is its rounding): equal to 0.01
                diff = {k: [cut[st].get(k), cr[st].get(k)] for k in keys if k in cr[st] and not _eq(cut[st].get(k), cr[st].get(k), 0.01 if k == 'figH_exact' else 0)}
                out['geometry'][st] = 'identical' if not diff else diff
    page = ('git:' + sha) if git else os.path.join(tree, 'emberweave-heroes.html')
    live = dump(tree, page, 'BATTLE_ANIM.%s' % H)
    ents = {st: entry_obj(cfg, st, cut[st]) for st in order}
    for st in order:
        out['table'][st] = 'identical' if _eq(live.get(st), ents[st]) else dict(mine=ents[st], live=live.get(st))
    out['table']['_extra_live_states'] = sorted(set(live) - set(ents))
    src = (_git_bytes(tree, sha, 'emberweave-heroes.html').decode('utf-8') if git else open(page, encoding='utf-8', newline='').read()).replace('\r\n', '\n')   # git blobs are LF, checkouts CRLF
    for st in order:
        line = entry_line(st, ents[st])
        out['lines'][st] = 'identical' if (line + ',\n' in src or line + '\n  }' in src) else line
    save_json(os.path.join(cfg.work, 'compare.json'), out)
    allsame = True
    for st in order:
        row = [out['sheets'][st].get('bytes'), (out['masters'].get(st) or {}).get('bytes', '-'), out['frames'].get(st, '-'),
               'identical' if out['geometry'].get(st) in ('identical', None) else 'DIFFER', 'identical' if out['table'][st] == 'identical' else 'DIFFER',
               'identical' if out['lines'][st] == 'identical' else 'DIFFER']
        allsame &= all(x in ('identical', '-') for x in row)
        log(cfg.work, 'compare %-8s sheet q95 %-9s master %-9s frames %-9s geometry %-9s BATTLE_ANIM %-9s page line %s' % tuple([st] + row))
        for k in ('sheets', 'masters'):
            if (out[k].get(st) or {}).get('bytes') == 'differ':
                log(cfg.work, 'compare   %s %s: %s' % (st, k, out[k][st]))
        if out['geometry'].get(st) not in ('identical', None):
            log(cfg.work, 'compare   %s geometry: %s' % (st, out['geometry'][st]))
        if out['table'][st] != 'identical':
            log(cfg.work, 'compare   %s table: %s' % (st, out['table'][st]))
    log(cfg.work, 'compare RESULT: %s' % ('every sheet, master, frame map, geometry and table entry IDENTICAL' if allsame else 'differences above'))
    r['compare'] = dict(identical=allsame)
    cfg.save_run(r)
