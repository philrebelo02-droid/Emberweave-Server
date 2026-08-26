#!/usr/bin/env python3
"""AUDIT (26 Aug): the explicit balance simulation — prints Temper 0->30 dust cost per quality and
expected Vault dust income, so the economy decision is visible instead of implicit.
Mirrors server.js exactly: temper cost bar/growth from gear-catalog meta; dust income from
dustForDungeonFloor. Run: python3 scripts/balance_report.py [path/to/gear-catalog.json]"""
import json, math, sys, os
cat=json.load(open(sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(__file__),'..','server','gear-catalog.json')))
T=cat['meta']['temper']
def temper_cost(q):
    dust=0; presses=0; cost=T['baseDust'][q]; bar=T['startBar']
    for lvl in range(T['max']):
        for _ in range(bar): dust+=cost; presses+=1
        cost=math.ceil(cost*(1+T['dustGrowth'])); bar+=T['barGrowth']
    return dust,presses
DUST_F1, DUST_G = 30, 0.065   # server.js DUNGEON_TUNE.dustFloor1 / dustGrowthPerFloor — keep in sync
def dust_for_floor(f):  # server.js dustForDungeonFloor, exactly
    return int(DUST_F1*(1+DUST_G)**(f-1))
print('== TEMPER 0->30 COST PER QUALITY ==')
tot9=0
for q in cat['meta']['qualities']:
    d,p=temper_cost(q); print(f'  {q:<9} {d:>10,} dust  ({p} presses)')
print('== VAULT DUST INCOME ==')
for cap in (25,50,75,100):
    day=2*sum(dust_for_floor(f) for f in range(1,cap+1))
    print(f'  floor cap {cap:>3}: {day:>8,} dust/day (2 sweeps)   {7*day:>9,}/week')
day100=2*sum(dust_for_floor(f) for f in range(1,101))
oc,_=temper_cost('Orange')
print(f'== PACING == one Orange T30 = {oc/day100:.1f} days of perfect floor-100 sweeps; 9 items across all tiers = {sum(temper_cost(q)[0] for q in cat["meta"]["qualities"])/day100:.0f} days')
