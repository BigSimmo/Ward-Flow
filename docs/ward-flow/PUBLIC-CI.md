# Public Ward Flow PR checks

The public `BigSimmo/Ward-Flow` repository retains its current application source. The `Ward Flow CI`
workflow runs on pull requests to `main` and merge groups. It uses a read-only token, pinned actions,
locked dependencies, and synthetic browser configuration. It does not deploy the application.

Documentation-only changes run CI contracts, Ward document-link validation, and the screen-verification
record check. Other changes also run reference and legal-language checks, typechecking, the reconciled
offline unit population, and Ward browser journeys, including an HTTP response check for every route
in `scripts/ward-flow/shot-routes.txt`. New package manifest changes receive GitHub dependency review.
Failing browser journeys upload their traces and screenshots for three days. `Ward Flow required`
passes only when validation succeeds.

The previous broad PsychSift `CI` workflow is disabled in GitHub settings. The default-branch ruleset
requires `Ward Flow required` and resolved review conversations. Repository auto-merge is available
when GitHub's PR requirements permit it. The workflow uses no write token or application deployment.

The first hosted run on public `main` found broken local evidence links, four legal-wording lines and
inherited unit tests that refer to agent tooling absent from the public checkout. Its reference,
typecheck and browser journey steps passed. These failures are not waived; a later hosted run on the
final PR head must pass before the change is ready to merge. The screen-verification record check
checks record structure and freshness, not whether the rendered screens visually match their designs.
