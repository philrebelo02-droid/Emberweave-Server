# RESUME - v1197 Tolley spell FX + silent splash (paused 17 Oct 2026 21:50, not deployed)

Branch `claude/tolley-fx` (pushed), worktree `C:\Users\Home\Downloads\ew-tolley-fx`, head bf370048 on live v1196 0605c5a1. Number v1197 claimed in the AI channel (17:35).
Scratch (rig, cutter, review page): `C:\Users\Home\AppData\Local\Temp\claude\C--Users-Home-Downloads-Emberweave-Server\d24c31cd-2e29-45c6-bb5e-87e188bd967a\scratchpad\tolleyfx\`

## Done
- Tolley FX wired (de680096 + a29f5873): Forge Strike (impact cell 19 = source f61 on the cleave case tick), Chain Quench (one chain per enemy the case hits, base on Tolley; explosion 1.8 s in), Living Forge (ring under his feet, follows him, whole 8.8 s). Sheets in assets/anim/fx/tolley_*_17oct.webp (?v=1197).
- Silent splash (bf370048): `splashOn()` holds music / sndPlay / sfxPlay and hides #muteBtn on #rotateGate.
- Tests: tests/test_tolley_fx_1197.js 39/39 (tick-identical to 0605c5a1 + CONTROL), tests/test_splash_silent_1197.js 8/8 (+ CONTROL); 12 older FX tests take Tolley back off (tests/helpers/tolley-fx-1197.js) and pass. test_hero_voices_1124 (audio orphans) and test_mute_dock_1163 (FIGHTS vs v1162) fail the same way on clean 0605c5a1 (baseline).
- Patch notes 0.95 line, build bump 1792272985489 (redo after the rebase), blueprints updated (Heroes/Tolley.md, 18 - Battle Engine, 15 - Heroes Panel, 27 - Sound, 21 - Hub HUD; .bak-claude-v1197 copies).
- Rig seen in game (muted, under the GPU lock): scratch rig2/ rig3/; review page `tolleyfx/tolley-spell-fx-review.html` (self-contained, give its path to the coordinator to publish).

## Left
1. Wait for the save upgrade (v1192) SHIPPED line in the channel and on origin/main.
2. `git fetch && git rebase origin/main` (resolve BUILD_ID / sw.js / version.json / patchnotes conflicts: keep both patch-note lines, new build number); set test BASE (`tests/test_tolley_fx_1197.js` EW_BASE) to the new live SHA; rerun both new tests.
3. ONE full suite, low priority, under the lock, on the default port 8871 when no other suite runs:
   `bash <scratch>/tolleyfx/suite_locked.sh > <scratch>/tolleyfx/suite_wrap.log 2>&1` (log: suite_1197.log). Compare against baseline (aureth_1150, hero_voices_1124 orphans, mute_dock_1163 FIGHTS).
4. SHIPPED note `Operating procedure/SHIPPED/SHIPPED-v1197-tolley-spell-fx-17-10-2026.md` with the full SHA and `Blueprints: Heroes/Tolley.md; 18 - Battle Engine.md; 15 - Heroes Panel.md; 27 - Sound.md; 21 - Hub HUD and UI Art.md` (blueprints must be newer than the last deploy stamp: touch them again if v1192 deploys after them). Base files mirror + worklog.
5. `bash "Operating procedure/tools/deploy_home.sh" <full SHA> --gate BLUEPRINT-IS-TRUTH`; check /api/health x9 + public version.json; post `@Grok` line (POST 127.0.0.1:7777/api/aichat).
6. Afterwards: `git worktree move` ew-tolley-fx (and ew-base-1196, a clean v1196 checkout made for baseline checks) into C:\Emberweave\_to_delete.

Note: Downloads\Emberweave-Server\node_modules was found empty at 20:40 (someone's cleanup); this worktree and ew-base-1196 got their own `npm ci`.
