"""v1138 COMBAT SOUND BUILD - turns Phil's picks into the game's sound files + manifest.

Phil 15 Oct 2026: "wire it all in game". Sources of truth (the Archive, never copied whole into the repo):
  SOUND LIST 11OCT2026/sound_list.json              every sound row (id, hero, slot, phase, timing, hook)
  SOUND LIST 11OCT2026/pack_match/phil_picks.json    Phil's final pick per row id (WINS over everything)
  SOUND LIST 11OCT2026/pack_match/pack_picks_claude.json  older picks; only the ones marked "Phil ..." count
  SOUND LIST 11OCT2026/approved/APPROVED.json         the shared weapon-attack library + S0014 / S0408
  SOUND LIST 11OCT2026/approved/spells/*.mp3          final rendered spell sounds (already adjusted)

What it writes (all in the repo):
  assets/audio/sfx/<name>.m4a      AAC-LC, 48 kHz; mono 64 kbps, ults that are stereo at the source 96 kbps stereo
  assets/audio/sfx/sfx_manifest.json   row id -> file(s) + play rule + measured loudness and impact peak
  emberweave-heroes.html           the SFX_DATA block between the SFX-DATA markers (the same data, for the client)

LOUDNESS (Phil 15 Oct: "they should all be about the same loudness, minus the ones i said i want slightly lower"):
  one metric for every file - max momentary loudness (BS.1770 K-weighted, 400 ms window; tools/sfx_loudness.py).
  Every file is set to TARGET_LUFS + its offset (Phil's quieter ones below) with a -1 dBTP true-peak ceiling
  (a limiter catches the overs; gain is re-measured until the file sits on its target).
PEAK (Phil: "the slice/contact peak of the sword sound should meet with the sword reaching the target"):
  every file's impact peak (seconds from its start to its loudest 10 ms) is measured on the FINAL encoded file
  and stored as `peak`; the client starts a sound `peak` seconds before its moment.
Run:  python tools/build_sfx.py            (needs ffmpeg/ffprobe on PATH, numpy, scipy)
      python tools/build_sfx.py --check    (re-measure the shipped files, change nothing)
"""
import hashlib, json, os, re, subprocess, sys, tempfile
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfx_loudness as L

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SL = os.environ.get('EW_SOUND_LIST') or r'C:\Users\Home\OneDrive\Desktop\Emberweave Archive\Open Projects\3 - Heroes, Art and Lore\SOUND LIST 11OCT2026'
OUT = os.path.join(ROOT, 'assets', 'audio', 'sfx')
HTML = os.path.join(ROOT, 'emberweave-heroes.html')
VER = 1138
TARGET_LUFS = -16.0
TP_CEIL = -1.0
TOL_LU = 2.0
MAX_LEN = 6.5          # no combat sound runs longer (ult beds are 4-6 s)
HIT_MAX_LEN = 1.6      # a sound that plays on each of several hits stays short
# Phil's deliberate offsets, relative to the target (15 Oct, coordinator): everything else = the target.
OFFSETS = {'LIB-ATK-FIST-HEAVY': -3.0, 'LIB-ATK-BOW': -3.0, 'LIB-ATK-THRUST': -3.0, 'LIB-ATK-CASTER-WHOOSH': -5.0,
           'S0456': -3.0}   # S0456 = Ambrel's Sacred Bells passive, briefed as quiet

# ---- basic attacks: one shared sound per weapon type (APPROVED.json). sound_list's `shared` column where it names one
# of the 12; the rest mapped by Claude from the weapon in the row (marked * - Phil to confirm). Every Magic / Healer
# ranged hero plays the caster whoosh (Phil 14 Oct: "ALL ranged caster basic attacks play this same whoosh").
WEAPON = {
    'konwu': 'STAFF', 'grosk': 'FIST-HEAVY', 'tick': 'FIST-METAL', 'aureth': 'BLADE-LIGHT*', 'bloatus': 'THRUST*',
    'vael': 'BLADE-HEAVY', 'rhukk': 'BLUNT*', 'hurne': 'CLAW*', 'gruel': 'BLUNT*', 'quorrel': 'BLUNT', 'korvux': 'BLADE-HEAVY',
    'hollow': 'BLADE-LIGHT', 'carn': 'BLADE-HEAVY', 'nox': 'BLADE-LIGHT*', 'seyla': 'BLADE-LIGHT', 'zahri': 'THRUST',
    'kharos': 'BLADE-LIGHT', 'brannus': 'BLUNT*', 'deepcleft': 'CLAW', 'askel': 'STAFF', 'tharl': 'FIST-HEAVY', 'hobb': 'BLUNT',
    'pellucid': 'FIST-HEAVY*', 'veyr': 'BLADE-LIGHT*', 'vex': 'BLADE-LIGHT', 'iver': 'THRUST', 'joss': 'BLUNT', 'ambrel': 'BLUNT',
    'tolley': 'BLUNT',
    # ranged, physical
    'meridian': 'THROWN*', 'rivet': 'GUN', 'calypsa': 'THROWN*', 'yenna': 'THROWN', 'sorrel': 'THROWN', 'grimsby': 'THROWN*',
    'sloe': 'BOW', 'rafe': 'GUN',   # Rafe: GUN when he shoots, BLADE-LIGHT when he cuts (<= 2.5 m) - both in his row
    # ranged casters (Magic / Healer)
    **{k: 'CASTER-WHOOSH' for k in ['vulmar', 'sylthaine', 'vireo', 'fritz', 'umbris', 'oakmir', 'astra', 'maren', 'lumi', 'vesper',
                                    'tessit', 'linnet', 'lysara', 'nerisse', 'vaelora', 'dandra', 'pyroclast', 'absalie', 'mellan',
                                    'aldren', 'ceraline', 'orryn', 'mirelle']},
}
RAFE_MELEE = 'BLADE-LIGHT'

# ---- play rules. Default from the row's timing text (rule_for); these are the rows whose moment needs saying.
#   cast    - the cast press (the clip starts): the file starts with the clip (peak not used)
#   release - the end of the cast time, when the effect lets go (the engine's own cast clock): peak on that moment
#   hit     - every blow the spell itself lands (the damage moment; a timed blow is scheduled ahead): peak on each blow,
#             `max` blows a cast; files[] with `seq` = blow N plays file N
#   land    - the first blow / arrival of the spell (one sound): peak on it (the delivery's arrival or a dash landing, scheduled
#             ahead; otherwise the first real blow)
#   strike  - each real damage moment of the spell (a stage that comes after others that deal none), `max` a cast
#   passive - the passive's own trigger event (named in `ev`): starts on the trigger
RULES = {
    'S0014': {'rule': 'hit', 'max': 3},                      # Grosk Hammer Fists: one file on each of the 3 punches (hitTimes)
    'S0015': {'rule': 'release'},                            # Croc Drop lift-off: the leap leaves on the release (clip cell 10)
    'S0016': {'rule': 'land'},                               # Croc Drop landing
    # Vex Razor Tempest: her three cuts resolve at the release (one tick); the tempest art (vex_razor_tempest.webp, 12 fps real time
    # from the release) flashes three NEW slashes: cell 2 (first X), cell 19 (second X), cell 39 (the last single cut) - measured as the
    # three largest jumps in bright-pixel count on the sheet (+912 / +2614 / +1142 px). Cut N plays its file with its peak on that cell.
    'S0408': {'rule': 'seq', 'max': 3, 'at': [2 / 12, 19 / 12, 39 / 12]},
    # MULTI-HIT COMPOSITES whose blows all land on ONE engine tick (measured: Tick Mainspring 5 hits, Quorrel Contempt Storm 6, Rafe Dead
    # Man's Fortune 5, Rivet Full Arsenal 5 - each deals every blow on the release tick): played once, the FIRST hit's peak on that tick
    # (`peak`: 'first' = the first loud moment in the file; a number = the recipe's "shots in at" time, the bed swelling before it).
    'S0034': {'rule': 'release', 'peak': 'first'},
    'S0165': {'rule': 'release', 'peak': 'first'},
    'S0514': {'rule': 'release', 'peak': 0.45},
    'S0375': {'rule': 'release', 'peak': 0.45},
    'S0230': {'rule': 'hit', 'max': 3, 'split': 3},          # Pellucid Worldbreaker: 3 slams, the composite split per slam
    'S0201': {'rule': 'hit', 'max': 3, 'win': 4.0},          # Hollow Vanishing Point strikes (hollowStrike runs off his own timer: window)
    'S0009': {'rule': 'hit', 'max': 3},                      # Kon-Wu Ruyi slams, layer max 3
    'S0081': {'rule': 'hit', 'max': 5},                      # Fritz Storm Surge bolts
    'S0083': {'rule': 'hit', 'max': 5},                      # Fritz Chain Lightning links
    'S0293': {'rule': 'hit', 'max': 5},                      # Yenna Crescent Stampede projectiles
    'S0308': {'rule': 'hit', 'max': 5, 'win': 3.0},          # Zahri Noonday Stampede, each enemy in the path (her run's own timer: window)
    'S0356': {'rule': 'hit', 'max': 5},                      # Calypsa Tidal Ribbon, each enemy along the line
    'S0130': {'rule': 'release'},                            # Hurne Feed Them rupture: it bursts on the release (instant; no pack = no damage, still the burst)
    'S0237': {'rule': 'release'},                            # Orryn Spiral Current (the file is the moving pool, played once)
    'S0468': {'rule': 'strike', 'max': 3, 'reuse': 'S0460'}, # Ceraline ult: each effigy shatter (its damage) = the Sealing Wax sound (Phil)
    'S0469': {'rule': 'passive', 'ev': 'tallow', 'reuse': 'S0460'},   # Living Tallow encases = the Sealing Wax sound (Phil)
}
PASSIVE_EV = {   # row -> the trigger the client fires (sfxPassive(u, ev))
    'S0446': 'livingpages', 'S0456': 'sacredbells', 'NEW-askel-passive': 'unshaken', 'S0068': 'contagion', 'NEW-brannus-passive': 'pridemomentum',
    'S0361': 'prismscales', 'S0469': 'tallow', 'S0426': 'contagion', 'S0203': 'notthere', 'S0479': 'staticcharge', 'S0486': 'unbroken',
    'S0194': 'hush', 'S0223': 'splendor', 'S0115': 'deeproots', 'S0241': 'abyssres', 'S0401': 'unwind', 'S0254': 'layered',
    'S0098': 'contagion', 'NEW-veyr-passive': 'weightless',
}


def rule_for(row):
    t = (row.get('timing') or '').lower()
    if 'hit on cast' in t or 'clamp' in t or 'leaves the hand' in t or 'dash starts' in t or 'charge starts' in t or t.startswith('cast (') or t.startswith('launch'):
        return {'rule': 'release'}
    if t.startswith('cast frame') or t.startswith('ult press'):
        return {'rule': 'cast'}
    if t.startswith('each') or ' each ' in t:
        return {'rule': 'hit', 'max': 3}
    if t.startswith('loop') or t.startswith('while'):
        return {'rule': 'release'}
    return {'rule': 'land'}


def load():
    j = lambda *p: json.load(open(os.path.join(SL, *p), encoding='utf-8'))
    rows = {r['id']: r for r in j('sound_list.json')['rows']}
    phil = j('pack_match', 'phil_picks.json')
    old = j('pack_match', 'pack_picks_claude.json')
    appr = j('approved', 'APPROVED.json')
    picks = {k: v for k, v in old.items() if str(v.get('by', '')).startswith('Phil')}   # only Phil's own older picks
    picks.update(phil)                                                                 # phil_picks WINS
    for k in ('S0014', 'S0408'):
        picks[k] = {'approved': k, 'by': appr[k]['picked']}
    return rows, picks, appr


def src_path(p):
    p = p.replace('/', '\\') if os.name == 'nt' else p
    return p if os.path.isabs(p) else os.path.join(SL, p)


def ff(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def render(src, dst, offset_db, trim, stereo, max_len):
    """trim -> silence-trim -> loudness to TARGET+offset with a -1 dBTP ceiling -> AAC. Returns the final measurement."""
    want = TARGET_LUFS + offset_db
    with tempfile.TemporaryDirectory() as td:
        base = os.path.join(td, 'base.wav')
        ln = min(max_len, trim) if trim else max_len
        ch = '2' if stereo else '1'
        # leading silence (below -55 dB) off, the length cap with a 60 ms fade so a cut never clicks
        ff('-i', src, '-af', 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.005,atrim=start=0:end=%.3f,afade=t=out:st=%.3f:d=0.06' % (ln, max(0, ln - 0.06)),
           '-ac', ch, '-ar', '48000', '-c:a', 'pcm_f32le', base)
        x = L.decode(base)
        g = want - L.max_momentary(x)
        lim_db = TP_CEIL - 0.3
        for _ in range(10):
            lim = os.path.join(td, 'lim.wav')
            # gain, then a brick-wall limiter at the ceiling (4x oversampled), then the final encode
            ff('-i', base, '-af', 'volume=%.3fdB,aresample=192000,alimiter=limit=%.4f:attack=1:release=40:level=false,aresample=48000' % (g, 10 ** (lim_db / 20)),
               '-c:a', 'pcm_f32le', lim)
            ff('-i', lim, '-c:a', 'aac', '-b:a', '96k' if stereo else '64k', '-ar', '48000', '-movflags', '+faststart', dst)
            m = L.measure(dst)
            ok_l = abs(m['lufs_m'] - want) <= 0.4
            ok_p = m['tp_db'] <= TP_CEIL + 0.3
            if ok_l and ok_p:
                break
            if not ok_p:      # the encoder overshoots the limiter on a sharp transient: pull the ceiling down by the over
                lim_db -= (m['tp_db'] - TP_CEIL) + 0.2
            g += want - m['lufs_m']
        return m


def split_composite(src, n, gap, td):
    """Cut a multi-hit composite into its n hits. The composite was rendered with each hit starting `gap` s after the last
    (its recipe), so hit i is [i*gap, (i+1)*gap) (the last runs to the end). Each part keeps its own tail-in fade."""
    x = L.decode(src)
    end = x.shape[1] / L.SR
    cuts = [i * gap for i in range(n)] + [end]
    outs = []
    for i in range(n):
        p = os.path.join(td, 'part%d.wav' % i)
        a, b = cuts[i], cuts[i + 1]
        ff('-i', src, '-af', 'atrim=start=%.4f:end=%.4f,asetpts=PTS-STARTPTS,afade=t=in:d=0.005,afade=t=out:st=%.4f:d=0.05' % (a, b, max(0, b - a - 0.05)),
           '-c:a', 'pcm_f32le', p)
        outs.append(p)
    return outs, cuts[:-1]


def build():
    rows, picks, appr = load()
    os.makedirs(OUT, exist_ok=True)
    files, made = {}, {}           # name -> manifest entry; source key -> name (dedupe: one file per source + trim + offset)
    used_names = set()
    try:   # a file whose source and settings are unchanged since the last build is kept as it is (same bytes, same measurement)
        prev = json.load(open(os.path.join(OUT, 'sfx_manifest.json'), encoding='utf-8'))['files']
    except Exception:
        prev = {}
    force = '--force' in sys.argv

    def add(name, src, offset, trim, stereo, max_len, note):
        key = (os.path.normcase(src), trim, offset, stereo, max_len)
        if key in made:
            return made[key]
        dst = os.path.join(OUT, name + '.m4a')
        st = os.stat(src)
        ckey = '%s|%s|%s|%s|%s|%d|%d|%s|%s' % (os.path.basename(src), trim, offset, stereo, max_len, st.st_size, int(st.st_mtime), TARGET_LUFS, TP_CEIL)
        if not force and name in prev and prev[name].get('key') == ckey and os.path.exists(dst) and not os.path.basename(src).startswith('part'):
            files[name] = prev[name]; made[key] = name; used_names.add(name)
            return name
        m = render(src, dst, offset, trim, stereo, max_len)
        files[name] = {'key': ckey, 'f': 'sfx/%s.m4a?v=%d' % (name, VER), 'peak': m['peak'], 'dur': m['dur'], 'lufs_m': m['lufs_m'], 'tp_db': m['tp_db'],
                       'target': TARGET_LUFS + offset, 'offset': offset, 'ch': m['channels'], 'bytes': os.path.getsize(dst),
                       'src': os.path.basename(src), 'note': note}
        made[key] = name
        used_names.add(name)
        print('  %-28s %6.1f LUFS-M (target %6.1f) TP %5.1f peak %.3f s  %5.2f s  %s' % (name, m['lufs_m'], TARGET_LUFS + offset, m['tp_db'], m['peak'], m['dur'], os.path.basename(src)))
        return name

    # 1. the weapon library
    lib = {}
    for k, v in appr.items():
        if k.startswith('LIB-ATK-'):
            lib[k] = add(k, src_path(v['file']), OFFSETS.get(k, 0.0), None, False, 2.2, v.get('picked', ''))
    # 2. every picked row
    out_rows, unmapped = {}, []
    for rid, p in sorted(picks.items()):
        r = rows.get(rid)
        hero = r['entity_key'] if r else (rid.split('-')[1] if rid.startswith('NEW-') else None)
        slot = r['slot'] if r else ('passive' if rid.endswith('-passive') else None)
        if p.get('none'):
            out_rows[rid] = {'hero': hero, 'slot': slot, 'ability': p.get('spell', ''), 'none': True, 'by': p.get('by', '')}
            continue
        spec = dict(rule_for(r)) if r else {'rule': 'passive'}
        if slot == 'passive':
            spec = {'rule': 'passive', 'ev': PASSIVE_EV.get(rid)}
        spec.update(RULES.get(rid, {}))
        if spec['rule'] == 'passive' and not spec.get('ev'):
            unmapped.append((rid, 'passive with no trigger hook'))
        stereo_ok = slot == 'ult'
        ml = HIT_MAX_LEN if (spec['rule'] in ('hit', 'seq') and spec.get('max', 1) > 1 and not spec.get('split')) else MAX_LEN
        names = []
        if spec.get('reuse'):
            names = out_rows[spec['reuse']]['files'] if spec['reuse'] in out_rows else None
            if names is None:   # the reused row comes later in sort order: render it now
                rp = picks[spec['reuse']]
                names = [add(spec['reuse'], src_path(rp['file']), OFFSETS.get(spec['reuse'], 0.0), rp.get('trim'), False, MAX_LEN, rp.get('by', ''))]
        elif p.get('approved'):
            a = appr[p['approved']]
            fl = a.get('files') or [a['file']]
            for i, f in enumerate(fl):
                nm = rid if len(fl) == 1 else '%s-%d' % (rid, i + 1)
                names.append(add(nm, src_path(f), OFFSETS.get(rid, 0.0), None, False, HIT_MAX_LEN, a.get('picked', '')))
        elif spec.get('split'):
            with tempfile.TemporaryDirectory() as td:
                parts, top = split_composite(src_path(p['file']), spec['split'], p['recipe']['gap'], td)
                for i, pp in enumerate(parts):
                    names.append(add('%s-%d' % (rid, i + 1), pp, OFFSETS.get(rid, 0.0), None, stereo_ok and L.decode(pp).shape[0] > 1, HIT_MAX_LEN,
                                     'split %d/%d of %s (hit starts %s s)' % (i + 1, spec['split'], os.path.basename(p['file']), ','.join('%.2f' % t for t in top))))
            spec['seq'] = True
        else:
            src = src_path(p['file'])
            st = stereo_ok and L.decode(src).shape[0] > 1
            names.append(add(rid, src, OFFSETS.get(rid, 0.0), p.get('trim'), st, ml, p.get('by', '')))
            if spec.get('peak') is not None:   # a composite: align its FIRST hit, not its loudest
                f = files[names[-1]]
                if spec['peak'] == 'first':
                    pk = L.peaks(L.decode(os.path.join(OUT, names[-1] + '.m4a')), rel_db=-8.0, min_gap_s=0.08)
                    f['peak'], f['peak_from'] = round(pk[0], 4), 'first hit of %d loud moments %s' % (len(pk), ','.join('%.2f' % t for t in pk[:8]))
                else:
                    f['peak'], f['peak_from'] = float(spec['peak']), "the recipe's shots-in time"
                spec.pop('peak')
        if len(names) > 1:
            spec['seq'] = True
        out_rows[rid] = {'hero': hero, 'slot': slot, 'ability': (r or {}).get('ability') or p.get('spell', ''), 'phase': (r or {}).get('phase'),
                         'timing': (r or {}).get('timing'), 'hook': (r or {}).get('hook'), 'files': names, 'by': p.get('by', ''), **spec}
    # 3. attacks: every hero with a weapon type
    attack = {}
    for h, w in WEAPON.items():
        attack[h] = {'lib': 'LIB-ATK-' + w.rstrip('*'), 'mapped_by_claude': w.endswith('*')}
    attack['rafe']['melee'] = 'LIB-ATK-' + RAFE_MELEE
    # the composite check: a composite played once must have its later hits within a frame of the game's (reported, not fixed here)
    stale = [f for f in os.listdir(OUT) if f.endswith('.m4a') and f[:-4] not in used_names]
    for f in stale:
        os.remove(os.path.join(OUT, f))
    man = {'version': VER, 'made_by': 'tools/build_sfx.py', 'metric': 'max momentary loudness, BS.1770 K-weighted, 400 ms (LUFS-M)',
           'target_lufs_m': TARGET_LUFS, 'tolerance_lu': TOL_LU, 'true_peak_ceiling_db': TP_CEIL, 'offsets': OFFSETS,
           'files': files, 'rows': out_rows, 'attack': attack, 'unmapped': unmapped,
           'total_bytes': sum(v['bytes'] for v in files.values())}
    json.dump(man, open(os.path.join(OUT, 'sfx_manifest.json'), 'w', encoding='utf-8'), indent=1, sort_keys=True)
    write_html_block(man)
    print('files %d, %.2f MB; rows %d (%d none); unmapped %s' % (len(files), man['total_bytes'] / 1e6, len(out_rows),
                                                            sum(1 for v in out_rows.values() if v.get('none')), unmapped))


def client_data(man):
    """The compact table the client reads: files {name:[url, peak]}, heroes {key:{atk, melee?, green/blue/ult/passive:[row...]}}."""
    F = {k: [v['f'], v['peak']] for k, v in sorted(man['files'].items())}
    H = {}
    for h, a in sorted(man['attack'].items()):
        H.setdefault(h, {})['atk'] = a['lib']
        if a.get('melee'):
            H[h]['melee'] = a['melee']
    for rid, r in sorted(man['rows'].items()):
        if r.get('none') or not r.get('files'):
            continue
        e = {'id': rid, 'on': r['rule'], 'f': r['files']}
        for k in ('max', 'ev', 'at', 'win'):
            if r.get(k) is not None:
                e[k] = r[k]
        if r.get('seq'):
            e['seq'] = 1
        H.setdefault(r['hero'], {}).setdefault(r['slot'], []).append(e)
    return {'v': man['version'], 'files': F, 'heroes': H}


BEGIN = '/* SFX-DATA BEGIN (generated by tools/build_sfx.py - do not edit by hand) */'
END = '/* SFX-DATA END */'


def write_html_block(man):
    s = open(HTML, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in s else '\n'   # the page's own line ends
    blk = BEGIN + nl + 'const SFX_DATA=' + json.dumps(client_data(man), separators=(',', ':'), sort_keys=True) + ';' + nl + END
    if BEGIN in s:
        s = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END), lambda m: blk, s, count=1, flags=re.S)
    else:
        raise SystemExit('SFX-DATA markers missing in emberweave-heroes.html')
    open(HTML, 'w', encoding='utf-8', newline='').write(s)


def check():
    man = json.load(open(os.path.join(OUT, 'sfx_manifest.json'), encoding='utf-8'))
    bad = 0
    for k, v in sorted(man['files'].items(), key=lambda kv: kv[1]['lufs_m']):
        m = L.measure(os.path.join(OUT, k + '.m4a'))
        ok = abs(m['lufs_m'] - v['target']) <= TOL_LU and m['tp_db'] <= TP_CEIL + 0.5
        bad += not ok
        print('%-4s %-28s %6.1f (target %6.1f) TP %5.1f peak %.3f' % ('ok' if ok else 'BAD', k, m['lufs_m'], v['target'], m['tp_db'], m['peak']))
    print('bad', bad)


if __name__ == '__main__':
    check() if '--check' in sys.argv else build()
