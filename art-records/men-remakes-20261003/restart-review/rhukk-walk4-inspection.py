"""Read-only source decode: measurements, not performance approval or a cut."""
import hashlib, json, subprocess
from pathlib import Path
import numpy as np
base=Path('C:/Users/Home/OneDrive/Desktop/Emberweave Archive/Game Art/Heroes/Rhukk/clips/HAILUO MEN 03OCT2026')
names=['Rhukk - RESTART walk v4 ChatGPT prompt (Hailuo card 562896470202691593).mp4','Rhukk - idle - PHIL APPROVED 03OCT2026 (Hailuo card 562893140348960772).mp4']
rows=[]
for name in names:
 p=base/name
 meta=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_frames,duration','-of','json',str(p)]))['streams'][0]
 w,h=meta['width'],meta['height']
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','rawvideo','-pix_fmt','rgb24','-'])
 frames=np.frombuffer(raw,np.uint8).reshape(-1,h,w,3)
 masks=[];bad=[];corners=[];areas=[]
 for k,a in enumerate(frames):
  r,g,b=[a[:,:,c].astype(np.int16) for c in range(3)]
  solid=~((g>90)&(g-r>40)&(g-b>40))
  if np.concatenate([solid[:3].ravel(),solid[-3:].ravel(),solid[:,:3].ravel(),solid[:,-3:].ravel()]).any():bad.append(k)
  corners.extend([a[0,0].tolist(),a[0,-1].tolist(),a[-1,0].tolist(),a[-1,-1].tolist()])
  areas.append(int(solid.sum()));masks.append(solid)
 first,last=masks[0],masks[-1];cs=np.array(corners)
 rows.append(dict(file=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),metadata=meta,decodedFrames=len(frames),nonKey3pxBorderFrames=bad,cornerRGBMin=cs.min(0).tolist(),cornerRGBMax=cs.max(0).tolist(),silhouetteAreaMin=min(areas),silhouetteAreaMax=max(areas),endIoU=float((first&last).sum()/(first|last).sum()),scope='Border/key/identity/endpoint measurements only. No scale defect inferred from moving limbs; idle is an approved technical reference, not a walk performance control. No full-motion or game timing/anchor approval.'))
out=Path(__file__).with_suffix('.evidence.json')
out.write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(json.dumps(rows,indent=2))
