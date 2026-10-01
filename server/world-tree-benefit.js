'use strict';
// Pure server clock contract. Claude15:06:08 approved frozen-per-line benefits.
const PERIOD=30000;
function settle(snaps,cursor,from,to,eligible){
  if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<from||typeof eligible!=='boolean'||!Array.isArray(snaps))throw Error('Invalid benefit clock');
  const next=snaps.map(x=>({...x}));
  if(next.some(x=>!Number.isFinite(x.hp)||!Number.isFinite(x.maxHp)||x.maxHp<=0||x.hp<0||x.hp>x.maxHp))throw Error('Invalid benefit HP');
  if(!eligible)return {snaps:next,cursor:null,ticks:0};
  const last=cursor===null||cursor===undefined?from:cursor;
  if(!Number.isSafeInteger(last)||last<from||last>to)throw Error('Invalid benefit cursor');
  const ticks=Math.floor((to-last)/PERIOD);
  for(const x of next)if(x.hp>0){x.hp=Math.min(x.maxHp,x.hp+ticks*x.maxHp*.01);x.worldEntryHpCap=x.hp;}
  return {snaps:next,cursor:last+ticks*PERIOD,ticks};
}
function eligible(control,march){return !!control&&!!march&&march.siteId!=='tree'&&march.phase==='garrison'&&
  !!march.guildId&&control.sites.tree.holderGuildId===march.guildId;}
module.exports={PERIOD,settle,eligible};
