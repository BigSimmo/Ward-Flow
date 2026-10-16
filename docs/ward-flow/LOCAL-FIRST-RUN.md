# Ward Flow — local first run

**Audience:** anyone opening the Ward Flow UI on their own machine (Windows, macOS or Linux).
**Product/process entry:** [`README.md`](README.md). This page is only how to boot the UI.

## Preconditions

- A checkout of `BigSimmo/Ward-Flow` on a task branch (see [`AGENTS.md`](../../AGENTS.md) for the worktree rules).
- Node `24.19.0` (`.nvmrc` and `.node-version`) and npm `11`. With nvm, fnm or Volta, run `nvm use`
  (or the equivalent) in the repository root.
- Dependencies once: `npm ci`. This also installs the Git hooks.

## Boot

The same commands work in PowerShell, bash and zsh:

```sh
git status -sb
npm run ensure
```

`npm run ensure` starts or reuses this checkout's dev server and **prints the URL**. Open
`<printed-origin>/mockups/ward-flow`.

### Port rules

- **Never hardcode a port** in docs, scripts or chat.
- The launcher chooses a path-stable port for this checkout and moves on if that port is busy.
- Trust only the URL `npm run ensure` prints.

## Environment for the UI

1. Copy `.env.example` to `.env.local` if you need to change anything.
2. Follow the Ward Flow and mockup comments in `.env.example`.
3. Ward Flow uses synthetic browser-local state. No Supabase, database or OpenAI credentials are needed.

## Useful checks

```sh
npx vitest run tests/ward-model.test.ts    # one unit test file, fast
npm run lint
npm run typecheck
npm run docs:check-links                   # links and anchors in tracked Markdown
```

## Audit scripts and base URL

One-off audit and capture scripts find the app origin from:

1. `WARD_FLOW_URL` if set (no trailing slash), else
2. `http://localhost:` plus this checkout's `stableProjectPort`.

```sh
npm run ensure
# bash or zsh
WARD_FLOW_URL="<printed-origin>" node scripts/ward-flow/audit-all-screens-visual.mjs
# PowerShell
$env:WARD_FLOW_URL = "<printed-origin>"; node scripts/ward-flow/audit-all-screens-visual.mjs
```

## Sign-out log (optional)

On Josh's PC, the pre-commit hook checks file sign-outs in `D:/Repos/ward-flow-logs/sign-out.md`.
Set `WARD_SIGNOUT_FILE` to use a log elsewhere. Without a log, the hook prints a notice and skips
that check.

## Current checkout vs base

- **Base branch:** `main` on `BigSimmo/Ward-Flow`.
- Work on a dedicated task branch created from verified `main`. Check `git branch --show-current`.
- Before quoting the current state, confirm with `git log -1` and [`STATUS.md`](STATUS.md).

## Do not use for first run

- [`START-LOCAL-CHAT.md`](START-LOCAL-CHAT.md) — kept stub. The archived chat-control procedure it pointed to was removed in the 15 Oct 2026 docs trim
- Dated notes under [`archive/dated-notes/`](archive/dated-notes/README.md) — historical only
