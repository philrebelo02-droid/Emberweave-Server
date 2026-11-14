#!/usr/bin/env python3
"""Builds talents-fx.js: what each learned talent DOES in a fight, as data for the battle code (page and server run the same file).

Step 1 (14 Nov 2026) covers the plain stat talents only: a talent whose whole tooltip is one of the fixed stat sentences, e.g.
"Vael has 2% more max HP per rank." or "RISK: Vael has 2% more attack and 1% less max HP per rank.". The sentence is read from
talents-data.js (compiled from the approved designs), so a correction to a design file flows through:
    python tools/build_talents.py && python tools/build_talent_fx.py
Anything that is not exactly one of these sentences is left out here and gets its effect in a later step; the script prints how many
talents it covered. Record per hero: { talentId: { stat: fraction per rank, ... } }.
Stats: hp, atk, apow, armor, mr (multiply the finished number), crit (added to crit chance), critDmg (critical hits deal x more),
aspd (attack speed), heal (healing power), shield (shield strength).
"""
import io, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = io.open(os.path.join(ROOT, "talents-data.js"), encoding="utf-8").read()
data = json.loads(src[src.index("return {") + 7: src.rindex(";});")])

STAT = {"max hp": ["hp"], "max health": ["hp"], "attack": ["atk"], "ability power": ["apow"], "armor": ["armor"], "magic resist": ["mr"],
        "armor and magic resist": ["armor", "mr"], "attack and ability power": ["atk", "apow"], "critical chance": ["crit"], "crit chance": ["crit"], "attack speed": ["aspd"],
        "healing power": ["heal"]}
S = "(" + "|".join(sorted((re.escape(k) for k in STAT), key=len, reverse=True)) + ")"
NUM = r"(\d+(?:\.\d+)?)%"
WHO = r"[A-Z][A-Za-z' -]*?"
P_MAIN = re.compile(r"^(?:RISK: )?" + WHO + r" (?:has|gains) " + NUM + r" (?:more )?" + S + r"(?: and " + NUM + r" (more|less) " + S + r")? per rank\.$", re.I)
P_CRITD = re.compile(r"^" + WHO + r"'s critical hits deal " + NUM + r" more damage per rank\.$")
P_HEAL = re.compile(r"^" + WHO + r"'s (shields and )?heals are " + NUM + r" stronger per rank\.$")


def parse(text):
    m = P_MAIN.match(text)
    if m:
        out = {}
        for k in STAT[m.group(2).lower()]:
            out[k] = float(m.group(1)) / 100
        if m.group(3):
            sign = -1 if m.group(4).lower() == "less" else 1
            for k in STAT[m.group(5).lower()]:
                if k in out:
                    return None
                out[k] = sign * float(m.group(3)) / 100
        return out
    m = P_CRITD.match(text)
    if m:
        return {"critDmg": float(m.group(1)) / 100}
    m = P_HEAL.match(text)
    if m:
        out = {"heal": float(m.group(2)) / 100}
        if m.group(1):
            out["shield"] = float(m.group(2)) / 100
        return out
    return None


fx, n, total = {}, 0, 0
for hero, h in data["heroes"].items():
    for tr in h["trees"]:
        for t in tr["talents"]:
            total += 1
            r = parse(t[5])
            if r:
                fx.setdefault(hero, {})[t[0]] = r; n += 1
body = json.dumps({"v": data.get("v", 0), "stats": fx}, separators=(",", ":"), sort_keys=True)
js = r'''/* Talents in a fight: shared by the page and the server's battle host (it runs this same file). No rendering, no RNG.
   DATA is built by tools/build_talent_fx.py from talents-data.js - do not edit it by hand.
   Phil 14 Nov 2026: "they are only activated when someone clicks learn talent" - nothing here runs for a hero with no learned talents:
   the callers skip an empty list, so such a hero is built by exactly the code that built it before talents existed.
   list = TALENTS.learned(hero, build) = [[talentId, rank], ...] sorted by id. */
(function(root,factory){const v=factory();if(typeof module==='object'&&module.exports)module.exports=v;if(root)root.TalentFx=v;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DATA=__DATA__;
  /* total of each stat for a learned list: { hp: 0.10, atk: 0.04, ... } (fraction; negative = a RISK talent's cost). Unknown ids and
     ids with no stat part add nothing, so a list saved under older data never throws. */
  function totals(hero,list){ const S=DATA.stats[hero], out={}; if(!S||!list) return out;
    for(const e of list){ const f=S[e[0]], r=e[1]|0; if(!f||r<1) continue; for(const k in f) out[k]=(out[k]||0)+f[k]*r; }
    return out; }
  /* The stat talents on a finished real-engine unit (called once, at the end of makeUnit). "N% more" multiplies the finished number;
     crit chance is added (the engine's 60% cap stays); critical damage multiplies the whole critical hit. */
  function applyStats(u,hero,list){ const T=totals(hero,list);
    if(T.hp){ const k=Math.max(0.05,1+T.hp); u.maxHp*=k; u.hp=u.maxHp; }
    if(T.atk) u.dmg*=Math.max(0.05,1+T.atk);
    if(T.apow) u.apow=(u.apow||0)*Math.max(0.05,1+T.apow);
    if(T.armor) u.armorRating=(u.armorRating||0)*Math.max(0,1+T.armor);
    if(T.mr) u.mrRating=(u.mrRating||0)*Math.max(0,1+T.mr);
    if(T.crit) u.glyphCrit=Math.max(0,Math.min(0.6,(u.glyphCrit||0)+T.crit));
    if(T.critDmg) u.critDmg=(1+(u.critDmg||0.6))*Math.max(0.05,1+T.critDmg)-1;
    if(T.aspd) u.atkInterval=u.atkInterval/Math.max(0.05,1+T.aspd);
    if(T.heal) u.healPowMul=(u.healPowMul||1)*Math.max(0.05,1+T.heal);
    if(T.shield) u.shieldStrMul=(u.shieldStrMul||1)*Math.max(0.05,1+T.shield);
    return T; }
  const has=(hero,id)=>!!(DATA.stats[hero]&&DATA.stats[hero][id]);
  return Object.freeze({v:DATA.v,totals,applyStats,has});
});
'''.replace("__DATA__", body)
io.open(os.path.join(ROOT, "talents-fx.js"), "w", encoding="utf-8", newline="\n").write(js)
print("talents-fx.js: %d of %d talents are plain stat talents (%d heroes), %d KB" % (n, total, len(fx), len(js) // 1024))
if "--list-near" in sys.argv:
    for hero, h in data["heroes"].items():
        for tr in h["trees"]:
            for t in tr["talents"]:
                if not parse(t[5]) and re.match(r"^(?:RISK: )?" + WHO + r" (has|gains) \d", t[5]) and len(t[5]) < 90:
                    print("  not covered:", hero, t[0], "|", t[5])
