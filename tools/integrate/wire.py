"""WIRE: the cut sheets -> a game worktree (never the shared checkout; give --tree).

  1. sheets      -> <tree>/assets/anim/<hero>/<hero>_<state>_<ver>.webp, referenced at ?v=<ver> (a NEW name: never reuse an asset version).
                    The old sheets stay on disk.
  2. BATTLE_ANIM -> the hero's block replaced: a header comment from the config `note` + one line per state, in the page's own field order
                    (u, n, fw, fh, cols, rows, loop, figH, feet, cx, fps, stride, flip, top, contact, event). Timing data is never touched:
                    every action keeps clipDur 2.0 s / relFrac 0.5 (48 @24), the hit its 0.6 s hold (15 @25).
  3. autoAlt     -> HERO_TYPES.<hero>.autoAlt = [A, B] when the config names a pair (Aureth v1150 / Kharos v1175: per-swing alternation;
                    skillPreviewStates reads the same list, so the Skills tab plays A then B).
  4. fixtures    -> tests/fixtures/<hero>_<ver>_integrate.json (everything the generated test asserts), anim_<hero>_<ver>_before.json (BASE's
                    entries), tests/helpers/anim-<hero>-<ver>.js (the undo helper) chained into the previous newest helper, and the previous
                    release's own test loads it (its 'every other hero = BASE' check stays true).
  5. test        -> tests/test_<hero>_anim_<ver>.js from tests/templates/hero_anim_test.tmpl.js, registered in run_all_tests.sh.
  6. ratchet     -> tests/fixtures/sheet_size_baseline_1140.json drops the replaced sheets (the list only shrinks).
  7. reports     -> condense dry run (tier decision for each new sheet), Update all (allAssetUrls carries every new sheet), skill previews,
                    the passive hook (an event clip needs the passive's own code to fire it) and the sound rows (cast vs the contact moment).
Nothing here bumps BUILD_ID / sw.js / version.json: that is the release step (tools/integrate/README.md), after the checks.
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
import textwrap

from .common import REPO, log, die, num, load_json, save_json, read_page, write_page, replace_once, node

FIELD_ORDER = ('u', 'n', 'fw', 'fh', 'cols', 'rows', 'loop', 'figH', 'feet', 'cx', 'fps', 'stride', 'flip', 'top', 'contact', 'event')


def entry_obj(cfg, st, r):
    sc = cfg.st(st)
    t = r['timing']
    o = dict(u='/assets/anim/%s/%s_%s_%s.webp?v=%s' % (cfg.hero, cfg.hero, st, cfg.version, cfg.version), n=r['n'], fw=r['fw'], fh=r['fh'], cols=r['cols'], rows=r['rows'])
    if 'loop' in t:
        o['loop'] = t['loop']
    o.update(figH=r['figH'], feet=r['feet'], cx=r['cx'], fps=t['fps'])
    if 'stride' in t:
        o['stride'] = t['stride']
    o.update(flip=False, top=r['top'])
    if sc.get('contact') is not None:
        o['contact'] = sc['contact']
    if st == 'passive' or sc.get('event'):
        o['event'] = True
    return o


def js_val(v):
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, str):
        return "'%s'" % v
    if isinstance(v, list):
        return '[' + ','.join(js_val(x) for x in v) + ']'
    return num(v)


def entry_line(st, o):
    return '    %s:{%s}' % (st, ','.join('%s:%s' % (k, js_val(o[k])) for k in FIELD_ORDER if k in o))


def header(cfg):
    note = cfg.d.get('pageNote') or ('v%s %s %d (%s; %s, clean-source-manifest.json, Phil PASS rows only, silent twins). Cut by tools/integrate_hero.py: '
                                     'cs10 + glow unmix + DESPILL_ALL, one premultiplied Lanczos per cell within 2048 x 2048, WebP q95 (lossless masters in the '
                                     'Archive). One size, one spot: every state anchored on %s frame 0 (the Korvux method). TIMING IS THE ENGINE\'S: every action '
                                     'clip keeps clipDur 2.0 s and relFrac 0.5, the hit its 0.6 s hold.' % (
                                         cfg.version, cfg.name, len(cfg.order or cfg.states), cfg.d.get('source', 'Phil PASS'), cfg.review, cfg.d.get('referenceState', 'idle')))
    lines = textwrap.wrap(note, 150)
    return '    /* ' + '\n       '.join(lines) + ' */\n'


def block_span(s, hero):
    a = s.index('const BATTLE_ANIM = {')
    m = re.compile(r'\r\n  %s:\{\r\n' % re.escape(hero)).search(s, a)
    if not m:
        return None
    end = s.index('\r\n  }', m.end())
    return m.start(), end + len('\r\n  }')


def patch_block(s, cfg, ents):
    order = cfg.order or list(ents)
    body = header(cfg).replace('\n', '\r\n') + ',\r\n'.join(entry_line(st, ents[st]) for st in order)
    sp = block_span(s, cfg.hero)
    new = '\r\n  %s:{\r\n' % cfg.hero + body + '\r\n  }'
    if sp is None:   # a hero with no BATTLE_ANIM yet: added at the top of the table
        a = s.index('const BATTLE_ANIM = {') + len('const BATTLE_ANIM = {')
        return s[:a] + new + ',' + s[a:]
    return s[:sp[0]] + new + s[sp[1]:]


def patch_autoalt(s, cfg):
    aa = cfg.d.get('autoAlt')
    if not aa:
        return s, False
    m = re.search(r"(\r\n {2,4}%s:\{name:'[^']*',[^\r\n]*?)(stars:)" % re.escape(cfg.hero), s)
    if not m:
        die('autoAlt: HERO_TYPES.%s line not found' % cfg.hero)
    line_end = s.index('\r\n', m.end())
    if 'autoAlt:' in s[m.start():line_end]:
        return s, False
    ins = 'autoAlt:[%s],' % ','.join("'%s'" % x for x in aa)
    return s[:m.start(2)] + ins + s[m.start(2):], True


def dump(tree, src, expr):
    r = node([os.path.join(REPO, 'tools', 'integrate', 'page_dump.js'), tree, src, expr], cwd=tree)
    if r.returncode:
        die('page_dump failed: ' + r.stderr[-800:])
    return json.loads(r.stdout)


def latest_helper(tree, own):
    """the newest release helper tests/helpers/anim-[name-]NNNN.js (highest version): older helpers call newer ones, so it is the chain's end."""
    hd = os.path.join(tree, 'tests', 'helpers')
    cands = []
    for f in os.listdir(hd):
        m = re.match(r'anim-(?:[a-z-]+-)?(\d{4})\.js$', f)
        if m and f != own and not f.startswith('anim-slim'):
            cands.append((int(m.group(1)), f))
    return max(cands)[1] if cands else None


def stage_wire(cfg, a):
    if not a.tree:
        die('wire needs --tree <game worktree>')
    tree = os.path.abspath(a.tree)
    if os.path.normcase(tree) == os.path.normcase(r'C:\Users\Home\Downloads\Emberweave-Server'):
        die('never wire into the shared checkout - make a worktree')
    r = cfg.run()
    cut = r.get('cut') or die('run cut first')
    base = a.base or subprocess.run(['git', 'rev-parse', '--short=8', 'HEAD'], cwd=tree, capture_output=True, text=True).stdout.strip()
    H, V = cfg.hero, cfg.version
    order = cfg.order or list(cut)
    # 1. sheets
    dst = os.path.join(tree, 'assets', 'anim', H)
    os.makedirs(dst, exist_ok=True)
    for st in order:
        shutil.copy2(os.path.join(cfg.work, 'sheets', '%s_%s_%s.webp' % (H, st, V)), os.path.join(dst, '%s_%s_%s.webp' % (H, st, V)))
    # BASE tables before the edit
    before = dump(tree, 'git:' + base, "{anim:BATTLE_ANIM.%s||null,sfx:(SFX_DATA.heroes||{}).%s||null,type:HERO_TYPES.%s||null}" % (H, H, H))
    s = read_page(tree)
    s_orig = s
    if '%s_idle_%s.webp' % (H, V) in s:
        die('the page already references v%s %s sheets - wire once per version (bump the version for a redo)' % (V, H))
    # 2 + 3
    ents = {st: entry_obj(cfg, st, cut[st]) for st in order}
    s = patch_block(s, cfg, ents)
    s, alt = patch_autoalt(s, cfg)
    write_page(tree, s)
    log(cfg.work, 'wire BATTLE_ANIM.%s: %d states%s' % (H, len(order), ', autoAlt ' + str(cfg.d['autoAlt']) if alt else ''))
    for st in order:
        log(cfg.work, 'wire   ' + entry_line(st, ents[st]).strip())
    after = dump(tree, os.path.join(tree, 'emberweave-heroes.html'), 'BATTLE_ANIM.%s' % H)
    from .compare import _eq
    if not _eq(after, ents):
        write_page(tree, s_orig)
        die('the page does not read back the entries written (page restored): %s' % json.dumps(after)[:400])
    # 4. fixtures + helper chain
    norm = r['normalise']
    ver = r['verify']
    fx = dict(hero=H, name=cfg.name, version=V, base=base, review=cfg.review, archiveDir=cfg.archive_dir, order=order, melee=bool(cfg.d.get('melee')),
              autoAlt=cfg.d.get('autoAlt'), creations={st: ver['states'][st]['creation'] for st in order},
              states={st: dict(n=cut[st]['n'], fps=cut[st]['timing']['fps'], contact=cfg.st(st).get('contact'), contactFrame=cfg.st(st).get('contactFrame'),
                               moment=cfg.st(st).get('moment'), frames=cut[st]['frames'], ghost=bool(cfg.st(st).get('ghost')),
                               cut={k: cut[st][k] for k in ('box', 'sx', 'sy', 'fw', 'fh', 'cols', 'rows', 'top', 'feet', 'cx', 'figH', 'figH_exact')},
                               anchors={k: norm['states'][st][k] for k in ('framing', 'k', 'top', 'sole', 'cx', 'h')}) for st in order},
              walk=cfg.st('walk') if 'walk' in order else None, idle=cfg.st('idle'), reference=norm['ref'],
              fights=cfg.d.get('fights'), sound=cfg.d.get('sound'), newCrit=('crit' in order and not (before['anim'] or {}).get('crit')))
    fdir = os.path.join(tree, 'tests', 'fixtures')
    save_json(os.path.join(fdir, '%s_%s_integrate.json' % (H, V)), fx)
    save_json(os.path.join(fdir, 'anim_%s_%s_before.json' % (H, V)), dict(note='v%s: what BASE %s had for the entries the %s change replaced (tools/integrate_hero.py wire)' % (V, base, cfg.name), before=before))
    for f in ('integrate_anim_check.js', 'integrate_scale_check.py'):   # the generated test's checker travels with the pipeline
        shutil.copy2(os.path.join(REPO, 'tests', 'helpers', f), os.path.join(tree, 'tests', 'helpers', f))
    hname = 'anim-%s-%s.js' % (H, V)
    prev = latest_helper(tree, hname)
    T = os.path.join(REPO, 'tests', 'templates')
    sub = lambda t: t.replace('@@HERO@@', H).replace('@@VER@@', V).replace('@@NAME@@', cfg.name).replace('@@BASE@@', base).replace('@@UNDO@@', 'undo_%s_%s' % (H, V))
    with open(os.path.join(T, 'anim_undo_helper.tmpl.js'), encoding='utf-8') as f:
        helper = sub(f.read())
    with open(os.path.join(tree, 'tests', 'helpers', hname), 'w', encoding='utf-8', newline='\n') as f:
        f.write(helper)
    if prev:   # the previous newest helper calls ours first: every older test compares with a BASE before this release
        p = os.path.join(tree, 'tests', 'helpers', prev)
        ps = open(p, encoding='utf-8', newline='').read()
        m = re.search(r'module\.exports = \{ (\w+): run => (\{ )?', ps)
        if m and 'anim-%s-%s' % (H, V) not in ps:
            fn = m.group(1)
            if m.group(2):   # already chained form: run => { X(run); return run(CODE); }
                ps = ps.replace(m.group(0), m.group(0) + "require('./%s').undo_%s_%s(run); " % (hname, H, V), 1)
            else:
                ps = ps.replace('%s: run => run(CODE)' % fn, "%s: run => { require('./%s').undo_%s_%s(run); return run(CODE); }" % (fn, hname, H, V), 1)
            with open(p, 'w', encoding='utf-8', newline='') as f:
                f.write(ps)
            log(cfg.work, 'wire helper %s chained into %s' % (hname, prev))
        prev_test = _test_of_helper(tree, prev)
        if prev_test:
            tp = os.path.join(tree, 'tests', prev_test)
            ts = open(tp, encoding='utf-8', newline='').read()
            old = "const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };"
            if ts.count(old) == 1:
                ts = ts.replace(old, "const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); const r = src => vm.runInContext(src, h.ctx); "
                                     "require('./helpers/%s').undo_%s_%s(r); return r; };   // v%s: %s as BASE on every page - tests/test_%s_anim_%s.js checks it" % (hname, H, V, V, cfg.name, H, V))
                with open(tp, 'w', encoding='utf-8', newline='') as f:
                    f.write(ts)
                log(cfg.work, 'wire %s loads the v%s undo helper' % (prev_test, V))
            else:
                log(cfg.work, 'wire TODO %s: its load() line is not the standard one - add the v%s undo by hand' % (prev_test, V))
    # 5. the test from the template + registration
    tname = 'test_%s_anim_%s.js' % (H, V)
    with open(os.path.join(T, 'hero_anim_test.tmpl.js'), encoding='utf-8') as f:
        test = sub(f.read())
    with open(os.path.join(tree, 'tests', tname), 'w', encoding='utf-8', newline='\n') as f:
        f.write(test)
    rp = os.path.join(tree, 'tests', 'run_all_tests.sh')
    rs = open(rp, encoding='utf-8', newline='').read()
    if tname not in rs:
        nl = '\r\n' if '\r\n' in rs else '\n'   # the file's own line ends
        reg = ('note "%s (v%s %s %d animations from the Phil PASS H3 exports via tools/integrate_hero.py: sheets, anchors, timing = BASE, contact cells, whole fights)"' + nl + 'node tests/%s || FAILED=1' + nl) % (
            tname, V, cfg.name, len(order), tname)
        anchor = 'note "test_skill_previews_1164.js' if 'note "test_skill_previews_1164.js' in rs else 'rm -f probe-db-*.json'
        rs = rs.replace(anchor, reg + anchor, 1)
        with open(rp, 'w', encoding='utf-8', newline='') as f:
            f.write(rs)
    # 6. ratchet
    bl = os.path.join(fdir, 'sheet_size_baseline_1140.json')
    if os.path.exists(bl) and before['anim']:
        raw = open(bl, encoding='utf8', newline='').read()
        B = json.loads(raw)
        old = {v['u'].split('?')[0] for v in before['anim'].values() if isinstance(v, dict) and v.get('u')}
        n0 = len(B['files'])
        B['files'] = [f for f in B['files'] if f not in old]
        if len(B['files']) != n0:
            out = json.dumps(B, indent=1)   # the file's own line ends and final newline kept
            if '\r\n' in raw:
                out = out.replace('\n', '\r\n')
            if raw.endswith('\n'):
                out += '\r\n' if raw.endswith('\r\n') else '\n'
            with open(bl, 'w', encoding='utf8', newline='') as fh:
                fh.write(out)
        log(cfg.work, 'wire size baseline %d -> %d (replaced %s sheets leave the ratchet)' % (n0, len(B['files']), H))
    # 7. reports
    rep = dict(base=base, autoAlt=alt, helper=hname, chainedInto=prev, test=tname, entries={st: entry_line(st, ents[st]).strip() for st in order})
    urls = dump(tree, os.path.join(tree, 'emberweave-heroes.html'), 'allAssetUrls()')
    rep['updateAll'] = {st: ents[st]['u'] in urls for st in order}
    rep['skillPreview'] = dump(tree, os.path.join(tree, 'emberweave-heroes.html'),
                               "(typeof skillPreviewStates==='function')?['attack','crit',0,1,2,3].map(s=>[s,skillPreviewStates('%s',s)]):'no skill previews on this page (before v1164)'" % H)
    if 'passive' in order:
        rep['passiveHook'] = 'event clip: the passive case must call firePassiveClip(u, ...) when it comes on - check the hero\'s pass case (Kharos v1175 camouflage).'
    rep['condense'] = condense_dry(tree, H, [ents[st]['u'] for st in order])
    r['wire'] = rep
    cfg.save_run(r)
    for k in ('updateAll', 'skillPreview', 'condense'):
        log(cfg.work, 'wire %s %s' % (k, json.dumps(rep[k])[:600]))
    if not all(rep['updateAll'].values()):
        die('Update all features does not list every new sheet')


def _test_of_helper(tree, helper):
    """the release's own test: tests/test_*<NNNN>*.js for the helper's version (test_hobb_kharos_1175.js for anim-hobb-kharos-1175.js)."""
    m = re.search(r'(\d{4})\.js$', helper)
    td = os.path.join(tree, 'tests')
    own = [f for f in os.listdir(td) if m and f.startswith('test_') and f.endswith('.js') and m.group(1) in f and not f.startswith(('test_anim_slim', 'test_q95', 'test_condense'))]
    return own[0] if len(own) == 1 else None


def condense_dry(tree, hero, urls):
    """tools/condense_sheets.py --dry --only <hero>, run from a temp copy (its report files are written next to the script)."""
    d = tempfile.mkdtemp(prefix='ew-cond-')
    try:
        for f in ('condense_sheets.py', 'dump_clips.js', 'condense_measure_1141.json'):
            shutil.copy2(os.path.join(tree, 'tools', f), d)
        p = subprocess.run(['python', '-I', os.path.join(d, 'condense_sheets.py'), tree, '--only', hero, '--dry'], capture_output=True, text=True, timeout=3600)
        rp = os.path.join(d, 'condense_report_1141.json')
        if not os.path.exists(rp):
            return dict(error=(p.stderr or p.stdout)[-600:])
        R = json.load(open(rp))
        out = {}
        for u in urls:
            e = R['plan'].get(u.split('?')[0], {})
            out[u.split('/')[-1].split('?')[0]] = dict(tier=bool(e.get('k')), skip=e.get('skip'), k=e.get('k'))
        return out
    finally:
        shutil.rmtree(d, ignore_errors=True)
