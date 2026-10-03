"""Read-only numerical alpha-border verification of actual delivered cells."""
import hashlib, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

rows=[]
for src,fw,fh in [(sys.argv[1],338,491),(sys.argv[2],390,504)]:
    p=Path(src)
    arr=np.asarray(Image.open(p).convert('RGBA'))
    assert arr.shape[:2]==(fh*8,fw*6), (p.name,arr.shape)
    cells=[]
    for k in range(48):
        y,x=divmod(k,6)
        a=arr[y*fh:(y+1)*fh,x*fw:(x+1)*fw,3]
        border=np.concatenate((a[:3].ravel(),a[-3:].ravel(),a[:,:3].ravel(),a[:,-3:].ravel()))
        yy,xx=np.where(a>0)
        cells.append(dict(cell=k,edgeNonzero=int((border>0).sum()),edgeMax=int(border.max()),bounds=[int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())]))
    rows.append(dict(file=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),size=[arr.shape[1],arr.shape[0]],cells=cells,failedCells=[c['cell'] for c in cells if c['edgeNonzero']]))
print(json.dumps(rows))
