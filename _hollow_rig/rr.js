const {load,spec}=require('./lib.js'); const L=load();
const P=JSON.parse(process.argv[2]); const N=+(process.argv[3]||12); const mode=process.argv[4]||'5v5';
const H=(process.argv[5]||'hollow,konwu,vulmar,aureth,hurne,veyr,kharos').split(',');
const mates=['grosk','vael','sylthaine','vireo'];
const mk=k=>L.host.snapFromSpecs((mode==='1v1'?[k]:[k,...mates]).map(z=>spec(z,P)));
const W={}; H.forEach(a=>{W[a]={w:0,n:0};});
for(let a=0;a<H.length;a++) for(let b=a+1;b<H.length;b++){ const x=H[a],y=H[b]; let xw=0;
  for(let i=0;i<N;i++){ const seed=(0x27d4eb2f*(i+3))>>>0;
    if(L.host.auto(mk(x),mk(y),seed).won) xw++;
    if(!L.host.auto(mk(y),mk(x),seed).won) xw++; }
  W[x].w+=xw; W[x].n+=2*N; W[y].w+=2*N-xw; W[y].n+=2*N;
  console.log(x,'vs',y,(100*xw/(2*N)).toFixed(0)+'%'); }
console.log('OVERALL', H.map(k=>k+' '+(100*W[k].w/W[k].n).toFixed(0)+'%').join(' | '));
