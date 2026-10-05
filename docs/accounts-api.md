# Milestone 1: accounts and web foundation

Implemented on `feature/milestone-1`: email/password accounts, transactional profile provisioning, onboarding/settings, recovery, session logout, verified Google sign-in/linking, and a responsive English/Arabic web shell. Google needs your OAuth web client configuration before live sign-in can be exercised. No generated design files are merged into this branch.

## Run and configure

Follow [the root setup guide](../README.md), apply migrations, and run Django on `127.0.0.1:8000` and Vite on `127.0.0.1:5173`. Use the same hostname throughout a flow so cookies remain consistent. The Vite development server proxies `/api` to Django; no browser token is stored in localStorage. Production should serve/proxy the API on the same origin with HTTPS and correctly configured trusted origins/cookie settings.

Local defaults write password-reset messages to ignored `.local-emails/`. Open the message to obtain the recovery URL. To deliver email, configure `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, host/port, credentials, TLS, and a verified sender in `.env`. Recovery always returns a generic response; mail delivery errors log only a sanitized warning.

Create a Google OAuth **web application** client and add the actual frontend origins (for example `http://127.0.0.1:5173` and `http://localhost:5173`) as authorized JavaScript origins. Set `GOOGLE_CLIENT_ID` in `.env` and restart Django. The public client ID is returned by the configuration endpoint; no client secret is needed for this ID-token flow. Without a client ID, the UI offers email/password and the Google API returns an explicit unavailable response.

The implementation uses [Google's verification library](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) for signature, audience, issuer, and expiry checks. A verified provider subject is the identity key. A short-lived session-bound nonce prevents replay, and account linking requires authentication within the last ten minutes. Even a verified matching email never automatically merges an existing account. Google is treated as authoritative for email verification only for Gmail or verified Workspace domains.

## Session and CSRF contract

1. `GET /api/auth/csrf/` obtains a CSRF cookie and a `csrf_token` response value.
2. Send `X-CSRFToken` on every POST/PATCH together with the same cookie jar.
3. Registration/login rotate the session and CSRF token. Use the new `csrf_token` from their responses (the browser client reads the current cookie).
4. The HttpOnly session cookie authenticates subsequent requests. Logout invalidates the session. Successful password recovery invalidates earlier password-authenticated sessions.

Login endpoints enforce CSRF even for anonymous requests, as required for [session authentication](https://www.django-rest-framework.org/api-guide/authentication/#sessionauthentication). Cookies are SameSite=Lax and Secure when `DJANGO_DEBUG=false`. Account responses include private/no-store cache controls. Logout/account changes also notify other open browser tabs to clear stale account state and recheck their session. The browser retains account data only in memory; persistent offline account storage is a later milestone.

Credential writes are throttled to 30 per minute, recovery writes to 10 per hour, and profile operations to 120 per minute using DRF scoped throttles. Bootstrap/configuration/session reads do not consume credential-attempt budgets. The current in-process cache is suitable for local development; deployment must use a shared throttle cache and appropriate infrastructure controls before release.

## Endpoints

All payloads are JSON. Errors use DRF field errors or `{ "detail": "…", "code": "…" }`; CSRF middleware failures may be HTML. Missing authentication on protected session endpoints returns **403**, and invalid login credentials return **401**.

| Method | Endpoint | Purpose / input | Success |
| --- | --- | --- | --- |
| GET | `/api/health/` | Database reachability | 200; 503 if unavailable |
| GET | `/api/auth/csrf/` | CSRF bootstrap | 200 |
| POST | `/api/auth/register/` | `email`, `password`; creates user/profile and session | 201 |
| POST | `/api/auth/login/` | `email`, `password`; creates session | 200 |
| POST | `/api/auth/logout/` | Authenticated session, empty object | 200 |
| GET | `/api/auth/me/` | Current user, profile, connected providers | 200 |
| GET | `/api/profile/` | Current owner's profile only | 200 |
| PATCH | `/api/profile/` | Required current `revision`, plus editable preferences | 200 |
| POST | `/api/auth/password-reset/` | `email`; generic recovery response | 202 |
| POST | `/api/auth/password-reset/confirm/` | `uid`, `token`, new `password` from recovery link | 200 |
| GET | `/api/auth/google/config/` | `enabled` and public `client_id` | 200 |
| POST | `/api/auth/google/challenge/` | `purpose`: `signin` or `link`; returns nonce/client ID | 200 |
| POST | `/api/auth/google/` | `credential`: genuine nonce-bound Google ID token | 200 |
| POST | `/api/auth/google/link/` | Fresh authenticated session and nonce-bound `credential` | 200 |

Registration/login/Google session responses contain:

```json
{
  "user": {"id": "uuid", "email": "you@example.com", "has_password": true},
  "profile": {
    "user_id": "uuid", "display_name": "", "timezone": "UTC",
    "weight_unit": "kg", "language": "en", "goal": "cutting",
    "height_cm": null, "revision": 1,
    "created_at": "timestamp", "updated_at": "timestamp"
  },
  "identities": [],
  "csrf_token": "rotated-token"
}
```

An empty display name means onboarding remains to be completed. The profile is provisioned transactionally by supported account-creation flows; the migration also provisions profiles for pre-existing users. Admin creation provisions a profile as well.

Editable profile fields are `display_name` (nonblank, at most 100 characters), valid IANA `timezone`, `weight_unit` (`kg`/`lb`), `language` (`en`/`ar`), `goal` (`cutting`/`bulking`), and optional positive `height_cm` (decimal, up to three places). Heights are returned as decimal strings. No age, sex, activity-level input, or automatic nutrition estimation is introduced.

Send the current revision with each update. A stale revision returns **409**, code `revision_conflict`, and the authoritative profile for explicit reload. Unknown fields, including owner IDs and privilege flags, are rejected. There is no endpoint for accessing another user's profile. Future date/history modules must preserve historical dates when timezone or unit preferences change.

Recovery links are single-use and expire after one hour; a later login can also invalidate an older recovery link under Django's token contract. Re-request a link if necessary. Valid recovery can establish an email password for a Google-only account after proof of mailbox ownership.

## Postman files

Import both:

- [TrainFuel.postman_collection.json](postman/TrainFuel.postman_collection.json)
- [TrainFuel.local.postman_environment.json](postman/TrainFuel.local.postman_environment.json)

Select **TrainFuel — Local**, leave the cookie jar enabled, and run **Core lifecycle**, then **Negative checks**. Core creates a unique test account, captures CSRF/user/revision values, completes onboarding, tests logout protection, and signs back in. Negative checks cover stale revisions, invalid values, owner-field injection, missing CSRF, duplicate email, and incorrect passwords. These runs create labeled test accounts in your local development database.

Run **Password recovery — manual email token** separately. After the first request, read the local message/delivered email and fill `reset_uid` and `reset_token`. The confirmation request consumes the token and signs out; the following request uses `new_password` and updates the environment password.

Run **Google — manual provider credential** only after configuration. For sign-in, first sign out, obtain a challenge, and mint a real Google ID token with that nonce and your client ID. Paste it into `google_credential` and retain the same Postman cookie session. For linking, sign in to the intended account, obtain a **link** challenge, then mint a new token using that nonce. A token from a different browser challenge is intentionally rejected. The final linking requests are an alternative flow, not an instruction to merge an existing Google user into another account.

The provided environment contains demonstration credentials and blank tokens only. Export actual credentials/tokens only to an ignored `*.postman_environment.local.json` file. Do not commit session cookies, live Google credentials, reset tokens, or real passwords.

## Verification and limits

```bash
backend/.venv/bin/python backend/manage.py test accounts config
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
cd frontend
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests run desktop/mobile viewports against the local servers, create uniquely named test accounts, and check registration, onboarding, persistence, login errors, logout protection, Arabic/RTL, and keyboard form behavior. Backend tests also check atomic provisioning, database constraints, rate limits, reset-token/session behavior, Google identity boundaries, nonce validation, and mocked provider verification. Live Google and delivered email verification require the external configuration above.

The shell clearly labels tracking tools as coming later. Offline persistence/sync, training/nutrition/progress features, account deletion/export, and production release readiness remain later milestones. The private local access policy for expired sessions is established with offline storage, not simulated by this milestone.
