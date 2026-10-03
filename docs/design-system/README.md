# PsychSift design system — document set

> **Current scope.** This document set was inherited from PsychSift. Apply shared design rules only within the [Ward Flow repository boundary](../../AGENTS.md). PsychSift project state, hosted CI and historical measured figures are not current Ward Flow evidence.

> [!NOTE]
> **Ward Flow Baseline Status (Owner Decisions: 25 Sep & 2 Oct 2026):**
> This document set describes the historical PsychSift design system and token migration layer.
> For Ward Flow (`BigSimmo/Ward-Flow`), the owner reconfirmed the current local `main` rendered UI as the authoritative visual and behavioral baseline. Historical drawings and token prescriptions do not authorise restyling it; preserve understandable status and accessible controls.

The system of record for the v2 design system. **Rules and roles live here; values live
only in the token files.** Source-of-truth ranking: `AGENTS.md` → `ckb-v2-tokens.css` →
committed tests → `.design-sync/conventions.md` → this set. Where this set contradicts a
higher source, the higher source wins and the contradiction is a defect here.

For current Ward work, start at the [Ward entry point](../ward-flow/README.md), agreed task
scope and [receipt contract](../task-receipts.md); the [ledger](../ward-flow-task-ledger.md)
indexes existing task IDs. The old PsychSift outstanding-issues source is foreign historical
provenance; its current location is unverified. Ward Flow's `origin/main` is Ward Flow main.
Historical design prescriptions do not override the latest approved Ward app.

[HANDOVER-2026-08-07.md](HANDOVER-2026-08-07.md) is **superseded and must not be used to
scope work** (`#277`). Nine open rows cite it as their Source, but four of its figures have
since been disproved and the corrections live in those rows rather than in the document,
which still asserts the originals. It is kept for provenance — the citations, the PR and
commit record, and its verification and gotcha sections — and carries a banner listing what
is known wrong.

Reading order:

1. [SPEC.md](SPEC.md) — principles, foundations, patterns, degraded states, accessibility,
   content design, the migration playbook (§13) and the authoring definition of done (§14).
2. [TOKENS.md](TOKENS.md) — the reconciled inventory: every role, winner, owner, and the
   per-group allowed/forbidden usage rules (§7).
3. [COMPONENTS.md](COMPONENTS.md) — maturity matrix (§0), the eight safety-component
   specifications (§1–§8), and the binding contract per existing component (§9).
4. [DECISIONS.md](DECISIONS.md) — conflicts C1–C5 resolved, the clinical Q&A record,
   assumptions, and the resolution log.
5. [GATES.md](GATES.md) — every rule paired with its enforcement status. A prohibition
   with no row there is a suggestion.
6. [FIX-GUIDE.md](FIX-GUIDE.md) — Hazard 1–2 sweep dispositions (Fixed / Documented / Deferred / Out-of-scope).

The inherited design references identify `src/app/ckb-v2-tokens.css` as the v2 target
layer and `globals.css` as the compatibility layer. Neither `adoption-manifest.json`
nor `adoption-contract.json` is present in this checkout. This document therefore
does not establish current rendered adoption, baseline status or check enforcement.

Preserve the existing requirement for human-approved screenshots and exact hosted
provenance when claiming design readiness. Inspect the current Ward Flow checks and
applicable acceptance rules before making that claim; historical green checks and
declared surfaces are insufficient. Design project `08d6f126-3fd0-4764-aedf-0062a467280a`
is not verified by this repository; local design-sync parity is not remote publication proof.
