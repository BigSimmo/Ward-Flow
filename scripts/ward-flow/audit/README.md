# Ward Flow audit helpers

Restored from the 2026-09-22 Temp aside (`ward-lead-aside-20260922-wave4/.audit-reports/`).
These are local measurement and browser-stabilisation helpers from the adversarial audit —
not part of the fold gates.

| Script | Role |
| ------ | ---- |
| `count-ward-population.mjs` | Count files in the ward offline suite population |
| `measure-ward-suite.mjs` | Run the ward suite with a JSON report even when reds remain |
| `stabilisation-browser-check.mjs` | One-shot Playwright smoke against `WARD_URL` / ensure URL |
| `stabilisation-browser-check-2.mjs` | Second-pass browser checks |

The large suite JSON lives at `docs/ward-flow/audit-artefacts/stabilisation-suite-report.json`.
