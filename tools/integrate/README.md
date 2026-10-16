# Art integration pipeline — `tools/integrate_hero.py` and `tools/integrate_fx.py`

These two tools turn a Phil-approved art handoff from ChatGPT (Hailuo hero clips) or Grok (Imagine spell FX) into game sheets, page entries, a test, and the pages Phil looks at.

They replace the hand-run route behind:
- v1150 / v1153 Aureth
- v1142 / v1150 Carn
- v1160 Veyr and Deepcleft
- v1162 Korvux
- v1169 Nox and Grimsby
- v1173 Meridian and Rafe
- v1175 Hobb and Kharos
- v1171 / v1174 spell FX

Every rule below is one a shipped release used, and every number is measured, not typed.

**The checks stay mandatory, and the pipeline runs them.**
- Whole fights must be tick-identical.
- The memory budget, offline art, condense and skill-preview tests must pass.
- Every check has a control.
- Every browser and rig run takes the shared GPU lock, one at a time, with at least 2 GB free.
- Every browser runs headless and muted.

Nothing here bumps `BUILD_ID`, `sw.js` or `version.json`, deploys, or posts to the channel. Those stay release steps.

## A hero, step by step

1. **Write the config.** Copy `tools/integrate/heroes/korvux_1162.json` to `tools/integrate/heroes/<hero>_<ver>.json`. The minimum is:
   - `hero` (the page key);
   - `name`;
   - `archiveDir` (the folder under `Game Art/Heroes`, if it isn't `name`);
   - `version` (a new number: never reuse an asset version);
   - `review` (for example `REVIEW 16OCT2026 H3`);
   - `melee`.

   The `states` block can start empty. `propose` fills in what it can.

2. **Run the stages:**
   ```
   python -I tools/integrate_hero.py <cfg> verify      # manifest: PASS rows only, silent twins' sha256, same pictures as the export
   python -I tools/integrate_hero.py <cfg> extract     # ffmpeg, every frame (CPU)
   python -I tools/integrate_hero.py <cfg> key         # cs10, 8 states in parallel (CPU, ~10 min for 8 x 124 frames)
   python -I tools/integrate_hero.py <cfg> engine --base <live sha>   # the contact cell each action must draw its blow on
   python -I tools/integrate_hero.py <cfg> propose     # walk stride, idle loop, hit flinch, contact frames -> <work>/proposals.json
   ```

3. **Review and fill in the config.** Look at `proposals.json` and the raw contact sheets. Then confirm or correct, per state:
   - `walk.from` / `walk.len`;
   - `hit.flinch` / `hit.recover`;
   - for each action: `contactFrame`, `end` and `hold` (or explicit `segments`);
   - `moment: land` for an ability whose contact is its form landing (Korvux's Ember Cleave, Hobb's Grand Kiln Shape);
   - `ghost: true` for a see-through passive;
   - `autoAlt: [A, B]` for per-swing alternation;
   - `framing` / `anchors` for a clip shot on another start frame (Kharos attack B).

   Casts are always a reviewer's pick. The planner proposes the frame of greatest reach, which is a swing's blow but not a cast's release.

4. **Cut and wire into a new worktree, never the shared checkout:**
   ```
   python -I tools/integrate_hero.py <cfg> normalise   # one size, one spot (the Korvux method)
   python -I tools/integrate_hero.py <cfg> cut         # sheets + masters, fringe gate, figure / margin gates
   python -I tools/integrate_hero.py <cfg> wire --tree <worktree> --base <live sha>
   python -I tools/integrate_hero.py <cfg> rig  --tree <worktree>             # probe / stills / clip, GPU lock, muted
   python -I tools/integrate_hero.py <cfg> outputs                            # contact sheet, stills, clip page
   python -I tools/integrate_hero.py <cfg> checks --tree <worktree> --base <live sha> [--suite]
   ```

5. **Release steps** (unchanged, by hand):
   - sound rows, if a cast's peak moves to its release or landing (the `wire` report lists the hero's rows);
   - the passive hook, if the hero has a new event passive clip;
   - the Archive copy of `masters/`, `cut_report.json`, `frame_maps.json` and the config;
   - blueprints and patch notes;
   - the build bump;
   - deploy.

`all` runs `verify` through `outputs` in order. It stops before `wire` without `--tree`.

## What each stage does

| Stage | What it does | Where it comes from |
|---|---|---|
| verify | Uses only `clean-source-manifest.json` rows whose status has PASS. Each row must be a Without Watermark export of 124 frames. The silent twin's sha256 must match `silentSHA256`, and the export's must match `sha256`. The twin's video stream must be identical to the export's (md5 of a stream copy). Edge-contact and non-green frames are flagged. Takes that are not PASS, and review-folder files no PASS row names, are listed and never used. Two PASS rows for one state stop the run until the config names its `creation`. | mancheck.py (v1169-v1175) |
| extract | `ffmpeg -fps_mode passthrough` writes every frame of the silent twin to `raw/<state>/fNNN.png`. The frame count must equal the manifest's. | extract*.sh |
| key | `cs10.key_frame` with SHEET_LOSSLESS, ALPHA_SOFT and ALPHA_FLOOR 4. The plate is the median of frame 0's 4-px border. Records the alpha > 40 box, the alpha > 8 box (for ghost states), frame 0's standing figure (alpha > 60: top / sole / cx) and the corners, which must be 0 (no watermark). | measure.py |
| engine | The sim host plays the hero's own swing and casts on the target page. The swing's 2.0 s, 48-cell clip is fitted into the swing hold when the clip is longer, natural speed otherwise. Output: the blow's cell, the green / blue / ult release and landing cells. `cut` stops if a config contact disagrees. | rig probes, drawnSwing (v1162 / v1175 tests) |
| propose | **walk:** loopfind's most similar pair 24-70 frames apart. **idle:** a clean loop that plays 24 cells at 8 fps or more, otherwise the whole clip, 62 cells at 12 fps (Aureth / Carn / Korvux). **hit:** the flinch (onset to peak pose change) plus the recovery, 15 cells at 25 fps. **actions:** the frame of greatest reach past frame 0's front edge, and where the pose settles. | v1155 slim rules, loopfind.py |
| normalise | The Korvux method, below. | ref_scale_fit.py (v1162) |
| cut | See the cut rules below. | cut_v1160.py / cut_ng.py |
| wire | See the wiring rules below. | patch_*.py, renum_*.py, set_version.py |
| rig | `rig_hero.js` (rig_ng.js, made hero-agnostic) runs a real phone battle: 844x390, Android UA, swiftshader, AudioContext removed, `--mute-audio`, the service worker blocked, a temp DB on a free port, the clock driven one 60 fps frame at a time. **probe:** the cell drawn on each engine moment, two reps. **stills / clip:** for Phil. Each mode is one hold of the GPU lock (`locked.sh`). | rig_ng.js, rig_all_locked.sh |
| outputs | `look/<hero>-sheets-contact.jpg`: every state on one floor line, figH-normalised, with feet and top lines and the contact cell boxed. Built from the sheets, no GPU. From a rig run: `<hero>-stills-844x390.jpg`, `clips/*.webm` (30 fps VP9) and `<hero>-clips.html` (both themes, sound off). Publish the clip page as an Artifact: Phil can't see clips sent as chat files. | stills_clips.py, clip_page2.py |
| checks | See the checks below. | final_locked.sh, browser_tests_locked.sh, suite.sh |
| compare | Compares a run with a shipped release: q95 sheets and masters byte for byte (else pixels), frame maps, geometry, BATTLE_ANIM data and page lines. | the proof below |

### The cut rules

- **Unmix.** Green above max(R,B) is the plate seen through a glow. A = 1 - clip((ex - 10) / (Kfull - 10)), the colour is un-mixed, and G is held to max(R,B).
- **`unmixSoft`** (on by default since Veyr): unmix only where cs10's alpha is under 250.
- **`refUnmix r,g,b`:** for a light cloud that dissolves into the plate (Deepcleft's dust).
- **Despill.** DESPILL_ALL runs before and after the resample.
- **Crop.** The alpha union of the listed frames plus frame 0, padded by `pad`.
- **Resample.** One premultiplied Lanczos per cell, to the largest cell whose grid fits 2048 x 2048. The standing figure is never over `maxFig` (240).
- **Encode.** A lossless master (byte-checked) and the game sheet at WebP q95, method 6, alpha_quality 100: alpha bit-exact to the master, 4 MB or less.
- **Gates:**
  - **Fringe.** Edge px with G > max(R,B) + 24: none in the master, 0.005% or less in the q95 sheet.
  - **Cell margin.** At least 2 px.
  - **Empty cells.** None.
  - **Figure height.** figH 140-240 px.
  - **Ghost states.** The mid cells hold a readable see-through figure: 60% or more of the start figure's px, alpha 70-190.

### The wiring rules

- **Sheets.** Copied to `assets/anim/<hero>/<hero>_<state>_<ver>.webp` and referenced at `?v=<ver>`. The old sheets stay on disk.
- **BATTLE_ANIM.** The hero's block is replaced, in the page's own field order, and read back through the sim host. On a mismatch the page is restored. Timing data is never touched: action clips keep clipDur 2.0 s and relFrac 0.5, and the hit keeps its 0.6 s hold.
- **`autoAlt`.** Written onto HERO_TYPES. It is the list the v1175 engine and `skillPreviewStates` read.
- **Fixtures.** `<hero>_<ver>_integrate.json` (everything the test asserts) and `anim_<hero>_<ver>_before.json` (BASE's entries).
- **Undo helper.** `tests/helpers/anim-<hero>-<ver>.js` is chained into the previous newest helper, and the previous release's own test loads it. Older tests compare against an older BASE, and keep doing so.
- **Test.** `tests/test_<hero>_anim_<ver>.js` is generated from `tests/templates/hero_anim_test.tmpl.js` and registered in `run_all_tests.sh`.
- **Size ratchet.** Replaced sheets leave `sheet_size_baseline_1140.json`. The file keeps its own line ends.
- **Reports** (in `run.json`):
  - the condense dry run (the tier decision per new sheet);
  - `allAssetUrls()` holds every new sheet (Update all features);
  - `skillPreviewStates` for each slot;
  - the passive hook, for an event clip.

### The checks

The node tests:
- the generated test, listed below;
- `test_anim_slim_1155` and `test_q95_1158`.

The generated test covers:
- **Sources:** the manifest's PASS rows and creation ids.
- **Sheets:** grid equals the file, 2048 px and 4 MB or less, q95 lossy with alpha, a new `?v=`, the old files kept.
- **Grids** and the walk and idle rules.
- **Phone:** texSheetK is 1.
- **Anchors:** the reference mapped into each sheet.
- **Same size, same spot**, as drawn, with a control.
- **Timing data** equals BASE.
- **Frame maps.**
- **Everything else equals BASE:** every other hero, the kit, FX2_DEF and the hero line.
- **Casts** are identical.
- **Swings:** blows on BASE's ticks with BASE's amounts; A / B alternation; a forced crit plays the crit clip.
- **Contact cells** at x1, x1.25 and x0.8.
- **Whole fights:**
  - at crit 0 they equal BASE;
  - at real crit they equal BASE plus the v532 rule when the crit clip is new;
  - with the passive clip they are unchanged;
  - control: a swing slowed by x1.05 diverges;
  - fights without the hero equal BASE.
- **Sound rows.**
- **Skill previews.**
- **Ghost alpha.**
- **Grid control.**

Then, one at a time, each under the GPU lock:
- `test_memory_budget_1140`
- `test_offline_art_1154`
- `test_condense_1141`
- `test_skill_previews_1164`

`--suite` also runs every standalone test on this tree and on BASE, 6 at a time. The bar is the same pass set.

## The Korvux method (normalise)

The reference is idle's frame 0 (`referenceState`): top, sole, and cx to 0.1 px.

- **Same reference.** A state whose manifest `reference` label is idle's takes idle's anchors exactly. Its frame-0 fit must still come out x1 ± 0.012.
- **Another reference.** For any other state, idle's frame-0 silhouette (alpha > 100) is scaled by k and shifted to the best IoU on the state's frame 0. k runs over multiples of 0.002, within ± 0.012 of the height ratio. The shift is the centroid, then ± 3 px. Idle's top, sole and cx, mapped through that k and shift, are the state's anchors, and the standing height is idle's × k.

The cut writes these into the sheet as:
- feet = round((sole − Y0) · sy)
- figH = round(height · sy)
- top = feet − figH
- cx = (cx − X0) · sx, to 0.1 px

Korvux's attack, crit, blue and ult fit at x0.700 / 0.698 / 0.698 / 0.698. Without the fit, the combat states would draw about 30% small. The generated test's control checks this.

## Spell FX (`integrate_fx.py`)

Config: `tools/integrate/heroes/<hero>_fx_<ver>.json`, one entry per FX. Each entry has:
- `src` (under `_fx2_accepted`), with an optional `md5` pin;
- `key` (the FX2_DEF key) and `file` (the new sheet name);
- `plate`: green or magenta;
- the knobs: `ext` / `ratio`, `deviol`, `crop` plus `ramp`, `fadeEdges`, `border`;
- `frames`;
- `show: {state, cell}`: the spawn moment, a cell of the hero's own cast clip. The default is that clip's contact cell, the release;
- `placement`, `life` and `ownFx`.

The stages are verify, cut and wire. Every knob goes into `fx_run.json`, so a cut can always be reproduced. v1171 and v1174 did not record their RATIO.

**Placement:**
- **ground** (`disc`, flat, with the rim at the kit radius). The disc is measured on the widest frame: the centre and the radius that holds 95% of the alpha, with the half-alpha radius shown alongside.
- **aim** (on the aimed point) and **claws**.
- **upright** (`puff`, `fit` to the buff, `hold` [F0, F1]). The anchor is the ground contact: the lowest band's alpha-weighted x, at the row with 2% of the alpha below it. `size` comes from `heightOfArt`.
- **ally** and **over** (on the unit it lands on).
- **fieldWide** (no plate). The kit's `fieldWide` flag puts the sheet as a badge over each unit it touches (v591).

**Facing.** The art's painted travel, measured as its centroid's x over the first half of the clip:
- painted to the right: the page's upright mirroring (`_fxMirror`) is correct;
- painted to the left: the entry needs `paint` / a flipped anchor.

**Display life:**
- real time, once: `rt`, `fps2` 12, `dur` = n / 12;
- `fit` to the buff: fade 0.3 s;
- `hold` stretched: fade 24;
- `fadeR`: a fade-out tail.

**Wiring:**
- the FX2_DEF line is replaced in place;
- FX16_ART gets `{k, st, mode}` from the placement;
- the kit slot, or `HERO_ULT_ART` for an ult, gets `ownFx` or `fieldWide`.

**Engine limits.** The pipeline never changes the engine:
- `disc` draws the 5 m fear circle (Warcry's);
- `aim` uses the ult's aoeStun radius;
- a new FX that needs another painter is reported, not wired.

## Proof: Korvux v1162 re-run (16 Oct 2026)

The config is `tools/integrate/heroes/korvux_1162.json`: v1162's own decisions (frame maps, contact cells) written in the pipeline's terms. The work folder is `Downloads/ew-sweep/integrate/korvux-1162-proof`.

**1. Sheets and table.** `verify` → `extract` → `key` → `normalise` → `cut` → `compare`, against live main f1e2d90c and the Archive masters `Game Art/Heroes/Korvux/sprite sheets/v1162 eight 16OCT2026`. Results:
- all 8 q95 game sheets are byte-identical (sha256) to `assets/anim/korvux/*_1162.webp`;
- all 8 lossless masters are byte-identical;
- frame maps and cut geometry (box, grid, sx / sy, anchors) are identical;
- BATTLE_ANIM.korvux is identical as data and as page text.

The keyed frames are pixel-identical to the v1162 run's. The fit gives the same k, top, sole and cx as v1162's `ref_scale_fit.json`.

**2. Wire.** On a worktree at v1162's own BASE (1debe711), `wire` gives:
- the whole BATTLE_ANIM table, hash-identical to 466a65c1 (v1162);
- HERO_TYPES and KITS identical;
- the same 7 sheets leaving the size ratchet (467 → 460), with the file byte-identical to v1162's;
- condense: no tier for any new sheet ("already at the phone budget", as v1162 found);
- Update all lists all eight;
- the undo helper chained into anim-1160.js, and test_veyr_deepcleft_1160 loading it (what v1162 did by hand).

SFX_DATA differs, as expected: v1162 also moved S0172 and S0174 from cast to land. Sound rows are a reported step here, not an automatic one.

**3. Planner versus v1162's hand decisions:**

| State | Proposed | v1162 shipped |
|---|---|---|
| idle | the whole clip, 62 @ 12 | same |
| walk | f29, 50 frames | same |
| crit contact | f43 | same |
| blue contact | f37 | same |
| attack contact | f51 | f52 |
| green contact | f29 | f28 |
| hit | [28, 38] + [83, 95] | [26, 40] + [84, 96] |
| ult | f71 (the slam) | f32 (the release that calls the star) |

The ult row is why a cast's contact is always a reviewer's pick. The engine stage gives v1162's contact cells (30 / 30 / 18 / 30 on the landing / 29), and the same on Hobb and Kharos (fitted 27, Hobb's ult landing 40).

**4. Checks** (on the proof tree, BASE 1debe711; logs in `<work>/checks/`):
- the generated `tests/test_korvux_anim_1162.js` passed **37/37**. It gave v1162's own numbers: the blow on cell 30.24 at x1, 30.49 at x1.25, 29.66 at x0.8; whole fights at crit 0 = BASE and at real crit = BASE + the v532 rule; the slowed-swing control diverged in 4 of 4 fights;
- `test_veyr_deepcleft_1160` passed 70/70 and `test_anim_slim_1155` 23/23, both through the auto-chained undo helper (v1162 reported the same);
- `test_integrate_tool` passed 20/20.

The browser checks (memory budget, offline art, condense) and a fresh rig did **not** run. The 4080 had under 1 GB free (Ember's llama-servers), and `locked.sh` refused, as designed. The stills and clip page in `<work>/look/` were built by `outputs` from v1162's own rig frames, which drew these byte-identical sheets.
