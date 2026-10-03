"""Inspect complete actual animated preview files and source sheets, not a gameplay claim."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
base=Path('C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Open Projects/3 - Heroes, Art and Lore/MEN - HAILUO RUNS 03OCT2026/preview Fritz')
out=Path('C:/Users/Home/Downloads/fritz-final-three-qa');rows=[]
sheet=Image.new('RGB',(1200,1600),'#28303c');d=ImageDraw.Draw(sheet)
for r,state in enumerate(['idle','walk','attack','hit','green','blue','ult','passive']):
 p=base/(state+'.webp');im=Image.open(p);n=im.n_frames;times=[]
 for k in range(n):
  im.seek(k);im.load();times.append(im.info.get('duration'))
 rows.append(dict(state=state,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),frames=n,size=im.size,durationsMs=sorted(set(times)),totalMs=sum(times)))
 for j,k in enumerate([0,n//4,n//2,3*n//4,n-1]):
  im.seek(k);f=im.convert('RGB');f.thumbnail((190,170));x=j*240;y=r*200
  sheet.paste(f,(x,y+24));d.text((x+4,y+4),f'{state} {k+1}/{n}',fill='white')
sheet.save(out/'all-eight-preview-frames.png');(out/'preview-evidence.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
