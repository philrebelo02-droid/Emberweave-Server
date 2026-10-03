"""Independent read-only decode of restart cuts; not performance/wiring approval."""
import ast, hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image
base=Path('C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/Heroes/Fritz/sprite sheets/HAILUO RESTART 03OCT2026')
clips=base.parents[1]/'clips'/'HAILUO MEN 03OCT2026'
report=json.loads((base/'cut-report.json').read_text())
assert set(report)==set('idle walk attack hit green blue ult passive'.split())
rows=[]
for state,row in report.items():
 meta=ast.literal_eval(row['meta'])[0]
 p=base/'despilled'/f'fritz_{state}.webp'
 a=np.array(Image.open(p).convert('RGBA'))
 assert a.shape[:2]==(meta['fh']*meta['rows'],meta['fw']*meta['cols'])
 failed=[];empty=[];pink=0;opaque=0
 for k in range(meta['n']):
  y,x=divmod(k,meta['cols']);c=a[y*meta['fh']:(y+1)*meta['fh'],x*meta['fw']:(x+1)*meta['fw']];al=c[:,:,3]
  if np.concatenate([al[:3].ravel(),al[-3:].ravel(),al[:,:3].ravel(),al[:,-3:].ravel()]).any():failed.append(k)
  if not al.any():empty.append(k)
  r,g,b=[c[:,:,i].astype(int) for i in range(3)];vis=al>0
  pink+=int((vis&(r>200)&(b>200)&(g<60)&(r-g>140)&(b-g>140)).sum());opaque+=int(vis.sum())
 source=clips/row['clip'];assert source.exists()
 rows.append(dict(state=state,sheet=str(p),sheetSHA256=hashlib.sha256(p.read_bytes()).hexdigest(),source=str(source),sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),meta=meta,failed3pxBorders=failed,emptyCells=empty,trulyPinkPixels=pink,visiblePixels=opaque,clipSeconds=meta['n']/meta['fps']))
result=json.dumps(dict(scope='Decode/border/source identity only. No full-motion, anchor, priority, combat timing or deployment approval.',states=rows),indent=2)
Path(__file__).with_suffix('.evidence.json').write_text(result)
print(result)
