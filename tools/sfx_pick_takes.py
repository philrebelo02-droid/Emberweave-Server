"""v1165 SWING TAKES + SHIMMER TAKES - pick 6 clearly different takes per weapon type and the 6 melee shimmers.

Phil 16 Oct 2026: "melee hits are kind of annoying after a while" / "Maybe we should add a magic shimmer to play at the same time as the
swings" / "the average human probably can't hear it" (the v1 jitter) / "Can you make the shimmers vary also? Like 6 random shimmers 6 random
hits so it's had many different variables and in 1 fight it basically never repeats".
  take 1 of every type = the approved file (APPROVED.json, unchanged bytes in the game). Takes 2-6 come from the SAME library / pack family
  first (the candidate sets Phil's own attack tests were cut from: the sibling cuts of the approved file, the other takes of the same
  ElevenLabs prompt batch, the same RPG Magic Pack 3 family). A type short of 5 good real siblings gets the rest made from its real takes
  (a distinct EQ or transient variant) - listed as `made` in TAKES.json.
  "Clearly different": features per take (audible length to -40 dB, spectral centroid, impact-peak time, attack time, decay) on z-scores;
  greedy farthest-point from the takes already chosen (take 1 first), with near-duplicates refused (envelope correlation >= 0.93 to a
  chosen take, or feature distance < 0.6).
  Shimmers: the 4 on Phil's listening page (melee_shimmer_picks) + 2 more from RPG Magic Pack 3 Generic / Light Magic (peak <= 0.3 s,
  <= 1.5 s, the same airy family, each clearly different from the others).
Writes <SOUND LIST>/approved/takes_v1165/<TYPE>_<n>.wav (48 kHz mono float, the cut as used) + TAKES.json. build_sfx.py renders them.
Run:   python tools/sfx_pick_takes.py
"""
import json, os, subprocess, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfx_loudness as L

SL = os.environ.get('EW_SOUND_LIST') or r'C:\Users\Home\OneDrive\Desktop\Emberweave Archive\Open Projects\3 - Heroes, Art and Lore\SOUND LIST 11OCT2026'
OUT = os.path.join(SL, 'approved', 'takes_v1165')
LIB = r'C:\Emberweave\sfx-library\cuts'
PACK = os.environ.get('EW_PACK_WAV') or r'C:\Users\Home\OneDrive\Desktop\Emberweave Archive\Game Art\Sound Effects\RPG Magic Pack 3 - WOW Sound (Phil 14OCT2026)\wav'
EL = os.path.join(SL, 'eleven')
# the ElevenLabs batches of Phil's 14 Oct melee test pages (same prompts as the approved takes); copied into the Archive by this tool
SCR = os.environ.get('EW_MELEE_SCRATCH') or r'C:\Users\Home\AppData\Local\Temp\claude\C--Users-Home-Downloads-Emberweave-Server\d24c31cd-2e29-45c6-bb5e-87e188bd967a\scratchpad\melee'
c = lambda n: os.path.join(LIB, 'c%06d.wav' % n)   # noqa: E731
el = lambda d, n: os.path.join(EL, d, '%s_t%d.mp3' % (d.split('_r2')[0], n))   # noqa: E731
sc = lambda f: os.path.join(SCR, f)   # noqa: E731
pk = lambda f: os.path.join(PACK, f)   # noqa: E731

# candidate pools (label, path). Every pool is the approved take's own family: see the README for where each came from.
POOLS = {
    'BLADE-LIGHT': [('Sword Slide Cuts Metallic #%d (344 Audio, Historical Weapons Vol 2)' % (i + 1), c(8866 + i)) for i in range(6)] +
                   [('Swing 3 Large 03 (David Dumais, Melee Weapons Pack 1)', c(1420)), ('Mecha Energy Sword Cut (RogueWaves, Anime Studio)', c(7841)),
                    ('knifeSlice (Kenney RPG Audio)', c(334)), ('knifeSlice2 (Kenney RPG Audio)', c(335))],
    'BLADE-HEAVY': [('Long Two-Handed Axe Flesh Hit #%d (Justsoundeffects, Melee Weapons)' % (i + 1), c(6721 + i)) for i in range(4)] +
                   [('One-Handed Axe Drops #%d (Justsoundeffects, Melee Weapons)' % k, c(n)) for k, n in ((1, 6726), (2, 6727), (4, 6729), (6, 6731), (7, 6732), (10, 6734))],
    'BLUNT': [('Quick Heavy Weapon Swing To Thud Impact Var 01 #%d (David Dumais, Melee Weapons Pack 2)' % (i + 1), c(8996 + i)) for i in range(21) if i != 2],
    'FIST-HEAVY': [('impactPunch_%s (Kenney Impact Sounds)' % n, c(k)) for n, k in (('heavy_000', 275), ('heavy_001', 276), ('heavy_002', 277), ('heavy_003', 278), ('heavy_004', 279),
                                                                                ('medium_000', 280), ('medium_001', 281), ('medium_002', 282), ('medium_003', 283), ('medium_004', 284))],
    'FIST-METAL': [('ElevenLabs "robot punch impact" metal2_%02d' % i, sc('a2/metal2_%02d.mp3' % i)) for i in (1, 2, 3, 5, 6)] +
                  [('ElevenLabs "metal fist punch" %s t%d' % (d, i), el(d, i)) for d in ('LIB-ATK-FIST-METAL', 'LIB-ATK-FIST-METAL_r2') for i in range(1, 5)],
    'CLAW': [('ElevenLabs "claws slash flesh" claw2_%02d' % i, sc('a2/claw2_%02d.mp3' % i)) for i in (1, 2, 4, 5, 6)] +
            [('ElevenLabs "claw slash" %s t%d' % (d, i), el(d, i)) for d in ('LIB-ATK-CLAW', 'LIB-ATK-CLAW_r2') for i in range(1, 5)],
    'THRUST': [('ElevenLabs melee batch thrust_%02d' % i, sc('a/thrust_%02d.mp3' % i)) for i in (2, 3, 4, 5, 6)] +
              [('ElevenLabs "spear thrust" %s t%d' % (d, i), el(d, i)) for d in ('LIB-ATK-THRUST', 'LIB-ATK-THRUST_r2') for i in range(1, 5)],
    'STAFF': [('Spear And Stick Impact, Wooden #%d (344 Audio, Historical Weapons Vol 2)' % (i + 1), c(8850 + i)) for i in range(16)] +
             [('Impact Wood 23 (David Dumais, Melee Weapons Pack 1)', c(1422))],
    # ranged: no shimmer, the same variety
    'BOW': [('ElevenLabs "bow arrow shot" bow_%02d' % i, sc('a/bow_%02d.mp3' % i)) for i in range(1, 7)] +
           [('ElevenLabs "bow arrow shot" %s t%d' % (d, i), el(d, i)) for d in ('LIB-ATK-BOW', 'LIB-ATK-BOW_r2') for i in range(1, 5)],
    'GUN': [('ElevenLabs "musket gunshot" gun_%02d' % i, sc('a/gun_%02d.mp3' % i)) for i in range(1, 7)] +
           [('ElevenLabs "musket gunshot" %s t%d' % (d, i), el(d, i)) for d in ('LIB-ATK-GUN', 'LIB-ATK-GUN_r2') for i in range(1, 5)],
    'THROWN': [('Woodstick Swish 03 #%d (Justsoundeffects, Transition Whooshes Vol 1)' % k, c(n)) for k, n in ((3, 2709), (4, 2710))] +
              [('Whoosh Short 06 #%d (Justsoundeffects, Transition Whooshes Vol 1)' % (i + 1), c(2716 + i)) for i in range(5)],
    'CASTER-WHOOSH': [(n.replace('.wav', '') + ' (RPG Magic Pack 3)', pk(os.path.join(d, n))) for d, n in (
        (r'RPG3_Generic_Magic\Generic Magic', 'RPG3_Magic_Projectile02.wav'), (r'RPG3_Generic_Magic\Generic Magic', 'RPG3_Magic_Projectile03.wav'),
        (r'RPG3_Generic_Magic\Generic Magic', 'RPG3_Magic2_Projectiles01.wav'), (r'RPG3_Generic_Magic\Generic Magic', 'RPG3_Magic2_Projectiles02.wav'),
        (r'RPG3_Generic_Magic\Generic Magic', 'RPG3_Magic2_Projectiles03.wav'), (r'RPG3_Light_Magic\Light Magic', 'RPG3_LightMagic2_Projectile01.wav'),
        (r'RPG3_Light_Magic\Light Magic', 'RPG3_LightMagic2_Projectile02.wav'), (r'RPG3_Light_Magic\Light Magic', 'RPG3_LightMagic3_Projectile01.wav'))],
}
MELEE = ['BLADE-LIGHT', 'BLADE-HEAVY', 'BLUNT', 'FIST-HEAVY', 'FIST-METAL', 'CLAW', 'THRUST', 'STAFF']
# the page's 4 (Phil's listening page, cut as make.py cuts them) + 2 candidates pools for the extra two
SHIM_PAGE = [('Shimmer Cast 1', r'RPG3_Generic_Magic\Generic Magic\RPG3_MagicShimmer_Cast01.wav', 0.0, 1.5),
             ('Shimmer Cast 2', r'RPG3_Generic_Magic\Generic Magic\RPG3_MagicShimmer_Cast02.wav', 0.05, 1.55),
             ('Shimmer Buff 2', r'RPG3_Generic_Magic\Generic Magic\RPG3_MagicShimmer_Buff02.wav', 0.0, 1.3),
             ('Light swish', r'RPG3_Light_Magic\Light Magic\RPG3_LightMagicMisc_AttackMissed02.wav', 0.0, 1.0)]
SHIM_POOL = [('Shimmer Buff 1', r'RPG3_Generic_Magic\Generic Magic\RPG3_MagicShimmer_Buff01.wav'),
             ('Light swish 1', r'RPG3_Light_Magic\Light Magic\RPG3_LightMagicMisc_AttackMissed01.wav'),
             ('Light swish 3', r'RPG3_Light_Magic\Light Magic\RPG3_LightMagicMisc_AttackMissed03.wav'),
             ('Light swish 4', r'RPG3_Light_Magic\Light Magic\RPG3_LightMagicMisc_AttackMissed04.wav'),
             ('Shimmer Heal', r'RPG3_Generic_Magic\Generic Magic\RPG3_MagicShimmer_Heal.wav'),
             ('Subtle light ray', r'RPG3_Light_Magic\Light Magic\RPG3_LightMagicMisc_SubtleLightRay.wav')]
MAX_LEN_T = {'THROWN': 0.7, 'BOW': 1.0, 'GUN': 1.0}   # a ranged release stays as short as its approved take
MAX_TAKE = 1.4      # an alternate swing never runs longer than this (the approved files are 0.4-1.0 s; memory)
N_TAKES = 6
# takes the loudness render cannot bring to their type's target under the -1 dBTP ceiling (a needle transient: measured 1.2 LU short) - refused
EXCLUDE = {os.path.join(EL, 'LIB-ATK-FIST-METAL_r2', 'LIB-ATK-FIST-METAL_t1.mp3'), os.path.join(EL, 'LIB-ATK-GUN', 'LIB-ATK-GUN_t2.mp3')}


def mono(p):
    return L.decode(p, 1)[0]


def lead_trim(x, thr_db=-55):
    m = np.abs(x)
    i = int(np.argmax(m > 10 ** (thr_db / 20)))
    return x[i:]


def feats(x):
    from scipy.signal import butter, sosfilt
    x = sosfilt(butter(2, 40, 'high', fs=L.SR, output='sos'), x - x.mean())   # DC / sub rumble off (an ElevenLabs take's DC read as a 100 Hz centroid)
    e = L.envelope(x[None], 0.01)
    pk_i = int(np.argmax(e))
    on = np.nonzero(e > e.max() * 10 ** (-40 / 20))[0]
    aud = (on[-1] - on[0]) / L.SR if len(on) else 0.0
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    fr = np.fft.rfftfreq(len(x), 1 / L.SR)
    cen = float((X * fr).sum() / (X.sum() + 1e-12))
    att = (pk_i - (on[0] if len(on) else 0)) / L.SR
    d = np.nonzero(e[pk_i:] < e.max() * 10 ** (-20 / 20))[0]
    dec = (d[0] / L.SR) if len(d) else aud
    return np.array([np.log(max(aud, 0.05)), np.log(max(cen, 100)), pk_i / L.SR, np.log(max(att, 0.003)), np.log(max(dec, 0.01))])


def env_corr(a, b):
    ea, eb = L.envelope(a[None], 0.01), L.envelope(b[None], 0.01)
    n = max(len(ea), len(eb))
    ea, eb = np.pad(ea, (0, n - len(ea))), np.pad(eb, (0, n - len(eb)))
    return float(np.corrcoef(ea, eb)[0, 1])


def write(x, path):
    raw = path + '.raw'
    x.astype('<f4').tofile(raw)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(L.SR), '-ac', '1', '-i', raw, '-c:a', 'pcm_f32le', path], check=True)
    os.remove(raw)


def fade(x, d=0.06):
    n = min(len(x), int(d * L.SR)); x = x.copy(); x[len(x) - n:] *= np.linspace(1, 0, n); return x


def variant(x, kind):
    """a take MADE from a real one when the family is short: 'bright' (+6 dB above 3 kHz), 'dark' (-8 dB above 2 kHz, +3 dB under 200 Hz),
    'snap' (the lead-in cut to 15 ms before the transient), 'long' (pitched 0.85 = longer, deeper)"""
    from scipy.signal import butter, sosfilt
    if kind == 'bright':
        return x + (10 ** (6 / 20) - 1) * sosfilt(butter(2, 3000, 'high', fs=L.SR, output='sos'), x)
    if kind == 'dark':
        lo = sosfilt(butter(2, 200, 'low', fs=L.SR, output='sos'), x)
        return x + (10 ** (-8 / 20) - 1) * sosfilt(butter(2, 2000, 'high', fs=L.SR, output='sos'), x) + (10 ** (3 / 20) - 1) * lo
    if kind == 'snap':
        i = max(0, int(np.argmax(L.envelope(x[None], 0.01))) - int(0.015 * L.SR))
        y = x[i:].copy(); k = int(0.004 * L.SR); y[:k] *= np.linspace(0, 1, k); return y
    if kind == 'long':
        n = int(len(x) / 0.85); return np.interp(np.arange(n) * 0.85, np.arange(len(x)), x)
    raise ValueError(kind)


def pick(approved, pool, n=N_TAKES, max_len=MAX_TAKE, max_pk=0.35):
    cand = []
    for lab, p in pool:
        if not os.path.exists(p) or p in EXCLUDE:
            continue
        x = lead_trim(mono(p))
        x = fade(x[:int(max_len * L.SR)]) if len(x) > max_len * L.SR else x
        if len(x) < 0.08 * L.SR or L.impact_peak(x[None]) > max_pk:
            continue   # too short, or its impact comes too late after its start (a long lead-in would be entered mid-way on a fast swing)
        cand.append({'label': lab, 'src': p, 'x': x, 'f': feats(x)})
    a = {'label': 'approved', 'src': approved, 'x': lead_trim(mono(approved)), 'made': None}
    a['f'] = feats(a['x'])
    allf = np.array([k['f'] for k in cand] + [a['f']])
    mu, sd = allf.mean(0), allf.std(0) + 1e-6
    z = lambda f: (f - mu) / sd   # noqa: E731
    chosen = [a]
    for k in cand:
        k['dup'] = env_corr(k['x'], a['x']) >= 0.97
    left = [k for k in cand if not k['dup']]
    while len(chosen) < n and left:
        best = max(left, key=lambda k: min(np.linalg.norm(z(k['f']) - z(q['f'])) for q in chosen))
        dmin = min(np.linalg.norm(z(best['f']) - z(q['f'])) for q in chosen)
        left.remove(best)
        if dmin < 0.6 or max(env_corr(best['x'], q['x']) for q in chosen) >= 0.93:
            continue
        best['made'] = None
        best['dist'] = round(float(dmin), 2)
        chosen.append(best)
    reals = list(chosen)
    for kind in ('bright', 'dark', 'snap', 'long'):
        if len(chosen) >= n:
            break
        base = reals[(len(chosen) - len(reals)) % len(reals)]
        x = variant(base['x'], kind)
        chosen.append({'label': '%s, made %s' % (base['label'], kind), 'src': base['src'], 'x': x, 'f': feats(x), 'made': kind})
    return chosen


def main():
    appr = json.load(open(os.path.join(SL, 'approved', 'APPROVED.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    rep = {'_note': 'v1165 swing / shot takes (take 1 = the approved file) and the 6 melee shimmers - tools/sfx_pick_takes.py', 'types': {}, 'shimmer': []}
    for t, pool in POOLS.items():
        a = os.path.join(SL, appr['LIB-ATK-' + t]['file'])
        ch = pick(a, pool, max_len=MAX_LEN_T.get(t, MAX_TAKE), max_pk=max(0.35, L.impact_peak(L.decode(a, 1)) + 0.1))
        rows = []
        for i, k in enumerate(ch):
            nm = '%s_%d.wav' % (t, i + 1)
            if i:
                write(k['x'], os.path.join(OUT, nm))
            rows.append({'n': i + 1, 'label': k['label'], 'src': k['src'], 'file': None if i == 0 else 'approved/takes_v1165/' + nm,
                         'made': k.get('made'), 'len_s': round(len(k['x']) / L.SR, 3), 'peak_s': round(float(k['f'][2]), 3),
                         'centroid_hz': int(np.exp(k['f'][1])), 'dist': k.get('dist')})
        rep['types'][t] = rows
        print('%-14s %d takes: %s' % (t, len(rows), ' | '.join('%d %s %.2fs pk%.2f %dHz%s' % (r['n'], r['label'][:34], r['len_s'], r['peak_s'], r['centroid_hz'],
                                                                                         ' MADE' if r['made'] else '') for r in rows)))
    # shimmers
    shim = []
    for lab, f, a, b in SHIM_PAGE:
        x = mono(pk(f))[int(a * L.SR):int(b * L.SR)]
        shim.append({'label': lab, 'src': pk(f), 'cut': [a, b], 'x': fade(x, 0.25)})
    cand = []
    for lab, f in SHIM_POOL:
        x = lead_trim(mono(pk(f)))
        x = fade(x[:int(1.5 * L.SR)], 0.25)
        if L.impact_peak(x[None]) <= 0.3:
            cand.append({'label': lab, 'src': pk(f), 'cut': [round((len(mono(pk(f))) - len(lead_trim(mono(pk(f))))) / L.SR, 3), None], 'x': x})
    F = lambda x: feats(x)   # noqa: E731
    allf = np.array([F(k['x']) for k in shim + cand]); mu, sd = allf.mean(0), allf.std(0) + 1e-6
    while len(shim) < 6 and cand:
        best = max(cand, key=lambda k: min(np.linalg.norm((F(k['x']) - F(q['x'])) / sd) for q in shim))
        cand.remove(best)
        if max(env_corr(best['x'], q['x']) for q in shim) < 0.93:
            shim.append(best)
    for i, k in enumerate(shim):
        nm = 'SHIM_%d.wav' % (i + 1)
        write(k['x'], os.path.join(OUT, nm))
        rep['shimmer'].append({'n': i + 1, 'label': k['label'], 'src': k['src'], 'cut': k['cut'], 'file': 'approved/takes_v1165/' + nm,
                               'len_s': round(len(k['x']) / L.SR, 3), 'peak_s': round(L.impact_peak(k['x'][None]), 3), 'page': i < 4})
        print('SHIM %d %-18s %.2fs peak %.2f%s' % (i + 1, k['label'], len(k['x']) / L.SR, L.impact_peak(k['x'][None]), '' if i < 4 else '  (new)'))
    json.dump(rep, open(os.path.join(OUT, 'TAKES.json'), 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
