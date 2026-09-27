# Public Ward Flow PR checks

The public `BigSimmo/Ward-Flow` repository retains its current application source. The `Ward Flow CI`
workflow runs on pull requests to `main` and merge groups. It uses a read-only token, pinned actions,
locked dependencies, and synthetic browser configuration. It does not deploy the application.

Documentation-only changes run CI contracts and Ward document-link validation. Other changes run
reference and legal-language checks, typechecking, the reconciled offline unit population, and Ward
browser journeys. `Ward Flow required` passes only when validation succeeds.

The previous broad PsychSift `CI` workflow is managed separately at the GitHub workflow setting
because its local file is currently owned by another Ward Flow thread. Do not enable repository
Actions until that workflow is disabled, or it will also run. Require `Ward Flow required` in the
default-branch ruleset only after its hosted identity and outcomes have been observed.

Current public-source baseline at preparation: reference data passes; Ward legal wording and two
archived document links fail. These failures are not waived. A first hosted run must establish unit
and browser outcomes before the PR check can be considered ready.
