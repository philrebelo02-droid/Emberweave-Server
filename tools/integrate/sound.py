"""SOUND ROWS: an ability sound whose peak belongs on the release or the landing moves off rule 'cast' (memory 'SFX: peak on contact').

The client starts a sound `peak` seconds before its moment; rule 'cast' puts that moment on the press, so a cast whose blow comes at the release
(u._pend clears) or at a later landing (the last doEffect: a form / 'land' delivery) peaks early. v1162 Korvux (S0172 / S0174 cast -> land) and
v1175 Hobb / Kharos (S0245 -> release, S0246 -> land, S0298 / S0300 -> release) made the move by hand in three places; this does the same edits:
  tools/build_sfx.py RULES               '<id>': {'rule': '<rule>'}, + a comment (a new line before RULES' closing brace, or the existing line's rule)
  assets/audio/sfx/sfx_manifest.json     rows.<id>.rule (text edit: the file's own CRLF / indent / no final newline kept)
  emberweave-heroes.html SFX_DATA        heroes.<hero>.<slot>[i].on (text edit inside the generated block - no rebuild)
No audio is re-encoded and nothing else in build_sfx.py (SFX_ATK_GAIN, loudness, peaks) is touched: only the moment a file is started from moves.

THE PROPOSAL (from the engine stage's moments, run.json 'engine'): a 'cast' row whose cast has a landing after its release -> 'land', else
'release'. It matches every row v1162 / v1175 moved and the v1142-v1173 hand rows except three judgement calls (Aureth S0054 and Nox S0329 /
S0332 stay on the release though a second delivery follows): the config key `sound: {"<id>": "<rule>"}` is the decision when given
(`{}` = no sound change), the proposal is used only when the key is absent.
"""
import ast
import json
import os
import re

CASTS = ('green', 'blue', 'ult')
RULES_OK = ('cast', 'release', 'land')
SLOT_WORD = {'green': 'green', 'blue': 'blue', 'ult': 'ult'}


def manifest_path(tree):
    return os.path.join(tree, 'assets', 'audio', 'sfx', 'sfx_manifest.json')


def hero_rows(tree, hero):
    """the hero's ability rows the client plays (green / blue / ult, not 'none', with files): {id: row}."""
    with open(manifest_path(tree), encoding='utf-8') as f:
        man = json.load(f)
    return {rid: r for rid, r in sorted(man['rows'].items())
            if r.get('hero') == hero and r.get('slot') in CASTS and not r.get('none') and r.get('files')}


def _times(e):
    rel = e.get('release', e.get('releaseCell'))
    land = e.get('land', e.get('landCell'))
    return rel, land


def propose(rows, engine):
    """{id: {rule, why}} for each 'cast' row: 'land' when the engine lands the cast after its release, else 'release'."""
    out = {}
    for rid, r in sorted(rows.items()):
        if r.get('rule') != 'cast':
            continue
        e = (engine or {}).get(r['slot'])
        if not e or e.get('releaseCell') is None:
            continue
        rel, land = _times(e)
        if land is not None and land > rel + 1e-6:
            out[rid] = dict(rule='land', why='%s %s: the landing (cell %s) comes after the release (cell %s) - the blow is the landing' % (r['slot'], r.get('ability', ''), e.get('landCell'), e['releaseCell']))
        else:
            out[rid] = dict(rule='release', why='%s %s: one delivery, at the release (cell %s)' % (r['slot'], r.get('ability', ''), e['releaseCell']))
    return out


def decide(cfg_sound, rows, engine):
    """the changes to make {id: rule} and where they came from ('config' | 'proposal')."""
    if cfg_sound is not None:
        ch, src = dict(cfg_sound), 'config'
    else:
        ch, src = {rid: p['rule'] for rid, p in propose(rows, engine).items()}, 'proposal'
    for rid, rule in ch.items():
        if rid not in rows:
            raise ValueError('sound %s: not one of this hero\'s ability rows %s' % (rid, sorted(rows)))
        if rule not in RULES_OK:
            raise ValueError('sound %s: rule %r (one of %s)' % (rid, rule, RULES_OK))
    return {rid: rule for rid, rule in sorted(ch.items()) if rows[rid].get('rule') != rule}, src


# ---------------------------------------------------------------- the three edits (text, so every other byte stays)
def edit_manifest(text, changes):
    for rid, rule in changes.items():
        m = re.compile(r'\n  "%s": \{' % re.escape(rid)).search(text, text.index('\n "rows": {'))
        if not m:
            raise ValueError('manifest: row %s not found' % rid)
        a = m.end()
        b = text.index('\n  }', a)
        blk = text[a:b]
        nb, n = re.subn(r'(\n   "rule": ")[a-z]+(")', lambda x: x.group(1) + rule + x.group(2), blk)
        if n != 1:
            raise ValueError('manifest: row %s has %d rule lines' % (rid, n))
        text = text[:a] + nb + text[b:]
    return text


def rules_block(text):
    a = text.index('\nRULES = {')
    b = text.index('\n}', a)
    return a, b


def rules_dict(text):
    """RULES as {id: {'rule': ...}} - parsed, not evaluated (some entries hold expressions); only literal 'rule' values are read."""
    a, b = rules_block(text)
    d = ast.parse(text[a + len('\nRULES = '):b + 2].replace('\r\n', '\n'), mode='eval').body
    out = {}
    for k, v in zip(d.keys, d.values):
        if isinstance(k, ast.Constant) and isinstance(v, ast.Dict):
            out[k.value] = {kk.value: vv.value for kk, vv in zip(v.keys, v.values)
                            if isinstance(kk, ast.Constant) and kk.value == 'rule' and isinstance(vv, ast.Constant)}
    return out


def edit_rules(text, changes, comments):
    nl = '\r\n' if '\r\n' in text else '\n'
    for rid, rule in changes.items():
        a, b = rules_block(text)
        m = re.compile(r"\n    '%s': \{'rule': '([a-z]+)'" % re.escape(rid)).search(text, a, b)
        if m:   # an existing line: its rule only (any reuse / max / peak it carries stays)
            text = text[:m.start(1)] + rule + text[m.end(1):]
            continue
        line = ("    '%s': {'rule': '%s'}," % (rid, rule)).ljust(61) + '# ' + comments[rid]
        text = text[:b + 1] + line + nl + text[b + 1:]   # its own line just before RULES' closing brace (b = the '\n' of '\n}')
    return text


def edit_page(text, hero, rows, changes):
    a = text.index('const SFX_DATA=')
    b = text.index('\n', a)
    line = text[a:b]
    D = json.loads(line[len('const SFX_DATA='):line.rindex(';')])
    for rid, rule in changes.items():
        slot = rows[rid]['slot']
        es = [e for e in D['heroes'].get(hero, {}).get(slot, []) if e.get('id') == rid]
        if len(es) != 1:
            raise ValueError('SFX_DATA.heroes.%s.%s: %d rows %s' % (hero, slot, len(es), rid))
        pat = '"id":"%s","on":"%s"' % (rid, es[0]['on'])
        if line.count(pat) != 1:
            raise ValueError('SFX_DATA: %r appears %d times' % (pat, line.count(pat)))
        line = line.replace(pat, '"id":"%s","on":"%s"' % (rid, rule))
    return text[:a] + line + text[b:]


def comment(cfg, rid, row, rule, engine):
    e = (engine or {}).get(row['slot']) or {}
    cell = e.get('landCell') if rule == 'land' else e.get('releaseCell')
    t = e.get('land') if rule == 'land' else e.get('release')
    what = 'the landing (the last delivery' if rule == 'land' else 'the release (the cast resolving'
    at = (', %s fight s' % t) if t is not None else ''
    return 'v%s %s %s: its peak on %s%s = %s clip cell %s), not from the press (tools/integrate_hero.py wire)' % (
        cfg.version, cfg.name, row.get('ability', rid), what, at, row['slot'], cell)


def _rw(p, fn):
    with open(p, encoding='utf-8', newline='') as f:
        s = f.read()
    s2 = fn(s)
    if s2 != s:
        with open(p, 'w', encoding='utf-8', newline='') as f:
            f.write(s2)
    return s, s2


def apply(tree, cfg, rows, changes, engine):
    """the three edits + read-backs (manifest JSON, RULES literal, the page's own SFX_DATA): returns {id: [before, after]}."""
    if not changes:
        return {}
    com = {rid: comment(cfg, rid, rows[rid], rule, engine) for rid, rule in changes.items()}
    page = os.path.join(tree, 'emberweave-heroes.html')
    olds = []
    try:
        olds.append((manifest_path(tree), _rw(manifest_path(tree), lambda s: edit_manifest(s, changes))[0]))
        olds.append((os.path.join(tree, 'tools', 'build_sfx.py'), _rw(os.path.join(tree, 'tools', 'build_sfx.py'), lambda s: edit_rules(s, changes, com))[0]))
        olds.append((page, _rw(page, lambda s: edit_page(s, cfg.hero, rows, changes))[0]))
        with open(manifest_path(tree), encoding='utf-8') as f:
            M = json.load(f)['rows']
        with open(os.path.join(tree, 'tools', 'build_sfx.py'), encoding='utf-8', newline='') as f:
            R = rules_dict(f.read())
        bad = [rid for rid, rule in changes.items() if M[rid]['rule'] != rule or R.get(rid, {}).get('rule') != rule]
        if bad:
            raise ValueError('sound read-back: %s' % bad)
    except Exception:
        for p, s in olds:
            with open(p, 'w', encoding='utf-8', newline='') as f:
                f.write(s)
        raise
    return {rid: [rows[rid]['rule'], rule] for rid, rule in changes.items()}
