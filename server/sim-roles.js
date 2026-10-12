'use strict';
/* v1127 HELPER ROLES (Phil 11 Oct 2026: "maybe nodes should specifically be on campaign/vault duty" / "campaign, vault, guild raid..
   other low priority tasks. world map must be done by faster machines" / "world tree is going to be the servers largest pvp event so
   i wouldnt consider that low priority" / "skyfall is also fast machines").

   ONE table: the battle mode -> the role of the helpers that fight it.
     live  - a player is waiting on it: the world map (city, castle and mine battles), World Tree, Skyfall. Fast machines only
             (helpers with role 'live' or 'any'); the slow nodes ('async') are borrowed only when EVERY live helper is down.
     async - nobody waits on it: campaign (all modes), Vault, guild raid, Province, Starless Well, bonus stages, the check backlog,
             and every mode not in this table. The nodes are dedicated to it; the fast machines give it a reserved share of their
             slots (helper `reserve`, default 25%) whenever async work is waiting, and anything more when they have no live work. */
const MODE_ROLE = Object.freeze({
  city: 'live', castle: 'live', mine: 'live', map: 'live', worldmap: 'live', worldtree: 'live', skyfall: 'live', guildwar: 'live',
  campaign: 'async', elite: 'async', veteran: 'async', vault: 'async', dungeon: 'async', raid: 'async', guildraid: 'async',
  province: 'async', well: 'async', bonus: 'async', check: 'async', backlog: 'async',
});
const ROLES = ['live', 'async', 'any'];
function roleOf(mode) { return Object.prototype.hasOwnProperty.call(MODE_ROLE, String(mode)) ? MODE_ROLE[String(mode)] : 'async'; }
function helperRole(r) { return ROLES.includes(r) ? r : 'any'; }   // a helper with no role set takes both, as before
module.exports = { MODE_ROLE, roleOf, helperRole, DEFAULT_RESERVE: 0.25 };
