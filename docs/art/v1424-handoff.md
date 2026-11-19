# v1424 art, languages and Arena emblems

Base: live v1423 `285094652e0519685f04a2b580df99312dbbc4c6`.
Branch: `codex/v1424-art-language`. Claude owns review, cluster checks, SHIPPED note and deployment. This handoff does not claim deployment.

## Result

The Arena uses ten original transparent 256px WebP emblems, with translated names in English and all fifteen foreign locales. The final ladder is Champion #1, Warlord #2, Conqueror #3, Master #4–10, Diamond #11–25, Platinum #26–50, Gold #51–100, Silver #101–500, Iron #501–1000, Bronze #1001+. Iron above Bronze follows Phil's final correction via Claude at 07:21:32 on 19 November. Existing crafting/material rarity names are independent and unchanged.

The first three emblems have large jeweled numerals: diamond-white 1, ruby-red 2, amethyst 3. The 3 fits inside its shield. Warlord has a richer gold backing, Platinum has layered bright metal and a larger ice gem, Iron has a layered riveted shield, and Bronze is a plain weathered anvil token. The original generated alpha is preserved; export only resizes onto a transparent canvas. Prompts, revision history, selected source paths and exported SHA256 hashes are in `v1424-league-generation.json`.

Market, Shady Market, Academy and Bulletin Board keep the same painted English logo in every language, following Phil's correction. Hero rarity banners use the existing word-free art and translated overlaid labels in every locale, including English. Text fitting responds to font readiness and resize, disconnecting the old observer target. No new title or rarity art was generated. The shared banner helper also stops selecting worded art.

No combat, rewards, matchmaking, server code or live database changes. The 1.9.5 patch note is a draft with all fifteen translations; Claude may adjust release numbering during integration.

## Evidence

Evidence root: `E:/Emberweave Archive/4 Projects/Open Projects/ART SAME IN EVERY LANGUAGE 19NOV2026/qa`.
Review sheet: the sibling `league-symbols-review.png` (128px and 40px views).

Passing checks:

- `tests/test_art_language_1424.js`: 1123 checks, including all rank boundaries in sixteen locales, distinct assets, actual inline-script compilation and exact baseline scanner comparison.
- `tests/test_lang_step1.js`: 1703 checks.
- `tests/test_patchnotes_translated.js`: 3 checks.
- `tests/test_lang_server_errors.js`: 74 checks.
- `tests/talents-lang.test.js`: 94 checks.
- `browser-art-language-report.json`: 108 actual game screenshots, 128 rarity-label checks across all sixteen locales, 48 painted-logo checks, 12 Arena matrices; zero page errors. Screenshot locales: en/es/de/ru/ja/zh-Hans, desktop 1400x900 and portrait-phone viewport 390x844. The game's existing forced-landscape presentation appears rotated on portrait phones.
- `browser-arena-final-report.json`: separate fresh-browser Arena evidence after final art/range corrections; ten decoded 256px emblems in each of twelve locale/viewport combinations. Read its `passed` field and image paths for final outcome.

Existing gates remain failures, explicitly not suppressed:

- `tests/test_lang_step2.js` stops at 605 hard-coded English scanner findings. Current and untouched v1423 have the exact same finding multiset, compared by text and context.
- Independently running its downstream content-template checks finds 73 existing findings among 3393 templates across fifteen locales. `content-baseline-comparison.json` proves those findings are unchanged from v1423. All new league strings and patch-note translations pass the scoped checks above.
- Raw `srvcheck.js`: 1148 texts, 27 without codes, zero missing code translations. Server files are unchanged by this branch. This is distinct from the passing 74-check server-language regression test.
- Canonical hero sweep, adapted only for fixture authentication, explicit English, optional baseline HTML and failure exit status: both current and untouched v1423 report exactly the same two failures, tablet/full tab Y values 150/164 and desktop/full 111/335. Every reported mode has zero open, tap, coverage, clipping and overlap failures; board widths are stable and equal between modes. Logs: `hero-ui-sweep.log` and `hero-ui-sweep-baseline.log`; screenshots in matching directories. Do not describe this sweep as fully passing.

## Reproduction

Use Node 24 and installed project dependencies. Run `node tools/qa/start_v1424_fixture.js <evidence-directory>` to create an isolated temporary guest database and local server; its stdin `stop` shuts down that server. It never reads a live game database and does not grant mythic heroes.

Run `node tools/qa/art_language_1424_browser.js <evidence-directory>` for the full matrix, or add `--arena-only` for the final art screenshots. Set `EW_UI_FIXTURE` to the generated fixture.json and run `node tools/qa/hero_ui_sweep_1424.js <sweep-output-directory> <port>`. Set `EW_UI_BASELINE_HTML` to the untouched v1423 HTML for the baseline companion. The baseline route uses the actual unmodified HTML against the same isolated local APIs.

`tools/authoring/v1424_art_language.py` records the base-to-v1424 authoring and translation sources, and is not an idempotent updater. Do not rerun it over the finished tree. `package_v1424_leagues.py` exports the selected manifest sources and review sheet.
