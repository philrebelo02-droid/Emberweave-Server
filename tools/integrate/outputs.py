"""OUTPUTS: what Phil and the reviewer look at.

  <work>/look/<hero>-sheets-contact.jpg  every state on ONE floor line (figH-normalised as the engine draws them; red = feet, blue = top):
                                         cell 0, the contact cell (and its neighbours) and the last cell, labelled state / cell / source frame.
                                         Built from the sheets alone - no browser, no GPU.
  <work>/look/<hero>-stills-844x390.jpg  the rig's stills (rig stage, mode stills): each state on its engine moment in a real phone battle.
  <work>/look/clips/<hero>_<clip>.webm   the rig's clip frames (mode clip), 30 fps VP9.
  <work>/look/<hero>-clips.html          the clip page (both themes, real speed, sound off) - publish it as an Artifact for Phil (clips go on a page).
"""
import base64
import html
import json
import os
import subprocess

from PIL import Image, ImageDraw

from .common import log


def contact_sheet(cfg, cut, out):
    order = cfg.order or list(cut)
    H = 220
    rows = []
    for st in order:
        R = cut[st]
        c = cfg.st(st).get('contact')
        cells = [0] + ([x for x in (c - 1, c, c + 1) if 0 < x < R['n'] - 1] if c is not None else [R['n'] // 3, 2 * R['n'] // 3]) + [R['n'] - 1]
        rows.append((st, R, cells, c))
    k_of = lambda R: H * 0.8 / R['figH']
    width = max(sum(int(R['fw'] * k_of(R)) for _ in cells) for st, R, cells, c in rows)
    hts = [int(R['fh'] * k_of(R)) + 20 for st, R, cells, c in rows]
    S = Image.new('RGB', (width, sum(hts)), (40, 40, 46))
    d = ImageDraw.Draw(S)
    y = 0
    for (st, R, cells, c), h in zip(rows, hts):
        im = Image.open(os.path.join(cfg.work, 'sheets', '%s_%s_%s.webp' % (cfg.hero, st, cfg.version))).convert('RGBA')
        k = k_of(R)
        tw, th = int(R['fw'] * k), int(R['fh'] * k)
        x = 0
        for cc in cells:
            r, q = divmod(cc, R['cols'])
            cell = im.crop((q * R['fw'], r * R['fh'], (q + 1) * R['fw'], (r + 1) * R['fh'])).resize((tw, th), Image.LANCZOS)
            bg = Image.new('RGBA', (tw, th), (40, 40, 46, 255))
            bg.alpha_composite(cell)
            S.paste(bg.convert('RGB'), (x, y + 18))
            d.rectangle([x, y + 18, x + tw - 1, y + 18 + th - 1], outline=(255, 210, 80) if cc == c else (90, 90, 90))
            d.line([(x, y + 18 + R['feet'] * k), (x + tw, y + 18 + R['feet'] * k)], fill=(255, 60, 60))
            d.line([(x, y + 18 + R['top'] * k), (x + tw, y + 18 + R['top'] * k)], fill=(80, 140, 255))
            d.text((x + 3, y + 3), '%s c%d f%d%s' % (st, cc, R['frames'][cc], ' CONTACT' if cc == c else ''), fill=(255, 255, 0))
            x += tw
        y += h
    S.save(out, quality=90)
    return out


def stills(cfg, rig_dir, out):
    sd = rig_dir
    fs = sorted(f for f in os.listdir(sd) if f.endswith('.png'))
    if not fs:
        return None
    ims = [Image.open(os.path.join(sd, f)).convert('RGB').resize((844, 390)) for f in fs]
    cols = 2
    rows = (len(ims) + 1) // 2
    S = Image.new('RGB', (cols * 844, rows * 412), (24, 24, 28))
    d = ImageDraw.Draw(S)
    for i, (f, im) in enumerate(zip(fs, ims)):
        x, y = (i % cols) * 844, (i // cols) * 412
        S.paste(im, (x, y + 22))
        d.text((x + 6, y + 5), f[:-4], fill=(255, 220, 120))
    S.save(out, quality=88)
    return out


def clips(cfg, clip_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    made = []
    for c in sorted(os.listdir(clip_dir)):
        p = os.path.join(clip_dir, c)
        if not os.path.isdir(p):
            continue
        o = os.path.join(out_dir, '%s_%s.webm' % (cfg.hero, c))
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', os.path.join(p, 'f%04d.png'), '-vf', 'scale=640:-2', '-c:v', 'libvpx-vp9',
                        '-b:v', '0', '-crf', '38', '-pix_fmt', 'yuv420p', o], check=True)
        made.append(c)
    return made


PAGE = '''<title>@@TITLE@@</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#f6f4ef;--fg:#1d1b18;--muted:#5d5850;--card:#ffffff;--line:#ddd7cc}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#15161a;--fg:#ece9e2;--muted:#a19c92;--card:#1f2026;--line:#33343c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#15161a;--fg:#ece9e2;--muted:#a19c92;--card:#1f2026;--line:#33343c;color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1180px;margin:0 auto;padding-block:20px 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1,h2{text-wrap:balance}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 10px}
p.sub{color:var(--muted);margin:0 0 8px;max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:14px}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
video{display:block;width:100%;height:auto;background:#000}
figcaption{padding:8px 10px;font-size:13px;color:var(--muted)}
</style><main>
<h1>@@TITLE@@</h1>
<p class="sub">The approved remakes in a real battle: phone landscape 844x390, phone texture tier, real speed (30 fps), sound off.</p>
@@PARTS@@
</main>'''


def clip_page(cfg, clip_dir, made, out):
    caps = cfg.d.get('captions', {})
    cards = []
    for c in made:
        b = base64.b64encode(open(os.path.join(clip_dir, '%s_%s.webm' % (cfg.hero, c)), 'rb').read()).decode()
        cap = caps.get(c) or c.replace('-', ' ')
        cards.append('<figure><video src="data:video/webm;base64,%s" autoplay loop muted playsinline></video><figcaption>%s</figcaption></figure>' % (b, html.escape(cap)))
    part = '<section><h2>%s</h2><div class="grid">%s</div></section>' % (html.escape(cfg.name), ''.join(cards))
    title = cfg.d.get('pageTitle', cfg.name)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(PAGE.replace('@@TITLE@@', html.escape(title)).replace('@@PARTS@@', part))
    return out


def stage_outputs(cfg, a):
    r = cfg.run()
    cut = r.get('cut') or {}
    look = os.path.join(cfg.work, 'look')
    os.makedirs(look, exist_ok=True)
    res = {}
    if cut:
        res['contact_sheet'] = contact_sheet(cfg, cut, os.path.join(look, '%s-sheets-contact.jpg' % cfg.hero))
        log(cfg.work, 'outputs %s' % res['contact_sheet'])
    rig = a.rig_out or cfg.work
    sd = os.path.join(rig, 'rig_%s_stills' % cfg.hero)
    if os.path.isdir(sd):
        res['stills'] = stills(cfg, sd, os.path.join(look, '%s-stills-844x390.jpg' % cfg.hero))
        log(cfg.work, 'outputs %s' % res['stills'])
    cd = os.path.join(rig, 'rig_%s_clip' % cfg.hero)
    if os.path.isdir(cd):
        made = clips(cfg, cd, os.path.join(look, 'clips'))
        res['clip_page'] = clip_page(cfg, os.path.join(look, 'clips'), made, os.path.join(look, '%s-clips.html' % cfg.hero))
        log(cfg.work, 'outputs %s (%d clips, %.1f MB)' % (res['clip_page'], len(made), os.path.getsize(res['clip_page']) / 1e6))
    if 'stills' not in res:
        log(cfg.work, 'outputs: no rig stills yet - run the rig stage (GPU lock) for the in-battle stills and the clip page')
    r['outputs'] = res
    cfg.save_run(r)
