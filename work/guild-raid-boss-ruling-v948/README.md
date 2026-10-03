# Preserved Guild audit — UNAPPROVED, NOT DEPLOYED

Phil requested pushing all saved bug-fix and balance work on 3 October 2026 so it is not forgotten. This branch is preservation/review only. It does not replace the root game files, deploy anything, or establish that the game is balanced or bug-free.

Current cumulative private server: `private-server-flag-history-hold.js`, SHA256 `ac915324eb523723f2106a49252686285fa5a466578c941932c55bfac0c93c7b`.
Current cumulative private client: `private-client-result-numeric.html`, SHA256 `20787649b6707783cfe9c8719f20e53e6f84bbc70162d40440e2020dcf190f5a`.

Preserved fixes include numeric damage/HP overflow handling, start exclusivity, exact settlement ownership, player-reported damage with advisory replay diagnostics, atomic first mismatch-flag persistence, and malformed-history preservation. Certificates distinguish extracted/stubbed functions, synthetic actual HTTP, injected faults, and design-only work. No actual witnessed combat or complete case3/review4 delivery is claimed.

`case-outbox-model.cjs` is an isolated executable DESIGN ONLY; it is not imported by the game or Brain. Transport acknowledgement is not review completion.

Open: release/quit/disconnect/reload/expiry/late-boss rules (Q11), retention/cutover/compensation (Q10), history capacity/validation and consumer review contract, contribution/balance rationale, integrated current client/server fights, production quiescence, current full regression suite, phone and canonical bot verification, deployment backup/rollback and exact dual approval. Existing remaining-HP cap and unresolved expiry behavior are explicitly not certified as the final intended mechanics.

Sibling `work/guild-raid-*` folders preserve top-level prior source/build/test/certificate artifacts. Earlier candidates and their certificates are historical and superseded, not approvals of the current pair. Runtime databases, browser profiles, temporary fixture stores, generated image captures and whole-game snapshots are excluded. Some harnesses reference the original isolated `work/shady-gold-v942/snapshot` fixture; that fixture is not included in this preservation branch. Do not run those harnesses against production or replace their baseline/hash guards.

The checkpoints folder captures the handoff state at backup time. Canonical mechanics and full worklogs remain in the Emberweave Archive; copies of the relevant mechanics and hour logs are in `documentation/` on this branch.
