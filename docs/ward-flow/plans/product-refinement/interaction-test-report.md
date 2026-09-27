# Q004 refinement interaction tests

Status: authored; execution intentionally deferred to the controller until the provider/reducer work stabilises.

## Owned files

- `tests/ward-refinement-interactions.dom.test.tsx`
- `docs/ward-flow/plans/product-refinement/interaction-test-report.md`

No application, provider, reducer or existing test file was changed. No Git mutation, server, browser or provider-backed operation was invoked; the repository-required task-start preflight performed read-only Git identity/status inspection before the first write.

## Authored coverage

The new file contains four user-visible DOM journeys against the real `WardFlowProvider` with `initialNow={NOW_ANCHOR}`:

1. A Movements attention action focuses its named worklist record without opening the detail dialog. Changing to Transport order retains focus on the radio, proving the consumed reveal does not replay on remount. Clicking the same attention action again focuses the record again.
2. An attention action taken while `Resolved today` is active returns the board to `Every movement` and focuses the requested record, again without opening a dialog.
3. Command initially has no shortlist panel. Explicit patient selection opens it; Close clears the selection and removes the panel while a provider probe confirms the movement and referral domain records are unchanged.
4. Explicit referral selection opens Referral placement, and that referral remains the panel subject through Patients and Referrals queue-tab switches.

The assertions use roles, accessible names, focus, selection state and rendered panel subjects. They do not snapshot CSS, implementation classes or private component state. Fixture targets are discovered from the rendered real queues rather than duplicated as hand-built records.

## Deferred command

The controller can run the focused batch after the domain implementation stabilises:

```text
npm run test:focused -- --files tests/ward-refinement-interactions.dom.test.tsx
```

Scoped Prettier formatting was applied to the two owned files. Tests, typecheck, lint, server and browser checks were not run under this task's explicit ownership boundary. No behavioural passing result is claimed.
