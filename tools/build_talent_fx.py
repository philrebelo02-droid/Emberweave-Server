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

Step 2 (14 Nov 2026) adds the MECHANICS: everything a talent does that is not a plain stat. They are hand-authored, never parsed from prose:
    talents-mech/_engine.js   the runtime (hooks + generic primitives), copied in as it stands
    talents-mech/<hero>.js    one file per wired hero: rows of data on those primitives (module.exports = {...}), copied in as it stands
This script also writes, for each wired hero, which tree every talent id belongs to (from talents-data.js), so a fight can count the points
spent per tree (the "AT 91 POINTS in <tree>" lines) from the learned list alone. talents-fx.js is GENERATED: edit the sources, run this.
Design: WIRING/03 - MECHANICS LAYER (hooks, primitives, how to add a hero).md
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
MDIR = os.path.join(ROOT, "talents-mech")
CRLF, LF = chr(13) + chr(10), chr(10)
engine = io.open(os.path.join(MDIR, "_engine.js"), encoding="utf-8").read().replace(CRLF, LF)
mech_heroes = sorted(f[:-3] for f in os.listdir(MDIR) if f.endswith(".js") and not f.startswith("_"))
trees, mech_src, rowed = {}, [], {}
for hero in mech_heroes:
    if hero not in data["heroes"]:
        sys.exit("talents-mech/%s.js: no such hero in talents-data.js" % hero)
    h = data["heroes"][hero]
    trees[hero] = {"ids": [tr["id"] for tr in h["trees"]], "of": {t[0]: i for i, tr in enumerate(h["trees"]) for t in tr["talents"]}}
    text = io.open(os.path.join(MDIR, hero + ".js"), encoding="utf-8").read().replace(CRLF, LF)
    rowed[hero] = sorted(set(re.findall(r"^ {4}([a-z]+_[a-z0-9]+(?:_[0-9]+)?): *\[", text, re.M)))
    for tid in sorted(set(re.findall(r"^ {4}([a-z]+_[a-z0-9]+(?:_[0-9]+)?): *\[", text, re.M))):   # the row lists of `talents:`
        if tid not in trees[hero]["of"]:
            sys.exit("talents-mech/%s.js: talent id %s is not in talents-data.js" % (hero, tid))
    mech_src.append("  MECH[%s]=(function(){const module={exports:{}};%s%s%sreturn module.exports;})();%s" % (json.dumps(hero), LF, text, LF, LF))
# A talent with hand-authored rows is not a plain stat, even when its sentence matches a stat pattern ("Counter-Cut's counter-cut has 4% more
# critical chance per rank." is about one strike, not about the hero): the rows are the talent's whole effect, so a talent is never counted twice.
for hero, ids in rowed.items():
    for tid in ids:
        if fx.get(hero, {}).pop(tid, None) is not None:
            n -= 1
body = json.dumps({"v": data.get("v", 0), "stats": fx}, separators=(",", ":"), sort_keys=True)
mech_block = "  const TREES=" + json.dumps(trees, separators=(",", ":"), sort_keys=True) + ";" + LF + "  const MECH={};" + LF + "".join(mech_src) + engine
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
  /* The same stat talents on a LINE-MODEL unit (server/combat-core.js buildUnit, built by server.js snapshotHeroFromServer: Arena, Skyfall,
     the Trial, NPC castles, and the unit the server prices the power number from). Same fractions, the line model's field names:
       hp      -> maxHp   (whole points, as the core rounds them; the line starts every fight at maxHp and shieldPool at 0, so nothing else is derived)
       atk     -> atkP    (whole points)
       apow    -> atkM    (whole points) and `heal`, the healer's heal number, which the core derives from ability power
       armor   -> armor,  mr -> mr   (finished ratings, as the client's armorRating / mrRating)
       crit    -> crit    (a FRACTION here, added; the core's 60% cap stays)
       critDmg -> critDmg (the bonus fraction, 0.6 = +60%): the whole critical hit x(1+n), as applyStats
       aspd    -> speed   (attacks per swing timer, the inverse of the client's atkInterval; `haste` is energy gain, not attack speed)
       heal    -> healPow (a fraction the core applies as x(1+healPow)): x(1+n) on the whole multiplier, as the client's healPowMul
       shield  -> shieldStr (a multiplier)
     Not called with an empty list. The caller refreshes the unit's legacy aliases (atk, dr) afterwards. */
  function applyCore(u,hero,list){ if(!u) return u; const T=totals(hero,list);
    if(T.hp) u.maxHp=Math.round(u.maxHp*Math.max(0.05,1+T.hp));
    if(T.atk) u.atkP=Math.round((u.atkP||0)*Math.max(0.05,1+T.atk));
    if(T.apow){ const k=Math.max(0.05,1+T.apow); u.atkM=Math.round((u.atkM||0)*k); if(u.heal) u.heal=Math.round(u.heal*k); }
    if(T.armor) u.armor=(u.armor||0)*Math.max(0,1+T.armor);
    if(T.mr) u.mr=(u.mr||0)*Math.max(0,1+T.mr);
    if(T.crit) u.crit=Math.max(0,Math.min(0.6,(u.crit||0)+T.crit));
    if(T.critDmg) u.critDmg=(1+(u.critDmg||0.6))*Math.max(0.05,1+T.critDmg)-1;
    if(T.aspd) u.speed=(u.speed||1)*Math.max(0.05,1+T.aspd);
    if(T.heal) u.healPow=(1+(u.healPow||0))*Math.max(0.05,1+T.heal)-1;
    if(T.shield) u.shieldStr=(u.shieldStr||1)*Math.max(0.05,1+T.shield);
    return u; }
  const has=(hero,id)=>!!(DATA.stats[hero]&&DATA.stats[hero][id]);
__MECH__
  return Object.freeze(Object.assign({v:DATA.v,totals,applyStats,applyCore,has},RUNTIME));
});
'''.replace("__DATA__", body).replace("__MECH__", mech_block)
io.open(os.path.join(ROOT, "talents-fx.js"), "w", encoding="utf-8", newline="\n").write(js)
print("talents-fx.js: %d of %d talents are plain stat talents (%d heroes), %d KB" % (n, total, len(fx), len(js) // 1024))
print("talents-fx.js: mechanics for %s" % (", ".join(mech_heroes) or "no hero yet"))
if "--list-near" in sys.argv:
    for hero, h in data["heroes"].items():
        for tr in h["trees"]:
            for t in tr["talents"]:
                if not parse(t[5]) and re.match(r"^(?:RISK: )?" + WHO + r" (has|gains) \d", t[5]) and len(t[5]) < 90:
                    print("  not covered:", hero, t[0], "|", t[5])
