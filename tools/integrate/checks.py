"""CHECKS + RIG: the mandatory checks, run by the pipeline - never skipped, never in parallel on the GPU.

stage_checks (on --tree, after wire):
  1. node   the page's inline scripts parse; the generated tests/test_<hero>_anim_<ver>.js (sources, sheets, anchors + CONTROL, timing = BASE,
            contact cells, whole fights tick-identical + CONTROL, fights without the hero, sound, previews, ghost, grid CONTROL);
            the release's neighbours: test_anim_slim_1155, test_q95_1158 (both read every sheet / size rule).
  2. GPU    one at a time, each under its own hold of the shared GPU lock (locked.sh, >= 2 GB free): test_memory_budget_1140 (phone memory),
            test_offline_art_1154 (Update all features = what the device loads), test_condense_1141 (tiers), test_skill_previews_1164.
  --suite   also every standalone test (no browser, no port 8871) on this tree AND on BASE side by side: the same pass set is the bar.
Results -> <work>/checks.json; a failure stops with its log path.
stage_rig: the muted phone rig (rig_hero.js) - probe (the cell drawn on each engine moment, two reps), stills, clip - one mode per lock hold.
"""
import json
import os
import subprocess
import tempfile

from .common import REPO, NODE_PATH, log, die, save_json

HERE = os.path.dirname(os.path.abspath(__file__))
BASH = os.environ.get('EW_BASH', r'C:\Program Files\Git\bin\bash.exe')
NODE_TESTS = ['test_anim_slim_1155.js', 'test_q95_1158.js']
GPU_TESTS = ['test_memory_budget_1140.js', 'test_offline_art_1154.js', 'test_condense_1141.js', 'test_skill_previews_1164.js']


def _env():
    e = dict(os.environ)
    e.setdefault('NODE_PATH', NODE_PATH)
    return e


def _node_test(tree, name, logdir, timeout=2400):
    lp = os.path.join(logdir, name.replace('.js', '.log'))
    with open(lp, 'w', encoding='utf-8') as f:
        p = subprocess.run(['node', os.path.join('tests', name)], cwd=tree, env=_env(), stdout=f, stderr=subprocess.STDOUT, timeout=timeout)
    tail = open(lp, encoding='utf-8', errors='replace').read().strip().splitlines()[-1:] or ['']
    return dict(exit=p.returncode, last=tail[0][:200], log=lp)


def _locked(who, logp, cmd, cwd):
    sh = os.path.join(HERE, 'locked.sh').replace('\\', '/')
    full = ['bash' if os.name != 'nt' else BASH, sh, who, logp.replace('\\', '/'), '--'] + cmd
    return subprocess.run(full, cwd=cwd, env=_env()).returncode


def stage_checks(cfg, a):
    if not a.tree:
        die('checks needs --tree')
    tree = os.path.abspath(a.tree)
    logdir = os.path.join(cfg.work, 'checks')
    os.makedirs(logdir, exist_ok=True)
    res = {}
    gen = 'test_%s_anim_%s.js' % (cfg.hero, cfg.version)
    for name in [gen] + NODE_TESTS:
        if not os.path.exists(os.path.join(tree, 'tests', name)):
            continue
        r = _node_test(tree, name, logdir)
        res[name] = r
        log(cfg.work, 'checks %-32s exit %d  %s' % (name, r['exit'], r['last']))
    for name in GPU_TESTS:
        if not os.path.exists(os.path.join(tree, 'tests', name)):
            continue
        lp = os.path.join(logdir, name.replace('.js', '.log'))
        if os.path.exists(lp):
            os.remove(lp)
        rc = _locked('integrate-' + cfg.hero, lp, ['node', 'tests/' + name], tree)
        lines = open(lp, encoding='utf-8', errors='replace').read().strip().splitlines()
        last = [l for l in lines if not l.startswith('== ')][-1:] or ['']
        res[name] = dict(exit=rc, last=last[0][:200], log=lp, gpu_lock=True)
        log(cfg.work, 'checks %-32s exit %d  %s  (GPU lock)' % (name, rc, last[0][:160]))
    if getattr(a, 'suite', False):
        res['_suite'] = suite_compare(cfg, tree, a.base)
    r = cfg.run()
    r['checks'] = res
    cfg.save_run(r)
    save_json(os.path.join(cfg.work, 'checks.json'), res)
    bad = [k for k, v in res.items() if not k.startswith('_') and v['exit'] != 0]
    if bad:
        die('checks failed: %s (logs in %s)' % (bad, logdir))
    log(cfg.work, 'checks: all %d passed' % len(res))


def suite_compare(cfg, tree, base):
    """suite.sh on this tree and on BASE (a detached worktree), 6 at a time each: the bar is the same pass set."""
    out = {}
    base_tree = tempfile.mkdtemp(prefix='ew-int-base-')
    subprocess.run(['git', 'worktree', 'add', '--detach', base_tree, base], cwd=tree, check=True, capture_output=True)
    try:
        for name, t in (('mine', tree), ('base', base_tree)):
            od = os.path.join(cfg.work, 'suite_' + name)
            subprocess.run([BASH, os.path.join(HERE, 'suite.sh').replace('\\', '/'), t.replace('\\', '/'), od.replace('\\', '/')], env=_env(), timeout=7200)
            codes = dict(l.split() for l in open(os.path.join(od, 'codes.txt')) if l.strip())
            out[name] = codes
        diff = {k: [out['mine'].get(k), out['base'].get(k)] for k in set(out['mine']) | set(out['base']) if (out['mine'].get(k) == '0') != (out['base'].get(k) == '0')}
        log(cfg.work, 'suite: %d tests; pass-set differences %s' % (len(out['mine']), diff or 'none'))
        return dict(diff=diff, mine_fail=sorted(k for k, v in out['mine'].items() if v != '0'))
    finally:
        subprocess.run(['git', 'worktree', 'remove', '--force', base_tree], cwd=tree, capture_output=True)


def rig_config(cfg):
    rc = cfg.d.get('rig', {})
    melee = bool(cfg.d.get('melee'))
    order = cfg.order or list(cfg.states)
    acts = [s for s in order if s in ('attack', 'attackB', 'melee', 'crit', 'critMelee', 'green', 'blue', 'ult', 'passive')]
    moment = {}
    for s in acts:
        if s in ('attack', 'attackB', 'crit', 'melee', 'critMelee'):
            moment[s] = 'hit' if (melee or s in ('melee', 'critMelee')) else 'shot'
        elif s != 'passive':
            moment[s] = {'land': 'land', 'release': 'rel', None: 'rel'}[cfg.st(s).get('moment')]
    return dict(moment=moment, states=acts, close={s: 1 for s in acts} if melee else {}, passive=rc.get('passive', ''), passiveCell=rc.get('passiveCell', 20),
                walkGap=rc.get('walkGap', 700), backRowWalk=rc.get('backRowWalk', False))


def stage_rig(cfg, a):
    if not a.tree:
        die('rig needs --tree')
    tree = os.path.abspath(a.tree)
    rcp = os.path.join(cfg.work, 'rig_config.json')
    save_json(rcp, rig_config(cfg))
    port = str(9480 + (abs(hash(cfg.hero)) % 15))
    for mode in a.modes.split():
        out = os.path.join(cfg.work, 'rig_%s_%s' % (cfg.hero, mode))
        lp = os.path.join(cfg.work, 'rig_%s.log' % mode)
        if os.path.exists(lp):
            os.remove(lp)
        rc = _locked('integrate-rig-' + cfg.hero, lp, ['node', os.path.join(HERE, 'rig_hero.js').replace('\\', '/'), tree.replace('\\', '/'), out.replace('\\', '/'), cfg.hero, mode, port, rcp.replace('\\', '/')], tree)
        lines = open(lp, encoding='utf-8', errors='replace').read().splitlines()
        for l in lines:
            if l.startswith(('probe ', 'summary', 'errors', 'requests-failed', 'sound')):
                log(cfg.work, 'rig %s %s' % (mode, l[:300]))
        if rc:
            die('rig %s exit %d (%s)' % (mode, rc, lp))
