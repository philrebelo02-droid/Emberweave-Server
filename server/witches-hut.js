'use strict';

// Server-owned recovery state. All amounts are brew units; hero health is basis points.
const UNLOCK_LEVEL = 20;
const TICK_MS = 6000;
const FULL_TICKS = 10800; // 18 hours at six seconds per tick.
const HP_FULL = 10000;
const SPEND_WINDOW_MS = 2 * 60 * 60 * 1000;
const SURGE_MS = 4 * 60 * 60 * 1000;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(+value) ? +value : min));
}

function create(capacity, now) {
  return { level: 1, brew: Math.max(0, capacity), tickAt: now, hp: {},
    spent: [], surgeUntil: 0, shopDay: '', shopUses: { first: 0, second: 0 } };
}

function settle(state, capacity, now) {
  const cap = Math.max(1, +capacity || 1);
  if (!state || typeof state !== 'object') state = create(cap, now);
  state.level = Math.max(1, Math.floor(+state.level || 1));
  state.brew = clamp(state.brew, 0, cap);
  state.tickAt = clamp(state.tickAt, 0, now);
  const ticks = Math.floor((now - state.tickAt) / TICK_MS);
  if (ticks > 0) {
    state.brew = Math.min(cap, state.brew + cap * Math.min(ticks, FULL_TICKS) / FULL_TICKS);
    state.tickAt += ticks * TICK_MS;
  }
  if (!state.hp || typeof state.hp !== 'object' || Array.isArray(state.hp)) state.hp = {};
  if (!Array.isArray(state.spent)) state.spent = [];
  state.spent = state.spent.filter(e => e && Number.isFinite(+e.t) && now - +e.t <= SPEND_WINDOW_MS
    && now >= +e.t && +e.amount > 0).slice(-1000);
  if (!state.shopUses || typeof state.shopUses !== 'object') state.shopUses = { first: 0, second: 0 };
  state.surgeUntil = clamp(state.surgeUntil, 0, now + SURGE_MS);
  return state;
}

function health(state, key) {
  return Math.round(clamp(state.hp[key] == null ? HP_FULL : state.hp[key], 0, HP_FULL));
}

function combatHp(state, key, maxHp) {
  const fraction = health(state, key);
  if (fraction <= 0 || !(maxHp > 0)) return 0;
  return Math.max(1, Math.round(maxHp * fraction / HP_FULL));
}

function recordSpend(state, amount, capacity, now) {
  if (!(amount > 0)) return;
  state.spent.push({ t: now, amount });
  state.spent = state.spent.filter(e => now - e.t <= SPEND_WINDOW_MS).slice(-1000);
  const rolling = state.spent.reduce((sum, e) => sum + e.amount, 0);
  if (rolling >= capacity * 0.8 && state.surgeUntil <= now) state.surgeUntil = now + SURGE_MS;
}

function heal(state, key, cardPower, capacity, now) {
  const hp = health(state, key);
  const power = Math.max(0, Number.isFinite(+cardPower) ? +cardPower : 0);
  if (hp >= HP_FULL || power <= 0 || state.brew <= 0) return { key, before: hp, after: hp, spent: 0 };
  const unit = power * 0.1 / HP_FULL;
  const restored = Math.min(HP_FULL - hp, Math.floor((state.brew + 1e-9) / unit));
  if (restored <= 0) return { key, before: hp, after: hp, spent: 0 };
  const spent = restored * unit;
  state.brew = Math.max(0, state.brew - spent);
  state.hp[key] = hp + restored;
  recordSpend(state, spent, capacity, now);
  return { key, before: hp, after: hp + restored, spent };
}

function healAll(state, heroes, capacity, now) {
  const ordered = heroes.slice().sort((a, b) => b.power - a.power || a.key.localeCompare(b.key));
  return ordered.map(h => heal(state, h.key, h.power, capacity, now));
}

function applyBattle(state, result, ownedKeys) {
  const owned = new Set(ownedKeys);
  const changes = [];
  for (const row of result) {
    if (!row || !owned.has(row.key) || !(row.maxHp > 0)) continue;
    const before = health(state, row.key);
    const after = Math.min(before, Math.round(clamp(row.hp / row.maxHp * HP_FULL, 0, HP_FULL)));
    state.hp[row.key] = after;
    changes.push({ key: row.key, before, after });
  }
  return changes;
}

function shopRefresh(state, day) {
  if (state.shopDay !== day) {
    state.shopDay = day;
    state.shopUses = { first: 0, second: 0 };
  }
}

function shopOffer(state) {
  if ((state.shopUses.first | 0) < 2) return { tier: 'first', gems: 50, brewFraction: 0.2 };
  if ((state.shopUses.second | 0) < 2) return { tier: 'second', gems: 100, brewFraction: 0.2 };
  return null;
}

function buy(state, tier, capacity) {
  const offer = shopOffer(state);
  if (!offer || offer.tier !== tier || state.brew >= capacity) return null;
  state.shopUses[tier] = (state.shopUses[tier] | 0) + 1;
  const added = Math.min(capacity - state.brew, capacity * offer.brewFraction);
  state.brew += added;
  return { tier, gems: offer.gems, added };
}

module.exports = { UNLOCK_LEVEL, TICK_MS, FULL_TICKS, HP_FULL, SPEND_WINDOW_MS, SURGE_MS,
  create, settle, health, combatHp, heal, healAll, applyBattle, shopRefresh, shopOffer, buy };
