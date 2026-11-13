const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2]||require('node:path').join(__dirname,'..','emberweave-heroes.html'),'utf8');   /* ChatGPT Arena hunt 13 Nov; default = this checkout's page */
const start=html.indexOf('    const oldRank=G.arenaRank; let reward=0;')>=0?html.indexOf('    const oldRank=G.arenaRank; let reward=0;'):html.indexOf('    const oldRank=G.arenaRank, arenaOpponent=');
const end=html.indexOf('        try{ if(d&&typeof d.won',start);
assert(start>=0&&end>start);
const source=html.slice(start,end)+' } });';
async function check(changeAccount){
 let run;
 const calls=[];
 const context={
  G:{arenaRank:100,team:['fixture-hero']},ACC:{token:'session-a'},CUR:{oppId:'first-opponent'},won:true,_arepDef:null,
  saveG(){},updateHubChrome(){},resultLater(fn){run=fn;},uid8:()=> 'same-result',
  async api(_path,_method,body){calls.push([body.oppId,body.requestId]);return calls.length===1?{error:'offline'}:{won:true};},
  setTimeout(fn){context.CUR={oppId:'next-opponent'};if(changeAccount)context.ACC.token='session-b';fn();},
 };
 vm.runInNewContext(source,context);
 await run(1);
 assert.deepEqual(calls,changeAccount?[['first-opponent','same-result']]:[['first-opponent','same-result'],['first-opponent','same-result']]);
}
(async()=>{
 let failures=0;
 for(const changeAccount of [false,true]){
  try{await check(changeAccount);console.log('PASS',changeAccount?'changed session':'changed opponent');}
  catch(e){failures++;console.log('FAIL',changeAccount?'changed session':'changed opponent',e.message);}
 }
 process.exitCode=failures?1:0;
})();
