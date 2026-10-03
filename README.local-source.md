# Original source README — historical provenance

This preserves the original local-only Ward/PsychSift source instructions. Ward Flow is now
the dedicated public `BigSimmo/Ward-Flow` repository; "never pushed" and foreign setup
instructions below are historical. Use [the current README](README.md),
[Ward entry point](docs/ward-flow/README.md) and [task contract](docs/task-receipts.md).
No Supabase/OpenAI credentials are needed for the synthetic Ward UI.

<!-- docs-script-refs:historical-start -->

# Ward Flow

> **Ward Flow (on this branch).** If you are working on wards, beds, referrals, movements or transport,
> start at [`docs/ward-flow/README.md`](docs/ward-flow/README.md). Ward Flow is a separate, local-only
> prototype on branch `codex/task-ward-flow-live-state-20260831` and is never pushed.

Local-first medical guideline RAG knowledge base for a psychiatrist in Perth,
Australia. The app uploads private clinical reference documents to Supabase
Storage, indexes text and extracted image captions into pgvector, and answers
questions with source citations that link back to the original PDF/document.

## Setup

Ward Flow is a local-only prototype: no Supabase, OpenAI, worker, or Edge Function setup is
needed to run it. For the runtime prerequisites (Node/npm versions, the install command, and how
to start the app), see ["Running it"](docs/ward-flow/README.md#running-it) in
[`docs/ward-flow/README.md`](docs/ward-flow/README.md).

## Environment Notes

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it in the browser.
- `SUPABASE_PROJECT_REF` must stay `sjrfecxgysukkwxsowpy` for the live
  `Clinical KB Database` project.
- Documents and extracted images are stored in private Supabase buckets.
- Initial assumptions are guideline/reference documents only, not patient
  identifiable records.
- OpenAI receives extracted document text/images for embeddings, image captions,
  and grounded answer generation.
- `MAX_UPLOAD_MB`, `CHUNK_SIZE`, and `CHUNK_OVERLAP` are deliberately
  conservative defaults for local-first indexing.

## Clinical Safety Status

- This project is a clinical reference prototype, not validated clinical
  decision support.
- Demo documents are synthetic and are not clinical guidance.
- Do not upload patient-identifiable documents unless local governance, privacy,
  and data-processing approvals explicitly allow it.
- Generated answers and copied drafts must be verified against linked source
  documents, source status, local policy, and patient context before clinical
  use.
- Production deployment needs clinical governance review, source approval rules,
  and TGA Software as a Medical Device screening where applicable.
- See `docs/clinical-governance.md` for the deployment governance checklist.

## Cursor MCP

### Supabase

This checkout still carries legacy workspace Supabase MCP configuration in
`.cursor/mcp.json`, targeting the live Clinical KB Database. The PsychSift
database skills have been retired; Ward Flow does not use a database. Do not
enable or use this provider for Ward Flow. Any separately authorised provider
work requires explicit approval, manual tool-call approval and the project
safety rules. Never put secrets into MCP configuration.

### Context7

Workspace config in `.cursor/mcp.json` runs pinned local
`npx -y @upstash/context7-mcp@3.2.5` with `CONTEXT7_API_KEY` from `${env:…}`;
`.cursor/settings.json` enables the `context7-plugin`. Use Context7 for
versioned library docs — **Tailwind 4, Zod 4, Playwright, Vitest, React 19,
`@supabase/supabase-js`** (peers; not exhaustive) — not for Next.js 16: read
`node_modules/next/dist/docs/` locally and do not invent App Router APIs from
Context7 or training data.

Optional `CONTEXT7_API_KEY` (`ctx7sk…`) from [context7.com/dashboard](https://context7.com/dashboard)
raises rate limits. Set it as a user/OS env var, Cursor **Settings → MCP**, or a
Cursor Cloud Agent Secret (shell `process.env`). Local stdio MCP and `npx ctx7`
use that env; a separate host-injected Context7 connector may still ignore it —
fall back to `npx ctx7 library|docs …` if host MCP returns quota exceeded.
Without a key, Cursor expands `${env:CONTEXT7_API_KEY}` to empty and the server
runs anonymously at lower rate limits. **Reload MCP servers** (or restart Cursor)
after setting or rotating the key — the stdio child captures env at spawn.
`.env.local` alone does not expand project MCP `${env:}`. Full setup notes:
`docs/agents-guide.md`. Never commit the API key.

### Figma

The Cursor **Figma** plugin plus `.cursor/mcp.json` (`https://mcp.figma.com/mcp`)
give design ↔ code access (capture live UI, read/write frames, Code Connect).
Enable the plugin / MCP server, complete browser OAuth once, then verify with a
prompt such as: _"Call Figma whoami and report only handle and plan tier."_

**Cursor Cloud Agents:** official Figma remote MCP is **not supported** there today
(Cloud/Automations return Forbidden; OAuth from desktop does not carry over). Use
**Cursor Desktop** (or Codex with its Figma plugin) for Figma MCP. Repo
`.cursor/mcp.json` still helps the IDE; it does not unlock Cloud Agents. Details:
`docs/agents-guide.md`.

## Documentation

Full categorized index: `docs/README.md` (maintained docs vs point-in-time
records vs archive). The most load-bearing entries:

- `docs/codebase-index.md` — architecture and module map (start here)
- `docs/site-map.md` — generated route map (`npm run docs:update`)
- `docs/process-hardening.md` — verification gates, CI expectations, known limits
- `docs/testing.md` — local test safety, focused/live commands, Playwright ownership, flake policy
- `docs/clinical-governance.md` — deployment and source governance checklist
- `docs/deployment-architecture.md` — app/worker/Supabase deployment topology
- `docs/supabase-migration-reconciliation.md` — migration drift and repair policy

Run `npm run docs:check-links` to verify repo paths referenced from the
maintained docs still resolve.

## Commands

Verification gates (see `package.json` for the full chain):

```bash
npm run verify:cheap    # 38 static/consistency gates (check:runtime through
                        # check:owner-scope; `npm run check:gate-manifest` lists
                        # them) + lint + typecheck + test
npm run verify:pr-local # closest local mirror of the PR gate: format + verify:cheap,
                        # plus conditional build/client-bundle scan and RAG
                        # fixture validation; the full unit suite runs once
npm run verify:ui       # check:runtime + required production Chromium journeys
npm run verify:release  # check:runtime + lint + typecheck + test + build + test:e2e
                        # + check:production-readiness + governance:release
                        # + eval:quality:release (needs live Supabase + OpenAI keys)
```

Use `npm run verify:pr-local -- --dry-run --files <comma-separated paths>` to
inspect which checks a change would trigger without running them.

CI is risk-scoped (`.github/workflows/ci.yml`): a `changes` job classifies
changed paths, `static-pr` always runs a small baseline (runtime alignment,
installed-lock parity, the CI-scope and verification-plan self-tests, diff
integrity, and the changed-file format check) and selects the rest — the
action-pin check, lint, typecheck, and the other static gates — by change
scope, and `pr-required` is the single
always-reporting required aggregate (required PR checks are Gitleaks plus that
aggregate). One full unit run with coverage, build, safety/config checks, the
production Chromium gate, the repo-owned Supabase `db-reset-verify` migration
replay, and both Docker image builds run only when their file scopes apply; a
failed applicable container build therefore fails `pr-required`. UI PRs also
get one non-blocking advisory Chromium invocation. The full Playwright browser matrix
(`release-browser-matrix`) runs on `main`, `release/*`, manual dispatch, and a
weekly schedule. Live drift and live eval canary checks remain provider-gated;
Docker image builds also run independently on main/release pushes, schedule,
and manual dispatch. They are not required for source-only PRs outside the
container scope.

```bash
npm run dev       # Next.js UI/API on this project's stable localhost port
npm run ensure    # check/start this project's dev server in the background
npm run start     # production preview on the same safe port selection
npm run worker    # local ingestion worker
npm run check:supabase-project
npm run check:production-readiness # run production readiness validation preflight
npm run check:production-readiness:ci # CI-safe readiness preflight (env-absent tolerant)
npm run samples   # generate synthetic upload corpus
npm run samples:check
npm run lint
npm run typecheck
npm run test
npm run test:focused -- --files src/lib/example.ts
npm run test:live # requires ALLOW_PROVIDER_TESTS=true
npm run test:coverage
npm run test:e2e
npm run test:e2e:pr
npm run test:e2e:advisory
npm run test:e2e:all
npm run test:e2e:accessibility
npm run test:e2e:chromium
npm run test:e2e:visual
npm run check:deployment-readiness
npm run format -- --files <exact-owned-paths>
npm run format:check
npm run build
```

You can still override the port explicitly when needed:

```bash
PORT=4200 npm run dev
npm run dev -- --port 4200
```

On Windows PowerShell:

```powershell
$env:PORT = "4200"; npm run dev
npm run dev -- --port 4200
```

When multiple chats or projects are open, use the URL printed by the command
instead of assuming a shared address such as `http://localhost:3000`.
Codex should also run `npm run ensure` before browser QA or before handing you a
local app link after meaningful frontend changes.

`npm run ensure` starts its dev server detached, so it keeps running after the
task/session that launched it ends. To stop these from accumulating, that
server self-exits after 45 minutes with no request or build activity by
default. Override with `DEV_SERVER_IDLE_MINUTES` (a plain `npm run dev` you
run interactively is unaffected unless you set it yourself); `0` disables the
idle shutdown entirely.

## Sample Corpus

Run `npm run samples` to generate synthetic documents under
`sample-documents/`. They cover PDF, DOCX, XLSX, TXT, PDF image extraction, and
a scanned-style PDF for OCR fallback testing. Upload those files through the UI
and start `npm run worker` to index them. The sample content is deliberately
synthetic and must not be used as clinical guidance.

`sample-documents/` is generated local test output and is intentionally ignored
by Git. The smaller `public/demo-documents/` set is tracked because the app uses
it for demo-mode source and image rendering when live Supabase setup is
unavailable.

## Security

Report vulnerabilities privately — see `SECURITY.md`. Do not open a public issue for
a security problem. Threat models and the privacy assessment live under `docs/`
(`rag-injection-threat-model.md`, `audit/tenancy-defense-in-depth-review.md`,
`privacy-impact-assessment.md`).

## License, ownership, and contributions

Copyright (c) 2026 BigSimmo, for material owned by or validly assigned to the
Repository Owner. Other rightsholders retain their respective rights. All
rights reserved.

This repository is publicly visible for inspection, but Repository
Owner-controlled material is proprietary, is not open source, and is not in the
public domain. No permission is granted to use, run, copy, modify, redistribute,
deploy, commercialise, scrape, or use that material for AI or machine-learning
development except as required by GitHub's applicable terms, applicable law, or
express prior written permission.

See [`LICENSE`](LICENSE) for the proprietary rights notice,
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for the ownership boundary
and embedded licences, and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the signed
assignment requirement that applies before an external contribution may be
merged. The `"license": "UNLICENSED"` declaration in `package.json` is
intentional.

<!-- docs-script-refs:historical-end -->
