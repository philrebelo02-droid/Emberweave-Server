'use strict';
const fs=require('node:fs'),RealDate=Date,rename=fs.renameSync;let clock=Number(process.env.FIXTURE_NOW),fail=false;
global.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}};
fs.renameSync=function(from,to){if(fail&&to===process.env.DB_FILE)throw Error('fixture DB rename failure');return rename.apply(this,arguments);};
process.on('message',m=>{if(m&&Number.isSafeInteger(m.now)){clock=m.now;fail=m.fail===true;process.send?.({now:clock});}});
