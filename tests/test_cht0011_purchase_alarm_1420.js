// v1420 CHT-0011 (Phil 18 Nov "fix all of these"): a diamond pack bought through /api/shop/purchase (credited as 'purchase:<offer>' by
// creditGems) tripped the 2000-diamonds-per-60 s spike alarm - a false cheat case for a paying player. A verified purchase is now logged
// (gainLog / gemLog) but never counts toward the spike window or the day alarm; only the server's purchase path credits that reason and no
// client earn rule (EARN_RULES) can name it. The shop route needs a store receipt (packs are "coming soon" on a test server), so this
// runs server.js's own resourceGain in a sandbox with its real constants.
// CONTROL: 3000 diamonds from a non-purchase source in the same minute still file a window case, and its total excludes the purchase.
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
let pass=0; const ok=(c,m)=>{ assert(c,m); pass++; console.log('  ok   '+m); };
const grab=(re)=>{ const m=src.match(re); assert(m,'not found: '+re); return m[0]; };
const fn=name=>{ const a=src.indexOf('function '+name+'('); assert(a>=0,'no function '+name); let d=0,b=src.indexOf('{',a); for(;b<src.length;b++){ if(src[b]==='{')d++; else if(src[b]==='}'&&--d===0) break; } return src.slice(a,b+1); };
const consts=[/const SPIKE_MS\s*=[^;]+;/, /const GEM_LOG_KEEP\s*=[^;]+;/, /const RESOURCE_LOG_KEEP\s*=[^;]+;/, /const RESOURCE_ALARMS\s*=\s*Object\.freeze\(\{[\s\S]*?\}\);/, /const RESOURCE_WINDOW_EXEMPT\s*=[^\n]+/].map(grab).join('\n');
const code=consts+'\n'+fn('resourceGain')+'\nreturn {resourceGain,RESOURCE_ALARMS,SPIKE_MS};';
function sandbox(){ const DB={feedback:[]}; const reports=[];
  const env={ worldPlanningDB:()=>DB, nyDayKey:t=>new Date(t).toISOString().slice(0,10), uid:()=>Math.random().toString(36).slice(2),
    feedbackAppend:x=>DB.feedback.push(x), devReport:(u,k,n,t)=>reports.push({k,n,t}), writeDB:()=>{} };
  const api=Function(...Object.keys(env),code)(...Object.values(env)); return {api,DB,reports}; }
// 1) a 12,500-diamond purchase: logged, no case
{ const {api,DB,reports}=sandbox(); const u={id:'p1',name:'Payer'};
  ok(api.RESOURCE_ALARMS.gems.window<12500, 'the spike window is below one big pack ('+api.RESOURCE_ALARMS.gems.window+' < 12500)');
  api.resourceGain(u,'gems',12500,'purchase:d12500');
  ok(u.gainLog.length===1&&u.gainLog[0].r==='purchase:d12500'&&u.gemLog.length===1, 'the purchase is logged for the audits (gainLog + gemLog)');
  ok(DB.feedback.length===0&&reports.length===0, 'a 12,500-diamond purchase raises NO cheat case and no gem-spike report ('+DB.feedback.map(f=>f.text)+')');
  api.resourceGain(u,'gems',12500,'purchase:d12500');
  ok(DB.feedback.length===0, 'two big packs in a minute (25,000, over the day limit too) still raise no case');
  // CONTROL: a non-purchase spike in the same minute still files a window case - and its total leaves the purchases out
  api.resourceGain(u,'gems',3000,'mail');
  const c=DB.feedback.filter(f=>f.kind==='cheat'&&f.resource==='gems'&&f.scope==='window');
  ok(c.length===1, 'CONTROL: 3000 diamonds from mail in the same minute still file the window case ('+c.length+')');
  ok(c[0]&&c[0].amount===3000, 'CONTROL: the case counts only the 3000 non-purchase diamonds ('+(c[0]&&c[0].text)+')');
}
// 2) the reason is server-only: no client earn rule can claim 'purchase:'
{ const i=src.indexOf('const EARN_RULES'); let d=0,j=src.indexOf('{',i); for(;j<src.length;j++){ if(src[j]==='{')d++; else if(src[j]==='}'&&--d===0) break; }
  const rules=src.slice(i,j+1).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  ok(!/purchase/i.test(rules), 'no EARN_RULES key names a purchase (comments stripped) - a client cannot tag its own gain as a purchase');
  ok(/creditGems\(me,led,offer\.amount,'purchase:'\+offer\.id\)/.test(src), "the shop purchase path is what credits 'purchase:<offer>'");
}
console.log('test_cht0011_purchase_alarm_1420.js: '+pass+' checks passed');
