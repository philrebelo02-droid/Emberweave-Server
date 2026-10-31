'use strict';
// v1232 test clock (tests/test_terms_1232.js): preloaded with node -r. Date.now() / new Date() = real time + an offset read from
// CLOCK_OFFSET_FILE (milliseconds), re-read every 50 ms, so a test moves the server's clock 7 days ahead without waiting. Timers are real.
const fs=require('fs'), RealDate=Date, file=process.env.CLOCK_OFFSET_FILE;
let off=0; const read=()=>{ try{ const v=Number(fs.readFileSync(file,'utf8')); if(Number.isFinite(v)) off=v; }catch(_){} };
if(file){ read(); const t=setInterval(read,50); if(t.unref) t.unref(); }
global.Date=class extends RealDate{ constructor(...a){ super(...(a.length?a:[RealDate.now()+off])); } static now(){ return RealDate.now()+off; } };
