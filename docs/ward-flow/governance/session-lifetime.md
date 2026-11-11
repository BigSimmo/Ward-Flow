# Session lifetime on shared computers

_Created 2026-11-10 for audit item M50, on branch `claude/project-thread-bnphlk` (from `main` `29352cd0`).
Current guidance, kept with the code. Security owns it._

**For:** Josh and anyone changing how long a sign-in lasts. **Status:** draft. The Ward Flow values
below are read from the source at `29352cd0` and pinned by tests. The two Supabase values are provider
settings that nobody has looked at for this page: Josh still has to read them in the Supabase dashboard
and date the rows (AGENTS.md rule 3). One value needs his decision (below).

Every number that decides how long a sign-in, a pass or a grant lasts is listed here, once, with where it
comes from. If you change one, change it at its source and update this table in the same pull request.

## The settings

| What                                            | Value                                                                                           | Source                                                                                                                                              | Proven by                                                                                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in limit (shared workspace)                | 12 hours from the first sign-in factor, however busy the desk                                   | `CLINICAL_VALUES.sessionLimit` (signed 17 Oct 2026); server `SESSION_LIMIT_MINUTES` in `backend/ward-flow/engine.ts`, enforced in `shared-http.mjs` | `backend/ward-flow/shared-http.test.mjs` "a sign-in older than the session limit is refused on every route"; `tests/ward-audit-m50-session-lifetime.test.ts`                       |
| Warning before the sign-in limit                | 10 minutes                                                                                      | `CLINICAL_VALUES.sessionWarning` (signed 21 Oct 2026), `ward-shared-access.tsx`                                                                     | `tests/ward-audit-m50-session-lifetime.test.ts` (value)                                                                                                                            |
| Idle lock (every desk, shared computer or not)  | 15 minutes without use, then the shared workspace signs out                                     | `CLINICAL_VALUES.idleLock` (signed 16 Oct 2026), `WardIdleLock` in `shell/ward-access.tsx`                                                          | `tests/ward-session-safeguards.dom.test.tsx` (locks, signs out, woken laptop, clock set back)                                                                                      |
| "Still there?" warning before the idle sign-out | 60 seconds                                                                                      | `IDLE_WARNING_SECONDS` in `shell/ward-access.tsx`                                                                                                   | `tests/ward-session-safeguards.dom.test.tsx` "asks 'Still there?' for the last minute"                                                                                             |
| Recent sign-in for powerful steps               | 10 minutes (granting access, cover, break glass)                                                | `CLINICAL_VALUES.stepUpWindow`; server `STEP_UP_MINUTES`                                                                                            | `backend/ward-flow/shared-http.test.mjs` (step-up refusals)                                                                                                                        |
| Front door pass, account                        | 12 hours, never past the sign-in's own limit; ends on sign-out                                  | `ACCOUNT_PASS_HOURS` in `src/lib/front-door-pass.ts`, `src/app/api/session/route.ts`                                                                | `tests/front-door-pass.test.ts` "ends with the sign-in's own limit"; M50 test pins it to `sessionLimit`                                                                            |
| Front door pass, demo code                      | 8 hours                                                                                         | `DEMO_PASS_HOURS` in `src/lib/front-door-pass.ts`                                                                                                   | `tests/ward-audit-m50-session-lifetime.test.ts` "ends a demo pass at 8 hours"                                                                                                      |
| Where the pass is kept                          | `wf_pass` cookie: HttpOnly, SameSite=Lax, Secure on https                                       | `src/app/api/session/route.ts`                                                                                                                      | `tests/front-door-pass.test.ts`                                                                                                                                                    |
| Supabase access token lifetime                  | 1 hour (Supabase default; **not read from the dashboard**)                                      | Supabase dashboard, Authentication, Sessions / JWT expiry                                                                                           | Code assumes it only as a ceiling: `backend/ward-flow/supabase-auth.test.mjs` refuses expired tokens                                                                               |
| Supabase refresh token reuse interval           | 10 seconds (Supabase default; **not read from the dashboard**)                                  | Supabase dashboard, Authentication, Sessions                                                                                                        | `tests/ward-audit-m50-session-lifetime.test.ts` (two tabs inside and outside the interval)                                                                                         |
| Where the refresh token is kept                 | This tab's session storage only, key `ward-flow:auth:<project>:v1`; access token in memory only | `ward-supabase-auth.ts` (H-0044), `ward-auth-session.ts` `tabStorage`                                                                               | `tests/ward-supabase-auth.test.ts` "keeps the access token in memory only"                                                                                                         |
| Password reset link                             | One use, this browser only, verifier kept 1 hour                                                | `WARD_RECOVERY_VERIFIER_LIFETIME_MS` in `ward-auth-link.ts` (PKCE, SEC-2)                                                                           | `tests/ward-supabase-auth.test.ts` "takes the code off the address … once", "refuses a code opened in another browser", "refuses and clears a verifier older than the link's hour" |
| Break glass opening                             | `CLINICAL_VALUES.breakGlassWindow` minutes, then the record closes                              | `breakGlassWindow`; server `BREAK_GLASS_MINUTES`                                                                                                    | `backend/ward-flow/postgres.test.mjs` "roles come from memberships"; `tests/ward-audit-m58-break-glass-cover.test.ts`                                                              |
| Cover                                           | Up to 12 hours, ends by itself                                                                  | `CLINICAL_VALUES.coverLength`                                                                                                                       | `tests/ward-access-admin.test.ts`; `backend/ward-flow/postgres.test.mjs` "shared views follow cover changes"                                                                       |
| Unused role switch-off, role ceiling            | `accessUnused` days; 12 months at most                                                          | `CLINICAL_VALUES.accessUnused`, `accessMaxTerm`                                                                                                     | `tests/ward-access-admin.test.ts`; `postgres.test.mjs` "the not used switch-off"                                                                                                   |

## Races and reuse

- **Two refreshes in one tab** share one request: `tests/ward-supabase-auth.test.ts` "coalesces concurrent
  expiring token refresh requests".
- **A duplicated tab** starts with a copy of the first tab's refresh token. Inside Supabase's reuse
  interval both tabs stay signed in; after it, the late tab is signed out cleanly and the first tab is
  untouched (`tests/ward-audit-m50-session-lifetime.test.ts`). This rests on the dashboard value above.
- **A reset link opened twice, or in another browser,** is refused without spending the code again
  (`tests/ward-supabase-auth.test.ts`).

## Still to do (a person)

1. Josh: in the Supabase dashboard, read the access token lifetime and the refresh token reuse interval,
   and write the values and the date in the two rows above. Nothing to change unless they differ.
2. Josh: answer the decision below.

## Decision for Josh: idle time on shared computers

Today every desk locks and signs out after 15 minutes without use (signed 16 October 2026). Ward
computers are shared, often by several nurses in one shift.

1. **Keep 15 minutes for every desk** (recommended). It is already signed, tested and in the help text,
   and a shorter lock would sign nurses out mid-task more often.
2. Shorter on shared ward and ED computers only (for example 5 minutes), 15 elsewhere. Needs a way to
   tell a shared computer from a personal one, which Ward Flow does not have today.
3. Shorter for everyone (for example 10 minutes).

Recommendation: option 1, and look again before real data with the pilot site's own policy.
