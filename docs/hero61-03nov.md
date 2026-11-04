# Hero 61: isolated review build

Based on live v1262, `0bfd82d37c41021c2399c15f97b9add2ba80e49e`, under Claude's 3 November 19:33–19:35 relay of Phil's instructions. Branch: `chatgpt/hero61-wire-03nov`. This branch is not merged or deployed. The working name and balance values remain proposals.

`hero61.js` owns the working identity, **Caedran — The Open Gate**, in `IDENTITY`. The persistent hero key is `hero61`; renaming the display identity does not rename saves. Screen lore interpolates this identity; `server/hero61-lore.json` also retains the narration draft with a `{name}` token. No narration audio was generated or approved.

## Actual player fight and replay

Hero61 is a Mythical Support in the back row. His base HP/Armor/MR/AP/Attack are 620/60/40/30/16; per-level gains are 36/10/7/1/0.5. At level 100, before other progression, HP/Armor/MR/AP/Attack are 4184/1050/733/129/65.5. Other Supports retain their existing growth.

The client battle and `server/sim-host.js` run the same fixed-clock code:

- Green casts for 1.5 seconds with no cooldown. At skill level L, it heals the ally with the lowest HP percentage for `(0.06 + 0.0003 × (L−1)) × target max HP + 0.5 × caster AP`.
- Blue casts for 2.5 seconds and begins its eight-second cooldown on successful release. Its heal is `(0.18 + 0.0009 × (L−1)) × target max HP + 2 × caster AP`.
- Healing Power is applied once through the existing `healFrom` path. Existing healing caps and healing reductions remain effective. Ties use stable formation order.
- Ult has a proposed 1.2-second cast and grants one living ally immunity to damage for exactly four simulation seconds after release. Duration stays four seconds at every skill level; no additional upgrade benefit has been invented.
- Tap/auto selects the ally who actually lost the most HP over the last two seconds; ties prefer lower HP percentage, then formation order. Hold/drag records the selected ally's UID in the normal input log. Invalid enemy targets do not consume energy.
- Stun, silence and the existing cast-interrupt controls cancel a pending release. Ult preempts Blue or Green; Blue preempts Green. An interrupted Blue does not start a release cooldown. Ult spends energy at press, like existing heroes.
- The passive supplies `20 + 2 × (passive level−1)` flat Armor to living allies, including the caster. Only the strongest living copy applies; death removes it immediately.
- Basic attacks may start and deal damage only while he is the sole living nonsummoned hero on his team and above 50% HP. At exactly 50%, they are disallowed.

**Hollow interaction requiring review:** Hollow's execute code is unchanged. Its existing damage entry point respects the new protection like other damage. There is no new execute exception, resurrection, cleanse, taunt or stun immunity.

**Separate resolver decision pending:** `server/combat-core.js` is the older round-based line/qualification resolver, with ultimate-only kits and no fractional-second casting clock. It is not the player replay engine. This branch does not silently substitute four rounds for four seconds or claim that the coarse modes reproduce Hero61's casts. Claude was asked whether those modes should route through the field VM or retain a clearly labelled estimate. Full-mode completion awaits that decision.

## Progression proposals

The `support_tank_back` path uses only Health, Armor, Magic Resist, Healing Power, Ability Power and Energy Regen. Proposals were appended to Phil's existing Archive design before implementation.

Six pure-stat glyph families span all sixteen qualities: Gateheart, Ironoath, Nightveil, Mercylight, Vigil and Oathbloom. Their primary-stat budgets and ingredient lineages come from the existing corresponding families. They reuse existing farmable fragments and subrecipes; `fragmentFamily` prevents new dead fragment drops. Stock glyph effects remain unchanged. Personal ascension bonuses contain only the same six stats.

Temple bars are Health / Armor+MR / AP / Healing Power. The new Armor+MR bar deliberately excludes the existing combined bar's extra Defense stat. Blessing slots are Health / Energy Regen / Armor+MR / Healing Power, using existing units and costs. Proposed full set: +320 HP, +1 Energy/s, +660 Armor and MR, +10% healing. This ordering retains the existing rule that neighbouring Supports differ in at least three blessing slots. The fifth-dot rules are unchanged.

Nine quality-bound gear items split the existing three-stat budgets; Health uses the existing 14:1 conversion. They introduce no active mechanic. Their names and starting values are proposals, not final balance approval. `artId` reuses the existing corresponding catalog illustrations as placeholders; a new personal gear illustration set is not claimed or approved. The gear renderer respects that existing-art reference.

## Approved art and withheld art

The 512-square card is a top-aligned crop of Phil's selected **r5_01 Crownward braced shield** source; its crown is retained. Provenance and both hashes are in `tests/fixtures/hero61-card-provenance.json`.

Only Phil's seven approved take-3 clips are wired: Idle, Walk, Attack, Hit, Green, Ult and Death. The official exports' hashes and identical silent video packets were verified before extracting all 158 frames. The shared cs10 keyer, glow unmix, despill and premultiplied Lanczos cut pipeline produced the sheets. Every sheet passes 2048-pixel/4-MB limits, 140–240-pixel figure height, alpha and green-fringe checks. A two-pixel transparent atlas gutter prevents adjacent-cell sampling, including approved source pixels near an edge; it does not reconstruct clipped source art.

The death uses the established lazy streaming schema, at most four cells per part and two parts resident together, finishing on settled ash. This rendering clock never changes death, targeting, damage, rewards or wave timing.

**Blue remains withheld.** Phil rejected take 4 because its effect flooded the frame. Take 5 was delivered for review, with its earlier local-pulse timing and 20-pixel left-margin fringe explicitly flagged. No pass is inferred. No Blue sprite or separate spell-effect video is wired. The three separate spell-effect stills await Phil's approval before any further FX video generation.

## Validation and review handoff

`tests/test_hero61.js` exercises the real VM casts, interruption, priority, immunity expiry, recorded ally targets, aura removal/strongest copy, attack gate, six-stat progression, repeated whole-fight replay and deterministic bot-roll eligibility. `tests/test_hero61_art.js` checks source-derived geometry, asset hashes, phone limits, streaming death, offline inclusion, the no-Blue gate and combat equality with unavailable pixel URLs while retaining timing metadata.

The existing roster/path and Temple tests cover the new 61st hero and 15th path. `tools/glyph_paths.js` is included in the checkout so the canonical path test no longer depends on an external Operating procedure folder.

The full suite runs in an isolated temporary database on port 8994, using this branch's test server and one test battle worker. It does not pause, retarget or stop Ember's jobs. Final results and the actual review commit must be recorded in the delivery evidence; a running suite is not a pass.

Review/release gates: Claude resolves the coarse-resolver route, reviews the commit and actual suite results, and handles any eventual merge/deploy. Phil chooses the final name/balance and approves Blue and the separate FX stills. No user approval is inferred from files, tests or scores.
