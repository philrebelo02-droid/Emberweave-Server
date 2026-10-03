"""Dense export-frame evidence for passive3 step69 and return, not art editing."""
from pathlib import Path
from PIL import Image,ImageDraw
root=Path('C:/Users/Home/Downloads/fritz-passive3-qa');frames=next(root.glob('* - frames'))
indices=[1,24,48,60,65,66,67,68,69,70,71,72,73,75,120,142]
sheet=Image.new('RGB',(1200,1200),'#222222');d=ImageDraw.Draw(sheet)
for k,n in enumerate(indices):
 im=Image.open(frames/f'{n:03}.png').crop((210,180,560,600));im.thumbnail((285,270));x,y=(k%4)*300,(k//4)*300
 sheet.paste(im,(x,y+22));d.text((x+4,y+4),f'frame {n} / {(n-1)/24:.3f}s',fill='white')
sheet.save(root/'joins.png')
