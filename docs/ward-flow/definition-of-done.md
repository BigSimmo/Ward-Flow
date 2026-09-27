# Ward Flow — definition of done

A task is done only when every box below is ticked. If one cannot be ticked, the task is not done:
say which box and why, in the thread and in [`STATUS.md`](STATUS.md). Screens have an extra
checklist on top of this one: [`SCREEN-DEFINITION-OF-DONE.md`](SCREEN-DEFINITION-OF-DONE.md).

## The checklist

- [ ] **The build passes.** For any code change, the type check passes
      (`npx tsc -p tsconfig.typecheck.json --noEmit`). If routes, configuration or dependencies
      changed, `npm run build` passes too. For documentation-only changes, the ward doc-link check
      passes instead (`npm run check:ward-doc-links`).
- [ ] **The tests for the areas you touched pass.** Run the test files for what you changed
      (`npm run test:focused -- --files <paths>`). Changes to the engine need the full offline ward
      suite (`npm run check:ward-expected-reds`) before folding. Never skip, disable or loosen a
      test to make it pass. Report any failure honestly, with the one line that shows it.
- [ ] **It is committed locally.** Small commits on your own branch in your own worktree. Nothing
      finished is left uncommitted. Nothing is pushed.
- [ ] **The status file is updated with verified results.** [`STATUS.md`](STATUS.md) records what
      changed, which checks ran, their result, and the commit they ran on. Only results you actually
      saw go in; anything not run is written as "not run".
- [ ] **The decision log is updated if a choice was made.** If the task settled a question of scope,
      direction or how the work is run, add an entry to [`decisions.md`](decisions.md). Clinical or
      product behaviour rulings also go in [`OWNER-RULINGS.md`](OWNER-RULINGS.md).

## Then fold it home

Work that is done but not folded is invisible to everyone else. Merge the latest ward line into your
branch, rerun the checks above, and fold into the ward line when no other thread is folding. The
full procedure is in the Ward Flow project rules and [`HOW-WE-WORK.md`](HOW-WE-WORK.md).
