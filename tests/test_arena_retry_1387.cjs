const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2]||require('node:path').join(__dirname,'..','emberweave-heroes.html'),'utf8');   /* ChatGPT Arena hunt 13 Nov; default = this checkout's page */
const start=html.indexOf('    const oldRank=G.arenaRank; let reward=0;')>=0?html.indexOf('    const oldRank=G.arenaRank; let reward=0;'):html.indexOf('    const oldRank=G.arenaRank, arenaOpponent=');
const end=html.indexOf('        try{ if(d&&typeof d.won',start);
assert(start>=0&&end>start);
const source=html.slice(start,end)+' } });';
/* REAL_ENGINE_ARENA (branch talents-real-engine): the slice reads `_real`, a const of the enclosing
   `if(CUR.mode==='arena'){ const _real=CUR.arenaReal||null; ...` block that the slice does not include.
   The harness supplies it: null = a line-model fight (the retry this test is about), an object = the
   server's real fight already paid by arenaRealStart (the result path must not post again). */
async function check(changeAccount,real){
 let run;
 const calls=[];
 const context={
  G:{arenaRank:100,team:['fixture-hero']},ACC:{token:'session-a'},CUR:{oppId:'first-opponent'},won:true,_arepDef:null,_real:real||null,
  saveG(){},updateHubChrome(){},resultLater(fn){run=fn;},uid8:()=> 'same-result',
  async api(_path,_method,body){calls.push([body.oppId,body.requestId]);return calls.length===1?{error:'offline'}:{won:true};},
  setTimeout(fn){context.CUR={oppId:'next-opponent'};if(changeAccount)context.ACC.token='session-b';fn();},
 };
 vm.runInNewContext(source,context);
 await run(1);
 if(real){ assert.deepEqual(calls,[]); return; }   /* the real fight's reply is used as is: no second post */
 assert.deepEqual(calls,changeAccount?[['first-opponent','same-result']]:[['first-opponent','same-result'],['first-opponent','same-result']]);
}
(async()=>{
 let failures=0;
 const cases=[[false,null,'changed opponent'],[true,null,'changed session']];
 if(html.includes('CUR.arenaReal')) cases.push(   /* a page with the real-engine Arena path */[false,{won:true,rank:90},'real-engine reply is not re-posted']);
 for(const [changeAccount,real,name] of cases){
  try{await check(changeAccount,real);console.log('PASS',name);}
  catch(e){failures++;console.log('FAIL',name,e.message);}
 }
 process.exitCode=failures?1:0;
})();
