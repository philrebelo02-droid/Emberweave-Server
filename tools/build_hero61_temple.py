"""Frame an approved idle source in the existing Temple bust window; no new art."""
from pathlib import Path
import sys,json,hashlib,tempfile
import numpy as np
from PIL import Image
from integrate.cut import cut_state,fringe

ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def build(work):
    work=Path(work)
    with tempfile.TemporaryDirectory(prefix='hero61-temple-') as tmp:
        cut=Path(tmp)/'idle.webp';master=Path(tmp)/'idle-master.webp'
        report=cut_state(str(work),'idle','0',{'h':493,'sole':764,'cx':399.4},str(cut),str(master),unmix_soft=True,pad=0,maxfig=912)
        # Native source rectangle: x290..466, y260..622. Crown, helmet and chest;
        # side-cropped shoulders like the other Temple busts. Existing alpha retained.
        x0,y0=report['box'][:2]
        im=Image.open(master).convert('RGBA').crop((290-x0,260-y0,466-x0,622-y0))
        im=im.resize((444,912),Image.Resampling.LANCZOS)
        px=np.asarray(im).copy();px[...,1]=np.minimum(px[...,1],np.maximum(px[...,0],px[...,2]));px[px[...,3]==0,:3]=0
        im=Image.fromarray(px,'RGBA')
        out=ROOT/'assets/img/temple/v2/heroes/hero61-v2.webp'
        im.save(out,lossless=True,method=6,exact=True)
        data={'source':'Approved take3 idle, frame 0','source_frame_sha256':sha(work/'raw/idle/f001.png'),'source_alpha_sha256':sha(work/'keyed/idle/k000.png'),'source_crop':[290,260,466,622],'output':out.relative_to(ROOT).as_posix(),'output_sha256':sha(out),'size':[444,912],'fringe':fringe(np.asarray(Image.open(out).convert('RGBA')))}
        (ROOT/'tests/fixtures/hero61-temple-provenance.json').write_text(json.dumps(data,indent=2)+'\n')
        print(json.dumps(data))
if __name__=='__main__':build(sys.argv[1])
