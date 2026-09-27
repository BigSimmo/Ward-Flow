# F05/F11 Community caseload KPI correction

Date: 2026-09-13
Owner: Codex Luna

Replaced the visible Community Caseload three-column prose table with a four-cell KPI band derived directly from the existing `figureRows`: in a bed/holding, discharge date written, discharged into the area, and left another way. Each KPI retains the existing `figureText` output and has a stable KPI test id. The original full `WardTable`, row/value test ids, definitions and all measured-empty/not-computable/no-date branches remain mounted inside keyboard-accessible `details` labelled “How these figures are counted” and marked `source-print` for the existing print disclosure lifecycle.

Adjusted the Community third-edition grid so identity and the primary panels occupy the intended left/right drawing sequence; the Service grid ordering from the earlier bounded task remains unchanged. No engine calculations, links, absence/provenance facts or shared frame files were altered. The current light text-token bridge remains root-owned.

Checks: TypeScript `transpileModule` syntax diagnostics 0; PostCSS parse passed; Prettier passed on the two Community files. No tests, browser, server or provider checks were run.

Visual acceptance and DOD remain pending; this report is implementation/static evidence only.
