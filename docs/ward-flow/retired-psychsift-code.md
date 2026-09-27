# Retired PsychSift code worth knowing about

PsychSift, the clinical search app that shared this repository, was removed from the ward line in
September 2026 (batch 3a, then the final removal pass). Everything it contained is still in git.
This note names where to find the parts Ward Flow is likely to want when it gets real sign-in, a
database or a server.

## Where it is

- **Archive commit:** `af4ab636e9`, the last ward-line state with all of PsychSift present.
- **Archive branch:** `backup/2026-09-25-psychsift-final-pre-delete` (local only, never pushed; ask
  Josh before deleting it).
- Read a file with `git show af4ab636e9:<path>`, or restore it with
  `git restore --source=af4ab636e9 -- <path>`.

## Parts worth reusing

| When Ward Flow needs                       | Look at (at `af4ab636e9`)                                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A real data store behind the demo reducer  | `src/lib/caring-contacts/repository.ts` (the contract), `in-memory-repository.ts` and `db/postgres-repository.ts`, with one shared suite in `tests/helpers/caring-contacts-repository-contract.ts` |
| An audit trail that holds no patient data  | `src/lib/caring-contacts/access-audit.ts`                                                                                                                                                          |
| Role permissions and retention rules       | `src/lib/caring-contacts/permissions.ts`, `src/lib/caring-contacts/retention.ts`                                                                                                                   |
| Real sign-in                               | `src/lib/supabase/auth.ts`, `client.tsx`, `server.ts`, and the per-account browser storage clean-up in `src/components/account-data-provider.tsx`                                                  |
| Request rate limiting and body validation  | `src/lib/api-rate-limit.ts`, `src/lib/validation/body.ts`                                                                                                                                          |
| A check that no secret reaches the browser | `scripts/check-client-bundle-secrets.mjs`                                                                                                                                                          |
| Error tracking that scrubs private text    | `src/lib/observability/error-tracking.ts`                                                                                                                                                          |

None of these is wired into Ward Flow, and each was written for PsychSift's own data. Read before
reusing; do not restore a file and assume it fits.

## What was kept rather than retired

The generic UI parts (buttons, chips, tabs, dialogs, toasts and the rest in `src/components/ui/`),
small list and filter helpers, the design-scale checks and the lint rules stayed in the repository.
The full list, with the reason for each, is in the removal list attached to the "Remove PsychSift
leftovers" thread.
