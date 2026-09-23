# HEARTBEAT CONTINUITY — cross-run memory for the Emberweave Brain self-improvement heartbeat

Phil's ruling (22 Sep 2026, ~00:12): "Every 5 minutes you wake yourself up. If Emberweave Brain
is not as smart as you, your work isn't done, she needs to be on your level of realization."

## Baseline (state as of first wake, 22 Sep ~00:15 ET)
- Index rebuilt and healthy: 23,485 chunks, embeddings.npy rows == chunks, hybrid scores 0.9-1.1.
- Verification battery passing: gold+2 6/6 (Gigas/Tartarus/Cerberus/Tartarus/Boreas/Ullr),
  purple+2 follow-up 6/6 (Colossus/Unfallen Crown/Carnage/Unfallen Crown/Blurwalk/Unerring),
  emberdraft design doc rank #1, remember:/plan: work, vision endpoint works.
- beats.json restarts: 0 (watcher heartbeat.py running, 15s beats, relaunches after 2 misses).
- Two index corruptions on 21 Sep fixed (CRC + savez tmp-name). Watch: any future rebuild must
  end with rows == chunks and a successful cache save (name embed_cache.tmp.npz).

## Next candidates (highest value first)
1. Mid-conversation learning: when Phil corrects her in plain chat (no remember: prefix), she
   should offer/detect and store a teaching — currently only explicit remember: works.
2. Retrieval honesty pass: probe 10 random archive questions, measure citation precision;
   tune rare-token bonus if top hits are wrong-file.
3. avg match trend: log per-question top_score to a scores.jsonl so self-improvement is measured,
   not felt.
4. plan: mode should validate cited paths against the index before emitting (stale-path class
   of bug — one teaching patch exists, structural fix is better).

## Log (newest last)

## 22 Sep 2026 ~00:33 ET — index repaired + singleton guard shipped
- HEALTH: found split-brain wreckage: chunks.jsonl 23492 but embeddings.npy 23485,
  orphaned embed_cache.tmp.npz (two concurrent reindexes had collided on os.replace).
- REPAIR: validated tmp cache (23492 rows, hash-aligned with chunks.jsonl, normalized),
  installed it as embed_cache.npz + rewrote embeddings.npy. All three now 23492.
- SHIPPED: singleton guard in app.py main() — held UDP bind on 127.0.0.1:7779;
  second instance exits instantly. (Failed attempts this wake: msvcrt byte-lock and
  CreateFileW share=NONE — both unreliable in this env; UDP bind verified blocked
  for second binder, WinError 10048.) TCP SO_REUSEADDR lets two servers share 7777
  on Windows, which is what allowed the original split-brain.
- INSIGHT: venv pythonw.exe is a redirector stub that spawns the daimon-bundle
  pythonw as a CHILD — a stub+child pair is ONE logical engine, not a duplicate.
  Electron shell also spawns its own engine+watcher; guard now arbitrates.
- VERIFIED: probe A gold+2 = 6/6 (Gigas/Tartarus x2/Cerberus/Boreas/Ullr, score 1.138);
  probe B reset->gold->purple+2 = 6/6 (Colossus/Unfallen x2/Carnage/Blurwalk/Unerring,
  score 0.919); npy rows 23492 == status chunks 23492. Watcher alive, restarts 0.
- WATCH: two heartbeat.py watchers were running (Electron's + mine); harmless pings
  but both relaunch on silence — guard absorbs the extra engine. Consider teaching
  Electron/main.js to not spawn a duplicate, or make heartbeat.py singleton too.
- Next candidates unchanged: mid-conversation learning, retrieval honesty probe set,
  score trend logging (scores.jsonl), plan: path validation.

## 22 Sep 2026 ~00:36 ET — score trend logging (pending restart)
- HEALTH: engine up 23492 chunks, uptime 0.3m at check (Electron/watcher booted her
  ~00:34, restarts still 0, misses 0). npy rows 23492 == chunks 23492. Healthy.
- SHIPPED (pending restart by watcher/owner, per OWNERSHIP): app.py now appends
  every scored question to scores.jsonl ({t, mode, q[:80], score}) right where
  avg_score updates - self-improvement becomes measured, not felt.
- VERIFIED: ast.parse OK; logging block standalone-tested (line parses as JSON);
  index rows match. Engine not restarted by me; feature goes live on next boot.
- NOTE: two watchers may still coexist (Electron's + canonical) - harmless while
  the UDP 7779 singleton guard holds; dedupe stays a candidate.
- Next candidates: mid-conversation learning without remember: prefix; citation
  precision sweep (10 probes); plan: stale-path validation; watcher dedupe.

## 00:47 correction — the "duplicate chaos" was mostly an illusion
The daimon-share pythonw.exe is a WRAPPER: every launch spawns a same-second twin running the
real interpreter (daimon-bundle cpython-3.12 pythonw) with identical args. Apparent "duplicate
engines" in process lists were wrapper+twin pairs of ONE logical process. Real facts: app.py's
UDP-7779 singleton + TCP fail-fast keep exactly one engine; heartbeat.py's lock keeps one
watcher. Phil's "Failed to fetch" was engine-restart gaps (boot takes ~35s: 311MB chunks +
72MB embeddings), not missing archive access. Prompt now forbids runs from touching processes;
watcher owns revival. beats.json restarts:0, misses:0 as of 00:40.

## 22 Sep 2026 ~00:48 ET — correction-detection bridge (pending restart)
- HEALTH: engine up 23492 chunks, uptime 8m, questions 0, beats misses 0 restarts 0.
  scores.jsonl not yet created (no scored questions since logging shipped) - expected.
- SHIPPED (pending restart by watcher/owner): brain.py CORRECTION_PAT + CORRECTION_NUDGE.
  When Phil's message opens with a correction ("no,", "that's wrong", "actually...",
  "you're wrong", "not quite"), ask() appends an honest one-line offer of the
  remember: bridge. Closes candidate #1 (mid-conversation learning) in the only
  honest way available to a stateless engine: recognize the moment, route to
  teachings. SELF_KNOWLEDGE already promises this behavior - now the UI delivers it.
- VERIFIED: ast.parse OK; unit test via import brain (no server): 9/9 correction
  phrasings detected incl. "No." and "no, ..."; 0/7 false positives incl.
  "nocturne skills" and "nova's kit?".
- Next candidates: citation precision sweep (10 brain.search probes, no restart
  needed); plan: stale-path validation; watcher dedupe (two watchers coexist).

## 22 Sep 2026 ~00:53 ET — citation precision sweep (measurement, no code change)
- HEALTH: engine up 13m, 23492 chunks, questions 0, watcher misses 0 restarts 0.
  scores.jsonl still pending first post-restart question. Healthy.
- DID: 10-probe retrieval sweep via brain.search() (no server). Filename-token
  proxy: 4/10 top-1 hits were the subject-named file. BUT top-1 is the wrong
  lens: file-ranking sends 8 files into context, and depth check shows the
  right design file is present even on "misses" - GLYPH ENCYCLOPEDIA in the
  gold+2 context (battery answers 6/6 from it), 10 - Arena.md in the arena
  context. Worklogs (date-named) often win top-1 but don't displace design docs.
- REAL WEAK SPOT FOUND: queries whose tokens are all common ("campaign chapter 3
  boss") produce ZERO rare tokens -> no bonus -> drift (top: CLAUDE and CHATGPT.md,
  score 0.699). Candidate: when no rare token exists, fall back to bigram/tier
  signal or lower the idf threshold dynamically (e.g. top-2 idf tokens of query).
- NOT SHIPPED: no tuning - the sweep shows context-level precision is sound;
  only the no-rare-token class needs a fix. That fix is next wake's candidate.
- Next candidates: no-rare-token fallback boost; plan: stale-path validation;
  watcher dedupe (two watchers coexist, harmless while UDP guard holds).

## 01:05 - SCOPE RULING (Phil): whole archive is her mind
Phil: 'every document down to the last MD is hers to memorize' after she told him blueprints
were 'not on her list'. Retrieval was never the problem (Watch Tower ranks #1 at 1.03) - her
SELF-KNOWLEDGE scope wording was. Fix: SELF_KNOWLEDGE now names all 10 child folders explicitly
and states the no-list doctrine; ruling also stored in teachings.jsonl. Verified via /api/ask:
meta question -> 'the whole archive is my mind' [SELF-KNOWLEDGE]; blueprint Q -> cited answer.
Engine restarted 01:03. Queue item 0 records this; keep the wording.

## 22 Sep 2026 ~01:14 ET — queue drain: items 1-5
- HEALTH: engine up ~10m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
- [x] item 1: probes.json + probe.py regression suite shipped. 12 probes (11 graded +
  1 informational no-rare-token). First run 11/11 PASS (gold+2 1.138, purple+2 0.919,
  all expected files in context, all facts present). This is the safety net for all
  future retrieval tuning.
- [x] item 2: correction bridge (shipped 00:48, live since 01:03 restart) verified
  wired: server-free ask() test shows nudge on correction, clean on normal question.
  Added item 2b (STORE half: confirm-and-store flow) to queue - offer-only for now.
- [x] item 3: precision sweep = probe suite first run: 11/11 expected files in context.
  Context-level precision 100%; top-1 filename proxy ~40% is absorbed by design.
- [x] item 4: scores.jsonl confirmed LIVE - first real entry 01:01:14 (watch tower
  blueprint, score 1.034). Trend measurement is now real.
- [x] item 5: _search_q carries rare tokens from last 3 turns (was: previous turn only).
  Verified: 2-turn-back 'greatbrow' resolves 'and his runes?'; probe.py 11/11 after.
  Pending restart to go live.
- Queue now opens at item 6 (multi-hop compare mode). UNTOUCHED weak spot (by design,
  informational probe): no-rare-token queries drift (score 0.699) - candidate fix:
  dynamic idf fallback when no token clears 4.0.

## 22 Sep 2026 ~01:30 ET — queue drain: items 2b + 6
- HEALTH: engine up ~25m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
- [x] 2b (yes-to-store): correction nudge now says "say yes and I'll store it";
  app.py arms _pending_correction on correction-flagged answers, a bare confirm
  teaches the correction text, any other message disarms. Verified server-free:
  confirm regex rejects 'yes what about...' and 'yesterday's patch'; flag arms only
  on corrections. Pending restart.
- [x] 6 (multi-hop compare): compare_split() + two-pass merged retrieval in ask().
  'compare greatbrow and irix at gold +1' returns sources covering BOTH heroes
  (Greatbrow.md + Irix file); probe.py 11/11 after the change. Pending restart.
- Queue now opens at item 7 (plan: stale-path validation). Both shipped items are
  code-verified and activate on her next natural restart.

## 22 Sep 2026 ~01:44 ET — queue drain: items 7 + 8
- HEALTH: engine up ~40m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
- [x] 7 (plan stale-path validation): check_citations() flags bracket citations absent
  from the live index; plan() appends an honest self-check note naming the stale paths
  + result['stale_citations']. Verified: 'Old Glyph Doc 2021.md' flagged while real
  citations pass; plan() wiring tested with stubbed Ollama. Flags, never rewrites.
- [x] 8 (teachings hygiene): load_teachings() dedupes on normalized text. Verified:
  4 entries with 1 exact + 1 punctuation dup -> 2 kept. Injection cap (last 10) already
  existed. Pending restart.
- probe.py after both brain.py changes: 11/11, 0 failures.
- Queue opens at item 9 (UI honesty pass) next. Pending-restart backlog grows: items
  2b, 5, 6, 7, 8 all activate on her next natural restart.

## 22 Sep 2026 ~01:58 ET — queue drain: items 9 + 10 ('Now' section complete)
- HEALTH: engine up ~55m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
- [x] 9 (UI honesty): kind field threaded through ask/reason (meta|answer|not_covered);
  feed events tagged '[about me]'/'[not in archive]'; refusal counter consolidated on
  kind (removed the old prefix-only duplicate). Verified server-free: 3/3 kinds correct.
- [x] 10 (table rendering): ui.html renderRich() - markdown tables become real DOM
  tables, all cells via textContent (no injection surface). Verified with a node port
  of the exact logic: table parsed (3 rows), 'a | b' prose not misrendered.
  Pending restart (ui.html served from memory).
- probe.py not rerun this wake: no retrieval-path changes (ask flow kinds are additive).
- 'Now' section fully drained. Queue opens at item 11 (HISTORY compression) in 'Next'.
  Pending-restart backlog: 2b, 5, 6, 7, 8, 9, 10 - a single natural restart lights
  up all seven.

## 22 Sep 2026 ~02:14 ET — queue drain: items 11 + 12 + 13(partial)
- HEALTH: engine up ~70m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
- [x] 11 (HISTORY compression): _convo window widened 6->8 turns, older 4 compressed to
  question+answer heads. Verified: 8-turn history at 65% of full-render size with MORE
  turns kept. First cut (6-turn window) failed my own <60% bar - caught by test, fixed.
- [x] 12 (reason self-consistency): draft/final conclusion word-overlap disclosed in
  answer ('self-check: draft/final agreement 56% - high'). Verified with stubbed passes.
- [~] 13 (boot speed) PARTIAL: embeddings.npy -> mmap (verified np.memmap, search OK).
  Big cost is the 311MB chunks.jsonl parse; queued 13b (binary chunk store via pickle
  with mtime match) as the real fix.
- probe.py after all brain.py changes: 11/11, 0 failures. All pending restart.
- Queue opens at item 13b (binary chunk store) then 14 (art-aware answers).

## 22 Sep 2026 ~02:49 ET — queue drain: 13b(rejected) + 14 + 15 + 16
- HEALTH: engine up ~100m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
- [~] 13b REJECTED on evidence: warm jsonl parse 1.2s vs pickle 3.9s (3x slower); total
  warm load ~2.5s (imports 1.1s + matrix 0.2s + chunks 1.2s + emb mmap 0s). The 35s cold
  boot is OneDrive cold disk, not parse format. Code+artifacts reverted, load re-verified.
- [x] 14 art-aware answers: ALREADY WORKING - 1,109 chunks carry image refs, extraction
  to /img URLs verified (ch1.webp sample), ask() surfaces them. No change needed.
- [x] 15 help command: brain.help_answer() + app.py route ('help'/'commands'/'?'), lists
  all modes incl. compare + yes-to-store + reason agreement. Pending restart.
- [x] 16 ambiguity disclosure: fires only on no-rare-token + top-2 tie >=0.95 (measured
  restriction - bare ties nag 3/11 clear questions). Live-verified: 'campaign chapter 3
  boss' flagged, gold+2/arena clean. probe.py 11/11 after. Pending restart.
- Queue opens at item 17 (security pass) then 18 (event feed polish).

## 22 Sep 2026 ~02:59 ET — queue drain: items 17 + 18. QUEUE EMPTY.
- HEALTH: engine up ~115m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
- [x] 17 (security pass, live audit): /img traversal 404 x3 (../, ../../win.ini,
  %2e%2e-encoded); valid archive image 200; sensitive-name scan of all 23,492 chunks:
  ZERO .env/pem/key/p12/secret/credential indexed. Accepted note: her folder is inside
  the archive root so its images are servable - images only, by design.
- [x] 18 (feed polish): event() dedupes identical back-to-back kind+text. Verified:
  duplicate suppressed, distinct kept, activity.jsonl untouched. Pending restart.
- QUEUE STATE: every numbered item 0-18 is now [x] or [~] (13b rejected on measurement).
  The heartbeat backlog is EMPTY - future wakes: re-run probe.py as a health ritual,
  watch scores.jsonl trend once traffic resumes, and harvest new gaps from real usage.
- New standing candidates if idle: no-rare-token drift fix remains the one known
  retrieval weak spot (informational probe, score 0.699); UI chips for answer kinds.

## 22 Sep 2026 ~03:26 ET — item 19 (no-rare-token drift), closed with evidence
- HEALTH: engine up ~145m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
- [x] 19: gated bigram anchoring in brain.search() - applies only when no query token
  clears idf>=4.0. Full evidence trail: top-2-idf fallback failed (0.899 on the same
  chatlog); ungated bigram broke arena probe (probe.py caught the 1/11 regression);
  gated version restores 11/11 AND puts 01 - Campaign.md + 2 campaign docs into the
  drifter query's context. Correction to the 00:53 sweep: the chatlog top-1 is
  legitimately on-topic (chapter-maps worklog, 3 'chapter 3' chunks, 44 'boss' chunks)
  - the 'drift' label was partly a misread. The ambiguity disclosure (item 16) remains
  the honest guard for this class. Pending restart.
- QUEUE: fully drained incl. standing item 19. Next wakes: probe.py as health ritual,
  scores.jsonl trend once traffic resumes, harvest new gaps from real usage.

## 22 Sep 2026 ~03:43 ET — stewardship wake: selftest.py shipped
- HEALTH: engine up ~160m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
  scores.jsonl unchanged (1 entry) - no traffic since 01:01. NOTE: engine last
  restarted 01:03, so the pending-restart backlog (items 2b,5,6,7,8,9,10,15,16,18,19)
  is NOT live in the running process yet - by design; next natural restart activates.
- [x] 20: selftest.py - 15 server-free unit checks covering every heartbeat-shipped
  feature (probe.py covers retrieval; this covers logic). First run 15/15 PASS.
- Ritual for future wakes: python probe.py && python selftest.py, then harvest gaps.

## 22 Sep 2026 ~03:56 ET — stewardship wake (ritual only)
- HEALTH: engine up ~175m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
  scores.jsonl still 1 entry - Phil hasn't chatted since 01:01; engine un-restarted
  since 01:03, so pending items stay pending (by design).
- RITUAL: probe.py 11/11, selftest.py 15/15. On-disk code integrity confirmed.
- No queue items open; no new gaps found. Next wake: same ritual; if a restart has
  occurred (uptime resets), verify a pending feature live (e.g. `help` via /api/ask
  after /api/reset) and mark the backlog activated.

## 22 Sep 2026 ~04:11 ET — stewardship wake (ritual only)
- HEALTH: engine up ~190m (no restart since 01:03), 23492 chunks, questions 2,
  watcher misses 0 restarts 0. scores.jsonl unchanged (1 entry, 01:01).
- RITUAL: probe.py 11/11, selftest.py 15/15. All quiet; pending backlog still parked
  awaiting her next natural restart.

## 22 Sep 2026 ~04:26 ET — stewardship wake (ritual only)
- HEALTH: engine up ~205m (no restart since 01:03), 23492 chunks, questions 2,
  watcher misses 0 restarts 0. scores.jsonl unchanged.
- RITUAL: probe.py 11/11, selftest.py 15/15. All quiet; pending backlog parked.

## 22 Sep 2026 ~04:41 ET — stewardship wake (ritual only)
- HEALTH: engine up ~220m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
- RITUAL: probe.py 11/11, selftest.py 15/15. No traffic; pending backlog parked.

## 22 Sep 2026 ~04:56 ET — stewardship wake (ritual only)
- HEALTH: engine up ~235m, 23492 chunks, questions 2, watcher misses 0 restarts 0.
- RITUAL: probe.py 11/11, selftest.py 15/15. Quiet; backlog parked.

## 22 Sep 2026 ~05:11 ET — stewardship: engine up ~250m, 23492 chunks, watcher misses 0 restarts 0. RITUAL: probe.py 11/11, selftest.py 15/15. Quiet.

## 2026-09-22 05:26 — quiet wake
- Health: engine up 265.6 min (no restart since 01:03), 23,492 chunks, avg_score 1.034 over 1 scored; beats fresh 05:24:59, misses 0, restarts 0.
- Suites: probe.py 11/11 PASS (academy 1.051, bulletin-board 0.951, no-rare-tokens 0.885); selftest.py 15/15 PASS.
- Pending-restart backlog (2b,5,6,7,8,9,10,15,16,18,19) still parked on disk — engine not restarted, so not live. Watch uptime reset, then verify `help` command went live.
- Queue fully drained; no new gaps. Next wake: same ritual.

## 22 Sep 2026 ~05:41 ET — stewardship: engine up ~280m, 23492 chunks, watcher misses 0 restarts 0. RITUAL: probe.py 11/11, selftest.py 15/15. Quiet; backlog parked.

## 22 Sep 2026 ~05:56 ET — stewardship: engine up ~295m, 23492 chunks, watcher misses 0 restarts 0. RITUAL: probe.py 11/11, selftest.py 15/15. Quiet; backlog parked.

## 22 Sep 2026 ~06:11 ET — stewardship: engine up ~310m, 23492 chunks, watcher misses 0 restarts 0. RITUAL: probe.py 11/11, selftest.py 15/15. Quiet; backlog parked.

## 22 Sep 2026 ~06:26 ET — stewardship: engine up ~325m, 23492 chunks, watcher misses 0 restarts 0. RITUAL: probe.py 11/11, selftest.py 15/15. Quiet; backlog parked.

## 22 Sep 2026 ~06:41 ET — stewardship: engine up ~340m, 23492 chunks, watcher misses 0 restarts 0. RITUAL: probe.py 11/11, selftest.py 15/15. Quiet; backlog parked.

## 22 Sep 2026 ~06:56 ET — stewardship: engine up ~355m, 23492 chunks, watcher misses 0 restarts 0. RITUAL: probe.py 11/11, selftest.py 15/15. Quiet; backlog parked.

## 22 Sep 2026 ~07:11 ET — stewardship: engine up ~370m, 23492 chunks, watcher misses 0 restarts 0. RITUAL: probe.py 11/11, selftest.py 15/15. Quiet; backlog parked.

## 22 Sep 2026 ~07:26 ET — stewardship: engine up ~385m, 23492 chunks, watcher misses 0 restarts 0. RITUAL: probe.py 11/11, selftest.py 15/15. Quiet; backlog parked.

## 22 Sep 2026 ~07:41 ET — stewardship: engine up ~400m, 23492 chunks, watcher misses 0 restarts 0. RITUAL: probe.py 11/11, selftest.py 15/15. Quiet; backlog parked.
