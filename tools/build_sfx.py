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
v1165 RIDE OUT + SPARKLE (Phil 16 Oct 2026, listening page "spell ride", db spell_ride_picks: "Sparkle is good do c for every ability and put
it in game"; "Yes lets do it, full effects will sound cleaner"): every ABILITY file (green / blue / ult / passive rows - every file that is not
a weapon strike) plays to its natural end - no `trim`, no 1.6 / 6.5 s cap (ABIL_MAX_LEN 10 s), the composites rebuilt without their cut by
tools/sfx_rideout_sources.py - plus the version-C tail: a soft echo bloom + high shimmer, wet held at 0 until 30 ms after the dry's own peak,
fading smoothly over SPARK_TAIL s (spark_base: the listening page's recipe, verbatim). The impact peak is re-measured on the final file
at the v1138 peak (`peak_at`, anchor_peak): the same moment of the same take, so no hit's timing moves - a global re-measure flips between
near-equal loud moments (the limiter / encoder on the new gain) and would move 26 of them by 10-670 ms; inside +-30 ms the argmax wanders up
to 30 ms on 12 flat-topped transients whose level at the v1138 peak is within 0.6 dB of it - the v1138 peak is kept there.
v1165 FUSED MELEE SWING (Phil 16 Oct: "melee hits are kind of annoying after a while", "Maybe we should add a magic shimmer to play at the same
time as the swings", "is it possible to mix the sounds"; the "Blended" page, third version: "There we go", "Send that"): every melee swing is
its type's approved file (take 1, unchanged) FUSED with one of 6 magic shimmers (RPG Magic Pack 3 MagicShimmer Cast01 / Cast02 / Buff02 /
Heal / EpicHeal / Buff01, natural length) - fuse(): the shimmer high-passed at 700 Hz, started on the swing's ONSET (8 ms fade-in), full until
0.5 s past the swing's impact peak, then an exponential fade (tau 0.18 s) cut at +0.6 s, 8 dB under the swing (0.4 s max RMS); the pair through
one shared aecho + gentle compressor + limiter. 8 melee types x 6 = LIB-MEL-<T>-<k>, Aureth's three ARM cuts x 6 = ATK-AURETH-<X>-<k>, each
through render() at its own target, the impact peak re-measured on the final file at the swing's own peak. The client picks a random one per
swing (never the previous for that hero) and plays it at +-3% rate / +-1.5 dB: one source, one live slot. Ranged types are unchanged.
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
VER = 1165              # v1165: every re-rendered file (the abilities, the fused melee swings) gets ?v=1165; unchanged files keep their own version
TARGET_LUFS = -16.0
TP_CEIL = -1.0
TOL_LU = 2.0
MAX_LEN = 6.5          # no combat sound runs longer (ult beds are 4-6 s)
HIT_MAX_LEN = 1.6      # a sound that plays on each of several hits stays short (v1165: weapon strikes only - abilities ride out)
ABIL_MAX_LEN = 10.0    # v1165 ride out: an ability file plays to its natural end (the longest natural end is 8.6 s, S0076); this is only a ceiling
SPARK_TAIL = 1.3       # v1165 the sparkle tail (version C on Phil's page): bloom + shimmer fading over this past the dry's natural end
RIDE_DIR = os.path.join(SL, 'approved', 'spells_rideout')     # tools/sfx_rideout_sources.py: the composites without their cut
SHIM_DIR = os.path.join(SL, 'approved', 'takes_v1165')        # SHIM_1..6.wav: the 6 shimmers at their natural length (Phil's shimonly page: 1 2 3 6 Keep, 4 5 new)
FUSED_DIR = os.path.join(SL, 'approved', 'fused_v1165')       # the fused swing sources this build makes (48 kHz float), then renders
MELEE = ['BLADE-LIGHT', 'BLADE-HEAVY', 'BLUNT', 'FIST-HEAVY', 'FIST-METAL', 'CLAW', 'THRUST', 'STAFF']   # fused; BOW GUN THROWN CASTER-WHOOSH unchanged
SHIMS = ['RPG3_MagicShimmer_Cast01', 'RPG3_MagicShimmer_Cast02', 'RPG3_MagicShimmer_Buff02', 'RPG3_MagicShimmer_Heal', 'RPG3_MagicShimmer_EpicHeal',
         'RPG3_MagicShimmer_Buff01']
FUSE_UNDER, FUSE_HOLD, FUSE_TAU, FUSE_CUT, FUSE_HP = 8.0, 0.5, 0.18, 0.6, 700
FUSE_GLUE = 'aecho=0.8:0.7:28|47:0.16|0.10,acompressor=threshold=-14dB:ratio=1.6:attack=15:release=150:makeup=1,alimiter=limit=0.89'
# Phil's deliberate offsets, relative to the target (15 Oct, coordinator): everything else = the target.
OFFSETS = {'LIB-ATK-FIST-HEAVY': -3.0, 'LIB-ATK-BOW': -3.0, 'LIB-ATK-THRUST': -3.0, 'LIB-ATK-CASTER-WHOOSH': -5.0,
           'S0456': -3.0}   # S0456 = Ambrel's Sacred Bells passive, briefed as quiet

# ---- basic attacks: one shared sound per weapon type (APPROVED.json). sound_list's `shared` column where it names one
# of the 12; the rest mapped by Claude from the weapon in the row (marked * - Phil to confirm). Every Magic / Healer
# ranged hero plays the caster whoosh (Phil 14 Oct: "ALL ranged caster basic attacks play this same whoosh").
WEAPON = {
    'konwu': 'STAFF', 'grosk': 'FIST-HEAVY', 'tick': 'FIST-METAL', 'aureth': 'BLADE-LIGHT*', 'bloatus': 'THRUST*',
    'vael': 'BLADE-HEAVY', 'rhukk': 'BLUNT*', 'hurne': 'CLAW*', 'gruel': 'BLUNT*', 'quorrel': 'BLUNT', 'korvux': 'BLADE-HEAVY',
    'hollow': 'BLADE-LIGHT', 'carn': 'BLADE-HEAVY', 'seyla': 'BLADE-LIGHT', 'zahri': 'THRUST',
    'kharos': 'BLADE-LIGHT', 'brannus': 'BLUNT*', 'deepcleft': 'CLAW', 'askel': 'STAFF', 'tharl': 'FIST-HEAVY', 'hobb': 'BLUNT',
    'pellucid': 'FIST-HEAVY*', 'veyr': 'BLADE-LIGHT*', 'vex': 'BLADE-LIGHT', 'iver': 'THRUST', 'joss': 'BLUNT', 'ambrel': 'BLUNT',
    'tolley': 'BLUNT',
    # ranged, physical
    'meridian': 'THROWN*', 'rivet': 'GUN', 'calypsa': 'THROWN*', 'yenna': 'THROWN', 'sorrel': 'THROWN', 'grimsby': 'THROWN*',
    'sloe': 'BOW', 'rafe': 'GUN',   # Rafe: GUN when he shoots, BLADE-LIGHT when he cuts (<= 2.5 m) - both in his row
    # ranged casters (Magic / Healer)
    **{k: 'CASTER-WHOOSH' for k in ['vulmar', 'sylthaine', 'vireo', 'fritz', 'umbris', 'oakmir', 'astra', 'maren', 'lumi', 'vesper',
                                    'tessit', 'linnet', 'lysara', 'nerisse', 'vaelora', 'dandra', 'pyroclast', 'absalie', 'mellan',
                                    'aldren', 'ceraline', 'orryn', 'mirelle',
                                    'nox']},   # v1169 (Phil 16 Oct): Nox is a ranged magic assassin now - the caster whoosh, not BLADE-LIGHT
}
RAFE_MELEE = 'BLADE-LIGHT'
# v1156 PER-SWING SOUNDS (Phil 15 Oct 2026: Aureth's swings "should not be regular swords"; his picks from the Spell Pack Library, RPG Magic
# Pack 3 catalogue numbers - pack_matcher2.catalogue): the swing whose clip is `attackLight` plays the light sound, `attackDark` the dark one,
# the `crit` X slice (both swords) both cuts LAYERED, peaks aligned. Each is a swing-length cut of the pack file (well under his 1.8 s swing),
# then the same loudness render as the weapon library (target + 0, BLADE-LIGHT's level). The client picks by the swing's clip
# (SFX_DATA.heroes[k].arm[u._atkClip], sfxAtk) and the peak lands on the blow (the fuse) like every attack sound.
#   layer = (pack file under PACK_WAV, cut start s, cut end s, delay s)
PACK_WAV = os.environ.get('EW_PACK_WAV') or r'C:\Users\Home\OneDrive\Desktop\Emberweave Archive\Game Art\Sound Effects\RPG Magic Pack 3 - WOW Sound (Phil 14OCT2026)\wav'
_SHIMMER = r'RPG3_Generic_Magic\Generic Magic\RPG3_MagicShimmer_Cast01.wav'      # 120.0 magic shimmer cast (1.93 s, peak 0.28 s)
_PLASMA = r'RPG3_Plasma_Magic\Plasma Magic\RPG3_PlasmaMagic_Debuff02.wav'         # 218.1 plasma magic debuff (1.95 s, peak 0.65 s)
ARM_SOUNDS = {
    'aureth': {
        'attackLight': ('ATK-AURETH-LIGHT', [(_SHIMMER, 0.0, 0.85, 0.0)], 'Phil 15 Oct: LIGHT sword swing = 120.0 MagicShimmer_Cast01'),
        'attackDark': ('ATK-AURETH-DARK', [(_PLASMA, 0.25, 1.15, 0.0)], 'Phil 15 Oct: DARK sword swing = 218.1 PlasmaMagic_Debuff02 (its first 0.25 s of swell trimmed)'),
        'crit': ('ATK-AURETH-XSLICE', [(_SHIMMER, 0.0, 0.85, 0.12), (_PLASMA, 0.25, 1.15, 0.0)], 'X slice = both swords: the light + dark cuts layered, peaks aligned (Claude, from Phil\'s two picks)'),
    },
}


def arm_cut(layers, td, name):
    """the swing-length cut: each layer trimmed (and delayed), mixed (no normalising - the render sets the loudness), mono 48 kHz"""
    out = os.path.join(td, 'part-%s.wav' % name)
    ins, fl = [], []
    for i, (f, a, b, dl) in enumerate(layers):
        ins += ['-i', os.path.join(PACK_WAV, f)]
        fl.append('[%d:a]atrim=start=%.3f:end=%.3f,asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=mono,adelay=%d:all=1[l%d]' % (i, a, b, round(dl * 1000), i))
    mix = ''.join('[l%d]' % i for i in range(len(layers)))
    fl.append(mix + ('amix=inputs=%d:normalize=0:duration=longest[o]' % len(layers) if len(layers) > 1 else 'anull[o]'))
    ff(*ins, '-filter_complex', ';'.join(fl), '-map', '[o]', '-c:a', 'pcm_f32le', out)
    return out


def arm_sounds(add):
    """render every per-swing sound through `add` (the build's own renderer); returns {hero: {clip: file name}}"""
    res = {}
    with tempfile.TemporaryDirectory() as td:
        for h, arms in ARM_SOUNDS.items():
            for clip, (name, layers, note) in arms.items():
                res.setdefault(h, {})[clip] = add(name, arm_cut(layers, td, name), OFFSETS.get(name, 0.0), None, False, 2.2, note)
    return res

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
    'S0382': {'rule': 'land'},                               # v1142 Carn Crimson Reap: its impact peak on the cleave landing (the form delivery, 1.148 fight s = ult clip contact cell 37, the reap swing), not from the press
    'S0172': {'rule': 'land'},                               # v1162 Korvux Ember Cleave: its impact peak on the cleave landing (the form delivery, 0.847 fight s = blue clip contact cell 30, the axe at full reach), not from the press
    'S0174': {'rule': 'land'},                               # v1162 Korvux Falling Star: the meteor-impact peak on the star's landing (the 'land' delivery, 0.55 fight s after the release), not from the press
    'S0051': {'rule': 'land'},                               # v1153 Aureth Sunburst: its impact peak on the burst when the form delivery lands (1.339 fight s = green clip contact cell 47), not from the press
    'S0053': {'rule': 'release'},                            # v1153 Aureth Duality: its peak on the stance swap at the 0.5 s cast release (blue clip contact cell 18)
    'S0054': {'rule': 'release'},                            # v1153 Aureth Eclipse: its peak on the 1.2 s cast release, when the eclipse bursts out of him (ult clip contact cell 42), not 3 s after the press
    'S0207': {'rule': 'release'},                            # v1160 Veyr Gravity Crescent: its peak on the slash at the 0.5 s release (green clip contact cell 18, the crescent leaves the blade), not from the press
    'S0209': {'rule': 'release'},                            # v1160 Veyr Abyssal Mantle: its peak as the mantle closes round him at the 0.5 s release (blue clip contact cell 18, the evade starts)
    'S0211': {'rule': 'release'},                            # v1160 Veyr Abyssal Undertow cast: its peak on the 0.8 s release, his arm out where the deep opens (ult clip contact cell 29); S0213 stays on the collapse (land)
    'S0266': {'rule': 'release'},                            # v1160 Deepcleft Burrow Guard: its peak as he digs in at the 0.5 s release (blue clip contact cell 18, untargetable from then)
    'S0268': {'rule': 'land'},                               # v1160 Deepcleft Quarry Collapse: its peak on the slam when the form delivery lands (1.148 fight s = ult clip contact cell 37), not from the press
    'S0138': {'rule': 'release'},                            # v1171 Meridian Final Expedition: its peak as the survey is plotted on the 0.8 s release (ult clip contact cell 29, f60), not from the press
    'S0510': {'rule': 'release'},                            # v1171 Rafe Pistol Barrage: its peak on the volley at the 0.5 s release (green clip contact cell 18, f72), not from the press
    'S0329': {'rule': 'release'},                            # v1169 Nox Lockpick Soul: its peak as the hook is thrown out on the 0.5 s release (green clip contact cell 18, f44)
    'S0331': {'rule': 'release'},                            # v1169 Nox Forbidden Key: its peak as the key appears in his hand on the 0.5 s release (blue clip contact cell 18, f40), not from the press
    'S0332': {'rule': 'release'},                            # v1169 Nox Open Every Door: its peak as he holds the lock out on the 0.8 s release (ult clip cell 29, f53) - every enemy locked; S0333 stays on the shatter (land, contact cell 40)
    'S0413': {'rule': 'release'},                            # v1169 Grimsby Overdue: its peak on the quill's tick at the 0.5 s release, when the mark lands (green clip contact cell 18, f42), not from the press
    'S0415': {'rule': 'release'},                            # v1169 Grimsby Foreclosure: its peak as the ledger snaps shut and the notice is served on the 0.8 s release (ult clip contact cell 29, f76), not from the press
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


def nat_end(x, floor_rel=-60):
    """the time a 20 ms envelope last sits above (its peak + floor_rel dB) - the listening page's natural end"""
    w = int(0.02 * L.SR)
    e = np.sqrt(np.convolve(np.mean(x ** 2, axis=0), np.ones(w) / w, mode='same'))
    idx = np.nonzero(e > e.max() * 10 ** (floor_rel / 20))[0]
    return idx[-1] / L.SR if len(idx) else x.shape[1] / L.SR


def spark_graph(tot, fade_st, fade_d, pk, wet_db):
    """v1165 version C (verbatim from the listening page's render.py): dry untouched + a wet-only bloom (multi-tap echo, two diffusion stages)
    + a high shimmer; the wet is held at 0 until just after the dry's own peak (pk) so the hit stays where it is, then ramps in; everything
    fades smoothly to `tot`"""
    rv = [(31, .50), (47, .44), (67, .38), (89, .33), (113, .28), (149, .24), (193, .20), (241, .16), (307, .12), (389, .09), (487, .06)]
    sh = [(70, .55), (140, .45), (215, .37), (300, .30), (395, .24), (500, .19), (620, .15), (760, .11), (920, .08), (1100, .05)]
    g = ['[0:a]apad=pad_dur=1.6,asplit=3[d][r][s]']
    g.append('[r]asplit=%d%s' % (len(rv), ''.join('[r%d]' % i for i in range(len(rv)))))
    for i, (ms, gn) in enumerate(rv):
        g.append('[r%d]adelay=%d:all=1,volume=%.3f[rt%d]' % (i, ms, gn, i))
    g.append('%samix=inputs=%d:normalize=0:duration=first,aecho=0.9:0.9:53|97|151:0.25|0.18|0.12,lowpass=f=9000[rw]' % (''.join('[rt%d]' % i for i in range(len(rv))), len(rv)))
    g.append('[s]highpass=f=3800,asplit=%d%s' % (len(sh), ''.join('[s%d]' % i for i in range(len(sh)))))
    for i, (ms, gn) in enumerate(sh):
        g.append('[s%d]adelay=%d:all=1,volume=%.3f[st%d]' % (i, ms, gn, i))
    g.append('%samix=inputs=%d:normalize=0:duration=first,volume=0.6[sw]' % (''.join('[st%d]' % i for i in range(len(sh))), len(sh)))
    g.append("[rw][sw]amix=inputs=2:normalize=0:duration=first,volume=%.2fdB,volume='if(lt(t,%.3f),0,min(1,(t-%.3f)/0.2))':eval=frame[w]" % (wet_db, pk + 0.03, pk + 0.03))
    g.append('[d][w]amix=inputs=2:normalize=0:duration=first,atrim=end=%.3f,afade=t=out:st=%.3f:d=%.3f[o]' % (tot, fade_st, fade_d))
    return ';'.join(g)


def spark_base(src, ch, td, max_len=None, tail=None):
    """v1165 ride out + sparkle, the page's B -> C -> C2 steps verbatim: leading silence off, cut at the natural end (-60 dB) + 25 ms
    anti-click; + the bloom / shimmer (the wet level stepped down until the dry's impact peak is where it was, within 12 ms); cut where the
    bloom itself has died away (-60 dB) + 30 ms. Returns (wav, info)."""
    max_len = ABIL_MAX_LEN if max_len is None else max_len
    tail = SPARK_TAIL if tail is None else tail
    raw = os.path.join(td, 'raw.wav')
    ff('-i', src, '-af', 'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.005', '-ac', ch, '-ar', '48000', '-c:a', 'pcm_f32le', raw)
    xr = L.decode(raw)
    ne = min(xr.shape[1] / L.SR, nat_end(xr) + 0.05, max_len)
    baseB = os.path.join(td, 'B.wav')
    ff('-i', raw, '-af', 'atrim=end=%.3f,afade=t=out:st=%.3f:d=0.025' % (ne, ne - 0.025), '-c:a', 'pcm_f32le', baseB)
    tot = ne + tail
    baseC = os.path.join(td, 'C.wav')
    pkB = L.impact_peak(L.decode(baseB))
    for wet_db in (-8, -11, -14, -17, -20):
        ff('-i', baseB, '-filter_complex', spark_graph(tot, max(0, ne - 0.2), tail + 0.2, pkB, wet_db), '-map', '[o]', '-ac', ch, '-c:a', 'pcm_f32le', baseC)
        if abs(L.impact_peak(L.decode(baseC)) - pkB) < 0.012:
            break
    xc = L.decode(baseC)
    ce = max(ne, min(xc.shape[1] / L.SR, nat_end(xc) + 0.05))
    baseC2 = os.path.join(td, 'C2.wav')
    ff('-i', baseC, '-af', 'atrim=end=%.3f,afade=t=out:st=%.3f:d=0.03' % (ce, ce - 0.03), '-c:a', 'pcm_f32le', baseC2)
    return baseC2, {'natural': round(ne, 3), 'wet_db': wet_db, 'dry_peak': round(pkB, 4), 'end': round(ce, 3)}


PEAK_ANCHOR = 0.03


def render(src, dst, offset_db, trim, stereo, max_len, spark=False, pk_at=None):
    """trim -> silence-trim -> loudness to TARGET+offset with a -1 dBTP ceiling -> AAC. Returns the final measurement.
    v1165 spark=True (an ability file): the ride out + sparkle base (spark_base) instead of the trim / cap; pk_at: the impact peak is the
    loudest 10 ms within +-PEAK_ANCHOR s of the v1138 peak, measured on the final file - the hit timing does not move."""
    want = TARGET_LUFS + offset_db
    with tempfile.TemporaryDirectory() as td:
        base = os.path.join(td, 'base.wav')
        ln = min(max_len, trim) if trim else max_len
        ch = '2' if stereo else '1'
        info = None
        if spark:
            base, info = spark_base(src, ch, td, max_len)
        else:
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
        if info:
            m['spark'] = info
        if pk_at is not None:
            m['peak_global'] = m['peak']
            m.update(anchor_peak(dst, pk_at))
        return m


PEAK_FLAT_DB = 1.0


def anchor_peak(dst, pk_at):
    """v1165: re-measure the impact peak on the final file at the v1138 peak. The dry take is the same take from the same first sample (the tail
    is held at 0 until 30 ms after it), so the hit is where it was; the 10 ms loudest moment within +-PEAK_ANCHOR is measured on the encoded file
    (`peak_meas`). If the level at the v1138 peak is within PEAK_FLAT_DB of it (a flat-topped transient: the encoder / limiter on the new gain
    only moves the argmax around inside it) the v1138 peak is kept; otherwise the measured one is used (flagged)."""
    x = L.decode(dst)
    e = L.envelope(x)
    a = max(0, int((pk_at - PEAK_ANCHOR - 0.005) * L.SR)); b = min(len(e), int((pk_at + PEAK_ANCHOR - 0.005) * L.SR) + 1)
    i = a + int(np.argmax(e[a:b]))
    meas = round((i + 0.005 * L.SR) / L.SR, 4)
    lv = e[min(len(e) - 1, max(0, int(round((pk_at - 0.005) * L.SR))))]
    flat = 20 * np.log10(e[i] / (lv + 1e-12) + 1e-12)
    keep = flat <= PEAK_FLAT_DB
    return {'peak': round(pk_at, 4) if keep else meas, 'peak_meas': meas, 'peak_flat_db': round(float(flat), 2), 'peak_kept': bool(keep)}


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


def _v1138_files():
    """the v1138 files (git: the manifest as main shipped it before v1165): every ability file's peak anchor"""
    for ref in ('cd6b232d', 'origin/main'):
        try:
            raw = subprocess.run(['git', 'show', ref + ':assets/audio/sfx/sfx_manifest.json'], cwd=ROOT, capture_output=True, check=True).stdout
            fs = json.loads(raw)['files']
            if not any(v.get('spark') for v in fs.values()):
                return fs
        except Exception:
            pass
    return {}


V1138 = {}


def _mov(x, w):
    c = np.concatenate([[0.0], np.cumsum(x * x)]); w = min(w, len(x)); return (c[w:] - c[:-w]) / w


def _onset(x):
    e = np.sqrt(_mov(x, int(0.005 * L.SR))); return int(np.nonzero(e > e.max() * 0.25)[0][0])


def fuse(sw_path, shim_path, out):
    """Phil's approved blend (scratch six/make_fused.py, the 'Blended' page v3), per swing: the swing at the weapon gain (x0.85, as the page)
    + the shimmer high-passed at FUSE_HP Hz, from its own onset, started on the swing's onset with an 8 ms fade-in, full until FUSE_HOLD s past
    the swing's impact peak, then exp(-t/FUSE_TAU) cut at +FUSE_CUT s, set FUSE_UNDER dB under the swing (0.4 s max RMS); the pair through
    FUSE_GLUE. Writes `out` (48 kHz mono float) only when it changed (a kept file keeps its cache key)."""
    def dec(p, af=None):
        cmd = ['ffmpeg', '-v', 'error', '-i', p] + (['-af', af] if af else []) + ['-ac', '1', '-ar', str(L.SR), '-f', 'f32le', '-']
        return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).astype(np.float64)
    rms_db = lambda x: 10 * np.log10(_mov(x, int(0.4 * L.SR)).max() + 1e-12)   # noqa: E731
    s = dec(sw_path) * 0.85
    h = dec(shim_path, 'highpass=f=%d' % FUSE_HP)
    h = h[_onset(h):]
    so = _onset(s)
    e = np.sqrt(_mov(s, int(0.01 * L.SR))); spk = int(np.argmax(e))
    hold = max(0, spk - so) + int(FUSE_HOLD * L.SR)
    n = min(len(h), hold + int(FUSE_CUT * L.SR))
    h = h[:n].copy(); tt = np.arange(n) / L.SR
    env = np.minimum(1, tt / 0.008)
    if n > hold:
        env[hold:] *= np.exp(-np.arange(n - hold) / (FUSE_TAU * L.SR))
    h *= env
    h *= 10 ** (((rms_db(s) - FUSE_UNDER) - rms_db(h)) / 20)
    buf = np.zeros(max(len(s), so + len(h)) + int(0.1 * L.SR))
    buf[:len(s)] += s; buf[so:so + len(h)] += h
    r = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(L.SR), '-ac', '1', '-i', '-', '-af', FUSE_GLUE, '-f', 'f32le', '-'],
                       input=buf.astype(np.float32).tobytes(), capture_output=True, check=True)
    y = np.frombuffer(r.stdout, np.float32)
    with tempfile.TemporaryDirectory() as td:
        raw = os.path.join(td, 'y.raw'); y.tofile(raw); tmp = os.path.join(td, 'y.wav')
        ff('-f', 'f32le', '-ar', str(L.SR), '-ac', '1', '-i', raw, '-c:a', 'pcm_f32le', tmp)
        new = open(tmp, 'rb').read()
        if not (os.path.exists(out) and open(out, 'rb').read() == new):
            open(out, 'wb').write(new)
    return out


def build():
    rows, picks, appr = load()
    V1138.update(_v1138_files())
    try:
        ride = {k: os.path.join(SL, v['out']) for k, v in json.load(open(os.path.join(RIDE_DIR, 'rideout.json'), encoding='utf-8')).items() if v.get('ok')}
    except Exception:
        ride = {}
    os.makedirs(OUT, exist_ok=True)
    files, made = {}, {}           # name -> manifest entry; source key -> name (dedupe: one file per source + trim + offset)
    used_names = set()
    try:   # a file whose source and settings are unchanged since the last build is kept as it is (same bytes, same measurement)
        prev = json.load(open(os.path.join(OUT, 'sfx_manifest.json'), encoding='utf-8'))['files']
    except Exception:
        prev = {}
    force = '--force' in sys.argv

    def add(name, src, offset, trim, stereo, max_len, note, spark=False, pk_ref=None):
        key = (os.path.normcase(src), trim, offset, stereo, max_len, spark)
        if key in made:
            return made[key]
        dst = os.path.join(OUT, name + '.m4a')
        st = os.stat(src)
        ckey = '%s|%s|%s|%s|%s|%d|%d|%s|%s' % (os.path.basename(src), trim, offset, stereo, max_len, st.st_size, int(st.st_mtime), TARGET_LUFS, TP_CEIL)
        if spark:   # v1165: the ride out + sparkle settings are part of the file's identity
            ckey += '|spark %.2f %.1f' % (SPARK_TAIL, ABIL_MAX_LEN)
        split = os.path.basename(src).startswith('part')
        # v1165: a swing-length ARM cut (a temp 'part-*' file, made fresh every build) is the same file when everything but its temp mtime matches -
        # Aureth's three cuts keep their bytes and url (they were re-encoded on every build before)
        nomt = lambda k: '|'.join(f for i, f in enumerate((k or '').split('|')) if i != 6)   # noqa: E731
        same = name in prev and (prev[name].get('key') == ckey or (split and not spark and nomt(prev[name].get('key')) == nomt(ckey)))
        if not force and same and os.path.exists(dst) and (not split or not spark) and (not (spark or pk_ref is not None) or 'peak_at' in prev[name]):
            files[name] = prev[name]; made[key] = name; used_names.add(name)
            if spark and files[name].get('peak_at') is not None:   # v1165: the peak re-measured on the (unchanged) final file
                files[name].update(anchor_peak(dst, files[name]['peak_at']))
            files[name] = {k: v for k, v in files[name].items() if k != 'ae'}
            if pk_ref is not None and files[name].get('peak_meas') is not None:
                files[name]['peak'] = files[name]['peak_meas']   # a fused swing: its own measured peak
            return name
        pk_at = pk_ref   # v1165 a fused swing: re-measured at the swing's own impact peak
        if spark:   # the v1138 peak: this file's anchor (kept across rebuilds)
            pv = prev.get(name) or {}
            pk_at = pv.get('peak_at') if pv.get('peak_at') is not None else (V1138.get(name) or {}).get('peak')
        before = open(dst, 'rb').read() if os.path.exists(dst) else None
        m = render(src, dst, offset, None if spark else trim, stereo, ABIL_MAX_LEN if spark else max_len, spark, pk_at)
        if before is not None and name in prev and open(dst, 'rb').read() == before:   # v1165: re-rendered to the same bytes - keep its url (no re-download)
            files[name] = dict(prev[name], key=ckey); made[key] = name; used_names.add(name)
            return name
        files[name] = {'key': ckey, 'f': 'sfx/%s.m4a?v=%d' % (name, VER), 'peak': m['peak'], 'dur': m['dur'], 'lufs_m': m['lufs_m'], 'tp_db': m['tp_db'],
                       'target': TARGET_LUFS + offset, 'offset': offset, 'ch': m['channels'], 'bytes': os.path.getsize(dst),
                       'src': os.path.basename(src), 'note': note}
        if pk_ref is not None:
            files[name].update({'peak_at': pk_at, 'peak_meas': m.get('peak_meas'), 'peak_flat_db': m.get('peak_flat_db'), 'peak_kept': m.get('peak_kept'),
                                'peak_global': m.get('peak_global'), 'fused': True, 'peak': m.get('peak_meas')})   # a NEW file: its own loudest moment
            # (looked for within 30 ms of the swing's peak - the glue compressor can pull a hard transient's 10 ms max a few ms earlier)
        if spark:
            files[name].update({'spark': m.get('spark'), 'peak_at': pk_at, 'peak_global': m.get('peak_global'), 'trim_dropped': trim,
                                'peak_meas': m.get('peak_meas'), 'peak_flat_db': m.get('peak_flat_db'), 'peak_kept': m.get('peak_kept'),
                                'v1138_dur': (V1138.get(name) or {}).get('dur')})
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
                names = [add(spec['reuse'], ride.get(spec['reuse']) or src_path(rp['file']), OFFSETS.get(spec['reuse'], 0.0), rp.get('trim'), False, MAX_LEN, rp.get('by', ''), True)]
        elif p.get('approved'):
            a = appr[p['approved']]
            fl = a.get('files') or [a['file']]
            for i, f in enumerate(fl):
                nm = rid if len(fl) == 1 else '%s-%d' % (rid, i + 1)
                names.append(add(nm, src_path(f), OFFSETS.get(rid, 0.0), None, False, HIT_MAX_LEN, a.get('picked', ''), True))
        elif spec.get('split'):
            with tempfile.TemporaryDirectory() as td:
                parts, top = split_composite(src_path(p['file']), spec['split'], p['recipe']['gap'], td)
                for i, pp in enumerate(parts):
                    names.append(add('%s-%d' % (rid, i + 1), pp, OFFSETS.get(rid, 0.0), None, stereo_ok and L.decode(pp).shape[0] > 1, HIT_MAX_LEN,
                                     'split %d/%d of %s (hit starts %s s)' % (i + 1, spec['split'], os.path.basename(p['file']), ','.join('%.2f' % t for t in top)), True))
            spec['seq'] = True
        else:
            src = ride.get(rid) or src_path(p['file'])   # v1165: a composite without its cut (sfx_rideout_sources.py)
            st = stereo_ok and L.decode(src_path(p['file'])).shape[0] > 1
            names.append(add(rid, src, OFFSETS.get(rid, 0.0), p.get('trim'), st, ml, p.get('by', '') + (' | ride out: %s' % os.path.basename(src) if rid in ride else ''), True))
            if spec.get('peak') is not None:   # a composite: align its FIRST hit, not its loudest
                f = files[names[-1]]
                if spec['peak'] == 'first' and f.get('peak_at') is not None:   # v1165: the v1138 first hit, re-measured on the final file (anchored)
                    f['peak_from'] = 'the v1138 first hit (%.4f s), re-measured within %.2f s on the final file' % (f['peak_at'], PEAK_ANCHOR)
                elif spec['peak'] == 'first':
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
    for h, arm in arm_sounds(add).items():   # v1156: per-swing sounds (Aureth's light / dark / X slice)
        attack[h]['arm'] = arm
    # v1165 the fused melee swings: each melee type's approved file and each of Aureth's ARM cuts x the 6 shimmers
    os.makedirs(FUSED_DIR, exist_ok=True)
    shim_src = [os.path.join(SHIM_DIR, 'SHIM_%d.wav' % (k + 1)) for k in range(len(SHIMS))]
    fused = {}
    bases = ['LIB-ATK-' + t for t in MELEE] + sorted(n for h in attack.values() for n in (h.get('arm') or {}).values())
    for b in dict.fromkeys(bases):
        fb = files[b]
        out = []
        for k, sp in enumerate(shim_src):
            nm = ('LIB-MEL-%s-%d' % (b[len('LIB-ATK-'):], k + 1)) if b.startswith('LIB-ATK-') else '%s-%d' % (b, k + 1)
            src = fuse(os.path.join(OUT, b + '.m4a'), sp, os.path.join(FUSED_DIR, nm + '.wav'))
            out.append(add(nm, src, fb['offset'], None, False, 4.0, 'fused: %s + %s (Phil "There we go", 16 Oct)' % (b, SHIMS[k]), pk_ref=fb['peak']))
        fused[b] = out
    # the composite check: a composite played once must have its later hits within a frame of the game's (reported, not fixed here)
    stale = [f for f in os.listdir(OUT) if f.endswith('.m4a') and f[:-4] not in used_names]
    for f in stale:
        os.remove(os.path.join(OUT, f))
    man = {'version': VER, 'made_by': 'tools/build_sfx.py', 'metric': 'max momentary loudness, BS.1770 K-weighted, 400 ms (LUFS-M)',
           'target_lufs_m': TARGET_LUFS, 'tolerance_lu': TOL_LU, 'true_peak_ceiling_db': TP_CEIL, 'offsets': OFFSETS,
           'spark_tail_s': SPARK_TAIL, 'ability_max_len_s': ABIL_MAX_LEN,
           'melee': MELEE, 'fused': fused,
           'files': files, 'rows': out_rows, 'attack': attack, 'unmapped': unmapped,
           'total_bytes': sum(v['bytes'] for v in files.values())}
    json.dump(man, open(os.path.join(OUT, 'sfx_manifest.json'), 'w', encoding='utf-8'), indent=1, sort_keys=True)
    write_html_block(man)
    print('files %d, %.2f MB; rows %d (%d none); unmapped %s' % (len(files), man['total_bytes'] / 1e6, len(out_rows),
                                                            sum(1 for v in out_rows.values() if v.get('none')), unmapped))


def client_data(man):
    """The compact table the client reads: files {name:[url, peak]}, heroes {key:{atk, melee?, green/blue/ult/passive:[row...]}}."""
    # v1165: an ability file carries its v1138 length - a weapon strike yields to it only that long, as it did before the ride out (a ringing
    # tail never silences a swing)
    F = {k: ([v['f'], v['peak'], v.get('v1138_dur') or v['spark']['natural']] if v.get('spark') else [v['f'], v['peak']])
         for k, v in sorted(man['files'].items())}
    H = {}
    for h, a in sorted(man['attack'].items()):
        H.setdefault(h, {})['atk'] = a['lib']
        if a.get('melee'):
            H[h]['melee'] = a['melee']
        if a.get('arm'):
            H[h]['arm'] = a['arm']
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
    out = {'v': man['version'], 'files': F, 'heroes': H}
    if man.get('fused'):   # v1165: approved swing / ARM cut -> its 6 fused swings
        out['fused'] = man['fused']
    return out


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
