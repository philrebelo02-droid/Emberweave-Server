'use strict';
const assert = require('node:assert/strict');
const SIM = require('../server/sim.js');
const W = require('../server/witches-hut.js');

const t = 1_800_000_000_000;
const s = W.create(1000, t);
assert.equal(s.brew, 1000);
s.brew = 0;
W.settle(s, 1000, t + W.TICK_MS * 5400);
assert.equal(s.brew, 500);
W.settle(s, 1000, t + W.TICK_MS * 10800);
assert.equal(s.brew, 1000);
W.settle(s, 2000, t + W.TICK_MS * 10800);
assert.equal(s.brew, 1000, 'leveling preserves brew instead of filling the larger pot');

const h = W.create(100, t);
h.hp = { strong: 0, weak: 0 };
const healed = W.healAll(h, [{key:'weak',power:500},{key:'strong',power:1000}], 100, t);
assert.equal(healed[0].key, 'strong');
assert.equal(healed[0].after, W.HP_FULL);
assert.equal(healed[1].after, 0, 'strongest takes the remaining brew first');
assert.equal(h.surgeUntil, t + W.SURGE_MS, '80% spend in two hours unlocks surge');
assert.deepEqual(W.applyBattle(h,[{key:'strong',hp:900,maxHp:1000}],['strong']),
  [{key:'strong',before:W.HP_FULL,after:9000}]);
assert.deepEqual(W.applyBattle(h,[{key:'strong',hp:990,maxHp:1000}],['strong']),
  [{key:'strong',before:9000,after:9000}], 'combat healing cannot restore permanent injury');

const p = W.create(100, t);
p.brew = 0;
W.shopRefresh(p,'2026-09-25');
assert.equal(W.shopOffer(p).gems,50);
W.buy(p,'first',100); W.buy(p,'first',100);
assert.equal(W.shopOffer(p).gems,100);
W.buy(p,'second',100); W.buy(p,'second',100);
assert.equal(W.shopOffer(p),null);
W.shopRefresh(p,'2026-09-26');
assert.equal(W.shopOffer(p).gems,50);
const hero=SIM.heroCombatStats('vireo',{level:20});
const partial=SIM.makeLine([hero],[{hp:Math.round(hero.maxHp*0.4),energy:0}],true)[0];
assert.equal(partial.healCap,partial.hp);
const entryHp=partial.hp;
SIM.CORE.applyHeal([],1,'A',partial,partial,hero.maxHp,true);
assert.equal(partial.hp,entryHp,'in-battle healing respects the permanent entry-HP ceiling');
const normal=SIM.makeLine([hero],[{hp:entryHp,energy:0}])[0];
SIM.CORE.applyHeal([],1,'A',normal,normal,hero.maxHp,true);
assert.equal(normal.hp,hero.maxHp,'other battle modes keep their existing healing behavior');
console.log('Witches Hut state rules passed');
