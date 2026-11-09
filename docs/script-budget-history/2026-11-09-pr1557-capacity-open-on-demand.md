# 9 Nov 2026, Capacity loads its ward drawer and pop-ups on first open (PR #1557)

Lowered Capacity 667.5 to 645.0 (22.5 KB). Raised bed meeting 571.0 to 572.0 (1.0 KB).

Why: on the morning of 9 Nov two pull requests merged together and took Capacity 2.4 KB over its
limit; PR #1549 then raised it by 5 KB, leaving about 1 KB of room. Capacity's first download now
leaves out the ward drawer's body (`capacity-ward-drawer.tsx`, with the closures panel it opens),
the scenario pop-up and the bed meeting sheet pop-up. They load from one module
(`capacity-open-parts.ts`) when first opened. The drawer's tab row stays with the page through the
new `capacity-ward-tabs.ts`.

Measured locally, KB gzipped, against `main` `bd16e4ad` built the same way:

| Route       | Main  | This PR | Old limit | New limit |
| ----------- | ----- | ------- | --------- | --------- |
| Capacity    | 663.2 | 636.5   | 667.5     | 645.0     |
| bed meeting | 570.4 | 571.0   | 571.0     | 572.0     |

Every other route grew by about 0.4 to 0.7 KB: webpack's runtime now lists the new on-demand chunk
(0.39 KB) and the layout chunk's chunk map grew slightly (0.26 KB). That is unavoidable for any new
on-demand load. Bed meeting had no room for it, so it gets 1.0 KB. Capacity's new limit keeps about
8 KB of room for this week's feature work, in line with the "measured plus about 10 KB" rule this
file started with. Hosted CI has measured about 0.9 KB above local builds.
