"""Independently reproduce the slicer's inspected action-window selection."""
from pathlib import Path
import numpy as np,json
from PIL import Image
root=next(Path('C:/Users/Home/Downloads/fritz-ult-qa').glob('* - frames'))
files=sorted(root.glob('*.png'));ref=np.array(Image.open(files[0]).convert('RGB'),dtype=np.int16)
step=max(1,len(files)//90);indices=list(range(0,len(files),step))
diff=[float((np.abs(np.array(Image.open(files[i]).convert('RGB'),dtype=np.int16)-ref).sum(2)>90).mean()) for i in indices]
peak=max(diff);thr=max(.3*peak,.004);on=[i for i,v in zip(indices,diff) if v>=thr]
lo,hi=(max(0,on[0]-6),min(len(files),on[-1]+11)) if peak>=.004 and on else (0,len(files))
if hi-lo<24:lo,hi=0,len(files)
selected=[lo+round(i*(hi-lo-1)/83) for i in range(84)]
hold=[k+1 for k,v in enumerate(selected) if 48<=v<120]
print(json.dumps({'sourceFrames':len(files),'peak':peak,'threshold':thr,'actionLoZero':lo,'actionHiExclusive':hi,'selectedSource1Based':[v+1 for v in selected],'holdCells':hold,'holdSeconds12fps':len(hold)/12,'note':'all-frame border0 independently measured previously, so spill pruning not expected; actual metadata comparison still required'}))
