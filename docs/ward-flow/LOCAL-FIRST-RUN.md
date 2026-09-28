# Ward Flow — local first run

**Audience:** human or agent opening the Ward Flow UI on this machine.  
**Product/process entry:** still [`README.md`](README.md). This page is only how to boot the UI.

## Preconditions

- Worktree: dedicated checkout/worktree of `BigSimmo/Ward-Flow` (e.g. `D:\Worktrees\WardFlow\<branch>`)
- Node `>=24.15.0 <25` and npm `11.x` (see `package.json` `engines` / `packageManager`)
- Dependencies once: `npm ci --include=dev`

## Boot (PowerShell)

```powershell
git status -sb
git log -1 --oneline
npm run ensure
```

`npm run ensure` starts or reuses this worktree's dev server and **prints the URL**. Open:

`<printed-origin>/mockups/ward-flow`

### Port rules

- **Never hardcode a port** in docs, scripts, or chat.
- This worktree's path-stable port is often **3605** (`stableProjectPort`). If busy, `ensure` / `dev` advances — folklore **3606** usually means 3605 was taken.
- Trust only the URL `npm run ensure` prints.

## Env for UI-only mockups

1. Copy `.env.example` → `.env.local` if needed.
2. Follow the Ward Flow / mockups comments in `.env.example`.
3. Ward Flow uses synthetic browser-local state; no Supabase, database, or OpenAI credentials are required.

## Useful checks

```powershell
npm run check:ward-doc-links
npm run ward:check-docs
```

## Audit scripts and base URL

One-off audit/capture scripts resolve the app origin via:

1. `WARD_FLOW_URL` if set (no trailing slash), else
2. `http://localhost:` + this worktree's `stableProjectPort`

```powershell
npm run ensure
$env:WARD_FLOW_URL = "<printed-origin>"
node scripts/ward-flow/audit-all-screens-visual.mjs
```

## npm helpers

```bash
npm run ward:first-run    # prints the three boot steps
npm run ward:docs         # prints doc entry paths
npm run ward:check-docs   # same as check:ward-doc-links
npm run ensure            # start/reuse dev server and print URL
```

## Current worktree vs base

- **Base branch:** `main` on `BigSimmo/Ward-Flow`.
- **This worktree:** work on a dedicated task branch in an isolated worktree created from verified `main`. Check `git branch --show-current`.
- Before quoting “the line”, confirm with `git log -1` and [`STATUS.md`](STATUS.md).
- The former local ward line (`codex/task-ward-flow-live-state-20260831`) in `ward-lead` and local-only fold queue are historical PsychSift-era records.

## Do not use for first run

- [`START-LOCAL-CHAT.md`](START-LOCAL-CHAT.md) — stub; archived chat-control procedure
- Dated notes under [`archive/dated-notes/`](archive/dated-notes/README.md) — historical only
