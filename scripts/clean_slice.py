import sys, numpy as np
from PIL import Image
shot,key,state,cw,ch,refH=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4]),int(sys.argv[5]),sys.argv[6]
im=np.array(Image.open(shot).convert('RGB')).astype(int)
r,g,b=im[:,:,0],im[:,:,1],im[:,:,2]
mag=(r>140)&(b>140)&(g<130)
im[mag]=[0,156,60]
out=shot.replace('.jpg','_clean.png')
Image.fromarray(im.astype('uint8')).save(out)
print(out)
