# World picture v02 — approved master

`world-v02-l0-r00-c00.png` is the complete map picture Phil approved. It has a dark void center and no mountains. All nine middle and 81 close pictures now exist and their source-derived outer edges have been verified. They are wired only into a **local, unshipped branch** pending game checks and merge.

## Puzzle naming contract

Use lowercase filenames: `world-vNN-lL-rRR-cCC.png`. `vNN` is the approved master version, `L` is the picture level, and two-digit `RR`/`CC` are zero-based row (top to bottom) and column (left to right). No names depend on a region, terrain type, or the order the files were created.

| Level | Layout | Names | World footprint of one piece |
| --- | --- | --- | --- |
| `l0` | 1 × 1 | `r00-c00` | 220 × 220 gameplay cells |
| `l1` | 3 × 3 | `r00-c00` through `r02-c02` | 1/3 of the map per axis |
| `l2` | 9 × 9 | `r00-c00` through `r08-c08` | 1/9 of the map per axis |

Each higher-level image is a more detailed view of the **same bounded area**, displayed at full map-view size at its zoom. It is not a new region or a repeated decorative texture. World coordinates and landmark anchors must match the master. For a level with `N` columns, tile `(row, col)` covers `[col/N, (col+1)/N] × [row/N, (row+1)/N]` of the whole world, with the top-left as the origin. This rule yields exactly 1 + 9 + 81 = 91 files per approved version. There is no 729-piece level. Picture seams are equal fractions of the image and **do not mark region borders**: gameplay regions use 90/40/90 cells on each axis, while thirds of 220 are fractional cell positions.

The manifest lists every expected filename and its exact fractional world bounds. All 91 files exist. `edge-verified-review` means a piece passed the source-edge check; it is not Phil's final in-game approval. Never rename a piece to make it fit somewhere else; fix the art and keep the index stable. New master compositions use a new `vNN` directory so no old tiles are mixed with new ones.

The World Tree is `overlays/worldtree-integrated-center-v1.png`, a feathered terrain image fixed at the world center over every picture level. This keeps its roots in the void floor without rewriting the approved master or the 91 indexed puzzle pieces. The visible landmark is about nine map cells wide inside the 40×40 void, leaving roughly 15 open cells to each side for a future war event. The protected, clickable core is 4×4 cells. Earlier transparent tree sprites are preserved but not loaded. The assembled 9×9 overview is `qa/world-v02-l2-assembled-PREVIEW.png`; it omits the dynamic World Tree overlay by design.

