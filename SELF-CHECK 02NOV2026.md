# Billing and Google sign-in self-check

Authorized by Phil via Claude, 2 Nov 22:12. Base c9b149c2; same branch. Claude owns review and deployment. Ember owns the full suite and its sim pause/resume. This report covers offline focused checks, not real purchases, Google accounts, SMTP or live storage.

## Confirmed fixes

- FREE_PACKS previously hid the paid client flow but did not refuse paid receipt verification on the server. New Play credits are now refused while packs are free. The prebeta free route remains enabled.
- The actual grouped-save implementation adopts a durableCommit into memory before its IO worker finishes. The purchase route now awaits the save before consuming the token. Replays also wait for open/in-flight saves, so another request's provisional token cannot trigger premature consumption. Deferred-save failure/success and replay controls exercise the real route and barrier with an injected storage promise.
- Play verification now requires consumptionState exactly zero, rejects inconsistent optional productId/purchaseToken and rejects a zero/refunded refundableQuantity when returned. Quantity defaults to one only when absent. Google API failures fail closed.
- Guest accounts upgraded through Google now become googleOnly until a password is set. A recovery email alone cannot make unlinking their only login possible.
- Google linking rejects an account object deleted/replaced during asynchronous Google verification.

## Requested risk review

| Risk | Result and evidence | Remaining limit |
| --- | --- | --- |
| Used Play token, same account / another account / concurrent submissions | Permanent hashed token record; checks before and after verification and inside the commit. Focused replay/race tests pass. Save barrier includes another request's pending save. | Multi-process/multi-server serialization and retention after account deletion remain release blockers. |
| Wrong packageName / productId | Package is fixed to com.emberweave.heroes in the server URL. SKU comes from the server offer allowlist. Unknown SKU, API rejection and mismatched returned product ID/token fail closed in tests. Client package names never control verification. | Real cross-package/product rejection still needs internal-track Google testing. |
| Refunded/canceled/pending purchase | Only purchaseState 0 and consumptionState 0 pass; state 1/2, unexpected/missing consumption state, multi-quantity and refundableQuantity 0 are rejected. | Refund/revocation AFTER credit needs voided-purchase/reconciliation handling before paid release. |
| FREE_PACKS on | Client hides paid capability; server now rejects paid credits without contacting Google. Free packs still grant through prebeta. | December switch requires Phil's authorization. |
| Unlink requires emailed code | Existing reset request/verify functions retain 15-minute expiry, five per-code guesses, account/IP daily caps and HTTP buckets. Missing, wrong, expired, reused and wrong-purpose codes are tested. | Real SMTP delivery and full existing reset/rate suites remain for owner validation. |
| Cannot unlink only login | New Google users and upgraded guests are googleOnly; unlink request and execution refuse them. Password reset clears the flag only after setting a password. | Cross-server password-reset / authority synchronization needs end-to-end validation. |
| One Google ID to one account | Identity uses verified sub, never display email. Conflict/duplicate detection runs synchronously after signature verification. Existing username, nickname and progress remain. | Account-authority failover, persistence rollback and network/session behavior need full-suite review. |

## Validation

- node tests/test_play_billing_shell.js: PASS (one test file).
- node tests/test_google_signin.js: PASS (one test file, also compiles all inline game scripts).
- node --check server.js, server/play-billing.js, server/google-signin.js: 3/3 PASS.
- git diff --check: PASS.
- Focused totals: **2 files passed, 0 failed**. These files contain multiple assertion scenarios; this is not a fabricated count of individual assertions or the full suite.

Other paid-release work remains: interrupted purchase recovery/listPurchases, durable background consume retries, localized prices and real signed-TWA purchase testing. No credentials were read or committed. No deploy, merge, Play upload, owner runtime changes or duplicate full suite were performed.

Primary reference checked during review: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products and https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get (purchase/consumption states, optional product/token fields and fixed request parameters).
