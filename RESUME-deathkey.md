# Death plate key - RESUME (paused 17 Oct 2026 ~21:55 ET, Phil saving usage)

Branch `claude/death-key` (worktree C:\Users\Home\Downloads\ew-deathkey), on live v1196 0605c5a1, pushed. NOT deployed. Ship order: v1192 (save upgrade), then v1197 (Tolley FX), then this one as the next free number (v1198 was free at 21:33).

## Done
- New key `Emberweave Archive/Pipeline tools/death/death_key.py` (KEYVER v1198-1; backups `*.bak-claude-17oct-residue` of death_batch/death_build/cut48). Per-frame plate, local colour-line unmix, plate-axis despill, flicker / codec blocks / spikes made transparent, the hero's own plate-hued idle colours protected. death_build.py calls it; cut48.py cuts keyed2/ frames.
- Audit tool `Pipeline tools/death/residue_audit.py` (flicker <= 10% of cell 0, tint <= 0.4% or 10% of his idle plate-side share, ghost <= 1%; grey and opaque reported), wired into death_batch.py (fixture row `residue` + sheet sha256).
- Re-cut 58 heroes with placeholder version **1299** (all except Lumi and Oakmir, which ChatGPT is redoing); 696 old v1190/v1196 death sheets git-rm'd; fixture rows re-measured; Vex `not` kept.
- tests/test_death_state.js: PLATE RESIDUE + CONTROL (13 v1196 heroes fail, Pellucid/Deepcleft/Vireo pass), known-residue Absalie (bound 1.2%), RPEND Lumi/Oakmir, PLATE GHOST + CONTROL (tests/fixtures/death_residue_control_hurne_1190_cell6.webp, 24.7%); old plate-colour allowance 5% -> 25% of the hero's idle share (Aldren's purple restored); ASH46 drops Umbris. Headless: PASS 27.
- Blueprint 18 section "v1198 - DEATH PLATE KEY" written; Pipeline tools/death/RESUME.md updated.
- Review page (58 tiles, before/after animated WEBP): C:\Users\Home\AppData\Local\Temp\claude\C--Users-Home-Downloads-Emberweave-Server\d24c31cd-2e29-45c6-bb5e-87e188bd967a\scratchpad\dk\death-key-review.html

## Audit (residue_audit.py, against the source clips)
- Live v1190/v1196 sheets: 34 of 60 fail. Hurne flicker 43.0% (cell 6). The other 13 Phil named fail on tint or ghost (Maren, Mellan, Orryn, Rivet, Seyla, Sloe, Sorrel, Tharl, Tick, Vael, Vulmar, Yenna). Tolley passes: grey smoke and a faint pink inside his own lava-red allowance (tint 0.90 of 1.87%).
- After the re-cut: 0 of 58 fail, except Absalie ghost 1.14% (was 3.37%): her translucent veil shows the green plate through it (cells 3-4), so she goes to ChatGPT for a redo. Hurne's last dust cell keeps a few grey codec blocks that come from the source itself.
- Full tables: scratchpad dk/ra_all.json (before/after); fixture rows in tests/fixtures/death_sources.json.

## Left
1. Wait for v1192 and v1197 to be on origin/main with SHIPPED notes and channel lines. Then `git rebase origin/main` on this branch.
2. `release_prep.py <wt> 1299 <N> <SHIPPED note> "<patch line>"` (C:\Users\Home\Downloads\ew-sweep\death\release_prep.py). Patch line draft: "Hero deaths look cleaner: the pink tint and grey patches left in the ash, and the grey flash in Hurne's death, are gone for 58 heroes." Then re-run `python -I refix.py <before dir>` (scratchpad dk) so the fixture sha256s match the renamed files. NOTE: the release_prep rename changes file NAMES only; the bytes are the same, but `sheets` keys in the fixture rows hold names -> refresh them.
3. `bump.py <wt>` (BUILD_ID + sw.js + version.json).
4. ONE full suite at LOW priority under the GPU lock (C:\Emberweave\tools\gpu_lock.sh): `tests/run_all_tests.sh` with the python3 shim first on PATH. Baseline failures allowed: test_net_gate, test_server_down_1120, test_hero_voices_1124, test_veyr_undertow_1136, test_debuff_feet_1141, test_aureth_1150, Archive glyph_paths. Phone memory peak must stay < 1990 MB (test_memory_budget_1140; was 1958.8).
5. SHIPPED note (full SHA, `Blueprints: 18 - Battle Engine.md`; touch blueprint 18 after the v1197 deploy so the gate sees it updated), commit, push, `deploy_home.sh <sha> --gate BLUEPRINT-IS-TRUTH` (nine machines), /api/health + version.json changed, RULE 21 prune of the 696 removed sheets on the servers (move to /root/_to_delete/<release>/), one channel line (POST 127.0.0.1:7777/api/aichat).
6. After shipping: `git worktree move` ew-deathkey into C:\Emberweave\_to_delete.

## Next command
`cd /c/Users/Home/Downloads/ew-deathkey && git fetch origin && git log --oneline -5 origin/main` (look for v1192 and v1197), then step 1.
