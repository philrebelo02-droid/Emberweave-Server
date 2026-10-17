"""GPU TEXTURE COMPRESSION of the battle sheets (Phil 17 Oct 2026: "Lets do it, compress the ingame ones", after the side-by-side
https://claude.ai/artifact/GmXXFfAQYDZgYyp3JkrNNo; then "to human eye those images looked identical" - ASTC 4x4 -thorough APPROVED for hero
sheets, FX and deaths. A bigger block (6x6 ...) for hero bodies needs a new side-by-side for Phil first).

WHAT IT BUILDS. For every battle sheet a PHONE uploads (hero + monster clips incl. every death sheet, FX2 spell sheets), the exact texture the
phone puts on the GPU today - same file (its phone tier file, tiers_1141.json, else the original), same size (texSheetK, v1140), same alpha
(see ALPHA), same orientation, same mip chain - encoded as ASTC 4x4 (ARM astcenc 5.7.0, -thorough), in a KTX 1 container, gzip -9:
    assets/anim/<dir>/<stem>_a<hash8>.ktz      (hash8 = the first 8 hex of the sha256 of the .ktz bytes: a new file is always a new URL)
and the table the page reads, assets/anim/astc_sheets.json:
    { "v": <hash8 of the table>, "enc": "...", "sheets": { "<original path>": [url, W, H, levels, gpuBytes, pm, recipeKey12] } }
A phone that reports WEBGL_compressed_texture_astc on WebGL2 (and DecompressionStream) loads these; every other device loads the WebP exactly
as before (the page's ASTC switch, blueprint 18 "GPU texture compression").
Memory: ASTC 4x4 = 1 byte per texel (16 bytes per 4x4 block) on the GPU, vs 4 for RGBA8 - about a quarter.

ALPHA (measured 17 Oct, tools/astc_sheets.py --probe-alpha in the rig): a sheet loaded by bitmapLoad (createImageBitmap) reaches the GPU
PREMULTIPLIED (Chrome's ImageBitmap default; WebGL ignores UNPACK_PREMULTIPLY_ALPHA for a bitmap) - RGB at alpha 0 is 0 and every other texel
is RGB*a/255 - while the materials blend it as straight alpha. A sheet loaded by THREE.TextureLoader (<img>) reaches the GPU STRAIGHT with its
hidden colour kept. Each sheet is encoded the way its phone path holds it today (pm=1 / pm=0), so the edges look exactly as they do now.
ORIENTATION: both paths hold the image bottom row first (bitmap imageOrientation:'flipY' / TextureLoader flipY) - the KTX rows are flipped.
MIPS: a clip sheet is mipmapped today (WebGL2 generateMipmap = a box filter); its full chain down to 1x1 is encoded (premultiplied box).
Spell sheets are not mipmapped (LinearFilter) - level 0 only.
NOT BUILT: idle and walk (the battle-loader monster cards and the Emberdraft carousel paint those two from the decoded image, which a
compressed texture does not have - they keep WebP); FX plates (FX_PLATE_DEF, five small sheets); the arena backdrop and UI art.

CACHE: C:/Emberweave/astc-cache/<sha256 of (source bytes + recipe)>.ktz - a sheet whose source and recipe did not change is never re-encoded.

Usage:  py -I tools/astc_sheets.py <worktree> [--only key,..] [--jobs 4] [--dry] [--report out.json] [--no-check]
        py -I tools/astc_sheets.py <worktree> --verify      (no encoding: is every phone sheet's entry built from its current source?)
        (run it after any new or changed battle art: death_batch.py, the hero pipeline and condense_sheets.py call it at the end)
"""
import gzip, hashlib, io, json, os, shutil, struct, subprocess, sys, tempfile, time
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image

ENC = os.environ.get('ASTCENC', r'C:\Emberweave\tools\astcenc-5.7.0\unz\bin\astcenc-avx2.exe')
ENC_SHA = '2c46c047'              # astcenc-avx2.exe from the official 5.7.0 release zip (zip sha256 cbde7c78...), checked at start
CACHE = os.environ.get('ASTC_CACHE', r'C:\Emberweave\astc-cache')
BLOCK, PRESET = '4x4', '-thorough'
RECIPE = 'astcenc5.7.0|%s|%s|ktx1|flipY|pmbox|gz9|r1' % (BLOCK, PRESET)
GL_ASTC_4x4 = 0x93B0
TABLE = 'assets/anim/astc_sheets.json'
NOT_BUILT = ('idle', 'walk')
# v1140 phone budget = texSheetK() in emberweave-heroes.html (same as tools/condense_sheets.py)
TEX_SHEET_MAX, TEX_FIG_FLOOR, TEX_SHEET_HARD = 2048, 160, 4096


def tex_sheet_k(fw, fh, cols, rows, fig_frac):
    side = max(fw * cols, fh * rows); fig = fig_frac * fh if fig_frac > 0 else 0
    k_side = TEX_SHEET_MAX / side; k_floor = TEX_FIG_FLOOR / fig if fig > 0 else 0
    return min(1.0, max(k_side, k_floor), TEX_SHEET_HARD / side)


def webp_dims(p):
    with open(p, 'rb') as f: b = f.read(30)
    tag = b[12:16]
    if tag == b'VP8X': return 1 + int.from_bytes(b[24:27], 'little'), 1 + int.from_bytes(b[27:30], 'little')
    if tag == b'VP8L': v = int.from_bytes(b[21:25], 'little'); return 1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)
    if tag == b'VP8 ': return int.from_bytes(b[26:28], 'little') & 0x3fff, int.from_bytes(b[28:30], 'little') & 0x3fff
    with Image.open(p) as im: return im.size


def plan(wt, only=None):
    """every sheet a phone uploads through bitmapLoad / fx2Tex, with the exact texture it holds today"""
    d = json.loads(subprocess.run(['node', os.path.join(wt, 'tools', 'dump_clips.js'), wt, '-'], capture_output=True, text=True, check=True).stdout)
    tiers = json.load(open(os.path.join(wt, 'assets/anim/tiers_1141.json')))['sheets']
    jobs, seen = [], set()
    def add(kind, key, st, u, fw, fh, cols, rows, fig, mips):
        p = u.split('?')[0]
        if p in seen or not p.startswith('/assets/'): return
        T = tiers.get(p, {}).get('p')
        if T: src, W, H, pm = T[0].split('?')[0], T[1], T[2], 1          # a phone tier file: loaded at its own size (budgeted), bitmap path
        else:
            src = p; f = os.path.join(wt, p.lstrip('/'))
            if not os.path.exists(f): return
            w0, h0 = webp_dims(f)
            k = tex_sheet_k(fw, fh, cols, rows, fig) if (fw and fh) else 1.0
            if kind == 'fx2' and k >= 0.99: W, H, pm = w0, h0, 0                       # fx2Tex: THREE.TextureLoader, full size, straight
            elif k >= 0.99: W, H, pm = w0, h0, 1                                       # bitmapLoad, no resize
            else: W, H, pm = max(1, round(fw * k)) * cols, max(1, round(fh * k)) * rows, 1   # bitmapLoad resized (createImageBitmap)
        seen.add(p)
        jobs.append(dict(kind=kind, key=key, st=st, path=p, src=src, W=W, H=H, pm=pm, mips=bool(mips)))
    for c in d['clips']:
        if c['st'] in NOT_BUILT: continue
        if only and c['key'] not in only: continue
        fig = (c['figH'] / c['fh']) if (c.get('figH') and c.get('fh')) else 0
        add('clip', c['key'], c['st'], c['u'], c.get('fw'), c.get('fh'), c.get('cols') or c.get('n') or 1, c.get('rows') or 1, fig, True)
    for f in d['fx2']:
        if only and not any(f['key'].startswith(o) for o in only): continue
        if not (f.get('fw') and f.get('fh') and f.get('cols')): continue
        add('fx2', f['key'], 'fx2', f['u'], f['fw'], f['fh'], f['cols'], f.get('rows') or 1, 0, False)
    return jobs


def premul(a):
    a = a.astype(np.float32); al = a[..., 3:4] / 255.0
    o = a.copy(); o[..., :3] = np.round(a[..., :3] * al)
    return o.clip(0, 255).astype(np.uint8)


def level0(job, wt):
    im = Image.open(os.path.join(wt, job['src'].lstrip('/'))); im.load(); im = im.convert('RGBA')
    if job['pm']:
        if im.size != (job['W'], job['H']):
            im = im.convert('RGBa').resize((job['W'], job['H']), Image.LANCZOS)   # createImageBitmap resizes the premultiplied bitmap
            a = np.asarray(im).copy()                                              # 'RGBa' raw = premultiplied bytes
        else:
            a = premul(np.asarray(im))
        a[a[..., 3] == 0] = 0
    else:
        a = np.asarray(im).copy()
    return a


def chain(a, mips):
    out = [a]
    if not mips: return out
    cur = Image.frombytes('RGBA', (a.shape[1], a.shape[0]), a.tobytes())          # premultiplied bytes, box-filtered as they are
    while cur.size != (1, 1):
        cur = cur.resize((max(1, cur.size[0] // 2), max(1, cur.size[1] // 2)), Image.BOX)
        out.append(np.asarray(cur))
    return out


def enc_level(a, tmp, tag):
    pin, pout = os.path.join(tmp, tag + '.png'), os.path.join(tmp, tag + '.astc')
    Image.fromarray(np.ascontiguousarray(a[::-1]), 'RGBA').save(pin, compress_level=1)   # bottom row first (flipY)
    r = subprocess.run([ENC, '-cl', pin, pout, BLOCK, PRESET, '-silent', '-j', str(THREADS)], capture_output=True, text=True)
    if r.returncode: raise RuntimeError('astcenc failed: ' + (r.stdout + r.stderr)[-400:])
    b = open(pout, 'rb').read()
    assert b[:4] == b'\x13\xab\xa1\x5c' and b[4] == 4 and b[5] == 4, 'unexpected .astc header'
    w = int.from_bytes(b[7:10], 'little'); h = int.from_bytes(b[10:13], 'little')
    data = b[16:]; assert len(data) == ((w + 3) // 4) * ((h + 3) // 4) * 16 and (w, h) == (a.shape[1], a.shape[0])
    return data


def ktx1(W, H, levels):
    hdr = b'\xabKTX 11\xbb\r\n\x1a\n' + struct.pack('<13I', 0x04030201, 0, 1, 0, GL_ASTC_4x4, 0x1908, W, H, 0, 0, 1, len(levels), 0)
    body = b''.join(struct.pack('<I', len(d)) + d for d in levels)
    return hdr + body


def gz(b):
    bio = io.BytesIO()
    with gzip.GzipFile(fileobj=bio, mode='wb', compresslevel=9, mtime=0) as g: g.write(b)
    return bio.getvalue()


def ktx_levels(ktx):
    n = struct.unpack_from('<I', ktx, 12 + 4 * 11)[0]; off = 64 + struct.unpack_from('<I', ktx, 12 + 4 * 12)[0]; out = []
    for _ in range(n):
        s = struct.unpack_from('<I', ktx, off)[0]; out.append(ktx[off + 4: off + 4 + s]); off += 4 + s
    return out


def recipe_key(src_b, job):
    return hashlib.sha256(src_b + json.dumps([job['W'], job['H'], job['pm'], job['mips'], RECIPE]).encode()).hexdigest()


def verify(wt):
    """no encoding: every sheet a phone uploads has a table entry built from its CURRENT source with the current recipe, its file is there,
    and nothing else is in the table. Exit 1 on any problem (tests/test_astc_textures.js runs this)."""
    tab = json.load(open(os.path.join(wt, TABLE))); S = tab['sheets']; bad = []
    jobs = plan(wt); want = set()
    for j in jobs:
        want.add(j['path']); e = S.get(j['path'])
        if not e: bad.append('missing ' + j['path']); continue
        ck = recipe_key(open(os.path.join(wt, j['src'].lstrip('/')), 'rb').read(), j)[:12]
        if len(e) < 7 or e[6] != ck: bad.append('stale (source or recipe changed) ' + j['path'])
        if [e[1], e[2], e[5]] != [j['W'], j['H'], j['pm']]: bad.append('size/alpha differs from the phone path ' + j['path'])
        f = os.path.join(wt, e[0].split('?')[0].lstrip('/'))
        if not os.path.exists(f): bad.append('file missing ' + e[0])
    for p in S:
        if p not in want: bad.append('in the table but no phone sheet ' + p)
    body = json.dumps(S, sort_keys=True, separators=(',', ':'))
    if tab.get('v') != hashlib.sha256(body.encode()).hexdigest()[:8]: bad.append('table v is not its hash')
    if tab.get('enc') != RECIPE: bad.append('table recipe %s != %s' % (tab.get('enc'), RECIPE))
    html = open(os.path.join(wt, 'emberweave-heroes.html'), 'rb').read().decode('utf-8', 'replace')
    if ("const ASTC_TABLE_V='%s';" % tab.get('v')) not in html: bad.append('the page asks for another table version (ASTC_TABLE_V)')
    print(json.dumps({'sheets': len(S), 'planned': len(jobs), 'problems': bad[:40], 'n_problems': len(bad)}))
    sys.exit(1 if bad else 0)


def build_one(job, wt, tmp_root):
    src_b = open(os.path.join(wt, job['src'].lstrip('/')), 'rb').read()
    ck = recipe_key(src_b, job)
    cf = os.path.join(CACHE, ck[:2], ck + '.ktz')
    t0 = time.time(); hit = os.path.exists(cf)
    if hit:
        blob = open(cf, 'rb').read()
    else:
        tmp = tempfile.mkdtemp(dir=tmp_root)
        try:
            a0 = level0(job, wt); levels = [enc_level(a, tmp, 'l%d' % i) for i, a in enumerate(chain(a0, job['mips']))]
        finally: shutil.rmtree(tmp, ignore_errors=True)
        blob = gz(ktx1(job['W'], job['H'], levels))
        os.makedirs(os.path.dirname(cf), exist_ok=True); open(cf + '.tmp', 'wb').write(blob); os.replace(cf + '.tmp', cf)
    ktx = gzip.decompress(blob); lv = ktx_levels(ktx)
    h8 = hashlib.sha256(blob).hexdigest()[:8]
    d, stem = os.path.split(job['path']); stem = os.path.splitext(stem)[0]
    url = d + '/' + stem + '_a' + h8 + '.ktz?v=' + h8
    return dict(job, ck=ck[:12], url=url, levels=len(lv), gpu=sum(len(x) for x in lv), dl=len(blob), webp=os.path.getsize(os.path.join(wt, job['src'].lstrip('/'))),
                blob=blob, cache=hit, secs=round(time.time() - t0, 2))


def decode_level0(blob, W, H, tmp):
    """astcenc's own decoder on level 0 -> RGBA uint8, top row first (the reference image orientation)"""
    lv0 = ktx_levels(gzip.decompress(blob))[0]
    pa, po = os.path.join(tmp, 'd.astc'), os.path.join(tmp, 'd.png')
    open(pa, 'wb').write(b'\x13\xab\xa1\x5c\x04\x04\x01' + W.to_bytes(3, 'little') + H.to_bytes(3, 'little') + (1).to_bytes(3, 'little') + lv0)
    r = subprocess.run([ENC, '-dl', pa, po, '-silent'], capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stdout + r.stderr)
    return np.asarray(Image.open(po).convert('RGBA'))[::-1]


def check_one(res, wt, tmp_root):
    """compressed vs the texture the phone holds today: PSNR over visible texels, alpha-edge error, fringe (premultiplied RGB > A)"""
    tmp = tempfile.mkdtemp(dir=tmp_root)
    try:
        ref = level0(res, wt).astype(np.int16); got = decode_level0(res['blob'], res['W'], res['H'], tmp).astype(np.int16)
    finally: shutil.rmtree(tmp, ignore_errors=True)
    a = ref[..., 3]; vis = a > 0
    edge = (a > 0) & (a < 255)
    # pixels next to the silhouette (a 1-px ring both sides) count as edge too
    m = vis.astype(np.int8); ring = np.zeros_like(vis)
    ring[1:] |= m[1:] != m[:-1]; ring[:-1] |= m[1:] != m[:-1]; ring[:, 1:] |= m[:, 1:] != m[:, :-1]; ring[:, :-1] |= m[:, 1:] != m[:, :-1]
    edge |= ring
    da = np.abs(got[..., 3] - a)
    mse = (((got - ref) ** 2)[vis]).mean() if vis.any() else 0.0
    psnr = 99.0 if mse <= 0 else 10 * np.log10(255 ** 2 / mse)
    out = dict(psnr=round(float(psnr), 2), edge_n=int(edge.sum()), edge_a_mean=round(float(da[edge].mean()), 2) if edge.any() else 0.0,
               edge_a_p99=float(np.percentile(da[edge], 99)) if edge.any() else 0.0, a_max=int(da.max()),
               ghost=int(((a == 0) & (got[..., 3] > 8)).sum()), holes=int(((a == 255) & (got[..., 3] < 247)).sum()))
    # FRINGE = what the screen shows on the silhouette: the materials blend every sheet as straight alpha (rgb*a + bg*(1-a)), whatever the
    # texel holds (premultiplied or straight). The compressed sheet's edge over black and over white vs today's, in 0-255 screen levels.
    def shown(x, bg): return x[..., :3].astype(np.float32) * (x[..., 3:4] / 255.0) + bg * (1 - x[..., 3:4] / 255.0)
    fe = np.concatenate([np.abs(shown(got, b) - shown(ref, b)).max(axis=2)[edge] for b in (0.0, 255.0)]) if edge.any() else np.zeros(1)
    out['fringe_mean'] = round(float(fe.mean()), 2); out['fringe_p99'] = round(float(np.percentile(fe, 99)), 1); out['fringe_max'] = round(float(fe.max()), 1)
    return out


THREADS = 4


def main():
    global THREADS
    args = sys.argv[1:]
    if not args or args[0].startswith('-'): print(__doc__); sys.exit(2)
    if '--verify' in args: verify(os.path.abspath(args[0]))
    wt = os.path.abspath(args[0]); only = None; jobs_n = 4; dry = '--dry' in args; rep = None; check = '--no-check' not in args
    if '--only' in args: only = set(args[args.index('--only') + 1].split(','))
    if '--jobs' in args: jobs_n = int(args[args.index('--jobs') + 1])
    if '--report' in args: rep = args[args.index('--report') + 1]
    THREADS = max(1, (os.cpu_count() or 8) // jobs_n)
    sha = hashlib.sha256(open(ENC, 'rb').read()).hexdigest()
    if not sha.startswith(ENC_SHA): print('astcenc binary is not the checked release (%s)' % sha[:12]); sys.exit(3)
    jobs = plan(wt, only)
    print('%d sheets to build (%d clip, %d fx2); %.1f MB of WebP sources' % (len(jobs), sum(j['kind'] == 'clip' for j in jobs), sum(j['kind'] == 'fx2' for j in jobs),
          sum(os.path.getsize(os.path.join(wt, j['src'].lstrip('/'))) for j in jobs) / 2 ** 20))
    if dry: return
    tmp_root = tempfile.mkdtemp(prefix='astc-')
    t0 = time.time(); done = []
    try:
        with ThreadPoolExecutor(jobs_n) as ex:
            for i, r in enumerate(ex.map(lambda j: build_one(j, wt, tmp_root), jobs)):
                done.append(r)
                if (i + 1) % 50 == 0 or i + 1 == len(jobs): print('  built %d/%d (%.0f s)' % (i + 1, len(jobs), time.time() - t0), flush=True)
        if check:
            with ThreadPoolExecutor(jobs_n * 2) as ex:
                for r, c in zip(done, ex.map(lambda r: check_one(r, wt, tmp_root), done)): r['chk'] = c
    finally: shutil.rmtree(tmp_root, ignore_errors=True)
    # write the files + table; files no longer in the table leave the repo
    tab_path = os.path.join(wt, TABLE)
    old = json.load(open(tab_path))['sheets'] if os.path.exists(tab_path) else {}
    sheets = dict(old) if only else {}
    fpath = lambda u: os.path.join(wt, u.split('?')[0].lstrip('/'))
    for r in done:
        f = fpath(r['url'])
        if not os.path.exists(f): open(f, 'wb').write(r['blob'])
        sheets[r['path']] = [r['url'], r['W'], r['H'], r['levels'], r['gpu'], r['pm'], r['ck']]
    # a sheet whose original left the page (or a stale build) takes its .ktz with it: every .ktz under assets/anim must be in the table
    keep = {os.path.normcase(os.path.abspath(fpath(v[0]))) for v in sheets.values()}
    for dp, _, fs in os.walk(os.path.join(wt, 'assets', 'anim')):
        for n in fs:
            if n.endswith('.ktz') and os.path.normcase(os.path.abspath(os.path.join(dp, n))) not in keep:
                try: os.remove(os.path.join(dp, n))
                except OSError: pass
    body = json.dumps(sheets, sort_keys=True, separators=(',', ':'))
    tab = {'v': hashlib.sha256(body.encode()).hexdigest()[:8], 'enc': RECIPE, 'sheets': json.loads(body)}
    open(tab_path, 'w', newline='\n').write(json.dumps(tab, sort_keys=True, separators=(',', ':')) + '\n')
    # the page asks for the table by its own hash (a new table is a new URL - SHIPPING RULE 24)
    hp = os.path.join(wt, 'emberweave-heroes.html'); html = open(hp, 'rb').read()
    import re
    html2, n = re.subn(rb"const ASTC_TABLE_V='[0-9a-f]{8}';", ("const ASTC_TABLE_V='%s';" % tab['v']).encode(), html, count=1)
    if n != 1: print('WARNING: ASTC_TABLE_V not found in the page - set it to', tab['v'])
    elif html2 != html: open(hp, 'wb').write(html2)
    gpu0 = sum(r['W'] * r['H'] * 4 * (4 / 3 if r['mips'] else 1) for r in done); gpu1 = sum(r['gpu'] for r in done)
    dl0 = sum(r['webp'] for r in done); dl1 = sum(r['dl'] for r in done)
    print('table %s v=%s: %d sheets; GPU %.1f -> %.1f MB (x%.3f); download %.1f -> %.1f MB (x%.2f); %d from cache, %.0f s'
          % (TABLE, tab['v'], len(sheets), gpu0 / 2 ** 20, gpu1 / 2 ** 20, gpu1 / gpu0, dl0 / 2 ** 20, dl1 / 2 ** 20, dl1 / dl0, sum(r['cache'] for r in done), time.time() - t0))
    if check and done:
        w = sorted(done, key=lambda r: r['chk']['psnr'])[:5]
        print('lowest PSNR: ' + '; '.join('%s %.1f dB' % (r['path'].split('/')[-1], r['chk']['psnr']) for r in w))
        w = sorted(done, key=lambda r: -r['chk']['edge_a_mean'])[:5]
        print('worst alpha edge (mean |da| on the silhouette): ' + '; '.join('%s %.2f' % (r['path'].split('/')[-1], r['chk']['edge_a_mean']) for r in w))
        w = sorted(done, key=lambda r: -r['chk']['fringe_p99'])[:5]
        print('worst edge as shown (p99 screen error over black/white): ' + '; '.join('%s %.1f' % (r['path'].split('/')[-1], r['chk']['fringe_p99']) for r in w))
        hero = {}
        for r in done:
            if r['kind'] == 'clip': h = hero.setdefault(r['key'], [0, 0.0]); h[0] += r['chk']['edge_n']; h[1] += r['chk']['fringe_mean'] * r['chk']['edge_n']
        hw = sorted(((v[1] / max(1, v[0]), k) for k, v in hero.items()), reverse=True)[:5]
        print('worst hero / monster (mean edge screen error over all its sheets): ' + '; '.join('%s %.2f' % (k, v) for v, k in hw))
        # FLAGS: a sheet clearly worse than the approved test set (PSNR 30-35 dB) or with a visibly wrong edge
        bad = [r for r in done if r['chk']['psnr'] < 28 or r['chk']['edge_a_mean'] > 8 or r['chk']['fringe_p99'] > 48]
        print('FLAGS: ' + ('none' if not bad else '; '.join(r['path'] + ' ' + json.dumps(r['chk']) for r in bad)))
    if rep:
        json.dump([{k: v for k, v in r.items() if k != 'blob'} for r in done], open(rep, 'w'), indent=0)


if __name__ == '__main__':
    main()
