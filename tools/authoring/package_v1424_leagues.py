"""Export generated originals as transparent game-sized WebP and a QA sheet."""
import json,hashlib,shutil
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[2]
job=Path('E:/Emberweave Archive/4 Projects/Open Projects/ART SAME IN EVERY LANGUAGE 19NOV2026')
source_dir=job/'generated-leagues';source_dir.mkdir(parents=True,exist_ok=True)
dest=root/'assets/img/ui/arena-leagues';dest.mkdir(parents=True,exist_ok=True)
rows=json.loads((root/'docs/art/v1424-league-generation.json').read_text(encoding='utf-8'))
ranges=['1','2','3','4–10','11–25','26–50','51–100','101–500','501–1000','1001+']
sheet=Image.new('RGB',(1000,470),'#141922');draw=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
for i,row in enumerate(rows):
    source=Path(row['source']);shutil.copy2(source,source_dir/(row['id']+'-source'+('-v'+str(row['revision']) if row.get('revision') else '')+'.png'))
    image=Image.open(source).convert('RGBA');assert image.getchannel('A').getextrema()[0]==0
    # Export sizing only: preserve generated alpha and pixels, no background painting/removal.
    image.thumbnail((232,232),Image.Resampling.LANCZOS)
    icon=Image.new('RGBA',(256,256));icon.alpha_composite(image,((256-image.width)//2,(256-image.height)//2))
    file=dest/(row['id']+'.webp');icon.save(file,'WEBP',lossless=True,method=6)
    x=(i%5)*200;y=(i//5)*235
    large=icon.resize((128,128),Image.Resampling.LANCZOS);sheet.paste(large,(x+36,y+8),large)
    tiny=icon.resize((40,40),Image.Resampling.LANCZOS);sheet.paste(tiny,(x+80,y+140),tiny)
    draw.text((x+100,y+188),row['id'].title(),font=font,fill='#ffe4ac',anchor='mm')
    draw.text((x+100,y+212),'#'+ranges[i],font=small,fill='#c4cad0',anchor='mm')
    row.update({'asset':file.relative_to(root).as_posix(),'asset_sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'original_copy':str(source_dir/(row['id']+'-source'+('-v'+str(row['revision']) if row.get('revision') else '')+'.png')),'rank_range':ranges[i],'size':[256,256]})
(root/'docs/art/v1424-league-generation.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
sheet.save(job/'league-symbols-review.png');print('Exported10 transparent256px WebPs; review:',job/'league-symbols-review.png')
