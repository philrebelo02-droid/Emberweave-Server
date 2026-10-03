"""Read-only clip evidence: contact sheet of exported joins, not a new art asset."""
from pathlib import Path
from PIL import Image, ImageDraw
root=Path('C:/Users/Home/Downloads/fritz-ult-qa')
frames=next(root.glob('* - frames'))
indices=[1,5,6,30,48,49,66,67,84,85,102,103,120,121,152,167]
sheet=Image.new('RGB',(1200,1200),'#222222')
d=ImageDraw.Draw(sheet)
for k,n in enumerate(indices):
    im=Image.open(frames/f'{n:03}.png').crop((250,190,520,590)).resize((270,400))
    im.thumbnail((290,270))
    x,y=(k%4)*300,(k//4)*300
    sheet.paste(im,(x,y+22))
    d.text((x+4,y+4),f'export frame {n} / {(n-1)/24:.3f}s',fill='white')
sheet.save(root/'joins.png')
