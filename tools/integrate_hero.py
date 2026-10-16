#!/usr/bin/env python
"""integrate_hero.py - one Phil-approved hero animation handoff -> game sheets, BATTLE_ANIM entries, tests, look pages.

usage:  python tools/integrate_hero.py <config.json> <stage> [options]
stages (in order; `all` runs verify .. outputs; each stage reads what the earlier ones wrote to <work>/run.json):
  verify     the clean-source manifest: PASS rows only, silent twins' sha256, pictures = the export's
  extract    silent twin -> raw/<state>/fNNN.png (ffmpeg, every frame)
  key        cs10 green-screen key -> keyed/<state>/kNNN.png + measure_<state>.json (plate, boxes, frame-0 figure, corners)
  engine     the engine's own moments (sim host): the contact cell each 48 @24 action clip must draw its blow / release / landing on
  propose    the planner's numbers for anything the config leaves out (walk stride, idle loop, hit flinch, contact frames, sound rows) -> proposals.json
  normalise  one size, one spot (the Korvux method): every state's anchors from the reference figure
  cut        frame maps -> sheets: unmix, despill, one Lanczos, 2048 px / 4 MB, lossless master + q95, fringe measured
  wire       BATTLE_ANIM entries into <tree>/emberweave-heroes.html, fixtures, the test from the template, size-baseline ratchet,
             condense dry run, Update-all + skill-preview checks (needs --tree)
  outputs    inspection sheets (every state on one floor line), the stills contact sheet + clip page from a rig run
  rig        the muted phone rig (probe / stills / clip) under the GPU lock (needs --tree)
  checks     the mandatory checks on --tree, browser ones one at a time under the GPU lock
  compare    byte / table comparison against a shipped release (--against <tree> --archive-masters <dir>)
See tools/integrate/README.md.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from integrate.common import Config, log, die  # noqa: E402
from integrate import verify as V, key as K, normalise as N, frames as FR  # noqa: E402


def stage_verify(cfg, a):
    res = V.verify(cfg, check_streams=not a.no_stream_check)
    r = cfg.run()
    r['verify'] = res
    cfg.save_run(r)
    if res['problems'] and not a.force:
        die('verify: %d problem(s) - see pipeline.log' % len(res['problems']))
    return res


def need(cfg, key, stage):
    r = cfg.run()
    if key not in r:
        die('run the %s stage first' % stage)
    return r[key]


def stage_extract(cfg, a):
    K.extract(cfg, need(cfg, 'verify', 'verify'), states=a.states, jobs=a.jobs)


def stage_key(cfg, a):
    meas = K.key_all(cfg, need(cfg, 'verify', 'verify'), states=a.states, jobs=a.jobs, cs10_dir=a.cs10, force=a.force)
    r = cfg.run()
    r['key'] = {st: dict(plate=m['key'], f0=m['f0'], corners=m.get('corners'), size=m.get('size')) for st, m in meas.items()}
    cfg.save_run(r)


def _meas(cfg):
    import json
    out = {}
    for st in need(cfg, 'verify', 'verify')['states']:
        p = os.path.join(cfg.work, 'measure_%s.json' % st)
        if not os.path.exists(p):
            die('no measure for %s - run key' % st)
        with open(p) as f:
            out[st] = json.load(f)
    return out


def stage_normalise(cfg, a):
    res = N.normalise(cfg, need(cfg, 'verify', 'verify'), _meas(cfg))
    r = cfg.run()
    r['normalise'] = res
    cfg.save_run(r)
    bad = [st for st, e in res['states'].items() if e.get('problem')]
    if bad and not a.force:
        die('normalise: check %s (pipeline.log)' % bad)


def stage_engine(cfg, a):
    """the engine's moments for this hero (sim host on --tree, or git --base): the contact cell every 48 @24 action clip must draw its blow on."""
    import json
    from integrate.common import node, REPO
    src = os.path.join(a.tree, 'emberweave-heroes.html') if a.tree else 'git:' + (a.base or 'HEAD')
    p = node([os.path.join(REPO, 'tools', 'integrate', 'engine_moments.js'), a.tree or REPO, src, cfg.hero], cwd=a.tree or REPO)
    if p.returncode:
        die('engine_moments: ' + p.stderr[-600:])
    M = json.loads(p.stdout)
    eng = {}
    for st in ('attack', 'attackB', 'crit', 'melee', 'critMelee'):
        eng[st] = dict(cell=M['swing']['cell'], exact=M['swing']['cellExact'], fitted=M['swing']['fitted'], moment='blow')
    for st in ('green', 'blue', 'ult'):
        if M.get(st):
            mom = cfg.st(st).get('moment', 'release')
            eng[st] = dict(cell=M[st]['landCell'] if mom == 'land' else M[st]['releaseCell'], releaseCell=M[st]['releaseCell'], landCell=M[st]['landCell'],
                           release=M[st]['release'], land=M[st]['land'], moment=mom, effects=M[st]['effects'])
    r = cfg.run()
    r['engine'] = eng
    cfg.save_run(r)
    log(cfg.work, 'engine swing x%.2f %s: the blow on cell %.2f -> contact %d; ' % (M['swing']['mul'], 'fitted' if M['swing']['fitted'] else 'natural', M['swing']['cellExact'], M['swing']['cell']) +
        '; '.join('%s release %s land %s' % (k, M[k]['releaseCell'], M[k]['landCell']) for k in ('green', 'blue', 'ult') if M.get(k)))


def stage_propose(cfg, a):
    from integrate.common import save_json
    meas = _meas(cfg)
    eng = cfg.run().get('engine', {})
    out = {}
    for st in meas:
        if a.states and st not in a.states:
            continue
        p = FR.propose(cfg.work, st, meas[st], engine_cell=(eng.get(st) or {}).get('cell'))
        sc = cfg.st(st)
        p['config_has'] = sorted(k for k in sc if k in ('frames', 'segments', 'contactFrame', 'from', 'len', 'flinch', 'loop'))
        out[st] = p
        log(cfg.work, 'propose %-8s %s' % (st, {k: v for k, v in p.items() if k in ('walk', 'idle', 'hit', 'contactFrame', 'end', 'contactCell', 'why')}))
    from integrate.common import REPO
    from integrate import sound as SO   # the sound rows: which 'cast' rows move to release / land (the config key `sound` decides when given)
    sp = SO.propose(SO.hero_rows(a.tree or REPO, cfg.hero), eng)
    out['_sound'] = dict(proposed=sp, config=cfg.d.get('sound'))
    log(cfg.work, 'propose sound %s%s' % ({k: v['rule'] for k, v in sp.items()}, ' (config sound %s decides)' % cfg.d['sound'] if cfg.d.get('sound') is not None else ''))
    save_json(os.path.join(cfg.work, 'proposals.json'), out)


def stage_cut(cfg, a):
    from concurrent.futures import ProcessPoolExecutor
    from integrate.cut import cut_state
    from integrate.common import save_json
    norm = need(cfg, 'normalise', 'normalise')['states']
    ver = cfg.version
    kc = cfg.key
    jobs = []
    for st in need(cfg, 'verify', 'verify')['states']:
        if a.states and st not in a.states:
            continue
        sc = cfg.st(st)
        fr, timing = FR.frames_for(st, sc)
        out = os.path.join(cfg.work, 'sheets', '%s_%s_%s.webp' % (cfg.hero, st, ver))
        master = os.path.join(cfg.work, 'masters', '%s_%s_%s_lossless.webp' % (cfg.hero, st, ver))
        eng = (cfg.run().get('engine') or {}).get(st)
        if sc.get('contact') is not None and eng and eng['cell'] != sc['contact'] and not sc.get('contactOverride'):
            die('%s: config contact %s but the engine draws its %s on cell %s (set contactOverride with the reason, or fix the config)' % (st, sc['contact'], eng['moment'], eng['cell']))
        jobs.append((st, timing, dict(work=cfg.work, st=st, spec=fr, anchors=norm[st], out=out, master=master,
                                      unmix_soft=sc.get('unmixSoft', kc.get('unmixSoft', True)), ref_unmix=sc.get('refUnmix', kc.get('refUnmix')),
                                      pad=sc.get('pad', kc.get('pad', 24)), maxfig=float(sc.get('maxFig', kc.get('maxFig', 240))), ghost=bool(sc.get('ghost')),
                                      maxfig_h=(norm[st]['f0']['sole'] - norm[st]['f0']['top']) if kc.get('maxFigOwnFrame0', True) else None)))
    r = cfg.run()
    rep = r.get('cut', {})
    with ProcessPoolExecutor(max_workers=min(a.jobs, len(jobs))) as ex:
        futs = {st: (timing, ex.submit(cut_state, **kw)) for st, timing, kw in jobs}
        for st, (timing, fu) in futs.items():
            res = fu.result()
            res['timing'] = timing
            rep[st] = res
            fq, fm = res['fringe_q95'], res['fringe_master']
            log(cfg.work, 'cut %-8s n %d grid %dx%d sheet %dx%d figH %d feet %d cx %s top %d margin %d  %.2f MB  psnr %.2f  fringe master>24 %.3f%% q95>24 %.4f%%' % (
                st, res['n'], res['cols'], res['rows'], res['sheet'][0], res['sheet'][1], res['figH'], res['feet'], res['cx'], res['top'], res['min_margin'],
                res['bytes'] / 1e6, res['psnr'], fm['edge_gt24'], fq['edge_gt24']))
            probs = []
            if fm['edge_gt24'] > 0:
                probs.append('master green rim > 24 on %.3f%% of edge px' % fm['edge_gt24'])
            if fq['edge_gt24'] > 0.005:
                probs.append('q95 visible green on %.4f%% of edge px (gate 0.005%%)' % fq['edge_gt24'])
            if res['min_margin'] < 2:
                probs.append('a cell touches its edge (margin %d)' % res['min_margin'])
            if res['empty_cells']:
                probs.append('empty cells %s' % res['empty_cells'])
            if not (140 <= res['figH'] <= 240):
                probs.append('figH %d outside 140-240 (phone figures)' % res['figH'])
            if res.get('ghost_alpha'):
                g = res['ghost_alpha']
                mid_ok = all(70 < x[2] < 190 and x[1] > 0.6 * g[0][1] for x in g[1:3])
                if not mid_ok:
                    probs.append('ghost: mid cells not a readable see-through figure %s' % g)
            res['problems'] = probs
            for p in probs:
                log(cfg.work, 'cut PROBLEM %s: %s' % (st, p))
    r['cut'] = rep
    cfg.save_run(r)
    save_json(os.path.join(cfg.work, 'cut_report.json'), rep)
    save_json(os.path.join(cfg.work, 'frame_maps.json'), {st: rep[st]['frames'] for st in rep})


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('config')
    ap.add_argument('stage')
    ap.add_argument('--states', nargs='*')
    ap.add_argument('--jobs', type=int, default=8)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--no-stream-check', action='store_true')
    ap.add_argument('--cs10', default=None)
    ap.add_argument('--tree', help='the game worktree to wire / check (never the shared checkout)')
    ap.add_argument('--base', help='the live commit this release sits on (test BASE)')
    ap.add_argument('--against', help='compare: the tree holding the shipped release')
    ap.add_argument('--archive-masters', help='compare: the shipped lossless masters folder')
    ap.add_argument('--rig-out', help='outputs: a rig run folder (rig_<hero>_stills / rig_<hero>_clip)')
    ap.add_argument('--modes', default='probe stills clip')
    ap.add_argument('--suite', action='store_true', help='checks: also the whole standalone suite here and on BASE')
    a = ap.parse_args()
    if a.cs10 is None:
        from integrate.common import PIPELINE_TOOLS
        a.cs10 = PIPELINE_TOOLS
    cfg = Config(a.config)
    os.makedirs(cfg.work, exist_ok=True)
    log(cfg.work, '== %s %s v%s (work %s)' % (a.stage, cfg.hero, cfg.version, cfg.work))
    stages = {'verify': stage_verify, 'extract': stage_extract, 'key': stage_key, 'engine': stage_engine, 'propose': stage_propose, 'normalise': stage_normalise, 'cut': stage_cut}
    try:
        from integrate import wire as W, outputs as O, checks as C, compare as CP
        stages.update(wire=W.stage_wire, outputs=O.stage_outputs, rig=C.stage_rig, checks=C.stage_checks, compare=CP.stage_compare)
    except ImportError:
        pass
    if a.stage == 'all':
        for s in ('verify', 'extract', 'key', 'engine', 'propose', 'normalise', 'cut', 'wire', 'outputs'):
            if s == 'wire' and not a.tree:
                log(cfg.work, 'all: no --tree, stopping before wire')
                break
            stages[s](cfg, a)
        return
    if a.stage not in stages:
        die('unknown stage ' + a.stage)
    stages[a.stage](cfg, a)


if __name__ == '__main__':
    main()
