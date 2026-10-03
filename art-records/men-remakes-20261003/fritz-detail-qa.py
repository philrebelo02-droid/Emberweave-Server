"""Prepare parity-controlled diagnostic crops for the sanctioned measure.py.
Never changes the source sheets. Alpha masks on A/B are explicitly identical.
"""
from pathlib import Path
import json,subprocess
import numpy as np
from PIL import Image
base=Path('C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/Heroes/Fritz/sprite sheets/HAILUO 03OCT2026')
out=Path('C:/Users/Home/Downloads/fritz-cut-five-qa')
archive=Path('C:/Users/Home/OneDrive/Desktop/Emberweave Archive')
ctrlroot=archive/'Open Projects/3 - Heroes, Art and Lore/MEN - HAILUO RUNS 03OCT2026/ChatGPT QA/control Pyroclast idle'
ctrl=next(ctrlroot.glob('* - frames'))/'001.png'
c=np.array(Image.open(ctrl).convert('RGBA'));m=(np.abs(c[:,:,:3].astype(int)-[249,1,245]).sum(axis=2)>120)
c[:,:,3]=m.astype('uint8')*255;Image.fromarray(c).save(out/'approved-Pyro-control-f0.png')
measure=archive/'Operating procedure/tools/measure.py'
for state,fw,fh in [('idle',338,491),('walk',390,504),('attack',338,491),('hit',366,491),('ult',338,493)]:
    a=np.array(Image.open(base/f'fritz_{state}.webp').convert('RGBA'))[:fh,:fw].copy()
    b=np.array(Image.open(base/'unmixed-strong'/f'fritz_{state}.webp').convert('RGBA'))[:fh,:fw].copy()
    mask=(a[:,:,3]>=250)&(b[:,:,3]>=250)
    a[:,:,3]=b[:,:,3]=mask.astype('uint8')*255
    assert np.array_equal(a[:,:,3],b[:,:,3])
    ap,bp=out/f'{state}-raw-cut-f0.png',out/f'{state}-unmix-cut-f0.png'
    Image.fromarray(a).save(ap);Image.fromarray(b).save(bp)
    subprocess.run(['python',str(measure),'compare',str(ap),str(bp),'--control',str(out/'approved-Pyro-control-f0.png'),'--erode','4'],check=True)
