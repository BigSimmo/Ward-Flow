# Core pages design review, October 2026

_Updated 2026-10-28 - added the core pages review mock-ups for Josh's approval; Design owns._

**Status: mock-up for Josh's review. Nothing here is built.** Under the
[D-74 standing rule](../../docs/ward-flow/decisions.md#d-74-owner-answers-to-the-21-october-open-questions-21-october-2026),
no screen changes until Josh approves these mock-ups. Approving one page does not approve the others.

## What it is

[`ward-flow-core-pages.html`](ward-flow-core-pages.html) is a single page. It holds mock-ups of the 15
core pages, each with the design review's fixes applied and the review notes beside it. A switch shows each
page at desktop (1440 px), laptop (1280 px), tablet (768 px) and phone (390 px) widths, in light or dark.

The [published copy](https://claude.ai/artifact/GaVWBYM1Gkh8GdUtJvJapE) also has a "Now" switch, which
shows a screenshot of the running app for comparison. Those screenshots add about 5 MB, so this repository
copy leaves them out.

| Group            | Pages                                                            |
| ---------------- | ---------------------------------------------------------------- |
| Coordinator      | Home, Capacity, Movements, Waiting, All EDs, Referrals, Handover |
| Desks            | My ward, Stays and discharges, ED board, Transport               |
| Work and reports | Patients, Discharges, All wards, Statistics                      |

## Where it comes from

This meets the [D-75 evidence rule](../../docs/ward-flow/decisions.md#d-75-ux-audit-follow-up-page-caching-community-gaps-and-the-extra-travel-bed-hold-21-october-2026).
It was drawn on 28 October 2026 from screenshots of the running app at `main` `bbce856`. The open pull
requests #1111, #1112, #1114, #1115 and #1116 were merged in locally first, so their fixes are the starting
point. #1109 (Help) conflicts with them and does not change these pages.

The mock-ups use the Ward Flow v9 tokens, Geist and Geist Mono, and synthetic data only. They are a design
record, not a source for components. Building them means reworking the existing React screens.

## The main findings

1. **Capacity's bed forecast is squeezed into a narrow side column.** At 1280 px it is about 300 px wide and
   holds about ten panels and four caveat paragraphs, while the main column ends early. The mock-up gives the
   forecast its own full-width panel with a 7-day chart. The ward-by-day table goes behind a "By ward"
   switch, and the caveats become one line with a "How this is worked out" link.
2. **The same facts are shown more than once.** Capacity lists every ward twice. The ED board lists the same
   nine people twice. Stays and discharges repeats its header figures in a 10-box grid. Each mock-up keeps one copy.
3. **Names and places are cut off with "…"**, including patient names on the ward bed tiles, which D-83 says
   are shown in full. The mock-ups wrap text, and use ED codes in long tables with the full name on hover.
4. **Side columns sit empty.** Home's Placement panel and the Stays "Who is in a bed" panel wait for a click.
   The mock-ups show useful content first or remove the panel.
5. **Tablet uses the phone layout stretched to 768 px.** The mock-ups use two columns at tablet width.

The notes beside each mock-up list every issue with the device it affects, and what is kept as it is.

## Open points for Josh

- **Discharges totals.** The header says 207 open, the filter says 63 and the list says 59 listed. The review
  did not check what each total counts, so the mock-up keeps today's numbers. The totals need one agreed
  meaning before build.
- **Capacity's 48-hour figure** in the mock-up is illustrative. Today's chart counts free beds, while the rest
  of the page counts beds short or spare. The mock-up uses the second measure throughout.
