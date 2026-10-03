'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),Module=require('node:module'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root='C:/Users/Home/Downloads/ew-audit',file=path.join(root,'server/world-mines.js'),src=fs.readFileSync(file,'utf8'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const baseline=cp.execFileSync('git',['show','ac18b951^:server/world-mines.js'],{cwd:root}).toString();
function load(code){const m=new Module(file);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(code,file);return m.exports;}
const current=load(src),parent=load(baseline),rows=[];
for(const ep of [30000,62183,62184,62185,62189,62190,62199,62250]){const c=current.field(ep),p=parent.field(ep);assert.equal(c.length,p.length);if(ep<62184)assert.deepEqual(c,p,'legacy full field unchanged');
for(let i=0;i<c.length;i++){const a=c[i],b=p[i];for(const k of ['id','res','gx','gy','x','y','region'])assert.equal(a[k],b[k],k);if(ep>=62184){if(a.region.startsWith('wild'))assert(a.level>=7&&a.level<=10);else assert(a.level>=1&&a.level<=6);assert.equal(b.level===4,a.level===6);assert.equal(b.level===5,a.level===7);}}
rows.push({epoch:ep,nodes:c.length,levels:[...new Set(c.map(x=>x.level))].sort((a,b)=>a-b),legacyUnchanged:ep<62184,identityResourcePositionsUnchanged:true});}
assert(parent.field(62189).some(n=>n.region.startsWith('wild')&&n.level<7),'independent prior module naturally violates new wild range');
const result={atET:new Date().toLocaleString('sv-SE',{timeZone:'America/New_York'}),sourceSHA256:sha(src),baselineSHA256:sha(baseline),rows,limits:'Independent source-level multi-epoch field qualification against actual preceding Git module, not live march/combat/reward yield/balance or deployment approval.'};fs.writeFileSync(path.join(__dirname,'mine-independent-release-review.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
