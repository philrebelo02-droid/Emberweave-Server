'use strict';
/* v1427 HERO USAGE (Soul Eater 19 Nov 2026: "Statistics showing which heroes are the most used would also be good ... This would help us
   control who we should nerf or level up, and who we should buff or rework"; Phil 20 Nov: "start building the statistics idea").

   Every real fight a player finishes (Campaign Normal / Elite / Veteran, Province, Arena attack and the defence it met, World Map
   sieges, the Aether Vault) adds one count to each hero that fought, and one win when that side won. Kept per game day (NY day, the
   game's own day) and per mode, for HU_KEEP days:
     DB.heroUsage = { v:1, days: { 'YYYY-MM-DD': { <mode>: { f:[fights, wins], h:{ <heroKey>:[picks, wins] } } } } }
   Small on purpose: ~60 heroes x 7 modes x 30 days of two numbers. Test accounts, admins and NPC bots are never counted.
   Servers 2-5 send their days to Server 1 every 10 minutes (internal link, like the total-users count); Server 1's dev view adds them
   up, so the Dev panel shows the whole game. */
const HU_KEEP = 30;
const HU_MODES = ['normal', 'elite', 'veteran', 'province', 'arena', 'arenadef', 'siege', 'vault'];
const HU_GROUPS = { campaign: ['normal', 'elite', 'veteran'], province: ['province'], arena: ['arena'], arenadef: ['arenadef'], world: ['siege'], vault: ['vault'] };

function store(DB) {
  const H = DB.heroUsage;
  if (H && typeof H === 'object' && H.days && typeof H.days === 'object') return H;
  return (DB.heroUsage = { v: 1, days: {} });
}
// one finished fight. keys = the heroes that fought on this side; known(k) = is a real hero key. Returns true when it counted.
function note(DB, day, mode, keys, won, known) {
  if (!HU_MODES.includes(mode) || !Array.isArray(keys)) return false;
  const ks = [...new Set(keys.map(String))].filter(k => k && k !== '__proto__' && (!known || known(k))).slice(0, 8);
  if (!ks.length) return false;
  const H = store(DB);
  if (!H.days[day]) { H.days[day] = {}; prune(H, day); }
  const D = H.days[day], M = D[mode] || (D[mode] = { f: [0, 0], h: {} });
  M.f[0]++; if (won) M.f[1]++;
  for (const k of ks) { const r = M.h[k] || (M.h[k] = [0, 0]); r[0]++; if (won) r[1]++; }
  return true;
}
// keep the newest HU_KEEP days
function prune(H, today) {
  const ds = Object.keys(H.days).sort();
  while (ds.length > HU_KEEP) delete H.days[ds.shift()];
  return H;
}
function dayMinus(day, n) { const t = Date.parse(day + 'T12:00:00Z') - n * 86400000; return new Date(t).toISOString().slice(0, 10); }
/* the table the Dev panel shows. sources = [{ server, days }] (this server first, then each satellite's last report);
   group = 'all' | a HU_GROUPS key; n = how many days back from today (1-30). */
function view(sources, today, n, group) {
  n = Math.max(1, Math.min(HU_KEEP, n | 0 || 7));
  const modes = group && HU_GROUPS[group] ? HU_GROUPS[group] : HU_MODES.filter(m => m !== 'arenadef');
  const from = dayMinus(today, n - 1);
  const heroes = {}; let fights = 0, wins = 0; const servers = [];
  for (const s of sources || []) {
    if (!s || !s.days || typeof s.days !== 'object') continue; let used = false;
    for (const [day, D] of Object.entries(s.days)) {
      if (day < from || day > today || !D || typeof D !== 'object') continue;
      for (const m of modes) {
        const M = D[m]; if (!M || !Array.isArray(M.f)) continue; used = true;
        fights += M.f[0] | 0; wins += M.f[1] | 0;
        for (const [k, r] of Object.entries(M.h || {})) { if (!Array.isArray(r)) continue; const h = heroes[k] || (heroes[k] = { picks: 0, wins: 0 }); h.picks += r[0] | 0; h.wins += r[1] | 0; }
      }
    }
    if (used) servers.push(String(s.server));
  }
  const rows = Object.entries(heroes).map(([key, h]) => ({ key, picks: h.picks, wins: h.wins,
    pickRate: fights ? h.picks / fights : 0,            // share of fights this hero was in
    winRate: h.picks ? h.wins / h.picks : 0 }))           // how often its side won when it fought
    .sort((a, b) => b.picks - a.picks || a.key.localeCompare(b.key));
  return { days: n, from, to: today, group: group && HU_GROUPS[group] ? group : 'all', fights, wins, winRate: fights ? wins / fights : 0, servers, heroes: rows };
}
// a satellite's report as Server 1 keeps it: only well-formed days, numbers, known modes
function clean(days) {
  const out = {}; if (!days || typeof days !== 'object') return out;
  for (const [day, D] of Object.entries(days).slice(-HU_KEEP)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !D || typeof D !== 'object') continue; const o = {};
    for (const m of HU_MODES) { const M = D[m]; if (!M || !Array.isArray(M.f)) continue; const h = {};
      for (const [k, r] of Object.entries(M.h || {}).slice(0, 200)) if (/^[\w '-]{1,40}$/.test(k) && Array.isArray(r)) h[k] = [Math.max(0, r[0] | 0), Math.max(0, r[1] | 0)];
      o[m] = { f: [Math.max(0, M.f[0] | 0), Math.max(0, M.f[1] | 0)], h }; }
    out[day] = o;
  }
  return out;
}
module.exports = { HU_KEEP, HU_MODES, HU_GROUPS, store, note, prune, view, clean, dayMinus };
