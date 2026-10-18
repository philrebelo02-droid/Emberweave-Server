'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),h=require('../server/sim-host.js').load(path.join(root,'emberweave-heroes.html')),run=s=>vm.runInContext(s,h.ctx);
const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/spell_fx_18oct.json'),'utf8'));let pass=0,fail=0;
const ck=(s,ok)=>{console.log((ok?'ok ':'FAIL ')+s);ok?pass++:fail++;};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
ck('all seven approved Grok effects are represented',rows.length===7&&new Set(rows.map(r=>r.key)).size===7);
for(const r of rows){const d=run(`JSON.parse(JSON.stringify(FX2_DEF.${r.key}))`),v=run(`JSON.parse(JSON.stringify(FX16_ART.${Object.keys(run('FX16_ART')).find(k=>run(`FX16_ART.${k}.k`)==r.key)}))`);
 const file=path.join(root,d.u.split('?')[0]),bytes=fs.readFileSync(file),w=1+bytes.readUIntLE(24,3),height=1+bytes.readUIntLE(27,3);
 ck(r.key+' new q95 alpha sheet matches receipt and phone grid',sha(bytes)===r.sha256&&w===d.fw*d.cols&&height===d.fh*d.rows&&Math.max(w,height)<=2048&&bytes.length<4e6&&d.upExtent>0&&d.upExtent<=1);
 ck(r.key+' full length at real speed, with first and last source frames',Math.abs(d.n/d.fps2-r.sourceFrameCount/r.sourceFps)<1e-9&&r.sourceFrames[0]===0&&r.sourceFrames.at(-1)===r.sourceFrameCount-1);
 ck(r.key+' approved source receipt',/^[a-f0-9]{64}$/.test(r.sourceSha256)&&(!fs.existsSync(r.source)||sha(fs.readFileSync(r.source))===r.sourceSha256));
 ck(r.key+' routes once through the expected display plane',v.once===true&&v.mode===r.view.mode&&d.spawn>=0);
}
ck('Joss ground FX are flat at their exact radius; Aureth keeps upright radius-sized art',run('FX16_ART.jhammer.mode===\'plate\'&&FX16_ART.jhammer.R===3&&FX16_ART.jhammer.atTarget&&FX16_ART.jdaybreak.R===6&&FX16_ART.asunburst.mode===\'ring\'&&FX16_ART.aeclipse.mode===\'ring\'&&FX16_ART.asunburst.R===2.8*METER&&FX16_ART.aeclipse.R===6*METER'));
ck('Joss Sanctuary Guard (Phil 18 Oct: Reduce its size by 2x and keep it behind heroes): half its size (size 1, was 2) and drawn behind the units (renderOrder -2 < 0) through fx16Show',run(`FX2_DEF.joss_blue.size===1&&FX2_DEF.joss_blue.ro===-2&&FX16_ART.jguard.ro===-2`)&&run(`(()=>{ let ro=null; const sv=_fx22Spr; _fx22Spr=(k,r)=>{ ro=r; return {}; }; try{ const u=makeUnit('joss','ally',400,700,30,{owned:false}); fx16Show({vk:'jguard',u,d:FX2_DEF.joss_blue}); } finally{ _fx22Spr=sv; } return ro; })()`)<0);
ck('CONTROL: the receipt still records the approved size 2 (the halving is the Phil-approved display scale, not a re-cut)',rows.find(r=>r.key==='joss_blue')&&JSON.stringify(rows.find(r=>r.key==='joss_blue')).indexOf('"size":2')>=0);
ck('body animations stay separate from effect assets',rows.every(r=>run(`JSON.stringify(BATTLE_ANIM.${r.key.split('_')[0]}||{})`).indexOf(r.meta.u)<0));
ck('Aureth Eclipse phase limitation is explicit (source impact later than body release)',rows.find(r=>r.key==='aureth_ult').phaseNote.includes('2.5 s')&&run('FX2_DEF.aureth_ult.spawn')===0);
const source=fs.readFileSync(path.join(root,'emberweave-heroes.html'),'utf8');let bad=[];for(const m of source.matchAll(/<script>([\s\S]*?)<\/script>/g))try{new vm.Script(m[1]);}catch(e){bad.push(e.message);}
ck('all inline scripts parse after display hooks',bad.length===0);
console.log((fail?'FAIL ':'PASS ')+pass+' checks, '+fail+' failed');process.exit(fail?1:0);
