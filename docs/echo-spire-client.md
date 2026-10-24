# Echo Spire client

Branch: `chatgpt/echo-spire-ui-23oct`, based on v1216 `d1930405`.
Server ownership: Claude. Client screen, battle integration and key art: ChatGPT. Art/design review: Grok; art approval: Phil.

## Player flow

The existing Tower entry opens Echo Spire. The screen reads `/api/tower/state` and presents the current season, checkpointed floor, personal best, next Guardian or Echo Warden, remembered season/floor, five lineup slots, floor memories and daily tribute. Choose/change lineup opens the existing campaign squad picker. Its Fight action starts `/api/tower/start` with owned hero keys, then runs the returned frozen snapshots, seed and authored waves through the Province/Well battle path. Echo hero foes use the existing `isHero` wave representation.

The battle's observed win, stars, digest and input log are snapshotted before the result delay and submitted to `/api/tower/resolve`. The client adopts the returned ledger; it never computes or adds Tower gold/gems locally. Unknown responses remain pending rather than displaying a win or defeat as booked. The pending result is stored per account, re-sent with the same request ID before reading state or starting another fight, and cleared only by a definite response to that request. Replies from a different account do not mutate the current account. The old `/api/tower/ascend` power-check path is removed from the client.

The result button and squad/back/quit controls return to Echo Spire. Pause/background behavior includes the Tower, and wave labels name its floor.

## Contract and presentation boundaries

Implements Claude's `11 ECHO SPIRE - BUILD SPEC (Claude, 24 Oct).md` from the Tower redesign task folder. The server supplies recorded season/floor and the record timestamp `echo.t`; the view uses that timestamp when present and never invents one. Its `seasonEnds` day key becomes 09:00 New York time, including the daylight-saving offset, before the countdown is rendered. Echo bonuses are explicit in the reward preview. Future floors whose opponent is not provided are shown as unrevealed. Rewards are text from server values; no preview estimate creates a payment.

`assets/echo-spire-ui.js` is view-only, takes plain display state and callback actions, escapes names/text, and has no network or economy code. `assets/echo-spire-ui.css` is phone-first. The full client adapter lives next to `openTower()` in `emberweave-heroes.html`.

## Art

`tests/echo-spire-keyart-DRAFT.png` is unapproved concept art and appears only in the fixture preview. It is not referenced by the production client. Grok passed the revised art and mobile view at 00:14 on 24 Oct. Phil's approval is pending before installing/versioning a production asset under `assets/ui/tower-*`.

## Validation

- `node tests/test_echo_spire_ui.js`: state/action gates, Echo provenance, invalid dates, new-player Guardian state, hostile name escaping, tribute state.
- `node tests/test_echo_spire_client.js`: pending-result persistence, lost-response retention, same-ID resend, response/request isolation, server contract mapping and frozen start setup; no client reward grants or old ascend endpoint.
- All five executable inline HTML script blocks compile through `new Function`.
- Headless browser: 390px and 320px widths without horizontal overflow; lineup removal disables Fight, re-selection enables it; result feedback and tribute disabled after claim. No live accounts or rewards used.

Claude server commit `ada9b5f5` is merged locally. Additional validation:
- `test_tower_echo.js`: 25 checks passed; `test_tower_server.js`: 58 checks passed.
- `test_results_retry_1151.js`: 42 passed, zero failed across HTTP receipts and the real result page. The inverse v1150 control fails as expected (19 passed, 22 failed). Tower uses start/resolve; unknown replies retain a saved result, definite refusal says NOT COUNTED, and a real loss says DEFEAT.
- `test_wallet_tower_claim.js`: refused tribute does not consume the day or grant money; retries use one day key; only the returned ledger applies the reward.
- `test_echo_spire_battle.js`: actual client simulation from server snapshots/seed/waves, isolated throwaway accounts. A weak five loses a three-wave Guardian floor; a trained five wins an Echo floor against five recorded hero foes. Real witnessed digests settle both results. Time is advanced through fixed simulation ticks; this checks integration, not balance or wall-clock timing. No forced wins or fabricated digests in this test.
- New Echo tests are registered in `tests/run_all_tests.sh`.

These are focused local checks, not a complete release-suite pass. Claude owns release coordination. No deployment performed.
