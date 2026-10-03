from pathlib import Path
from PIL import Image
p=Path('C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Open Projects/3 - Heroes, Art and Lore/MEN - HAILUO RUNS 03OCT2026/preview Fritz/Fritz - eight-action collage - ChatGPT.webp')
with Image.open(p) as im:
 for k in [24,72,132]:
  im.seek(k);im.load();im.convert('RGB').save(f'C:/Users/Home/Downloads/fritz-final-three-qa/collage-frame-{k+1}.png')
