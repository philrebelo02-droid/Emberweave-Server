"""Actual remaining cut border/contact evidence, not art editing."""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image,ImageDraw
base=Path('C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/Heroes/Fritz/sprite sheets/HAILUO 03OCT2026/unmixed-strong')
out=Path('C:/Users/Home/Downloads/fritz-final-three-qa');out.mkdir(exist_ok=True)
sheet=Image.new('RGB',(1500,900),'#17202a');d=ImageDraw.Draw(sheet);rows=[]
for r,(name,fw,fh) in enumerate([('green',385,491),('blue',338,491),('passive',426,493)]):
 p=base/f'fritz_{name}.webp';a=np.array(Image.open(p).convert('RGBA'));assert a.shape[:2]==(fh*8,fw*6)
 failed=[]
 for k in range(48):
  y,x=divmod(k,6);alpha=a[y*fh:(y+1)*fh,x*fw:(x+1)*fw,3]
  if np.concatenate([alpha[:3].ravel(),alpha[-3:].ravel(),alpha[:,:3].ravel(),alpha[:,-3:].ravel()]).any():failed.append(k)
 rows.append(dict(state=name,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),cells=48,failed3pxBorders=failed))
 for j,k in enumerate([0,11,23,35,47]):
  y,x=divmod(k,6);im=Image.fromarray(a[y*fh:(y+1)*fh,x*fw:(x+1)*fw]);im.thumbnail((285,265))
  canvas=Image.new('RGB',(300,300),['black','#ffffff','#28323e','black','#ffffff'][j]);canvas.paste(im,((300-im.width)//2,26),im)
  sheet.paste(canvas,(j*300,r*300));d.text((j*300+4,r*300+4),f'{name} cell{k+1}',fill='#ff8800')
sheet.save(out/'three-states.png');(out/'borders.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
