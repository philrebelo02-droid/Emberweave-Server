# 03 — ART PROTOCOL
### Making the art: every fire, plate, slice and wire.
Rebuilt 13 Sep 2026: rules with their explanation · index by importance · chapters that are HOW TO.
**Lessons learned live in `03.1 - ART LESSONS LEARNED`. General rules live in `01 - MASTER PROTOCOL`.**

---

# THE RULES

**RULE 1 — ANY AND ALL PROMPTING GOES TO `04 - PROMPT BIBLE`. IT OUTRANKS THIS DOCUMENT ON PROMPT CRAFT.**
Read it before writing a single word of a prompt, and update it after **every** verdict — approval and
rejection alike. Where the Bible and this file disagree about wording, the Bible wins. This document
owns the MACHINE (the composer, the plate, the slice, the wire); the Bible owns the WORDS.

**RULE 2 — EVERY TIME YOU DO ART, YOU OPEN THIS DOCUMENT.**
Not once a session — every hero, every clip, every slice, every fire. A rule read an hour ago and not
executed is a rule you do not have.

**RULE 3 — THE MANDATORY BLOCKS GO IN. ALWAYS. ONLY PHIL TAKES THEM OUT.**
Block 1 FEMALE (every female, every state) plus **exactly one** branch block — 2 REAR-FACING or
3 FRONT-FACING, chosen once from her art and never varying between her states. They are written FIRST
and everything else is sized around what is left. **Never trim a block to make a prompt fit, and never
paraphrase one.** The one standing exception is strike states (ch.3 §5), where block 1's performance
wording comes out and block 2's jiggle line stays.

**RULE 4 — WHEN A BLOCK WILL NOT FIT: SHORTEN THE BLOCK, NEVER A LOCK — THEN ASK PHIL.**
A lock is a receipt for a failure; a block is wording. Wording can say the same thing in fewer words;
a lock cannot be shortened without re-opening the failure that bought it.

**RULE 5 — PHIL'S CONCEPT ART IS THE SOURCE OF TRUTH FOR ALL GENERATION.**
`PHILS GAME CONCEPTS/<Name> - static.png` and nothing else — never a copy, a derivative, an older
plate, or a session's mirror. **Never edit, crop, key or "clean" his art.**

**RULE 6 — CLAUDE NEVER MAKES OR EDITS ART.**
Anything that requires drawing — a plate, a pose, a seed, an effect, a retouch — goes to the thread or
to Phil. **Moving a limb is drawing.** Claude does measurement, mechanical geometry, verification and
wiring.

**RULE 7 — px MEANS DETAIL, NEVER FIGURE HEIGHT.**
400 px of detail for men, 500 for women. `figH` is a measurement the slicer reports afterwards — never
a target, never passed in, never a round number. The cut is NATIVE.

**RULE 8 — A HERO'S QUALITY IS THEIR WEAKEST ANIMATION.**
Every state ships at ONE detail number, the ceiling of their lowest animation. To raise a hero,
re-fire the single worst clip — never the whole set, and never by scaling a cut up.

**RULE 9 — THE CREDIT COUNTER DROPPING IS THE ONLY PROOF A FIRE HAPPENED; THE CLIP'S OWN PAGE IS THE
ONLY PROOF THE PROMPT FIRED.**
After every fire, open the clip: the prompt text must be shown and there must be no
`Enable Optimization` tag.

**RULE 10 — REAL KEYSTROKES ONLY. `execCommand('insertText')` IS BANNED.**
It fills the DOM, reads back in full, and leaves the app's model EMPTY. If typing will not land the
cause is a panel swallowing input — **close the panel, never switch input method.**

**RULE 11 — LOOK AT THE PLATE IMAGE BEFORE EVERY FIRE.**
The gate compares prompt to prompt and cannot see what image is in the composer. Not the filename, not
the folder, not what it was last time — **open the image.**

**RULE 12 — NOTHING LEAVES THE FRAME.**
Assert no non-chroma pixel in the 3 px border on every frame. A clip that exits is cut before the exit
and rubber-banded, or re-fired.

**RULE 13 — SHOW PHIL FRAMES BEFORE WIRING ANYTHING.**
A numbered contact sheet, cropped to the thing being judged, at full size. **Metrics are blind to
spinning, shuffling, dropped props and costume swaps.**

**RULE 14 — A HERO IS NOT WIRED UNTIL THE FOUR CHECKS PASS (ch.7).**
The priority ladder works for this hero · all frames are scaled · anchored on one ground line · the px
guidance was followed. Report all four in one line before calling a hero done.

**RULE 15 — COUNT TO NINE ON A MELEE HERO.**
`HERO_TYPES[key].range` decides the roster: melee 26-30 (or any `reach`) = **9 states including the
crit CLIP**; ranged 150-235 = **8**. Every hero crits; only melee gets the clip. **This is an ART
roster rule, never a combat rule.**

**RULE 16 — ONE TAB PER DESTINATION, AND THE WORKSTATION IS PHIL'S CHOICE.**
Never two tabs of the same site; close anything untouched for three hours. **Never move off a thread,
tab, tool, route or folder Phil picked without asking first — one line, then wait.**

**RULE 17 — VERIFY THE TEXT BODY, NOT THAT THE SEND RETURNED.**
An attachment can post without its message. Grep the posted message for a phrase only your brief
contains; a non-zero length proves nothing, because the attachment supplies one.

**RULE 18 — NEVER SCRUB A WATERMARK IN SOFTWARE. RE-HARVEST OR RE-FIRE.**
Download through the card's control → **Without Watermark**. The clean file is only ~3 KB smaller, so
size proves nothing — look at the bottom band of a decoded frame.

**RULE 19 — BUILD ANYTHING PHIL JUDGES FROM THE LIVE FILES, AND MEASURE THE DELIVERABLE ITSELF.**
Never from a scratch cut made to answer a question — a BEFORE/AFTER video rendered that way was green
in both panels and had him doubting art that measures 0.00%. Sample the exported file's own frames
before it is sent (MASTER RULE 18; `03.1` §3.0).

**RULE 20 — A SUPERSEDED SHEET OR PLATE LEAVES THE WORKING FOLDER THE MOMENT IT IS REPLACED.**
Renaming in place is not protection; a stale plate will be picked up and fired.

**RULE 21 — NEVER COLOUR-CORRECT A FINISHED `.webp`.**
Any correction happens before the single encode. A second encode is a measurable quality loss and it
is what Phil sees as "poor quality".

**RULE 22 — IF A NOTE IN THIS DOCUMENT IS UNCLEAR, GO TO `03.1 - ART LESSONS LEARNED`.**
Every instruction here was bought by a failure, and that failure — with the measurements, Phil's words
and what was tried first — is written up there under the same section number. **The chapters say what
to do; 03.1 says why, and it is the tie-breaker when a note reads ambiguously.**

---

# INDEX — in order of importance

| ch | chapter | open it when | was |
|---|---|---|---|
| **1** | **GROK IMAGINE — the source of ALL art** | every clip, character and FX. Hailuo is OUT (Phil, 16 Sep 2026) | §1 |
| **2** | Plates | before a fire, and whenever a plate is built or chosen | §3 |
| **3** | Slicing | turning an approved clip into a sheet | §5 |
| **4** | Measuring | before reporting any number about a clip or a sheet | §6 |
| **5** | Wiring | putting a hero into the game | §7 |
| **6** | Filing | the moment a sheet or clip is finished | §9 |
| **7** | Quality, render and cache | the game looks soft, or a correct file shows up wrong | §8 |
| **8** | Spell FX | any ability, ult or FX plate | §12 |
| **9** | The seamless loop, the locked templates and the walk | idles and walks, and any loop that must close | §11 |
| **10** | FLAGGED — do not touch | before starting work on any hero | §14 |
| **11** | The trap index | fast lookup by symptom | §10 |
| **12** | Grok Imagine — folded into ch.1 | historical pointer only; ch.1 owns the generator now | §12 |
| **13** | Hero cards, ascension borders and rarity banners (18 Sep 2026, Phil's standard) | making or re-cropping a hero card, a border or a rarity/word banner (Hailuo cards, v614–v627) | new |

**Numbered in order of importance — chapter 1 is the one opened most.** Every chapter says what it was
numbered before 13 Sep 2026.

**⛔ AND THE SUBSECTIONS MOVED WITH THEIR CHAPTERS. This paragraph used to claim they did not** —
*"no SUBSECTION number changed … every cross-reference still lands"* — **and that was false, and
expensive.** Measured 14 Sep 2026: **23 loose `ART §n.n` citations across `04`, `04.1` and `09`
pointed at chapters that no longer exist**, because everyone trusted this sentence instead of
checking. A subsection carries its chapter's number: old `§5.4d` is now **`§3.4d`**, old `§11.4b` is
**`§9.4b`**, old `§6.4b` is **`§4.4b`**. Apply the `was` column above to the part before the first
dot. Twenty of the 23 were swept 14 Sep. **Write a new citation as a backticked filename plus `§`** —
`` `03 - ART` §3.1 `` — because that is the only form `tools/refcheck.py` can validate.

**MOVED OUT 13 Sep 2026 — these are PROMPT CRAFT and now live in `04 - PROMPT BIBLE`:** old ch.2
PROMPTS (now Bible ch.1) · old ch.4 WOMEN (now Bible ch.2) · old ch.13 THE FLOURISH POOL (now Bible
ch.7). **Their lessons moved with them, into `04.1 - PROMPT BIBLE LESSONS LEARNED`.**

---

# 1 · GROK IMAGINE — **THE SOURCE OF ALL ART**

**Latest 3 Oct20:58 direct Phil:** "please continue to figure out what works" after rejected2.3 test/model-choice question. Continue scoped Rhukk attack/crit replacement experiments in current Hailuo lane; do not reinstate the exhausted-one-test/pending-question pause. Current test ATTACK10 uses2.3/768p6s/canonicalStart/noEndsupported/25credits/wandOFF; no sourceplate/provider/duration changes. Review each result before refiring, preserve failures. This supersedes earlier one-test-only wording below for this ongoing scoped task.

**Scoped 3 Oct20:37 direct Phil model-test exception:** after 2.0 repeatedslash/frontturn failure and explicit disclosure that2.3 removesEndFrame, Phil said "yes" to ONE Rhukk attack test inHailuo2.3 at768p6s/25credits, samecanonicalStartimage, exactATTACK8 prompt, wandOFF. No2.3crit or further2.3fires authorized by this one-test approval. Model AND endconstraint change together; no single-variable cause claim. Other art settings/ownership restrictions preserved.

**CURRENT scoped ownership override, Phil 3 Oct 19:4x-19:5x:** "Claude is off art" / "You drive hailou now" / "Not my computer"; ChatGPT operates Hailuo in the separate in-app browser. Phil then authorized Claude to slice and wire the exact clips AFTER Phil approves them, while ChatGPT continues generation. No unapproved clip is a downstream handoff. Rhukk attack is ONE single claw slash; crit is ONE horn thrust beginning ground-facing then driving upward in a puncturing motion. These direct instructions supersede the older horizontal-crit/Claude-generation lane, not model/duration/plate settings. Verify wand by SVG path count (1 OFF, 4 ON), never gray icon colour or a click alone. ATTACK6 was mistakenly submitted wandON and disclosed; CRIT5 wandOFF verified before submission. Neither is approved by submission alone.

**Phil, 16 Sep 2026: *"I decided hailou is out."* · *"The new source of all art is grok imagine."***

**⚠ CURRENT (Phil, 2-3 Oct 2026) - HERO CHARACTER ANIMATIONS ARE MADE IN HAILUO AGAIN.** Why (Phil, 3 Oct 11:2x): *"Hailou was cut because grok was doing great, but then he started to fall behind so we have to use hailou"*. Phil, 2 Oct: *"chatgpt will write the prompts, you run hailou"* (the women; Pyroclast 8/8 shipped v948). Phil, 3 Oct ~10:2x ET: *"we are about to start remaking some heroes using hailou"* and ~11:15: *"Work together with chatgpt, Remake all of the new 9 heroes we remade today, all 9 of their actions if they have it"*. Setup and lessons: `Open Projects/3 - Heroes, Art and Lore/WOMEN - HAILUO RUNS 02OCT2026/README.md` and `MEN - HAILUO RUNS 03OCT2026/README.md` (Hailuo 2.0, Start/End Frame with the 768 plate in both slots, 768p, 6 s, wand OFF). The Grok Imagine rules in this chapter still apply to whatever Grok makes (spell FX).

**Scoped exception, Phil 16 Sep 2026, Gauntlet Split backgrounds only:** Phil said to make the
woodland lane imagery directly, *"without grok"*, and approved the corrected three-lane woodland
image as *"perfect this is the standard, lock this as the standard"*. For the 96 Normal bonus
arena backgrounds, use direct image generation from the approved woodland geometry standard and
site-specific chapter scenery. This exception does not change the Grok source for hero animation,
spell FX, portraits or other game art. The approved source and the six-per-chapter geometry are
identified in `Open Projects/1 - Campaign and Bonus Stages (Gauntlet)/14 - GAUNTLET SPLIT LANE ART CONTRACT.md`; every variant must be inspected
for three roads, four paired narrow crossings per divider, shared meeting areas, unit/FX room and
natural scenic quality before it can be wired. Preserve native output; never upscale.

**Every clip this project makes from now on — character animation AND spell FX — comes out of Grok
Imagine.** Hailuo's fire card, composer, gate, settings, traps and watermark-free download are
archived in `ARCHIVED INFORMATION (Hailuo era)/01 - HAILUO - the fire card, the composer, the
traps.md`. **Do not work from that file.**

**Prompt WORDING still belongs to `04 - PROMPT BIBLE`, which outranks this chapter on craft.** This
chapter owns where the art comes from, where it lands, and what must be true of it before it is cut.

---

## 1.0 THE TWO FOLDERS — and the one that must never be wired as FX

**Phil, 16 Sep 2026:** *"I will have grok make 2 folders on hero GROK SPELLS ART, GROK ANIMATION
ART."* **The folder on disk is `GROK SPELL ART` — SINGULAR.** Read a folder name off disk, never
from a description; the plural cost an hour on 16 Sep.

| folder | holds | wired as |
|---|---|---|
| `Game Art/Heroes/<In-game name>/GROK SPELL ART/` | spell and ultimate FX — `clips/`, `seeds/`, `prompts/`, `sprite sheets/` | `FX2_DEF` rows (ch.5 §5.6) |
| `Game Art/Heroes/<In-game name>/GROK ANIMATION ART/` | **character animation** — idle, walk, attack, hit, casts, ult | `BATTLE_ANIM` rows |

**⛔ `GROK ANIMATION ART` IS EXCLUDED FROM THE FX PIPELINE AND MUST STAY EXCLUDED.** `fxmap.py`
carries `_FX_DIRS` and lists the SPELL folders only. **MASTER RULE 23:** a character sheet mapped
into an `FX2_DEF` row overwrites a hero's performance with a spell effect. **The convenient move —
widening the glob to `GROK*ART` — is the one move that must never be made.**

**⛔ AND A ZERO IS A REFUSAL, NOT A RESULT.** `fxmap.py` exits 2 when it finds no sheets, because an
empty glob is indistinguishable from a finished job (MASTER RULE 17). That refusal is what caught the
16 Sep folder rename inside an hour.

## 1.1 THE SOURCE IMAGE

**`PHILS GAME CONCEPTS/<In-game name> - static.png` is the only sanctioned source for a character.**
Hero-folder mirrors and `Base files/` are not (`01 - MASTER PROTOCOL` §2). **Spell FX use the seed
plate** — ch.8 §8.2 owns that and is unchanged by this switch.

**The 768 plate is a HAILUO input and is no longer made for new work.** `Pipeline tools/plates (768,
fed to Hailuo)/` stays on disk for the heroes already cut from it; nothing new is added to it.

## 1.2 THE COMPOSER ROUTE — direct image paste

1. Open the one persistent Grok Imagine tab.
2. Open the exact source image and copy the **image pixels**, not its filename or path.
3. Focus the prompt field and paste the image directly.
4. **Wait until the correct thumbnail is visibly attached above the prompt.**
5. Enter the complete prompt.
6. Verify the mode and settings Phil has set.
7. **Reread the visible prompt and confirm it belongs to the same hero and the same state as the
   attached image.**
8. Only then submit.

The plus → Uploads → Upload → file-picker route is a **fallback**. Do not use it when direct paste
works.

**1.2b WHEN NEITHER PASTE NOR THE FILE PICKER WORKS (2 Oct 2026, 01:34 - Grok, Court of the Final Candle seed v0012).**
Symptom: the native file chooser never opens, and drag or paste drops the PATH STRING into the prompt box with no
thumbnail (seen after a halt/restart of the browser-driver session; nothing in the brief or quota changed).
Fix that worked: clear the path text from the prompt box, then set Imagine's hidden `<input type="file">` directly with the
browser tool's file-upload action (it needs no chooser). Second resort if the tool cannot set an input: serve the seed
from a localhost-only server and assign it to that input from page JavaScript (`DataTransfer` + a `change` event).
Either way, step 4 still holds: the correct thumbnail must be visible before anything is submitted (1.2a).

**⛔ 1.2a THE SUBMISSION LOCK.** Never submit until **both** the correct thumbnail **and** the
complete prompt are visibly present in the same composer. Missing thumbnail, missing or truncated
prompt, or either belonging to another hero — **stop and fix the composer before submitting.**

## 1.3 ⛔ THE GEOMETRY IS NOT HAILUO'S, AND NOTHING DOWNSTREAM HAS BEEN RETUNED FOR IT

**Measured on the first accepted Grok Imagine character clip — Nerisse Bellglass's attack, 16 Sep
2026, the take Phil passed:**

| | Grok Imagine | Hailuo, what everything was built for |
|---|---|---|
| frame | **816 × 1104** | 768 × 768 |
| rate | **24 fps** | 24 fps |
| frames | **145** | ~142 |
| duration | ~6.0 s | 6 s |

**⛔ `cs10.py`'s `PAD` and anchor logic, `figH` / `feet` / `cx` / `top`, `CELL_CAP` and the 48-frame
native cut were all written against 768×768. None of them has been run against an Imagine clip.**
**Nothing is known to be broken. Nothing has been tried.** The first cut off an Imagine clip is a
measurement exercise, not a routine one: cut it, measure it against a control, and **write what you
find into this section** before cutting a second.

**And a ruler tuned to the old frame is not a ruler.** `bustcheck.py` has only ever been read against
768×768 clips; its px/frame figures **are not comparable at a different scale**, and the benchmark
table in `04 - PROMPT BIBLE` §2.3 does not apply to an Imagine clip until it is re-based.
**A number that cannot be compared is not a number.**

## 1.4 WHAT THE FIRST ACCEPTED CLIP PROVED, AND WHAT IT DID NOT

**Nerisse Bellglass's attack. Eight Hailuo fires and 200 credits produced nothing Phil would take;
one Imagine take did.** Measured against her two APPROVED clips, because after 16 Sep no ruler is
reported until it has scored an approved clip sensibly:

| | Grok attack | approved walk | approved idle |
|---|---|---|---|
| sqrt-area vs frame 0 | −4.4% / +6.5% | −2.0% / +3.4% | −3.8% / +5.2% |
| head-top movement | **6 px** | 10 px | 18 px |
| **frame 0 vs final frame, IoU** | **0.748** | **0.983** | **0.982** |

**✅ THE COSTUME HELD.** Bodice plating, neckline, skirt, boots and headdress intact in every sampled
frame. **Four different costume wordings across eight Hailuo fires failed exactly this.** Both props
held. Size lock inside the approved band. Her head steadier than either approved clip.

**⛔ IT DID NOT CLOSE ITS LOOP — IoU 0.748 against 0.98.** She does not return to her opening stance,
so **the sheet jumps at the wrap** (ch.9). **This is the first thing to check on every Imagine clip**,
and it is a prompt fix, not a re-cut: the end-stance lock, in the prompt, in the same words the
approved Hailuo clips used — *"She settles into exactly her opening stance on the final frame."*

**⛔ AN IDLE OR A WALK THAT DOES NOT CLOSE IS WORSE THAN AN ATTACK THAT DOES NOT** — those loop
continuously, so the jump is on screen every few seconds.

## 1.5 HARVESTING AND FILING

The clip goes to `Game Art/Heroes/<In-game name>/GROK ANIMATION ART/` (character) or
`GROK SPELL ART/clips/` (FX), named `<In-game name> - <what it is doing>` (ch.6 §6.1).
**FX sheet filenames must stay `<In-game name> - <Ability name>.webp`** — `fxmap.py` strips the hero
name then the ability from the filename, and anything else becomes class **U**, which is never
guessed and simply does not ship.

**A candidate is not approved until Phil says so.** Do not slice it, wire it, file it as active or
deploy it before that (MASTER RULE 20). **Show pictures, not descriptions.**

## 1.6 THE CONTINUITY RECEIPT

**Whenever a Grok UI route is solved or changes, write the exact reproducible clicks and the
verification state into the worklog immediately.** *"Uploaded"* or *"generated"* is not a record — it
forces the next session to rediscover the workflow. This is the rule that kept the Hailuo route
reproducible for a month, and it is worth more now, not less, because the Imagine route is new.

## 1.7 WHAT IS STILL UNKNOWN — write the answers in here as they land

1. ~~**The whole cut chain at 816×1104.**~~ **FIRST ANSWER IN, 16 Sep 2026 — IT RUNS, AND TWO
   NUMBERS ARE WRONG.** `cs10.py` was run on the accepted Imagine clip with the carry-forward
   settings (`PAD=60 DESPILL_ALL=1 SHEET_LOSSLESS=1 ALPHA_SOFT=1 ALPHA_FLOOR=4 PROP_NEAR_MIN=40
   PROP_MIN=400`), output to scratch, nothing wired:

   ```
   [watermark] 0 px locked
   [CROP_BOX] 47,125,709,913
   META n:48 fw:782 fh:908 cols:6 rows:8 figH:693 feet:833 cx:414 fps:30 top:140 detailPx:327
   ```

   **✅ THE WATERMARK SCRUBBER CORRECTLY LOCKED ZERO PIXELS.** Its *"nothing wordmark-shaped down
   there: the clip is clean"* guard held on a non-Hailuo clip. **That was the biggest predictable
   hazard and it is closed** — the scrubber hunts a Hailuo wordmark in the bottom band and, on a
   clip that has none, correctly erases nothing.

   **⛔⛔ I FIRST REPORTED `figH` 693 AGAINST HER APPROVED 439 AS A "58% MISMATCH, THE NUMBER TO SOLVE
   BEFORE ANYTHING IS WIRED". THAT WAS WRONG AND IS WITHDRAWN.** §5.2 says it in the file:
   `qh = u.sprH * (A.fh / A.figH)` — **the engine consumes the RATIO, not the absolute** — and
   *"figH/feet varying between states is not a warning sign by itself."* I compared the wrong number.

   **THE RATIO, off her LIVE rows:**

   | state | fw | fh | figH | **fh / figH** |
   |---|---|---|---|---|
   | **APPROVED idle** (Hailuo) | 462 | 576 | 444 | **1.297** |
   | **APPROVED walk** (Hailuo) | 412 | 577 | 446 | **1.294** |
   | **the Imagine cut** | 782 | 908 | 693 | **1.310** |

   **1.310 against 1.297 — about 1%.** The Imagine sheet would render her at essentially the same
   on-screen height as her approved idle. **The cell is bigger and the figure is bigger by the same
   factor, which is exactly what the ratio is for.** Her other six states sit at `figH` 500 with
   ratios 1.02-1.26 and have done since the 5 Sep batch.

   **What IS slightly off is the ground line, and it is small:** `feet/fh` is **0.917** on the Imagine
   cut against **0.894** idle and **0.886** walk — her feet sit about 2-3% lower in the cell. Worth a
   look at play size; **not a scale break, and nothing like the alarm I first raised.**

   **THE LESSON, and it is MASTER RULE 16 again on my own claim: a surprising measurement means read
   how the number is CONSUMED before reporting it.** The answer was in §5.2 of this same file.

   **⛔ `fps` CAME OUT 30 — CHASED, AND IT IS A REAL TRAP, THOUGH NOT THE ONE IT LOOKED LIKE.**
   It is not a misread of the source. `cs10.py` line 755: **when no fps is passed it DEFAULTS to 30**,
   with the comment *"24fps against 60 steps 2/3/2/3 rendered frames, which reads as judder however
   good the art is; 20 and 30 land clean every time."*

   **But the live client disagrees with that comment, and so does Phil.** Counted across
   `emberweave-heroes.html`:

   ```
   fps 24 -> 394 rows        fps 10 -> 150     fps 12 -> 85     fps 30 -> 16
   ```

   **`fps:24` is the overwhelming shipped practice, and ALL EIGHT of Nerisse Bellglass's states are
   24** — including the idle and walk Phil approved and told us not to touch. **MASTER RULE 16: when
   the tool disagrees with Phil, the tool is wrong.** He approved 24 fps animations; the judder
   argument in that comment is not what shipped.

   **⛔ SO THE DEFAULT IS WRONG FOR EVERY HERO CUT SO FAR, AND A CUT THAT OMITS THE ARGUMENT LANDS A
   STATE AT 30 BESIDE ITS SEVEN SIBLINGS AT 24 — the same hero playing one state 25%% faster than the
   rest.** It did not bite during the Hailuo era because the fps was being passed explicitly.

   **ALWAYS PASS IT. It is `argv[6]`:**
   ```
   python3 "Pipeline tools/cs10.py" <clip> <key> <state> <outdir> 48 24 "249,1,245"
     env: PAD=60 SHEET_LOSSLESS=1
   ```
   Verified: the same clip re-cut with `48 24` produces an identical sheet and `"fps": 24.0`.
   **Check the hero's existing rows and match them** — do not assume 24 for a hero whose set is 12.

   **⛔ CORRECTED 17 Sep 2026, 1000 heartbeat — THIS BLOCK USED TO END AT `48 24`, AND THAT COMMAND
   IS THE CAUSE OF THE 34 UNKEYED FX SHEETS IN §3.4r.** It was written on 16 Sep to fix the fps
   default and it dropped the SEVENTH argument — the chroma — while doing it, under the words
   "ALWAYS PASS IT", in the chapter whose subject is the art route. `GOTCHAS/09 - GOTCHAS - running log of problems and fixes.md` carried the same
   six-argument command under "THE FIX AT THE CALL SITE". **A builder following this document
   exactly produced run A of the 0800 reproduction, to the pixel.** Omitting the 7th argument left
   `CHROMA` at the module default GREEN and keyed nothing off a magenta clip. `cs10.py` now
   **refuses to run without it** (exit 2). The chroma is the colour the clip was SHOT ON — measure
   frame 0, never assume (§3.1, §3.4a).

   **NOTE: `scipy` had to be installed on the device VM** for `cs10.py` to import at all.

   ch.3's settings block is still a Hailuo settings block.
2. **Frame count.** 145 in, 48 cells out — which frames are dropped, and does the hold survive?
3. **Whether Imagine holds a seamless loop at all** when the end-stance lock is written in.
   **EVIDENCE SO FAR, 16 Sep 2026 — TWO CLIPS, BOTH OPEN, AND THE SECOND IS WORSE:**

   | clip | frame 0 vs final, IoU | sqrt-area | rotates? |
   |---|---|---|---|
   | Nerisse attack (Phil passed it) | **0.748** | −4.4%% / +6.5%% | no |
   | Nerisse idle | **0.672** | −1.5%% / **+8.6%%** | **yes** |
   | her APPROVED idle (Hailuo) | **0.982** | −3.8%% / +5.2%% | no |
   | her APPROVED walk (Hailuo) | **0.983** | −2.0%% / +3.4%% | no |

   **⬛ AND THE THREE FAULTS LOOK LIKE ONE FAULT.** The idle does not close, **grows 8.6%% toward
   camera**, and **rotates off its opening three-quarter facing** — and §9.1 records that the End
   Frame slot suppressed the zoom precisely *"because the last frame must match the first"*.
   **That slot was pinning scale, facing AND pose, structurally and for free, in every approved clip
   this archive holds.** Imagine has no slot, so nothing pins any of the three.

   **THE PROMPT MUST NOW CARRY ALL THREE EXPLICITLY** — end stance, size, facing — **because one
   sentence is replacing a mechanism that was doing three jobs.** Writing only the end-stance lock is
   the likely next failure.

   **⬛ FIRST RESULT IN, 16 Sep 21:16 — TWO OF THE THREE LOCKS DEMONSTRABLY WORK.**

   | | idle v2 (locks) | idle v1 | APPROVED idle | APPROVED walk |
   |---|---|---|---|---|
   | loop IoU | **0.753** | 0.672 | 0.982 | 0.983 |
   | size drift | **-5.0%% / +0.0%%** | -1.5%% / **+8.6%%** | -3.8%% / +5.2%% | -2.0%% / +3.4%% |
   | head-top travel | **12 px** | 24 px | 18 px | 10 px |

   **✅ THE SIZE LOCK BIT HARD** — v1 grew +8.6%% toward camera; v2's maximum is **+0.0%%**. She never
   gets bigger than frame 0 at any point. **Gone, not reduced.**
   **✅ THE FACING LOCK BIT** — v2 ends on the facing it starts on; head-top travel **12 px, better
   than her approved idle's 18**.

   **⛔ THE END-STANCE LOCK DID NOT CLOSE IT, AND SPLITTING THE SILHOUETTE SAYS WHY.** Central 40%%
   of her width (body) against everything outside it (skirt, drapes, tendrils):

   | | whole | **body** | **drapes/tendrils** |
   |---|---|---|---|
   | idle v2 (locks) | 0.753 | **0.918** | **0.530** |
   | idle v1 | 0.672 | 0.838 | 0.476 |
   | APPROVED idle | 0.982 | 0.994 | **0.962** |

   **Her BODY went 0.838 -> 0.918. Nearly all the remaining failure is her tendrils and skirt.**
   On a hero whose drapes are most of her outline, a loop that is right about the body still scores
   badly — and the approved Hailuo clip returned its tendrils too, because the End Frame slot matched
   **the whole image**, not just the figure. **So the number is real, not a ruler being unfair.**

   **⬛ SO THERE IS A FOURTH LOCK, AND `04 - PROMPT BIBLE` §2.3 ALREADY HAS THE WORDING:**
   *"skirt and drapes keep the first frame's spread"* — written for the COSTUME failure, and it is
   what the LOOP needs now. **Nothing in the three locks names the drapes at all.**

   **The locks are not a failed idea: two of three are working after one attempt.** UNTESTED: the
   fourth. Write the split here when a clip carrying it lands.

   **THE RULER IS NOW A TOOL: `tools/loopcheck.py`** (16 Sep 2026). It prints loop IoU, size
   drift and topmost-pixel travel, and **refuses to run without `--control <an APPROVED clip>`**
   — a ruler that has not scored an approved clip is not evidence. **It prints the SPAN of the controls, never a pass mark** —
   approved clips run from Vireo's idle at **0.770** to Lumi's ping-ponged idle at **1.000**, so
   **compare like with like: a clip against its own hero's approved work, an idle against an idle.**
   **Run it on every Imagine clip before anything else:**

   ```
   python3 "Operating procedure/tools/loopcheck.py" <new clip> \
     --control "Game Art/Heroes/<Hero>/clips/<Hero> - idle.mp4"
   ```
4. **Whether the FX seed-plate rules (ch.8) need changing** now that character work uses the same
   generator.
5. **Whether `bustcheck.py` and §4.4b's sqrt-area control need re-basing** at the new frame size.

**Every one of these is answered by measuring a real clip, not by reasoning.** Put the answer here
the same session (MASTER RULE 19).
# 2 · PLATES  *(was §3)*

## 2.1 Where a plate comes from

**Phil-approved concept replacement, 3 Oct 2026:** Phil directly requested remakes of Fritz, Rhukk, Oakmir, Grosk, Umbris, Vael, Gruel, KonWu and King Bloatus, then said "replace the old concepts in the folder". Their canonical `PHILS GAME CONCEPTS/<Name> - static.png` and hero-folder static mirrors now use the reviewed remakes. Old originals were backed up as a complete batch before replacement; no animation assets changed. For this set: FRONT three-quarter IMAGE-RIGHT; extensive empty chroma room beyond the entire figure and weapon, not merely a tight full-body crop. Bloatus has a closed, clean mouth with NO gas or mouth emission (Phil: it "messed up his animations before"). Umbris must be FLYING, not planted. KonWu's latest staff is upright beside his body with a visible closed grip, not crossing through the hand or behind his hips. These are concept requirements, not evidence that future animations have passed. Rhukk/Umbris use green to contrast their palette/future effects; the others use magenta.

`PHILS GAME CONCEPTS/<Name> - static.png`, read from Phil's machine, not a
session mirror. Resize to 768×768 and upload. No crop, no scrub, nothing else.

### ⛔ `PHILS GAME CONCEPTS/` IS THE ONLY FOLDER A STATIC IS EVER TAKEN FROM. 12 Sep 2026.
**Phil, in his own words:** *"The only generated art, is always from my concept folder"* ·
***"Phil game Concepts folder — this is the only folder to grab statics for animations"***.

**ONE FOLDER. NO SECOND SOURCE. NO EXCEPTIONS.** Every plate fed to Hailuo, for every hero, every
boss, every monster and every summon, is built from
`PHILS GAME CONCEPTS/<Name> - static.png` — or `PHILS GAME CONCEPTS/Summons/<Name> - static.png`
for a summon. **That path is the only legal input to a plate.**

**EVERY ONE OF THESE IS FORBIDDEN AS A SOURCE, even when the bytes look identical:**

| not a source | why it exists, and why it is still not a source |
|---|---|
| `Game Art/Heroes/<Name>/<Name> - static.png` | a mirror. It can be, and has been, a generation behind the concept folder |
| `Game Art/Heroes/<Name>/<Name> - hero card.png` | card art — different crop, different framing |
| `Game Art/Heroes/<Name>/<Name> - side profile plate.png` | a redraw for one purpose, not the hero's static |
| `Base files/assets/...` | a build output. MASTER RULE 5: art flows one way and is never read back |
| `_to_delete/` anything | out of the project. ARCHIVE RULE 1.0c |
| `Outputs and Bin/Claude outputs/`, `Pipeline tools/plates/`, `Downloads/` | Claude's own derived files — a plate built from a plate |
| an image from a chat, a thread Library, or a screenshot | never entered the archive; nothing can verify it |

**"IT IS BYTE-IDENTICAL" IS NOT A DEFENCE.** On 12 Sep Nerisse's plate was built from
`Game Art/Heroes/Nerisse Bellglass/Nerisse Bellglass - static.png` — and the file recorded its own provenance
in its name, `(12 Sep, from 9Sep static)`. It happened to md5-match the concept folder that day, so
nothing broke, and **that is exactly what makes the habit dangerous**: the check that would catch a
stale mirror is the one the habit skips. Vex's mirror WAS a generation behind for most of a week
(§6.1a). **Read the concept folder every time and the question never arises.**

**READ `PHILS GAME CONCEPTS/READ ME.txt` BEFORE TAKING ANYTHING OUT OF IT.** It is three lines, it
sits in the folder, and it says what belongs there and what must never be done to it:
*"Byte-identical fallback copies: NEVER edit, crop, plate or replace. New one from Phil -> copy here
FIRST -> then Game Art/Heroes/<Name>/<Name> - static.png."* **A READ ME inside a folder you are about to take
source art from is part of the protocol for that folder.** On 12 Sep a full end-to-end read of this
document and the PROMPT BIBLE was completed and reported — and that READ ME had still never been
opened. Phil: *"Did you not read the protocol?"* · *"You need to read thoroughly"*.

**AND THE ORDER WHEN PHIL SENDS NEW ART:** it goes into `PHILS GAME CONCEPTS/` **first**, then is
copied out to `Game Art/Heroes/<Name>/`. The concept folder is upstream of the hero folder, never downstream.


A plate is his art SCALED and FRAMED, background UNTOUCHED. **Never key the figure out and
recomposite it onto a fresh flat colour** — that puts one green inside another, and Phil rejected it
on sight.

## 2.2 The framing standard, and why it is not tighter

**Figure ~443 px in the 768 plate (58% of frame height), feet on y≈605, centred x≈383.**
(Women's measured standard from Phil's own shipped plates: bbox height 598, top y=122, centre x=383.)

A tighter 70% plate was built for Umbris on the reasoning that it carries more DETAIL — and it does,
~240 px against ~200. **Phil rejected it:** *"use the left one"* / *"for more room for ability casting"*.

**The plate has to hold the whole ANIMATION, not just the pose.** Casts raise both arms; an overhead
throw puts the cocked elbow above the ear and sweeps down across the body; gathered FX drift around
the hands; a cloak snaps out behind. All of it must stay inside the frame, because a frame the figure
touches fails the edge gate and the clip is wasted.

So the 58% is headroom, spent on purpose. **Do not "improve" it for detail.** A 443 px figure caps
detail at about 200 px, which is why the roster measures 170–200 and not 400. **The ceiling is set by
the FRAMING, and the framing is set by what the animation needs** — raising detail is a question of
RESOLUTION at generation time, not framing at slice time.

**Above ~80% figure fraction it is a borderless frame, not a plate.** Check the fraction before every
upload. Kharos's whole first batch (9 clips, 135 credits) was generated from a 1254² borderless
static filed as if it were a plate — every clip cropped and drifted.

## 2.2b A STATE MAY GET ITS OWN TALLER PLATE WHEN THE ACTION LEAVES THE GROUND

**Phil, 11 Sep 2026, on Vex's green:** *"maybe best thing is increase the green portrait area so she
can jump in frame."* He is applying §2.2's own principle — *the plate has to hold the whole ANIMATION,
not just the pose* — to an action that travels VERTICALLY.

**The measurement that proves it.** Vex's square plate had her at **502 px in 768 = 65 % of frame
height, with 143 px above her head.** A jump of even half a body height does not fit. Her green v1
came back as a reach instead of a leap: **there was physically nowhere to go.**

**TWO WAYS TO BUY HEADROOM, AND THEY ARE NOT EQUAL:**

| | what it costs |
|---|---|
| shrink the figure inside the same 768² | headroom, but §2.2 caps detail by figure height — 502 px → ~345 px drops detail from ~200 px to ~150 px, **below the roster's 170–200 band** |
| **keep the figure, make the CANVAS taller** | **nothing.** Same pixels, same detail, same feet position — only more green above her |

**SO: TALLER CANVAS, NEVER A SMALLER FIGURE.** Vex green is `768 × 1024`, figure unchanged at 502 px,
feet at y=900 (the same 124 px below the feet as the square plate), headroom **143 → 398 px**, figure
fraction 49 %. Build it by lifting the figure's bbox off the existing plate and re-pasting it on a
taller canvas filled with **the plate's own sampled background green** — never a re-drawn or
re-generated figure.

**This is per-state, and the pipeline already supports it.** `BATTLE_ANIM` carries its own frame size
for every state (Vex's green was already 589×607 while her blue was 536×536); the slicer measures
whatever comes back. The other eight states keep the square plate.

**The one thing to watch:** that state's clip comes back in a different aspect to its siblings. It
slices fine, but check the state's `figH`/`feet`/`cx` after slicing rather than assuming the square
plate's numbers carried over.

## 2.3 Plate colour — pick it from the palette, not the habit

Measure the concept art on BOTH axes and use the plate furthest from the hero's palette:

    magenta-ness = min(R,B) − G      → a MAGENTA plate is safe when this stays low
    green-ness   = G − max(R,B)      → a GREEN plate is safe when this stays low

Whichever measure the art keeps below ~40 is the plate to use. Warm and green-leaning heroes
(foliage, poison, verdant anything) keep magenta. Violet, pink, red and magenta heroes get green. A
hero high on both needs a third colour, not a cleverer keyer.

**Measure the EFFECT too, not just the character.** Umbris's body is matte black and fine on magenta,
but his SPELL is violet flame: it measured 206 on the magenta axis against a standard that calls 144
a problem, and the keyer ate roughly a third of it — Phil: *"you cropped over 30% of the flames out"*.
Re-plated to green and the flame survived whole.

**What plate colour does NOT fix: the rim light.** Hailuo treats the plate as an *emitting* surface
and lights the figure off it — measured +117/255 brighter at the edge than the interior. That
illumination is painted onto the character, so a green plate gives a green rim instead of a magenta
one. It is easier to detect, but it is still art to remove. **The rim is a generation-time fix** —
the prompt says the backdrop is non-emissive and casts no light, bounce, colour bleed or glow. The
plate colour decides how cleanly the matte comes out; the prompt decides whether there is a rim at all.

**Switching colour means re-firing the hero's whole set**, because the colour is baked into every
clip already generated. Decide BEFORE a hero's run, never during it.

**A hero's plate colour is whatever their concept static is** — the concept folder is the source of
truth, and the background lock in the prompt must name the colour the plate actually is.

## 2.4 THE PLATE POSE IS AN INSTRUCTION — read it before blaming a prompt

*Umbris, 11 Sep. Ten clips and 250 credits went into rewriting text against a pose problem.*

His plate has him **FLYING** — feet off the ground, legs bent and trailing, body pitched forward,
shroud streaming horizontally. Hailuo read the subject as a figure in flight and animated flight.
That one fact explained every failure:

- Same plate in both slots: it animates flight that must return to the start, so he hovers and the
  cape streams. Phil called those *"an excellent idle/ walk"* — because a hover IS a good idle.
- End frame emptied: nothing requires him back, so he drifts out of frame entirely and the last ten
  frames are empty.
- **The cast is always dropped because you cannot plant and gesture from a flight pose.** There is no
  ground contact to brace against, so the model drops the gesture and spends six seconds on cloth.
  Every prompt said "feet planted" — meaningless for a figure whose feet touch nothing.

**THE GENERAL LESSON: before blaming a prompt for a missing action, LOOK AT THE PLATE AND ASK WHAT
POSE IT IS IN.** A plate is not a neutral picture of a character, it is the first frame of the
animation, and it already implies what the body is doing. A hovering plate animates hovering.

The fix that worked is §2.5 — supply a DIFFERENT end plate showing the gesture already completed.

## 2.5 Seed plates — every spell FX clip

**⛔ CONTESTED SINCE 15 Sep 2026 — READ THIS BEFORE DRAWING A SEED.** Grok records that **Phil
approved a different seed standard** for FX and set it as the bar for all future FX seeds: a square
**1024×1024** magenta plate carrying an **ornate finished icon** of the effect at about 40% of the
canvas with a ~30% clean margin — not the small dim mote below. It is written up in
`Cowork/04 - BRIEFINGS AND HANDOFFS/PHILS RULE FOR GROK.md`, which declares this section superseded.

**This protocol has NOT adopted it, and that is deliberate.** The approval reached Claude as a
**report from another builder, and a report is never an instruction** (`04 - PROMPT BIBLE` ch.8 · D4).
**A briefing cannot supersede a protocol** — that is the 12 Sep shape, where a true-sounding sentence
in one document quietly outranked the document that actually owned the rule. **Raised for Phil in
`Open Projects/11 - OPEN QUESTIONS FOR PHIL.md`. Until he rules, Grok follows his own file and anyone
firing from THIS section should know the two disagree.**

---

**Every ability / spell FX clip is fired from a SEED PLATE, never a plain plate.** A flat 768 plate
with a small dim seed of the effect's own colour drawn dead centre. A plain plate gives the model no
anchor and it composes to fill the canvas — that is what makes effects run off the edges and turn
into close-up texture. The seed gives it a position and a scale and it respects both. Proved 7 Sep:
all 141 frames clean, zero edge contact.

### ⛔ RULING, PHIL, 14 Sep 2026 — CHATGPT DRAWS ITS OWN SEEDS. THE TEST IS THE HERO, NOT PERMISSION.

**Phil, verbatim:** *"Chat you can generate your own seed since you have the tools to do so but it
must make sense for the character based off skill and lore"*.

**This supersedes "ask Phil how the effect begins" as a BLOCKER.** It is no longer a gate. **The gate
is now the hero's own kit text**, and it is stricter than asking, because it has a right answer that
can be checked:

- **Read the ability's actual behaviour before drawing.** `05 - HERO ENCYCLOPEDIA` §2.x for the
  hero, and `Game Art/Heroes/_design packs/` for Phil's own wording. **The skill text says what the effect
  DOES, and a seed that contradicts it is wrong no matter how good it looks.**
- **⛔ NEVER INVENT THE LORE TO JUSTIFY THE SEED.** That is MASTER RULE 7 and the §2.4 trap in
  reverse — drawing first and reasoning backwards produces a description nobody wrote.
- **Where the seed sits still follows §8.2:** small, dim, dead centre, in the effect's own dominant
  colour, on a flat plate.
- **When the kit text genuinely does not say how the effect begins, ASK — it is one line.** The
  ruling removes the default block, not RULE 7.

**The seed is the effect's STARTING POINT, not its finished shape.** A ring seed for Bone Chant came
back as a neon rune circle — Phil: *"the seed plate is making it too much like a ritual"*. When an
effect has a birth (a fire that spreads, a snake of embers), the seed is only the spark where it
starts and the prompt carries the motion. **Ask Phil how the effect BEGINS before drawing any seed.**

## 2.6 A weapon longer than half the frame

A ~560 px lance cannot fully extend inside 768 px from a centred figure — the head left the frame on
every take regardless of wording. Fix: a **16:9 plate, 1366×768** (a native 768p output size, so no
crop), the art at the SAME size and pose, pasted at an x-offset so the hero sits in the right third
with the room on the side they strike toward. Background is the plate's own colour — no keying, no
recomposite. Plus the reach lock: grips the weapon at its middle, the rear half stays behind the hip,
the head travels one body-width, the whole weapon stays inside the frame every frame. The slicer
anchors on the body bbox, so cell and game anchors are unaffected.

---

# 3 · SLICING  *(was §5)*

## THE CUT — the settings, as they stand

**These are the operative values. The failures that bought each one are in `03.1` under the same
number — read them before changing any of these (RULE 22).**

| setting | value | why, in one line |
|---|---|---|
| the tool | **`Pipeline tools/cs10.py`** — the only `cs10.py` in the archive that is not a `.bak` | the second copy silently ignored `DESPILL_ALL` · 03.1 §3.0 |
| `PAD` | **60** | the default 6 over-crops every cell · 03.1 §3.2 |
| chroma | pass the plate's own key, e.g. **`13,164,65`** for our green plates | the built-in default is not our green · 03.1 §3.0 |
| trim | **`trim_head=0, trim_tail=0` for a HERO** | the module default 2/6 cuts the loop off — a same-plate clip read as a 2.08x seam and cut 0/0 reads 0.32x. **The trim is for FX clips, not heroes.** · 03.1 §3.1a |
| despill | `DESPILL_ALL=1` where the hero's palette allows it | verified per hero, never assumed · 03.1 §3.4c |
| edge | `ALPHA_SOFT=1 ALPHA_FLOOR=4` when the matte reads binary | 03.1 §3.4o |
| small props | `PROP_NEAR_MIN` / `PROP_MIN` when the speck filter eats detail | it was deleting a sceptre · 03.1 §3.4q |
| encode | `SHEET_LOSSLESS=1` | a second lossy encode is the quality loss Phil sees (RULE 21) |

**The CLI cannot pass the trim — call the module:**

```python
import sys; sys.path.insert(0, "Pipeline tools"); import cs10
cs10.set_chroma("<r,g,b>")
meta, kb = cs10.run(clip, key, state, outdir, 48, 24.0, trim_head=0, trim_tail=0)
```

**Then gate it:**

```
python3 "Operating procedure/tools/keycheck.py" <sheet.webp> "<r,g,b>"   # exit 1 if any px leans
```

**A 2.08x loop seam is a reason to check the TRIM, not to reach for `pingpong`** (03.1 §3.1a, §9.8).


### HOW TO SEND IT — the shape that was used, so it is repeatable
1. **Export every frame as a PNG at the sheet's own cell size, RGBA, alpha intact.** Never flatten:
   the alpha is what lets them drop back into the sheet.
2. **Include the hero's PLATE in the zip**, named so it is obviously the reference —
   `00_REFERENCE_PLATE_phils_original_art.png`. **It is the artefact Claude did not write** (MASTER
   RULE 1.6) and it is the only authority on what is HER colour and what is contamination.
3. **ZIP IT.** Phil: *"Make sure to zip the frames"*. 49 separate uploads is not a thing a chat
   composer does, and `file_upload` caps at 10 MB per call — the Nerisse zip was 9.78 MB, which is
   the practical ceiling for one state at this cell size.
4. **Carry the MEASUREMENT, not an adjective.** The hair excess per brightness level against his
   plate went in the message. *"There is green"* is not a brief.
5. **Carry WHAT HAS ALREADY BEEN TRIED AND WHY EACH FAILED** — all five, in one line each. Otherwise
   the thread spends its first turn re-deriving the dead ends this protocol already paid for.
6. **Carry Phil's constraints in HIS words:** do not redraw, restyle, or change costume, proportions,
   pose or palette; keep the alpha and the exact cell size; **keep all frames consistent with each
   other or the animation strobes**; and do not strip her own colour — the plate says what is hers.
7. **Composer mechanics (09 GOTCHAS):** `execCommand insertText` into `#prompt-textarea`, **ONE BLOCK
   WITH NO NEWLINES** — a newline SENDS on that composer and the message goes out in fragments.
8. **VERIFY AFTER SENDING, never trust the click:** composer length back to 0, the user-message count
   up by one, and the posted message containing a distinctive phrase from the text.

**STATUS: UNDER TEST ON NERISSE'S IDLE ONLY. Do not route another hero through this until Phil rules
on the result** — his words are *"First we test with this idle"*, and the five finished females
follow only *"if it works"*.



## 3.1 The command

```
python3 "Pipeline tools/cs10.py" <clip.mp4> <key> <state> <outdir> [n] [fps] "<r,g,b>"

  <r,g,b> is REQUIRED - the CLI **and `cs10.run()`** both exit 2 without it (17 Sep 2026, §3.4r)

  env: NO_SPILL=1      keep frames whose FX touch the frame edge (boss smoke, big novas)
       REF_FRAME=last  measure the END pose — rise clips, where frame 0 is underground
       PAD=<px>        cell margin around the union bbox (default 6 is TOO TIGHT — use ~60)
       CELL_CAP=<px>   explicit opt-in downscale ONLY (see 5.5)

  prints: META {"n","fw","fh","cols","rows","figH","feet","cx","top","detailPx",…}
```

`<r,g,b>` is the chroma the clip was shot on: `13,164,65` for our green plates, `249,1,245` for
Phil's magenta clips, or the per-monster key from `plates_mon/keys.json`. **It is NOT optional and it
was never safe to omit** — until 17 Sep 2026 the CLI accepted six arguments and silently kept the
module default GREEN, which is how 34 magenta FX sheets were cut unkeyed (§3.4r). **Measure it off
frame 0 of the clip; never assume it from the hero or the folder.**

**The cut is NATIVE.** There is no size env var on the standard path. `ds = 1.0` is the default and
the `FIG_TARGET` knob is **deleted** — it existed for about four hours on 10 Sep and a target height
is the whole bug. Never reintroduce it under any name.

## 3.2 `PAD` is a knob and 6 is too tight

Phil: *"still overly cropped"*. At `pad=6` a cell was cropped to the union bbox with 7 px under the
feet, figure at 92% of the cell against ~78% on the hero's other sheets. **Margin is not waste** — a
raised effect, a billowing shroud or a later frame needs somewhere to go, and a cell the art touches
fails the edge gate. `figH` normalises the render either way, so a roomier cell draws the character
at exactly the same size. **60 was right on Umbris.**

## 3.3 Frame counts and holds

idle / walk / green / blue / passive 36 @ 15 fps · attack 24 @ 16 · hit 20 @ 16 · ult 48 @ 15.
Loop states use the first ~0.5 s ping-ponged (Hailuo drifts late in the clip); one-shots keep the
clip but trim the tail.

## 3.4 Keying and despill

### 3.4a THE KEY IS CHOSEN FROM THE CHARACTER'S PALETTE — AND SO IS THE DESPILL. 12 Sep 2026.
Maren lost body to a GREEN key because he wears sea-green. **Vex lost her COSTUME COLOUR to a MAGENTA
key because she wears dark red** — red is the nearest large family to magenta, so the despill
subtracted red and added green and turned an oxblood corset olive (measured: torso green 32.5 raw ->
51.6 after slicing).

**The rule was already written for the KEY. It now covers the DESPILL as well**, because the bug was
not the key at all — `_fringe()` marked EVERY opaque pixel with `lean > 8`, with **no distance
guard**, so any costume leaning along the key axis was "de-spilled" as if it were screen bleed.
`_spill_mask()` had guarded itself with `d < 120` since the Maren fix; `_fringe()` never did.

**FIXED 12 Sep in `Pipeline tools/cs10.py`:** a pixel is despilled only if it is a partial-alpha EDGE pixel
(`al < 0.98`) **or** genuinely close to the key (`d < DESPILL_MAXD`, default 150). Vex's corset sits
**296** from magenta and is now untouched; a magenta-tinted translucent tendril is close to the key
and is still cleaned.

**BEFORE A HERO IS FIRED, pick the key by measurement — the farthest colour from HER OWN palette —
and write it into her tracker row.** A red/warm character keys on GREEN. Vex's true set is green
`(4,247,6)`; the magenta set was the wrong key and is superseded.

### 3.4b ONE APPROVED BATCH SHARES A KEY AND A `figH`. USE THAT AS A SOURCE CHECK.
Every clip generated in one approved batch comes back with the same screen colour and the same figure
height. **A mixed key or a mixed `figH` across a hero's states means the clips came from DIFFERENT
BATCHES — stop and confirm which set is current before cutting.**

Worked example: Vex's true set is green `(4,247,6)` with `figH 500` on all nine. The stale
5-September set was magenta `(249,1,245)` with `figH 461`. **That two-line check would have caught
three wrong cuts in seconds** (`GOTCHAS/09 - GOTCHAS - running log of problems and fixes.md` 12 Sep §8, MASTER RULE 5).


- **The chroma key must be the colour FURTHEST from the character's palette** (§2.3). A character
  wearing the key's hue loses body chunks.
- **`cs10`'s despill is tuned for MAGENTA and under-cleans a green key.** Straight out of the slicer
  on Umbris: **36.8%** of semi-transparent edge pixels and **2.18%** of solid pixels leaned green,
  max 116. Three mechanical passes fix it: clamp G to each pixel's own max(R,B); fade alpha on
  semi-transparent pixels in proportion to how green they were (those were mostly backdrop); drop
  pixels that are near-black only because they were pure key. Result 0% and 0%, with violet flame
  pixels UP 2% — **the despill removes spill, not effect.**
- **The magenta test that eats violet heroes.** `(r>140)&(b>140)&(g<130)` plus a 3-iteration dilation
  punched transparent diamonds through Sylthaine, because her mid-violet face shading (144,122,159)
  matched it. The safe test: `(r>200)&(b>200)&(g<60)&((r-g)>140)&((b-g)>140)`.
- An "interior hole" counter will report thousands of px on a hero with flowing hair — those are the
  legitimate gaps between strands, not damage. Verify visually before "fixing" holes.
- **Feather FX alpha over the outer 12–14% of each cell**, or a full-frame effect renders as a hard
  white square.

### 3.4r ⛔ THE KEY CAN SURVIVE THE SLICE, AND **EVERY GATE IN THE ARCHIVE PASSES IT**. 17 Sep 2026, 0700 heartbeat.

**16 consecutive FX sheets were filed with the magenta chroma background still in them, all 16
PASSED `fxcheck.py`, and the run that caught it caught it by accident** — it was measuring file
sizes, not keys.

| | the 66 sheets filed before 17 Sep 04:50 | the 16 filed from 04:50 on |
|---|---|---|
| chroma left in the opaque pixels | **0.0 – 2.8%** (the 2.8% is Greatbrow, a green hero) | **57.0 – 99.3%** |
| clear pixels (alpha 0) in a cell | 41 – 68% | **2.45 – 2.52%** |
| bytes per pixel | 0.13 mean | 0.28 mean |
| file size | 1.78 MB mean, max 7.69 | **12.03 MB mean, max 22.58** |

**Nothing lands between 2.8% and 57%.** It is a clean break at one moment, not a drift — and the
moment is the same one §5.11a records for the `(sprite sheet)` filename suffix. **That hour changed
the names AND the bytes; 0600 fixed the names and never looked at the bytes.** MASTER RULE 1's
standing warning — *judge a file by its CONTENTS, never its NAME* — was obeyed about the ruler and
skipped about the art.

### WHY EVERY EXISTING GATE WAVES IT THROUGH

**An unkeyed cell is opaque where it should be clear, and opacity is what the gates look for.**

| check | what it wants | what an unkeyed sheet gives it |
|---|---|---|
| grid unique | a 6×8 that scores clean on the cell border | resolves perfectly |
| no blank cell | every cell carries paint | every cell is **full** of paint |
| 3 px border empty | no paint in the border | clean — the slicer's `PAD` margin is still transparent |
| `upExtent` | largest painted bbox / cell | **0.988 — it is measuring the magenta rectangle** |

So the sheet reports as the best-formed sheet in the archive. **And `keycheck.py`, the zero-background
gate, is barred from FX plates by §5.10.** There was therefore **no key check on an FX sheet
anywhere in the pipeline.** Not a rule that was skipped — a rule that did not exist.

**The `upExtent` consequence is separate and outlives the key.** `S = targetH × upSize / upExtent`,
so a `0.988` read off the background renders the real effect — which fills perhaps 40% of that cell —
**at roughly half the size it should be**, even after the sheet is re-cut. Re-measure `upExtent`
after the re-slice; never carry the number forward (§5.6 step 3).

### THE GATE — `fxcheck.py --key`, AND IT IS FOLDED INTO THE DEFAULT CHECK

```
python3 "Operating procedure/tools/fxcheck.py" --key        # every GROK SPELL ART sheet
```

Percent of the **opaque** pixels that are chroma-dominant, over four sampled cells, against the two
keys §3.1 names — magenta `249,1,245` and green `13,164,65`. **The bar (15%) sits in the empty gap
between the two clusters above, and the span is printed, never just a verdict** — the discipline
`loopcheck.py` was built on, and the reason two rulers were withdrawn on 16 Sep. Validated the only
way that counts (MASTER RULE 16): **run on all 82, it flags exactly the 16 and not one of the 66
approved sheets.** A plain `fxcheck <sheet>` now FAILS an unkeyed sheet too, because a sheet that
reports PASS is a sheet somebody wires.

### WHAT THE FIX IS, AND WHAT IT IS NOT

**The clips are fine. The SLICE dropped the key.** So this is a re-slice with the chroma passed in
(§3.1) — **not a re-generation, and not a credit.** And it is **never** a repaint of the finished
`.webp`: a second encode is the quality loss Phil sees (ART RULE 21), and correcting alpha by hand on
a delivered sheet is drawing (ART RULE 6).

**The byte size is a SYMPTOM here, not a second defect.** An opaque magenta field compresses far
worse than transparency, which is the whole of the 1.78 → 12.03 MB jump. It has its own consequence
while it lasts — 9 of the 16 are over the 10 MB commit cap and have no route onto live at all
(`08 - SHIPPING` ch.9 glossary; gate: `fxcheck.py --ship`) — but re-slicing with the key is expected
to take most of it back. **Re-measure after the re-slice before treating the cap as a real problem.**


### ⛔ UPDATE — 17 Sep 2026, 0800 heartbeat. **THE CAUSE IS NAMED AND REPRODUCED: `cs10.py`'s 7th POSITIONAL ARGUMENT — THE CHROMA — WAS OMITTED.**

The 0700 note above says *"the SLICE dropped the key"* and left it there. **It is one argument, and it
is now proven rather than inferred.** The count also moved: **22 sheets, not 16** — Korvux ×4 and
Lysara Moonveil ×2 were filed between 07:28 and 08:07 and measure 84.4–95.8%.

**THE ARTEFACT SAID IT BEFORE THE REPRODUCTION DID.** Three measurements, all off the delivered files:

| | the 66 good sheets | all 22 unkeyed sheets |
|---|---|---|
| sheet dimensions | **66 distinct sizes** — a native cut, bbox per clip | **5832 × 7776 on every one**, across 7 different heroes |
| cell | native, e.g. Ironcoil's good cut at 706 × 750 | **972 × 972 — which is 960 + 2×6** |
| clear pixels per cell | 41 – 68% | **2.45 – 2.52% — exactly the 6 px `PAD` ring and nothing else** |

**960 is the clip. 6 is `PAD`'s default (§3.2). 2.45% is that ring's exact area.** A union bbox equal
to the WHOLE FRAME is what you get when the keyer removed nothing, and the surviving background
measures **3.3 RGB units from magenta `249,1,245` and 340 from green `13,164,65`** — so the cut was
keyed against green while the clip was shot on magenta, and `cs10.py`'s module default is
`CHROMA = GREEN` (§3.1: *"the built-in default is not our green"* — here it is not our magenta either).

```python
# Pipeline tools/cs10.py, the CLI tail — the whole of the defect:
if len(a) > 7: set_chroma(a[7])      # omit the 7th arg and CHROMA stays GREEN
pad = int(os.environ.get("PAD", "6"))  # omit PAD and the cell is the frame + 12
```

**REPRODUCED ON ONE CLIP, TWO RUNS, SAME TOOL** — `Korvux - Comet Dash.mp4`, the source of one of the
22. Frames in `Cowork/07 - ANIMATION REVIEW/17SEP2026-0800-cs10-chroma-argument-proof.png`:

| run | the call | result |
|---|---|---|
| **A** | `cs10.py <clip> korvux comet_dash <out> 48 24.0` | **5832 × 7776**, cell 972 × 972, 2.5% clear, **93.2% of opaque px are key colour** |
| **B** | `PAD=60 SHEET_LOSSLESS=1 cs10.py … 48 24.0 "249,1,245"` | 3024 × 4064, cell 504 × 508, **80.6% clear, 0.0% key colour** |

**Run A reproduces the filed sheet's geometry exactly** (Grok's own Comet Dash is 5832 × 7776 and
measures 95.8%). The clip is untouched between the two runs. **So: not the generator, not the clip,
not Grok Imagine, not a credit — the seventh argument.**

**THE ONE-LINE FIX, and it is the command in §3.1 with nothing added:**

```
python3 "Pipeline tools/cs10.py" "<clip.mp4>" <herokey> <state> "<outdir>" 48 24.0 "249,1,245"
  env: PAD=60 SHEET_LOSSLESS=1
```

**A SHEET WHOSE CELL IS THE WHOLE SOURCE FRAME HAS NOT BEEN KEYED.** That is the cheapest possible
tell and it needs no colour maths: `cs10.py` now prints a loud `[⛔ NO-KEY]` line when the computed
`CROP_BOX` equals the full frame, at the moment of the cut, because `fxcheck --key` only catches it
after 22 sheets have been filed (MASTER RULE 14 — move the rule to where the work happens).

**Two cautions carried forward.** The `(sprite sheet)` filename suffix happens to mark all 22 exactly,
and it must **never** become the test — judge a file by its contents (MASTER RULE 1's standing
warning, and §5.11a). And **re-measure `upExtent` after the re-cut**: run B's effect fills its cell
completely differently from run A's magenta rectangle.

### ⛔ UPDATE — 17 Sep 2026, 0900 heartbeat. **IT IS A REGRESSION, NOT A GAP — HE WAS CUTTING FX CORRECTLY UNTIL 16 SEP 18:44. AND THE FILENAME SUFFIX IS NOW MEASURED TO BE A LIAR.**

Two things the 0800 note could not know, both measured off the delivered files this hour. The count
moved again: **28 sheets, not 23** — Lysara Moonveil's fourth at 08:26 and **Meridian ×4 between 08:35
and 09:01**, the last of them filed nine minutes before this measurement.

**1 · THE BREAK HAS A BRACKET, AND IT SITS INSIDE ONE HERO'S OWN FOLDER.**
`Game Art/Heroes/Ironcoil/GROK SPELL ART/sprite sheets/` holds all four of his FX sheets and the break runs
through the middle of them:

| sheet | filed | size | clear px | verdict |
|---|---|---|---|---|
| `Ironcoil - Scale Ram.webp` | 16 Sep 18:02 | 1812 × 2176 | **48.4%** | clean, native cut |
| `Ironcoil - Fortress Curl.webp` | 16 Sep 18:21 | 2880 × 4032 | **56.1%** | clean, native cut |
| `Ironcoil - Avalanche Coil.webp` | 16 Sep 18:44 | 4236 × 6000 | **36.3%** | clean, native cut |
| `Ironcoil - Layered Hide (sprite sheet).webp` | **17 Sep 04:50** | **5832 × 7776** | **2.45%** | **unkeyed** |

**Their clips are the same kind of clip.** Measured frame 0 of both: `Ironcoil - Avalanche Coil.mp4`
and `Ironcoil - Layered Hide.mp4` both sit on **RGB (254, 0, 253) at 960 × 960 — 9.5 units from
magenta and 347 from green.** So the source did not change, the generator did not change, and the
hero did not change. **What changed is the call**, somewhere between **16 Sep 18:44 and 17 Sep 04:50**.

**That makes the ask cheaper than 0800 stated it.** It is not "learn the argument" — it is **"put back
the call you were making yesterday evening."** He had it right for at least three consecutive sheets.

**And it is not his machine or his environment**, because the OTHER route never stopped working:
`Game Art/Heroes/Nerisse Bellglass/GROK ANIMATION ART/` took **eight clean sheets straight through the window**
(00:39 to 04:32, 45.9–75.1% clear, eight distinct native sizes). Whatever moved, moved in the FX call
alone. *(Why green survived and magenta did not is an INFERENCE, not a measurement: the module default
is GREEN (§3.1), his animation clips read (1, 248, 3), and a dropped 7th argument therefore lands near
enough on an animation clip and 347 units away on an FX clip.)*

**2 · ⛔ THE `(sprite sheet)` SUFFIX IS NOT A TEST, AND NOW THERE IS A NUMBER ON IT.**
The 0800 note warned it *"happens to mark all 22 exactly, and it must never become the test."* It is
worse than coincidental — **measured across all 102 Grok sheets, it is wrong 8 times:**

| | carries `(sprite sheet)` | does not |
|---|---|---|
| **28 unkeyed** | **28** | 0 |
| **74 clean** | **8** | 66 |

**All 8 false positives are Nerisse Bellglass's animation sheets** — her idle, walk, attack, hit and
four abilities, the best-measuring sheets in the batch. **A filter on that suffix would have condemned
every one of them.** He renamed his output at ~00:39 on BOTH routes; the chroma broke on ONE. The
suffix tracks the rename, not the defect. **The test is the CONTENTS: a cell equal to the source frame,
or clear pixels near 2.45%.** (MASTER RULE 1's standing warning — judge a file by its contents, never
its name — which has now cost three days running.)

**3 · NOTHING IS LOST AND NOTHING IS AT RISK.** All **28 source clips are present** in their heroes'
`GROK SPELL ART/clips/` — checked one by one, 28 of 28. **No credit has to be spent and no clip
re-fired.** No clean sheet was overwritten: every unkeyed file is a new name at a new path, and
`Game Art/Heroes/<hero>/sprite sheets/` and `Game Art/Spell FX/` are untouched. **Nothing unkeyed has been wired, and
nothing that has shipped is affected.**


### ⛔ UPDATE — 17 Sep 2026, 1000 heartbeat. **THE BUILDER DID NOT DROP THE ARGUMENT. THIS DOCUMENT DID, AND `GOTCHAS/09 - GOTCHAS - running log of problems and fixes.md` DID, AND BOTH SAID "ALWAYS PASS IT" WHILE DOING IT.**

**Count first: 34 unkeyed, not 28.** Nox Quillfinger ×4 (09:15–09:36) and Oakmir ×2 (09:58, **10:07**
— filed one minute before the measurement). Ten heroes. All 108 Grok sheets re-measured this hour:
`tools/keyaudit.py`.

**AND THE CAUSE WAS SITTING IN §1.7 THE WHOLE TIME.** The 0800 note reproduced the defect as
*"the 7th positional argument was omitted"* and the 0900 note read the 16 Sep 18:44 → 17 Sep 04:50
bracket as *"he had the call right and lost it — put back last night's call."* **Both blamed the
builder. Grep says otherwise.** Two documents in the live set carried a copy-paste command with the
chroma missing:

| where | the command it printed | written for |
|---|---|---|
| **`03 - ART` §1.7**, under ***"ALWAYS PASS IT. It is `argv[6]`"*** | `cs10.py <clip> <key> <state> <outdir> 48 24` | the **fps** default, 16 Sep |
| **`GOTCHAS/09 - GOTCHAS - running log of problems and fixes.md`**, under ***"THE FIX AT THE CALL SITE"*** | `cs10.py <clip> <key> <state> <outdir> 48 24` | the same fps default |

**That is run A of the 0800 reproduction, verbatim** — the call that produces 5832 × 7776, cell
972 × 972, 2.45% clear. §1.7 sits in **ch.1, "GROK IMAGINE — THE SOURCE OF ALL ART"**: the chapter
whose subject is exactly the work being done, added to on 16 Sep, inside the bracket. **A builder
obeying ART RULE 2 and MASTER RULE 6 — open this document every time, the documents are truth — cuts
an unkeyed sheet.** The rule was not skipped. It was followed.

**MASTER RULE 14 names this exactly: a rule that is being skipped is badly written — and this one was
worse, because it was being OBEYED.** MASTER RULE 19's test — *would a session that knows nothing
reach the same answer from the file alone?* — returned the defect.

### THE SHAPE OF IT, WHICH IS THE PART WORTH KEEPING
**A note written to make one argument mandatory showed a command SHORTER than the correct one.** The
sentence said `argv[6]`; the example was missing `argv[7]`. **The example is what gets copied.** When
you write "always pass X", paste the whole command and run it once before filing the note.

### THREE MITIGATIONS, AND ONLY THE THIRD IS A GATE
| | what it did | filed after it |
|---|---|---|
| 0700 · `fxcheck --key` | detects it **after** the sheet is filed | **+6** |
| 0800 · `[⛔ NO-KEY]` print at the cut | shouts, writes the sheet anyway | **+10** |
| **1000 · `cs10.py` exits 2 without the chroma** | **the bad call cannot be made** | — |

Two detectors bolted downstream of an optional argument, then the axis changed (MASTER RULE 21):
**the argument is not optional any more.** `if len(a) > 7: set_chroma(a[7])` → refuse, exit 2, with
the three keys and "measure frame 0" in the message. The `[NO-KEY]` condition now exits 3 as well,
with `ALLOW_NO_KEY=1` for a genuinely full-frame effect. **Verified on `Korvux - Comet Dash.mp4`, the
source of one of the 34:** the six-argument command now exits 2 and cuts nothing; the correct call
cuts `CROP_BOX 135,62,756,608` → **741 × 666, `fps: 24.0`, `detailPx: 142`, 5.3 MB**. Backup beside
it: `cs10.py.bak-17sep-prechromagate`. **Nothing in the archive called the CLI with fewer than eight
arguments** — `slice_hero.py`, `slice_boss.py` and `slice_boss2k.py` all pass the key, and
`import cs10` does not reach the CLI at all.

### `tools/keyaudit.py` — THE QUEUE, CACHED (MASTER RULE 24)
`projstat.py` stopped finishing in a 120 s shell at 0900 because the queue had grown to 594 MB of
`.webp` and it re-decoded all of it every hour. `keyaudit.py` caches each measurement against
(path, mtime, size) and re-decodes only what moved: **108 sheets in 4 s, 0 decodes, against a timeout.**
It reports `clear`, `keycol` and `fullframe` — **contents, never the filename.**

### STILL TRUE, AND STILL THE POINT
**34 of 34 source clips present. No credit spent, nothing re-fired, no clean sheet overwritten,
nothing wired, nothing shipped affected.** The fix is a re-cut with the seventh argument.


### ⛔ UPDATE — 17 Sep 2026, 1100 heartbeat. **THE GATE SHIPPED AT 10:11 AND SIX MORE SHEETS WERE CUT UNKEYED AFTER IT. IT WAS ONLY EVER ON THE CLI.**

**Count: 40, not 34 — and it moved twice while this hour was being written.** Oakmir First Spring
**10:26**, Oakmir Twin Fonts **10:41**, Stormwarden Volt Pike **10:49**, Stormwarden Thunder Guard
**11:07**, Stormwarden Skybreak **11:12**, Stormwarden Static Charge **11:24** — the last one a minute
before the final measurement. All six 5832 × 7776, 2.45–5.03% clear, 65.8–97.0% of opaque pixels on
the key. Eleven heroes, and **Stormwarden's entire kit is unkeyed.**

**THEY WERE CUT AFTER THE GATE, NOT FILED LATE — and the artefact settles it without asking anyone.**
Each clip and its sheet are written **in the same minute**:

| sheet | its `.mp4` | its `.webp` |
|---|---|---|
| Oakmir – First Spring | 10:26 | 10:26 |
| Oakmir – Twin Fonts | 10:41 | 10:41 |
| Stormwarden – Volt Pike | 10:49 | 10:49 |
| Stormwarden – Skybreak | 11:12 | 11:12 |
| Stormwarden – Thunder Guard | **11:07** | **11:07** |
| Stormwarden – Static Charge | **11:24** | **11:24** |

`Stormwarden - Thunder Guard.mp4` **did not exist** when the gate shipped. There is no version of
this in which the cut happened first.

### THE HOLE WAS A SENTENCE IN THE FIX ITSELF

The 1000 refusal was written inside `if __name__ == '__main__':`, and the comment above it gave the
reason not to go further: ***"`import cs10` does not come through here at all."*** **That is true, and
it is the description of the hole, not a reassurance.** `cs10.run()` took `CHROMA` from the module
default GREEN with no guard of any kind — and `§3.1`'s own **"call the module"** recipe, the one
route that can pass `trim_head`/`trim_tail`, goes straight past it.

**This is the 1000 finding again, one turn later: the note written to make the argument mandatory
contained the exemption.** At 1000 the example was shorter than the command; at 1100 the comment
named the uncovered route and moved on.

### THE FIX — THE REFUSAL MOVED TO THE CUT, WHICH IS WHAT BOTH ROUTES SHARE

`set_chroma()` now sets `CHROMA_EXPLICIT`; `run()` refuses at its first line unless a key was chosen
for **this** cut. `ALLOW_DEFAULT_CHROMA=1` is the deliberate opt-out. MASTER RULE 21 — the axis is
not *which entry point*, it is **the keyer never runs on a colour nobody chose**.

**VERIFIED FOUR WAYS on `Stormwarden - Volt Pike.mp4`, the source of one of the four** (frame 0 is
960 × 960 on RGB 247,0,255 — **10.2** units from magenta, **343.2** from green):

| | call | result |
|---|---|---|
| **A** | `cs10.run(...)`, no `set_chroma` — **the hole** | **exit 2, cuts nothing** |
| **B** | `set_chroma('249,1,245')` then `run(...)` | **4530 × 2960, cell 755 × 370, 91.20% clear, 0.00% key, 2.1 MB** |
| **C** | CLI, 7 args | exit 2 (unchanged) |
| **D** | CLI, 8 args | exit 0, `detailPx 33`, 2.0 MB |
| **E** | `ALLOW_DEFAULT_CHROMA=1` | proceeds, as designed |

Against the sheet filed at 10:49: **5832 × 7776, 2.45% clear, 97.01% key, 4.8 MB.** Backup beside it,
`cs10.py.bak-17sep-1100-premodulegate`.

### ⛔ AND THE ARCHIVE'S COPY IS NOT NECESSARILY THE COPY DOING THE CUTTING

**MASTER RULE 15 — two artefacts you produced agreeing is not evidence.** The 1000 verification ran
the archive's `cs10.py` in Claude's own container and passed. **The sheets kept coming.** And the
archive says why in its own batch tools: `slice_hero.py`, `slice_boss.py` and `slice_boss2k.py` all
invoke **`/root/emberweave/cs10.py`** — a path that is **not this file**. So there is at least one
other copy in the pipeline, and patching this one cannot be assumed to reach the cut.

**Which copy produced these six is NOT measured and is not asserted here.** What is measured: the
gate shipped, six sheets followed it, and the module route was open on this copy. **The re-cut is
Grok's lane and Phil's 16 Sep instruction is to leave him** (`CLAUDE WORKLOG/16SEP2026 2100-2200.md`),
so the ask sits in `Open Projects/11 - OPEN QUESTIONS FOR PHIL.md` and nothing has been posted to
`CLAUDE and GROK.md`.

**Still true: 40 of 40 source clips present, no credit spent, nothing re-fired, no clean sheet
overwritten, nothing unkeyed wired, nothing shipped affected.**

---

### ⛔ UPDATE — 17 Sep 2026, 1200 heartbeat. **THE MODULE GATE SHIPPED AT 11:15 AND THREE MORE FOLLOWED IT. THE ARCHIVE'S COPY IS NOW MEASURED OUT OF THE PATH — STOP PATCHING IT.**

**Queue 43 of 118 sheets, twelve heroes.** New since the 1100 gate, all Sylthaine, all cut **after**
`Pipeline tools/cs10.py` was gated on both routes at **11:15**:

| sheet | cut | clear | key |
|---|---|---|---|
| Sylthaine – Frozen Orb | **11:40** | 2.45% | **95.83%** |
| Sylthaine – Glacial Prison | **11:55** | 2.48% | **72.81%** |
| Sylthaine – Blizzard | **12:07** | 2.45% | **83.82%** |

Each clip and its sheet are written in the same minute, and Grok's own chatlog times them at 07:40,
07:55 and 08:06 ET — **25, 40 and 52 minutes after the gate.** All three carry the signature this
section has measured eleven times: 5832 × 7776, cell 972 × 972, 2.45% clear — a union bbox equal to
the whole frame, which is what a keyer that removed nothing returns.

### THIS IS NO LONGER "NOT NECESSARILY". IT IS MEASURED.

The 1100 note said the archive's copy *"is not necessarily the copy doing the cutting."* **Three
sheets later it can be stated as a measurement, and the measurement is a subtraction:**

- `Pipeline tools/cs10.py` has md5 `e8a606f30cf0b9d2c99ed825a80b7069`, mtime **11:15:08**, unmoved at
  12:11. The refusal is in `run()`, which **both** entry points pass through.
- **This file cannot produce that geometry any more.** CLI without the 7th argument: exit 2.
  `import cs10` → `run()` without `set_chroma()`: exit 2. There is exactly one way past it —
  `ALLOW_DEFAULT_CHROMA=1` — and **`grep -rl` finds that name nowhere in the archive except inside
  `cs10.py` itself and the write-ups about it.** No caller sets it.
- Therefore **the cut that produced those three sheets did not run this file.** Not an inference about
  Grok; an arithmetic fact about a gated tool and an ungated artefact.

**And it is not running in the Cowork VM either:** `Pipeline tools/cs10.py` raises
`ModuleNotFoundError: scipy` at import on the device, every session (`01 - LANES` §2 — the missing
`scipy` is why every slice this month ran in Claude's container).

### MASTER RULE 21 — WHAT THE THREE MITIGATIONS HAD IN COMMON

RULE 21 says that before the third attempt you write down what the first two shared. Three have now
been shipped and each was followed by more unkeyed sheets:

| | shipped | sheets cut unkeyed after it |
|---|---|---|
| the documents (§1.7, `GOTCHAS/09 - GOTCHAS - running log of problems and fixes.md` line 146) | 10:1x | 9 |
| the CLI refusal | 10:11 | 9 |
| the `run()` refusal — both routes on this copy | 11:15 | **3** |

**All three assume the slicer Grok runs is a file in this archive. Nothing has ever measured that,
and the subtraction above says it is not.** The axis is not *which entry point* and never was — it is
**whose copy**, and that copy is not reachable from here. **A fourth patch to `cs10.py` is the same
attempt in new wording, and this note exists to stop the next hour from writing one.**

### WHAT IS ACTUALLY LEFT, AND IT IS TWO THINGS

1. **One line from Phil to Grok.** The re-cut is Grok's lane (`01 - LANES` §2) and Phil's 16 Sep
   instruction is to leave him. This is the only lever that reaches the cut. It has been in
   `Open Projects/11` since 07:00.
2. **The artefact gate, which is already holding.** `fxcheck.py --key` fails an unkeyed sheet, so
   none can be wired — and that is now verified against the game rather than asserted: **all 43
   hashed against the 241 assets in `Base files/assets/anim/fx/`, zero matches.** Nothing unkeyed is
   in Emberweave. **The whole cost is a re-cut backlog, growing about four sheets an hour; it is not
   a live defect and it never has been.**

**Still true: 43 of 43 source clips present, no credit spent, nothing re-fired, no clean sheet
overwritten, nothing unkeyed wired, nothing shipped affected.**

---

## 3.5 `CELL_CAP` — the one legitimate downscale

Capping the cell DOWNSCALES the cut. It cannot add detail, only throw it away, and the renderer
already normalises by whatever `figH` the slicer measures — so a truthful native `figH` draws at
exactly the right size whatever the number is.

It is correct in exactly these cases, all explicit:
- **RULE 3**, bringing a hero's better states DOWN to their weakest state's number.
- **2K boss sources** — `slice_boss2k.py` caps at 900 so a 1440² source is not a multi-megabyte sheet.
- **Oversized FX cells** that would blow the byte budget.

Any value that actually shrinks a cut prints a loud `[SCALE]` warning naming the factor. That warning
is expected in these three cases and must be reported to Phil with the factor. **Never use it to make
a hero's `figH` land on a round number.**

## 3.6 `ax` — the per-frame anchor

`cx` pins the character where the clip STARTS; Hailuo clips drift (Lumi's walk 57 px). `cs10` emits
`ax`, the per-frame offset of the anchor landmark relative to frame 0, and the engine adds it.

- **Track a fixed body part** (the belt brooch via `belt_anchor.py` template match), **never the foot
  centre** — a foot track cancels the stride.
- **The smoothing window is ONE FULL GAIT CYCLE, not n/3.** The n/3 formula was right for 48-frame
  clips containing three cycles. On a clip cut down to a single cycle (Ironcoil, 38 frames = one
  period) n/3 is a THIRD of a cycle and leaves 51.8 px of sawtooth in place — which would drag him
  56 px sideways and snap back at the loop. Determine the gait period first; if the clip is one
  cycle, the window is n.
- **Pad circularly, not by reflection.** A walk cycle is periodic; reflection breaks the seam.
- **A ground-level tail poisons the foot measurement.** `cx` is the horizontal centre of the lowest
  6% of body rows; a tail, a floor-length robe, a dragging chain or a pooling cloak sits in that band
  and becomes the "foot centre". Anchor to the torso column first.

## 3.7 Verify the FILE, not the array you computed

The Umbris despill was measured on the in-memory array and reported done — then the preview was
rendered from the OLD path. Phil, looking at a frame of the problem already fixed: *"still alot of
bright green"*. **Reload the artefact and measure THAT, and build every preview from the same path
that will ship.**

---

# 4 · MEASURING  *(was §6)*

## THE RULERS — what to run, and what each one refuses

**Every one of these was built after a wrong number reached Phil. The stories are in `03.1`.**

| tool | run it for | it refuses |
|---|---|---|
| `tools/measure.py sharp \| compare` | **the only sanctioned sharpness/detail comparison** | mismatched image sizes, unequal mask pixel counts, a missing `--control`, a mask under 500 px — and it prints INSIDE NOISE under 2% · 03.1 §4.4c |
| `tools/keycheck.py` | the zero-background gate on a finished sheet | any pixel leaning toward the key, in any alpha band · 03.1 §3.4d |
| `tools/greencheck.py` | is this colour in PHIL'S drawing? | measures the cut against his own plate, not against itself · 03.1 §3.4j |

```
python3 tools/measure.py compare <A> <B> --control <an APPROVED file>
```

**The asking test before any number goes to Phil: what did I measure this against, and are both sides
scored on the same pixels?** If either half is missing there is no finding yet — only an artefact of
the instrument (MASTER RULE 15, 03.1 §4.4c, §4.5).


## 4.1 What the numbers mean

| name | what it is |
|---|---|
| **detail px** | torso height — top of neck fabric to top of waistband — measured on frame 0. **THIS is the "400/500" number.** Printed by `cs10` as `[DETAIL]`, recorded as `detailPx`. |
| `figH` | the figure's bounding-box HEIGHT in that sheet's pixels. A MEASUREMENT. |
| `feet` | the figure's bounding-box BOTTOM, distance from the top of the frame. |
| `cx` | the figure's horizontal CENTROID, mass-weighted, not the bbox mid-point. |
| `top` | the head offset the engine reads as `u._headOff`. |

All four are taken from **that sheet's own frame 0**, so every state of a character shares one
ground line. Re-measure after any re-slice.

**The rule is enforced by the tool now, not by prose.** Phil: *"what can I do to make you stop using
figure height when I said 500px? you mess this up on every single hero."* The answer was nothing —
the rule lived in prose while the slicer had a knob that did the wrong thing by default. Vireo was
cut by scaling her body box to a round `figH:500`, a ×0.836 DOWNSCALE that threw away ~17% of the
pixels her clips carried. The knob is gone and the number Phil means is an OUTPUT.

## 4.2 The ceiling, and where it actually comes from

Vireo cut at native carries **270 px of torso detail**, identical in all eight states. Her figure is
596 px in a 768×768 clip, so 270 is all that framing can carry. **Cutting cannot raise it — only
rendering her larger can.** And the framing is 58% on purpose (§2.2), because the animation needs the
room. So the roster measures 170–270, not 400–500, and **if 500 px of torso is the real target it has
to be bought at GENERATION time, not slice time.** Raised with Phil; still open.

## 4.3 How a character's height is measured — trace through the body

> Height is measured from the true top of the head to the true bottom of the toe, **tracing through
> the body** — not as a direct path from head to toe.

**Why the bounding box is wrong.** Heroes bend their knees. A crouched hero is the same character at
the same size, but his box is shorter — so box height reads him as having shrunk, the renderer blows
the crouch up to match the stand, and the character visibly grows and shrinks as he changes pose.
That is the "why does Lumi grow in passive" bug, and it is caused by the MEASUREMENT, not the art.

`figure_height.py`: reduce the alpha mask to its largest connected component (so detached FX and
floating orbs are never mistaken for the body) → distance-transform the silhouette → find the head
apex and the toe → walk the cheapest path between them, where cost rises near the edges, so the route
follows the medial axis instead of cutting through a sleeve. **The length of that path is the height.**

A gown adds mass around the legs without shortening the route; a bent knee lengthens it, which is the
point. (An earlier version used the per-row centre line — do not use it; a flowing gown drags the
centre line sideways and it reported 12–40% drift on states that are actually still.)

## 4.4 The gates — a state is not wired if

- **traced-height drift > 6%** — the camera moved; regenerate with the framing lock, do not re-slice.
- **frame-to-frame silhouette change < 1.2%** — the clip is dead.
- **watermark pixels in the bottom band** — re-download Without Watermark. Never scrub in software.
  **12 Sep 2026: `Pipeline tools/cs10.py` now ENFORCES this.** Its `scrub_watermark()` has been gutted to an
  identity function and replaced by `gate_watermark()`, which REFUSES to slice at >0.5% non-chroma in
  the bottom-right strip and names the re-download route. The banned technique is no longer reachable
  from the tool. Override for a diagnostic only with `WM_TOL=<pct>`; never to ship.
- **THE BACKDROP SWEEPS COLOUR** — sample the four corners of EVERY frame, not a thumbnail strip. A
  clean green clip holds about R 5-11, G 244-250, B 7-13 for its whole length. If any frame's corners
  leave that box the clip is unwireable, however good the motion is, and the figure is usually tinted
  too. **This is a COIN FLIP created by weakened backdrop locks, not a deterministic failure — see
  PROMPT BIBLE C33. It passed the lock gate and Phil's eye on the same day it cost a clip.**
- **figure touches the cell edge on 3+ frames** — cropped feet, or a weapon leaving frame.

Camera gates on a generated clip: drift wanders AND returns, `return_gap` ≈ 0; motion (mean adjacent
delta) above 0.55, good clips run 1.4–2.2; loop closure under 1.0×; edge contact 0; watermark 0; **backdrop corner spread inside the key, all frames**.

## 4.4b JUDGING SCALE DRIFT IN A CLIP — bbox height LIES. Use silhouette area, and always run a control.

**11 Sep 2026, Vex green.** Claude measured "figure height" as the bbox of non-green pixels across
the clip, got **30.1 % drift**, and reported to Phil that the take had a scale problem serious enough
to need a re-fire. **That was wrong, and it was the wrong measurement.**

**WHY BBOX HEIGHT IS NOT SCALE.** The bbox shrinks whenever the POSE shortens the figure — a tuck
mid-jump, a crouch, a recoil, a lunge. On a jump clip the legs tuck at the apex, so bbox height drops
by a third while the character's actual scale never changes. **Measuring bbox height on an action clip
measures the action, not the scale.** (This is RULE 1.5 exactly: verify the thing itself, never
something adjacent to it.)

**THE MEASURE THAT WORKS: `sqrt(silhouette area)`.** Area scales with scale², so its square root is a
linear scale proxy, and a limb tucking barely changes total area.

```python
solid = ~((g > 90) & (g - r > 40) & (g - b > 40))   # not background
scale_proxy = math.sqrt(solid.sum())
```

**ALWAYS MEASURE AN APPROVED CLIP AS A CONTROL.** A drift number means nothing without the range that
already ships. Measured over 12 frames, spread against each clip's own median:

| clip | spread |
|---|---|
| ATTACK — **approved** | −6 % / +3 % |
| CRIT — **approved** | −7 % / +2 % |
| green B (the jump) | **−8 % / +3 %** — indistinguishable from approved |
| green A | −13 % / +1 % |

**So roughly ±8 % is simply what a Hailuo clip does, and it slices fine.** Without the control, the
raw number invites a re-fire that buys nothing — and on the wrong metric it invited one on the take
that was actually the better of the two.

**THE RULE: never report a measurement as a defect until the same measurement has been run on a clip
Phil already approved.**

## 4.7 Where the failures live
**In the MIDDLE of the clip, not at the ends** — the end frame pins the ends. Torso crop-check at
0, ¼, ½, ¾ and end, and report middle-frame drift to Phil even when he has already approved the clip.

# 5 · WIRING  *(was §7)*

## 5.0 THE WIRING CHECKLIST — four checks, every hero, every time

**Phil's rule, 11 Sep 2026.** A hero with sheets in `BATTLE_ANIM` is not finished. Run all four.

### 1 · The animation priority ladder actually works for this hero

The ladder is **engine-wide, not a per-hero list** — `_lockPri` 6 ult · 4 skill · 2 hit · 1 attack,
keyed off whatever sheets the unit has. Wiring a state puts the hero on it automatically. **So the
check is not "is he on it" — it is "does it behave for him".** Three things:

- **Every state the hero's kit needs has a sheet**, or a deliberate fallback. A missing ability sheet
  falls back to `attack` flagged as a stand-in (`_castFlash`), which is honest but is not finished art.
- **The lock duration is sane against the cooldown.** `_abilHold` is **ONE FULL PLAYTHROUGH** of the
  clip — and for a `pingpong` clip that is forward AND back: `(2n − 2) / fps`. A skill can only be cut
  by the ult or by CC, so a lock approaching the cooldown means the hero never auto-attacks.
- **Passive and idle are never interrupted once started, except by the ult or a hit** (v521). A timed
  passive fires at skill priority, not as a low-priority flourish.

```
lock seconds = (pingpong ? 2*n - 2 : n) / fps      compare against the ability's cd
```

**Worked example — Umbris, 11 Sep, caught by this check:**

| state | n | fps | pingpong | lock | cd | lock as % of cd |
|---|---|---|---|---|---|---|
| blue Creeping Rot | 33 | 12 | yes | 5.33 s | 6 s | **89%** |
| green Shadeburst | 36 | 12 | yes | 5.83 s | 7 s | **83%** |
| ult Umbral Cataclysm | 36 | 12 | yes | 5.83 s | — | — |

Against Vael's green at 1.00 s and Vireo's at ~2 s. At 85% he chains one cast into the next and
barely ever swings. **The cheapest fix is `fps`** — the same frames played faster, a one-line change
with no re-slice and no credits: 12 → 20 fps takes those to 3.2 s and 3.5 s. Trimming frames is the
other option; both are reversible, so measure and ASK before choosing.

### THE ORDER IS FIXED: scale → anchor. You cannot anchor what is not scaled.

**Phil, 11 Sep 2026: *"you have to scale before you can anchor"*, and the reason:
*"if you anchor a hero before scaling you will just have to re anchor them if you fixed their scale.
so why not just scale first to save an extra step"*.**

**The anchor numbers are measured OFF the cut.** Change the cut and every one of them —
`figH`, `feet`, `cx`, `top`, and the whole `ax` drift table — is stale and has to be measured again.
So anchoring first is not merely useless, it is **work you will throw away**. Scale first, once.

Anchoring pins every state to one ground line and one head height. **If the states are not cut at the
same scale, there is nothing coherent to pin** — you would be lining up art that carries different
amounts of the character, and a perfect set of anchor numbers on mismatched art is still wrong on
screen. So:

- **Check 2 (scale) is a GATE on check 3 (anchor).** A hero failing scale is not "anchored badly",
  they are **not ready to be anchored**, and their anchor numbers carry no information yet.
- Report them as failing SCALE. Do not report an anchor result for them at all.
- The fix is at the CUT — re-slice, or re-shoot the state that is out of family — never by editing
  anchor numbers to compensate.

### 2 · All frames are scaled — one hero, one size

Every state of a hero renders the character at the same on-screen size. The engine normalises by
`figH`, so **the check is that every state's `figH` is a truthful measurement of the same body**.

- Compare `figH` across the hero's states. A spread is not automatically wrong — a thrown chain or a
  wide swing legitimately changes the crop — but it must be explainable.
- **Verify with a proxy that spell FX cannot inflate.** `sqrt` of the BLACK BODY area only, cloak and
  FX excluded, reproduces a correct wired `figH` within ~5%. This is what caught Umbris's blue sitting
  21% larger than his green off the same sheet: head-width caught his cloak and the bbox caught the
  FX, and both diagnoses were wrong before the body-area proxy was used.
- **RULE 2.5 applies here** — the hero's number is the ceiling of their LOWEST animation, and better
  states come DOWN to it.

### 3 · Anchored — one ground line  *(only once check 2 passes)*

`figH` · `feet` · `cx` · `top`, all four measured from **that sheet's own frame 0**, so every state
shares one ground line and one scale.

- Re-measure after ANY re-slice. The engine reads `top` as `u._headOff`.
- **A missing `figH` drops the hero onto the legacy path** — the whole FRAME maps to `sprH`, anchored
  bottom-centre, and the character grows, shrinks and floats with every crop change. That hit ~50
  states across the roster once.
- **Check drift INSIDE each clip too** (`ax`). `cx` only pins frame 0; Hailuo clips drift, and the
  per-frame anchor is what removes it. Smoothing window = ONE FULL GAIT CYCLE (§3.6).
- The proof to show Phil is the visual one: every state's frame 0 side by side with the feet line and
  the height line drawn on, plus all states stacked. **If scale and anchor agree, the stack resolves
  to a single silhouette.**
- **Nerisse Bellglass, 17 Sep:** matching `figH` alone did not anchor eight wired states. Four
  states kept `cx` 7–61px away from idle and visibly snapped in a live fight. For a hero-wide
  wiring pass, compare each state's `cx`/`feet`/`top` against idle after scale is set, then cycle
  actual idle, walk, attack, hit, abilities, passive and ultimate in a running battle. Check the
  sprite and HP bar remain planted across transitions; a contact sheet or one-state harness is
  not the final motion verdict. Record apparent priority interruptions separately until tested.
- **Nerisse Bellglass walk, 17 Sep:** the walk's source canvas was 1248×1664 while the other
  states were 816×1104 or cropped to match. Its `figH:368` looked close to idle's `369`, but its
  body and ground line still jumped. Align the actual body and feet to idle after scale: the
  measured walk metadata is `figH:394, feet:413, cx:114, top:19`. Verify idle→walk in a real
  battle with the HP bar and feet on the same pixel row; matching `figH` alone is not proof.

### 4 · The px guidance was followed

- **Cut NATIVE.** No figure-height target, no `FIG_TARGET`, no `CELL_CAP` downscale outside the three
  legitimate cases (§3.5).
- **`detailPx` was measured and REPORTED to Phil** before wiring — the slicer prints it as `[DETAIL]`
  and records it in the sheet entry.
- **px is DETAIL, not `figH`** (RULE 2.0). If the number came out low, the cause is the plate framing
  (§2.2) and the fix is at generation time, not at slice time.

### Report all four to Phil in one line before calling a hero done
State per hero: the four lock durations against their cooldowns, the `figH` spread across states,
whether the stack resolves, and the `detailPx`.

## 5.1 The steps

1. Copy the sheet to `assets/anim/<key>/<key>_<state>.webp` and **bump the `?v=N` cache-buster** in
   the `u:` URL. The service worker caches sheets aggressively.
2. Paste the META into `BATTLE_ANIM[key][state]`.
3. Set `flip` so the clip faces the enemy, `hold` for attack/ability states (0.8–1.1), `pingpong` for
   symmetric loops, `reverse` if the stride reads backwards.
4. New hero: `HERO_TYPES`, `hero_base.json`, `KITS`, `ULT_DEF/DESC`, `HERO_ULT_ART` (or `ABIL_ANIM`),
   `PASS_DESC`, `ROW_OVERRIDE`, `HERO_PORTRAITS`, roster art, and the server pools by hand —
   `server.js` never reads `wip`, so a new hero is absent from server pools until added.
5. Run the frame-by-frame label check and look at it yourself before Phil does.

## 5.2 The engine's arithmetic — why the measurements matter

```js
const qh = u.sprH * (A.fh / A.figH);
spr.scale.set(qh * (A.fw / A.fh), qh, 1);
spr.center.set(A.cx / A.fw, 1 - (A.feet / A.fh));
```

So the **character** is exactly `sprH` tall in every state, the feet sit on the ground line, and
effects can extend past the frame in any direction without moving him. **Lowering `figH` makes the
character render BIGGER** — which is why a false `figH` is a size bug, not a cosmetic one.

`figH`/`feet` varying between states is not a warning sign by itself — a thrown chain or a wide swing
legitimately changes the crop. The RATIO is what the engine consumes.

**The bug class — no `figH` at all.** The engine falls back to the legacy path: the whole FRAME maps
to `sprH`, anchored bottom-centre. The character then grows and shrinks with every crop and floats
above or sinks below the ground line. That caused Vulmar to change size between animations and hit
~50 states across the roster. `sc:` is a legacy multiplier used ONLY on that path.

**Where this does NOT help:** `figH` fixes scale BETWEEN states. It cannot fix drift INSIDE one clip
(a camera push baked into the footage) — that needs `stabilize_sheet.py`, and only for monotonic growth.

## 5.3 The flip rule — do not guess it from a thumbnail

```js
const sourceRight = !A.flip; mirror = (desired>0) !== sourceRight;
```

    art faces RIGHT → flip:false
    art faces LEFT  → flip:true

A wrong `flip` shows up as "faces backwards on some animations". **Determine facing with two
independent checks:** a high-zoom head crop of frame 0 upscaled 3–4× (nose/ear/beak direction is
unambiguous; low-res grids are NOT — five units were mis-set from thumbnails and had to be reverted),
and silhouette mirror-correlation against the hero's own idle mask. **Ignore correlation results with
margin < 0.06** — that means the creature is frontal or symmetric and flip is visually irrelevant.

**The "empirical" flip table from 5 Sep is RETRACTED.** Wire per the engine comment, ship, and ask
Phil which way the hero faces in game. It is a one-line fix either way — never argue from a rule.

## 5.4 Animations play in full

- Never cancel an ult animation, unless the hero is CC'd (fear, silence, stun).
- Never cancel a skill, unless to use the ult, or CC'd.
- Never cancel an auto attack, unless to use the ult, or CC'd.
- Priority: **ULT > Walk (if not close enough) > Skill > Hit > Passive > auto.**
- Always start the walk animation BEFORE walking: finish the current animation, THEN play walk,
  THEN move.
- Anything that hits or heals lands its damage **when the image lands**, not before.

`_animLockT` / `_lockPri` / `_abilPri` (6 ult, 4 skill, 2 passive). **Render-only** — v408 gated
combat on it and the client/server sims desynced; v409 reverted. Cooldowns keep ticking during the lock.

**A clip is fitted to its hold, never truncated by it**: `_ah = min(_ai*0.95, hold || clipDur(A))`.
Holding a 48-frame swing for 0.42 s showed the wind-up and never the strike.

**The engine adds no motion to an animated hero** — no lunge, no idle bob on a hero with a real sheet.

## 5.5 The label check, before blaming code
Render 12 sampled frames per state with the **game's own state label written on top** and send it to
Phil. Void Weaver's "bug" was five mislabelled clips, not code. Check labels before regenerating anything.

## 5.6 ⛔ SPELL FX ARE **NOT** `BATTLE_ANIM` ROWS. THE KEY NAMES COLLIDE. 16 Sep 2026.

**Two tables in `emberweave-heroes.html` use the same key names for different things, and wiring an
FX sheet into the wrong one destroys a character animation.** Caught on the 0600 heartbeat, before
anything was written, after a previous hour had staged exactly that edit.

| | `BATTLE_ANIM[<hero>][<state>]` | `FX2_DEF[<gfx key>]` |
|---|---|---|
| what it is | **the hero's own body** performing the cast | **the effect overlay**, no figure |
| asset path | `/assets/anim/<hero>/<hero>_<state>.webp` | `/assets/anim/fx/<gfx key>.webp` |
| the tell | carries `figH` `feet` `cx` `top` — a measured body | carries `dur` `upright` `upSize` `upExtent` `ro` |
| geometry (live) | `n:48`, 6×8, native cell | `n:30`, 6×5, 320×320 cell |
| who reads it | the sprite renderer | `abilArt()` → `fx2Tex` → `fx2SetFrame` |

**`BATTLE_ANIM.lumi.green` is Lumi standing there casting Dawnward. `FX2_DEF.lumi_green` is
Dawnward's effect.** Both exist, both are called `lumi_green`, and the same holds for `lumi_blue`,
`lumi_ult`, `astra_green` and every other hero with FX. **A filename or a key name cannot tell you
which table you are in — open the row and look for `figH`.**

**Overwriting the `BATTLE_ANIM` row is a MASTER RULE 23 / RULE 23 violation**, not a cosmetic
mistake: it deletes the character performance and strips `figH` `feet` `cx` `top`, which drops the
hero onto the legacy anchor path (§5.0 check 3). Phil's words are *"all characters, dont touch their
character animation, only change spell fx and ult fx"*.

### Where an FX sheet actually goes

**Historical FX restoration is not exempt from in-game placement review (3 Oct 2026, Fritz v950 failure).** Original-sheet byte identity and a sheet preview cannot qualify the renderer's plane: restoring the old `disc` row flattened Fritz's cloud into a floor oval. Before approval, inspect the actual engine-cast effect from the exact candidate in battle: plane, size, anchor and ability window. v951 restored upright placement; do not infer correct presentation from historical metadata.

1. **Find the key, do not guess it.** `KITS[<hero>].green.gfx` · `.blue.gfx` ·
   `HERO_ULT_ART[<hero>].gfx`. The ability's own name never appears — Astra's *Starfire* is
   `astra_green`.
2. **Replace the `FX2_DEF` entry's geometry and bump `?v=`.** `n`, `cols`, `rows`, `fw`, `fh`, `dur`
   and `upExtent` all move together when the sheet changes shape.
3. **`upExtent` is MEASURED, never inherited.** It is the fraction of the cell the painted effect
   fills, and `S = targetH × upSize / upExtent` — so carrying a `0.9` onto a sheet that actually
   fills `0.98` renders the effect ~9% oversized. Measure the largest painted bbox across all 48
   cells. `upSize` is the opposite: a LOOK, how big the effect reads against the target. Ask.
4. **`fw`/`fh` set the aspect** — `sprite.scale = (S, S×fh/fw)`. A native-cut FX sheet is not square
   and will not match the 320×320 rows around it; that is fine, but it is a visible change.
5. **`dur` in `FX2_DEF` is the effect's own length, not the house `2.0`.** Live values run 1.04 to
   5.88. The `2.0` convention belongs to the character table and does not apply here.

### Not every ability has a hook

**Passives have none.** `KITS[<hero>].purple` carries `name` and `pass` and **no `gfx` field on any
hero in the roster** — so a finished passive FX sheet has nowhere to be wired until Phil rules on
when it draws (`Open Projects/11` Q7). **Some ultimates have none either**: a hero absent from
`HERO_ULT_ART` needs a new entry there AND a new `FX2_DEF` row, which is two additions, not a swap.
**Check both tables before promising a sheet can be wired.**

## 5.7 ⛔ `FX2_DEF.dur` IS NOT A FREE NUMBER — IT IS THE EFFECT'S `life`, AND A LONGER ONE LOSES FRAMES. 16 Sep 2026.

**The engine gives an effect a fixed number of seconds on screen and steps the sheet by the clock.
If `dur` is longer than that window, the tail of the sheet never draws at all.** Two lines, both in
`emberweave-heroes.html`:

```js
// abilArt() — how long the plate lives
const _life = (type==='tendrilpull') ? ((o.dur||3)+0.35) : (o.gdur || 1.6);
// updateGroundFx() — which frame is showing
let fr = Math.floor((o.t / o.d.dur) * o.d.n);
```

So the fraction of the sheet a player ever sees is **`life / dur`**, and:

| slot | where `life` comes from | value |
|---|---|---|
| **ultimate** | `HERO_ULT_ART[<hero>].gdur` | per hero — 1.04 (Lumi) to 5.88 |
| **green / blue** | `KITS[<hero>][<slot>].gdur` **if present** | most have none |
| **green / blue with no `gdur`** | the default in `abilArt` | **1.6 s** |

**⛔ CORRECTED 16 Sep 2026, 0800 heartbeat. THE "INVARIANT" WRITTEN HERE AT 07:25 WAS FALSE, AND IT
WAS FALSE BECAUSE THE TABLE WAS READ INCOMPLETE — see §5.9.** The original claim was *"131 abilities
name a `gfx`; 101 have `dur` equal to `life`, 30 shorter, not one longer. Zero out of 131."* That was
measured over `const KITS={…}` and `const FX2_DEF={…}` **only**, which is 49 of the roster's 60 heroes.

**The true figures, over the merged tables: 152 gfx-carrying abilities, and TWO of them ship
truncated today.**

| hero | slot | gfx key | `life` | live `dur` | what the player sees |
|---|---|---|---|---|---|
| **Dawnbringer** | green — *Radiant Hammer* | `dawnbringer_green` | **1.20** | **1.50** | **80% of the sheet; the last 20% never draws** |
| **The Last Furnace** | green — *Forge Strike* | `lastfurnace_green` | **1.40** | **1.50** | **93%** |

Both are in the 11 heroes the literal-only read could not see. **The invariant is therefore not "no
row exceeds `life`" — it is "no row SHOULD exceed `life`, and two currently do."** `dur = life` is the
fix for both, and `dawnbringer_green` is also one of the sheets in Grok's batch, so its replacement
row must carry `dur:1.20` and not the `1.50` that is there now.

**⛔ UPDATE — 16 Sep 2026, 1700 heartbeat. ONE of the two is fixed; the count above is now history.**
`dawnbringer_green` shipped with Grok's replacement row at 09:43 ET (change request
`Cowork/02 - CHANGE REQUESTS/1315 16 09 2026 DEPLOYED.md`, receipt
`SHIPPED/SHIPPED-7c4e09d-claude-grok-fx-43.md`) and carries `dur:1.2` against `life:1.20` in the
archived client — **the whole sheet draws now.** `tools/fxcheck.py --durs` reads **152 abilities, 1
truncated**, and the one left is `lastfurnace_green` (1.50 against a 1.40 `life`, 93%), which is NOT
in Grok's batch, so nothing pending fixes it. **Do not quote "two" from the table above** — run the
gate, which is why it exists.

The rest of the original finding stands and is unchanged: of the 152, the great majority have `dur`
equal to `life` and the remainder are SHORTER. A sheet finishing early is fine; a sheet cut off is not.

**So `dur` is set from the ability, never from the clip.** `dur = gdur` for an ultimate,
`dur = gdur || 1.6` for a green or blue. A number carried over from how long the source clip ran is
the bug this section exists to stop — a blanket `dur:6.04` on Grok's 48-frame sheets would have
shown **frames 0–11 and dropped the last 36** on Cacklefang, Calypsa Prismfin, Carn and Chainwheel
Gladiator, and **8 of 48 frames on Lumi's Radiant Nova** (`gdur:1.04`). Caught 16 Sep on the 0700
heartbeat, before anything was written.

**What this costs the art, and it is a real cost, not a free win.** At `dur = life` a 48-frame sheet
plays in the ability's own window — 48 frames in 1.6 s is **30 fps against the live 18-in-1.5 s
12 fps**, so the frame rate goes up. But motion authored over 6 s then runs in 1.6 s, **3.8× faster
than it was drawn.** The two honest routes are to **cut the clip to the beat that fits the window**,
or to **raise `life`** by adding a `gdur` to that kit entry — which is a client change and a
combat-feel change, so it is Phil's call and ChatGPT's lane, never a quiet edit.

**The check before any FX row ships:** print `life` and `dur` side by side for every row in the batch
and refuse any row where `dur > life`. It is four lines of arithmetic and it is invisible in a
screenshot — a truncated effect looks like a *short* effect, not a broken one, which is why nobody
has ever reported it.

## 5.8 THERE IS A **THIRD** TABLE WITH THE SAME KEY NAMES — `HERO_SKILL_CLIPS`. 16 Sep 2026.

§5.6 says two tables; there are three, and the third is the one you meet by accident while grepping
for `carn_green`.

| | what it is | asset | the tell |
|---|---|---|---|
| `BATTLE_ANIM[hero][state]` | the body, in a fight | `/assets/anim/<hero>/` | carries `figH` |
| **`HERO_SKILL_CLIPS[hero][0..3]`** | **the same body sheets, replayed as the hero screen's skill preview** | `/assets/anim/<hero>/` — **the same files** | numeric slots **0 ult · 1 green · 2 blue · 3 passive**, no `figH` |
| `FX2_DEF[gfx key]` | the effect overlay | `/assets/anim/fx/` | carries `dur` `upSize` `upExtent` |

**It is not an FX destination.** `skillClipHTML()` plays it under the skill list when Phil hovers or
taps a skill row; `skillClipFxHTML()` returns an empty string for every hero except the Beekeeper, so
`FX2_DEF` is not drawn there at all.

**Why it still matters: it is a SECOND reader of the character sheets.** Overwriting
`/assets/anim/<hero>/<hero>_green.webp` breaks the battle animation *and* the hero screen's preview,
from one file swap. And **slot 3 is a passive clip** — which looks like the passive hook §5.6 says
does not exist. It is not one: it is the hero's own passive cast performance, not an effect plate.
`KITS[<hero>].purple` still has no `gfx` field on any hero, so §5.6 stands.



## 5.9 ⛔ A TABLE IN THE CLIENT IS NOT ONE LITERAL. `Object.assign` MERGES MORE IN LATER. 16 Sep 2026.

**`emberweave-heroes.html` declares a table, and then ADDS to it further down the file.** Anything
that reads only the `const NAME={…}` literal sees part of the game and reports confidently about the
whole of it.

```js
const KITS={ konwu:{…}, …49 heroes… };
…
Object.assign(KITS, { pyroclast:{…}, stormwarden:{…}, verdantshade:{…}, voidweaver:{…},
                      dawnbringer:{…}, cathedral:{…}, lastfurnace:{…}, beekeeper:{…},
                      librarian:{…}, corsair:{…}, waxenduchess:{…} });
Object.assign(FX2_DEF, { …28 more keys… });
```

| table | in the literal | after the merges | blind spot |
|---|---|---|---|
| `KITS` | **49** | **60** | the 11 newest heroes |
| `FX2_DEF` | **206** | **226** | 28 keys, 20 of them new |
| `HERO_ULT_ART` | 38 | 38 | none — this one really is a single literal |

**⛔ 49 out of 60 is the exact number in MASTER RULE 16's worked example** — *"a brace-walker read 49
heroes out of an engine that has 60, and the conclusion reported to him was that eleven heroes were
built, shipped and unreachable in his game."* **That defect came back on 16 Sep inside `fxcheck.py`,
a gate written the hour before specifically to stop a different silent FX bug**, and it is what made
§5.7's invariant read "zero offenders" when there are two. A gate can carry the bug it was built to
catch.

**What follows from it, and none of it is optional:**

1. **Never conclude anything about a roster from a table read.** Read it, then check the count against
   `05 - HERO ENCYCLOPEDIA` §1, which is the canonical list (MASTER RULE 17). **60 is the number.** A
   read that yields 49 is a broken read, not a discovery about the game.
2. **`fxcheck.py`'s `_block()` now concatenates the literal and every `Object.assign(NAME,{…})`**, and
   its docstring carries this reason so it is not "simplified" back.
3. **The 11 merge-only heroes**, because they are the ones that vanish: Pyroclast · Stormwarden ·
   Verdant Shade · Void Weaver · **Dawnbringer** · The Walking Cathedral · **The Last Furnace** ·
   The Beekeeper · The Librarian · The Corsair · The Waxen Duchess. **Both of §5.7's live truncated
   rows are in this list.** That is not a coincidence — they were invisible, so nothing ever checked them.
4. **The `*_green_fx` / `*_blue_fx` / `*_ult_fx` keys in the merge are NOT the ability's ground FX.**
   They are `pfx` projectile art. Dawnbringer's green plate is `dawnbringer_green`; `dawnbringer_ult_fx`
   exists while `dawnbringer_ult` does not. **Judge the key by the field that references it, never by
   its name.**

## 5.10 ⛔ `keycheck.py` IS A CHARACTER RULER. DO NOT RUN IT ON AN FX PLATE. 16 Sep 2026.

**Run on all 37 of Grok's spell-FX sheets it failed all 37, with a median 24% of the opaque body
"leaning toward magenta" and a `NOT SHIPPABLE` verdict on every one.** That looked like a
batch-destroying find. It is not one.

**The control is what settled it** (MASTER RULE 16 — *a surprising measurement means check the ruler
first, on a case whose answer is already known*). The same gate was run on the **live, shipped,
Phil-approved** FX library:

| live sheet | body lean | verdict |
|---|---|---|
| `astra_blue.webp` | **94.5%** | NOT SHIPPABLE |
| `carn_blue.webp` | 45.3% (soft edge **76.5%**) | NOT SHIPPABLE |
| `astra_ult.webp` | 54.1% | NOT SHIPPABLE |
| `aureth_blue.webp` | 51.9% | NOT SHIPPABLE |

**14 of 14 live sheets fail, including heroes Phil names among his best.** A gate that condemns the
shipped game is measuring the wrong thing.

**Why it cannot work here.** `keycheck` scores *lean toward the key* — for magenta, `min(R,B) − G`.
That is a valid contamination test on a CHARACTER, whose palette is chosen to sit far from the key
(§3.4a). **An effect plate is routinely pink, violet, rose or warm-white BY DESIGN, and is soft-alpha
over most of its area.** Its art leans toward magenta, so the ruler cannot separate the effect from
the spill. It is §3.4a's own warning — *"red is the nearest large family to magenta"* — applied to a
subject made mostly of exactly that family.

**So:**

- **The ruler table in §4 covers character sheets. For FX, `keycheck` has no verdict to give.**
- **`fxcheck.py` is the FX gate** — grid proven not assumed, cell population, 3 px border, measured
  `upExtent`, and `--durs` for §5.7. It deliberately does not score colour.
- **Colour on an FX plate is Phil's eye, not a number** (MASTER RULE 16). Show him the frames.
- **⛔ And look at the composite the way the ENGINE will.** A sprite sheet's fully-transparent pixels
  still carry RGB, and on a keyed cut that RGB is often the original magenta. `Image.paste(cell,pos)`
  **without a mask** copies it, and `.convert('RGB')` then reveals a magenta field that does not exist
  in the game. That produced a preview showing solid magenta over art measuring **0.000%** key —
  the same failure as RULE 18's BEFORE/AFTER video, from the same cause. **Always
  `paste(cell, pos, cell)` and composite over a known background.**



## 5.11 ⛔ A TOOL THAT READS THE CLIENT MUST READ **ALL** OF IT — NEVER HAND-LIST THE ROSTER. 16 Sep 2026.

**§5.9 is one instance of a wider defect, and the wider one cost three finished sheets the same
night.** `fxmap.py` carried a hand-written `HEROKEY` dict of the 11 heroes that existed when it was
written. Grok filed **Fritz** at 08:53; `fritz` was not in the dict, so every one of his three sheets
came back slot `ult`, **class B**, *"no `FX2_DEF` row."*

**Fritz's real kit — read out of the client, which had it all along:**

| slot | ability | gfx key | `life` |
|---|---|---|---|
| green | Storm Surge | `fritz_green` | 5.88 |
| blue | Chain Lightning | `fritz_blue` | 5.88 |
| ult | Thunder Shower | `fritz_ult` | 5.67 |

**All three are class A.** Fritz is the **third hero whose every sheet is wireable**, after Carn and
Deepcleft.

### The three ways a client read goes silently wrong

| # | the defect | the tell |
|---|---|---|
| 1 | reads the `const` literal and misses `Object.assign` (§5.9) | a roster count that is not **60** |
| 2 | **a hand-listed roster inside the tool** | a hero who exists in the game and not in the output |
| 3 | **one quote style only** | a name containing an apostrophe — the client double-quotes those |
| 4 | **the sheet's FILENAME carries a decoration** (§5.11a) | a whole hero's sheets go class `U` at once |

**Defect 3 is not hypothetical:** `abilityName` is written `'…'` 58 times and `"…"` three times, and
**all three double-quoted ones are double-quoted because they contain an apostrophe** — Dandra's
`"Queen's Call"` among them. A single-quote regex cannot see them.

### ⛔ AND NEVER GUESS A SLOT FROM A FAILURE TO MATCH

`fxmap` used to fall through to **"ult by elimination"** — any sheet whose name matched no
green/blue/purple in the kit was declared an ultimate. That turned two different unknowns (an
unresolved HERO, an unresolved ABILITY) into one confident wrong answer, and it **masked defect 3**,
because the guess happened to be right for Dandra and wrong for Fritz. Asserting a value from an
absence of evidence is MASTER RULE 17 in miniature.

**A tool that cannot resolve a sheet says so — class `U`, UNRESOLVED.** It is not a verdict about the
art. **It is never reported to Phil or to Grok as "cannot be wired"**; it is chased.

### Why this direction of failure is the expensive one

**A sheet wrongly called class A is caught within minutes** — someone goes looking for the `FX2_DEF`
key and it is not there. **A sheet wrongly called class B or C is dropped from what Phil is shown and
the art sits finished and invisible**, which is the one outcome this whole batch exists to avoid.
Grok is working the roster alphabetically, so **every hero after Fritz would have been mislabelled**
for the rest of the night. Greatbrow's first two sheets landed at 09:09, mid-run, and resolved
automatically — which is the point of reading the roster rather than listing it.

**The standing check before any count off the client is trusted:** the roster is **60**
(`05 - HERO ENCYCLOPEDIA` §1, MASTER RULE 17), the tool reports UNRESOLVED rather than guessing, and
a surprising classification is checked against the ruler before it is reported (MASTER RULE 16).
Incident in `GOTCHAS/09 - GOTCHAS - running log of problems and fixes.md`, 16 Sep 09:25 UTC.

### 5.11a ⛔ THE FOURTH WAY: A DECORATION IN THE FILENAME. 17 Sep 2026, 0600 heartbeat.

**Nine finished sheets went class `U` overnight and not one of them was wrong.** Grok began filing as
`<Hero> - <Ability> (sprite sheet).webp` at 04:50 on 17 Sep. `fxmap.py` strips the hero prefix and
then `norm()`s what is left to `[a-z0-9]`, so **`"Bloomstep (sprite sheet)"` became
`bloomstepspritesheet`**, matched no ability, and the sheet was unresolved. Kharos Bloomknife (3),
Kilnmask Potter (4), Ironcoil (1) and King Bloatus (1) went `U` together, purely on the suffix.

**The cost is not the label — it is that `projstat.py` REFUSES to publish `Open Projects/00 - THE PROJECT
LIST.md` while any sheet is class `U`.** That refusal is correct and was written on purpose. But it
means **one filename decoration silently froze the live queue another builder is told to read**, and
the art it hid was good: all nine PASS `fxcheck.py` (6×8, 48 cells, 972×972, clean 3 px border).

**Fixed in the ruler, not in Grok's folder** (MASTER RULE 16, and Phil's 16 Sep instruction to leave
Grok alone): `fxmap.py` now strips a trailing `(sprite sheet)` / `(sprite sheets)` before matching.
**It is not an elimination guess** — the stripped name must still match an ability EXACTLY or the
sheet stays `U`, and only the literal words are removed. Verified the way the 16 Sep folder-split
patch was: output **byte-identical on all 66 sheets that already resolved**, only the nine `U` rows
changed. `Counter({'A':49,'C':12,'U':9,'B':5})` → `Counter({'A':55,'C':14,'B':6})`, **zero `U`**.
Backup `tools/_backups/fxmap.py.bak-17SEP2026-0600-pre-sprite-sheet-suffix`.

**The general form, and it is now four for four: every one of these defects was the ruler reading a
NAME.** A hand-listed roster, a quote style, a folder rename, and now a filename suffix. **`Game Art/Heroes/`,
`GROK SPELL ART/` and the sheet filenames are all Grok's to name, and none of them is an interface.**
A tool that resolves work by parsing a human-written name will break again — so when a whole hero's
sheets change class at once, **suspect the parser before the art** (MASTER RULE 16), and check what
the names did between the two runs.

### 5.11b ⛔ THE FIFTH ONE, AND IT WAS IN MY OWN KEY GATE. 17 Sep 2026, 1100 heartbeat.

**`projstat.py`'s unkeyed gate globbed `Game Art/Heroes/*/GROK SPELL ART/sprite sheets/*.webp` — one
hard-coded path.** Grok began filing straight into `GROK SPELL ART/` at **09:26 on 17 Sep**, and
**ten sheets went invisible to it, nine of them unkeyed** — including all four cut after the 10:11
chroma gate. The gate that decides what `Open Projects/00 - THE PROJECT LIST.md` publishes as ready was
reading a folder layout that is **Grok's to change and is not an interface** (§5.11a).

**Measured: 95 sheets under `sprite sheets/`, 10 directly in `GROK SPELL ART/`.** The old gate saw
95 of 105; it would have published a list naming 29 unkeyed sheets when there are 39.

**Fixed by deleting the path, not by adding the second one:** `projstat.py` now calls
`keyaudit.audit()`, which **walks** `Game Art/Heroes/` and takes any `.webp` under a `GROK*` directory. It is
also the MASTER RULE 24 fix — the old gate re-decoded 594 MB of `.webp` per run and was timing out at
120 s; the walk is cached on (path, mtime, size). Backups `tools/_backups/projstat.py.bak-17SEP2026-1100-pre-keyaudit`
and `tools/_backups/keyaudit.py.bak-17SEP2026-1100-pre-audit-api`; `keyaudit`'s own listing verified
**byte-identical** across the refactor.

**Five for five: hand-listed roster · quote style · folder rename · filename suffix · and now a
hard-coded folder path inside the fix for the previous one.** The general form has not changed and
the answer is always the same shape: **walk and read the contents; never encode where a human files
things.**

**`GROK ANIMATION ART/` is unaffected and must stay so.** Nerisse Bellglass has eight sheets carrying
the same suffix in that folder; `_FX_DIRS` excludes it, this patch does not widen it, and character
animation never enters the FX mapper (MASTER RULE 23, §5.6).


### 5.11c ⛔ THE SIXTH ONE IS THE FIFTH ONE, LEFT IN THE MAPPER THREE HOURS AFTER THE GATE WAS FIXED. 17 Sep 2026, 1400 heartbeat.

**§5.11b above fixed `projstat.py` and `keyaudit.py` at 1100. `fxmap.py` carried the identical
hard-coded glob until 14:1x and nobody swept it** — `glob.glob("Game Art/Heroes/*/%s/sprite sheets/*.webp")`,
line 103, the same one sentence, in the tool that decides where every sheet GOES.

| | |
|---|---|
| sheets `fxmap.py` could see | **95** |
| sheets on disk | **110** |
| invisible | **15 — all four of Stormwarden, all four of Sylthaine, all four of Oakmir, three of four of Nox Quillfinger** |
| what it reported instead | `Counter({'A': 74, 'C': 19, 'B': 2})` — **a clean run with zero class U** |

**THE DANGEROUS PART IS THE ZERO.** §5.11a's filename decoration and §5.11b's folder rename both
pushed sheets to **class U**, and `projstat.py` REFUSES to publish while any sheet is U — so both
announced themselves. **A sheet outside the glob is never classified at all.** It does not go U, it
does not go missing from a list, it is not in the population being counted. The run looks *healthier*
than a correct one. That is MASTER RULE 17 in its purest form: **a missing item is invisible to a
survey of what is present** — and the survey's own error channel cannot see it either.

**AND IT PROPAGATED, BECAUSE TWO TOOLS TAKE THEIR SHEET LIST FROM THIS ONE.** `fxrows.py` and
`fxapproval.py` both shell out to `fxmap.py --json` (`fxrows.py` l.53, `fxapproval.py` l.27).
So for three hours **Phil's RULE 13 approval page and the staged-rows document were each missing
four complete heroes**, and neither could have said so.

**Fixed the same way §5.11b was — by deleting the path, not by adding the second one.** `fxmap.py`
now walks each `_FX_DIRS` folder with `os.walk`, excludes any `seeds/` segment (input plates, not
sheets), and dedupes. **`_FX_DIRS` still does the load-bearing work: it is what keeps
`GROK ANIMATION ART` out** (MASTER RULE 23, §5.6) — the walk was deliberately not widened to
`GROK*` the way `keyaudit.audit()`'s is, because `keyaudit` only MEASURES a sheet while this tool
assigns it an `FX2_DEF` destination, and a character sheet given one would overwrite a hero's
performance. Backup `tools/_backups/fxmap.py.bak-17SEP2026-1400-pre-subfolder-walk`.

**After: 111 abilities, `Counter({'A': 86, 'C': 23, 'B': 2})`, zero class U.** Every one of the 15
resolved to a real live `gfx` key with matching `life`/`dur` — `stormwarden_green`, `sylthaine_ult`,
`oakmir_blue`, `nox_ult` and the rest — so nothing about the destinations was ambiguous. **They were
simply never looked at.**

**THE LESSON IS NOT "WALK, DON'T GLOB" — THAT WAS ALREADY WRITTEN AT 1100 AND IT DID NOT REACH THIS
FILE.** It is: **when you fix a ruler, grep for the defect's SHAPE across every ruler in the same
turn.** One command would have found it — `grep -n "sprite sheets/" tools/*.py` names all five
call sites, and at 1100 two of them were fixed and the other three were left, in the same folder, on
the same day. **A fix that is not swept is a fix with a known lifespan.**

### 5.11d ⛔ THE SEVENTH ONE: THE PATH SEPARATOR — THE TOOLS NOW RUN ON PHIL'S WINDOWS MACHINE. 23 Sep 2026, 23:10.

**`fxmap.py` reported 199 of 200 sheets class `U`, including sheets live in the game for a week.**
It took the hero from `folder.split("/")[1]`; `os.walk` joins with `os.sep`, which is `\` on
Windows, so the "hero" was `Heroes\Astra\GROK SPELL ART\…` and nothing resolved. Every FX tool was
written on the Linux Cowork VM; since the local session (17 Sep) they run on Windows. Fixed:
`folder.replace(os.sep,"/").split("/")[2]` → `Counter({'A':141,'C':45,'B':13,'U':1})` (the one U is
Cathedral Gates, unrelated). Backup `tools/_backups/fxmap.py.bak-23SEP2026-2310-pre-windows-sep`.

**Swept the same turn (5.11c's lesson):** `grep 'split("/")'` across `fxmap fxrows fxapproval fxcheck
projstat keyaudit` — the only hit was this one. **`fxrows.py` had a second stale path**: `OUT` still
pointed at `Operating procedure/Cowork/…`, which moved into `WORKLOGS and COWORK/Cowork/`. Fixed,
backup `fxrows.py.bak-23SEP2026-2320-pre-cowork-path`.

**Running them locally:** the system `py -3` has no numpy. `fxcheck.py` / `fxrows.py` run under the
Brain venv: `C:\Users\Home\AppData\Roaming\kimi-desktop\daimon-share\daimon\runtime\python\.venv\Scripts\python.exe`,
from the archive root (`fxmap.py` opens `Base files/emberweave-heroes.html` relative to the cwd).
`fxrows.py` fxchecks every sheet in the archive: ~3 min.

### 5.11e THE PIPELINE, END TO END — what was actually run for v816 (23 Sep 2026)

1. `fxmap.py` → destination, class, `life`, live `dur` per sheet.
2. `fxcheck.py <sheets>` → grid, cells, border, measured `upExtent`, the commit-cap flag; `--durs`.
3. **Measure resolution against the live row before wiring (MASTER RULE 22).** The painted bbox
   of the new sheet against the live sheet it replaces, at the same on-screen size. If the new one is
   smaller, check the SOURCE CLIP (`ffprobe` + the painted bbox on a mid frame). If the clip itself is
   small, a re-cut cannot help (never upscale): it goes back for a re-fire with a larger seed. Old
   Maren's Tsunami v3 was held this way: 184 px painted against the live 294 px.
4. `fxrows.py` → the staged rows document (`dur` = `life`, fw/fh, upExtent, `wired?`).
5. Row shape for a 48-frame upright plate, as live on the Grok rows:
   `{u:'…?v=<never used>',n:48,fw,fh,cols:6,rows:8,dur:<life>,upright:true,upSize:<look>,upExtent:<measured>,upAnchor:[0.5,0.0],ro:1}`.
   `ro` is the render order (in front of units), not a rotation; `upright` stands the plate at the
   target unrotated. `disc` lays it flat on the floor, and `cone` lays it caster→target.
6. `git log -S "<key>.webp?v="` → pick a version never used (SHIPPING RULE 4).
7. **⛔ AN AREA ABILITY'S PLATE IS SIZED FROM ITS RADIUS, NEVER UPRIGHT AT TARGET HEIGHT** (v816/v817,
   caught by ChatGPT's peer review). Vine Snare (`swamproot`, 2.4 m root) was proposed `upright`: an
   upright plate sizes from the TARGET's height (`th = _fxTgtH || R3*1.2`), so the vines painted 2.03
   world units against a 2.7072 hit diameter (75%), and enemies could be rooted outside the visible
   vines. Shipped instead as `disc:{cy,dh,dw}` measured off the sheet (the centre and the SETTLED
   painted extent as cell fractions), which paints exactly 2R: 2.7072 normal, 0.758 in the Gauntlet.
   **Check any area plate in the real renderer against the hit radius — a point cast, a cluster
   cast, a live Gauntlet run — before review.** Harnesses: `Open Projects/4 - Spell FX and Grok
   pipeline/v816 Claude Vine Snare disc fix 23 Sep 2026/` (`fx_disc.cjs`, `fx_cluster.cjs`, `fx_gauntlet.cjs`).


---

## 5.12 ⛔ A CLASS LETTER IS NOT A STATUS. "CLASS A" NEVER MEANT "NOT WIRED". 16 Sep 2026.

**`fxmap.py` classes a sheet by WHERE IT WOULD GO, not by whether it is already there.**

| class | what it actually means |
|---|---|
| **A** | the sheet maps onto a `FX2_DEF` key that exists in the live client — **a swap** |
| **B** | an ultimate with no `FX2_DEF` row and no `HERO_ULT_ART` entry — **two additions** |
| **C** | a passive; `KITS[<hero>].purple` carries no `gfx` on any hero — **no hook at all** (§5.6) |
| **U** | unresolvable — never a guess (§5.11) |

**None of those four letters says one word about the game's current contents.** A sheet that shipped
an hour ago is still class A, because the key it swaps is still live — that is the letter working
correctly.

**WHAT IT COST.** At 16:15 UTC the heartbeat counted 46 class-A sheets and reported to Phil:
*"the RULE 13 page is the only thing blocking 46 sheets."* **43 of the 46 had been live since
09:43 ET** under `Cowork/02 - CHANGE REQUESTS/1315 16 09 2026 DEPLOYED.md`, on his own recorded
pass — *"coordinate your next job which is wiring all the completed spell sprite sheets grok did"* —
with receipt `SHIPPED/SHIPPED-7c4e09d-claude-grok-fx-43.md`. The approval page addressed to him
carried **"63 sheets, all measured, none wired"** in its own headline while 43 of them were in his
game. He was asked to approve work he had already approved and already received.

**This is MASTER RULE 17 in its exact shape** — a count of what EXISTS reported as a count of what is
OWED — and MASTER RULE 15: the archive's own deployed assets are the artefact, and nobody measured
against them. The 1500 heartbeat had it right in prose an hour earlier (*"the 43 class-A sheets are
already live"*) and prose did not survive one hour, which is **MASTER RULE 14**: make it a gate.

**THE RULER, AND IT IS NOW IN BOTH GENERATORS.** The sheet's own bytes against
`Base files/assets/anim/fx/`. Byte-identical means wired; anything else is not.

- `tools/fxrows.py` prints a **`wired?`** column per class-A row, and refuses to let the class-A
  count stand as an outstanding-work number: it states *"N of M are already in the game"* and names
  the ones that are not.
- `tools/fxapproval.py` counts **only the unwired class-A sheets** as waiting on Phil, badges every
  live sheet **ALREADY LIVE IN THE GAME — nothing needed from you**, and says so in its headline.

**So the sentence that may be written to Phil is "N sheets are waiting on you", never "N are class
A".** If a number in a message to him came from a class letter, it is the wrong number.

---

# 6 · FILING  *(was §9)*

## 6.1 Names — every image and video is `<in-game name> - <what it is doing>`

```
Game Art/Heroes/<Name>/clips/<Name> - idle.mp4 | walk.mp4 | attack.mp4 | hit.mp4
                    <Name> - ability1 - <Ability name>.mp4 | ability2 - <Ability name>.mp4
                    <Name> - ultimate - <Ult name>.mp4 | passive - <Passive name>.mp4
Game Art/Heroes/<Name>/sprite sheets/<Name> - <state> (sprite sheet).webp
Game Art/Heroes/<Name>/<Name> - static.png | side profile plate.png | hero card.png
Bosses|Game Art/Monsters/<Name>/clips/<Name> - walk|attack|cast.mp4
Game Art/Spell FX/projectiles/<effect>.webp
```

States: `idle walk attack hit green blue ult passive` (monsters: `walk attack cast`; idle = pingpong
of walk). `crit` where a hero has one.

## 6.1a THE ORDER OF WIRING — ARCHIVE IS TRUTH, GITHUB IS DOWNSTREAM

Phil, 12 Sep 2026, dictated so it is not lost: *"This is the order so you don't forget. When I send
you anything and tell you to wire it"*

1. **Slice it.**
2. **Put the sliced sheets in the hero's `sprite sheets/` folder, superseding the old ones.**
3. **Wire the animation into the game** — `BATTLE_ANIM`, the right state, the slicer's own numbers.
4. **Upload to GitHub.**

*"Github is not the archive ever, archive must reflect as TRUTH before Github."*
*"Anything ever, in this game, gets changed in Archive first, THEN github."*

**The archive is not a backup and not a mirror — it is the source.** GitHub is a deployment target
fed from it. This is MASTER RULE 5 stated as a sequence: art flows **approved clip → archive →
GitHub → live, one way**, and it is never read back the other way.

Two failures this forbids, both of which have happened:

- **Writing `Base files/` and leaving the archive alone.** Nothing breaks in the game, so it is
  invisible — until someone reads the archive to see what a hero looks like and gets art from weeks
  ago. Vex's archive held her **5 September magenta-key** sheets while the game ran the 12 September
  green-key set (see 5.4b: the magenta key turned her oxblood corset olive).
- **Copying the deployed asset back into the archive to "sync" it.** That makes the archive a
  downstream copy of a build output and destroys the one authoritative source. If the archive is
  stale, the fix is to **re-slice from the approved clip**, never to copy backwards.

Step 4 is last and it is separate. The archive being right is not "half done" — it is the part that
has to be right. A deploy can always be repeated from a correct archive; a correct archive cannot be
recovered from a deploy.

## 6.1b A NEW SPRITE SHEET **REPLACES** THE OLD ONE — IN THE ARCHIVE TOO

Phil, 12 Sep 2026: *"if you update a sprite sheet, it replaces the old."*

**There is exactly ONE sprite sheet per state per unit, and it is the current one.** Regenerating a
state is not an addition. The moment a new sheet is sliced, the old one stops existing as a sheet:

1. the superseded sheet moves to `_to_delete/<Name> sprite sheets superseded <date>/` — never deleted,
   never left beside the new one, and **never renamed with a suffix to sit in the same folder**;
2. the new sheet is written at the canonical name `Game Art/Heroes/<Name>/sprite sheets/<Name> - <state>
   (sprite sheet).webp`, and at `Base files/assets/anim/<name>/<name>_<state>.webp`;
3. **both copies are written in the same pass** — a slicer run that writes only `Base files/` has not
   finished. The archive is not a backup of the sheet, it IS the sheet.

This is `alt takes/` and the never-overwrite rule in 9.2 read correctly: **CLIPS** keep their history
in `alt takes/`, because a rejected take may be wanted again. **SHEETS have no history** — a sheet is
a build output of the approved clip, so keeping an old one only creates a second answer to "which
sheet is Vex's ult?".

**How it goes wrong:** the slicer is pointed at `Base files/` (which is what deploys) and the archive
is left alone. Nothing breaks in the game, so it is invisible — until someone rebuilds from the
archive, or reads the archive to see what a hero looks like, and gets art from weeks ago.

**Caught this way, 12 Sep 2026:** all 8 of Vex's archived sheets were the **5 Sep** set while the
game ran the **12 Sep** round-6 set, and her `crit` sheet was not in the archive at all. Every one
of the 8 differed by hash.

**The check, and it is one command** — run it after any slice, from the archive root:

```bash
for st in attack blue crit green hit idle passive ult walk; do
  a="Game Art/Heroes/<Name>/sprite sheets/<Name> - $st (sprite sheet).webp"
  l="Base files/assets/anim/<name>/<name>_$st.webp"
  [ -f "$a" ] && [ -f "$l" ] && cmp -s "$a" "$l" && echo "$st OK" || echo "$st **DIFFERS OR MISSING**"
done
```

## 6.2 The rules

- **Old takes go to `alt takes/` with a bracketed suffix** — never delete, never overwrite an original.
- **A SUMMON'S HOME IS `Game Art/Summons/<Name> (<Owner>)/`, created BEFORE the first mirror.** Nothing about a
  summon goes under the owner hero's folder, not even "for now".
- **The archive holds the most current change** — mirror every deploy the same session, and write the
  SHIPPED note.
- **Never delete. Move to `_to_delete/` and tell Phil what moved.** The delete-permission consent
  prompt does not appear on Phil's machine and never has — do not ask for it.
- **A clip Claude filed is byte-identical to a file already in `C:\Users\Home\Downloads`** — build an
  md5 index and copy by hash rather than transferring through chat.

---

# 7 · QUALITY, RENDER AND CACHE  *(was §8)*

## 7.0 WORLD-MAP TILES SHIP AS WebP QUALITY 95 - PHIL'S RULING (26 Sep 2026)
Phil, after the side-by-side (https://claude.ai/artifact/D9vgHiHxciLDyqXFfxKfQP): *"To me all 3 seem identical"* · *"I think the
quality 95 pixel loss is basically unnoticeable to the human eye"*. MASTER RULE 22 forbids trading quality for speed, and Phil is
truth over it (RULE 1): the world-map picture tiles (`assets/img/world-map/world-v02*`) ship as **WebP quality 95**.
- Measured on three tiles: ~3 MB PNG -> ~0.75 MB; 4-12% of pixels move by more than 8/255, average 2/255 (PSNR 36.5-39.8 dB).
  Lossless WebP (~2.4 MB) was the no-change alternative.
- The PNG originals stay in `Game Art/World Map/` - the archive keeps the lossless source; only the served copies are WebP.
- This ruling covers the map tiles only. Any other asset class going lossy needs its own side-by-side and Phil's word.

## 7.1 The one thing that makes the game sharp

```js
function zoomPR(){ return Math.min(4.5, DPR*ZOOM_PR_MAX); }
```

**CORRECTED 12 Sep 2026 — this section printed the PRE-v586 function.** It read
`const z = battleZoom ... Math.min(4.5, DPR*z)`, i.e. the pixel ratio followed the CURRENT zoom.
v586 changed it to render at the HIGHEST zoom level's resolution **always** (`ZOOM_PR_MAX`), because
nothing called `resize3D()` when the zoom changed, so the render resolution was whatever the last
window resize happened to leave it at (`GOTCHAS/09 - GOTCHAS - running log of problems and fixes.md`, 12 Sep). Verified against the shipped
`Base files/emberweave-heroes.html`, which carries the one-line version above.

The canvas renders at **device pixel ratio × the maximum zoom level**, at all times — zoomed in
shows those pixels 1:1, zoomed out supersamples. That is the whole mechanism.

**`battleZoom` is a pure CSS `scale()`** with the 3D camera pinned at `camera.zoom = 1`. **Zoom can
NEVER add detail** — it magnifies pixels that are already there. Only `zoomPR()` renders more of them.

> When quality is the complaint, look at `QUAL.dpr` and `zoomPR`. Never at zoom.
> Every hour spent on zoom levels chasing a sharpness complaint is an hour wasted.

`ZOOM_LEVELS = [1, 1.25, 1.5, 2, 2.5, 3, 4]` (v577 added 2 and 2.5; v587, Phil 18 Sep: *"I want to be able to zoom in further"*, added 3 and 4), and **1× is the floor** — below native reads as blur. In a Gauntlet bonus run `zoomPR()` renders 1× at the screen's own DPR (not 1.5×DPR) with a 3.5 ceiling (v588, for smoothness); every other mode keeps 1.5×DPR at 1×.

## 7.2 What actually raised quality (11 Sep)

Three changes, shipped together, Phil: *"wow this is miles better"*:
- **Mipmaps + anisotropy.** Sprites are minified 2–3× on screen; `minFilter` was `LinearFilter` with
  no mipmaps, which is textbook undersampling and shimmer.
- **The cell caps removed** — `CELL_CAP = BOSS_CELL_CAP = CELL_FIG_CAP = CELL_HARD_CAP = 99999`.
  Sheets draw at the resolution they were cut at.
- **Per-frame `fs`** in the render scale: `const _fsc=(A.fs&&A.fs.length)?(A.fs[Math.min(fr,A.fs.length-1)]||1):1;`

## 7.3 The resolution governor — and the three bugs never to reintroduce

```
QUAL = { dpr:1, max:2, min:1.5, good:0, bad:0, locked:false }
frameMs > 33 → bad++      bad  >= 60  → dpr -= 0.25   (~2 s of genuine stutter)
frameMs < 20 → good++     good >= 180 → dpr += 0.25   (~3 s of healthy frames)
```

**a. A vsync dead band makes it a ONE-WAY RATCHET.** The old test was `>26` bad, `<15` good. A 60 Hz
phone rendering perfectly at vsync produces ~16.7 ms frames — neither. `good` could never increment
while every hitch incremented `bad`, so resolution only ever fell, to the floor, every session.
**Any future threshold change must be checked against 16.7 ms (60 Hz) and 8.3 ms (120 Hz).**

**b. `navigator.deviceMemory || 4` branded every iPhone WEAK.** Safari does not implement it; the
fallback tripped `mem<=4` and started every iPhone at DPR 2 on a 3× screen. Only trust a reported figure.

**c. `DPR_SCHEME` was referenced and never declared.** A `ReferenceError` inside a bare
`try{}catch(e){}` killed the whole saved-resolution branch on every device for weeks, invisibly.
**Never wrap initialisation in a bare `catch(e){}`.**

**Cache invalidation for saved quality:** a stale `localStorage.ew_dpr2` silently overrides a working
fix. Change the meaning of the saved value → **bump `DPR_SCHEME`**. Do not rename the key.

## 7.4 CDN and cache — how a correct file still shows up wrong

Assets are served `Cache-Control: public, max-age=2592000, immutable`. Thirty days, no revalidation.
A `?v=` bump is a new cache key, which is what makes a new sheet reach players at all.

> **RULE. Never request a bumped `?v=` URL until the deploy has confirmed.**

Requesting `?v=22` during the deploy window cached the **OLD bytes under the NEW key**, immutable for
30 days. The file on origin was correct; the URL was burned. Poll `/version.json` (always served
live) until the build stamp matches, and only then touch the asset. **If a key is poisoned, do not
try to purge it — bump to a key nobody has requested, and never reuse a sheet version number.**

`sw.js` keeps `ember-shell-<BUILD>` (wiped every deploy) and `ember-assets-v1` (survives deploys on
purpose — a build bump used to throw away ~20 MB of sprite art). `/version.json` is always live,
`/api/` is never cached.

## 7.5 A deploy check and a fix check are different things

Confirming the file shipped is necessary and never sufficient. On 8 Sep a new string was confirmed
present in the served file and Phil was told the bug was fixed. It was a no-op. Phil: *"you are about
to lie to me again and say you found the problem again aren't you."*

> Before calling anything fixed: **read the code path end to end** and show why the old behaviour
> cannot happen, or **measure the behaviour itself.** Never present "the text I wrote is in the served
> file" as evidence the bug is gone.

## 7.6 Release decoded battle art only after the fight is finished

`BATTLE_ANIM` sheets are preloaded before a fight so new waves appear instantly. A long session with
varied squads otherwise retains every decoded texture it has ever used. `evictUnusedArt(G.team)` may
dispose only unused `BATTLE_ANIM` textures when the ordinary result screen is dismissed or an entire
Gauntlet run ends; never during a wave or a Gauntlet firebreak. Keep the active squad warm and leave
the persistent `ember-assets-v1` disk cache untouched. The next fight must still preload every
encounter asset before entry. Measure resident textures/VRAM over varied battles, prove the next
battle has no new load hitch or missing sprite, and preserve image resolution and animation quality.
The 17 Sep five-stage test grew from 404 MB to 2,746 MB before eviction, fell to 294 MB after
releasing 17 of 20 keys, and loaded the next battle in 1,903 ms against prior 1,800–2,148 ms.

---

# 8 · SPELL FX — THE SEED PLATE, THE FRAME SLOTS AND THE NO-FIGURE PROBLEM  *(was §12)*
*Merged in whole from `15 - REGENERATION RULES (Phil, 7 Sep)` on 11 Sep 2026.*

## 8.1 Phil's four governing rules, verbatim
1. **Do not change abilities from the original HTML ability descriptions I made.** A healer remains a
   healer, damage remains damage, tank remains tank. **`Game Art/Heroes/_design packs/` is the source of truth**
   for every hero's four slots, descriptions, role and row. The game's `KITS` / `HERO_TYPES` / ult
   tables are **NOT** — they were invented and are wrong.
2. **Do not forget the female protocol ever** (§4). Its block goes in VERBATIM, plus the face rule.
3. **Slice women at 500 px and men at 400 px on the first pass** — never cut at the wrong size and redo.
4. **If anything is ambiguous, do not quietly invent an answer — ask Phil.**

**Why that first rule exists:** kits were once assembled from "options sheets" of invented
alternatives and filled in with Claude's own suggestions where Phil didn't answer, then every
animation and FX was prompted from those invented kits. Measured against the packs: **32 of 32
ability slots wrong, 15 of 16 ultimates wrong.** Threadseer, a Support healer in the pack, shipped
with a slug beast's Acid Spit. **Phil was not told any of it was happening.**

## 8.2 THE SEED PLATE — the fix, proved with 45 credits over three fires
**Wording alone could not keep an effect inside the frame. The plate could.**
- *Attempt 1* — abstract "threads all over the screen": no bodies, but read as a close-up filling and
  leaving frame on every side.
- *Attempt 2* — "centred, middle two thirds, wide empty margin": real effect, no bodies, but still ran
  out the left and right edges, and the first second was empty plate.
- **Attempt 3 — THE ANSWER.** Same prompt, but the Start Frame is a **seed plate**: the background
  colour with a small dim core and short filaments drawn dead centre, in the effect's own dominant
  colour. Verified programmatically across **all 141 frames: zero frames with any non-background
  pixel in the 3 px border.**

**Why it works: a plain plate gives the model no anchor, so it composes to fill the canvas. A seed
gives it a position and a size to grow from, and it respects both.**

**Every FX clip is fired from a seed plate. Recolour the seed per hero.**

**The prompt shape that goes with a seed plate:**
> Continue from the supplied image: the small &lt;colour&gt; &lt;thing&gt; already at the centre of the frame
> comes alive and grows, &lt;the effect&gt;. It stays exactly where it is in the centre and never grows past
> the middle two thirds of the frame — a wide band of plain background stays completely empty around
> all four sides for the whole clip. No &lt;thing&gt; ever reaches or crosses the edge of the frame at any
> moment. Fixed camera, no zoom, no close-up, no texture, no text, no UI, no floor, no environment.
> No bodies, no figures, no silhouettes, no characters of any kind — &lt;thing&gt; only.

**Verification that MUST run on every FX clip before acceptance:** extract every frame and assert no
non-background pixel appears in the 3 px border. **Eyeballing a 6-frame strip is not enough.**
**Known residue:** frame 0 and roughly the first half-second are near-empty plate — trim the opening
frames when slicing, or make the seed brighter.

## 8.3 NO SILHOUETTES IN FX — and why the negative lock is NOT enough
Phil: *"remove the corpse from the prompt this is wrong"* / *"I dont want to see silhouettes in the
animations."* **An FX sheet composites OVER the real heroes in game** — any body drawn into the plate
is a ghost figure overlaying an actual sprite. So **no FX clip may contain a body, figure, silhouette
or character. Only the effect.**

**THE NEGATIVE LOCK DOES NOT WORK ON ITS OWN.** A Threadseer ult carrying *"No bodies, no corpses, no
figures, no silhouettes, no characters of any kind — the effect only"* **drew six standing figures and
a fallen body anyway**, verified frame by frame, with the prompt confirmed present before Create.
**The model ignores a negative instruction when the positive description implies people.**

**What pulls figures in is the ability NARRATIVE itself** — "restitching the torn seams",
"battlefield-wide", the hero's name. Any FX prompt whose positive text implies bodies being healed,
struck, bound or raised **will draw bodies**.
> **OPEN, for Phil, do not guess:** whether FX prompts may be reworded to pure abstract geometry —
> materials, shapes, motion, colour only, no ability narrative, no hero name — which is the only
> approach with a real chance of returning figure-free plates.

## 8.4 FRAME SLOTS — which plate goes where. They never cross over.
| job | START frame | END frame |
|---|---|---|
| **Spell FX** (abilities, ultimates) | the **seed plate**, seeded in that ability's own colour | **EMPTY** |
| **Hero animation** (any state) | the hero's **concept-art plate** | see §9.1 |

Phil, verbatim: *"dont use a seed for hero animation only spells. the start animation for heroes
should be their concept art"* and *"spell effects should all start with seed and no end frame"*.
**For FX the End frame is always empty** — a plate there forces the clip to converge on that image and
wrecks the motion. (For hero animation the same-plate-both-slots loop of §9.1 is the later, proven
exception, **for every state including the walk** — corrected 12 Sep 2026; the walk exception was
retired by Phil on 10 Sep, see §9.4.)

**Composer trap: uploading to a file input fills the END slot first.** To load START: clear both
images, then upload to the input belonging to the *"Upload Start Frame"* button. Swap-frames does
nothing while one slot is empty. Verify before Create: exactly one image container holding an image,
and it is the left-hand one.

**Verifying after the fact:** the history card carries the thumbnail of the image actually used —
fetch it and sample pixels. **Do not trust the panel layout: the history list stacks one job's prompt
directly above the next job's thumbnail**, which reads as if the wrong plate was used.

**Judging an FX result: frame 0 IS the plate.** Every FX thumbnail looks blank — that is normal, not a
failure. **Sample at 3–5 s.** A previous run was written off as "a column of blank clips" this way.

## 8.5 The FX background, and where a colour word must NOT be changed
Phil's written FX prompts all said "pure solid black background", but the composer is image-driven and
feeding a plate that contradicts the prompt is the likeliest reason an entire FX run returned blank.
**Phil ruled: the plate decides, and the prompt wording changes to match the plate.**
**The word for a colour REMAINS wherever it describes the EFFECT and not the background** — a
violet-black void needle, a black centre, a black-purple event horizon, black-red-gold cards.
**Those are Phil's descriptions of the art and must never be altered.**
Keying follows the plate: a magenta plate takes the magenta keyer, never the black-clip luma keyer.

# 9 · THE SEAMLESS LOOP, THE LOCKED TEMPLATES AND THE WALK  *(was §11)*
*Merged in whole from `16 - SEAMLESS LOOP RECIPE (7 Sep)` on 11 Sep 2026, per Phil: "condense all
documents into protocols". Every number here was measured on raw Hailuo output, no post-processing.*

> # ⛔ READ THIS BEFORE USING THIS CHAPTER — 16 Sep 2026
> **THE MECHANISM THIS CHAPTER IS BUILT ON WAS A HAILUO FEATURE.** §9.1's seamless loop came from
> putting **the same plate in both the Start Frame and End Frame slots**. **Grok Imagine has no
> Start/End Frame slot** — it takes one pasted image. **So the thing that CAUSED the loop to close
> is gone.**
>
> **And the measurement agrees.** The first accepted Imagine clip — Nerisse Bellglass's attack,
> which Phil passed — scores **frame 0 vs final frame IoU 0.748**, against **0.983** for her approved
> Hailuo walk and **0.982** for her approved idle. **It does not close.** (ch.1 §1.4.)
>
> **WHAT SURVIVES:** everything in this chapter about WHAT a good loop looks like, the out-and-back
> shape (§9.3), the third-arm rule (§9.2), the walk's phrasing (§9.4), the freeze/permission pairing
> (§9.4b) and NOTHING ON THE GROUND (§9.6). **WHAT DOES NOT:** any settings block naming Hailuo
> slots, credits or model versions — those are archived.
>
> **WHAT REPLACES IT IS NOT YET KNOWN.** The end-stance lock has to do in WORDS what the End Frame
> slot did structurally: *"She settles into exactly her opening stance on the final frame."*
> **Untested on Imagine.** Whoever fires the first clip carrying it writes the IoU in here.

## 9.1 The finding — one setting closed two problems
**The same plate in BOTH the Start Frame and End Frame slot, on Hailuo 2.0**, forces the model to
travel out and return to its own opening frame. That gives a genuine seamless loop, and **because the
last frame must match the first, the zoom cannot survive it.**

| measure | locked template | first loop clip | pass condition |
|---|---|---|---|
| figure height variation | **4 px** of 192 | 11 px of 192 | under 8 px |
| last-vs-first frame delta | **0.80x** adjacent | 0.87x | under 1.0x |
| top/left/right edge contact | **0** of 142 | 0 of 142 | 0 |
| mean adjacent-frame delta (motion) | **1.712** | — | above 0.55 |

A last-vs-first delta **below 1.0x** means the closing frame is closer to the opening frame than two
ordinary neighbours are. That is the pass condition for "seamless". **Constraining the hands did not
cost motion — it bought it.**

```
Hailuo 2.0 · Start/End Frame · 768p · 6s · 25 credits
Start Frame : the hero's concept-art plate
End Frame   : THE SAME PLATE, byte for byte
```
25 credits instead of 15, and worth it: **2.3-Fast has no End Frame support at all**, so it cannot do
this, and every 2.3-Fast attempt zoomed.

## 9.2 THE THIRD-ARM RULE — a flirt beat only goes to a limb that is FREE in the concept art
Sylthaine grew a **third arm** for a third of a clip. Both her hands are occupied in her concept art,
and the prompt told her to draw a hand up her waist. **The model will not drop a held object** — so it
generated a new arm and left the original anchored where the plate had it.

1. Before writing a hero's prompts, **check what each hand is holding in her concept art.** Once per
   hero, not once per clip.
2. A hand holding a weapon or object **keeps holding it** — say so explicitly.
3. If that hand is part of the flirt, it flirts **with the object** ("slides her hand down the
   staff"), never by letting go.
4. Both hands occupied → the flirt comes from **hips, back, chin, eyes, lips and hair.** Not a hand.
5. **State the limb count outright: "She has exactly two arms."**

## 9.3 The out-and-back prompt shape
Short, built as an out-and-back: she leaves her opening stance, does the beat, and **"settles into
exactly her opening stance on the final frame."** That clause is what makes the End Frame LAND
instead of cutting. **Never drop it.** No camera or shot-size vocabulary beyond the locked-off clause.

**Non-negotiables, in order:** background lock FIRST, never after the action · limb declaration plus
what each hand holds · beats only for free limbs · the settle clause · "head never turns away"
(without it she spends the loop turning her back) · "locked-off static camera, no zoom, no pan" and
nothing else camera-related.

> **SUPERSEDED IN PART:** the original template specified a **#FF00FF magenta** background and a
> ~600–780 char length. **The background is now GREEN (§2.3), and the working length is ~1750–1990
> chars** (`04 - PROMPT BIBLE` M3). The STRUCTURE above is what carried forward, not those two values.

## 9.4 THE WALK — the phrasing is live, THE SETTINGS BLOCK IS DEAD

> # ⚠ THE 15-CREDIT START-SLOT WALK IS DEAD. RETIRED BY PHIL, 10 SEP 2026.
> **Phil:** *"you should be using the 25 cost shouldnt you?"* · *"same way as zahri"*
>
> **FIRE THE WALK LIKE EVERY OTHER STATE — §1.3:**
> `Hailuo 2.0 · Start/End Frame · SAME PLATE IN BOTH SLOTS · 768p · 6s · 25 credits · wand OFF`
>
> **HOW THIS SECTION SURVIVED ITS OWN DEATH, and the lesson for every future merge.** It was killed
> on 10 Sep in the two documents that then owned it — `19 - THE WORKING RECIPE` and `01 - Hailuo
> Operating Manual` — with Phil's words written in as the reason. On 11 Sep those documents were
> merged into this protocol and **the dead rule came across while the DEAD marking did not.** The
> merge carried the corpse and dropped the death certificate. On 12 Sep it read as a live rule
> contradicting §1.3, and Phil was asked to arbitrate a question he had already answered.
> **WHEN MERGING: a retired rule is carried WITH its retirement, or it is not carried at all.**
>
> **And the worklog had it the whole time** — `CLAUDE WORKLOG/worklog archive/10SEP2026 0800-1130.md` records the
> retirement in his words. RULE 5.0: the worklog is the memory bank. **Read it before escalating a
> contradiction; the answer is usually already in it.**

**The evidence below is real and is why the phrasing rules exist — the SETTINGS are what died.**
Two 25-credit end-frame walks failed early on (a mincing shuffle, then a full 360 spin), and that led
to the 15-credit start-slot workaround. **The spin was a WORDING fault, not a settings fault** — the
cause was `"and she glances back on the downbeat before returning 3/4 RIGHT"`, a body-turn
instruction, and "walks in place" not being a stride instruction. Both are fixed by rules 1-4 and the
treadmill sentence below. Vireo settled it on 10 Sep: her 15-credit start-slot walk rotated for six
seconds and never took a stride, and her **25-credit dual-plate** take was approved outright —
*"this walk is perfect"*. **The end frame is what holds the facing.**

**The four phrasing rules, the step count and the treadmill sentence below are ALL STILL LIVE.**
Measured on the accepted walk: figure height spread **3 px** of 128 · **0** edge contact of 141 ·
motion per 10-frame block **1.61–2.70, no die-off** (the earlier walk decayed 3.0 → 0.75 with only 31
of 141 frames usable).

**The four phrases that had to be exactly right — every failed walk died on one of these:**

1. **NO RUNWAY VOCABULARY.** "Like a fashion model on a runway" makes her **pivot** — models walk
   *and turn*. With an End Frame it produced a clean 360 that scored 0.16x and was unusable.
   Never *runway*, *catwalk* or *model*.
2. **NEVER "her rear presented to anyone behind her."** Read literally as an instruction to rotate
   until her back faces camera. If the rear is wanted it comes from **arched lower back, tailbone up,
   pelvis drop at a FIXED angle** — never from turning her.
3. **THE TREADMILL DIRECTION MUST BE STATED.** "Walks on the spot" alone is 50/50 — slide the planted
   foot forward and she moonwalks. Required: *the planted foot slides BACKWARDS beneath her like a
   treadmill belt running backwards, while the other leg swings FORWARDS to its next heel strike; her
   body stays in one spot only because the ground moves under her, never because she steps backwards.*
4. **THE ANGLE MUST NAME BODY PARTS, NOT A DIRECTION.** "Turned away from the camera to her left"
   made her walk straight at the viewer. Name what the VIEWER SEES: which shoulder is nearer camera,
   which hip leads, where the face points.

**GIVE THE WALK A COUNT.** "SIX STEPS IN SIX SECONDS, ONE PER SECOND, UNBROKEN" plus
"LEFT, RIGHT, LEFT, RIGHT, LEFT, RIGHT — never the same leg twice" is what stops her settling into a
sway.
> **CORRECTED 11 Sep by the cowork thread (`04 - PROMPT BIBLE` N8):** drop the knee-lift ANGLE — "the
> 45-degree knee lift encourages the high-knee movement" seen in the round-4 walk. And **"both feet on
> the floor" contradicts alternating swing phases** — use "remains full body at the reference scale".

## 9.4b ⛔ A PROP LOCK FREEZES THE ARMS, AND A FACING LOCK FREEZES THE HEAD. GIVE BOTH SOMETHING TO DO. 13 Sep 2026.

**Phil, 13 Sep 2026, on Nerisse's walk:**
> ***"also do something to make her body move naturally, her arms and head stays completely still,
> she is robotic"***

**HE IS DESCRIBING A SIDE EFFECT OF OUR OWN LOCKS, NOT A MODEL FAILURE.** Two of the locks every
prompt carries are written as NEGATIVES, and a negative with nothing positive beside it is read as
*hold still*:

| lock | what it says | what the model hears |
|---|---|---|
| the PROP lock | *"the sceptre gripped in one hand, the orb floating above her other palm, never released or swapped"* | **both arms are pinned.** Nothing in the prompt ever tells them to move, so they do not |
| the FACING lock | *"she never rotates or turns"* | **the head is pinned.** Same silence, same result |

**So the figure walks from the waist down and is a statue from the waist up.** On a hero whose hands
are BOTH occupied this is guaranteed — she cannot be given the ordinary arm swing, because §6.1
already bans the geometry (*"her arms swing beside her opposite the legs"* produced a marching swing,
F17) and both hands are full anyway.

**THE FIX — pair every freeze with a permission, in the SAME sentence, riding the gait:**

```
...never released; her shoulders and arms ride the gait, elbows soft, both props travelling with
her body.
```
```
Her head settles with each step, holding that same LEFT angle; she never rotates or turns.
```

**WHY THIS SHAPE AND NOT ANOTHER:**

1. **The permission is in the same sentence as the restriction**, which is the form §6.1 already
   proved safe for the head — *"the settle rides the gait; the angle is named in the SAME sentence,
   which is what keeps it safe."* Split them and the permission becomes a competing instruction.
2. **It names the QUALITY of the linkage, never the counter-rotation geometry** (§6.1, F17).
   *Ride the gait · elbows soft · props travelling with her body* describes carried weight, not a
   swing angle.
3. **`settles` is doing the same job it does in the proven Vex walk** — a settle is gait-borne, so
   it cannot fire independently of the steps and become a head-turn.
4. **Nothing new is un-pinned.** The props still never leave the hands; the facing still never
   rotates. **The restriction is unchanged — only the silence around it was filled.**

**THE GENERAL RULE, and it applies to every state, not just the walk:**
**AFTER WRITING THE LOCKS, READ THE PROMPT BACK AND ASK WHAT IS ALLOWED TO MOVE.** If a body part is
named only in a negative, it will be still. **A prompt made entirely of locks produces a mannequin
that walks.**

### 9.5a THE CATWALK — the word is not the mechanic. Write the MECHANIC.
**Phil defined it:** *"Catwalk is a sexy deliberate one foot over the other walk that is intended for
a women to make one ass cheek push out at a time showing off their assets."*

**Do not write the word "catwalk"** — it is a fashion-show reference and buys a runway, a camera and a
strut. **Write the three mechanics it decomposes into**, which is what shipped:

> `Each foot lands in front of the other on one line; her hips swing so one side of her rear pushes`
> `out each step. Heel first, rolling through the sole.`

paired with the schedule sentence carrying the pace word:

> `FOUR STEPS IN SIX SECONDS, deliberate and unhurried - LEFT, RIGHT, LEFT, RIGHT.`

**MEASURED RESULT:** cx oscillates 22.2 px, four times, with no net drift — the hip sway is real,
periodic and lands exactly on the step count. **It must NOT be corrected with an `ax` array at wire
time; `ax` exists to cancel WANDER, and cancelling this would delete the feature.** Tell them apart
by the END of the series: sway returns to its start (this clip closed at 6.0 px), wander does not
(the superseded v21 walk ended at +23.6).

### 9.5b UNHURRIED IS BOUGHT TWICE — IN THE PROMPT AND AT WIRE TIME.
**Phil:** *"unhurried is important because it add a lack of urgency in her movement"* · *"Women that
are not 'rushed' come off as sexy to humans women in a rush seem frantic and nuts."*

The prompt buys the CADENCE (four steps in six seconds). **The engine replays it at whatever rate the
row says, and that rate is a SEPARATE CREATIVE CHOICE — it is not a fidelity setting.**

**Vex's walk is wired at `fps:12`** (4.0 s, one step per second). Phil, choosing it off a five-rate
comparison: ***"fps 12 is perfect"*** — and, decisively, ***"for this walk."***

> ### THE RATE IS PICKED BY EYE, PER CLIP. DO NOT DERIVE IT.
> Claude first reasoned its way to 12 from the SOURCE CADENCE — 48 frames at 24 fps replays a
> 5.9-second clip in 2.0 s, therefore "3x too fast." **That arithmetic reached the right number by
> the wrong route, and the wrong route is the dangerous part.**
>
> **Phil:** *"faster doesnt always mean too fast, shes doing a skip here, which is a sexy jog walk."*
>
> **The frames do not change with the rate — the GAIT does.** At 24 the foot-over-foot crossover
> compresses into a bounce and reads as a SKIP: a real, deliberate, desirable gait that happens to
> be a legitimate choice for some character. It is not a broken walk. **"Faster than the source" is
> therefore NOT a defect and must never be reported as one.**
>
> **THE RULE: build the comparison, let Phil pick.** Render the same sheet at 24 / 20 / 15 / 12 / 10
> side by side, labelled, as one mp4 (he is phone-first) and ask. It costs no credits and no re-slice.
> **Never wire a rate on a calculation, and never carry one hero's rate to another** — "for this
> walk" means exactly that.

**Rates must divide the 60 fps render evenly** (24 does not: 60/24 = 2.5, hence `cs10.py`'s 2/3/2/3
stepping comment). Clean rates, and what 48 frames of a four-step walk become:

| fps | cycle | steps/sec | gait it produces |
|---|---|---|---|
| 24 | 2.00 s | 2.00 | **a SKIP — "sexy jog walk"** |
| 20 | 2.40 s | 1.67 | quick walk |
| 15 | 3.20 s | 1.25 | steady walk |
| **12** | **4.00 s** | **1.00** | **deliberate catwalk — WIRED for Vex** |
| 10 | 4.80 s | 0.83 | languid |

**There is only ONE walk row per hero**, so the chosen rate is how she reads everywhere the walk
plays. Pick it on character, not on any single moment.

**`cs10.py`'s reported `fps: 30` is a hard-coded placeholder** (`fps = {}.get(state, 30)`, and that
dict is empty) — it is never a measurement. See `GOTCHAS/09 - GOTCHAS - running log of problems and fixes.md` 12 Sep §3.


## 9.6 NOTHING ON THE GROUND
A walk flourish ("frost blooms under each heel") grew a white floor patch that would have sliced into
the sheet as a smear under her feet. **Any flourish that touches the ground is illegal.** Every
prompt carries: *Nothing on the ground: no marks, no shadow, no ground line.*

## 9.9 — ARCHIVED. The composer traps and the watermark-free download were HAILUO's.

Moved 16 Sep 2026 to `ARCHIVED INFORMATION (Hailuo era)/01 - HAILUO - the fire card, the
composer, the traps.md`. **Grok Imagine is the source of all art now (ch.1).** Its own composer
traps go in ch.1 §1.6 as they are found — do not re-derive them from the Hailuo ones.

## 9.10 Facing — and the standing exception
The 7 Sep rule was **all women, all states, 3/4 RIGHT** (screen-right, the direction of travel) so the
sheet mirrors from one source facing; art facing RIGHT means `flip:false`.
> **Phil overrode this for Vex on 11 Sep** with a rear-presentation plate — torso rear three-quarter,
> head over the shoulder toward image-**left**. **Per-hero plate orientation beats the roster default;
> read the plate, never assume the default** (`04 - PROMPT BIBLE` N2).


---

# 10 · FLAGGED — heroes held back for rework. Do not touch them.  *(was §14)*

*Merged 12 Sep 2026 from doc 16. It governs which heroes art work may touch, which is this protocol's subject (RULE 4.5).*


## FLAGGED — heroes held back for REWORK. Do not touch them.

**Phil, 10 Sep:** *"flagged heroes dont touch them just save them for later we need to rework them"*

These are excluded from the Rule 2 recut pass and from any slicing work until Phil says otherwise.
They are here because the problem is in the CLIP, not the cut — re-slicing cannot fix them and
would only bake the defect in at a new number.

---

#### 0 · THE FUTURE PROJECT LIST — after the females (Phil, 11 Sep 2026)

**Phil: *"fritz, bloatus, kunwu are on future project list after females"*.**

Found by the 11 Sep animation-priority-ladder audit (`03.1 - ART LESSONS LEARNED` §3.0, item 1):

| hero | what is missing | what happens now |
|---|---|---|
| **Fritz** | **no green and no blue sheet.** States are idle / walk / attack / hit / ult only. | Storm Surge and Chain Lightning both fall back to the ATTACK clip with a cast-flash stand-in. |
| **King Bloatus** | **no green and no blue sheet.** Same five states. | Toxic Breath and Swampcall both play his attack animation. His ult clip is also 4.76 s, second longest on the roster. |
| **KonWu** | green and blue exist (1.60 s each) — **no passive clip.** | Adamant Discipline has no visible animation. |

All three also appear in section A below as held down by one loose clip, so a rework covers both
problems in one pass. **Order: the remaining women first, then these three.**

Also passive-clip-less, not flagged for rework: Oakmir, The Annotator, Umbris, Vael. 39 of 46 heroes
have a passive clip.

---

#### 0b · FAIL THE SCALE GATE — states cut at different sizes (11 Sep audit)

**Scale before anchor** (Phil, 11 Sep: *"you have to scale before you can anchor"*). These six have
states cut at different scales, so their anchor numbers carry no information until the cut is fixed.
The engine normalises by `figH` so they render at the right SIZE — the visible defect is SHARPNESS:
the hero changes quality mid-fight.

| hero | spread | weakest | strongest | note |
|---|---|---|---|---|
| **Umbris** | **3.02x** | hit 147 | ult 444 | **caused 11 Sep** — his three new casts were cut at 444 against old states at 147-301. Also section B (camera zoom in the old ult art). |
| **KonWu** | 2.67x | walk 150 | idle 400 | also the only structural gap on the roster: **`walk` has no `top`**. On the future project list. |
| **Hollow** | 2.03x | drop 254 | walk 516 | also section A (ult is his binding clip). |
| **Vael** | 1.77x | idle 120 | ult 213 | |
| Oakmir | 1.28x | green 205 | hit 263 | |
| Rhukk | 1.27x | hit 162 | blue 205 | |

**The other 40 heroes pass scale** — every state at exactly one number (400 men / 500 women /
596 Vireo) — **and all 40 pass anchor**: `figH`, `feet`, `cx`, `top` present on every state, all
within cell bounds, nobody on the legacy no-`figH` path, no legacy `sc:` multipliers left anywhere.

**Fix at the CUT — re-slice or re-shoot the state that is out of family. Never edit anchor numbers
to compensate.**

---

#### 0c · FAILED BOTH TESTS — rework after the females (Phil, 11 Sep)

**Phil: *"note all of these heroes for rework after females. the ones that failed both tests"*.**

Failed the **ladder** check (§5.0 item 1) AND the **scale** check (item 2):

| hero | ladder failure | scale failure |
|---|---|---|
| **Umbris** | casts lock 5.3-5.8 s = **83-89% of cooldown**; no passive clip | **3.02x** — hit 147 vs the new casts at 444 |
| **KonWu** | no passive clip | **2.67x** — walk 150 vs idle 400; `walk` is also the roster's only missing `top` |
| **Vael** | no passive clip | **1.77x** — idle 120 vs ult 213 |
| **Oakmir** | no passive clip | **1.28x** — green 205 vs hit 263 |
| **Rhukk** | **his walk does not walk** — see below (Phil, 19 Sep) | scale, §0b |

**Rhukk — added to the remake list 19 Sep 2026.** Phil: *"rhukk doesnt walk"* → *"infact instead of
arguing / show me his walk / in animation"* → *"ok put rhukk on the remake list"*.

I first checked the sheet for duplicate cells, found all 30 distinct, and argued the sheet was fine.
That check was worthless — distinct pixels do not mean a walk. Extracting and playing the frames
showed what Phil saw: **he hovers.** Measured across all 30 walk frames:

- **body centre x = 114 in every single frame** — the torso never travels, so there is no stride
- **feet range 199 → 202** — the feet move **3 px** in the whole cycle
- **30 frames @ 30 fps**, against the roster's usual 12 @ 10–14 — the sheet spends four times the
  frames of a normal walk saying nothing

So it is an **art defect, not a code one**: no anchor, fps or slice change can put a stride into a
sheet that has none. The `walk` sheet needs re-shooting with actual leg travel.

**His feet are NOT clipped** (checked 19 Sep after Phil: *"i see in some of his sprite sheets hes
missing his feet"*). All eight sheets measured — every declared `feet` line is correct and every
figure's lowest opaque pixel sits **1–2 px above** it, with no frame clipped at the frame edge and
no frame whose lower band collapses. Whatever Phil is seeing is not a crop in these sheets; the
specific sheet and frame still need to be pointed at.

Failed ONE test only, already listed above: Fritz and King Bloatus (ladder — no green/blue sheets,
§0) · Hollow (scale, §0b) · The Annotator (no passive clip only).

---

#### 0d · ABILITY vs DESCRIPTION — the 11 Sep pass

Checked every hero's live behaviour against the shipped description text and, for the 20 heroes in
`KIT REWRITE`, against Phil's design packs.

**Behaviour does not match the description:**

| hero | ability | the description says | the code does |
|---|---|---|---|
| **Vireo** | Grand Symphony | "heals the whole team and damages every foe" | was an **8 m radius**. *Rewritten 11 Sep to no range at all, 30% of ability power each way — NOT YET DEPLOYED.* |
| **Oakmir** | First Spring | "instantly healing **the whole team**" | heals allies within **20 m of the aimed ally** only. Back row sits at 25 m. |

**Verified NOT a mismatch** (checked rather than assumed): Aureth's Eclipse — its ally shield loop has
no distance check, so "shields the whole team" is true; the 6 m radius gates only the enemy damage.

**Text and data gaps:**

- **Zahri Sunhorn — Noonday Stampede has NO description text at all.** `stampede` is missing from `ULT_DESC`.
- **Veyr Manta-Born — her ult description names "Void Weaver"**, not Veyr.
- **Chainwheel Gladiator — the passive has no name.** The pack calls it "Pride's Momentum".
- **Silkcoil — has a KITS row but is not in `HERO_TYPES`.** Abilities defined, hero not playable.
- **Fritz — no KITS row at all.**

**Role still differs from the design pack (4):** Greatbrow pack Support / live Tank · Lysara Moonveil
pack Support / live Mage · Nerisse Bellglass pack Mage / live Support · Nox Quillfinger pack Support
/ live Assassin. **Role sets the combat ROW and the swing interval**, so these change how the hero
plays. They may be deliberate changes made since 7 Sep — **ask Phil before touching them.**

**The good news:** of the 20 heroes the 7 Sep `KIT REWRITE` found wrong in every slot, **16 now match
their packs exactly** — ability names, passive names and ult names. v527-v528 did its job.

---

#### A · Held down by one loose clip
One badly-framed animation is setting the hero's whole standard under Rule 2. Re-firing that ONE
clip on a tighter plate raises the hero to the next-lowest ceiling. Detail measured native from
the archive clips, no credits spent.

| Hero | standard | best state carries | binding animation | gap |
|---|---|---|---|---|
| Fritz | 111 | **513** | idle | 4.6x |
| King Bloatus | 214 | **704** | idle | 3.3x |
| The Beekeeper King | 203 | 475 | ability1 — Hornet Cloud | 2.3x |
| Dawnbringer | 182 | 464 | idle | 2.5x |
| Korvux | 137 | 315 | walk | 2.3x |
| Hollow | 136 | 314 | ultimate — Vanishing Point | 2.3x |
| Kharos Bloomknife | 132 | 291 | idle | 2.2x |
| Gruel | 143 | 274 | ultimate — The Reckoning | 1.9x |

#### B · Camera zoom baked into the clip
The character grows DURING the animation, so no `figH` value renders him stable. Needs a reshoot.

- **Umbris — ultimate.** Frames run 155 -> 198 px, he grows 28% mid-clip.
- **Zahri Sunhorn — passive.** Figure grows 599 -> 723 px (recorded in the female tracker, 9 Sep).

#### C · Wrong art still wired
- **Boar Shaman — `hit`.** Still the retired art. `rise` was remade 10 Sep (v562); `hit` was not.

---

#### MEASUREMENT WARNING — why this list is short

Phil, 10 Sep: *"I believe you are being tricked because some of these have animations with spell FX
in them."* He is right, and it invalidated a first pass at this list.

The alpha bounding box is NOT the character. It also contains spell FX, capes, cloaks and staves,
so a state with a big effect reads as a taller "figure" and looks like a scale bug when nothing is
wrong. Umbris was diagnosed wrongly twice this way — first on head width (it measured his white
cloak, not his skull), then on bbox height (it measured his FX).

**Use a proxy the FX cannot inflate.** For Umbris that was the square root of the BLACK BODY AREA
(luminance < 70, largest connected component, cloak and FX excluded), normalised to a state known
to be correct. Validated before trusting it: it reproduced the wired `figH` within 5% on six of
his seven states and flagged only the one that was genuinely wrong.

Never add a hero to this list off a bounding-box measurement alone.

# 11 · THE TRAP INDEX — one line each, for scanning  *(was §10)*
- **3 Oct:** a `disc` FX2 plate lies flat on the floor - stand clouds up with `upright` (ch.14) · test with the real cast, not a hand-built object (ch.14.1) · a chroma key loses glow - cut glowing effects by brightness (ch.14.3).

| trap | section |
|---|---|
| Composer built on the create page; Create is dead | 1.1 |
| `execCommand` fills the DOM and sends nothing | 1.4 |
| Programmatic `.click()` on Create no-ops | 1.4 |
| `zoom` on a Hailuo tab wedges the viewport permanently — **ARCHIVED, Hailuo** | `ARCHIVED INFORMATION (Hailuo era)/01` |
| Wand resets to ON after every reload | 1.1 |
| Upload into a full composer lands in the wrong slot | 1.1 |
| Paste cut at ~1040 chars though the counter says /2000 | 1.4 |
| One Create in a batch fired six generations | 1.4 |
| Home composer has no wand — SOLVED, use Recreate onto the create page | 1.6 |
| Home is now the H3 composer; the §1.1 chip route is gone | 1.6 |
| Paste is cut at ~1040; TYPED text goes in whole at 1,977 | 1.4 |
| Claude wrote the prompts; "these are horrible" | 2.1 |
| Trimming a lock to fit the cap lost a staff and a costume | 2.3 |
| Stacked prohibitions produced random spasms | 2.4 |
| "Continuous motion" is false for casts | 2.4 |
| A gesture that will not happen needs an END PLATE | 2.5 |
| The end plate deletes anything missing from it | 2.5a |
| A diff inside the expected box is not proof | 2.5b |
| The plate POSE is an instruction — a hover plate animates hovering | 3.4 |
| Plate colour must be measured against the FX, not just the hero | 3.3 |
| Tighter plate = more detail = rejected; 58% is headroom | 3.2 |
| The block in a strike state produces dancing, not a strike | 4.5 |
| Presentation branch: big rear = hips to camera, big bust = front-on. Hold what does not move or you buy a 360 spin | 4.4b |
| Expression direction stacked on the block = cartoon faces | 4.6 |
| `pad=6` crops the cell too tight | 5.2 |
| Despill is tuned for magenta, under-cleans green | 5.4 |
| The magenta test eats violet heroes | 5.4 |
| Measured the array, shipped the old file | 5.7 |
| px = DETAIL, never `figH` | 6.1 |
| Bounding-box height makes a crouch look smaller | 6.3 |
| Five metrics that confidently passed broken work | 6.5 |
| `ax` smoothing window must be one full gait cycle | 5.6 |
| A ground-level tail becomes the "foot centre" | 5.6 |
| Flip guessed from a thumbnail — five units reverted | 7.3 |
| Zoom cannot add detail; only `zoomPR` can | 8.1 |
| Bumping `?v=` before the deploy lands poisons the URL | 8.4 |
| A deploy check is not a fix check | 8.5 |


---

# 12 · GROK IMAGINE — folded into ch.1

**Grok Imagine is no longer 'the spell-FX generator'. It is THE SOURCE OF ALL ART**, so its
chapter is ch.1 and covers character animation and FX together. The direct-image-paste route,
the submission lock and the continuity receipt all live there now.

The 16 Sep 43-sheet class-A deployment note has moved to ch.5 §5.12's neighbourhood — it is a
wiring record, not a composer one.

---

# 13 · HERO CARDS, ASCENSION BORDERS AND RARITY BANNERS — 18 Sep 2026 (Phil's standard)

## 13.1 The hero card standard
- **Shape:** square. One card size everywhere (roster, squad icons, loading screen), mythical or not.
- **Framing:** *"from halfway down their thigh, to the top of their head"*, **centred**. The top of the head sits a little below the top edge.
- **Source:** a NEW Hailuo painting made from the hero's CURRENT concept art (`Game Art/Heroes/<Name>/<Name> - static.png`), with a new painted background.
  - Settings: 1:1, High, 1K, GPT Image 2, one image reference.
  - The prompt is in `04 - PROMPT BIBLE`, "Hero card (from concept art)".
  - Front view by default; Vex keeps her back view (Phil: *"do the first vex art"*).
- **Files:**
  - Game: `assets/img/hero-cards/card-<key>.webp` (512 px; bump the `?v=` on `HERO_CARD_ART.<key>` every time).
  - Archive: ADD `<Name> - hero card (Hailuo DD Mon YYYY).png` to the hero's folder. **Never delete or overwrite anything in a concept-art folder** (Phil).
- **Checking:** check every result by eye before installing. Task order can't be trusted (see 09 GOTCHAS, Hailuo batch work).

## 13.2 Ascension borders (one painted border per step)
- **Tiers:** *"Basic is flat, +1 a nice trim, +2 a trim and wave"*; +3 and +4 get progressively richer jewellery set into the border. Orange and Orange ★ are the top. +5 comes later, when the Orange threshold and the hero cap go to 120.
- **Made as:** Hailuo 1:1 square borders with a flat black window, processed by `procframe2.py`: flood-fill cut-out (erode first), rounded corners, 720×720, slices measured at the plain border.
- **Drawn as:** a CSS `border-image` with `fill`. Bump `ASC_FRAME_V` when a file changes.
- **No overlays:** no studs or code-drawn ornaments (Phil rejected them).

## 13.3 Rarity banners
- **Rarity:** Common (grey, 1★ starters), Uncommon (green, 2★), Rare (blue, 3★), Mythical (the flashiest).
- **Versions:** each has a word version (`<r>-word.webp`) and a blank version (`<r>.webp`) that carries the hero's name.
- **On a card:** the name banner sits on the border's bottom edge with the stars on top of it, and it's part of the loading-screen load-in.
- **The word "Mythical"** appears only in the hero detail view, never on the card itself.


**Painted node maps (25 Sep 2026, The Starless Well).** When a background paints the nodes a screen puts squares on (platforms,
islands, stones), the node centres are MEASURED from the delivered image (connected components or by hand), recorded in code with
the image size they came from, and checked on every palette variant - never laid out on a guessed grid. The layout follows the art
(Well: 7 top / 6 middle / 6 bottom platforms), and art that cannot hold a UI element (Phil: portals, "There isnt enough space") moves
the element to an overlay rather than squeezing it in.

---

# 14 · SEE IT IN GAME BEFORE IT SHIPS — 3 Oct 2026 (Phil: "did you even look at the ult before you put it in")

**RULE: no art, FX or animation change is shipped from sheet frames alone.** Render it in a real battle on the release's own file and look at
the frames; show Phil in-game frames, not sheet strips. Sheet frames say nothing about placement (`disc` lays a plate flat, `upright` stands
it), size against the heroes, what draws over it, or whether it ever fires.

## 14.1 The rig (worked 3 Oct, `.claude/launch.json` "fritz-ult-rig")
1. `node server.js` from the release worktree with a temp `DB_FILE` and `NODE_PATH` pointing at a worktree that has node_modules; open
   `/emberweave-heroes.html` in the browser pane.
2. Landscape: emulate 844x390 (a portrait pane shows `rotateGate`); hide `#rotateGate`; skip the tutorial; remove `body.gated`.
3. Take the frame clock: `window.requestAnimationFrame=()=>0` (the hidden pane throttles it) and step `loop(t)` by hand, t += 16.7 ms.
4. Fight: `CUR={mode:'arena',local:true}`; `await preloadBattleArtFull(keys,BATTLE_BG,...)`; `_startVersusNow([{key,lvl}...], true, [allyKeys])`.
5. Skills unlock by ability tier: set `RUNE2.st.boards[key].ascensionIndex` (15 = top) BEFORE the fight, or set `u.greenAb` / `u.blueAb` on
   the unit. Cast for real: `castKit(u, KITS[key].green|blue)`, `castAbility(u)` (ult) - or let the AI cast and log `castKit` / `doEffect`.
6. Capture: `renderer.render(scene,camera)`, `drawImage` the WebGL canvas and then `#overlay` onto one canvas, POST the jpeg to a local
   receiver (a short python http.server) and read the files. Crop and enlarge around the unit.
7. Measure, don't eyeball, when the claim is geometric (badge gap, sizes): project mesh bounds with `camera` and print them.
8. Always cast the REAL trigger (the hero's own ability) at least once - a hand-built object only tests the path you edited.

## 14.2 Effect systems added 3 Oct (blueprint 18)
- **Buff badges stack** (`updateGroundFx`): per unit the newest badge takes the top place; a new one starts one badge-height above the old
  one and both slide down over 1 s, the old pushed out shrinking and fading. Every path that sets `_fxAboveBar` must also set
  `followAbove` / `aboveOff` or its badges will not join (v953).
- **Lightning bolt** (`spawnBoltFx(a,b,color)`): a glowing 12-frame bolt stretched chest to chest between two units, 0.4 s. Sheet
  `assets/anim/fritz/fritz_chainbolt.webp`. Any hero can use it.
- **Effects after a fight** (v959): the visual-only updaters run on after `ended`; a new effect list goes into `clearFx2`, `battleFxReset`
  AND the ended branch of `loop()`.

## 14.3 Cutting a GLOWING effect from a green or magenta clip (3 Oct, Fritz's chain bolt)
A chroma key throws the glow away (the old `fritz_chainfx` came out thin and grey). For an additive effect make alpha from BRIGHTNESS above
the key instead: alpha = clamp((min(R,B) - ~75) / 180) on a green screen (the key's own channels stay low), colour = a pale tint times alpha,
drawn with additive blending. Crop away watermark rows first (KlingAI marks sit bottom-right).

## 14.4 Sizes Phil set on 3 Oct
Vireo ult `upSize` 14 -> 3 ("massive"); Vireo green `upSize` 1.16 -> 0.81 ("reduce by 30%"); Fritz Thunder Shower = the ORIGINAL v489
sheet, upright, `upSize` 4.0, `upAnchor [0.5,0.2]`, dur/gdur 3.0 ("use the original ult effect" / "v489 ult").
