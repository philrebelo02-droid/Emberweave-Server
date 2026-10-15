const {load,spec}=require('./lib.js'); const L=load();
const P=JSON.parse(process.argv[2]); const N=+(process.argv[3]||24); const mode=process.argv[4]||'5v5';
const mates=['grosk','vael','sylthaine','vireo'];
const others=(process.argv[5]||'konwu,vulmar,aureth,hurne,veyr,kharos').split(',');
const H=process.argv[6]||'hollow';
const mk=k=>L.host.snapFromSpecs((mode==='1v1'?[k]:[k,...mates]).map(z=>spec(z,P)));
const lines=[];
for(const y of others){ let hw=0,yw=0,dr=0, hd=0, yd=0;
  for(let i=0;i<N;i++){ const seed=(0x85ebca6b*(i+1))>>>0;
    for(const side of [0,1]){ const A=side?mk(y):mk(H), B=side?mk(H):mk(y); L.reset();
      const r=L.host.auto(A,B,seed); const rows=L.report().rows;
      const dA=rows.filter(q=>q.team==='ally'&&q.key===(side?y:H)), dB=rows.filter(q=>q.team==='enemy'&&q.key===(side?H:y));
      const sum=a=>a.reduce((s,q)=>s+Object.values(q.dmg).reduce((p,v)=>p+v,0),0);
      if(side){ hd+=sum(dB); yd+=sum(dA);} else { hd+=sum(dA); yd+=sum(dB);} 
      // timeout -> 'won' false for ally: count as loss for ally side; detect draw via alive counts unavailable -> treat as given
      const allyWon=r.won; if(side){ if(allyWon) yw++; else hw++; } else { if(allyWon) hw++; else yw++; } } }
  const line=`${H} vs ${y.padEnd(7)} ${H} wins ${(100*hw/(2*N)).toFixed(0)}%  | ${H} slot dmg/fight ${Math.round(hd/(2*N))} vs ${y} ${Math.round(yd/(2*N))}`;
  console.log(line); }
