# Facebook Login setup (v1271)

Facebook sign in and account linking are built the same way as Google. They stay OFF (no button, `/api/auth/facebook/config` answers `{enabled:false}`) until both environment variables below are set. The app secret never goes in this repository, a log or a reply.

## 1. Meta app (developers.facebook.com, Phil)

1. Create app: type **Consumer**. Add the **Facebook Login** product (Facebook Login, not Login for Business).
2. Settings > Basic:
   - App domains: `emberweaveheroes.com`
   - Privacy Policy URL: `https://emberweaveheroes.com/privacy`
   - Terms of Service URL: `https://emberweaveheroes.com/terms`
   - User data deletion: choose **Data deletion callback URL** = `https://emberweaveheroes.com/api/auth/facebook/data-deletion` (the instructions page `https://emberweaveheroes.com/facebook-data-deletion` is also live if you prefer "Data deletion instructions URL").
   - Add platform **Website**, Site URL `https://emberweaveheroes.com/`.
3. Facebook Login > Settings:
   - Login with the JavaScript SDK: **Yes**.
   - Allowed Domains for the JavaScript SDK and Valid OAuth Redirect URIs: `https://emberweaveheroes.com/`, `https://s1.emberweaveheroes.com/` ... `https://s5.emberweaveheroes.com/` (add `www.` only if players use it).
   - Client OAuth login: Yes. Web OAuth login: Yes. Enforce HTTPS: Yes.
4. Permissions: `public_profile` and `email` only (both standard; no App Review needed for them). Switch the app from Development to **Live** when ready; in Development only app roles/testers can sign in.
5. The Privacy Policy should say that Facebook sign-in shares the Facebook user ID, name and email with us (text lives in Archive "Open Projects/Terms and Privacy 2026"; regenerate legal/privacy.html).

## 2. Servers (Phil sets these himself on all 5)

```
FACEBOOK_APP_ID=<App ID from Settings > Basic>
FACEBOOK_APP_SECRET=<App Secret from Settings > Basic>
```

Set both on Server 1 (the account authority: it verifies every token and holds the links) and on Servers 2-5 (they show the button and forward to Server 1). Restart each server. Remove either variable to switch Facebook off again.

## How it works

- Client: the Facebook JS SDK (`connect.facebook.net/en_US/sdk.js`) loads only when a Facebook option is on screen; `FB.login` asks for `public_profile,email`; the access token goes to `POST /api/auth/facebook` with a single-use nonce from `/api/auth/facebook/config` bound to the current session.
- Server (`server/facebook-signin.js`): Graph `debug_token` with the app access token - must be `is_valid`, our `app_id`, a `USER` token, not expired, with a `user_id`; then `/me?fields=id,name,email` with `appsecret_proof` must return the same id. Any error or timeout refuses.
- Stored: `u.facebook = {id, name?, email?, linkedAt}`. One Facebook id per account and one account per Facebook id (clear errors on conflict). The Facebook email is display-only, never a password-reset address. The token is never stored.
- New Facebook accounts and guest upgrades use Google's rules: three accounts per device, the network/day cap, ban check, fixed generated login (`f...`), the player picks a nickname in game.
- Unlink: code to the verified recovery email (purpose `facebook-unlink`, same limits as password reset). A Facebook-only account must set a password first (a password reset clears `facebookOnly`).
- Meta deletion callback: `signed_request` verified with the app secret (HMAC-SHA256), the Facebook data for that user removed (Server 1 too when a satellite receives it), answers `{url, confirmation_code}`. The game account itself stays; it is deleted in Settings > Account > Delete account or via /privacy.

Routes: `GET /api/auth/facebook/config`, `POST /api/auth/facebook`, `POST /api/auth/facebook/unlink-request`, `POST /api/auth/facebook/unlink`, `POST /api/auth/facebook/data-deletion`, page `/facebook-data-deletion`; internal (Server 1, link secret): `/api/internal/account/facebook`, `facebook-unlink`, `facebook-unlink-request`, `facebook-erase`.

Test: `node tests/test_facebook_signin.js` (offline stub Graph transport, includes a control that fails if verification is skipped).
