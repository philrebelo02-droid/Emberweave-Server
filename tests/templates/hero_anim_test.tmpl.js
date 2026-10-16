'use strict';
// v@@VER@@ - @@NAME@@'s Phil-approved animations, wired by tools/integrate_hero.py (generated from tests/templates/hero_anim_test.tmpl.js).
// Every number checked here is in tests/fixtures/@@HERO@@_@@VER@@_integrate.json (written by the same run that cut the sheets); the checks are
// tests/helpers/integrate_anim_check.js - sources, sheets, anchors (+ CONTROL), timing data = BASE @@BASE@@, contact cells, whole fights
// tick-identical (+ CONTROL), sound rows, skill previews. Run: node tests/test_@@HERO@@_anim_@@VER@@.js   (EW_BASE / EW_HTML override)
const path = require('path');
require('./helpers/integrate_anim_check.js')(path.join(__dirname, 'fixtures', '@@HERO@@_@@VER@@_integrate.json'));
