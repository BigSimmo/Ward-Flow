# Ward Flow

A ward and bed-coordination prototype for mental health services: referrals, patient movements, transport, delays and capacity.

**All patient data is synthetic. This is a development prototype, not an approved system for real patient care.**

## Hosted prototype

[Open Ward Flow](https://ward-flow-production.up.railway.app/).

The 27 September 2026 hosting record describes a separate **Ward Flow** Railway project connected to `main`. Its current hosted state was not rechecked in the 2 October documentation repair. See [hosting and database decisions](docs/hosting.md) for the dated configuration and limitations.

**Ward Flow must not connect to Supabase. Azure is the intended backend platform.** The UI uses browser-local synthetic state; the separate backend work is documented in [the backend guide](backend/ward-flow/README.md). Local source does not prove hosted provisioning, credentials or connectivity.

## About this repository

This is the public source snapshot of the main local Ward Flow branch, published with the owner's permission on 27 September 2026. It includes the application's source, synthetic fixtures, tests, documentation and existing tooling. It starts with fresh Git history, separate from PsychSift.

- Source snapshot: `f31140455260178209ca21e6fad05d046fd193a6`.
- Project entry point: [Ward Flow documentation](docs/ward-flow/README.md).
- Architecture: [current orientation](docs/codebase-index.md); the [dated code map](docs/ward-flow/code-map/README.md) preserves detailed source history.
- Current task scope and evidence: [task lifecycle](docs/task-receipts.md). [Historical status](docs/ward-flow/STATUS.md) preserves dated decisions and limitations; verify them against current source before commissioning work.
- Original source README: [local source README](README.local-source.md).

## Local development

The package specifies Node.js 24.15 or later within version 24, and npm 11. Use the versions in `package.json` and `.node-version`.

```sh
npm ci
npm run ensure
```

Use the URL printed by the launcher and open `/mockups/ward-flow`. Ward Flow uses synthetic browser state; no Supabase or OpenAI credentials are required. Optional settings are documented in `.env.example`. Never commit a real `.env.local` or credentials.

## Publication scope

This upload preserves the current project; it does not claim a fresh build or test pass. Existing scripts, historical documents and local workflow instructions may still refer to the original workstation, local-only development policy or retired PsychSift tooling. Those references do not connect this repository to the original deployment.

The upload record reported GitHub Actions disabled on 27 September 2026. By the 2 October local inspection, this repository includes a dedicated Ward Flow CI workflow; a read-only GitHub check on 2 October 2026 found Actions enabled and Ward Flow CI active. Passing runs and deployment require separate evidence. Railway deployment was documented as a separate GitHub integration. Do not enable inherited automation without adapting and reviewing it for this repository.

The 27 September upload excluded Git history, uncommitted work from other sessions, local environment files, installed dependencies, build output and machine-specific agent/editor configuration. Later commits have changed the source snapshot; inspect this repository's history for the current revision. The original source README remains linked above.

## Licence

The existing [licence](LICENSE) is retained. Public visibility does not grant an additional open-source licence.
