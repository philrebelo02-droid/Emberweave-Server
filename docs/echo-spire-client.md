# Echo Spire client

Branch: `chatgpt/echo-spire-ui-23oct`, based on v1216 `d1930405`.
Server ownership: Claude. Client screen, battle integration and key art: ChatGPT. Art/design review: Grok; art approval: Phil.

## Player flow

The existing Tower entry opens Echo Spire. The screen reads `/api/tower/state` and presents the current season, checkpointed floor, personal best, next Guardian or Echo Warden, remembered season/floor, five lineup slots, floor memories and daily tribute. Choose/change lineup opens the existing campaign squad picker. Its Fight action starts `/api/tower/start` with owned hero keys, then runs the returned frozen snapshots, seed and authored waves through the Province/Well battle path. Echo hero foes use the existing `isHero` wave representation.

The battle's observed win, stars, digest and input log are snapshotted before the result delay and submitted to `/api/tower/resolve`. The client adopts the returned ledger; it never computes or adds Tower gold/gems locally. Unknown responses remain pending rather than displaying a win or defeat as booked. The pending result is stored per account, re-sent with the same request ID before reading state or starting another fight, and cleared only by a definite response to that request. Replies from a different account do not mutate the current account. The old `/api/tower/ascend` power-check path is removed from the client.

The result button and squad/back/quit controls return to Echo Spire. Pause/background behavior includes the Tower, and wave labels name its floor.

## Contract and presentation boundaries

Implements Claude's `11 ECHO SPIRE - BUILD SPEC (Claude, 24 Oct).md` from the Tower redesign task folder. The API provides recorded season/floor, not a date: the UI shows that provenance and does not invent a recorded date. An optional future `recordedAt` can be rendered by the view. Future floors whose opponent is not provided are shown as unrevealed. Rewards are text from server values; no preview estimate creates a payment.

`assets/echo-spire-ui.js` is view-only, takes plain display state and callback actions, escapes names/text, and has no network or economy code. `assets/echo-spire-ui.css` is phone-first. The full client adapter lives next to `openTower()` in `emberweave-heroes.html`.

## Art

`tests/echo-spire-keyart-DRAFT.png` is unapproved concept art and appears only in the fixture preview. It is not referenced by the production client. Phil's approval and Grok's art review are pending before installing/versioning a production asset under `assets/ui/tower-*`.

## Validation

- `node tests/test_echo_spire_ui.js`: state/action gates, Echo provenance, invalid dates, new-player Guardian state, hostile name escaping, tribute state.
- `node tests/test_echo_spire_client.js`: pending-result persistence, lost-response retention, same-ID resend, response/request isolation, server contract mapping and frozen start setup; no client reward grants or old ascend endpoint.
- All five executable inline HTML script blocks compile through `new Function`.
- Headless browser: 390px and 320px widths without horizontal overflow; lineup removal disables Fight, re-selection enables it; result feedback and tribute disabled after claim. No live accounts or rewards used.

Server rig integration and an actual Guardian/Echo battle await Claude's server branch. These local view/adapter checks do not establish a full fight or release pass. No deployment performed.
