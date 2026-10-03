"""User preview of actual accepted action exports; never modifies character assets."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import bisect,json,hashlib
base=Path('C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Open Projects/3 - Heroes, Art and Lore/MEN - HAILUO RUNS 03OCT2026/preview Fritz')
defs=[('idle','Idle'),('walk','Walk'),('attack','Attack'),('hit','Hit'),('green','Storm Surge'),('blue','Chain Lightning'),('ult','Thunder Shower'),('passive','Static Veil')]
clips=[]
for key,label in defs:
 im=Image.open(base/(key+'.webp'));frames=[];ends=[];total=0
 for k in range(im.n_frames):
  im.seek(k);im.load();frames.append(im.convert('RGB').copy());total+=im.info['duration'];ends.append(total)
 clips.append((label,frames,ends,total))
font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',20)
small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',15)
outputs=[]
for tick in range(168):
 t=round(tick*1000/24);page=Image.new('RGB',(960,1080),'#17202a');d=ImageDraw.Draw(page)
 for r,(label,frames,ends,total) in enumerate(clips):
  x=(r%3)*320;y=(r//3)*360;k=bisect.bisect_right(ends,t%total);f=frames[k]
  d.rectangle((x+4,y+4,x+316,y+355),fill='#28303c');d.text((x+12,y+8),label,font=font,fill='#e0b23f')
  page.paste(f,(x+(320-f.width)//2,y+40));d.text((x+12,y+337),'Fritz · character motion',font=small,fill='#a3a9b5')
 d.text((652,788),'FRITZ',font=font,fill='#e0b23f');d.text((652,825),'8 actions · offline preview',font=small,fill='white');d.text((652,850),'Separate spell FX stay in game',font=small,fill='#a3a9b5');d.text((652,875),'Not deployed',font=small,fill='#a3a9b5')
 outputs.append(page)
dst=base/'Fritz - eight-action collage - ChatGPT.webp'
outputs[0].save(dst,save_all=True,append_images=outputs[1:],duration=42,loop=0,quality=85,method=4)
with Image.open(dst) as final:
 durations=[]
 for k in range(final.n_frames):final.seek(k);final.load();durations.append(final.info['duration'])
 for k in [48,96,140]:
  final.seek(k);final.convert('RGB').save(f'C:/Users/Home/Downloads/fritz-final-three-qa/collage-frame-{k+1}.png')
 report={'file':str(dst),'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'frames':final.n_frames,'size':final.size,'totalMs':sum(durations),'states':[x[0] for x in clips],'note':'Actual animation export mosaic. Display quantization42ms, not a gameplay timing claim.'}
Path('C:/Users/Home/Downloads/fritz-final-three-qa/collage-evidence.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
