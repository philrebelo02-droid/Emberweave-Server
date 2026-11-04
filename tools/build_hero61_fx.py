"""Approved Hailuo black-background plates -> shared phone-safe FX sheets.
Usage: python tools/build_hero61_fx.py SOURCE_DIR WORK_DIR
Source MP4s are immutable; effects use the existing premultiplied atlas cutter.
"""
from pathlib import Path
import sys, json, hashlib
from integrate.fx import extract, cut_fx

ROOT=Path(__file__).resolve().parents[1]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    src,work=map(Path,sys.argv[1:3]); work.mkdir(parents=True,exist_ok=True)
    entries={}; reports={}
    for name,digest,frames in [
        ('healing','b7b552a557e1242d8025a779dda724ffc952e8b66d395b09ce38e7c69e111bf9','0:59:2'),
        ('bubble','b1a5ef6df169d74b983471dd249c4d9217845d0ae3a583b32c1cc0aa48290400','0:123:2')]:
        video=src/f'hero61-dark-purple-{name}-take1.mp4'
        assert sha(video)==digest,'approved take changed'
        raw=work/'raw'/name; extract(str(video),str(raw))
        output=ROOT/'assets/anim/fx'/f'hero61_{name}_1263.webp'
        master=work/'masters'/f'hero61_{name}_1263.webp'
        G,rep=cut_fx(str(raw),str(output),str(master),dict(frames=frames,plate='black',d0=0,d1=255,ext=0,border=0,fade=[0,0,0,0]))
        key='hero61_heal' if name=='healing' else 'hero61_bubble'
        entries[key]=dict(u='/'+output.relative_to(ROOT).as_posix()+'?v=1263fx',n=rep['n'],fw=rep['fw'],fh=rep['fh'],cols=rep['cols'],rows=rep['rows'],dur=rep['n']/12,fps2=12,anchor=[.5,.5] if name=='bubble' else [.5,.06],size=1.65 if name=='bubble' else 1.35,mid=.5 if name=='bubble' else 0,spawn=0,hero61Life=4 if name=='bubble' else 2.5)
        if name=='bubble':entries[key].update(hero61Life=4,hero61Bubble=True)
        reports[key]=dict(source=str(video),source_sha256=digest,source_frames=frames,sheet_sha256=sha(output),master_sha256=sha(master),cut=rep)
    (work/'cut-report.json').write_text(json.dumps(reports,indent=2))
    (ROOT/'tests/fixtures/hero61-approved-fx.json').write_text(json.dumps(dict(entries=entries,provenance=reports),indent=2))
    print(json.dumps(entries,indent=2))
if __name__=='__main__':main()
