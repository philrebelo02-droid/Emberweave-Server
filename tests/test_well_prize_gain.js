// A Well prize must use the shared ledger caps and observer, not the retired 2M diamond cap.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','server','starless-well.js'),'utf8');
const start=src.indexOf('function payPrize('),end=src.indexOf('function endXP(',start);
assert(start>=0&&end>start,'Well prize source found');
const context=vm.createContext({});
vm.runInContext(src.slice(start,end),context);
const credited=[];
const led={gold:1500000000,gems:3000000,xpPotions:{}};
const user={id:'well-player'};
const ctx={me:user,led,
  creditGold:(u,l,n,reason)=>{assert.strictEqual(u,user);l.gold=Math.min(2000000000,l.gold+n);credited.push(['gold',n,reason]);},
  creditGems:(u,l,n,reason)=>{assert.strictEqual(u,user);l.gems=Math.min(5000000,l.gems+n);credited.push(['gems',n,reason]);},
  ledTx:()=>{}};
const well={cleared:{normal:0},run:{path:'normal',prizes:[]}};
const result=context.payPrize(ctx,well,{gold:800,gems:15,potions:0},'test');
assert.strictEqual(led.gold,1500000800,'gold above the retired cap is not rolled back');
assert.strictEqual(led.gems,3000015,'diamonds above 2M are not rolled back');
assert.strictEqual(result.gems,15);
assert.strictEqual(credited.length,2,'both grants use the shared observer-cap path');
console.log('well prize gain: pass');
