# 06 - Guild Hall

## PHIL'S RULING - Guild raid fights (3 Oct 2026 ~07:35 ET, open question 6)
Phil: *"damage should be exactly what the play did to the boss, the boss is locked up the player gets out of the fight no other player may fight"*.
- The raid books **exactly the damage the player's own fight did** to the boss - not the server replay figure (the v666 replay rule below is superseded).
- While a player is fighting, **the boss is locked**: no other player may fight it until that player is out of the fight.
- NOT BUILT yet. Guild lane = ChatGPT. Open details to settle when building: what ends a lock if a player closes the game mid-fight (the existing 10-minute session is the natural limit), and what a second player sees while it is locked.

**Private audit finding, 3 Oct 08:10 ET — NOT SHIPPED:** the historical client raid meter converts its frozen starting HP with signed-32-bit `|0`. A tier-36 formula pool of 2,261,564,243 HP and synthetic landed damage 12,345 therefore reports 1. A separate one-line guarded numeric prototype removes that overflow while preserving existing cumulative damage, healing, overkill cap, HP fallback and integer rounding. Exact client candidate SHA256 `e7aa8fc6dd2c8f6b299511b062d82a253e78b0a18341d2dfa97c1d33fa3b545a`; archived evidence `Open Projects/Guild raid instance reservation tools 03OCT2026/meter-numeric-certificate.json`. Extracted-function/boundary checks and three inline-script parses only; actual witnessed fights, natural-play tier reachability, server settlement, full Q6 mechanics and balance remain unverified. No live change or deployment approval; Q11/Q10 lock lifecycle and retention questions remain open.

**Private follow-up, 3 Oct 08:16 ET — NOT SHIPPED:** fixing only the meter does not preserve the fight pool: four `B.hp|0` conversions in live accepted-start and replay construction also turn the tier-36 pool into 1 HP. Separate candidate `ac471280aa2db00e21ce78764e09b2e92242dc72f5f972b61b290cbb37324577` changes those four HP conversions and retains the meter fix. Seven boundary-pool checks on extracted construction paths passed; `startBattle` was stubbed, so this is not combat or full-page verification. Evidence: `Open Projects/Guild raid instance reservation tools 03OCT2026/hp-bootstrap-certificate.json`. Result HP display still contains bitwise conversion; full integration/balance/release gates remain open.

**Private result-display follow-up, 3 Oct 08:20 ET — NOT SHIPPED:** confirmed damage and remaining/maximum HP also used signed-32-bit conversion. A synthetic confirmed 2,261,564,243-damage result was labelled NO DAMAGE and showed negative HP. Candidate `20787649b6707783cfe9c8719f20e53e6f84bbc70162d40440e2020dcf190f5a` replaces exactly those three display conversions, retaining previous meter/bootstrap fixes. Seven numeric boundaries, stale-result refusal and unsuccessful-result display checked in extracted rendering with synthetic DOM/adoption/navigation stubs; three inline scripts parse. Evidence: `Open Projects/Guild raid instance reservation tools 03OCT2026/result-numeric-certificate.json`. Not browser/combat/server settlement/reward adoption/balance verification, and not deployed.

**Private server experiment, 3 Oct 08:27 ET — NOT SHIPPED/NOT COMPLETE:** candidate `4f66439ee5c0ca10e35ff1b4eec3aefda3c9824c7ce48760d8274a3624ce2d69` holds mismatched or missing owner/guild/attempt/start-request/tier/boss/current-boss reservation before retiring an attempt. Within that partial path, the player's submitted damage is used, preserving the existing remaining-HP cap; replay difference is response/receipt diagnostics only, not the required 1/3/4-flag escalation. Synthetic private HTTP: submitted 12,345 versus replay 4 records 12,345, remaining HP 387,655, contribution 12,345 and 247 guild coins; rename failure/retry/restart/changed-packet/foreign-member controls checked. Evidence: `Open Projects/Guild raid instance reservation tools 03OCT2026/player-damage-http.json`. Not a witnessed fight or balance proof. The reservation deliberately remains held after settlement, historical expiry behavior is not redesigned, and Q11/Q10 remain open. Do not install or deploy this partial candidate.

Blueprint of the Guild Hall building: guild membership, chat, contributions and levelling, the Embassy perks, the Guild Shop, the co-op Guild Raid boss, and Guild War (the Skyfall Tournament; the legacy weekly war is retired). Read from `Base files/emberweave-heroes.html` (client) and `Base files/server.js` (server).

## Purpose

The Guild Hall is the multiplayer home base. A signed-in player creates a guild or requests to join one, then gets a chat room with a roster, a shared guild level that everyone raises by contributing, an Embassy that turns that level into passive perks (mine yield, contribution exp, raid gold, max stamina), a shop priced in guild coins whose stock grows with guild level, a shared raid boss the whole guild chips down for coins/gold/diamonds, and the weekly Skyfall Tournament where guilds fight a knockout bracket across five citadels. Leaders manage join requests, kick, transfer leadership, set the message of the day, and disband. Everything about guilds is stored on the server; the client mirrors a small view into `G.guild` so perks work offline-ish.

## Unlock

Player level 13. Town hotspot `{nav:'guild', label:'Guild Hall', ...lk(13)}` (client line 5713). Locked unless `AUDIT_MODE()`. `renderGuild()` does not re-check the level.

A signed-in account is mandatory: without `ACC.token` the screen shows "Guilds are multiplayer — Sign in to create a real guild or join one" with a Sign In / Register button (`show('account')`). Guild War (Skyfall) additionally needs the server flag `GUILD_WAR_V2_ENABLED` (default on; `false` in env turns it off) or a dev account (`warEnabledFor`). The Embassy tab needs guild level 4.

## Flow

### Entering (`show('guild')`, line 5648)

`renderGuild()` runs, and if signed in `startGuildPoll()` polls `/api/guild/mine` every 6000 ms while the guild screen is open (skipped on the Raid tab), re-rendering only when the guild view JSON changed. The scene background is `GUILD_BG` via `applySceneBg`.

### Lobby — not in a guild (`renderGuildLobby`, line 9909)

1. Panel "You're not in a guild yet" with a **name input** (maxlength 24) and **Create**. Fewer than 2 characters → "Guild name needs at least 2 characters." Otherwise POST `/api/guild/create {name}`; on success the guild view is adopted and the Chat tab opens.
2. Panel "🔍 Find a Guild" with a search box and **Search** (GET `/api/guild/browse?q=`). Rows show `<Name>`, level, `count/cap members · leader Name`, and a **Request** button (disabled "Full" when `count>=cap`; "Requested ✓" if already pending). Request → POST `/api/guild/request {guildId}`.

### In a guild (`renderGuild`, line 9709)

Header: `<Guild name> Lv N count/cap` and a button that reads **Manage** for the leader (opens `openGuildManage`) or **Leave** for members (`doGuildLeave`, confirm, POST `/api/guild/leave`).

Tabs (`guildTab`, default `'chat'`): 💬 Chat · (📩 Requests, leader only, inserted second with a red pending-count badge) · 🎁 Contribute · 🏛 Embassy · ⚔ War · 🐲 Raid · 📈 Level · 🛡 Shop.

**Chat** (`renderGuildChat`, 9741): left column "💬 Guild Chat" with "online/count online", the MOTD line, the message log (system lines italic; a player's own name in mint, others in blue; messages carrying a `battle` chip get a **▶ Watch** replay button), and an input (maxlength 200) + **Send** → POST `/api/guild/chat {tx}`. Right column "Roster": each member with an online dot, leader marked 👑 leader, "(you)". For the leader, tapping another member opens `guildMemberMenu`: **👑 Make Guild Leader** (confirm → `/api/guild/transfer {id}`) or **🚪 Remove from Guild** (confirm → `/api/guild/kick {id}`). The draft text and focus survive the 6 s poll re-render (`_gChatDraft`, `_gWasFocused`).

**Requests** (`renderGuildRequests`, 9776): list of pending applicants (name, "Rank N") with **Accept** (`/api/guild/approve {id}`) and **Deny** (`/api/guild/deny {id}`).

**Manage** modal (`openGuildManage`, 9699): MOTD input (maxlength 160) + **Save** (`/api/guild/motd {motd}`), **💥 Disband Guild** (confirm → `/api/guild/disband`), and the note "To step down and leave, first make another member the leader".

**Contribute** (`renderGuildContribute`, 9882): guild level bar `have / need exp`, then three offers from `G.guildContribs` (re-rolled by `rollContribs()` if missing or stale): two map-resource offers "Give 5 <resource>" for "+10 guild exp" and one diamond offer "Give 10 💎" for "+20 guild exp". Buttons are disabled if the player cannot afford the local cost or the guild is maxed. Clicking runs `doContribute(i)` → `addGuildExp(round(exp × embassyContribMul()))` which for a real guild POSTs `/api/guild/contribute {exp}`; on `ok` the local 5 resource / 10 diamonds are deducted (diamonds through `/api/tx/spend reason 'shop'`), offers re-roll, and the screen re-renders. `capped:true` shows "Daily contributions done — come back tomorrow."; an `error` (e.g. not enough gold) is shown as a banner.

**Embassy** (`renderGuildEmbassy`, 9788): if guild level < 4 a locked panel "The Embassy unlocks at Guild Level 4". Otherwise four perk rows with the current bonus and "next:" value.

**War** (`renderGuildWar`, 9808): loads `skyStatus()` (GET `/api/guild-war/status`); if `enabled` renders `skyPanelHTML()` (the Skyfall Tournament UI, see below). If Skyfall is disabled the tab shows a static notice "Guild War has moved to the Skyfall Tournament" — the legacy weekly-war UI after the `return` at 9816 is unreachable.

Skyfall panel (`skyPanelHTML`, 6455): header "☁️ Skyfall Tournament" with a state pill (📝 Registration open / ⚔️ Round N / 🏁 Finished) and the blurb "register Sat–Mon, fight Tue–Fri 6–8 PM ET across five citadels". During registration: lock time, number of registered guilds, and either "✓ Your guild is registered — Power Pool P", a **📝 Register Guild** button (leader/officer only, `skyRegister` → `/api/guild-war/register`), or "Ask your guild leader to register." After registration the top 8 seeds are listed. When finished: "👑 Champion: name" and a **🎁 Claim reward** button (`skyClaim` → `/api/guild-war/claim-reward`) when `pendingWarReward>0` (or, on older servers, when registered). Unclaimed coins from a previous week are shown at any time.
If the guild has a match, `skyMatchHTML` renders it: round name and "You vs Foe" (foe hidden as "❓ ???" before reveal), state pill (📋 Planning / 🔴 LIVE until time / 🏁 Finished). In planning an officer sees the roster with a lane button per citadel (⭐ marks you; "unplaced" in red) → `skyAssign(memberId, lane)` → `/api/guild-war/assign`. Five lane rows show your citadel (green) and the enemy's (red) with each defender line's alive/💀 state, HP %, and for you "(N orders)". Tapping the lane centre opens the skybridge view (`skyBridgeHTML`) with a **⚔ MARCH THE BRIDGE** button when the match is live, you are alive in that citadel, and neither citadel is destroyed → `skyMarchAnim` → `skyMarch` → POST `/api/guild-war/assault {fromLane}`. Results: "🏆 Victory on the bridge!" / "💥 The citadel falls!" / "💀 Your line was driven back." / "🏳️ Citadel captured — no defenders!" / "👑 YOUR GUILD WINS THE MATCH!". When finished, "🏆 VICTORY" or "💀 DEFEAT" plus `skyWarSummaryHTML` ("HOW THE WAR WAS WON/LOST": citadels destroyed, assaults won, and up to 6 fall events).

**Raid** (`renderGuildRaid`, 9853): GET `/api/guild/raid`. Shows the boss name and "Guild Raid Boss · Tier N", an HP bar `hp / max`, "Your damage", "Guild total", "Bosses felled", the Boss Contribution board (top 10 by damage, v671), and **⚔ Fight the boss · N left today** (disabled when 0 → "⏳ No assaults left — back tomorrow"). Since v666 a raid attempt is a real 90-second battle: POST `/api/guild/raid/start` (squad, seed, boss with his remaining HP), then POST `/api/guild/raid/resolve` (the server replays the fight in sim-host and takes the replay's damage). `/api/guild/raid/assault` now only answers 400 "reload the game to fight the boss" (server.js:5984-6043; client emberweave-heroes.html:20853).

**Level** (`renderGuildLevel`, 9898): "Guild Level N", `players / cap · shop items`, exp bar, and a table of levels 1..7 with member cap and shop item count for each.

**Shop** (`renderGuildShopInto`, 9580): "Spend 🎖 coins · N items unlocked at guild Lv L (more each level)" then the first `guildShopSlots()` entries of `GUILD_SHOP`, each with a **🎖 cost** button (disabled if unaffordable). Purchase when signed in: server items (`it.server`) go to `/api/shop/buy {what}`; all others spend first via `/api/tx/spend {what:'guildCoins', amount, reason:'guildshop'}` and only then run `it.give()`. Offline: `G.guildCoins -= cost` then `give()`. The same catalogue is reused by the World Map shield button (`openGuildShop`, 9520).

## Rules & numbers

### Membership and levelling (server is authoritative; client mirrors the same constants)

| Item | Value | Source |
|---|---|---|
| Base cap | 30 members at Lv 1 (`GBASE=30` / `GUILD_BASE_CAP=30`) | server 3913, client 9533 |
| Cap per level | +5 (`GPER=5` / `GUILD_CAP_PER_LEVEL=5`), hard max 60 (`GMAXCAP=60`) | same |
| Max level | 7 (`GMAXLVL=7`; client `GUILD_MAX_LEVEL=1+(60−30)/5=7`) | server 3913, client 9534 |
| Exp to next level | `1000 × level` (`gExpNeed` / `guildExpNeeded`) — Lv1→2 needs 1000, Lv6→7 needs 6000; exp is zeroed at Lv 7 | server 3915, 4084; client 9538 |
| Shop items | `4 + (level−1)×2` (`guildShopSlots`) — 4 at Lv1 … 16 at Lv7, but only 12 items exist in `GUILD_SHOP` | client 9539, 9564-9579 |
| Guild name | `capWords`, `<>` stripped, whitespace collapsed, trimmed, sliced to 24 chars, min 2, unique case-insensitively | server 4004-4006 |
| Create rate limit | 10 per 60 s per IP key `'gcreate'` | server 4002 |
| New guild | `{leader:me, members:[me], reqs:[], level:1, exp:0, motd:'Welcome to <name>!', log:[]}`; `me.guildId` set | server 4007-4008 |
| Join request | refused if already in a guild, guild full, or `reqs.length>=80`; duplicate → `{ok, already:true}` | server 4011-4017 |
| Approve | leader only; request must exist; applicant must still exist and be guildless; cap check; system log "X joined the guild." | server 4026-4033 |
| Kick | leader only, not self ("Use Leave instead."), must be a member; clears the target's `guildId` | server 4035-4039 |
| Transfer | leader only, target must be a member | server 4040-4042 |
| MOTD | leader only, `<>` stripped, sliced to 160 | server 4043 |
| Disband | leader only; clears every member's `guildId`, deletes the guild | server 4044-4045 |
| Leave | a leader with other members must transfer first; last member leaving deletes the guild (`disbanded:true`) | server 4047-4052 |
| Online dot | `lastSeen` within 5 × 60000 ms (5 min); `lastSeen` is stamped on every authenticated API call | server 3920, 2225 |
| Roster sort | leader first, then online, then ascending arena rank | server 3923-3924 |
| Browse | name contains `q`, sorted by member count desc, first 40 | server 3986-3991 |
| Client poll | `/api/guild/mine` every 6000 ms while on the guild screen | client 9688 |

### Chat

| Item | Value | Source |
|---|---|---|
| Message | `<>` stripped, sliced to 200, trimmed; empty → `{ok:true}` no-op | server 4056 |
| Rate limit | 25 per 60 s (`'gchat'`) | server 4055 |
| Optional replay chip | `battle` object ≤ 8000 bytes JSON is stored on the message | server 4058 |
| Log storage | last 100 entries kept | server 4059 |
| Log view | entries where `sys` or no `t` or younger than 6 h (`6*3600000`), last 60 | server 3931 |
| Share to guild | `postReplayChip('guild')` posts "📽 shared a battle vs X" with the chip | client 12805-12815 |

### Contributions (`/api/guild/contribute`, server 4062-4085)

| Item | Value |
|---|---|
| Server exp per contribution | `GUILD_CONTRIB_EXP=100` (client's `exp` field is ignored) |
| Server gold cost | `GUILD_CONTRIB_GOLD=200` ledger gold per click ("Contributing costs 200 gold." if short) |
| Daily cap | `GUILD_CONTRIB_DAILY=20` per player per UTC day (`me.guildContrib{day,n}`) → `{capped:true}` |
| Rate limit | 80 per 60 s (`'gcontrib'`) |
| Level-up | while `level<7 && exp>=1000×level`: subtract, level++, system log "The guild reached Level N!"; at Lv 7 exp=0 |
| Client-side extra cost | resource offer: 5 of a random map resource (`G.res`, local only); diamond offer: 10 💎 via `/api/tx/spend reason 'shop'` |
| Client-side displayed exp | 10 (resource) / 20 (diamond) × `embassyContribMul()` — display only |
| Client offer roll | `rollContribs()`: two `{kind:'res', res:random RES key, cost:5, exp:10}` + `{kind:'dia', cost:10, exp:20}` (9547-9549) |

### Embassy perks (client only, 9619-9628)

| Perk | Formula (guild level L, only while `G.guild` is set) | Where applied |
|---|---|---|
| ⛏ Miner's Charter | `embassyMineMul() = 1 + 0.03L` (+3 %/level) world-mine yield | `mineYield` (9267) — but the server clamps hauls to 15 |
| 🎁 Envoy's Favor | `embassyContribMul() = 1 + 0.05L` (+5 %/level) contribution exp | `doContribute` — display only, server grants a fixed 100 |
| ⚔ War Spoils | `embassyRaidMul() = 1 + 0.04L` (+4 %/level) raid gold | `resolveMarch` bot-raid gold (9103), capped by earn rule 1200 |
| ⧗ Rallying Call | `embassyStamBonus() = 2L` flat max stamina | `maxStamina() = 59 + playerLevel() + bonus` (2444) |
| Unlock | tab locked below guild Lv 4 (perks still apply from Lv 1 since the functions do not check the lock) | 9790 |
| "next" preview | +3 / +5 / +4 percentage points, +2 stamina | 9798 |

### Guild Shop (`GUILD_SHOP`, client 9564-9579; costs in guild coins 🎖)

| # | Item | Cost | Effect | Delivery |
|---|---|---|---|---|
| 1 | Protection Shield | 800 | +1 `G.shieldItems` (12 h immunity) | client save |
| 2 | Gold Cache | 300 | +5,000 gold | `txEarn('gold',5000,'guildshop')` (rule max 50000, day 300000) |
| 3 | Diamond Pouch | 600 | +50 diamonds | `txEarn('gems',50,'guildshop')` (max 500, day 5000) |
| 4 | Stamina Refill | 200 | stamina to max | `txEarn('stamina',need,'guildshop')` (max 200, day 1000) |
| 5 | Arena Coins ×2000 | 500 | +2,000 `G.arenaCoins` | client save |
| 6 | Equipment Pieces | 450 | +100 of each equip material | server `/api/shop/buy {what:'pieces_guild'}` (450 guild coins, +100 per `EQ_MAT_KEYS`, cap 999999) |
| 7 | Great Gold Cache | 700 | +15,000 gold | txEarn gold |
| 8 | Resource Crate | 350 | +100 of each map resource (`G.res`) | client only |
| 9 | Diamond Chest | 1500 | +150 diamonds | txEarn gems |
| 10 | Shield Pack ×3 | 2000 | +3 shields | client save |
| 11 | Arena Coins ×6000 | 1200 | +6,000 arena coins | client save |
| 12 | Treasure Vault | 2500 | +50,000 gold | txEarn gold (max 50000) |

Slots unlocked: 4 / 6 / 8 / 10 / 12 / 14 / 16 at guild Lv 1..7 (items 13-16 do not exist). Spending: `/api/tx/spend {what:'guildCoins'}` requires `led.guildCoins >= amt`.

### Guild Raid boss (server 3935-3943, 4087-4112)

| Item | Value |
|---|---|
| Attempts | `RAID_ATT=3` per member per UTC day (v666) (`r.used[me.id]`, reset when `r.day` changes) |
| Boss HP | `bossMax(lvl) = round(400000 × 1.28^(lvl−1))` (v670) — 400,000 / 512,000 / 655,360 … |
| Boss names | `RAID_BOSSES` = the 20 in-game bosses, one per tier, looping past 20 (a tier above 20 is named "Elite <boss>"); see "The 20 raid tiers" below and server.js:5765-5782 (v666; Sylphice moved to tier 15 in v673) |
| Damage per assault | the damage of a real 90-second fight, replayed on the server by sim-host from the frozen squad, seed and input log, capped at the boss's remaining HP (fallback without a replay host: the client claim capped at ledger power ×12) — server.js:6017-6043 |
| Hit reward | `guildCoins = round(dmg / 50)` |
| Kill reward (killing blow only) | `{guildCoins: 300×lv, gold: 800×lv, gems: 15 + 3×lv, tier: lv}`; guild gains +250 exp (level-ups applied); boss → level+1, full HP, `contrib` reset, `kills++`; system chat line "X landed the killing blow on <boss> (Tier N)!" |
| Crediting | rewards written straight to the ledger (`led.gold/gems/guildCoins`, capped by `ECON_CAP`) with `ledTx('guild-raid')` |
| Rate limit | 20 per 60 s (`'graidstart'`) on `/api/guild/raid/start` |
| Top list | top 10 contributors by damage on the current boss, with % share (v671) |
| Client dead code | `GUILD_RAID_ATTEMPTS=5`, `GUILD_BOSS_NAMES` (6 names), `guildBossMax`, `guildBossEnsure`, `guildBossPassiveTick` (passive `members × level × 220 × hours`, ≤24 h), `guildBossAssault`, `guildBossKillReward` — a local mirror that no UI path calls any more (9634-9668) |

### Skyfall Tournament (Guild War v2, server 1081-1296 and 2545-2663)

| Item | Value |
|---|---|
| Enabled | `GUILD_WAR_V2_ENABLED` env (default true) or dev account |
| Week anchor | most recent Saturday 00:00 America/New_York (`warWeekAnchor`, DST-exact via `etOffsetMs`) |
| Registration | opens at anchor + 2 h (Sat 02:00 ET, v775b), locks at anchor + 2 days (Mon 00:00 ET) |
| Rounds | 4 max, `WAR_ROUND_NAMES=['R16','QF','SF','F']`; round i: planning opens anchor + (3+i) days 02:00 ET (Tue/Wed/Thu/Fri; the opponent is revealed then, v728), lock/start at +18 h (6 PM ET), ends at +20 h (8 PM ET) |
| Who registers | guild leader or an id in `g.officers` (no endpoint ever sets `officers`) |
| Registration checks | in a guild, state = registration, not already registered, at least one eligible line |
| Member line | `buildRegisteredLines`: up to `WAR_LINES_MAX=7` lines per member (v694); line power = sum of the heroes' card power (`heroCardPower`, v806) |
| Power pool | sum of member line powers (`warQualifyGuild`), recomputed for every registrant at the Monday lock |
| Seeding | top 16 by power pool; bracket size = smallest power of two ≥ entrants (2..16); pairs 1 vs N, 2 vs N−1 …; round names chosen so the last round is always 'F' (`roundBase`); fewer than 2 entrants → tournament finished |
| Bye | a missing opponent gives an automatic win |
| Lanes | `WAR_LANES` = Iron Gate, Storm Watch, Crown Spire, Verdant Sanctuary, Rift Tower (client icons 🛡️ ⚡ 👑 🌿 🔮) |
| Planning | officers assign each registered member to lane 0-4 (`/api/guild-war/assign`), only after `revealAt`. **No auto-placement since v778**: a line not placed by the 18:00 lock does not fight and is recorded as unplaced |
| Lock | snapshots rebuilt fresh from server data; each defender line gets `hpState` full HP / 0 energy, `alive:true` |
| Assault orders | `WAR_ASSAULTS_PER_LINE=5` is shown to players but not enforced; the real cap is `WAR_KILL_CAP=5` - a line retires after five kills (v678) |
| Assault rules | only within `startsAt..endsAt`, from a lane whose own citadel stands, at an enemy citadel not yet destroyed, by a member alive in that lane; optional `expectedVersion` → 409 `STALE` on mismatch |
| Battle | `SIM.resolveLineBattle(aLine, bLine, seedFrom(matchId:me:lane:version))` against the defender `warPick` chooses: the member with the lowest total power first, then that member's weakest line (v775); survivor HP/energy persisted on both lines; a line with no survivors is `alive=false` |
| Citadel falls | when no enemy defender in that lane is alive; an undefended citadel is captured without a fight (still costs an order) |
| Win | only the bell (`endsAt`) ends a match (v676); then more destroyed citadels → higher power pool → better seed (never random); the surviving-HP step is gone |
| Next round | starts once all matches are finished and `planningOpensAt` of the next round has passed; tournament finishes when ≤1 winner remains or the final is done |
| Rewards | `warTierAmount`: champion 2000, finalist (lost the 'F' match) 1000, participant 300 — escrowed per member into `u.pendingWarRewards` when the bracket ends; `/api/guild-war/claim-reward` adds the total to `me.coins` and empties the list |
| Rate limit | 30 per 30 s (`'gwar'`) on all `/api/guild-war/*` |
| History | the archive is removed; every week's result goes to `DB.tournaments.history[weekKey]`, uncapped (server.js:1716-1718) |
| Dev | `/api/guild-war/debug-warp {offsetMs}` shifts `DB.warTimeOffset` (dev only) |

### Legacy weekly war (retired, code kept)

`/api/guild/war` returns `{retired:true}` and `/api/guild/war/attack` returns 400 "Legacy Guild War is retired — fight in the Skyfall Tournament". The dead server code (3944-3984, 4115-4135) describes: `WAR_ATT=5` duels/day, 7-day weeks, opponent = guild with the closest `guildStrength` (sum of member `serverTeamPower` + 400 per guild level above 1), NPC fallback "The Wilds Coalition" with 5 champions, duel `mine = serverTeamPower × (0.9+rand×0.3) ≥ target.power`, points `round(power/10)`, coins `round(power/8)`. The client's `renderGuildWar` legacy branch and `guildWarAttackServer` (9818-9851) are unreachable.

## Currencies in / out

| Direction | Currency | Amount | Source |
|---|---|---|---|
| Out | Gold (ledger) | 200 per contribution | `/api/guild/contribute` |
| Out | Diamonds | 10 per diamond contribution offer | client → `/api/tx/spend 'shop'` |
| Out | Map resources (local `G.res`) | 5 per resource offer | client only |
| Out | Guild coins | shop item cost (200-2500); 450 for Equipment Pieces | `/api/tx/spend 'guildshop'`, `/api/shop/buy 'pieces_guild'` |
| In | Guild exp | 100 per contribution; 250 per raid boss kill | server |
| In | Guild coins | `dmg/50` per raid hit; `300×tier` on a kill; (also 40 per city raid win, see blueprint 04) | server ledger |
| In | Gold | `800×tier` on a killing blow | server ledger (`ECON_CAP.gold`) |
| In | Diamonds | `15+3×tier` on a killing blow | server ledger (`ECON_CAP.gems`) |
| In | Account coins (`me.coins`) | Skyfall 300 / 1000 / 2000 per member | `/api/guild-war/claim-reward` |
| In | Goods from shop | shields, gold, diamonds, stamina, arena coins, equip materials, map resources | see shop table |
| Passive | Max stamina | +2 per guild level | `embassyStamBonus` |

## Server contract

**Save durability (v940, 2 Oct 2026 - ChatGPT CR0522 batch 1, reviewed and shipped by Claude).** `/api/shop/buy {what:'pieces_guild'}` (the Equipment Pieces item - the other guild shop items spend through `/api/tx/spend`, not migrated yet): the purchase is planned on a private copy of the account and saved BEFORE it is acknowledged. A failed save answers **HTTP 503** `{ok:false, storageFailed:true}` and nothing is granted, spent or published - memory and disk stay as they were; retrying with the same request id commits once and replays the original success, also after a restart (24 h receipt window). Costs, recipes, refunds, rewards and odds are unchanged. Shared mechanism: `durableCommit` (blueprint 17, Save and ledger). Tests: tests/durable-routes.test.js rows.


All `/api/guild*` and `/api/guild-war*` routes require auth (401 `{error:'auth'}`).

| Endpoint | Method | Body | Returns | Enforced server-side |
|---|---|---|---|---|
| `/api/guild/mine` | GET | — | `{guild: view|null}` | — |
| `/api/guild/browse` | GET `?q=` | — | `{guilds:[{id,name,level,count,cap,leaderName,requested}], mine}` | top 40 by size |
| `/api/guild/raid` | GET | — | `{raid:{level,max,hp,kills,yourDmg,guildDmg,attemptsLeft,top,name}}` | must be in a guild |
| `/api/guild/war` | GET | — | `{retired:true, note}` | — |
| `/api/guild/create` | POST | `{name}` | `{guild}` | rate limit, not in guild, name rules, uniqueness |
| `/api/guild/request` | POST | `{guildId}` | `{ok, already?}` | not in guild, exists, not full, ≤80 pending |
| `/api/guild/cancelRequest` | POST | `{guildId}` | `{ok}` | — (client never calls it) |
| `/api/guild/approve` `/deny` `/kick` `/transfer` `/motd` `/disband` | POST | `{id}` / `{motd}` | `{guild}` / `{ok,disbanded}` | in guild + leader (403 otherwise), per-route checks above |
| `/api/guild/leave` | POST | — | `{ok, disbanded?}` | leader-with-members must transfer first |
| `/api/guild/chat` | POST | `{tx, battle?}` | `{ok, log}` | rate limit, sanitise, 8 KB chip |
| `/api/guild/contribute` | POST | `{exp}` (ignored) | `{guild}` / `{capped:true, guild}` / 400 gold error | 200 gold, 100 exp, 20/day, rate limit |
| `/api/guild/raid/assault` | POST | — | 400 "reload the game to fight the boss" | closed in v666 |
| `/api/guild/raid/start` | POST | `{heroIds, requestId}` | `{ok, attemptId, seed, snaps, boss, raid}` / `{none:true, raid}` | 3/day, 20 per 60 s |
| `/api/guild/raid/resolve` | POST | `{attemptId, inputLog, requestId}` | `{ok, dmg, killed, reward, raid, ledger}` | sim-host replay, 10-minute session |
| `/api/guild/war/attack` | POST | — | 400 retired | — |
| `/api/guild-war/status` | GET | — | `{enabled, tournament{...}, registered, yourPowerPool, canRegister, pendingWarReward, match}` | `warAdvance` state machine runs first |
| `/api/guild-war/match` | GET | — | `{match}` | — |
| `/api/guild-war/register` `/unregister` | POST | — | `{ok, powerPool, lines, note}` | leader/officer, registration state |
| `/api/guild-war/assign` | POST | `{memberId, lane}` | `{ok, match}` | planning, after reveal, officer, lane 0-4, member registered |
| `/api/guild-war/assault` | POST | `{fromLane, expectedVersion?}` | `{ok, won, captured?, citadelFell, finished, replay, result, match}` | live window, lane rules, `WAR_KILL_CAP=5` kills per line, deterministic sim |
| `/api/guild-war/claim-reward` | POST | — | `{ok, coins, amount, tier}` | pending list non-empty |
| `/api/guild-war/place` `/move-lane` `/lines` `/history` `/sim` | GET/POST | — | — | exist (server.js:3554-3849); see the v690+ sections below |
| `/api/guild/banner` | POST | — | — | exists (server.js:5931) |
| `/api/tx/spend` | POST | `{what:'guildCoins'|'gems', amount, reason, requestId}` | `{ok, ledger}` | balance |
| `/api/shop/buy` | POST | `{what:'pieces_guild', requestId}` | `{ok, mats, cost, ledger}` | 450 guild coins |
| `/api/tx/earn` | POST | shop goods `gold/gems/stamina` with reason `guildshop` | `{ok, ledger}` | `EARN_RULES.*.guildshop` caps |

Client decides: which shop item to buy and its non-ledger effects (shields, arena coins, map resources), the contribution offers and their local resource/diamond cost, all Embassy multipliers, the displayed exp on offers. Server decides: membership, roster, chat, guild exp/level, raid HP/damage/rewards, every Skyfall outcome, guild-coin balance, gold/diamond/stamina grants.

State — client: `GS.guild` (server view: `id,name,level,exp,expNeed,motd,leader,leaderName,cap,members[{id,name,rank,online,leader}],count,youLeader,requests[],pendingReqCount,log[]`), `G.guild{id,name,level,exp,type:'real',leader,motd}` (mirror via `syncLocalGuild`), `G.guildContribs`, `G.guildCoins` (ledger mirror), `G.shieldItems`, `G.arenaCoins`, `G.res`, `G.guildBoss` (dead), `guildTab`, `_gChatDraft`, `_gWasFocused`, `_raidGen`, `SKY{st,busy,assignSel,lane}`.
State — server: `DB.guilds[id]{id,name,leader,members[],reqs[{id,t}],level,exp,motd,log[],createdAt,raid{level,max,hp,kills,contrib{},used{},day},war?,officers?}`, `DB.users[*].guildId`, `guildContrib{day,n}`, `lastSeen`, `pendingWarRewards[]`, `coins`, `led.guildCoins`; `DB.wars` (legacy), `DB.tournaments{current,archive}`, `DB.warTimeOffset`.

## Related data tables

Client: `GUILD_SHOP`, `EMBASSY_PERKS`, `GUILD_BOSS_NAMES` (dead), `GUILD_MEMBERS`/`GUILD_NAME`/`GUILD_MOTD` (mock data at 9524-9530, only `GUILD_MEMBERS.length` is still read by `guildMemberCount`, itself only used by the dead passive tick), `RES`, `HERO_KEYS`, `GUILD_BG`, `SKY_BRIDGE_BG` (`/assets/img/battlefields/guild-war-skybridge-01.webp`), `WAR_LANES` (served by the API as `match.lanes`).
Server: `BOSS_NAMES`, `WAR_LANES`, `WAR_ROUND_NAMES`, `NPC_NAMES` (legacy NPC champions), `EARN_RULES`, `ECON_CAP`, `EQ_MAT_KEYS`, `SIM.HERO_BASE` (`server/sim.js`, `hero_base.json`), `server/combat-core.js` (`resolveLineBattle`, `makeLine`, `seedFrom`, `heroCombatStats`). Spec referenced in comments: `SPEC-guild-wars-skyfall.md` (not in the glyph folder).

## Known gaps / TODO comments found in the code

- Server 4067-4068: "NOTE: GUILD_CONTRIB_EXP / GUILD_CONTRIB_DAILY are a balance placeholder — tune in the economy pass (real fix = deduct an owned server-side resource, Phase 2). -PR review". Today a contribution costs 200 ledger gold plus whatever the client deducts locally.
- The contribution UI advertises "+10 / +20 guild exp" for 5 resources / 10 diamonds and applies `embassyContribMul()`; the server ignores `exp` and always grants 100. The resource cost (`G.res -= 5`) is local and is overwritten by the next `academySync` pull of server `A.res`, so resource offers are effectively free while diamond offers really cost 10 💎.
- Embassy "Envoy's Favor" therefore has no real effect; "Miner's Charter" is moot while the server clamps hauls to 15 per trip.
- The Embassy tab is locked below guild Lv 4, but the perk functions apply from Lv 1.
- `guildShopSlots()` promises 14 and 16 items at Lv 6-7; the catalogue has 12.
- Shop items 1, 5, 8, 10, 11 (shields, arena coins, resource crate) are granted locally after the server takes the coins; nothing server-side records the goods.
- `officers` is checked by Skyfall (`isLeaderOrOfficer`) but no route ever sets `g.officers`; only the leader can register/assign.
- Skyfall rewards go to `me.coins` (the account coin counter fed by `/api/daily`) which the client only displays as "🪙" in the Account screen; the banner says "+N coins" and nothing lands in `G.guildCoins` or `G.arenaCoins`.
- Raid attempt day and contribution day use the UTC date (`toISOString().slice(0,10)`), while city PvP and mining use the New York day (`nyDayKey`) and the client's arena day resets at 09:00 ET — three different daily boundaries.
- The client's local guild-boss mirror (`G.guildBoss`, `guildBossAssault`, passive tick) and the mock `GUILD_MEMBERS` table are dead code kept from the pre-server build.
- `/api/guild/cancelRequest` exists but the lobby has no "cancel request" button.
- `renderGuildWar` legacy branch (9818-9851) and server legacy war code (`ensureWar`, `warView`, the `if(false)` attack block) are unreachable but still compiled; "AUDIT C9: the legacy weekly war is RETIRED".
- Guild chat is only readable inside the Guild Hall; the floating chat widget covers world/region/whisper only (`updateChatVisibility` shows it on home and the world map).
- The raid `power` body field the client sends (`bestTeamPower()`) is ignored by the server ("SECURITY (audit crit #5, re-closed v272)").

## Code map

**Line numbers below are from v338 and have moved - grep the symbol names.**

Client (`emberweave-heroes.html`):

| Function / constant | Line |
|---|---|
| `maxStamina` (+ Embassy bonus) | 2444 |
| `show('guild')` → `renderGuild`, `startGuildPoll`, `guildRefresh` | 5648 |
| Town hotspot `guild` (lk 13) | 5713 |
| `SKY`, `SKY_BRIDGE_BG`, `skyOpenLane`, `skyBridgeHTML`, `skyMarchAnim` | 6342-6375 |
| `skyStatus`, `skyWhen`, `skyLaneIcon`, `skyRegister`, `skyAssign`, `skyMarch`, `skyClaim` | 6376-6389 |
| `skyWarSummaryHTML`, `skyMatchHTML`, `skyPanelHTML` | 6392-6481 |
| `openGuildShop` (world-map modal) | 9520-9521 |
| Mock `GUILD_NAME`, `GUILD_MOTD`, `GUILD_MEMBERS` | 9524-9530 |
| `GUILD_BASE_CAP`, `GUILD_CAP_PER_LEVEL`, `GUILD_MAX_CAP`, `GUILD_MAX_LEVEL`, `guildLevel`, `guildExp`, `guildMaxPlayers`, `guildExpNeeded`, `guildShopSlots`, `guildMaxed` | 9533-9540 |
| `addGuildExp`, `rollContribs`, `doContribute` | 9541-9562 |
| `GUILD_SHOP` | 9564-9579 |
| `renderGuildShopInto` | 9580-9617 |
| Embassy: `embassyMineMul`, `embassyContribMul`, `embassyRaidMul`, `embassyStamBonus`, `EMBASSY_PERKS`, `bestTeamPower`, `guildMemberCount` | 9619-9630 |
| Dead local raid boss: `GUILD_RAID_ATTEMPTS`, `GUILD_BOSS_NAMES`, `guildBossMax`, `guildBossEnsure`, `guildBossName`, `guildBossAttemptsLeft`, `guildBossKillReward`, `guildBossPassiveTick`, `guildBossAssault` | 9634-9668 |
| `GS`, `syncLocalGuild`, `guildFetch`, `guildRefresh`, `startGuildPoll`, `stopGuildPoll`, `guildAct`, `doGuildLeave`, `guildMemberMenu`, `openGuildManage` | 9676-9707 |
| `guildTab`, `renderGuild` | 9708-9740 |
| `renderGuildChat` | 9741-9775 |
| `renderGuildRequests` | 9776-9786 |
| `renderGuildEmbassy` | 9788-9804 |
| `warResetLabel`, `renderGuildWar` (+ unreachable legacy), `guildWarAttackServer` | 9806-9851 |
| `renderGuildRaid` | 9853-9881 |
| `renderGuildContribute` | 9882-9897 |
| `renderGuildLevel` | 9898-9908 |
| `renderGuildLobby` | 9909-9933 |
| `renderMailWar` (player wars, not guild) | 11260 |
| `shareBattle`, `postReplayChip` (guild chat chip) | 12789-12819 |

Server (`server.js`):

| Function / route | Line |
|---|---|
| `SERVER_OWNED_SAVE_FIELDS` includes `guildCoins` | 179-198 |
| `serverTeamPower`, `ledgerTeamPower`, `hydrateRoster` | 353-387 |
| Skyfall module: `GUILD_WAR_V2_ENABLED`, `warEnabledFor`, `warNow`, `etOffsetMs`, `nyDayKey`, `WAR_LANES`, `WAR_ASSAULTS_PER_LINE`, `WAR_ROUND_NAMES`, `warWeekAnchor`, `warWeekKey`, `warSchedule`, `warTierOfGuild`, `warTierAmount`, `warEscrowRewards`, `getTournament`, `buildRegisteredLine`, `warQualifyGuild`, `warNewMatch`, `warEntrant`, `warLockMatch`, `warSurvivorHpPct`, `warDestroyedCount`, `warFinishMatch`, `warTiebreak`, `warAdvance`, `warMatchOfGuild`, `warSideView`, `warMatchView` | 1081-1296 |
| `ledgerView` (returns `guildCoins`) | 1756 |
| `EARN_RULES` (`guildshop`, `guildCoins.march`) | 1786-1798 |
| `me.lastSeen` stamp | 2225 |
| `/api/guild-war/*` routes | 2545-2663 |
| `/api/shop/buy 'pieces_guild'` | 3040-3044 |
| `/api/tx/spend` (`guildCoins` branch) | 3165-3182 |
| `/api/guild*` block: constants, `gCap`, `gExpNeed`, `findGuild`, `myGuild`, `nameOf`, `rankOf`, `isOnline`, `capWords`, `guildView` | 3909-3932 |
| Raid helpers: `RAID_ATT`, `BOSS_NAMES`, `bossMax`, `ensureRaid`, `raidView` | 3935-3943 |
| Legacy war helpers: `WAR_ATT`, `WAR_WEEK_MS`, `guildStrength`, `npcWarChamps`, `ensureWar`, `warView` | 3948-3984 |
| `/api/guild/mine`, `/browse`, `/raid`, `/war` | 3985-3997 |
| `/api/guild/create`, `/request`, `/cancelRequest` | 4001-4019 |
| Leader gate + `/approve`, `/deny`, `/kick`, `/transfer`, `/motd`, `/disband` | 4021-4045 |
| `/api/guild/leave`, `/chat`, `/contribute` | 4047-4085 |
| `/api/guild/raid/assault` | 4087-4112 |
| `/api/guild/war/attack` (retired) + dead legacy block | 4114-4135 |

---

# THE RAID BOSS IS A REAL BATTLE — BUILT AND LIVE (v666-v672, 19 Sep 2026)

**Shipped exactly as designed below, with the tuning that followed. The live numbers are in the SHIPPED box at the end of this section; the design notes are kept because they explain WHY each piece is built from an existing one.**

**Phil:** *"Fix raid boss — the raid boss should send you into a battle, your 5 heroes + 5 substitutes go in a fight with the raid boss. you fight until your heroes are dead or until 90 seconds are over. the damage done to the boss is dealt to his total health. you should not be able to kill him easily, they have alot of health."*

## Decisions taken (Phil, 19 Sep)
| question | answer |
|---|---|
| Boss HP in the fight | **The boss enters with his REMAINING pool HP.** Early tiers he cannot die; on the last run someone lands a real killing blow. |
| Attempts per member per day | **3** (was 5) |
| Who the boss is | **The 20 in-game bosses, in order, one per tier.** Their own art and kit. *"for now just put 20 ill add more"* |

## The 20 raid tiers, in order (keys as they exist in `MONSTER_TYPES`, names as the game shows them)

**HISTORY (superseded by v673 - see server.js `RAID_BOSSES`): Sylphice moved from tier 6 to tier 15; live order 1 Wintercrag, 2 Magmourn, 3 Voraxis, 4 Grommash, 5 Leviath, 6 Vharok, 7 Nerissa, 8 Barrowmaw, 9 Asterion, 10 Maelvara, 11 Brukk, 12 Nymira, 13 Irix, 14 Kharos, 15 Sylphice, 16 Miregor, 17 Sable Vesper, 18 Orryx, 19 Thorneveil, 20 The Nameless Admiral.**
1 `wintercrag` Wintercrag · 2 `magmourn` Magmourn · 3 `voraxis` Voraxis · 4 `grommash` Grommash ·
5 `leviath` Leviath · 6 `sylphice` Sylphice · 7 `vharok` Vharok, Kiln-Heart Tyrant ·
8 `nerissa` Nerissa, Crown of the Drowned · 9 `barrowmaw` Barrowmaw, Ossuary Devourer ·
10 `asterion` Asterion, Mirror Warden · 11 `maelvara` Maelvara, Stormnest Matriarch ·
12 `brukk` Brukk, Master of the Black Kiln · 13 `nymira` Nymira, the Sunken Bloom ·
14 `irix` Irix, the Sky-Shard Roc · 15 `hourglass sentinel` Kharos, Hourglass Sentinel ·
16 `miregor` Miregor, King of the Briar March · 17 `sable vesper` Sable Vesper, Choir of Crows ·
18 `orryx` Orryx, the Glass Minotaur · 19 `thorneveil` Thorneveil, Warden of the Ash Grove ·
20 `nameless admiral` The Nameless Admiral

**The list is one array in one place so a new boss is one line.** Past the end of the list it loops, with the tier scaling continuing.

**DELETE the seven invented raid names** currently in `server.js:4826` (`Gorehollow the Ravager`, `Sablewing the Black Wyrm`, `The Ashen Colossus`, `Molgra Fist of Ruin`, `Vaelthrun the Deathless`, `Irongale Behemoth`, `Nyxaroth the Devourer`) — they are not in-game names (Phil's standing rule).

## What exists today (the thing being replaced)
- `server.js:4825` `RAID_ATT=5`; `:4826` invented names; `:4827` `bossMax(lvl)=round(80000*1.6^(lvl-1))`; `:4828` `ensureRaid`; `:4830` `raidView`.
- `server.js:4977` `/api/guild/raid/assault` — **the whole fight is one line**: `dmg = power*(1.4+random*0.8)` where power comes from the ledger (that route was exploited ~560× before power moved off the client save).
- Client `emberweave-heroes.html:16932` `renderGuildRaid` — HP bar, contribution table, one assault button.

## What it is built from (all of this already exists — nothing new invented)
| piece | where | note |
|---|---|---|
| 90-second fight + countdown banner | `BATTLE_TIME_LIMIT=90` `:4629`, timeout `:10973`, banner `:19680` | already the campaign rule |
| 5 fight + 5 backup, substitutes stepping in | `vaultPickerHTML :12337`, `vaultLaunch :12370`, `vaultReinforce :10437`, `vaultPickSub :10463` | gated only by `CUR.mode==='vault'` — open the gate to raid |
| squad screen cap of 10 | `:15028` `pickCap = isVault ? TEAM_SIZE*2 : TEAM_SIZE` | add raid |
| server-frozen squad + seed | `/api/campaign/start` `server.js:3896`, `snapshotHeroFromServer`, `campaignHeroSpec`, `host.snapFromSpecs` | copy this shape |
| headless verification | `server/sim-host.js:105 load()`, `:141 campaign()`; client `simCampaignReplay :7586` | a raid replay is the same idea with one authored wave |
| spawning a boss in a wave | wave builder `:7857`, `spawn.push({key,boss:true})` `:7874` | the raid wave is one entry |

## The shape to build
1. **`/api/guild/raid/start`** — checks guild, attempts left (3/day) and rate limit; freezes the 10 hero specs through `campaignHeroSpec` + `host.snapFromSpecs`; issues the seed; returns `{attemptId, seed, snaps, boss:{key,name,tier,hp}}` where **`hp` is the pool's remaining HP**. The attempt is consumed here (so a quit still costs the attempt), with the same session/abandon handling as campaign.
2. **Client raid battle** — `CUR={mode:'raid', attemptId, seed, serverSnaps, backups, raidBoss}`; spawn the boss as a single enemy with that HP and its own kit; the substitution loop enabled for this mode; 90-second clock; the fight ends when the heroes are all dead, the clock runs out, or the boss falls.
3. **Damage accounting** — damage dealt to the boss unit during the fight (clamped to his pool HP) is the run's result.
4. **`/api/guild/raid/resolve`** — `{attemptId, inputLog, digest, dmg}`; the server **replays the fight through sim-host** and takes ITS damage figure, never the client's; applies it to `r.hp`, adds to `contrib`, and on `hp<=0` runs the existing kill path (guild XP, tier up, rewards, log line, contrib wipe).

## Open tuning question — DO NOT GUESS IT
`bossMax = 80,000 × 1.6^(tier-1)` was sized for the old arithmetic. A real 90-second fight deals a completely different amount, so tier 1 would likely fall to one attempt while the late tiers become impossible. **Measure the damage a real squad deals in one 90-second fight in the rig, then set the curve with Phil.**

---

# PLANNED — WATCH THE GUILD WAR HAPPEN (designed 19 Sep 2026, not built yet)

**HISTORY (superseded by v690-v763 - see "WATCHING A MARCH" below; the watch feature was built, and prep/reveal opens at 02:00 ET since v728):**

**Phil:** *"I want to actually simulate the guild war itself, with animations and all. to see the prep stage. see the march/fight stage. not just hit simulate and it shows me a bunch of numbers."*

## What the war is today
Three separate systems share the word "war" — **do not confuse them**:
| | system | status | where |
|---|---|---|---|
| A | **Skyfall Tournament** (citadels, 5 lanes, weekly bracket) | LIVE, default on | `server.js:1480–1702`, `:2996–3196`; client `:13047–13252` |
| B | Legacy weekly champion-duel war | RETIRED dead code | `server.js:4834–4874`; client `:16896–16930` |
| C | World-map city war (declare on a castle, 30-minute prep) | LIVE, separate | client `:16082–16104`, `:16499–16510` |

**Phil's complaint is about A.** The wall lines (`WALL_CTXS`, `wallArr`, "line 2 steps in if line 1 falls") belong to **C**.

## Where the numbers come from
- Prep stage already exists and is called **planning**: opponent revealed at 00:00 ET, officers assign members to lanes via `/api/guild-war/assign` (`server.js:3040`), locks 18:00, fights 18:00–20:00 (`warSchedule :1519`, `warLockMatch :1597`).
- An assault resolves on the SERVER through an abstract round-based resolver — `SIM.resolveLineBattle` → `server/combat-core.js:289` (`while(anyAlive&&round<300)`). **It never touches the animated engine.**
- The client shows text and HP percentages (`laneRow` `:13124`), a one-emoji march (`skyBridgeHTML :13054`, `skyMarchAnim :13076`), then a banner (`skyMarch :13086`).

## The cheapest real fix (found 19 Sep)
**`/api/guild-war/assault` ALREADY returns a replay payload** — `server.js:3094`:
`replay:{ seed, lane, attacker:lineSnapshot, defender:lineSnapshot, log }`
…and the client **throws it away**. `watchBattle(meta)` (`:16131`) already converts `{v:2, seed, mineSnap, foe, won}` into a full animated fight through `startVersus`, and is already wired to "▶ Watch" buttons in arena reports, guild chat, mail and world chat.

**So: make `skyMarch()` hand `r.replay` to `watchBattle()` instead of showing a banner.** That alone turns every assault into a real animated fight.

## For the full "see the war happen" version
- Five lanes fighting at once already has a precedent: the Gauntlet Split keeps a **per-lane `battleTime`** and saves/restores it per road (`:4923–4935`, `gsplitEndBattle` dispatch `:10687`).
- The existing dev simulator `skySimReplay` (`:13197`) is Phil's own presentation layer — it plays the authoritative log across five lane rows with a sliding token and a 💥 clash (beat = `clamp(12000/log.length,58,150)`). It is the right skeleton for a prep→march→fight view; the fights inside it become real battles via the payload above.
- **The authority question to settle with Phil before building:** the war's result is decided by the round-based resolver, while the animated engine is the client tick loop. Either (a) the animated fight stays *presentation* over the server's result (cheap, safe, what `skySimReplay` does today), or (b) the war moves onto the real engine with sim-host verification like campaign and province (bigger, and changes war balance).

## SHIPPED — the raid as it actually runs (v672, 19 Sep 2026)

| | |
|---|---|
| **Attempts** | 3 a day per member, spent on entry (a quit does not refund) |
| **The fight** | 5 fighters + 5 backups, 90 seconds, one authored wave of one boss |
| **Backups** | step in AUTOMATICALLY, in squad order, from the server's frozen snapshots — never a modal, because the server replays the same fight headlessly |
| **Boss HP in the arena** | whatever the guild has left him, so the last run lands a real killing blow |
| **Damage counted** | CUMULATIVE damage dealt (v669) — a boss that heals cannot erase a run |
| **Authority** | `/api/guild/raid/resolve` replays the transcript through sim-host and applies the REPLAY's damage; a forged claim is ignored |
| **Reward** | guild coins by damage (Guild Shop currency) + the kill package. **No hero XP.** |

### The ladder — 40 tiers
- **Normal 1–20:** the twenty in-game bosses in order. Levels **15, 17, 19 … 53** (two a boss).
- **Elite 21–40:** the same twenty as *Elite «name»*. Levels **56, 57, 58, 59, 60 · 62, 64, 66, 68, 70 · 73, 76, 79, 82, 85, 88, 91, 94, 97, 100**.
- **Pool:** `400,000 × 1.28^(tier−1)` · **Hide:** `30,000 × 1.12^(tier−1)` · **His hits:** `×(1 + 0.12·(tier−1))`, Elite `×1.5`, capped `×9`.
- A curve change keeps each guild's FRACTION of the current boss.

### Where the numbers came from
Measured in the rig with sim-host, 10-hero squads, one 90-second fight — never guessed:

| tier | green Lv15 | light Lv25 | geared Lv40 | strong Lv60 |
|---|---|---|---|---|
| 1 (Lv15, ×1.00) | 593 (62s) | 8,022 | 12,434 | 23,154 |
| 10 (Lv51, ×2.08) | 47 (30s) | 2,180 | 5,172 | 13,799 |
| 20 (Lv65, ×3.28) | 12 (22s) | 160 | 1,716 | 4,008 |
| 21 Elite (Lv70, ×5.10) | 7 (19s) | 353 | 272 | 4,557 |

**The design intent, in Phil's words:** *"so he kills your heroes faster if they arent stronger"* — the boss's rising damage wipes an under-levelled squad early, which cuts contribution far harder than mitigation alone. *"a guild shouldnt be able to get the first boss down on day 1"*: an 8-member guild in light gear needs about two days for tier 1.

### The board (v671)
His health bar reads `hp / max · %`. A **BOSS CONTRIBUTION** panel sits beside the boss frame (stacked on a phone): rank, name, share bar, per cent, damage — biggest first, up to ten — refreshed every 4 seconds while the tab is open.

### Self-healing bosses (measured)
Full heal inside 90 s: **Sylphice, Nerissa, Nymira, Thorneveil**. Partial: **Voraxis ~24%**, **Asterion ~8%**.
**DONE (v673):** Sylphice is tier 15 in `RAID_BOSSES` (Phil asked for it).

---

# THE SKYFALL BOARD (v690–v721, 20 Sep 2026)

The Skyfall war is watched on **its own screen** (`#skyfall`, in `SCREENS`, listed in `fillWide`), not in a modal. The simulator and the live war draw the **same board** from the same builder — Phil: *"I want the simulation to be exactly like the real thing just with a couple more buttons"*.

## Geometry — why everything is placed in pixels

`.skyStage` declares `aspect-ratio:16/10` **and does not get it**. `fillWide` gives it **772 × 354** on Phil's phone, which is 2.18:1. A percentage of the stage's WIDTH is therefore not a knowable percentage of its HEIGHT, and anything positioned vertically by percentage lands somewhere else. Bridges, towers, march lines, clashes and garrison counts are all measured and set in pixels by `skyLayoutBoard()`, which a `ResizeObserver` re-runs.

### The lane table

    SKY_PLAT_R    = 8      platform diameter, % of stage width
    SKY_LANE_BOW  = 12     how far the middle lanes bow outward
    SKY_LANE_A0   = {x:18, y:38}
    SKY_LANE_STEP = {x:0,  y:13}
    SKY_BRIDGE_V  = {x:56, y:-12}
    SKY_SHIFT_X   = 4      the whole formation, nudged right

- **The lazy Vs.** Bow weight is `0, ½, 1, ½, 0`, so the left row reads `<` and the right `>`.
- **Parallel lanes.** The bridge keeps a constant *slope*, not a constant vector: `dy` is scaled to `dx`. A constant `dy` gave every lane a different angle, which fanned them (v693).
- **Measured:** left column x = 22/16/10/16/22, right = 78/84/90/84/78, all bridges at the same angle. Frame clearance 52.5px left and 52.5px right.

### Towers

    SKY_TOWER_LIFT = 0.35   platform-widths the base hovers ABOVE the disc's centre
    tower height   = min(plat × 1.10, topY − plat×LIFT − 3)

- Height is capped by whatever clears the frame above the **highest** platform, since all five share one height. The frame allows 1.43; Phil called that too big.
- At lift 0.50 the tower reads as an object unrelated to its disc; at 0.02 there is no gap at all. 0.35 shows sky under the island.
- Each tower **bobs** on its own period, phase and swing, derived from lane+side (not `Math.random`), so a board redraws identically. `prefers-reduced-motion` turns it off.
- **A tower that falls drops onto its own disc** and only becomes the ruin on the landing, with a thud and a ring of dust. It falls exactly `LIFT`, so it comes to rest dead centre. Where a landed tower rests is decided in `skyLayoutBoard` with everything else, so a resize cannot put a burnt-out ruin back in the air.

### Art
`/assets/img/battlefields/skyfall/` — `sky`, `platform`, `bridge`, `tower-{key}`, `ruin-{key}` for the five keys `irongate, stormwatch, crownspire, verdant, rift` (lane order). `SKY_ART_CLASH` is the sword-clash loop: **empty**, a swinging blade standing in.

## The attack scene

- **A dotted march line** runs from each tower to its own bridge's midpoint. It is a repeating gradient, not a dotted border — a border cannot be animated, so the crawl did nothing.
- **A clash sits on every bridge midpoint** (`plat × 0.58 × 0.80`). The five midpoints are only 41–50px apart, which is why the clash cannot be much larger and why **the bridges carry no lane names at all** — a name lifted clear of its own swords lands on the lane above's.
- **Both are hidden until the stage is MARCH** (`.skyStage.marching`). A board in PREP showing march lines and crossed swords says a war is happening when none is.
- **The marching figure is the line's own hero**, walking — the hero on that player's card (`defenders[].heroes[0]`), stepped from its `BATTLE_ANIM[key].walk` sheet, with the player's name under him. He walks the dotted line to the swords and is gone the moment he arrives.
  - **Facing:** `BATTLE_ANIM.flip` is the sheet's own correction to face right; marching the other way mirrors it again.
  - **Feet:** a sheet's boots are *not* at the bottom of its frame (`feet/fh`, e.g. The Annotator 509/528), so the figure drops by that gap to stand on the deck. Measured: boots land within −5.1px to +2.3px of the lane line.
  - **Pace: `SKY_WALK_PX_S = 112.5` stage-px/s, shared by everyone**, capped at 45% of the fight. It is a pace and not a fraction of the fight because the lanes are different lengths — 217px on lane 0, 310px on lane 2 — and a fixed fraction turned that into a speed difference.

## Timing — a fight takes as long as the fight takes

Phil: *"if the fight would take 33 seconds, that lines fight does not report loss or win until that fight is actually over"*.

    SKY_SEC_PER_ROUND = 1.5
    SKY_FIGHT_CAP_S   = 90          (= BATTLE_TIME_LIMIT)
    fightMs = min(90, rounds × 1.5) × 1000

`combat-core` resolves the war, so a fight's length **is** its round count, which the server has always recorded on each log entry. Measured across 1080 fights out of the engine: median 8 rounds, p75 12, p90 21, max 300 (the stalemate cap). 22 rounds resolves to 33.0s.

**Nothing reports early.** The walk, then the clash, then — and only then — a line comes off a count or a tower is touched. This is *"never announce early victory"* one level down: a lane does not know it has lost until its line is actually dead.

## Five lanes at once

The log is dealt into five queues by lane and run side by side. Within a lane the order is exactly the server's; nothing is synchronised across lanes, so a lane of grinds falls behind a lane of routs. Determinism is untouched — the server resolved the whole war before a frame was drawn; this changes only **when** each decided result is shown.

**The speed bar** re-reads `SKYSIM.speed` every ~120ms of wall clock, and the marching token is stepped from those same slices. A CSS transition cannot be used for it: a transition's duration is fixed the moment it is set. Measured: a 20-fight war with 60s of fighting per lane runs in 3.36s at 20×; flipping 1×→20× two seconds in finishes at 5.2s rather than 60s.

## The lane report

Each lane's swords open **that lane's** report — its fights, its records, and the lines standing in its own two towers. Tapping the same swords closes it.

- The war's clock (`SKYSIM.cur`) indexes the **whole** log; with five lanes concurrent the war's current fight belongs to some other lane, so each lane finds the last of **its own** fights to have happened by then.
- **Fixed height** `min(90%, 330px)`, identical on Live and Records (measured 324px / 324px, inside a 354px board). The shell is built once per lane+tab and only the body refreshes, carrying its scroll — it re-renders on every march start, which is several times a second.

## Moving lines, in PREP only

Click a tower → the players holding it, weakest total power first, each with their lines and one **move all to** row. Moving a player moves **every line they own**, together.

- Live war: leader or officer. Simulator: prep alone, since a sandbox has no officers.
- **Grouping key** is `memberId` when there is one, otherwise the defender name **with its "· line N" suffix stripped** — keying on the raw name made one player with three lines group as three players with one.
- Measured: 3 players / 9 lines / 15 buttons; moving one set takes Iron Gate 9→6 and Verdant 0→3, both discs following.

## Rules this board obeys (Phil's, verbatim)

- *"all 5 lines fight until one side is zero until the end. to include if 3 towers already go down."*
- *"the only win condition is 3/5+ towers won wins."*
- *"each fight can win, MAX 5 fights before its retired"* — the cap is per LINE, so a tower of 20 lines can take 100.
- *"NEVER announce early victory due to determinism, people hold hope until the very last line died."*
- *"If you move 1 player, it moves all his lines."*
- *"The lines should not be in order of power. The allies total powers of all their lines is calculated. The players with lowest power goes to the top."*

## Open (as of v721 — all three were closed in v724–v727, see the next section)

- ~~`SKY_ART_CLASH` empty~~ — keyed and looping in v726.
- ~~Burning towers are stills~~ — animated in v724.
- ~~The battle-report rows are blocked on data~~ — the log carries both line-ups from v726.

---

# SKYFALL, v722–v728 (20 Sep 2026) — what changed after the board was built

## The burning towers are animation, not stills

`ruin-{key}.webp` is now a **looping animated WebP with alpha**, at the same path the board already asked for — so nothing in the board's code knows a ruin moves. The fall wired in v709 lands a tower on its disc and it is already burning.

**Green screen, not grey.** Phil made the plates and the renders. This is the finding that matters:

> Against **grey**, smoke and the background are the same VALUE, so the only available key is "flood in from the border and clear what matches" — which cannot tell one from the other. That is why every plume came out holed and why tuning the keyer made it worse. Against **green**, greenness is measurable per pixel and continuous: smoke that is 30% opaque reads as 30% alpha.

**Every threshold is read off the clip, never carried over.** The five renders came back with background spill of 96, 102, 134, 147 and 218, and the still plate read 148 — a hardcoded number keys half a frame as partial alpha. The clear point is the 5th percentile of each clip's own border.

**Despill applies to every green-dominant pixel**, not only the ones being made transparent; otherwise lightly tinted smoke carries green onto the sky.

**The plume fades at the top** where it runs off the render, over the top 34% with the very top cleared — a plume cut by a frame edge ends on a straight horizontal line, which is the one shape smoke never makes. Applied only where the smoke actually reaches the top, measured per clip; of the five only Verdant tripped it.

**The loop length is measured, not assumed.** Four crossfade lengths are tried and the one that measures seamless is kept. 25% won every time, but on Verdant 32% measured 3.98 — nine times worse.

| tower | size | seam vs frame step |
|---|---|---|
| Iron Gate | 172×232 | 0.44 vs 1.10 |
| Storm Watch | 89×258 | 0.43 vs 1.11 |
| Crown Spire | 128×261 | 0.27 vs 0.81 |
| Verdant Sanctuary | 186×283 | 0.41 vs 0.79 |
| Rift Tower | 127×291 | 0.51 vs 0.81 |

Tools: `Open Projects/6 - Guild, Skyfall and Arena/SKYFALL WAR ART (19 Sep 2026)/tools/greenclip.py`.

## The sword clash

`SKY_ART_CLASH` → `clash-loop.webp`, **keyed with real alpha and composited normally**. It is *not* blended.

- A `mix-blend-mode:screen` version was tried first because the clip is on black. Two faults: screen makes everything translucent in proportion to brightness and this sky is white cloud, so steel washes out; and **an ancestor with `opacity` creates a stacking context, which isolates `mix-blend-mode`** — the clashes rendered as black rectangles.
- Keyed on **value** (`max(r,g,b)`), not luminance, so a dark leather grip reads solid. **Unpremultiplied**, so soft edges carry no grey fringe onto a bright sky. Solid above value 44 — at 96 the steel's own mid-tones came out part-transparent and the sky showed through the swords.
- Always take the **Without Watermark** download from the item, not the `<video>` element's `currentSrc`, which is the watermarked preview.
- **Every lane's swords are the same size.** A scale-up on the fighting lane was tried and removed at Phil's word; a hot lane is marked by its glow.
- The box takes the clip's own aspect (`SKY_CLASH_AR`), not a square — the swords cross along the bridge, and only the height has to stay clear of the neighbouring lanes.

Tool: `tools/clashkey.py`.

**OPEN:** at 62×28 on a phone the blades are too small to read against cloud, because the 41–50px lane gap caps the height. Either the clash grows and overlaps its neighbours, or the clip is cropped tighter so the same box holds bigger blades. Phil's call.

## The battle report (Records tab)

Each fight is a **row**, as Phil's reference screenshot lays it out: the two line-ups facing each other across the verdict, with a Watch button between them.

- **Your side is always the blue box on the left**, whoever marched. Side A is your guild, so on a B fight you are the defender; drawing them in log order put the enemy on the left on half the rows.
- **The verdict reads from your side** — the attacker losing IS your victory when the attacker is theirs.
- Below 430px the two sides stack rather than squeezing five cards into 40px each.
- A fight with no line-ups (a war resolved before the server recorded them) falls back to the old text line, so history stays readable.

**Server side:** every log entry carries `aTeam`/`dTeam` as `{k:key, l:level, s:stars}` — ten small objects per fight. `heroCombatStats` was already computing the star rating and discarding it; `u.stars`/`u.pips` now travel with the unit so a card can wear the right ascension frame.

## A lane that has finished clears itself

When a lane's queue empties it removes **its own** dotted runs and swords (`.spent`), so a glance at the board says which fronts are still live.

That takes away the button its report lived on, so **the tower takes that job**: tapping either end of a spent lane opens that lane's battle results on Records. A lane still fighting keeps the garrison panel, which is what you want while there is still something to move. The spent check is read at click time, because a lane becomes spent while the handlers are already bound.

## The war day runs 02:00 → 02:00

Phil: *"The reports of the lanes stay up until 0200 in the morning then the lanes reset to prepare prep stage for the next day. Starting 0200 players can re place their lines in the towers."*

    02:00   prep opens · lines may be re-placed · the opponent is revealed
    18:00   lines lock
    20:00   the last bell
    20:00 → 02:00   the lane reports stand
    02:00   the board resets into the next day's prep

`WAR_PREP_OPENS_H = 2`, `WAR_LOCK_H = 18`, `WAR_BELL_H = 20`. The reports window is **derived** — `resultsUntil` is the next day's `planningOpensAt`, so the two halves cannot drift apart. `resultsUntil` and `nextPrepOpensAt` go out on the match view.

**Line re-placement needed no new code:** `revealAt` IS the planning open and the assign route already refuses before it, so moving `planningOpensAt` to 02:00 moved the reveal and the placement window with it.

Verified against a real `America/New_York` clock:

| round | prep | lock | bell | reports until |
|---|---|---|---|---|
| R16 | Tue 02:00 | Tue 18:00 | Tue 20:00 | Wed 02:00 |
| QF | Wed 02:00 | Wed 18:00 | Wed 20:00 | Thu 02:00 |
| SF | Thu 02:00 | Thu 18:00 | Thu 20:00 | Fri 02:00 |
| F | Fri 02:00 | Fri 18:00 | Fri 20:00 | Sat 02:00 |

Six hours of reports after each bell; every window ends exactly when the next prep opens.

## Other fixes in this range

- **The tower panel was showing the ending.** It read `citadel.defenders[].alive`, which is the state after the LAST march of the war, so opening a tower mid-war showed who would be dead at the end — "FALLEN · 0/12 lines standing" over a tower that had not fallen. It counts from the log prefix via `skyLiveTally` now, exactly as the lane report does. It also refreshes in place at a fixed height with its scroll carried, and its buttons are re-bound after each refresh.
- **The swords outlive the fighting.** Hiding them behind `.marching` took them off the board the moment a war ended, along with every lane's Live and Records. A march line shows movement and belongs to the march; the swords are a report button and arrive with the first march and stay (`.fought`).
- **The stage pill** was written once by `skyBoardHTML` and never updated, so it read PREP while the line under it announced the march. Updated in `skyMarchVis`: PREP → MARCH → DONE.


# SKYFALL, v729-v736 (20 Sep 2026) - the panels, and one hero to one line

## A HERO STANDS ON ONE LINE AND ONE LINE ONLY

Phil, 20 Sep: *"make sure, each line heroes are unique. They cannot be used multiple times like you
did"* / *"All 7 lines requires 35 unique heroes"*.

**The rule:** within one player, no hero may appear on two of their lines. Seven lines is therefore
exactly 35 distinct heroes, six lines is 30, and a player who owns 34 heroes can field six lines
with four heroes spare. Across DIFFERENT players reuse is expected and fine - two people own the
same hero.

**It is a property of how a line is built, never a check run afterwards.** Both builders deal from
one pool per player, drawn without replacement, so there is no code path that can produce a
duplicate in the first place.

| where | builder | how it deals |
|---|---|---|
| the real war | `buildRegisteredLines(u)` | the member's OWNED heroes sorted by power, sliced in fives, up to `WAR_LINES_MAX` |
| the sim's bots | `botLines(n, mul)` | one pool per role, drawn without replacement across ALL of that player's lines |
| the sim's own player | `mine.slice(i*5, i*5+5)` | unchanged - this half was always correct |

`buildRegisteredLine(u)` still exists and returns the member's single strongest line, for callers
that only want one.

**What was wrong:** `botLine(mul)` built one line at a time with a `used` set scoped to that line and
then discarded it. Seven calls meant seven fresh sets against sixty heroes. Measured over 500 trials
it produced **27.2 distinct heroes out of 35 on average, worst case one hero holding 15 extra slots,
and not one clean board in five hundred.** The new dealer is 35/35 every time.

The role shape survives: sixty heroes exist and the thinnest pool (Support, 10) is deeper than
`WAR_LINES_MAX`, so seven role-correct lines are always reachable. The fallback to any unused hero
exists only for a hero table that ever gets thinner, and keeps uniqueness even then.

### A member owns several lines now, and everything downstream had to learn that

- `warQualifyGuild` **flatMaps** `buildRegisteredLines` - a member brings every line their roster can
  fill, not just their best five.
- `side.unplaced` carries `{memberId, line}` instead of a bare id. An older board's bare id still
  reads.
- **`warLockMatch` matches on `memberId` AND `line`.** It used to take
  `ent.lines.find(l => l.memberId === d.memberId)` - the FIRST line - so every line after a member's
  first would have been silently dropped at the 18:00 lock. An entry with no line index expands into
  all of that member's lines; a `seen` set stops one being hydrated twice if a member somehow sits
  in two citadels.
- `warMatchView`'s placement roster carries `line` on every entry.
- `/api/guild-war/assign` needed **no change** - it already moves all of a member's lines together.
- `m.assaults` stays keyed by member, not by line: the assault budget is the person's, so every line
  they own shows the same remaining orders. That is intended.

## THE POPUP PANELS

Bracket, Rank, Schedule and Edit Team share one frame (`skyPanelFrame`), so opening one closes the
last and two can never stack on the board. Each is tagged `data-kind`; tapping the button of the
panel already open closes it.

All four wear the game's own UI kit rather than a debug box: `hud-panel.webp` nine-sliced at 96 for
the frame, `hud-plaque.webp` (sliced `0 92`) for the tab bar.

**Bracket** - sixteen guilds, single elimination, **no loser bracket** (Phil: *"Except no loser or
winne bracket"*, *"Only 16 guilds fight"*, *"Later we will consider another bracket"*). Eight down
each side converging on the trophy, NOT the reference's four quadrants: the reference is drawn for a
tall screen and Phil's board is 772x354, so left-and-right uses the room that exists. Rounds the
server has not created yet draw as empty sockets.

**Rank** - *"Ranking should be your guild members ranked by power"*. Read off the board itself: a
member's standing is the sum of the lines they committed, which is the same number the tower panel
groups by, so the ranking and the towers cannot disagree. Sorted **strongest-first**, deliberately
the opposite of a tower's list, which is weakest-first because that is the order it fights in.

**Schedule** - drawn from the server's tournament schedule, not a copy written into the client. Each
round shows its 02:00 prep, 18:00 lock, 20:00 bell and when its reports come down, with the live
round marked.

**Edit Team** - *"Edit team is your individual line edit. Not editing the guild's line placement /
You click towers to move allies."* So this panel never touches placement; that stays on the tower
panel.

## EDIT TEAM'S LAYOUT, AND WHY THE EMPTY SPACE WAS NOT THE CARDS

Phil: *"There is too much empty space"*, then *"7 lines going down. Adjust and disband beside all of
them"*, *"I dont want the cards grown.. The size they are now is good"*, *"Just make it 1 row and
move the pop up windows right"*.

Measured on his 780x360: a row was 599.8 wide and its five cards used 272 - **184.3px of void per
row, 30% of the row.**

**The row was never too small. The panel was too wide for it.** A row needs 419.5px measured; the
panel was 646.8. Two attempts fixed the wrong end and were rejected:

- **two columns** (v734) - wrong shape, his reference is one troop per row
- **growing the cards to fill** (v735) - the cards were already the size he wanted

The answer is to cut the panel onto the row. `.skyBrk[data-kind="team"]` is **460px wide**; holding
its right edge puts it at x=290 instead of x=96, which is also the "move the pop up windows right"
he asked for. Cards stay at exactly **52px**, the track is `flex:none` so nothing stretches past
them, and the void is **1.5px**.

    void per row   184.3px -> 1.5px
    team panel     646.8   -> 460 wide, left 96 -> 290
    other panels   left 96 -> 120 (off the Guild button, full width kept for the bracket tree)

A row is POWER, the five cards, then that line's own Adjust and Disband. The header states the rule
by counting the distinct keys actually on the board - `7 lines - 35 unique heroes - none reused` -
so if a hero ever stood on two lines the panel would say so rather than quietly showing it.

**Three of the seven rows fit on screen; the rest scroll.** All seven at once needs a ~30px row,
which needs a ~25px card, which Phil ruled out. **OPEN:** whether that stands.

## EDITING A LINE (v740-v744, 20 Sep 2026)

Phil: *"Right now the buttons on edit team are completely cosmetic. I cannot click adjust or disband
on any line. I cannot click add line or save"*.

They were cosmetic because nothing was behind them: a war line was DERIVED on every read from the
member's five strongest owned heroes, so there was no choice to make and nowhere to keep one.

**A member's line-up is now a stored choice.** `u.warLines` holds arrays of hero keys.
`buildRegisteredLines` prefers it and falls back to the automatic deal for anyone who has never
opened the screen, so nothing changes for a player who does not use it. A stored line-up is
re-checked against the ledger on every read, not trusted from when it was written.

| button | what it does |
|---|---|
| **Adjust** | opens the picker for that line: its five slots above, the bench below |
| **Disband** | removes the line; its five return to the bench |
| **Add Line** | builds a line from the five strongest on the bench, up to the cap |
| **Save** | POSTs the whole set |

**The bench is what makes the unique-hero rule unbreakable from the UI.** It is *owned minus
everything standing on a line*, so a hero who is already on a line is simply not in the list you can
pick from. A swap puts the bench hero in the slot and the displaced one back on the bench, so the
set stays a partition of the roster at every moment.

**Nothing is written until Save.** Edits live in `SKYTEAM` until then, so a mistake is undone by
reopening rather than by another write, and the footer says when there are unsaved changes instead
of pretending the board already moved.

**The server is the authority, and a rejected save changes nothing.** `warLinesValidate` re-checks,
against the server's own ledger: every hero is real and OWNED, every line is exactly five, there are
no more lines than `WAR_LINES_MAX`, and no hero appears twice across the whole set. The payload is
validated into a fresh array and only assigned once the whole thing is known good. An empty array
clears the choice and hands the member back to the automatic deal.

Verified against the live routes: 22 checks pass, including six tampered payloads (a hero on two
lines, a line of four, an unknown key, an unowned hero, more lines than the cap, and a non-array)
that are each refused AND leave the stored line-up byte-identical.

**Lines may be changed until your match locks** - the same window as line placement. `GET
/api/guild-war/lines` carries `editable` and the reason, and the POST refuses outright once the war
has begun. The GET branch sits above the handler's `if(req.method!=='POST')` guard, so it carries a
method check of its own; without one it answered POSTs too and the save route was unreachable -
every save came back ok and changed nothing, including the ones that should have been refused.

**The panel reads the server, not the board.** The board shows what is COMMITTED to a citadel; this
screen edits what you will bring, which exists before a match does. When that request cannot be
answered - the simulator, or a player not in a war - it falls back to a read-only view off the board
and says so.

## THE SWORDS USE .skyHot, NEVER .hot (v745)

Phil: *"When I click on the swords in the beginning battle report doesnt show up"* / *"During
battle"*.

**A cascade collision on a bare class name.** The hub screen defines, unscoped:

    .hot{position:absolute;transform:translate(-50%,-50%);z-index:2;pointer-events:none;}

It is the hub's building hotspot, sitting beside `.hit` ("shaped clickable area tracing the building
silhouette"). The Skyfall board later took the same bare name to mean *this lane is fighting*, so the
moment a sword went hot it inherited `pointer-events:none` from a rule written for a different
screen. `.skyLaneClash` never declares pointer-events, so nothing overrode it: the button was
removed from hit testing and a tap fell through to the sky behind it.

Measured on the rig with a lane fighting:

| | before | after |
|---|---|---|
| computed pointer-events | none | **auto** |
| elementFromPoint at its centre | DIV.skyBoardSky | **BUTTON.skyLaneClash.skyHot** |

**It looked fine to code the whole time.** A scripted `.click()` bypasses hit testing entirely, so
the hub opened at 430x324 on every call. Only a real hit test found it - which is the lesson: to
prove a control is TAPPABLE, use `elementFromPoint` or dispatch at a coordinate, never `el.click()`.

**The board renamed, not the hub, and no counter-declaration was added.** Patching
`pointer-events:auto` onto `.skyLaneClash` would paper over a name shared with another screen and the
collision would come back the next time either side added a declaration. `.hot` belonged to the hub
first, so every sky use moved to `.skyHot` - the swords, the march lines, `.skyClash` and
`.skyLines path` - and the hub's rule now carries a note saying not to reuse the name.

## THE REAL BOARD DOES NOT INHERIT THE SIMULATOR'S STAGE (v741)

Phil: *"when I end simulation and enter the real sky fall. It says im still in March stage"*.

`SKYSIM.marching` is a module-level flag and the board read it directly - for the stage pill AND for
`isPrep`, which decides whether a tower may be rearranged. A replay clears it when it finishes, but an
ABANDONED replay never gets there: the loop exits on `stopped()` the moment `#skyStage` goes away. So
leaving the screen mid-war left the flag true, and the next real Skyfall rendered MARCH over a war
in prep and quietly refused tower moves.

**Outside a sandbox the stage comes from the match the server reports** - planning is PREP, live is
MARCH, finished is DONE - which nothing the client did can leave stale. And any render that is not
part of a running sim clears the leftovers first.

**PLANNED (Phil, 20 Sep 2026): a line maximum per VIP level.** *"Later we will put a line maximum
per vip level."* `WAR_LINES_MAX` is a single constant today and every player is capped at seven.
It becomes a per-player number read from VIP level, which means: the cap has to travel on the
match/roster view rather than being a client constant, `buildRegisteredLines` takes the member's own
cap instead of the global one, and Edit Team's "Lines: n/cap" and Add Line read that number. Not
built - do not assume seven anywhere new.

## THE MARCH SENDS BOTH LINES

A fight is two lines meeting, so both walk out and the swords wait until they arrive, rather than a
single figure crossing to a clash that had already started.


# SKYFALL, v746-v763 (20 Sep 2026) - the live fight, watching a march, and skill levels

## THE LIVE FIGHT (Phil's "Top Lane in Battle" reference)

Three bands, top to bottom: the two guilds with lines-left, the current fight with both five-card
line-ups facing across a clock, then WAITING TROOPS in two columns - allies left, enemies right.

**Weakest at the TOP, and it is not a ranking** - it is the order they will fight in. The war sends
the weakest living line first, attacking and defending, so the top of each column is genuinely who
steps up next. A tower lists its garrison the same way for the same reason.

**"The winner stays" needed no new logic.** A line already holds the front while it keeps winning,
to the five-kill cap, so consecutive fights in a lane share the standing winner and the queue simply
shortens under the fight.

A waiting row opens to its five heroes. Levels come from the log where that line has fought
(aTeam/dTeam carry {k,l,s}) and are left off until there is a real number.

## WATCHING A MARCH

**The war keeps running while you watch** (Phil: *"should keep going while im in"*). It is not
paused and it must never touch `skipReplay` - that is the ABORT flag, `stopped()` reads it and every
lane's loop RETURNS, which is what used to end a war the moment you opened one march.

**Coming back must not rebuild the board.** `renderSkyfall` rewrites #skyfallBody and replaces
#skyStage; the lane loops survive but every element they hold - garrison counters, towers, swords -
becomes a detached node, and the war plays on into a board nobody can see. The Skyfall screen is
never torn down by opening a battle, so a RUNNING war simply shows the board it left.

**Skip is not offered on a replay** (Phil: *"I dont want people joining then leaving to see the
results before they happen"*). Skip runs the sim to its end and opens the result screen - on a war
march that is the outcome handed over while the board is still playing it, lane by lane. Replays
get **Leave**, which resolves nothing and never opens a result screen. Arena, raids and Elite keep
Skip: their result is your own and nothing else is about to reveal it.

### A SERVER SNAPSHOT IS NOT A CLIENT SNAPSHOT

The single most expensive bug in this range. `buildUnitFromSnapshot` copies ~40 fields from the
CLIENT's shape (`snapUnitResolved`). The war capture hands it the SERVER's `lineSnapshot`:

| | carries |
|---|---|
| client wants | dmg, range, atkInterval, combatDist, r, melee, reach, apow, skillLv, pass |
| server has | atk, atkP, atkM, moveSpd, armor, mr, kit, role, stars, pips |
| **absent server-side** | **all ten the client wants** |

Each was assigned `undefined`, wiping what makeUnit had just computed. **A unit with no `dmg` deals
nothing.** And `speed` exists on both meaning different things - 0.85 attacks/sec server, 55 movement
client - so even the overlap corrupts.

A server snapshot is told apart by having `atk` and no `dmg`, built with makeUnit, and takes only
maxHp, hp and energy. **OPEN:** the replay is still not bit-identical to the server's resolution -
they are two separate implementations.

## SKILL LEVELS SCALE THE ULTIMATE (v762)

Phil: *"skill level directly increases the scale of skills"*.

**They had never reached the war at all.** `skillLv` appeared nowhere in `server/combat-core.js`,
which resolves every war fight, so every skill upgrade any player had bought did nothing to a guild
war. They only scaled the client's own battle, which is why the feature looked like it worked.

    SKILL_STEP = 0.0135        (in combat-core, which owns the formulas both sides share)
    skillMul(lv) = 1 + (lv-1) * SKILL_STEP        -> x2.3365 at level 100
    slot 0 = ultimate   1 = green   2 = blue   3 = passive

Slot 0 is the only ability this resolver has, and it scales the kit's **magnitude** - never stun
length, shape or target count, because the client scales magnitude only. Slots 1/2/3 ride on the
unit and change nothing server-side.

Proven: same seed and heroes, only the attacker's ult level differing - level 1 LOSES in 11 rounds
with the foe on 5578 HP; level 100 WINS in 10 and wipes them.

## THE WAR SIMULATOR BUILDS A BOT, IT DOES NOT MULTIPLY ONE (v763)

Phil: *"enemy power shouldnt be a option, the power should automatically be calculated off your
adjustment of hero level / skill level / quality / equipment / academy level"*, *"all other combat
multipliers we choose"*.

**`allyMul` and `foeMul` are deleted.** They multiplied a finished bot's hp and damage by a number
between 0.2 and 5 that nothing in the game produces, so two different builds with the same
multiplier came out identical.

A bot is built from progression a player could have, through the REAL systems:

| setting | how it is applied |
|---|---|
| hero level, stars, glyph tier | as before |
| **skill level** | `extra.skillLv`, scales the ultimate (v762) |
| **equipment** | the actual gear catalog: the item of that quality in each of nine slots, through the same temper multiplier `gearHeroFlats` uses |
| **academy level** | `ensureAcad`'s own shape through `techTotalSrv` - research 30 gives what a player at research 30 gets |

Both fold into the ratings exactly where `snapshotHeroFromServer` folds a real player's, so a bot is
a player build rather than a scaled one. **Power is REPORTED, never set.**

    bare                     33,129   |  Orange gear + temper 10   42,753
    skill 100                33,129   |  academy 40                42,767
    all three                52,393

*[Resolved by v785/v806: line power is now the sum of hero card power, which includes skill level.]* **OPEN (at the time):** power is `maxHp/8 + atk` and does NOT include skill level, so skill 100 changes who wins
without changing the number. That formula also orders lines weakest-first in every tower, so
folding skill into it is a balance change that moves fighting order - Phil's call, not a silent fix.

## COUNTING THE WAR: ONE CUTOFF, AND NEVER THE ENDING

Everything that reads mid-replay state goes through `skyLaneCutoff(r, lane)`. Three rules it exists
to enforce, each of which was broken somewhere:

1. **A lane reads its OWN cursor.** `SKYSIM.cur` is whichever fight started most recently ANYWHERE;
   the five lanes do not keep step, so a lane behind counted its own lines dead early.
2. **It stops SHORT of the fight being played.** `laneCur` is the entry currently on screen, so
   counting up to it counts a death the player is still watching. `laneDone` says whether it has
   resolved; while it has not, the count stops at the entry before.
3. **A lane that has not marched has seen NOTHING.** Falling back to the end of the log showed the
   final garrison before a line had moved.

And `skyLineAlive`: a line the tally has not heard of is **alive** during a replay. Falling back to
`d.alive` reads the state after the last march of the whole war - the ending - which is what v723
removed from the tower panel and what kept creeping back in.

**The garrison discs are READ, not counted.** They used to be decremented once per death; one
skipped decrement is permanent because nothing re-read the truth (measured: lane 2 with 5 lines, 5
played entries, 5 deaths, and a disc still claiming 1 alive). Both discs of a lane are recomputed
from `skyLiveTally` after each fight, over the same prefix the tower panel uses, so the two are the
same calculation and cannot drift. Verified frozen over six passes: zero mismatches on all ten pairs.

A tower draws each line the way the live fight does: lead portrait with level, five hero cards, the
line's power.

## THE BURNING TOWERS, AND A VERSION NUMBER REUSED

**Never replace the bytes under a `?v=` that has shipped.** sw.js: *"A ?v= URL is IMMUTABLE by
protocol - SHIPPING RULE 2.5 forbids reusing a version number"*, and `if (hit && versioned) return
hit;` - a cached versioned asset is served and NEVER revalidated.

`skyTowerArt` asked for `ruin-<key>.webp?v=1` from v703-v706 while the file behind it was replaced
twice (v711, and v724 when the animation went in). Every browser kept serving the still ruin it
cached at v703, so the burning towers were never downloaded by anyone. `clash-loop.webp` is the
proof: the one skyfall asset whose query WAS bumped, and the one that animated.

Ruins are `?v=3`; towers stay `?v=1` because their bytes never changed. The two carry separate
version constants now so one can move without re-downloading the other.

**The fall takes 3 seconds** and swaps to the burning ruin only on landing.

## A TOWER FALLS WHEN ITS LAST LINE DIES, WHOEVER EMPTIED IT (v754)

The post-fight check tested only the DEFENDING citadel. A line dies just as easily attacking, so a
side whose marches kept failing emptied its own tower and nothing marked it destroyed - it stood
over an empty plate until somebody marched in, which may never happen. Both citadels are checked,
in the simulator and in the assault route; the log carries `aFell` beside `fell` so the board knows
which tower went down. **Measured: 18 of 30 tower falls - 60% - would have left a tower standing at
0 under the old rule.**

# SKYFALL + GUILDS, v764-v774 (20 Sep 2026) - placing lines, the bracket, the banners, and the order lines are listed in

## PLACING YOUR LINES IN A TOWER (v764b, v770-v773)

**Phil's rule, stated twice and absolute: "There is no splitting up lines, a player must place all
in 1 lane" / "there is no splitting up a players lines in multiple towers".** A player holds up to
seven lines; all of them stand in ONE tower or none of them move. The server route is the enforcer:
`/api/guild-war/place` takes a lane and moves EVERY line the caller owns. It takes no line index
and cannot be asked for one, so no client - mine or anyone else's - can split a player across towers.

`memberId` comes from the session, never from the request body. A member places their own lines;
an officer's separate placement route is the only way to move somebody else.

### The panel

Tapping your own tower opens it. Inside, below the garrison list:

- **A "Place Lines Here" button, ALWAYS present on your own tower** - never conditional on the
  board knowing where your lines are. It sits at the BOTTOM (v773). Phil: *"put the place lines
  here on the bottom / so that it doesnt make the tab bounce"* - its label changes between
  "Place Lines Here" and "Your lines are here" and it is absent on an enemy tower, so anything
  above the list made every row jump when the label changed. A control at the edge can change
  freely; one in the middle moves everything under it.
- **Your own lines**, each with where it stands, or `not placed` in amber.
- **No sub-line.** v773 removed "FALLEN - 0/0": on a tower that merely has nothing in it yet that
  announces a disaster that has not happened, and the garrison disc on the board already carries
  the count.

### Why the button kept disappearing, twice

The first two attempts decided for themselves whether to draw the button, by scanning the citadels
for defenders marked `you`. **A line that has never been placed is on no citadel at all** - it sits
in the side's `unplaced` list, which the board only ever reported as a number. That is precisely
the state a player is in the first time they open a tower, so the control hid itself exactly when
it was being looked for. Phil hit it twice: *"still cannot place my lines in a tower"*.

Two fixes, and both are needed:

1. **The server tells you.** `warMatchView` now carries `you.yours` = `[{line, power, lane|null}]`,
   built from the ENTRANT (the registered lines the lock will hydrate), not from the board. An
   unplaced line is listed exactly like a placed one, with `lane: null`.
2. **The button does not decide.** On your own tower it is drawn unconditionally, and pressing it
   is what finds out - the server owns the rules and answers with the real reason if the war is
   not in planning. A control that is present and says why beats one that vanishes.

## LINES ARE LISTED WEAKEST TO STRONGEST, TOP TO BOTTOM (v774)

**This is not a new rule and never was.** The war has always sent the weakest living line out
first and always met a march with the weakest living line. Phil, when this was written up as a
change: *"That's not a new rule it always was"*. Three lists simply were not showing it.

Every place lines are listed, and what each was doing before v774:

| list | was ordered by | |
|---|---|---|
| live fight, WAITING TROOPS | power ascending | already right |
| tower panel, a player's lines | line INDEX | fixed |
| PLACE YOUR LINES rows | line INDEX | fixed |
| Edit Team rows | stored order - and the server deals STRONGEST first, so the one screen where lines are built read exactly backwards | fixed |
| the older war rows' defender chips | the server array's own order | fixed |

**Guild Ranking is deliberately NOT in this list.** That is guild members ranked by power,
strongest first, which is what Phil asked for. It is a ranking, not a fighting order.

### Edit Team is sorted for DISPLAY ONLY

`SKYTEAM.lines` is the array that gets POSTed, and **its ORDER is what becomes each line's index on
the server**. Sorting the array itself would renumber a player's lines every time they opened the
screen. So the screen renders an index list sorted by power, and every row carries its ORIGINAL
index - which is what Adjust and Disband act on. Verified: stored [25000, 1500, 5000] renders
1500, 5000, 25000 with `data-i` 1, 2, 0 and each button still pointing at the same line.

### A defending line carries its power now

The client has always sorted these lists by `power`. In the SIMULATOR that worked, because the sim
writes `power` onto each defender. **In a real war it never could.** `hydrate` built a defender from
the entrant's line and dropped `L.power` on the floor, and `warSideView` never emitted one - so
`d.power` was `undefined`, `(a.power||0)-(b.power||0)` was 0 for every pair, and every sort quietly
kept insertion order. The ordering looked correct on a rig running the simulator and was a silent
no-op in the one place that counts.

Fixed at the source: `hydrate` carries `L.power|0`, and `warSideView` emits `warDefPower(d)`,
which falls back to computing from `lineSnapshot` with the pre-v806 formula (`sum(maxHp/8 + atk)`,
rounded; `buildRegisteredLines` itself has used hero card power since v806) - needed for every match already locked and sitting in the
database. A pre-lock placeholder has neither and is honestly 0, tie-broken by line index.

## THE BRACKET IS CRESTS AROUND THE OUTSIDE, CONVERGING ON THE CUP (v767-v768)

Phil: *"your brackets are nothing like this"*, with a reference screenshot. I had built columns.
The reference is not columns: **guild crests sit around the OUTSIDE of a circular field and their
connecting lines converge inward on the trophy at the centre.** Round 1 on the outer ring, each
match's winner drawn one ring in, the champion's cup in the middle.

It is computed geometry and SVG paths - a parent sits at the mean angle of its two children, radius
stepping inward per round. **No art generation, no credits spent.**

## GUILD BANNERS (v769, v771)

Phil: *"so that we can set Guild banners. Make 20 Banners shapes, 20 default banner types and 20
colors the guild leader can choose from. also give another option to important a picture as their
banner"*.

- `GUILD_BANNER_SHAPES`, `GUILD_BANNER_EMBLEMS`, `GUILD_BANNER_COLORS` - 20 each, all drawn as SVG.
- `guildBannerSVG(banner, px)` renders one at any size; it is the single drawing path.
- `POST /api/guild/banner`, leader only. `bannerValidate` **refuses SVG outright**, checks magic
  bytes for PNG/JPEG/GIF/WebP rather than trusting the declared type, and caps the data URI at
  44,000 characters.
- The picker has four sections: SHAPE, EMBLEM, COLOUR, and **IMPORT as its own section** with a
  thumbnail of what is loaded.

### A swatch is drawn WITHOUT the imported picture

Phil: *"when i imported an icon it changed all the banners"*. Every swatch was drawn from the
CURRENT banner with one attribute changed - right for shape, emblem and colour, but `cur` includes
the uploaded picture and **an uploaded picture covers the whole field**. The moment one was
imported all sixty swatches became the same photo, and the picker stopped being a picker.

**Rule: a swatch shows what THAT option looks like, so it is always drawn with `img: null`.** The
big preview at the top is the one place the real banner is shown, picture and all.

## NO HINT NOTES (v766, v767, and game-wide)

Phil, repeatedly and in one run: *"remove the note about lines standing"* / *"these notes take
space for nothing"* / *"these little hint notes, arent needed"* / *"stop adding them"* / *"these
little notes all around are useless"* / *"another silly note"*.

**Standing rule for the whole game, not just Skyfall:** do not write a line of explanatory prose
under a control, a list or a panel. On a 780x360 phone viewport a sub-line costs a row of real
content to say what the thing above it already shows. A real message - an error, or "Saved." -
earns a line. A standing explanation of how something works does not; if a disabled button needs a
reason, it goes on that button's own `title`, read at the moment it is reached.

# THE SKYFALL AUDIT — ten tournament weeks played against the real routes (20 Sep 2026, v775-v781)

Phil: *"I need you to fully audit skyfall for bugs. Play 10 week tournaments and test it"*.

## How it was done, so it can be done again

A harness (`Pipeline tools/skyfall-audit/`) drives the **real HTTP routes** — register, seed, place,
lock, march, bell, escrow, claim — with 16 guilds of 5 players. Nothing reaches into the server's
memory. Every player holds their own session token and presents **their own `x-forwarded-for`**,
because 80 players are 80 addresses and the rate limiter is per-IP by design. The week is driven
with `/api/guild-war/debug-warp`, the dev time-warp the server already carries.

It reads two ways: the **views**, which is what a player sees and therefore what must be right; and
the **persisted DB**, read-only, for what no view exposes (kills, the unplaced list, raw snapshots).

    10 weeks · 16 guilds · 80 players · 25,046 requests · 802,784 checks

Two focused probes answer what a straight week cannot: which line marches, and what happens to a
player who never places.

## What it found — six defects, every one measured

### 1. The STRONGEST line marched, and the STRONGEST line met it

One player a side, five lines each, all in one tower:

    attacker  663 -> 568 -> 568 -> 441 -> 441 ...
    defender  663 -> 561 -> 561 -> 494 -> 405 -> 374

Both descending. The war is documented to send the **weakest** living line out first and to meet a
march with the weakest, and the board has listed them that way since v774 — **it did the opposite in
every real war.**

One buried assumption did it. `buildRegisteredLines` deals heroes **strongest first**, so
**line index 0 is a player's STRONGEST line** — and both pickers took the lowest line index.

**The rule, written down so nothing drifts back:** low line index means STRONGEST. Anything that
wants "the weakest" must sort by `power`, never by `line`.

Fixed: the attacker is the caller's weakest living line, and `warPick` keeps Phil's
lowest-total-member rule but picks that member's weakest LINE. A line that has taken its five kills
is stepped over instead of blocking the rest.

### 2. A player who never placed was split across all five towers

Measured with nobody placing, every member came out of the lock holding

    line1@lane0  line2@lane1  line3@lane2  line4@lane3  line5@lane4

The lock's auto-spread stepped its lane counter once per **line** instead of once per **member**, so
the *default* path — nobody touches the board — broke the one rule Phil has stated twice as
absolute. **Superseded entirely by v778 below: there is no auto-placement at all now.**

### 3 and 4. The real war's view was missing six fields the client reads

Confirmed off the wire — this was the whole defender object a player received:

    {memberId, line, power, you, name, alive, hpPct, assaultsLeft}

The client reads `d.heroes` in four places and `d.kills` in two. So in every real war the tower
panel printed **"no line-up recorded"** against every line, the kill counter sat at **0/5** forever,
and the marching figure had no hero to draw. Nothing was missing from the data — the heroes are
`d.lineSnapshot` and the kills are `d.kills`, both on the defender. They were never sent.

Same fault as the `power` fixed in v774, and the same cause: **the client was built against the
SIMULATOR's view, which carries all of it**, so every one of these looked right on a rig.
`warSideView` now matches the simulator's shape field for field.

### 5. The last round's reports came down two hours early, every week

Ten weeks out of ten, the board at 01:59 Saturday already showed the next week. The final round's
own `resultsUntil` says Saturday 02:00, but `warWeekAnchor` rolled the week at Saturday 00:00, so a
guild that went to bed after the Friday final lost the record of it.

The week now turns at **02:00** — the hour the rest of the war day already turns on — and
registration opens at 02:00 with it, instead of advertising a midnight window that could not be
entered.

### 6. A line gained during planning was silently dropped

A player holding 3 lines unlocked five more heroes during planning; Edit Team showed 4 lines and the
board took 3. `side.unplaced` is built once when the match is made on Monday, so a line that did not
exist then is in neither `unplaced` nor any citadel and nothing hydrates it — while `warLockMatch`'s
own comment promises changes during planning count. Now any line of the guild's **current** entrant
that nothing hydrated joins the tower its owner already stands in (and only if they placed — v778).

### And the tool itself was lying

`warNow()` truncated the dev time-warp with `|0` — a 32-bit operation on a millisecond offset, so
anything past **24.8 days wrapped negative**: 25 days became minus 24.7 days. The audit walked into
it at week 3; the week key went *backwards* and every tournament after opened already finished with
no entrants. Dev-only, but it is the tool the lifecycle is tested with and it produced nonsense
rather than refusing.

## What passed

Zero failures across ten clean weeks on: one-tower-per-player when placed · hero uniqueness within a
member · every registered line hydrated exactly once, none lost, none duplicated · power carried (the
v774 fix holds) · the five-kill cap · a tower falling only when its last line dies · the winner rule
(towers, then power pool, then seed — never a coin) · standard seeding and pairing · no guild twice
in a round · every match finished at the bell · the reports standing to 02:00 · the archive cap.

**150 matches were decided on towers (123 at 3 down, 27 at 4) and not one fell to the tie-break.**

**The reward economy balances exactly.** 16 guilds x 5 members pays `2000x5 + 1000x5 + 300x70 =
36,000` a week; over ten weeks the final ledger holds **360,000** with nothing unclaimed and
participants on exactly 3,000 each. Rewards accumulating while unclaimed is correct — that is the
escrow doing its job.

The guild banner gate is clean: SVG refused both declared and disguised as a PNG, magic bytes checked
rather than the declared type, the 40 KB cap enforced, `javascript:` and `http:` refused, indexes
range-checked, and all four leader-only guild routes return 403 to a genuine non-leader.

# PLACEMENT IS THE PLAYER'S JOB (v778-v779, 20 Sep 2026)

Phil: *"for real skyfall wars, players need to place their lines in towers, its not automatic. if a
player forgets to put their lines in before lines lock phase too bad they lose their chance to fight
and their guild has one less player"*.

- **There is no auto-placement.** The lock's round-robin spread is deleted, not repaired.
- What is still unplaced at 18:00 is **recorded as `missed` and dropped**. A guild has to be able to
  see it went in a player short, or the penalty is invisible: `warSideView` reports
  `missedMembers` and `missedLines`, and the event log carries `NO_SHOW`.
- A line gained during planning reaches the board **only for a member who placed** — it joins the
  tower they already stand in. A member who placed nothing has no tower to join, and a late line
  must not be a back door into a war they did not turn up for.

Verified with nobody placing: 0 defenders on the board, 3 members and 15 lines recorded missed per
side, `unplaced` drained, `NO_SHOW` logged.

## AND THE PLACE BUTTON HAD NEVER TALKED TO THE SERVER (v779)

Phil: *"i cannot place my lines in towers"*. The button was there. It never reached the server. The
one place the real board opens a tower panel passed `live:false`, **hardcoded**:

    skyTowerPanel(stage, side, i|0, r, {canMove: isPrep && (sandbox || officer), live:false});

and the handler branches on exactly that — `if(opts.live)` POST `/api/guild-war/place`, else
`skyPlaceMine`, which shuffles a **local object** and posts nothing. So every placement in every
real Skyfall war went down the sandbox path. On a board with no match that object holds none of your
lines either, so the press did nothing and said nothing about why.

`live` is now `!sandbox`. Verified on the rig: the press POSTs `{"lane":4}` and the server answers.

**This is the audit's lesson showing up on the client side** — the sandbox path standing in for the
real one, and looking right because the sandbox is what gets exercised.

And the refusal names the hour, because since v778 missing the lock costs you the round:
*"The bracket is not set yet — line placement opens Tue 02:00 ET."*

# GUILD BANNERS, PART TWO (v780-v781)

## The import lets you choose the crop (v780)

It used to take a square out of the **centre** with no say in it. The picture now comes in whole and
you move it under a fixed square window — drag to pan, a slider to zoom.

**The frame is fixed and the IMAGE moves.** That is the one arrangement that works with a thumb: a
draggable selection box wants two precise corners on a 780x360 phone, a fixed frame wants one drag
anywhere. Zoom is a **slider, not a pinch**, so it cannot fight the page's own scrolling, and it
zooms about the centre of the window so whatever you are looking at stays put.

The geometry is written once and read twice — for the preview and for the cut — so what you see is
what is written:

    base = max(F/iw, F/ih)        the scale at which the picture just covers the window
    k    = base * zoom
    ox,oy                         clamped to [F - iw*k, 0] so no edge can come into view
    source = (-ox/k, -oy/k, F/k, F/k)          the same numbers read backwards

Verified with a 400x150 picture carrying a red strip on the far left: panned to that edge and saved,
and the 128x128 result reads `rgb(255,1,0)` where the old centre crop would have been all blue.

## The banner travels (v781)

Phil: *"does this banner show server side? or its only client side"*. It was stored server-side and
shown **almost nowhere**. Every place another guild would see you drew a hardcoded sword:

    bracket node       <span class="crest">&#9876;</span>     x16, every round
    live fight, both sides                                    x2
    guild browser      no banner in the payload at all

and the server's views never sent it: the entrant list mapped to `{guildId,name,seed,powerPool,
lines}`, the bracket's `who()` to `{guildId,name,seed}`, `warSideView` to `{guildId,name,...}`. The
entrant record has carried `banner` since v769 and it was stripped on the way out. Sixteen guilds
designed sixteen banners and the tournament drew sixteen identical swords.

It now rides `warQualifyGuild` (so it survives the Monday recompute), the entrant list, the bracket
nodes, `warSideView` and the guild browser, and every crest draws it.

## THE WEEK ANCHOR IS EXACT (v784)

The last audit finding, closed. `etOffsetMs` subtracts a `Date.UTC` assembled from formatted parts,
and those parts stop at **seconds** — so it returned the true ET offset **plus the millisecond
component of its argument**. `warWeekAnchor` then computes `sat + etOffsetMs(sat + off)`, folding
the millisecond of whatever instant the anchor was first computed at into the anchor — and **every
round time in the week is measured from the anchor**.

Nothing breaks at a millisecond, but a tournament's schedule was not reproducible from its own week,
two computations of the same week disagreed, and a comparison against a second implementation could
never be exact — which is the check the audit exists to make. It reported 1–33 ms of drift, 24 times
over ten weeks.

Flooring the basis to whole seconds makes the helper return the offset and nothing else. Verified:
**400 different instants inside one week now produce ONE anchor**, `2026-09-19T04:00:00.000Z` —
exactly Saturday 00:00:00.000 ET. `nyDayKey` shares the helper and is strictly more correct for it.

**Rule:** any offset derived from `Intl` formatted parts is second-resolution. Floor the basis
before subtracting, or the remainder is the caller's own milliseconds.

# REPORTS GO, RESULTS ARE KEPT FOREVER (v799–v801, 20 Sep 2026)

Phil: *"i dont want to archive the battles"* → *"thats only the reports, the results for who won is
records forever"* → *"every week after the tournament is over, the day sign up opens the reports are
wiped"* → *"in battle Bracket at the top right next to the X put tournament history"*.

## The distinction, and why it matters

| | what it is | cost |
|---|---|---|
| **REPORTS** | every line's five hero snapshots, every defender's **second copy** of them, hp states, kill counters, event logs | **4.13 MB/week** at audit scale, **48.1 MB/week** at level 7 |
| **RESULTS** | who was in it, seeds, power pools, who beat whom each round, tower counts, the champion | **3,353 bytes/week** |

Results kept forever: **0.17 MB a year, 1.66 MB for a decade.** Ten years of results cost less than
one week of reports. There is **no cap** on the history — forever means forever.

## What the reports were costing

A level 7 guild holds **60 players**. So 16 guilds at ~5 lines each is **4,800 registered lines** and
**9,000 board defenders** across R16/QF/SF/F — 48.1 MB for one week. Eight kept, plus the live one:

    on disk   432.5 MB          heap   471.4 MB
    writeDB() serialises ALL of it:  1,323 ms of blocked event loop per write
    ...against a 200 ms debounce, so it could never keep up

Node is single-threaded. That is not "Skyfall is slow" — it is **the whole game stopping for over a
second at a time**, for every player, most often on a war day when writes are most frequent. And
471 MB of heap for finished tournaments nobody reads is an OOM on a small container.

    before (8 archived + live)   432.5 MB   heap 471.4 MB   block 1,323 ms
    after  (live week only)       48.1 MB   heap  52.4 MB   block   147 ms

## Nothing read the archive

It was written in one place and read in exactly one other — `claim-reward`, and only to write a
bookkeeping line:

    me.coins=(me.coins||0)+total; me.pendingWarRewards=[];   <- the player is ALREADY PAID
    const tt=...archive[last.weekKey];
    if(tt&&tt.id===last.tid){ tt.rewards[...]=... }          <- guarded bookkeeping

**A player's entitlement lives on `u.pendingWarRewards`**, written by `warEscrowRewards` the moment
the bracket ends and held on the USER. Letting the reports go cannot cost anyone a reward — the one
thing that would have made this unsafe.

**The settle stays.** The outgoing week is still advanced to `finished` and still escrowed before it
is let go, so everyone who earned a reward has it on their account. That was always the valuable
half of "settle and archive"; only the storing goes.

## When it happens — Phil's rule, verified against the real clock

| | | |
|---|---|---|
| Fri 20:00 | last bell, champion decided | weekKey unchanged — **reports stand** |
| Sat 00:30 | | reports stand |
| Sat 01:59 | | reports stand |
| **Sat 02:00** | **SIGN-UP OPENS** | week key turns over — **reports wiped** |

The week key turns at exactly the moment registration opens (v775b), so the finished tournament is
settled and dropped the instant sign-up day begins. **Sunday is day 2 of the sign-up weekend and
nothing happens on it.**

## The history

`DB.tournaments.history`, keyed by week, served by **`GET /api/guild-war/history`** newest first.
The **Battle Bracket** carries a **🏆 History** button immediately left of the X.

The header is `justify-content:space-between` with the title left and the close right, so the two
right-hand controls are grouped in one span — the X stays exactly where it has always been.
`skyPanelFrame` grew an optional fourth argument rather than the bracket building its own header:
every panel on that screen goes through that one function, and a second header would be a second
thing to keep in step.

Each row: the week, the champion's **own banner** as its crest (falling back to crossed swords if
the guild never set one), who they beat and the tower score, and how many guilds were in it. There
is deliberately **nothing to click into** — the reports are gone by design.

### Verified on a rig running real tournament weeks

    DB.tournaments.history   3 weeks, 8,182 bytes total    DB 1.64 MB
    DB.tournaments.archive   absent
    GET /api/guild-war/history -> 200, newest first
      champion Audit Guild 02 (seed 3), 8 entrants
      the final: Audit Guild 08 vs Audit Guild 02, towers 1-2, won by B
      rounds QF(4) SF(2) F(1), `lines` reduced to a count
    the UI: header buttons ["History", "X"] in that order; the panel opens with
      rows reading "beat Audit Guild 08 2-1"

## Still open — the duplicate snapshot

A board defender is **3,724 bytes**, and **3,481 of that is `lineSnapshot`** — a second full copy of
the five heroes already sitting in the entrant record. Referencing the line instead of copying it
takes a defender to **243 bytes** and a live week from 48.1 MB to **18.2 MB**.

That would take the whole database to ~25 MB and a write to ~77 ms. Not done — it touches the lock
and the live war, so it wants its own pass and its own audit run.


# MOVE PLAYER, MOVE LANE (v802, 20 Sep 2026)

Phil: *"officers need the ability to move the ENTIRE lane to another tower. aswell as move one
player at a time if they want. there should be a move player button and a Move lane button"*.

## The two controls

| | who it carries | route |
|---|---|---|
| **Move player** | one member, and **every line that member owns**, because a player's lines always travel together | `POST /api/guild-war/assign` `{memberId, lane}` |
| **Move lane** | **every defender standing in that tower**, whoever they belong to | `POST /api/guild-war/move-lane` `{from, to}` |

An officer with fifteen players holding Iron Gate was moving them one at a time, fifteen calls to
do one thing. **Move lane** is the same authority over the whole tower.

Phil's one-tower rule needs no separate check on the lane move: a player's lines are already all in
one tower, so carrying the tower carries each player's set whole.

## What guards it

The same gate as `/assign`, **copied word for word** — two routes with one rule should not disagree
about how they explain a refusal:

    the round must be in `planning`          (else: the 18:00 lock message, with when it reopens)
    warNow() >= m.revealAt                   (placement for the round has opened)
    leader or officer                        (403)
    both lanes 0..4, and not the same one
    the destination must still be standing
    the from-tower must hold something

Nothing else changes: `side.unplaced` is untouched (nobody is being placed anew), `m.version` is
bumped once, and the response carries the fresh `warMatchView` so the board redraws from the
server's own answer rather than from a guess.

## Where they sit

Inside the tower panel: **Move player** on each player's own block, where it has always been but
now named for what it does; **Move lane** in a single row under the last player, ruled off from the
rows above it and labelled in gold, so it reads as acting on the tower rather than on whoever is
nearest it. Both are five lane buttons with the current lane disabled.

The simulator gets `skyMoveLane()`, the same move performed locally, so the sandbox behaves like
the war.

## Verified — probe D, on a rig running a real bracket

Three members, nine lines, all in Iron Gate, moved to Crown Spire in one call:

    from emptied                                  9 -> 0
    all nine arrived                              0 -> 9
    no other tower touched
    every defender byte-identical (id, line, name, hp, kills, snapshot)
    no duplicates          total across the board unchanged
    m.version bumped by exactly 1        side.unplaced untouched
    the member's own /match view agrees with the DB, and so does the returned match

Each refusal, with the board unchanged after every one:

    same lane              400  "They are already in Iron Gate."
    lane out of range      400  "Bad lane."
    empty tower            400  "Nothing holds Verdant Sanctuary."
    not an officer         403  "Only the guild leader can arrange citadels."
    after the 18:00 lock   400  "The fighting has started — lines locked at 18:00 ET.
                                 They reopen at Wed 02:00 ET."

The probe is archived as `Pipeline tools/skyfall-audit/probeD.js`.


# PLACEMENT, AND EVERY NUMBER ON THE BOARD (v803, 20 Sep 2026)

Phil: *"place lines here button is broken now"* → *"real skyfall"* → *"i should be able to place my
lines still"* → *"tuesday-friday 0200-1800 players should be able to place their lines. saturday
0200 until tuesday 1800 is my new window i can place my lines"* → *"make sure if i click register,
this power number increases everytime someone increases their power"* → *"the lines in skyfall
towers should automatically adjust based on the players increase / they shouldnt have to refresh
them to fix that"*.

## What was actually wrong

**The button was never wired wrong.** On a rig in a real war it places lines and the board updates;
the live production page parses clean and still carries the handler and the route. Phil was looking
at **sign-up week** — no bracket, so no match, so no citadels, so nothing anywhere for a placement
to live on. The board drew its empty fallback (every tower 0/0, no list of your lines) and the
button rendered gold and enabled with nothing it could do.

## THE PLACEMENT WINDOW

| | |
|---|---|
| **Sat 02:00 → Tue 18:00** | one continuous window: sign-up, the Monday bracket, round 1 |
| **Wed / Thu / Fri 02:00 → 18:00** | each later round |

`warPlaceWindow(t)` is the gate. **The existence of a board is not** — for three days of round 1's
window there is no board, and that is the whole point.

## A TOWER IS A CHOICE YOU HOLD

A placement can no longer be a thing written onto a citadel. It is `u.skyLane`, held on the member,
set the moment they pick a tower, and read when the board is built.

    no board yet   ->  the pick stands; "Your tower is set. Your lines take it when the board is drawn."
    board exists   ->  the same call also moves every line that member owns, as before

At the 18:00 lock, anyone still unplaced who **has** picked a tower takes it (`STANDING_LANE`).

**Two rules this does not touch**, and both were tested against it:

- **v778 — there is no auto-placement.** Nothing is chosen *for* anyone. A member who never picked a
  tower is still unplaced, still in `side.missed`, still a `NO_SHOW`, and their guild still goes in
  a player short.
- **v764d — one lane per member**, all their lines, unchanged.

The pre-reveal gate is dropped **for this route only**: placing into your own towers says nothing
about an opponent, and the window runs from Saturday, which is entirely before every reveal.

## THE POWER POOL IS LIVE

It was computed once at `/register` and stored, and the only thing that ever refreshed it was a
member **saving a line-up**. Levelling a hero, gearing one, socketing a glyph, finishing research —
none of those touch that route, so the board advertised Saturday's number until Monday.

The authority was never the stored copy: the Monday seeding and the 18:00 lock both rebuild from
`warQualifyGuild(guild)`. **The number on screen was the only stale one in the system.** It is now
recomputed while registration is open — recomputed, not incremented, because "someone increases
their power" has no event to hang on: power is a sum over levels, stars, pips, skills, gear, glyphs
and research, and walking the guild is what produces it.

Registration still has **until Monday 00:00 ET** (`registrationLocksAt` = anchor + 2 days) to settle the top 16; the seeding recomputes every
registered guild from current data and takes the sixteen highest.

## AND SO DO THE TOWERS

Before the lock a defender is a **placeholder** — `{memberId, line}`, no snapshot, because the
snapshot is built fresh at the lock on purpose so everything done during planning counts. So a tower
in planning read every line at **power 0 with no cards**, and re-saving the line-up was the only way
to make it show anything.

While a round is in `planning` the view resolves every defender against `buildRegisteredLines`,
live. **At the lock it stops** — from then on `lineSnapshot` is what fights, and a board still
re-reading the player would be showing a line that is not in the battle. Live until the lock, frozen
after it: the same boundary the war itself uses. The officer's roster reads the same way.

Both walks are memoised 15 s (per guild, per member); a join, a kick or a leave drops the guild's
entry so membership shows at once.

## Verified

**Probe F** — a rig walking the week:

    Saturday, no bracket      the pick is taken and remembered; 3 lines reported; window open
    Monday, board exists      the same call moves 3 real defenders into lane 3 (pre-reveal)
    Tuesday 18:00, the lock   leader in the tower he picked on SATURDAY, second in his,
                              3 STANDING_LANE events; the member who picked nothing is a
                              NO_SHOW with 3 missed lines, on no citadel
    18:05  "Towers lock at 18:00 — they open again Wed 02:00 ET."
    Wed 10:00  open again        Fri 19:00  "Placement is closed for this week."

**Probe G** — the numbers:

    pool  1096 -> 1536   a member levels (nothing touched /lines)
          1536 -> 2553   another member joins — immediately, the memo is dropped
          stored entrant agrees with what was shown
    tower 1017 -> 1433   its owner levels during planning; cards shown throughout
          1433 -> 1433   after the lock, frozen against further levelling

Both archived as `Pipeline tools/skyfall-audit/probeF.js` and `probeG.js`.

---

# THE BOARD REDRAWS AFTER A PLACEMENT (v804, 20 Sep 2026)

Phil: *"place lines here now just closes the tower, doesnt place heroes just closes the window"*.

The placement was working. The **redraw** was not, and never had been:

    el.remove();
    try{ if(typeof skyRefreshMatch==='function') skyRefreshMatch(); }catch(e){}

`skyRefreshMatch` is referenced there and **defined nowhere** — one hit in the whole file. The
`typeof` guard made the miss silent, so a successful placement closed its panel and redrew nothing:
the towers kept the counts from before it, and the tower just filled looked untouched. Which is why
it reads as "it closes the window" rather than "it did nothing".

It stayed invisible because the live path mostly **errored**, and the error path keeps the panel
open and says why. v803 made the call succeed during sign-up week, so the success path — the one
with the dead refresh in it — ran for the first time.

The same dead end sat under the officer's two movers: `skyAssign` and `skyMoveLaneLive` both call
`renderGuild()`, which redraws the **Guild Hall**, not the Skyfall board you are standing on. All
three now go through one `skyBoardReload`, which clears the cached `SKYFALL_VIEW` — `renderSkyfall`
rebuilds from it when given nothing, so without clearing it the redraw redraws the stale one — and
reopens the panel on the tower just filled.

## The discs were lying, for the same reason as v774 and v775

`warSideView` never sent a citadel's **`name`, `alive` or `total`**. The garrison disc on every
tower reads `c.alive`/`c.total`, and the tower panel titles itself from `c.name`. So a **real** war
drew `0/0` on every disc however many lines stood in it, and called every citadel "Lane 3".

Same cause as the `power` in v774 and the heroes/kills in v775: **the client was built against the
simulator's board, which carries all three.** Nothing was missing — the defenders are right there to
count and the names are `WAR_LANES`. They were never sent.

### Measured, on a rig in a real war in planning

    the disc    0/0 -> 3/3 the moment the button was pressed
    the panel   reopened titled "Rift Tower", not "Lane 3"
    the button  flipped to "Your lines are here"
    the server's own counts agreed: [0,0,3,0,3]


---

# SKYFALL, LIVE (v810, v813–v815, 20–21 Sep 2026)

Phil tested this by upgrading a hero and watching every screen. Every other screen changed at once;
Skyfall did not. Three separate reasons, each fixed on its own.

**v810 — the tower's "YOUR n LINES" was a snapshot.** `warMatchView` built `you.yours` from
`ent.lines`, the entrant copy stored when the guild **registered**. Every other number on that screen
read live. It now reads `warLiveLines` during planning, with the entrant as fallback.

**v813 — your own heroes are never cached.** Server-side power is memoised 15 s because the
leaderboard prices up to 500 accounts × 5 heroes on one request. That memo covered the **caller** too,
so you watched your own number sit stale. `warLiveLines` and `cardPower` take a `fresh` flag, passed
wherever the requesting player is priced: the tower list, your defenders in a citadel, your roster
row, the campaign's your-power. Everyone else stays memoised.

**v814 / v815 — the client never asked again.** Nothing on the Skyfall screen polls. `SKY.st` holds
the last `skyStatus()` fetch and the board draws off it. Every other screen computes power in the
**client** off the local save, which is why only Skyfall could be behind.

- **Entering Skyfall now fetches** (`show('skyfall')` draws at once, then fetches and draws again). It
  used to draw straight off `SKY.st`, possibly from app open — only Edit Team fetched on entry, which
  is why opening Edit Team first was the only thing that "fixed" the tower.
- **Opening a tower re-asks** and redraws only if the answer moved. **v814 watched the wrong field**:
  it compared `SKY.st.match.you.yours`, which is **empty during sign-up week** (there is no match), so
  it never redrew. v815 fingerprints what the tower actually **reads** — the match's lines, the
  placement lines and lane, and the match version.

**Verified in Phil's own state** — registration week, match null, his steps exactly: tower first
6,237 / 7,128 → upgrade without touching Edit Team → re-enter, tower first → **7,375 / 8,383**,
identical to the server.

**Data this screen reads, by state** — worth having written down, since getting it wrong cost v814:

| state | the tower's own-lines list reads |
|---|---|
| no match (sign-up week, between rounds) | `SKY.st.placement.lines` + `.lane` (the standing pick) |
| match in planning | `SKY.st.match.you.yours` (live, `fresh` for the caller) |
| match locked / live | the match's hydrated defenders (`lineSnapshot` — frozen, it is what fights) |

---

# SKYFALL POWER (v805–v812)

A line's power, the power pool and every tower's numbers are the **sum of the hero cards** — see
blueprint 15, "ONE POWER". The Skyfall Edit Team total and every tile read the card (v811); the
server's own line power matches it hero for hero at levels 1, 19 and 57 (v812).

## HERO HP BETWEEN FIGHTS - PHIL'S RULE (26 Sep 2026 07:5x) - NOT BUILT YET
Phil (verbatim): *"World map and skyfall their hp persists with whatever it had at the end of the battle."* · *"World map it can be
healed with witches up but only when they return to the city are they available to heal"*.
- **World map** (cities, mines, raids): a hero leaves a fight with the HP it ended on, and carries it into the next fight.
- **Skyfall**: the same - HP persists from the end of each battle.
- **Healing**: only the Witches Hut heals world-map HP, and **only for a hero back in the city** - a hero on a march cannot be healed.
- Status (Claude, 26 Sep 08:0x): being built on ChatGPT's unmerged branch `codex/witches-hut-mechanics`. On that branch the Hut heal
  routes do not yet refuse a marching hero, and guild-war/Skyfall lines still start at full maxHp. When it ships, this box becomes
  CURRENT RULES with the version, and the Witches Hut gets its own numbered blueprint (MASTER RULE 25).
# PRIVATE qualification supplement — 3 October 08:35 ET (NOT SHIPPED)

Unchanged private server4f66439e passed eleven new actual-HTTP binding refusal controls (binding-controls.cjs/json,08:35:17): missing legacy/null/array reservation, wrong version/account/guild/attempt/startrequest/boss/tier, currentboss-tier rollover. All application refusals ok:false/bossBindingHeld:true atHTTP200 preserve exact disk and original attempt, no migration/reward. Synthetic stopped-fixture mutation only. No source change or live implementation claim; fullQ6, release/expiry/lateboss/retention, prescribed flags, witnessedcombat/balance and dualapproval remain OPEN. DO NOT INSTALL this partial candidate.

# PRIVATE replay-fault supplement — 3 October 08:39 ET (NOT SHIPPED)

Eight injected own-child sim-host controls on unchanged4f66439e pass actualHTTP08:38:58: loaderror/missingraid/exception/negative/string/NaN/Infinity/matchingdamage. Player12345/HP387655/coins247 and exactrestartreceipt retained. Not actualreplay/witnessedcombat; diagnostic-only, not prescribed1/3/4flag integration. Engine failure is not automatically a player mismatch. Private atomic bookkeeping/case escalation contract remains next, Q11/Q10 release/retention and all fullQ6/balance/deployment gates OPEN. DO NOT INSTALL.

# PRIVATE first mismatch flag supplement — 3 October 08:45 ET (NOT SHIPPED)

Privateb9e54868aee652aee5607729795a8e496a9fa28978b5df3de1ec74a2f3f2a1be appends numeric replay disagreement to staged actor only, flags carry bothresults/stage/build/binding/packet/time. Parent4f naturalzero/newone, failedrename503 atomic/restart/exactretry/changedpacket409/onereward verified08:44:26 privateHTTP syntheticemptyinputs. Full1/3/4consumer contract and historyquota NOTbuilt; malformedhistory fallback NOTqualified and must not erase unknown flags. Newcandidate enginefailure/matching exclusions needqualification. Not witnessedcombat/fullQ6/balance/deploy; Q11Q10/broadergates OPEN. DO NOT INSTALL.

# PRIVATE history-preservation supplement — 3 October 08:50 ET (NOT SHIPPED)

Privateac915324eb523723f2106a49252686285fa5a466578c941932c55bfac0c93c7b corrects parentb9 silentnonarrayhistoryerasure with hold beforeattemptdelete/settlement. Fournonarraytypes exactdisk/attempt/restart retained, priorarrayrow retainedplusflag (08:48:57 HTTP). Eight newcandidate enginefailure/invalid/match paths zero playerflags/player12345/247coins/restartreceipt retained08:49:29, injectedprivatechildonly. Arrayrowvalidation/historyquota/case3/review4/fullQ6/combat/balance/deploy OPEN; no liveimplementationclaim. DO NOT INSTALL.

# PRIVATE history-write supplement — 3 October 08:54 ET (NOT SHIPPED)

Privateac915324 newtemporaryfilewrite503 atomic/restart preserves1000syntheticpriorflags+paidattempt/no reward, retry1001rows prior1000intact/retryonce/restart/changedpacket409/onereward08:54:03. Boundedcapacitysample NOTglobalquota/realENOSPC/retentioncap; nohistorypruning. Gamefeedback GET/ack exposes transportreceived only, not reviewed/dismissed. Fullcase3/review4consumer contract OPEN, no ack-as-review assumption. NoBrain/livechange/fullQ6/combat/balance/deployapproval. DO NOT INSTALL.

# PRIVATE case-outbox design — 3 October 08:59 ET (DESIGN ONLY, NOT SHIPPED)

Executableisolatedmodel0eea582d: three validuniqueflags stablependingcase, countdistinctOTHERplayerssame-stage notflagcount; fourthsamependingcase/laterflag nofabricatedreview/nospecialistdispatch; malformed/duplicatehistoryheldunchanged. Sixpuremodelchecks08:58:54, notgame/Brain/feedback/inbox/reviewintegration. Currentprivateac firstflagonly; transport/reviewcontract/retention/fullQ6/actualfight/balance/deployOPEN. DO NOT INSTALL or describe this model as case delivery.

