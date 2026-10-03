"""Actual candidate frame contacts for single cast and reversal review, not art editing."""
from pathlib import Path
from PIL import Image,ImageDraw
for state,indices in [('a1',[1,13,25,37,49,61,67,72,77,83,89,101,113,125,137,143]),('a2',[1,13,25,37,43,48,53,60,66,72,79,89,101,113,125,131])]:
 root=Path(f'C:/Users/Home/Downloads/fritz-{state}-rb-qa');frames=next(root.glob('* - frames'))
 sheet=Image.new('RGB',(1200,1200),'#222222');d=ImageDraw.Draw(sheet)
 for k,n in enumerate(indices):
  im=Image.open(frames/f'{n:03}.png').crop((200,180,570,600));im.thumbnail((285,270));x,y=(k%4)*300,(k//4)*300
  sheet.paste(im,(x,y+22));d.text((x+4,y+4),f'{state} frame {n} / {(n-1)/24:.3f}s',fill='white')
 sheet.save(root/'turnaround.png')
