import re, json, os, numpy as np
from PIL import Image
from scipy import ndimage
S=open('repo2/emberweave-heroes.html',encoding='utf8').read()
BASE='/home/claude/emberweave/repo2'

def block(name):
    i=S.index(name); b=S.index('{',i); d=0
    for k in range(b,len(S)):
        if S[k]=='{': d+=1
        elif S[k]=='}':
            d-=1
            if d==0: return S[b:k+1]

def toplevel(blob):
    out={}; i=1
    while i<len(blob):
        m=re.match(r'\s*(?:"([^"]+)"|([A-Za-z_]\w*))\s*:\s*\{',blob[i:])
        if m:
            key=m.group(1) or m.group(2); st=i+m.end()-1; d=0
            for k in range(st,len(blob)):
                if blob[k]=='{': d+=1
                elif blob[k]=='}':
                    d-=1
                    if d==0: e=k; break
            out[key]=blob[st:e+1]; i=e+1; continue
        i+=1
    return out

consts={m.group(1):m.group(2) for m in re.finditer(r'(?:const|,|\s)\s*([A-Z][A-Z0-9_]{2,})\s*=\s*"([^"]+)"',S)}
BA=toplevel(block('const BATTLE_ANIM'))
UNITS={}
for key,body in BA.items():
    ss={}
    for sm in re.finditer(r'([a-z]+)\s*:\s*\{([^{}]*)\}',body):
        inn=sm.group(2)
        um=re.search(r"u\s*:\s*'([^']+)'",inn) or re.search(r"u\s*:\s*([A-Z][A-Z0-9_]*)",inn)
        if not um: continue
        u=um.group(1)
        if not u.startswith('/') and not u.startswith('http'): u=consts.get(u,u)
        gi=lambda n:(int(re.search(r'\b'+n+r'\s*:\s*(\d+)',inn).group(1)) if re.search(r'\b'+n+r'\s*:\s*(\d+)',inn) else None)
        gf=lambda n:(float(re.search(r'\b'+n+r'\s*:\s*([\d.]+)',inn).group(1)) if re.search(r'\b'+n+r'\s*:\s*([\d.]+)',inn) else None)
        n=gi('n') or 12
        fl=re.search(r'flip\s*:\s*(true|false)',inn)
        ss[sm.group(1)]=dict(u=u,fw=gi('fw'),fh=gi('fh'),n=n,cols=gi('cols') or n,rows=gi('rows') or 1,
            figH=gi('figH'),feet=gi('feet'),cx=gi('cx'),fps=gf('fps') or 10,
            flip=(fl.group(1)=='true') if fl else None,
            pingpong='pingpong:true' in inn.replace(' ',''))
    if ss: UNITS[key]=ss

ABIL={}
ab=block('const ABIL_ANIM')
for m in re.finditer(r'(\w+)\s*:\s*\{\s*st\s*:\s*\'([a-z]+)\'',ab): ABIL[m.group(1)]=m.group(2)
HT=toplevel(block('HERO_TYPES ='))
ULT={k:(re.search(r"ability\s*:\s*'(\w+)'",v).group(1) if re.search(r"ability\s*:\s*'(\w+)'",v) else None) for k,v in HT.items()}
KITS=toplevel(block('const KITS')) if 'const KITS' in S else {}
if not KITS:
    i=S.find("sylthaine:{green:{name:'Frozen Orb'")
    j=S.rfind('{',0,i); KITS=toplevel(S[j:S.index('};',i)+1])
GB={}
for k,v in KITS.items():
    g=re.search(r"green\s*:\s*\{[^{}]*type\s*:\s*'(\w+)'",v)
    b=re.search(r"blue\s*:\s*\{[^{}]*type\s*:\s*'(\w+)'",v)
    GB[k]=dict(green=g.group(1) if g else None, blue=b.group(1) if b else None)

def path(key,m):
    u=m['u'].split('?')[0]
    return BASE+u if u.startswith('/') else f"{BASE}/assets/anim/{key}/{u.split('/')[-1]}"

def art(key,m):
    p=path(key,m)
    if not os.path.exists(p): return None
    im=np.array(Image.open(p).convert('RGBA'))
    fw,fh,cols,rws,n=m['fw'],m['fh'],m['cols'],m['rows'],m['n']
    hs=[];areas=[];edge=0;holes=0;feet=[];cxs=[];empty=[]
    for i in range(n):
        c=i%cols; r=(i//cols) if rws>1 else 0
        if (r+1)*fh>im.shape[0] or (c+1)*fw>im.shape[1]: empty.append(i); continue
        a=im[r*fh:(r+1)*fh, c*fw:(c+1)*fw,3]
        b=a>60
        if b.sum()<50: empty.append(i); continue
        ys,xs=np.where(b)
        hs.append(ys.max()-ys.min()+1); areas.append(int(b.sum()))
        feet.append(int(ys.max())); cxs.append(float(xs.mean()))
        edge=max(edge,int(b[0,:].sum()+b[-1,:].sum()+b[:,0].sum()+b[:,-1].sum()))
        lbl,nn=ndimage.label(~b)
        border=set(np.unique(np.concatenate([lbl[0,:],lbl[-1,:],lbl[:,0],lbl[:,-1]])))
        for ci in range(1,nn+1):
            if ci in border: continue
            comp=(lbl==ci); sz=int(comp.sum())
            if sz<=12: continue
            ring=ndimage.binary_dilation(comp,iterations=2)&~comp
            if a[ring].mean()>150: holes+=sz
    if not hs: return None
    return dict(medH=float(np.median(hs)),minH=int(min(hs)),maxH=int(max(hs)),
        f0H=hs[0],f0Feet=feet[0],f0Cx=cxs[0],
        medFeet=float(np.median(feet)),medCx=float(np.median(cxs)),
        edge=edge,holes=holes,empty=empty,
        areaMin=min(areas),areaMed=float(np.median(areas)))

def mask(key,m,idx):
    p=path(key,m); im=np.array(Image.open(p).convert('RGBA'))
    fw,fh,cols,rws=m['fw'],m['fh'],m['cols'],m['rows']
    c=idx%cols; r=(idx//cols) if rws>1 else 0
    if (r+1)*fh>im.shape[0] or (c+1)*fw>im.shape[1]: return None
    a=im[r*fh:(r+1)*fh, c*fw:(c+1)*fw,3]
    ys,xs=np.where(a>60)
    if len(ys)==0: return None
    sub=a[ys.min():ys.max()+1, xs.min():xs.max()+1]
    return np.array(Image.fromarray((sub>60).astype(np.uint8)*255).resize((96,128),Image.BILINEAR)).astype(float)/255.
def corr(a,b):
    a=a-a.mean(); b=b-b.mean(); d=np.sqrt((a*a).sum()*(b*b).sum())
    return float((a*b).sum()/d) if d>0 else 0.

HEROES=['konwu','grosk','vulmar','fritz','aureth','vireo','bloatus','umbris','vael','oakmir','rhukk','sylthaine','tick']
REPORT=[]
def add(sev,unit,what): REPORT.append((sev,unit,what))

for key,ss in UNITS.items():
    isHero = key in HEROES
    # ---- ability wiring ----
    if isHero:
        abils=[('ULT',ULT.get(key)),('GREEN',(GB.get(key) or {}).get('green')),('BLUE',(GB.get(key) or {}).get('blue'))]
        for slot,a in abils:
            if not a: continue
            st=ABIL.get(a)
            if st is None: add('HIGH',key,f"{slot} '{a}' has NO ABIL_ANIM entry -> no cast animation plays")
            elif st not in ss: add('HIGH',key,f"{slot} '{a}' -> state '{st}' DOES NOT EXIST on this unit -> no cast animation plays")
    # ---- core states ----
    for need in (['idle','walk','attack','hit'] if isHero else ['idle','walk','attack']):
        if need not in ss: add('MED',key,f"missing '{need}' state")
    # ---- per state art + timing ----
    A={}
    for st,m in ss.items():
        info=art(key,m); A[st]=info
        if info is None:
            add('HIGH',key,f"{st}: sheet missing/unreadable ({m['u'].split('/')[-1]})"); continue
        dur=m['n']/m['fps']
        if st in ('ult','green','blue','cast') or st in ABIL.values():
            if dur<0.7: add('MED',key,f"{st}: cast clip only {dur:.2f}s ({m['n']}f @ {m['fps']}fps) — reads as a flash")
            if dur>3.2: add('MED',key,f"{st}: cast clip {dur:.2f}s — unit is locked in this pose that long")
        if info['empty']: add('HIGH',key,f"{st}: EMPTY frames {info['empty']}")
        if info['edge']>60: add('MED',key,f"{st}: art touches frame edge ({info['edge']}px) — clipped")
        if info['holes']>600: add('MED',key,f"{st}: {info['holes']}px of interior holes")
        if m['figH']:
            err=abs(info['f0H']-m['figH'])/m['figH']
            if err>0.15: add('HIGH',key,f"{st}: figH={m['figH']} but art measures {info['f0H']:.0f} ({err*100:.0f}% off) -> renders wrong SIZE")
        if m['feet']:
            fe=abs(info['f0Feet']-m['feet'])
            if fe>0.06*m['fh']: add('MED',key,f"{st}: feet={m['feet']} but art bottom is {info['f0Feet']:.0f} -> floats/sinks {fe:.0f}px")
        if m['cx']:
            ce=abs(info['f0Cx']-m['cx'])
            if ce>0.10*m['fw']: add('MED',key,f"{st}: cx={m['cx']} but art centre is {info['f0Cx']:.0f} -> shifts {ce:.0f}px sideways")
        if st in ('idle','walk') and info['maxH']>0 and info['minH']/info['maxH']<0.80:
            add('MED',key,f"{st}: figure height swings {info['minH']}->{info['maxH']}px within the clip (zoom/pump)")
    # ---- cross-state size consistency ----
    hs={st:A[st]['f0H'] for st in A if A[st]}
    figs={st:ss[st]['figH'] for st in A if A[st] and ss[st]['figH']}
    if len(figs)>1:
        ratios={st:hs[st]/figs[st] for st in figs}
        lo,hi=min(ratios.values()),max(ratios.values())
        if hi/lo>1.18:
            worst=max(ratios,key=lambda k:abs(ratios[k]-np.median(list(ratios.values()))))
            add('HIGH',key,f"states render at different SIZES (worst '{worst}'): height/figH ratios {lo:.2f}..{hi:.2f}")
    # ---- facing consistency ----
    ref='idle' if 'idle' in ss else ('walk' if 'walk' in ss else list(ss)[0])
    try:
        R=[x for x in (mask(key,ss[ref],i) for i in range(min(ss[ref]['n'],6))) if x is not None]
        if R:
            R=np.mean(R,axis=0)
            for st,m in ss.items():
                C=[x for x in (mask(key,m,i) for i in range(min(m['n'],6))) if x is not None]
                if not C: continue
                C=np.mean(C,axis=0)
                a,b=corr(C,R),corr(C,R[:,::-1])
                if abs(a-b)<0.06: continue
                want = ss[ref]['flip'] if a>b else (not ss[ref]['flip'])
                if m['flip']!=want:
                    add('HIGH',key,f"{st}: flip={m['flip']} but art is {'mirrored' if b>a else 'same'} vs {ref} -> FACES BACKWARDS")
    except Exception as ex:
        add('LOW',key,f'facing check failed: {ex}')

order={'HIGH':0,'MED':1,'LOW':2}
REPORT.sort(key=lambda r:(order[r[0]], r[1]))
out=[]
out.append('EMBERWEAVE — FULL CHARACTER ANIMATION AUDIT')
out.append('='*78)
out.append(f'{len(UNITS)} units, {sum(len(v) for v in UNITS.values())} animation states checked.')
out.append('Checks: ability->animation wiring, clip timing, facing, declared-vs-measured size,')
out.append('anchoring (feet/centre), interior holes, edge clipping, empty frames.')
out.append('')
cur=None
for sev,unit,what in REPORT:
    if sev!=cur: out.append(''); out.append(f'---- {sev} ----'); cur=sev
    out.append(f'  [{unit}] {what}')
out.append('')
out.append(f'TOTAL: {sum(1 for r in REPORT if r[0]=="HIGH")} high, {sum(1 for r in REPORT if r[0]=="MED")} medium, {sum(1 for r in REPORT if r[0]=="LOW")} low')
open('/home/claude/review/animation-audit.txt','w').write('\n'.join(out))
print('\n'.join(out[:14]))
print('...')
print(f'HIGH={sum(1 for r in REPORT if r[0]=="HIGH")} MED={sum(1 for r in REPORT if r[0]=="MED")}')
