"""Actual delivered ult84 cell border and held-pose contact inspection."""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib
p=Path('C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/Heroes/Fritz/sprite sheets/HAILUO 03OCT2026/ult 84 cells 12 fps/unmixed-strong/fritz_ult.webp')
out=Path('C:/Users/Home/Downloads/fritz-cut-five-qa')
a=np.array(Image.open(p).convert('RGBA'));assert a.shape[:2]==(493*14,338*6),a.shape
fail=[]
for k in range(84):
 y,x=divmod(k,6);c=a[y*493:(y+1)*493,x*338:(x+1)*338,3];e=np.concatenate((c[:3].ravel(),c[-3:].ravel(),c[:,:3].ravel(),c[:,-3:].ravel()))
 if e.any():fail.append(k+1)
result={'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':[a.shape[1],a.shape[0]],'cells':84,'failed3pxBorders':fail,'holdCells1Based':[25,60],'holdSeconds':36/12,'nativeMappingClaim':'1,3,...167 verified slicer selection code, not exact RGB source/cut equality claim'}
(out/'ult84-borders.json').write_text(json.dumps(result,indent=2))
sheet=Image.new('RGB',(1200,900),'#28323e');d=ImageDraw.Draw(sheet)
for j,k in enumerate([0,23,24,25,33,34,42,43,51,59,60,83]):
 y,x=divmod(k,6);im=Image.fromarray(a[y*493:(y+1)*493,x*338:(x+1)*338]);im.thumbnail((270,270));sx,sy=(j%4)*300,(j//4)*300
 sheet.paste(im,(sx+(300-im.width)//2,sy+24),im);d.text((sx+5,sy+4),f'cell{k+1} source{1+2*k} {k/12:.3f}s',fill='white')
sheet.save(out/'ult84-joins.png');print(json.dumps(result))
