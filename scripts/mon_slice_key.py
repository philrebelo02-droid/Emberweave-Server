#!/usr/bin/env python3
"""Slice a green-composite contact-sheet screenshot into frames, key the green,
pack into an Emberweave sprite sheet. Frames are laid out from (0,0) in colsT x rowsT
cells of cw x ch. Green key color given. Reuses the packing conventions.
Usage: mon_slice_key.py <screenshot.jpg> <key> <state> <colsT> <rowsT> <n> <cw> <ch> [refH]
"""
import sys, os, math, json
import numpy as np
from PIL import Image
from scipy import ndimage

OUTDIR='/home/claude/emberweave/repo2/assets/anim/mon'; os.makedirs(OUTDIR,exist_ok=True)
PREV='/home/claude/emberweave/_mon_prev'; os.makedirs(PREV,exist_ok=True)
GREEN=np.array([0,156,60],float)

def key_cell(rgb):
    a=rgb.astype(float); r,g,b=a[...,0],a[...,1],a[...,2]
    d=np.sqrt(((a-GREEN)**2).sum(2))
    al=np.clip((d-50)/40,0,1)
    spill=(g>r+34)&(g>b+34)&(d<110)                 # green bg + jpeg fringe
    al=np.where(spill,0,al)
    al=np.where(al<0.28,0,al)
    # keep ALL substantial blobs (drop only tiny specks) so thin roots/limbs/caps/effects survive
    m=al>0.4; lbl,nn=ndimage.label(m)
    if nn>0:
        sz=ndimage.sum(m,lbl,range(1,nn+1)); mx=sz.max()
        keepmask=np.zeros(m.shape,bool)
        for ci in range(1,nn+1):
            if sz[ci-1] > max(20, 0.015*mx): keepmask |= (lbl==ci)
        body=ndimage.binary_dilation(keepmask,iterations=2); al=np.where(body,al,0)
    al=ndimage.gaussian_filter(al,0.5)
    # solidify: kill faded body pixels (same curve as the 33-sheet fade fix)
    a8=al*255.0
    a8=np.where(a8<=22,0.0,np.where(a8>=200,255.0,255.0*((a8-22)/178.0)**0.55))
    al=a8/255.0
    # despill green fringe
    fr=(al>0)&(g>r+8)&(g>b+8); g2=np.where(fr,np.maximum(r,b),g)
    return np.dstack([r,g2,b,np.clip(al,0,1)*255]).astype(np.uint8)

def run(shot,key,state,colsT,rowsT,n,cw,ch,refH=None):
    im=np.array(Image.open(shot).convert('RGB'))
    cells=[]
    for i in range(n):
        r,c=divmod(i,colsT); y0,x0=r*ch,c*cw
        cell=im[y0:y0+ch, x0:x0+cw]
        cells.append(key_cell(cell))
    # FIXED-FIGH MODE: browser already normalized char size (same across states) and
    # composited at a fixed scale, so DO NOT re-normalize here. refH is used directly as figH.
    figH_fixed=int(refH) if refH else None
    scale=1.0
    sc=cells
    def bbox(k,t=40):
        ys,xs=np.where(k[...,3]>t); return (xs.min(),ys.min(),xs.max()+1,ys.max()+1) if len(xs) else None
    bx=[b for b in (bbox(k) for k in sc) if b]
    X0=min(b[0] for b in bx);Y0=min(b[1] for b in bx);X1=max(b[2] for b in bx);Y1=max(b[3] for b in bx)
    pad=6; W=(X1-X0)+2*pad; H=(Y1-Y0)+2*pad
    cap=260.0; ds=min(1.0,cap/max(W,H)); FW=round(W*ds); FH=round(H*ds)
    cols=6; rows=math.ceil(n/cols); sheet=np.zeros((rows*FH,cols*FW,4),np.uint8)
    for i,s in enumerate(sc):
        cc=np.zeros((H,W,4),np.uint8); src=s[Y0:Y1,X0:X1]; cc[pad:pad+src.shape[0],pad:pad+src.shape[1]]=src
        cc=np.array(Image.fromarray(cc,'RGBA').resize((FW,FH),Image.LANCZOS))
        r_,c_=divmod(i,cols); sheet[r_*FH:(r_+1)*FH,c_*FW:(c_+1)*FW]=cc
    # anchor from the FULLEST frame (most content), not the mid frame — mid can be a
    # glitched/effect-only frame whose bbox bottom is not the character's ground point.
    best=max(range(n), key=lambda i:int((sc[i][...,3]>60).sum()))
    ys,xs=np.where(sc[best][...,3]>60)
    feet=int(((ys.max()-Y0)+pad)*ds); cx=int(((xs.mean()-X0)+pad)*ds)
    out=os.path.join(OUTDIR,f'{key}_{state}.webp')
    Image.fromarray(sheet,'RGBA').save(out,'WEBP',quality=82,method=6)
    fps=14 if state=='walk' else 16 if state=='attack' else 10
    figH_out=int((figH_fixed if figH_fixed else ref)*ds)
    meta=dict(u=f'/assets/anim/mon/{key}_{state}.webp?v=1',n=n,fw=FW,fh=FH,cols=cols,rows=rows,figH=figH_out,feet=feet,cx=cx,fps=fps,flip=False)
    if state=='attack': meta['hold']=0.9
    if state=='cast': meta['hold']=0.8
    # preview
    grey=np.array([70,74,82],np.uint8); gf=[]
    for i in range(n):
        c,r=i%cols,i//cols; cl=sheet[r*FH:(r+1)*FH,c*FW:(c+1)*FW].astype(float); al=cl[...,3:4]/255.
        comp=(cl[...,:3]*al+grey*(1-al)).astype(np.uint8); img=Image.fromarray(comp); img.thumbnail((260,260)); gf.append(img)
    gf[0].save(os.path.join(PREV,f'{key}_{state}.gif'),save_all=True,append_images=gf[1:],duration=int(1000/fps),loop=0)
    return meta, (figH_fixed or 0), int(os.path.getsize(out)//1024)

if __name__=='__main__':
    a=sys.argv
    shot,key,state=a[1],a[2],a[3]; colsT,rowsT,n,cw,ch=int(a[4]),int(a[5]),int(a[6]),int(a[7]),int(a[8])
    refH=float(a[9]) if len(a)>9 else None
    meta,ref,kb=run(shot,key,state,colsT,rowsT,n,cw,ch,refH)
    print('META',json.dumps(meta),'ref',round(ref,1),'kb',kb)
