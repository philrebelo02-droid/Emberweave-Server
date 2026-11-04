/* Canonical Emberweave hero profiles — one authored source shared by browser and server.
   Class, row, damage, scaling, glyph path and equipment path must never be inferred elsewhere.
   Combat rule: Tanks establish the 1 m baseline; every non-Tank has at least 3.5 m reach. */
(function(root,factory){
  const value=factory(root);
  if(typeof module==='object'&&module.exports) module.exports=value;
  if(root) root.HERO_PROFILES=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const P={
  "grimsby": {
    "class": "Bruiser",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_mid",
    "equipmentPath": "bruiser_attack_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "astra": {
    "class": "Mage",
    "combatRow": "Back",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_back",
    "equipmentPath": "mage_magic_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "aureth": {
    "class": "Bruiser",
    "combatRow": "Front",
    "damageProfile": "Hybrid",
    "primaryScaling": "70% Attack / 30% Ability Power",
    "glyphPath": "bruiser_hybrid_front",
    "equipmentPath": "bruiser_hybrid_front",
    "formationDepth": 1.35,
    "minimumReachMeters": 3.5
  },
  "mellan": {
    "class": "Support",
    "combatRow": "Back",
    "damageProfile": "Healer",
    "primaryScaling": "Ability Power + Healing Power",
    "glyphPath": "support_back",
    "equipmentPath": "support_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "bloatus": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "tank_magic_front",
    "equipmentPath": "tank_magic_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "yenna": {
    "class": "Marksman",
    "combatRow": "Back",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "marksman_attack_back",
    "equipmentPath": "marksman_attack_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "calypsa": {
    "class": "Marksman",
    "combatRow": "Mid",
    "damageProfile": "Hybrid",
    "primaryScaling": "Attack + Ability Power",
    "glyphPath": "marksman_hybrid_mid",
    "equipmentPath": "marksman_hybrid_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "sorrel": {
    "class": "Assassin",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "assassin_other",
    "equipmentPath": "assassin_other",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "carn": {
    "class": "Bruiser",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_mid",
    "equipmentPath": "bruiser_attack_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "ambrel": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "tank_magic_front",
    "equipmentPath": "tank_magic_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "brannus": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "tank_attack_front",
    "equipmentPath": "tank_attack_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "rafe": {
    "class": "Marksman",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "marksman_attack_mid",
    "equipmentPath": "marksman_attack_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "joss": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "tank_magic_front",
    "equipmentPath": "tank_magic_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "deepcleft": {
    "class": "Bruiser",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_front",
    "equipmentPath": "bruiser_attack_front",
    "formationDepth": 1.35,
    "minimumReachMeters": 3.5
  },
  "maren": {
    "class": "Mage",
    "combatRow": "Mid",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_mid",
    "equipmentPath": "mage_magic_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "fritz": {
    "class": "Mage",
    "combatRow": "Mid",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_mid",
    "equipmentPath": "mage_magic_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "askel": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "tank_attack_front",
    "equipmentPath": "tank_attack_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "grosk": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "tank_attack_front",
    "equipmentPath": "tank_attack_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "hollow": {
    "class": "Assassin",
    "combatRow": "Other",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "assassin_other",
    "equipmentPath": "assassin_other",
    "formationDepth": 1.7,
    "minimumReachMeters": 3.5
  },
  "hurne": {
    "class": "Bruiser",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_front",
    "equipmentPath": "bruiser_attack_front",
    "formationDepth": 1.35,
    "minimumReachMeters": 3.5
  },
  "tharl": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "tank_attack_front",
    "equipmentPath": "tank_attack_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "kharos": {
    "class": "Assassin",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "assassin_other",
    "equipmentPath": "assassin_other",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "hobb": {
    "class": "Bruiser",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_front",
    "equipmentPath": "bruiser_attack_front",
    "formationDepth": 1.35,
    "minimumReachMeters": 3.5
  },
  "konwu": {
    "class": "Bruiser",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_mid",
    "equipmentPath": "bruiser_attack_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "tolley": {
    "class": "Bruiser",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_mid",
    "equipmentPath": "bruiser_attack_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "aldren": {
    "class": "Mage",
    "combatRow": "Mid",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_mid",
    "equipmentPath": "mage_magic_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "lumi": {
    "class": "Support",
    "combatRow": "Back",
    "damageProfile": "Healer",
    "primaryScaling": "Ability Power + Healing Power",
    "glyphPath": "support_back",
    "equipmentPath": "support_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "lysara": {
    "class": "Support",
    "combatRow": "Mid",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "support_mid",
    "equipmentPath": "support_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "quorrel": {
    "class": "Bruiser",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_front",
    "equipmentPath": "bruiser_attack_front",
    "formationDepth": 1.35,
    "minimumReachMeters": 3.5
  },
  "meridian": {
    "class": "Marksman",
    "combatRow": "Back",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "marksman_attack_back",
    "equipmentPath": "marksman_attack_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "dandra": {
    "class": "Support",
    "combatRow": "Back",
    "damageProfile": "Healer",
    "primaryScaling": "Ability Power + Healing Power",
    "glyphPath": "support_back",
    "equipmentPath": "support_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "nerisse": {
    "class": "Support",
    "combatRow": "Back",
    "damageProfile": "Healer",
    "primaryScaling": "Ability Power + Healing Power",
    "glyphPath": "support_back",
    "equipmentPath": "support_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "nox": {
    "class": "Assassin",
    "combatRow": "Mid",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "assassin_other",
    "equipmentPath": "assassin_other",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "oakmir": {
    "class": "Support",
    "combatRow": "Back",
    "damageProfile": "Healer",
    "primaryScaling": "Ability Power + Healing Power",
    "glyphPath": "support_back",
    "equipmentPath": "support_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "orryn": {
    "class": "Mage",
    "combatRow": "Back",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_back",
    "equipmentPath": "mage_magic_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "pellucid": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "tank_attack_front",
    "equipmentPath": "tank_attack_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "pyroclast": {
    "class": "Mage",
    "combatRow": "Back",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_back",
    "equipmentPath": "mage_magic_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "rhukk": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "tank_attack_front",
    "equipmentPath": "tank_attack_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "tessit": {
    "class": "Support",
    "combatRow": "Mid",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "support_mid",
    "equipmentPath": "support_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "seyla": {
    "class": "Assassin",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "assassin_other",
    "equipmentPath": "assassin_other",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "rivet": {
    "class": "Marksman",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "marksman_attack_mid",
    "equipmentPath": "marksman_attack_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "iver": {
    "class": "Bruiser",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_front",
    "equipmentPath": "bruiser_attack_front",
    "formationDepth": 1.35,
    "minimumReachMeters": 3.5
  },
  "sylthaine": {
    "class": "Mage",
    "combatRow": "Back",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_back",
    "equipmentPath": "mage_magic_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "gruel": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "tank_attack_front",
    "equipmentPath": "tank_attack_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "linnet": {
    "class": "Support",
    "combatRow": "Mid",
    "damageProfile": "Healer",
    "primaryScaling": "Ability Power + Healing Power",
    "glyphPath": "support_mid",
    "equipmentPath": "support_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "tick": {
    "class": "Bruiser",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_mid",
    "equipmentPath": "bruiser_attack_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "umbris": {
    "class": "Mage",
    "combatRow": "Back",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_back",
    "equipmentPath": "mage_magic_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "vael": {
    "class": "Tank",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "tank_attack_front",
    "equipmentPath": "tank_attack_front",
    "formationDepth": 0,
    "minimumReachMeters": 1.0
  },
  "vaelora": {
    "class": "Mage",
    "combatRow": "Mid",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_mid",
    "equipmentPath": "mage_magic_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "mirelle": {
    "class": "Support",
    "combatRow": "Mid",
    "damageProfile": "Healer",
    "primaryScaling": "Ability Power + Healing Power",
    "glyphPath": "support_mid",
    "equipmentPath": "support_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "sloe": {
    "class": "Marksman",
    "combatRow": "Back",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "marksman_attack_back",
    "equipmentPath": "marksman_attack_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "vesper": {
    "class": "Mage",
    "combatRow": "Mid",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_mid",
    "equipmentPath": "mage_magic_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "vex": {
    "class": "Assassin",
    "combatRow": "Other",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "assassin_other",
    "equipmentPath": "assassin_other",
    "formationDepth": 1.7,
    "minimumReachMeters": 3.5
  },
  "veyr": {
    "class": "Assassin",
    "combatRow": "Mid",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "assassin_mid",
    "equipmentPath": "assassin_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "korvux": {
    "class": "Bruiser",
    "combatRow": "Mid",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_mid",
    "equipmentPath": "bruiser_attack_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "vireo": {
    "class": "Support",
    "combatRow": "Mid",
    "damageProfile": "Healer",
    "primaryScaling": "Ability Power + Healing Power",
    "glyphPath": "support_mid",
    "equipmentPath": "support_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "absalie": {
    "class": "Mage",
    "combatRow": "Back",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_back",
    "equipmentPath": "mage_magic_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "vulmar": {
    "class": "Mage",
    "combatRow": "Back",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_back",
    "equipmentPath": "mage_magic_back",
    "formationDepth": 3.4,
    "minimumReachMeters": 3.5
  },
  "ceraline": {
    "class": "Mage",
    "combatRow": "Mid",
    "damageProfile": "Magic",
    "primaryScaling": "Ability Power",
    "glyphPath": "mage_magic_mid",
    "equipmentPath": "mage_magic_mid",
    "formationDepth": 2,
    "minimumReachMeters": 3.5
  },
  "zahri": {
    "class": "Bruiser",
    "combatRow": "Front",
    "damageProfile": "Attack",
    "primaryScaling": "Attack Damage",
    "glyphPath": "bruiser_attack_front",
    "equipmentPath": "bruiser_attack_front",
    "formationDepth": 1.35,
    "minimumReachMeters": 3.5
  }
  };
  /* 3 Nov 2026 (Claude): Hero 61's profile exists only where Hero 61 is loaded (hero61.js in the page, or the server's require).
     Tests load an OLDER game page as their control next to this file; with hero61 always present its 60-hero HERO_TYPES
     failed the page's own "Canonical hero profile count mismatch" check (63 suite failures, run 1103-223307). */
  let H61=null;
  try{ H61=(typeof module==='object'&&module.exports&&typeof require==='function')?require('./hero61.js'):(root&&root.HERO61); }catch(e){ H61=root&&root.HERO61; }
  if(H61) P.hero61={"combatRow": "Back", "damageProfile": "Healer", "primaryScaling": "Ability Power + Healing Power", "glyphPath": "support_tank_back", "equipmentPath": "support_tank_back", "formationDepth": 3.4, "minimumReachMeters": 3.5, "class": "Support"};
  return Object.freeze(P);
});
