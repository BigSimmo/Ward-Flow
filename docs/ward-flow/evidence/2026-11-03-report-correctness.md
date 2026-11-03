# Cross-report correctness fixes (review92)

Base: Ward Flow main `1579bf894`. Review baseline: `b6aa5cde`.

- Downtime now partitions open ED-origin journeys using recorded physical departure, excluding community and ward origins. Recorded ED outcomes remain physically present unless departure is recorded.
- Executive shell labels retain the broader aggregate, now named open ED journeys. Disclosure release controls are unchanged.
- Community origins have a separate list-summary category rather than moving between wards.

Regression coverage compares meaningful counts and movement IDs across the pack and ED summaries, including stage corrections, late history and frozen snapshots.

## Staff-note history

The app keeps its latest20 entries. The oldest entry is retained here when the new review92 note is appended:

- 2026-10-31 (`2026-10-31-redesign-referrals`): Referrals and Ward answer are tidier: rows wrap in full, and Accept and Decline sit in a bar at the foot.

## Verification

Focused offline run:7files,107tests passed (including executive layout and staff-note tests). No live-system checks, merge or deployment. Final PR describes subsequent local gates and any limits.
