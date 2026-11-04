"""Remove green-plate cyan from approved purple-only Blue5 glow before atlas cut.

The normal green-excess rule cannot identify G <= B cyan. This source owns no
cyan: for those pixels use G as the plate contribution, unmix RGB and alpha.
Run once after the standard key stage, before cut; regenerate key to retry.
"""
import json,hashlib
from pathlib import Path
import numpy as np
from PIL import Image

def apply(work):
    work=Path(work);report=work/'cyan-plate-key.json'
    if report.exists():
        raise SystemExit('Already applied; rerun standard key stage before a changed retry')
    key=np.array(json.loads((work/'measure_blue.json').read_text())['key'],float)
    rows=[]
    for p in sorted((work/'keyed/blue').glob('k*.png')):
        i=int(p.stem[1:]);rgba=np.array(Image.open(p).convert('RGBA'))
        raw=np.array(Image.open(work/'raw/blue'/f'f{i+1:03}.png').convert('RGB'),float)
        c=rgba[...,:3].astype(float)
        mask=(rgba[...,3]>0)&(c[...,1]>c[...,0]+20)&(c[...,2]>c[...,0]+20)
        # Pure violet edges have near-zero G. Solve observed = a*violet+(1-a)*plate.
        a=np.clip(1-raw[...,1]/key[1],.02,1)
        unmixed=np.clip((raw-(1-a[...,None])*key)/a[...,None],0,255)
        unmixed[...,1]=0
        rgba[...,:3]=np.where(mask[...,None],np.rint(unmixed),rgba[...,:3]).astype('uint8')
        rgba[...,3]=np.where(mask,np.minimum(rgba[...,3],np.rint(a*255)),rgba[...,3]).astype('uint8')
        Image.fromarray(rgba).save(p)
        rows.append({'frame':i,'pixels':int(mask.sum()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    report.write_text(json.dumps({'sourceOwnsCyan':False,'plate':key.tolist(),'method':'G-channel plate unmix on cyan-only keyed pixels; alpha reduced, RGB unpremultiplied; body untouched','frames':rows},indent=2))
    print('Corrected cyan plate pixels:',sum(r['pixels'] for r in rows))

if __name__=='__main__':
    import sys
    apply(sys.argv[1])
