# Ward Flow — definition of done

A task is done only when every box below is ticked. If one cannot be ticked, the task is not done:
say which box and why in the thread and the current checkpoint/receipt under
[task receipt guidance](../task-receipts.md). STATUS is historical. Screens have an extra
checklist on top of this one: [`SCREEN-DEFINITION-OF-DONE.md`](SCREEN-DEFINITION-OF-DONE.md).

## The checklist

- [ ] **The build passes.** For any code change, the type check passes
      (`npm run typecheck`). If routes, configuration or dependencies
      changed, `npm run build` passes too. For documentation-only changes, the ward doc-link check
      passes instead (`npm run check:ward-doc-links`).
- [ ] **The tests for the areas you touched pass.** Run the test files for what you changed
      (`npm run test:focused -- --files <paths>`). Changes to the engine need the full offline ward
      suite (`npm run check:ward-expected-reds`) before integration. Never skip, disable or loosen a
      test to make it pass. Report any failure honestly, with the one line that shows it.
- [ ] **It is committed locally.** Small commits on your own branch in your own worktree. Nothing
      finished is left uncommitted. Publication is a separately authorised stage.
- [ ] **The current task checkpoint and receipt are updated with verified results.** Record what
      changed, which checks ran, their result, and the commit they ran on. Only results you actually
      saw go in; anything not run is written as "not run".
- [ ] **The decision log is updated if a choice was made.** If the task settled a question of scope,
      direction or how the work is run, add an entry to [`decisions.md`](decisions.md). Clinical or
      product behaviour rulings also go in [`OWNER-RULINGS.md`](OWNER-RULINGS.md).

## Integration is a separate stage

Follow the dedicated repository's [boundary](../../AGENTS.md) and
[HOW-WE-WORK](HOW-WE-WORK.md). Preserve exact-file ownership, reviewed diffs and
required checks. Hand off the committed branch and evidence; integration,
publication and deployment retain their applicable authority. The former
Database fold lock and ward-lead home procedure do not apply here.
