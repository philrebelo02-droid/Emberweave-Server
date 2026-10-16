#!/usr/bin/env python
"""integrate_fx.py - Phil-approved Grok spell FX (Game Art/_fx2_accepted) -> game sheets + FX2_DEF / FX16_ART / kit tags.

usage:  python tools/integrate_fx.py <fx config.json> verify|cut|wire|all [--tree <game worktree>] [--only name ...]
  verify  the source render's sha256 + md5 (the page comment quotes md5[:8]; `md5` in the config pins the approved take)
  cut     extract, key (green / magenta plate, every knob in the report), sheet within 2048 px / 4 MB, lossless master + q95, fringe measured
          (visible green, olive, violet), placement measured (disc / anchor / size / facing)
  wire    the FX2_DEF line replaced in place (same key, a new file name: never reuse an asset version), FX16_ART + the kit's ownFx tag (spawn on a
          cast-clip cell), or the kit's fieldWide flag (badges over the units it touches, v591)
Checks after wire (the same mandatory set as heroes): python tools/integrate_hero.py <hero config> checks --tree ... runs the browser ones under
the GPU lock; the FX test asserts casts / fights tick-identical to BASE (display only). See tools/integrate/README.md.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from integrate import fx  # noqa: E402

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('config')
ap.add_argument('stage', choices=['verify', 'cut', 'wire', 'all'])
ap.add_argument('--tree')
ap.add_argument('--only', nargs='*')
a = ap.parse_args()
if a.stage == 'wire' and not a.tree:
    sys.exit('wire needs --tree')
if a.tree and os.path.normcase(os.path.abspath(a.tree)) == os.path.normcase(r'C:\Users\Home\Downloads\Emberweave-Server'):
    sys.exit('never wire into the shared checkout - make a worktree')
fx.stage(a.config, a.stage, tree=a.tree, only=a.only)
