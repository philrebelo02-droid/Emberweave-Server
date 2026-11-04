# Hero61 approved Blue take 5

Claude's 4 Nov 02:02:18 request relays Phil's approval and asks for this isolated
branch from 3368ea31. Blue now selects its own body cast animation instead of
the attack fallback. The other twenty atlas entries (seven original clips,
including fourteen streaming death parts), healing/protection effects, combat,
sound, and Green chest/head placement are preserved.

Source: `blue-take5.mp4`, Hailuo creation 574193075629453313, 768x832, 158 frames
at 24fps. SHA256:
`d268d383dd8d50e09a17364f9c18573b4ce6578dbb96ebd50c1058bd949adbf8`.
The silent twin has identical video packets. Source verification and alignment
are recorded in `tests/fixtures/hero61-approved-art.json`.

The standard integration key/cut pipeline anchors Blue to the existing Idle
(frame-zero overlap .9965), with 116 cells, contact89/source54, and unchanged
2.5-second gameplay cast. Padding16 and a two-pixel transparent gutter retain
a five-pixel minimum content margin, 141px standing figure, 1910x2040 atlas,
under4MB. Only the new Blue asset has a new cache version (`1264blue5`).

Visual QA caught cyan plate contamination that the usual green-excess metric
missed. `tools/key_hero61_blue5_plate.py` removes the green contribution from
cyan-only edge pixels of this purple-only source; it reduces alpha and unmixes
RGB rather than painting an outline. Run once after `key`, before `cut`; the
recorded pixel hashes are in the local integration evidence. Full unmix alone
did not remove this residue. Final green-excess fringe: master0%, q95 .0009%.
The source has a faint local glow near its left margin; the atlas gutter does
not reconstruct source pixels. Inspected cast/rest/recovery samples remain
complete, with the shield and mace held by the character.

Focused validation: `test_hero61.js`, `test_hero61_art.js`, `test_hero61_fx.js`.
Art checks cover new source/atlas hashes, runtime Blue selection, source contact,
phone bounds, offline asset discovery, and pixel-independent combat. No full
suite, simulation controls, merge, or deployment. Claude owns release review.
