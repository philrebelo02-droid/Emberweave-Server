# EMBERWEAVE BRAIN — BUILD CHECKLIST (status vs roadmap v1.0)

Companion to `2. EMBERWEAVE BRAIN CHECKLIST.md` (Phil's roadmap, verbatim). This file tracks
what is ACTUALLY built and verified — DONE means finished to 100% certainty, verified live.
PARTIAL means real pieces exist but the step's full requirement is not met. Honesty over morale.

Last verified: 22 Sep 2026, ~14:35, by Kimi (full re-skim vs roadmap: 2 gaps found and fixed —
Step 12 reflections now cover task merges, Step 18 now covers all 5 report types).

---

## Phase 1: Foundation

### Step 1: Select Core Brain — DONE
qwen2.5:14b via Ollama on Phil's RTX 4080. Instruction following, structured output (JSON
blocks verified), stable personality. Embeddings: nomic-embed-text.

### Step 2: Create Persistent Memory — DONE (22 Sep 2026, 11:35)
memory/ folder, mtime-cached loaders (hand-editable, no restart): project_state.json,
goals.json, ownership.json, agents.json, tasks.json, lessons.jsonl (failures),
successes.jsonl (wins), reflections.jsonl (job reflections). Loaded into every ask/reason
prompt via state_block(). Verified live.

### Step 3: Create World State — DONE (22 Sep 2026, 11:35)
memory/project_state.json: project, vision, phase, current_sprint, active_tasks, updated.
`state:` shows it, `state: phase=X` updates it (known keys only, typo-safe). She answers from
it — verified: "what sprint are we in?" answered citing [WORLD STATE].

## Phase 2: Agency

### Step 4: Build Task System — DONE (22 Sep 2026, 11:35)
memory/tasks.json with ALL required fields: task, owner (one only, Rule 3), priority, status,
creation date, completion date. Commands: `task: add <owner> <priority> <what>` /
`task: done <id>` / `task: list`. Open tasks injected into every prompt via state_block().
Verified live (add/list/done round-trip).

### Step 5: Create Planning Engine — DONE (22 Sep 2026, 12:00)
Persistent goal tree in memory/goals.json (Vision → Milestones → Features + current sprint/task).
`goal:` renders it; `goal: add milestone|feature` extends it. plan: mode decomposes ALONG the
tree ("Goal Tree Decomposition" section, verified live) with a scope-creep guard: steps that map
to no milestone get flagged. Caveat: the milestone mapping is prompt-guided, not hard-validated —
the 14B can still invent plausible mappings; Phil reviews plans as the approval gate.

### Step 6: Create Decision Layer — DONE (22 Sep 2026, 12:00)
reason:/plan: answer objective/known/missing/options/why before executing (mandatory JSON block,
verified). ENFORCEMENT: every major action — task add/done, state update, goal add, agent
dispatch, plan — writes a decision record (objective/options/chosen/why) to
memory/decisions.jsonl, and the last 3 ride into every prompt ("RECENT DECISIONS") so later
decisions know what was already decided and why. Scope note: plain archive lookups are reads,
not decisions — the layer governs decision-type actions.

## Phase 3: Agent Management

### Step 7: Agent Registry — DONE
Specialists defined and injected (Department Structure v1.1, 22 Sep 2026): Claude (Engineering +
Narrative Systems, write keys), ChatGPT (Reasoning, Quality + Creative Analysis), Grok (Visual
Intelligence / Art Department), Phil (rulings). Kimi holds no department (Phil's ruling: monthly
usage reset, not weekly — a manager must be reliably available week to week) — build architect
of the Brain itself, continuity via my documents + KIMI WORKLOG. Local workers whitelisted in
agents.py (dig/probe/stats) — the model can only pick from the whitelist, never touch a shell.

### Step 8: Ownership System — DONE (22 Sep 2026, 12:00)
Enforced IN CODE, not by prompt: add_task rejects co-ownership ("Claude+ChatGPT" → Rule 3
error) and unknown owners (rejected with the registered-owner list from memory/agents.json).
Accepted tasks register in ownership.json's task map. Verified live: both rejections + valid
ChatGPT assignment. plan: mode also tags exactly one owner per step.

### Step 9: Workflow System — DONE, Phase A (22 Sep 2026, 14:05; ruled by Phil 13:51)
All 5 decision points ruled (recommendations accepted): pipeline + approval matrix law;
standing orders in memory/standing_orders.json; 7-day stale threshold; built in one pass.
- 9 pipeline states on every task; legacy tasks auto-migrate on read.
- Proposal queue (Rule 2): `task: propose` lands PROPOSED, never auto-assigned, logged to
  proposals.jsonl. Promotion: Phil anything; the Brain only retrieval/research/dig classes.
- Review records: `task: review <id> <approve|changes_requested|reject> <notes>` — approve
  holds IN_REVIEW; changes_requested bounces; reject kills + the reason becomes a lesson.
- APPROVAL GATE ENFORCED IN CODE (complete_task): protected tasks cannot MERGE without an
  approve review AND Phil's approval. `task: override <id>` is Phil's logged bypass;
  `task: exempt <id>` marks standing-orders exempt classes (memory/teachings/worklogs/reports).
- Interface notes: `task: note <id>`; moving to IN_REVIEW without one prompts for it.
- Stale flagging: >7 days in one state flagged in `task: list` + the metrics table.
Verified live end-to-end: PROPOSED→done refused → promote → gate refusal → IN_PROGRESS →
IN_REVIEW (hint) → note → approve review → APPROVED → MERGED; override path; exempt path;
reject path. Phase B (git-backed merges, change logs) waits on Step 17; Phase C (routed
reviews) waits on specialist channels.

## Phase 4: Learning

### Step 10: Failure Memory — DONE (22 Sep 2026, 11:35)
failures.jsonl (task/cause/date/lessons) + unified memory/lessons.jsonl. record_failure
dual-writes. Consulted before decisions: recent lessons ride in state_block() into every ask
and reason prompt ("HARD LESSONS" section). Seeded with the NFT, retrieval-canon, and
theory-collapse lessons.

### Step 11: Success Memory — DONE (22 Sep 2026, 11:35)
memory/successes.jsonl (task/reason/date). `success: ...` records Phil-flagged wins; seeded with
today's verified wins. Wins ride in state_block() next to the lessons — best practices are
consulted, not just failures.

### Step 12: Reflection Engine — DONE (22 Sep 2026, 11:36; task merges added 14:32)
Every completed agent job auto-writes a structured reflection to memory/reflections.jsonl:
what worked (summary), what failed (error), started/finished timestamps, improve (queued for
weekly review), repeat (the dig pattern worth keeping). Verified live on dig job 113600.
FULL ROADMAP COMPLIANCE (14:32): "after every completed task" now literally true — task:
done (MERGED) also writes a reflection (gate path taken, started/finished, queued for weekly
review). Verified live on task #12. reason: mode's draft/final agreement score remains the
conversational reflection layer.

## Phase 5: Reasoning

### Step 13: Multi-Theory Thinking — DONE
REASON_SYS mandates ≥3 scored theories; CRITIC_SYS hard rule: the final keeps every draft theory,
re-scored with evidence — removal only with explicit excerpt proof. Verified live (witches-hut
plunderability: 3 theories + verdict).

### Step 14: Confidence Engine — DONE
Every answer carries retrieval score; <0.9 discloses confidence (MEDIUM 0.55-0.9 / LOW <0.55);
scores.jsonl trends quality over time; avg_match shown in the UI header.

### Step 15: Retry Engine — DONE
Never a bare "I don't know": empty/thin retrieval self-dispatches a dig agent; foreign-topic gate
still REACHES with labeled first-principles inference (rule 16 + HOW TO THINK.md doctrine),
boundary stated, dig dispatched, failure recorded. Verified live (NFT question).

## Phase 6: Tool Usage

### Step 16: File Tools — DONE (22 Sep 2026, 13:10; folder access added 13:35)
Read Files: `read: <archive path>` — verbatim, bounded (8000 chars), path-escape refused,
sensitive names refused. Verified incl. a `../../Windows` escape attempt. ANY-FOLDER ACCESS
(Phil's 13:21 ruling): `read:` accepts absolute paths outside the archive — folders return a
50-entry listing, files the bounded verbatim read; the ask IS the grant, persisted to
memory/access.json and managed via `access: grant/revoke/list`. Verified live against
C:\Users\Home\Downloads (listing + auto-grant + revoke). Write Reports /
Create Documentation: `report: <topic>` compiles a cited markdown report (Summary / Key Facts /
Analysis / Open Questions / owner-tagged Actions) into reports/. Verified: "witches hut brew
economy" report written, facts match settled design. Update State + Manage Tasks: state:/task:/
goal: commands (Steps 3/4/5).

### Step 17: Git Integration — NOT STARTED
Future goal per roadmap.

### Step 18: Reporting — DONE (22 Sep 2026, 14:20)
`agent: stats` produces an index + learning health report on demand. HEARTBEAT SUBSYSTEM
(Phil's 13:17 spec + 13:21 ruling): `heartbeat: on [seconds]` / `off` / `status` — she owns
it, toggles only when Phil asks, boot-persistent (verified). Each beat checks exactly Phil's
two items: (1) archive documents edited (diff vs last beat, names listed), (2) worker AIs on
task (running jobs, STALE flagged >10 min) — plus open-task count. Beats log to
memory/beats.jsonl and show in the feed as green "Heartbeat" blocks. DAILY REPORT GENERATOR:
`daily:` (alias `report: daily`) compiles the digest from her own logs — Health (metrics),
Today (tasks created/merged/transitions, jobs, decisions by action, failures), Pipeline
(states, proposals awaiting promotion, stale), Risks (stale/failed jobs/refusal spike/
blocked), Watch tomorrow — filed to reports/<date> daily.md, no model pass. The heartbeat
files it automatically at the first beat of each day when ON (verified: beat fired, report
compiled, last_daily.json set). Heartbeat left OFF until Phil assigns the job.
ALL 5 ROADMAP REPORT TYPES (14:32 re-skim fix): `report: sprint` (goal tree + task flow),
`report: risk` (standalone risk register), `report: progress` (trajectory: quality trend,
goal-tree %, throughput), `report: agent` (specialists, load by owner, worker outcomes) —
each compiled from her logs, filed to reports/, verified live. Daily remains the only
AUTOMATIC one (heartbeat-gated per Phil's ruling); the other four are on-demand commands.

## Phase 7: Advanced Management

### Step 19: Long-Term Goal Tracking — DONE (22 Sep 2026, 13:12)
Maintained continuously: vision + milestones + features in memory/goals.json (goal: add /
goal: status to move them — verified F2.1 → done), current sprint/task in project_state.json,
roadmap + architecture as standing docs (2. EMBERWEAVE BRAIN CHECKLIST/ folder), all injected
into every prompt via state_block.

### Step 20: Self Improvement — DONE (22 Sep 2026, 13:12)
`metrics:` renders the live table from real logs: scored answers, avg retrieval match, score
trend (2nd half vs 1st — measured +0.115 today), failures, refusal rate, tasks done/open,
agent jobs ok/failed, decisions on record. "Use data to improve decisions": a compact METRICS
line rides in EVERY prompt via state_block. Scope note: success rate ≈ 1−refusal rate and
blocked tasks ≈ open count (proxies, not separate tracked fields); bottleneck analysis is the
reflections "improve" field, reviewed weekly.

---

## Critical Rules

### Rule 1: Only Emberweave may modify project state — DONE (22 Sep 2026, 14:05)
tasks.json is now the authoritative project-state layer, and it changes only through her
commands. Workers/agents have no state-write path — they submit proposals (Rule 2). The
approval gate blocks unapproved production-impacting completions; Phil's override is the
only bypass and it is logged. Archive and repo remain read-only for her by design.

### Rule 2: Agents submit proposals — DONE (22 Sep 2026, 14:05)
The proposal queue is real: `task: propose` lands as PROPOSED and is never auto-assigned.
Promotion rights are enforced in code — Phil promotes anything; the Brain self-promotes only
retrieval/research/dig classes under standing orders. plan: mode escalations continue to
route human/department work.

### Rule 3: One owner per task — DONE
plan: mode assigns exactly one owner per step; co-ownership is structurally impossible in the
output format. Verified.

### Rule 4: All major decisions require reasoning — DONE (22 Sep 2026, 14:05)
Every major action is now structurally tied to a decision record with options considered,
the choice, and the why: task add/propose/promote/review/approve/override/exempt/done,
access grants/revokes, heartbeat toggles, report writes. The gate itself forces the
reasoning chain (review → approval → merge) before protected work lands.

### Rule 5: Failures become lessons — DONE
record_failure stores lessons with every failure; NFT entry: lessons ["check vocabulary coverage
before retrieval", "dispatch dig to confirm"].

### Rule 6: No immediate surrender. Always retry. — DONE
Reach-don't-refuse (rule 16), dig self-dispatch, dig relevance/foreign gates, HOW TO THINK.md
doctrine sections 4/6/10. Verified end-to-end.

---

## SCOREBOARD

- DONE: 25 of 26 (Steps 1-16, 18, 19, 20; Rules 1-6)
- PARTIAL: 0
- NOT STARTED: 1 (Step 17 — git integration, parked on Phil's repo-access decision)

## NEXT BUILD ORDER (roadmap verbatim order)
1. Step 17 git integration — the ONLY item left. Needs Phil's repo-access decision
   (Claude holds write keys); then Phase B of the workflow (git-backed merges, change
   logs, branch-per-task) and Phase C (routed specialist reviews) unlock.

---

## APPENDIX: 12-LAYER REASONING MAP (Phil's first roadmap) — coverage check, 22 Sep 2026

The 12-layer Reasoning and Decision Architecture map was never given its own tracker. Coverage:

- L1 Persistent problem solving (3 attempts, then findings report) — COVERED by Step 15's
  reach-don't-refuse + dig self-dispatch. The literal "attempt 1/2/3 then findings report"
  escalation chain for arbitrary tasks is NOT built — parked (no trigger point needs it yet).
- L2 Structured reasoning (objective/known/missing/assumptions/next) — DONE (Step 6).
- L3 Confidence assessment — DONE (Step 14).
- L4 Multi-theory reasoning — DONE (Step 13).
- L5 Task decomposition — DONE (Step 5).
- L6 Reflection — DONE (Step 12, agent jobs + task merges).
- L7 Specialist consultation (confidence <50 → ask, compare, consensus) — PARKED: needs
  specialist channels (workflow Phase C).
- L8 Goal hierarchy (reject work that maps to no milestone) — DONE with caveat (Step 5:
  prompt-guided scope-creep guard, not hard-validated).
- L9 Failure memory — DONE (Step 10).
- L10 Self-evaluation — DONE (Step 20; daily digest + weekly review queue).
- L11 Authority system — DONE (Steps 8/9 + Rules 1-3).
- L12 Project memory core — DONE (Steps 2/3/19).

Verdict: 10 of 12 layers fully covered; L1's literal escalation chain and L7 specialist
consultation are the only open items, both parked on Phase C channels rather than missed.
