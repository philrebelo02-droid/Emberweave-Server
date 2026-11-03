# Google Play billing shell setup

Review shell for Claude. FREE_PACKS stays on. Claude owns finishing, full suites and deployment.

1. In Play Console for `com.emberweave.heroes`, activate these consumable one-time products. Cluster Pack and Burger Meal buy repeatable durations, not subscriptions. Keep multi-quantity disabled.

| ID | Product | US price |
| --- | --- | --- |
| cluster | Cluster Pack: 150 diamonds/day, 14 days | $4.99 |
| burger | Burger Meal: 120 stamina/day, 30 days | $2.99 |
| d500 | 600 Diamonds | $4.99 |
| d1200 | 1,200 Diamonds | $9.99 |
| d2800 | 2,300 Diamonds | $19.99 |
| d6000 | 6,000 Diamonds | $50.00 |
| d12500 | 12,500 Diamonds | $99.99 |

Historical product IDs intentionally differ from some amounts. Set regional prices in Console.

2. Enable Google Play Android Developer API in Google Cloud. Give a service account purchase/order access to this app in Play Console. Provision its key outside the repository; set `GOOGLE_PLAY_SA_KEY` to that file path on the server. Never commit or print credentials. Missing env returns coming soon; unreadable credentials fail closed.
3. Add license testers, publish an internal test track, and install through Play with a tester account. Verify the website assetlinks association and signing certificate.
4. Rebuild the existing `/play` TWA with Play Billing enabled (`features.playBilling.enabled: true` in Bubblewrap, or the equivalent generator setting). Keep package `com.emberweave.heroes` and the existing signing key; increase versionCode. Verify the generated app exposes Digital Goods and Play Billing.
5. Keep free packs on until Phil authorizes the December switch. Only then configure the key and disable SHOP_FREE_PACKS. The paid capability requires free packs off and a configured key path. Ordinary browsers retain current free/coming-soon behavior.

## Integration

The inline playBilling module sends the SKU/token to /api/shop/buy and adopts only the returned server ledger. A narrow Play alias uses the existing /api/shop/purchase credit block; currency purchases retain their old route.

The adapter uses fixed Google OAuth and products.get/consume endpoints. It requires purchaseState 0, consumptionState 0, a single item and an order ID. If returned, productId/purchaseToken must match the requested SKU/token and refundableQuantity must be one. The package is fixed server-side; caller-supplied package names are never used. All seven products are consumable; consumption also acknowledges them. While FREE_PACKS is on, the server rejects new paid receipts as well as hiding the paid client flow.

Permanent SHA-256 token records in led.playTokens are separate from capped purchase history. Credit and token record commit together before consumption. The paid route waits for the request's grouped disk save and any pending/in-flight save before consumption, including replays which can see another request's provisional token. Failed storage never consumes. Failed consumption returns settlementPending; the credited owner's token resubmission retries consumption while refusing another credit.

## Validation and Claude finish checks

Run node tests/test_play_billing_shell.js and syntax checks for server.js and server/play-billing.js. Offline tests stub Google transport and durable storage. No real payment, credentials, app rebuild, full game suite or deployment has been performed.

Before release, run the existing shop/storage suites and internal-track purchase tests. Review the asynchronous verification boundary against request batching. Finish interrupted-purchase recovery using listPurchases on launch/resume and pending-to-purchased transitions, plus durable consume retry scheduling. The shell has no background retry worker. Review token retention across account deletion and multi-instance serialization. Show localized Play catalogue prices in the paid TWA. These are release checks for Claude; the current free-pack flow stays enabled.

Official references:

- https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing
- https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products
- https://developer.android.com/google/play/billing/integrate
