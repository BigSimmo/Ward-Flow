# F14 provenance corrections r4

Read-only reproduction of the guard scanner (same heading/paragraph boundaries and marker predicate) identified bare/non-invention prose in the provenance regions. The source-level candidates were: Alerts’ “What is addressed…” paragraph; On-call contact/covered-role sentences; Statistics Compare’s “What is real…” paragraph; Statistics Community’s real team-name paragraph; Statistics Ward’s navigation, computed-figure and unsupported-measure sentences; and Capacity’s non-clinical sentence. The previous focused run had seven remaining provenance offenders after the first On-call edit; the JSON did not serialize their expanded array.

Corrections, preserving the underlying facts:

- Alerts, Compare and Community now give real/non-provenance paragraphs an explicit `<strong>What is real</strong>` subject so the guard does not misclassify them as invented-figure prose.
- Statistics Ward now labels navigation as `Page navigation`, marks the rendered figures as invented and computed from prototype state, and labels the unsupported-measure explanation explicitly. No figures or clinical claims changed.
- Capacity and On-call corrections from r3 remain: clinical-record wording is present, and only the visible On-call banner uses the screen-level query phrase; print details retain self-contained markers.

Actual-before copies for this round are in `C:\Users\joshs\AppData\Local\Temp\f14-prov-r4-before`; hashes were captured before editing. Prettier completed on the four newly edited TSX files, TypeScript transpile diagnostics reported syntax-ok, and `git diff --check` was clean. No tests, browser, server, provider, or hosted checks were run. The provenance guard itself remains unrerun; no green claim is made.
