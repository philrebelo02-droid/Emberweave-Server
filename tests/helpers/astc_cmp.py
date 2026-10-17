"""tests/test_astc_textures.js helper: compare two screenshots of the same frozen battle frame (WebP path vs ASTC path) over the
units' footprint (pixels where the WebP frame differs from the same frame with every unit hidden, dilated 2 px).
Usage: py -I astc_cmp.py <webp.png> <astc.png> <bg.png>  ->  JSON {psnr, mean, p99, max, n, psnr_all}"""
import sys, json
import numpy as np
from PIL import Image

a = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
b = np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(np.float32)
g = np.asarray(Image.open(sys.argv[3]).convert('RGB')).astype(np.float32)
m = np.abs(a - g).max(axis=2) > 4
for _ in range(2):
    m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
d = np.abs(a - b).max(axis=2)
def psnr(x):
    mse = (x ** 2).mean() if x.size else 0.0
    return 99.0 if mse <= 0 else float(10 * np.log10(255 ** 2 / mse))
fp = (a - b)[m]
print(json.dumps({'n': int(m.sum()), 'psnr': round(psnr(fp), 2), 'mean': round(float(d[m].mean()), 3) if m.any() else 0,
                  'p99': float(np.percentile(d[m], 99)) if m.any() else 0, 'max': float(d.max()), 'psnr_all': round(psnr(a - b), 2)}))
