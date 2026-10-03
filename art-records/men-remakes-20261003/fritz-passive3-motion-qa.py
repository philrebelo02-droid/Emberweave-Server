"""Locate hood-region horizontal motion around the fastest sidestep."""
from pathlib import Path
from PIL import Image
import numpy as np,json
root=next(Path('C:/Users/Home/Downloads/fritz-passive3-qa').glob('* - frames'))
rows=[]
for n in [24,48,60,65,66,67,68,69,70,71,72,73,75]:
 a=np.array(Image.open(root/f'{n:03}.png').convert('RGB'),dtype=np.int16)
 mask=(np.abs(a-[255,0,255]).sum(2)>120);mask[260:]=False;mask[:180]=False
 yy,xx=np.where(mask);rows.append({'frame':n,'hoodBandXMin':int(xx.min()),'hoodBandXMax':int(xx.max()),'hoodBandMeanX':round(float(xx.mean()),2)})
print(json.dumps(rows))
