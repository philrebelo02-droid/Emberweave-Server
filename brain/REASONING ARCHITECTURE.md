# Emberweave Brain — Reasoning and Decision Architecture Roadmap
## Version 1.0 (Phil, 22 Sep 2026)

Emberweave is the central intelligence and management layer of a multi-agent
development ecosystem. It maintains project vision, manages specialist agents,
retains knowledge, makes decisions, prevents scope creep, coordinates execution,
learns from outcomes, and persists through uncertainty and failure.

Core philosophy: a weak agent quits. A competent agent retries. An advanced
agent investigates. Never surrender to uncertainty: generate theories, explore,
consult sources, attempt alternatives, escalate only after exhausting options.

## The 12 Layers — status map (as of 22 Sep 2026, kept current by Kimi)

| Layer | Name | Status in the Brain |
|---|---|---|
| 1 | Persistent problem solving (escalation chain) | LIVE — foreign-question gate + self-dispatch dig + findings report before any failure claim |
| 2 | Structured reasoning (goal/facts/assumptions/next action) | LIVE — `reason:` mode emits the structured block |
| 3 | Confidence assessment | LIVE — every answer carries top_score; ambiguity flag fires on anchor-less ties |
| 4 | Multi-theory reasoning | LIVE — `reason:` mode generates + scores multiple theories before concluding |
| 5 | Task decomposition + specialist owners | LIVE — `plan:` mode decomposes with BRAIN/CLAUDE/GROK/PHIL owner tags |
| 6 | Reflection | LIVE — agent briefs (agent_briefs.md) + KIMI WORKLOG are the reflection store |
| 7 | Specialist consultation | DOCTRINE — she escalates to the right owner via plan:/answers; she cannot call other AIs directly (no APIs) — Phil relays |
| 8 | Goal hierarchy | DOCTRINE — goals.md (this folder) is the milestone anchor; plan: rejects off-milestone work |
| 9 | Failure memory | LIVE — failures.jsonl records every not-covered with absent words; checked before dispatch decisions |
| 10 | Self-evaluation | LIVE — scores.jsonl trend + `agent: stats` daily metrics |
| 11 | Authority system | DOCTRINE — specialists suggest; she decides within her lane; Phil outranks everyone |
| 12 | Project memory core | LIVE — archive index (23k+ chunks) + teachings.jsonl + agent briefs + this roadmap |

## Target outcome

Reasoning engine + memory system + project manager + task planner + specialist
coordinator + reflection system + failure learning + authority layer. She does
not simply answer questions — she coordinates progress toward long-term
objectives while maintaining stability and improving her own decisions.
