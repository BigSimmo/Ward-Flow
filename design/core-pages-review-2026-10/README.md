# Ward Flow design review, October 2026

_Updated 2026-10-29 - extended the review mock-ups to every remaining page and 17 popups; Design owns._

**Status: mock-up for Josh's review. Nothing here is built.** Under the
[D-74 standing rule](../../docs/ward-flow/decisions.md#d-74-owner-answers-to-the-21-october-open-questions-21-october-2026),
no screen changes until Josh approves these mock-ups. Approving one page does not approve the others.

## What it is

[`ward-flow-core-pages.html`](ward-flow-core-pages.html) is a single page. It holds mock-ups of 37 pages and
17 popups, each with the design review's fixes applied and the review notes beside it. A switch shows each
one at desktop (1440 px), laptop (1280 px), tablet (768 px) and phone (390 px) widths, in light or dark.
Popups are drawn over the page they open from, and become bottom sheets on the phone.

The [published copy](https://claude.ai/artifact/GaVWBYM1Gkh8GdUtJvJapE) also has a "Now" switch, which
shows a screenshot of the running app for comparison. Those screenshots add about 11 MB, so this repository
copy leaves them out.

| Group                   | What is drawn                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Coordinator             | Home, Capacity, Movements, Waiting, All EDs, Referrals, Handover                                                  |
| Desks                   | My ward, Stays and discharges, ED board, Transport                                                                |
| Work and reports        | Patients, Discharges, All wards, Statistics                                                                       |
| Reference               | Alerts, Legal forms, Out of area, On-call, Seclusion, Governance                                                  |
| Bed meeting and reports | Bed meeting TV, Meeting agenda, Downtime pack, Patient chronology                                                 |
| Places and records      | Places, Community, Community team, Patient record, Add a patient, Ward answer, Settings, Sign in                  |
| Statistics pages        | Compare, the list template, one unit's page, Weekly (these four cover all ten statistics pages)                   |
| Popups                  | Alerts, Activity, Tools, Search, Help, Shortcuts, Demo menu, phone Menu, Create                                   |
| Page popups             | Bed meeting sheet, Movement drawer, Bed record, Confirm beds, ED actions, Log transport, Broadcast, Record a form |

Addresses that only forward to another page (for example `/ward-flow/command` and `/ward-flow/queue`) are
not drawn. The movement record opens the same screen as the patient record, so one mock-up covers both.

## Where it comes from

This meets the [D-75 evidence rule](../../docs/ward-flow/decisions.md#d-75-ux-audit-follow-up-page-caching-community-gaps-and-the-extra-travel-bed-hold-21-october-2026).
It was drawn on 28 and 29 October 2026 from screenshots of the running app at `main` `bbce856`. The open
pull requests #1111, #1112, #1114, #1115 and #1116 were merged in locally first, so their fixes are the
starting point. #1111 has since merged into `main`. #1109 (Help) conflicts with the others, so the Help popup
was drawn from #1109 on its own, merged with `main`.

The mock-ups use the Ward Flow v9 tokens, Geist and Geist Mono, and synthetic data only. They are a design
record, not a source for components. Building them means reworking the existing React screens.

## The main findings

1. **Capacity's bed forecast is squeezed into a narrow side column.** At 1280 px it is about 300 px wide and
   holds about ten panels and four caveat paragraphs, while the main column ends early. The mock-up gives the
   forecast its own full-width panel with a 7-day chart. The ward-by-day table goes behind a "By ward"
   switch, and the caveats become one line with a "How this is worked out" link.
2. **The same facts are shown more than once.** Capacity lists every ward twice. The ED board lists the same
   nine people twice, and the community team page lists its caseload twice. Each mock-up keeps one copy.
3. **Names and places are cut off with "…"**, including patient names on the ward bed tiles, which D-83 says
   are shown in full. Several pages and popups (Transport, Out of area, the agenda, the TV, the Alerts drawer)
   write names first name first. The mock-ups wrap text and put the surname first everywhere.
4. **Panels sit empty until you click.** Home's Placement panel, Governance's review pane, Stays' "Who is in a
   bed" and the chronology all wait for a choice. The mock-ups open on the first useful item.
5. **Narrow centred columns on wide screens.** Seclusion and the meeting agenda use an 850 px column. The
   mock-ups use the full width.
6. **Too many equal buttons.** The Alerts drawer has a filled button on every row, the bed record has six
   actions, and the agenda has about 20 "Add action" buttons. The mock-ups keep one main action and put the
   rest under More.
7. **Tablet used the phone layout stretched to 768 px.** The mock-ups use two columns at tablet width.

The notes beside each mock-up list every issue with the device it affects, and what is kept as it is.

## Open points for Josh

- **Discharges totals.** The header says 207 open, the filter says 63 and the list says 59 listed. The review
  did not check what each total counts, so the mock-up keeps today's numbers. The totals need one agreed
  meaning before build.
- **Capacity's 48-hour figure** in the mock-up is illustrative. Today's chart counts free beds, while the rest
  of the page counts beds short or spare. The mock-up uses the second measure throughout.
- **Places, Capacity's bed map and All wards overlap.** All three are kept in the mock-ups. Whether you want
  all three is your call.
- **Legal forms' "Not legally checked" notice** is kept word for word, as D-77 requires until you decide.
