# Optional Google sign-in and linking

Claude reviews, runs the full account suites and deploys. Username/password sign-in remains available. No Google credentials or tokens belong in this repository.

1. In Google Cloud, configure the consent screen and create an OAuth client of type **Web application**. Add these authorized JavaScript origins:

   - https://emberweaveheroes.com
   - https://s1.emberweaveheroes.com
   - https://s2.emberweaveheroes.com
   - https://s3.emberweaveheroes.com
   - https://s4.emberweaveheroes.com
   - https://s5.emberweaveheroes.com

   Add the www origin only if players actually use it. Configure the consent screen's test users while in testing mode. This implementation uses the GIS JavaScript credential callback, not a redirect endpoint.
2. Set GOOGLE_OAUTH_CLIENT_ID to that Web client ID on Server 1 and every satellite. The ID is public; a client secret is not needed by this flow. Missing ID hides the optional button. Keep the existing protected account-authority link between servers configured.
3. Allow accounts.google.com/gsi/client and Google's GIS frames if the deployed CSP is more restrictive than this branch. Test the button in a normal browser and the installed TWA; GIS is browser-based, not an embedded WebView sign-in. No automatic One Tap prompt is forced.
4. Configure the game's existing SMTP sender. Google unlink requires the account's separately verified recovery email. The Google email is display-only and never silently becomes the password-reset address.

## Behavior

- Continue with Google is offered beside the existing sign-in/create form. Returning Google subjects select the same account. A new player receives a fixed generated login and chooses their commander nickname through the existing game flow.
- Signed-in players can link Google in account settings. Linking preserves login, nickname and progress. A Google subject already linked to another account cannot be merged through this button.
- Server verification checks Google's RS256 signature using the fixed Google JWKS URL, then audience, issuer, expiry, issue time and the single-use nonce bound to the current game session. The Google credential is never saved; only subject and display email are retained.
- Satellites ask the existing account authority to resolve the Google subject, preserving the game-wide identity. They issue their normal local game session afterward.
- Unlink first requests an emailed code, then requires that code. It reuses acctResetRequest/acctResetVerify, including their 15-minute expiry, per-code five wrong attempts, account/IP daily caps and HTTP rate-limit buckets. A purpose tag prevents a password-reset code from unlinking Google or an unlink code from resetting a password.
- A Google-only account cannot unlink its only sign-in method. First verify a recovery email and use the existing password-reset flow to set a password; successful reset clears googleOnly. Normal password sign-in continues unchanged.
- A guest upgraded through Google is also Google-only until a password is set; a verified recovery email alone does not enable unlinking. An account deleted/replaced while Google verification is awaiting the network cannot be linked through a stale account object.

## Validation and review

Run node tests/test_google_signin.js, node tests/test_play_billing_shell.js and node --check server.js. Offline tests cover stub claims, real RSA signature verification, wrong audience, expiry, nonce reuse, same-sub identity, fixed-login linking, conflicts, guest upgrades, normal session issuance, unlink without a code, wrong/expired/right codes, one-time use and the default password-reset branch. All inline game scripts are syntax-compiled.

No real OAuth client, SMTP delivery, deployed satellite calls, browser/TWA sign-in or full account/storage suite was exercised. Claude must review account creation caps, persistence failures, the shared reset-flow change and satellite guest upgrades before release. Google creation and guest upgrades reuse the registration device cap (three accounts) and rolling network/day cap, in addition to endpoint throttles; password registration stays unchanged. End-to-end Play/Google testing still needs Phil's Console configuration.

Official references:

- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
- https://developers.google.com/identity/gsi/web/guides/display-button
- https://developers.google.com/identity/gsi/web/guides/supported-browsers
