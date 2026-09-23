# HEARTBEAT QUEUE — the backlog. Wakes pull from the TOP, do as many as the time
# budget allows, verify each, and mark [x] with evidence or [~] skipped+why.
# New gaps discovered during work get appended at the BOTTOM.
#
# BUILD BIBLE: REASONING ARCHITECTURE.md (Phil's roadmap v1.0, 22 Sep) - the 12-layer
# map this queue serves. Every item should name the layer it advances.

## Now
- [x] 0. SCOPE RULING (Phil, 22 Sep ~01:00): she claimed blueprints were 'not on her list of things
      to read'. Fixed: SELF_KNOWLEDGE rewritten naming all 10 archive folders + 'whole archive is my
      mind, there is no list'; ruling stored as teaching. Verified: meta question answered with ruling
      language; Watch Tower blueprint answers with citations. Do NOT regress this wording.
- [x] 1. Regression probe suite: probes.json + probe.py shipped (22 Sep ~01:12 wake).
      12 probes (11 graded + 1 informational for the no-rare-token class). First run:
      11/11 PASS, 0 failures - gold+2 score 1.138, purple+2 followup 0.919, all expected
      files in context, all key facts present. Run `python probe.py` around any retrieval change.
- [x] 2. Mid-conversation learning: CORRECTION_PAT + CORRECTION_NUDGE in brain.py (shipped
      00:48 wake, live since 01:03 restart). Correction openings ("no,", "that's wrong",
      "actually...") get an honest remember: bridge. Verified 22 Sep 01:12: server-free
      ask() test - nudge present on correction, absent on normal question; 9/9 pattern
      recall, 0/7 false positives.
- [x] 3. Citation precision sweep: done via probes.json first run - 11/11 expected files
      present in retrieved context (context-level precision 100%). Note: top-1 filename
      proxy is only ~40% (worklogs win top slot) but file-ranking keeps design docs in
      context; measure with probe.py, not top-1.
- [x] 2b. STORE half of mid-conversation learning: yes-to-store bridge shipped (01:28 wake).
      brain.py: is_correction()/is_confirm() + result['correction'] flag; nudge now offers
      "say yes and I'll store it". app.py: _pending_correction armed on correction answers,
      a bare confirm ("yes"/"yeah"/"store it"...) teaches the correction text; any other
      message disarms. Verified server-free: confirm pattern rejects non-bare 'yes what
      about...' and 'yesterday's patch'; flag arms only on corrections. Pending restart.
- [x] 6. Multi-hop compare mode: compare_split() + two-pass retrieval in ask() (01:28 wake).
      "compare greatbrow and irix at gold +1" now retrieves each side separately and merges
      (deduped, score-sorted). Verified server-free: sources include BOTH Greatbrow.md and
      Irix file; non-compare questions never trigger (unit-checked); probe.py 11/11 after.
      Pending restart. Known simplification: the trailing qualifier rides with the right
      side's query string - works because the tier string survives in both side queries.
- [x] 4. scores.jsonl trend: shipped 00:36 wake (app.py), live since 01:03 restart.
      Verified 01:12: file exists, first real entry {"t":"2026-09-22 01:01:14",
      "q":"tell me about the watch tower blueprint","score":1.034}. Trend now measurable.
- [x] 5. Follow-up robustness: _search_q now scans last 3 turns (newest first) for rare
      tokens instead of only the previous turn (brain.py, 01:12 wake). Verified: 'and his
      runes?' two turns after Greatbrow was named carries 'greatbrow'; probe.py still
      11/11 after the change. Pending restart to go live.
- [x] 7. plan: stale-path validation: check_citations() in brain.py flags bracket citations
      matching NO index file (exact/basename/stem, case-insensitive); plan() appends an
      honest self-check note + result['stale_citations'] instead of silently pointing at
      ghosts (01:44 wake). Verified: fake citation flagged, real ones pass, plan() wires
      the note (stubbed Ollama). Flags rather than rewrites - guessing a replacement
      could point Phil at the wrong doc. Pending restart.
- [x] 8. Teachings hygiene: load_teachings() now dedupes exact/near-duplicates via
      normalized text key (01:44 wake). Verified with temp file: 4 entries (1 exact dup,
      1 punctuation-variant dup) -> 2 kept. Cap already exists (last 10 injected).
      Pending restart.
- [x] 9. UI honesty pass (server side): ask()/reason() now return kind: meta | answer |
      not_covered; app.py feed tags non-archive answers ('[about me]' / '[not in archive]')
      and refusals count via kind (01:58 wake). Verified server-free: all three kinds
      returned correctly (stubbed Ollama). Pending restart. UI chips for kinds: not built.
- [x] 10. Table rendering: ui.html renderRich() converts markdown tables in answers into
      real DOM tables (th/td via textContent only - zero injection surface); prose keeps
      pre-wrap. Verified with node port of the exact segmentation logic: 3-row table
      parsed, pipe-containing prose NOT misrendered. Pending restart (ui.html is served
      from memory at startup).

## Next
- [x] 11. HISTORY compression: _convo now keeps the last 8 turns (was 6) with the older
      4 compressed to question+answer head (~140 chars each) (02:12 wake). Verified:
      8-turn history renders at 65% of full size with MORE continuity; probe.py 11/11.
      Pending restart.
- [x] 12. reason: mode self-consistency: draft/final conclusion word-overlap scored and
      disclosed in the answer ('self-check: draft/final agreement X% - level') (02:12
      wake). Verified with stubbed passes: agreement 0.56 reported on convergent texts.
      Pending restart.
- [~] 13. Boot speed: PARTIAL (02:12 wake) - embeddings.npy now loads via mmap (verified:
      np.memmap instance, search works), skipping the eager 72MB read. The dominant cost
      (311MB chunks.jsonl parse) remains - real fix is a binary chunk store (pickle/npz)
      written by index.py. Left open as item 13b below.
- [~] 13b. Binary chunk store: REJECTED on measurement (02:28 wake). Warm jsonl parse is
      only 1.2s; pickle of 23k text dicts is 3.9s (3x SLOWER). Full warm load is ~2.5s
      total (numpy 0.1 scipy 0.2 sklearn 0.8 vectorizer 0.0 matrix 0.2 chunks 1.2 emb
      mmap 0.0). The 35s cold boot is OneDrive cold disk reads, not parse format. Code
      reverted, artifacts removed, load path re-verified (23492 chunks). No action needed.
- [x] 14. Art-aware answers: ALREADY WORKING at baseline - verified (02:28 wake): 1,109
      chunks carry extractable image refs; extract_images resolves them to /img URLs
      (sample: campaign doc -> Base files/assets/img/Campaign/ch1.webp) and ask()
      surfaces them. No code change needed.
- [x] 15. help command: brain.help_answer() + app.py route on 'help'/'commands'/'?'
      (02:28 wake). Lists all modes incl. compare, yes-to-store, reason agreement.
      Verified server-free: kind=meta, all commands listed. Pending restart.
- [x] 16. Ambiguity probing: ambiguity disclosure in ask() (02:48 wake). Fires ONLY when
      the question has no rare tokens AND top-2 file scores tie within 5% - then appends
      a low-confidence note naming both reads and inviting a precise subject. Evidence for
      the restriction: measured top-2 ratios across all 12 probes (0.58-0.99) showed bare
      score-ties fire on 3/11 CLEAR questions (near-tie = complementary files, not two
      intents). Verified live: 'campaign chapter 3 boss' flagged; gold+2 and arena stay
      clean. probe.py 11/11. Pending restart.
- [x] 17. Security pass: audited live (02:58 wake). /img escape attempts all 404
      (../ md file, ../../Windows/win.ini, %2e%2e-encoded traversal); valid in-archive
      image 200 (ch1.webp); extension guard blocks non-images; sensitive-name scan of
      all 23,492 indexed chunks: ZERO .env/.pem/.key/.p12/secret/credential files
      indexed. One accepted note: her own folder sits inside the archive root, so its
      images (icon.png) are /img-servable - images only, no secrets, by design.
- [x] 18. Event feed polish: event() now suppresses identical back-to-back kind+text
      (watcher/reindex noise) (02:58 wake). Verified module-level: duplicate suppressed,
      distinct event kept, real activity.jsonl untouched. Pending restart.

## Done (newest last)
- [x] 0. SCOPE RULING shipped 01:05 by Kimi main session (not a wake) - SELF_KNOWLEDGE names all 10
      folders + no-list doctrine; teaching added; verified via /api/ask meta + blueprint probes.

## Standing (appended after full drain)
- [x] 19. No-rare-token drift fix (03:25 wake): gated bigram anchoring - only when NO
      token clears idf>=4.0, adjacent-token pairs (one token idf>=2.5) get +0.3 bonus.
      Evidence: top-2-idf fallback failed; ungated bigram regressed arena (caught by
      probe.py); gated version keeps 11/11 AND puts 01 - Campaign.md + 2 campaign docs
      into the drifter's context. The chatlog top-1 proved legitimately on-topic
      (chapter-maps worklog) - 'drift' label was partly a 00:53 misread. Pending restart.
- [x] 20. Unit self-test suite: selftest.py (03:42 wake) - 15 checks covering every
      non-retrieval feature shipped by the heartbeat (correction nudge/flag, confirm
      regex, compare split + both-sides retrieval, answer kinds, stale citations,
      teachings dedupe, convo compression, 3-turn carry, help, mmap). First run 15/15.
      Run with probe.py before any restart that activates pending changes.
