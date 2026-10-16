'use strict';
// tools/integrate_hero.py / integrate_fx.py - the pipeline's own rules (frame maps = v1162 / v1175 maps, the Korvux fit, BATTLE_ANIM line format, the page
// patch, fringe + FX key / placement), each with a CONTROL. Runs tools/integrate/test_integrate.py (no Archive, no GPU). The end-to-end proof is the
// Korvux v1162 re-run in tools/integrate/README.md.
const cp = require('child_process'), path = require('path');
const r = cp.spawnSync(process.env.PYTHON || 'python', ['-I', path.join(__dirname, '..', 'tools', 'integrate', 'test_integrate.py')], { encoding: 'utf8' });
process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
process.exitCode = r.status === 0 ? 0 : 1;
