"""v1165 RIDE-OUT SOURCES - re-render the composite spell sounds from their own recipes WITHOUT the length cut, so they end naturally.

Phil 16 Oct 2026 (listening page "spell ride", version C): "Sparkle is good do c for every ability and put it in game" - every ability
sound plays to its natural end (+ the sparkle tail, tools/build_sfx.py). The single pack takes ride out in build_sfx.py itself (no trim, no
length cap). The COMPOSITES in approved/spells/*.mp3 were mixed by hand from pack takes (the redo rounds of 14-15 Oct) and several were cut
short inside their own recipe; this tool rebuilds each one with the SAME commands (verbatim from the round that made it), changing only
the cut:
  round 3 / 4 `one()`   a single take (+ layer): no `trim` - the take plays to its own end
                        multi-hit (`picks` + `gap`): every hit keeps its recipe trim (so the hits stay as tight as Phil heard them), the
                        LAST hit is not trimmed - the blow rings out
  round 5 `mix()`       Rafe S0514 / Rivet S0375: round-4 shots (last shot untrimmed) at +0.45 s over the bed, the bed at the SAME gain
                        (-13 dB mean over its first 2.8 s, as made), not cut at 2.8 s - the bed plays out
                        Rhukk S0121: the round-4 rush with no 4.5 s trim and no 1.0 s cut
CONTROL: each composite is also rebuilt WITH its original cut and compared with the approved mp3 (envelope correlation over the approved
file's length); a rebuild that does not reproduce what Phil approved (corr < 0.97) is refused - the build then keeps the approved file.
Writes  <SOUND LIST>/approved/spells_rideout/<hero>_<id>.wav (48 kHz float) + rideout.json (what was changed, the control scores).
Run:    python tools/sfx_rideout_sources.py
"""
import json, os, re, subprocess, sys, tempfile
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfx_loudness as L

SL = os.environ.get('EW_SOUND_LIST') or r'C:\Users\Home\OneDrive\Desktop\Emberweave Archive\Open Projects\3 - Heroes, Art and Lore\SOUND LIST 11OCT2026'
PM = os.path.join(SL, 'pack_match')
APP = os.path.join(SL, 'approved', 'spells')
OUT = os.path.join(SL, 'approved', 'spells_rideout')
sys.path.insert(0, PM)
import pack_matcher2 as pm   # noqa: E402

CAT = pm.catalogue(json.load(open(os.path.join(pm.PACK, 'index.json'), encoding='utf-8')))
take = lambda p: CAT[int(p.split('.')[0]) - 1][1][int(p.split('.')[1])]   # noqa: E731
# the round-4 recipes the round-5 mixes were built on (scratch fill/redo4_out.json, 15 Oct; copied here so the tool stands alone)
R4 = {
    'S0514': {'picks': ['101.3', '96.0', '108.0', '98.2', '99.1'], 'gap': 0.18, 'pitch': [1.2, 1.2, 1.0, 1.15, 1.0], 'eq': 'high', 'trim': 0.5},
    'S0375': {'picks': ['99.0', '161.0', '100.1', '63.3', '247.1'], 'gap': 0.2, 'pitch': [1.05, 0.9, 1.0, 1.0, 0.9], 'trim': 0.7},
    'S0121': {'pick': '52.0', 'pitch': 0.8, 'eq': 'low', 'layer': '131.3', 'trim': 4.5},
}
R5 = {'S0514': ('118.1', 'shots'), 'S0375': ('36.0', 'shots'), 'S0121': (None, 'cut 1.0')}   # bed take (round 5 kept option)


def ff(cmd):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y'] + cmd, check=True)


def one(p, pitch=1.0, eq=None, layer=None, trim=None, gain=None, out=None):
    """round 3 / 4 `one()`, verbatim (scratch redo3 / redo4, 15 Oct)"""
    chain = ['asetrate=48000*%s' % pitch, 'aresample=48000']
    if eq == 'low':
        chain.append('bass=g=5:f=120,treble=g=-2')
    if eq == 'high':
        chain.append('treble=g=4,bass=g=-2')
    ins = ['-i', take(p)['path']]
    fc = '[0]' + ','.join(chain) + '[m]'
    if layer:
        ins += ['-i', take(layer)['path']]
        fc += ';[1]aresample=48000,volume=-3dB[l];[m][l]amix=inputs=2:normalize=0[m]'
    post = []
    if gain:
        post.append('volume=%sdB' % gain)
    if trim:
        post.append('atrim=0:%s,afade=t=out:st=%.2f:d=%.2f' % (trim, max(0, float(trim) - 0.3), min(0.3, float(trim))))
    post.append('alimiter=limit=0.97')
    fc += ';[m]' + ','.join(post) + '[o]'
    ff(ins + ['-filter_complex', fc, '-map', '[o]', out])


def composite(r, out, td, tag, ride):
    """a recipe -> wav. ride=False: as made (the control); ride=True: the cut taken off (single take: no trim; multi-hit: the last hit untrimmed)"""
    if r.get('picks'):
        ps = r['picks']
        pit = r.get('pitch') if isinstance(r.get('pitch'), list) else [r.get('pitch') or 1.0] * len(ps)
        gap = float(r.get('gap', 0.3))
        parts = []
        for k, p in enumerate(ps):
            w = os.path.join(td, '%s_%d.wav' % (tag, k))
            tr = r.get('trim') or 0.8
            one(p, pit[k], r.get('eq'), None, None if (ride and k == len(ps) - 1) else tr, r.get('gain'), w)
            parts.append(w)
        ins = sum([['-i', x] for x in parts], [])
        fc = ';'.join('[%d]adelay=%d|%d[d%d]' % (k, int(k * gap * 1000), int(k * gap * 1000), k) for k in range(len(parts))) + ';' + \
            ''.join('[d%d]' % k for k in range(len(parts))) + 'amix=inputs=%d:normalize=0,alimiter=limit=0.97' % len(parts)
        ff(ins + ['-filter_complex', fc, '-c:a', 'pcm_f32le', out])
    else:
        one(r['pick'], r.get('pitch') or 1.0, r.get('eq'), r.get('layer'), None if ride else r.get('trim'), r.get('gain'), out)


def mean_db(path, L_s):
    e = subprocess.run(['ffmpeg', '-i', path, '-af', 'atrim=0:%s,volumedetect' % L_s, '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.search(r'mean_volume: (-?[\d.]+)', e).group(1))


def bedmix(shots, bed, out, ride, Ls=2.8):
    """round 5 `mix()`, verbatim; ride=True: the bed not cut at Ls (it fades over its own last 0.7 s), same gain"""
    g = -13.0 - mean_db(take(bed)['path'], Ls)
    bp = take(bed)['path']
    if ride:
        bl = L.decode(bp).shape[1] / L.SR
        bchain = '[1]aresample=48000,volume=%.1fdB,afade=t=in:d=0.1,afade=t=out:st=%.2f:d=0.7[b]' % (g, max(0, bl - 0.7))
    else:
        bchain = '[1]aresample=48000,volume=%.1fdB,atrim=0:%s,afade=t=in:d=0.1,afade=t=out:st=%.2f:d=0.7[b]' % (g, Ls, Ls - 0.7)
    ff(['-i', shots, '-i', bp, '-filter_complex', bchain + ';[0]aresample=48000,volume=-1dB,adelay=450|450[s];[b][s]amix=inputs=2:normalize=0,alimiter=limit=0.97',
        '-c:a', 'pcm_f32le', out])


def env_corr(a, b):
    """envelope correlation (20 ms) over a's length - is b the same sound as a (level-free)?"""
    ea, eb = L.envelope(a, 0.02), L.envelope(b, 0.02)
    n = min(len(ea), len(eb))
    ea, eb = ea[:n], eb[:n]
    return float(np.corrcoef(ea, eb)[0, 1])


def main():
    picks = json.load(open(os.path.join(PM, 'phil_picks.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    rep = {}
    with tempfile.TemporaryDirectory() as td:
        for rid, p in sorted(picks.items()):
            rc = p.get('recipe')
            if not rc:
                continue
            base = os.path.splitext(os.path.basename(p['file'].replace('\\', '/')))[0]
            appr = os.path.join(APP, base + '.mp3')
            if rid in R5:
                bed, _ = R5[rid]
                r4 = R4[rid]
                ctl, ride = os.path.join(td, rid + '_ctl.wav'), os.path.join(OUT, base + '.wav')
                if rid == 'S0121':
                    full = os.path.join(td, rid + '_r4.wav')
                    composite(r4, full, td, rid + 'c', False)          # the round-4 rush as made (4.5 s) ...
                    ff(['-i', full, '-af', 'atrim=0:1.0,afade=t=out:st=0.75:d=0.25', '-c:a', 'pcm_f32le', ctl])   # ... cut to 1.0 s (round 5)
                    composite(r4, ride, td, rid + 'r', True)           # ride out: no 4.5 s trim, no 1.0 s cut
                    what = 'round-4 rush (52.0 + layer 131.3) with no 4.5 s trim and no 1.0 s dash cut'
                else:
                    sc, sr = os.path.join(td, rid + '_sc.wav'), os.path.join(td, rid + '_sr.wav')
                    composite(r4, sc, td, rid + 'c', False)
                    composite(r4, sr, td, rid + 'r', True)
                    bedmix(sc, bed, ctl, False)
                    bedmix(sr, bed, ride, True)
                    what = 'round-4 shots (last shot untrimmed) + bed %s (%s) at the same gain, not cut at 2.8 s' % (bed, take(bed)['name'])
            elif isinstance(rc, dict) and (rc.get('trim') or rc.get('picks')) and not rid == 'S0230':
                ctl, ride = os.path.join(td, rid + '_ctl.wav'), os.path.join(OUT, base + '.wav')
                composite(rc, ctl, td, rid + 'c', False)
                composite(rc, ride, td, rid + 'r', True)
                what = ('%d hits, the last untrimmed (each other hit keeps its %.2f s trim)' % (len(rc['picks']), rc.get('trim') or 0.8)) if rc.get('picks') \
                    else 'no %.2f s trim' % float(rc['trim'])
            else:
                continue
            xa, xc, xr = L.decode(appr), L.decode(ctl), L.decode(ride)
            c = env_corr(xa, xc)
            ok = c >= 0.97
            if not ok and os.path.exists(ride):
                os.remove(ride)
            rep[rid] = {'file': base, 'what': what, 'control_corr': round(c, 4), 'ok': ok, 'approved_s': round(xa.shape[1] / L.SR, 3),
                        'control_s': round(xc.shape[1] / L.SR, 3), 'ride_s': round(xr.shape[1] / L.SR, 3) if ok else None,
                        'out': ('approved/spells_rideout/%s.wav' % base) if ok else None}
            print('%-6s %-20s control corr %.4f %s  approved %.2f s -> ride %.2f s  %s' % (rid, base, c, 'OK ' if ok else 'BAD', xa.shape[1] / L.SR, xr.shape[1] / L.SR, what))
    json.dump(rep, open(os.path.join(OUT, 'rideout.json'), 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
