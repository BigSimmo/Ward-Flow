# Ward Flow

A ward and bed-coordination prototype for mental health services: referrals, patient movements, transport, delays and capacity.

**All patient data is synthetic. This is a development prototype, not an approved system for real patient care.**

## Hosted prototype

[Open Ward Flow](https://ward-flow-production.up.railway.app/).

Railway hosts this repository in a separate **Ward Flow** project, connected to `main`. See [hosting and database decisions](docs/hosting.md) for configuration and limitations.

**Ward Flow must not connect to Supabase. Azure is the intended future database platform.** No Azure database has been provisioned or connected; the current prototype uses browser-local synthetic state.

## About this repository

This is the public source snapshot of the main local Ward Flow branch, published with the owner's permission on 27 September 2026. It includes the application's source, synthetic fixtures, tests, documentation and existing tooling. It starts with fresh Git history, separate from PsychSift.

- Source snapshot: `f31140455260178209ca21e6fad05d046fd193a6`.
- Project entry point: [Ward Flow documentation](docs/ward-flow/README.md).
- Architecture: [code map](docs/ward-flow/code-map/README.md).
- Product status and limitations: [status](docs/ward-flow/STATUS.md).
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

GitHub Actions remains disabled because the inherited workflow still includes unrelated provider and deployment checks. Railway deployment is a separate GitHub integration. Do not enable inherited automation without adapting and reviewing it for this repository. No database connection has been configured.

Git history, uncommitted work from other sessions, local environment files, installed dependencies, build output and machine-specific agent/editor configuration were not uploaded. All retained original files except this README are unchanged from the recorded source snapshot; the original README is preserved above.

## Licence

The existing [licence](LICENSE) is retained. Public visibility does not grant an additional open-source licence.
