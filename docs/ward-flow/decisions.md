# Ward Flow — decision log

A short record of project-level decisions: how the work is run, what is in and out of scope, and
where the product is going. Newest at the bottom. Detailed clinical and product rulings on how a
screen or the engine behaves stay in [`OWNER-RULINGS.md`](OWNER-RULINGS.md); this log points there
when a decision here depends on one.

**This log is the one home for new decisions (Josh, 7 November 2026).** Record every new decision or
ruling here. Do not start new `owner-*.md` files; the existing ones stay as dated records, indexed by
[`OWNER-RULINGS.md`](OWNER-RULINGS.md).

**How to add an entry.** Add a numbered entry at the bottom with the date, who decided, the
decision in one or two sentences, and why. Never rewrite an old entry's decision; a wording or citation correction is allowed when a later entry discloses it (D-107). If a decision is reversed,
add a new entry that says which one it replaces, and mark the old one "Replaced by D-n".

_Updated 2026-11-10 - added D-121 and D-122 and corrected the D-58, D-74, D-94 and D-100 status rows; Documentation owns. Earlier changes are in Git history._

---

## Status of every entry

Checked 9 November 2026 (D-107 audit). "Partly replaced" means part of the entry still applies; the entry itself says which part. "Source unverified" means Josh's own words were not found; the entry stays until he keeps or strikes it.

| ID                                                                                                                                                      | Short title                                                                            | Status                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [D-1](#d-1-ward-flow-is-local-only-with-no-linked-repository-replaced-by-d-27)                                                                          | Ward Flow is local only, with no linked repository                                     | Replaced by D-27                                 |
| [D-2](#d-2-railway-is-disconnected)                                                                                                                     | Railway is disconnected                                                                | Partly replaced (hosting record, 27 Sep 2026)    |
| [D-3](#d-3-the-psychsift-and-database-code-is-being-retired-from-ward-flow)                                                                             | The PsychSift and Database code is being retired from Ward Flow                        | Active                                           |
| [D-4](#d-4-synthetic-patients-only)                                                                                                                     | Synthetic patients only                                                                | Active                                           |
| [D-5](#d-5-parallel-threads-in-separate-worktrees-folded-one-at-a-time)                                                                                 | Parallel threads in separate worktrees, folded one at a time                           | Partly replaced by D-26                          |
| [D-6](#d-6-aboriginal-cultural-safety-review-deferred)                                                                                                  | Aboriginal cultural safety review deferred                                             | Active                                           |
| [D-7](#d-7-the-first-four-milestones-in-this-order)                                                                                                     | The first four milestones, in this order                                               | Active                                           |
| [D-8](#d-8-joshs-standing-rulings-numbered-r1-to-r16-for-every-session-and-tool)                                                                        | Standing rulings R1 to R16                                                             | Partly replaced by D-27, D-28, D-107             |
| [D-9](#d-9-joshs-rulings-of-25-september-1143-to-1200-r17-to-r21)                                                                                       | Rulings R17 to R21                                                                     | Active                                           |
| [D-10](#d-10-gate-build-type-check-r22)                                                                                                                 | Gate build type check (R22)                                                            | Active                                           |
| [D-11](#d-11-rulings-of-25-september-1241-r23-to-r25)                                                                                                   | Rulings R23 to R25                                                                     | Partly replaced by D-26                          |
| [D-12](#d-12-rulings-of-25-september-1243-r26-to-r31)                                                                                                   | Rulings R26 to R31                                                                     | Partly replaced by D-26                          |
| [D-13](#d-13-tooling-tests-in-batch-gates-r32)                                                                                                          | Tooling tests in batch gates (R32)                                                     | Active                                           |
| [D-14](#d-14-standing-defaults-decide-small-things-without-asking)                                                                                      | Standing defaults: decide small things without asking                                  | Partly replaced by D-28                          |
| [D-15](#d-15-rulings-of-25-september-1326-r33-to-r35)                                                                                                   | Rulings R33 to R35                                                                     | Active                                           |
| [D-16](#d-16-legal-overrides-and-form-receipts-25-september-1351-utc)                                                                                   | Legal overrides and form receipts, 25 September 13:51 UTC                              | Active                                           |
| [D-17](#d-17-morning-roll-up-time-is-joshs-own-default-25-september)                                                                                    | Morning roll-up time is Josh's own default                                             | Active                                           |
| [D-18](#d-18-the-privacy-lock-stops-saving-only-for-typed-text-25-september)                                                                            | The privacy lock stops saving only for typed text                                      | Active                                           |
| [D-19](#d-19-rulings-of-25-september-evening-walkthrough-leave-beds-psychsift-gender-display)                                                           | Rulings of 25 September evening                                                        | Active                                           |
| [D-20](#d-20-one-high-contrast-colour-check-retired-26-september)                                                                                       | One high-contrast colour check retired                                                 | Active                                           |
| [D-21](#d-21-coordinator-bed-board-all-nine-recommended-answers-26-september)                                                                           | Coordinator bed board answers                                                          | Active                                           |
| [D-22](#d-22-no-legal-limits-in-hour-rules-the-rest-are-labelled-defaults-26-september)                                                                 | No legal limits in hour rules; the rest are labelled defaults                          | Active                                           |
| [D-23](#d-23-leave-bed-fields-kept-patient-search-stops-matching-by-ward-26-september)                                                                  | Leave-bed fields kept; patient search stops matching by ward                           | Active                                           |
| [D-24](#d-24-hour-rules-morning-list-all-a-26-september)                                                                                                | Hour-rules morning list: all A                                                         | Active                                           |
| [D-25](#d-25-the-lone-patient-check-counts-free-beds-on-both-matching-paths-26-september)                                                               | The lone-patient check counts free beds on both matching paths                         | Active                                           |
| [D-26](#d-26-select-fold-checks-by-changed-risk-27-september)                                                                                           | Select fold checks by changed risk                                                     | Active                                           |
| [D-27](#d-27-ward-flow-uses-its-dedicated-repository-28-september)                                                                                      | Ward Flow uses its dedicated repository                                                | Active                                           |
| [D-28](#d-28-design-modernization--anti-box-architecture-30-september-2026)                                                                             | Design modernisation and anti-box rules                                                | Partly replaced by D-42, D-94; Source unverified |
| [D-29](#d-29-act-time-limits-shown-as-a-labelled-synthetic-demo-4-october-2026)                                                                         | Act time limits shown as a labelled synthetic demo                                     | Replaced by D-70                                 |
| [D-30](#d-30-central-coordinator-approval-for-inter-ward-bed-transfers-6-october-2026)                                                                  | Coordinator approves inter-ward transfers                                              | Source unverified                                |
| [D-31](#d-31-gender-diverse-bed-placement-policy--clinical-override-safety-6-october-2026)                                                              | Gender-diverse bed placement needs clinician review                                    | Source unverified                                |
| [D-32](#d-32-fifo-waiting-time-with-clinical-triage-badging-vs-algorithmic-urgency-sorting-6-october-2026)                                              | Wait order with triage badges                                                          | Source unverified                                |
| [D-33](#d-33-separation-of-local-ward-shift-notes-from-statewide-coordinator-telemetry-6-october-2026)                                                  | Ward shift notes stay local                                                            | Source unverified                                |
| [D-34](#d-34-acute-medical-deterioration-bed-release-and-escalation-protocol-6-october-2026)                                                            | Medical deterioration releases the bed                                                 | Source unverified                                |
| [D-35](#d-35-deferral-of-regional-multi-leg-transport--rfds-repatriation-6-october-2026)                                                                | Regional multi-leg transport deferred                                                  | Source unverified                                |
| [D-36](#d-36-affirmation-of-external-governance--clinical-safety-hard-gates-6-october-2026-replaced-by-d-87)                                            | External governance hard gates                                                         | Replaced by D-87                                 |
| [D-37](#d-37-external-governance-hard-gate-operational-postures--resolution-roadmap-6-october-2026-replaced-by-d-87)                                    | Governance gate postures                                                               | Replaced by D-87                                 |
| [D-38](#d-38-leave-absent-without-leave-and-cto-on-the-patient-page-9-october-2026)                                                                     | Leave, absent without leave and CTO on the Patient page                                | Active                                           |
| [D-39](#d-39-patients-are-identified-by-umrn-never-by-a-wf-number-9-october-2026)                                                                       | Patients are identified by UMRN, never by a WF number                                  | Active                                           |
| [D-40](#d-40-a-second-community-treatment-order-keeps-the-first-9-october-2026)                                                                         | A second community treatment order keeps the first                                     | Active                                           |
| [D-41](#d-41-delays-board-filters-narrow-the-table-and-state-the-hidden-count-9-october-2026)                                                           | Delays board filters narrow the table and state the hidden count                       | Active                                           |
| [D-42](#d-42-12px-typography-floor-with-no-uppercase-exception-reaffirmed-in-design-system-v9-910-october-2026)                                         | 12px type floor, no uppercase exception                                                | Active                                           |
| [D-43](#d-43-colour-lives-in-glyphs-and-the-hero-red-means-act-now-with-a-thin-1px-edge-never-a-fill-9-october-2026)                                    | Colour in glyphs; thin act-now edge                                                    | Partly replaced by D-94                          |
| [D-44](#d-44-compact-sizing-white-cards-and-smaller-text-retained-over-expression-test-card-tints-9-october-2026)                                       | Compact sizing and white cards                                                         | Active                                           |
| [D-45](#d-45-phone-is-its-own-390844-design-never-a-desktop-reflow-9-october-2026)                                                                      | Phone is its own 390×844 design, never a desktop reflow                                | Active                                           |
| [D-46](#d-46-every-page-has-a-focal-part-a-part-of-its-own-a-page-specific-hero-and-command-bar-action-rules-9-october-2026)                            | Every page has a focal part                                                            | Active                                           |
| [D-47](#d-47-glass-stays-about-80-opaque-with-the-top-sheen-kept-10-october-2026)                                                                       | Glass stays about 80% opaque with the top sheen kept                                   | Active                                           |
| [D-48](#d-48-figures-stay-in-geist-mono-with-tabular-digits-while-chart-axes-use-geist-sans-10-october-2026)                                            | Figures in Geist Mono                                                                  | Active                                           |
| [D-49](#d-49-ward-flow-44px-default-row-target-dense-36px-touch-52px-vs-retired-48px-psychsift-tap-knob-10-october-2026)                                | 44px default row target                                                                | Active                                           |
| [D-50](#d-50-neutral-t1-urgency-pill-vs-form-1a-amber-statutory-warning-badge-10-october-2026)                                                          | Neutral T1 pill, amber Form 1A badge                                                   | Active                                           |
| [D-51](#d-51-delays-filters-hide-rows-with-a-stated-hidden-count-while-other-queues-highlight-by-default-10-october-2026)                               | Delays filters state the hidden count                                                  | Active                                           |
| [D-52](#d-52-10-october-page-review-rulings-time-axis-overdue-zone-15px20px-strip-figures-8px-people-pips-and-incremental-shared-parts-10-october-2026) | 10 October page review rulings                                                         | Active                                           |
| [D-53](#d-53-elevate-design-language-and-glare-mode-adopted-for-design-system-v9-10-october-2026)                                                       | Elevate design language and Glare mode                                                 | Active                                           |
| [D-54](#d-54-tier-time-thresholds-remain-synthetic-demo-values-requiring-clinical-sign-off-10-october-2026)                                             | Tier time thresholds remain synthetic demo values requiring clinical sign-off          | Active                                           |
| [D-55](#d-55-supabase-is-ward-flows-database-and-sign-in-provider-and-azure-is-retired-15-october-2026)                                                 | Supabase is Ward Flow's database and sign-in provider, and Azure is retired            | Active                                           |
| [D-56](#d-56-josh-signs-the-clinical-values-that-have-a-recorded-source-for-the-prototype-15-october-2026)                                              | Josh signs the clinical values that have a recorded source, for the prototype          | Active                                           |
| [D-57](#d-57-twenty-top-25-items-move-from-the-showcase-into-the-real-screens-each-behind-its-own-flag-15-october-2026)                                 | Twenty Top 25 items into real screens                                                  | Active                                           |
| [D-58](#d-58-josh-signs-three-more-clinical-values-that-have-a-national-source-for-the-prototype-15-october-2026)                                       | Josh signs three more clinical values that have a national source, for the prototype   | Corrected by D-122 (two values)                  |
| [D-59](#d-59-each-role-sees-only-what-it-needs-from-one-access-table-15-october-2026)                                                                   | Each role sees only what it needs, from one access table                               | Active                                           |
| [D-60](#d-60-criteria-led-discharge-for-voluntary-patients-only-15-october-2026)                                                                        | Criteria led discharge, for voluntary patients only                                    | Active                                           |
| [D-61](#d-61-tasks-and-alerts-are-one-queue-called-alerts-16-october-2026)                                                                              | Tasks and Alerts are one queue called Alerts                                           | Active                                           |
| [D-62](#d-62-the-one-alerts-queue-is-signed-off-and-its-flag-removed-16-october-2026)                                                                   | The one Alerts queue is signed off and its flag removed                                | Active                                           |
| [D-63](#d-63-josh-signs-the-remaining-clinical-values-and-the-criteria-list-for-the-prototype-16-october-2026)                                          | Josh signs the remaining clinical values and the criteria list, for the prototype      | Active                                           |
| [D-64](#d-64-criteria-led-discharge-shows-on-the-boards-and-warns-at-departure-16-october-2026)                                                         | Criteria led discharge shows on the boards and warns at departure                      | Active                                           |
| [D-65](#d-65-criteria-led-discharge-on-in-production-typed-patient-specific-criteria-and-the-awol-bed-hold-review-paused-17-october-2026)               | Criteria led discharge in production                                                   | Active                                           |
| [D-66](#d-66-granted-roles-work-without-a-second-approval-17-october-2026)                                                                              | Granted roles work without a second approval                                           | Active                                           |
| [D-67](#d-67-recover-synthetic-form-drafts-within-the-browser-session-17-october-2026)                                                                  | Recover synthetic form drafts within the browser session                               | Active                                           |
| [D-68](#d-68-bed-meeting-tv-content-and-access-19-october-2026)                                                                                         | Bed meeting TV content and access                                                      | Partly replaced by D-79, D-83                    |
| [D-69](#d-69-a-referral-with-no-legal-status-needs-an-involuntary-capable-bed-until-status-is-set-20-october-2026)                                      | No legal status needs an involuntary-capable bed                                       | Active                                           |
| [D-70](#d-70-no-computed-mental-health-act-periods-show-only-the-recorded-due-time-20-october-2026)                                                     | No computed Mental Health Act periods: show only the recorded due time                 | Active                                           |
| [D-71](#d-71-audit-1-clinical-safety-fixes-no-suggested-wards-wait-order-queues-recorded-facts-only-20-october-2026)                                    | Audit 1 clinical safety fixes                                                          | Partly replaced by D-93                          |
| [D-72](#d-72-seven-product-decisions-for-the-21-october-fix-plan-21-october-2026)                                                                       | Seven product decisions for the 21 October fix plan                                    | Partly replaced by D-74                          |
| [D-73](#d-73-batch-merge-safeguards-21-october-2026)                                                                                                    | Batch merge safeguards                                                                 | Partly replaced by D-107                         |
| [D-74](#d-74-owner-answers-to-the-21-october-open-questions-21-october-2026)                                                                            | Owner answers to the 21 October open questions                                         | Partly replaced by D-83                          |
| [D-75](#d-75-ux-audit-follow-up-page-caching-community-gaps-and-the-extra-travel-bed-hold-21-october-2026)                                              | UX audit follow-up, page caching, community gaps and the extra-travel bed hold         | Active                                           |
| [D-76](#d-76-community-referral-gaps-the-full-move-journey-and-asking-more-wards-21-october-2026)                                                       | Community referral gaps: the full move journey and asking more wards                   | Active                                           |
| [D-77](#d-77-the-ten-bigger-ux-changes-approved-for-build-22-october-2026)                                                                              | The ten bigger UX changes approved for build                                           | Partly replaced by D-98                          |
| [D-78](#d-78-one-decline-list-for-wards-and-coordinators-22-october-2026)                                                                               | One decline list for wards and coordinators                                            | Active                                           |
| [D-79](#d-79-wards-see-the-full-referral-with-name-and-umrn-before-they-answer-23-october-2026)                                                         | Wards see the full referral before answering                                           | Active                                           |
| [D-80](#d-80-role-access-plan-version-2-all-17-recommendations-23-october-2026)                                                                         | Role access plan version 2: all 17 recommendations                                     | Partly replaced by D-86                          |
| [D-81](#d-81-pulled-with-a-pull-time-limit-for-a-bed-kept-for-an-incoming-patient-24-october-2026)                                                      | Pulled, with a pull time limit, for a bed kept for an incoming patient                 | Active                                           |
| [D-82](#d-82-a-pr-may-raise-a-phone-size-limit-by-up-to-5-kb-per-screen-without-asking-26-october-2026)                                                 | A PR may raise a phone size limit by up to 5 KB per screen without asking              | Active                                           |
| [D-83](#d-83-patient-names-stay-in-full-on-every-screen-copy-and-tv-privacy-work-must-not-make-the-app-less-useful-26-october-2026)                     | Patient names in full                                                                  | Partly replaced by D-102                         |
| [D-84](#d-84-the-live-app-stays-on-railway-singapore-for-now-and-there-is-no-server-side-tv-account-yet-26-october-2026)                                | Live app stays on Railway Singapore                                                    | Active                                           |
| [D-85](#d-85-held-only-for-a-bed-kept-for-its-own-patient-pulled-for-an-incoming-bed-held-up-for-a-delay-26-october-2026)                               | Held, pulled and held up                                                               | Active                                           |
| [D-86](#d-86-no-second-approver-for-role-grants-at-pilot-or-otherwise-27-october-2026)                                                                  | No second approver for role grants, at pilot or otherwise                              | Active                                           |
| [D-87](#d-87-d-36-and-d-37-are-replaced-by-the-real-data-gate-27-october-2026)                                                                          | D-36 and D-37 replaced by the real-data gate                                           | Active                                           |
| [D-88](#d-88-the-public-demo-opens-with-a-demo-code-once-the-front-door-is-on-27-october-2026)                                                          | The public demo opens with a demo code once the front door is on                       | Active                                           |
| [D-89](#d-89-redesign-mock-up-copies-of-large-screens-may-pass-the-1500-line-cap-30-october-2026)                                                       | Mock-up copies may pass the line cap                                                   | Active                                           |
| [D-90](#d-90-help-gets-how-do-i-show-me-runs-everywhere-and-help-is-built-without-a-separate-mock-up-step-30-october-2026)                              | Help: How do I and Show me                                                             | Partly replaced by D-91                          |
| [D-91](#d-91-one-design-home-for-the-redesign-and-joshs-answers-on-help-settings-search-and-notifications-31-october-2026)                              | One design home; Help, Settings, search, notices                                       | Partly replaced by D-107                         |
| [D-92](#d-92-help-goes-live-before-its-mock-up-review-one-search-box-on-capacity-and-referral-rows-on-home-open-the-panel-31-october-2026)              | Help live before mock-up review                                                        | Active                                           |
| [D-93](#d-93-legal-form-times-show-only-as-typed-never-as-a-countdown-31-october-2026)                                                                  | Legal form times show only as typed, never as a countdown                              | Active                                           |
| [D-94](#d-94-design-rulings-of-31-october-2026)                                                                                                         | Design rulings of 31 October 2026                                                      | Partly replaced (tab size, Q225)                 |
| [D-95](#d-95-one-page-scroll-and-a-click-outside-closes-a-drawer-3-november-2026)                                                                       | One page scroll; outside click closes                                                  | Active                                           |
| [D-96](#d-96-a-named-bed-is-pulled-and-its-patient-is-not-also-waiting-8-november-2026)                                                                 | A named bed is pulled, not also waiting                                                | Active                                           |
| [D-97](#d-97-owner-answers-on-seven-open-items-n21-n25-n26-n29-n40-n41-and-wf-b008-8-november-2026)                                                     | Seven open items answered                                                              | Active                                           |
| [D-98](#d-98-friction-pass-quick-bar-patient-peek-and-ward-peek-8-november-2026)                                                                        | Quick bar, Patient peek, Ward peek                                                     | Active                                           |
| [D-99](#d-99-real-details-in-the-referral-drawers-sample-patients-25-september-2026)                                                                    | "Real details" in the referral drawer's sample patients                                | Active                                           |
| [D-100](#d-100-under-a-form-means-one-rule-everywhere-9-november-2026)                                                                                  | "Under a form" means one rule everywhere                                               | Active                                           |
| [D-101](#d-101-clinically-ready-for-discharge-with-one-delay-reason-9-november-2026)                                                                    | Clinically ready for discharge, with one delay reason                                  | Active                                           |
| [D-102](#d-102-report-a-problem-screenshots-are-blurred-and-patient-table-exports-carry-no-names-9-november-2026)                                       | Blurred screenshots; exports carry no names                                            | Active                                           |
| [D-103](#d-103-any-coordinator-on-shift-may-mark-a-bed-override-reviewed-9-november-2026)                                                               | Any coordinator on shift may mark a bed override reviewed                              | Active                                           |
| [D-104](#d-104-care-plans-and-safety-flags-five-defaults-9-november-2026)                                                                               | Care plans and safety flags                                                            | Active                                           |
| [D-105](#d-105-optional-clerk-details-on-the-patient-record-8-november-2026)                                                                            | Optional clerk details on the patient record                                           | Active                                           |
| [D-106](#d-106-clinical-values-from-the-9-november-2026-documentation-audit-9-november-2026)                                                            | Clinical values from the 9 Nov audit                                                   | Active                                           |
| [D-107](#d-107-working-rules-and-documentation-from-the-9-november-2026-audit-9-november-2026)                                                          | Working rules from the 9 Nov audit                                                     | Active                                           |
| [D-108](#d-108-six-bed-flow-features-keep-d-93-and-d-72-ed-long-wait-next-steps-9-november-2026)                                                        | Six features: keep D-93 and D-72, ED next steps                                        | Active                                           |
| [D-109](#d-109-homes-bed-alert-line-tests-the-whole-number-shown-9-november-2026)                                                                       | Home bed alert line tests the shown whole %                                            | Active                                           |
| [D-110](#d-110-ed-and-referral-flow-neutral-fit-line-clearance-timing-and-alternatives-to-admission-9-november-2026)                                    | ED and referral fit line, clearance timing, alternatives                               | Active                                           |
| [D-111](#d-111-review-and-audit-plan-first-guards-and-four-open-answers-9-november-2026)                                                                | Review and audit plan: first guards and answers                                        | Active                                           |
| [D-112](#d-112-phone-bottom-bar-the-floating-bar-9-november-2026)                                                                                       | Phone bottom bar: the floating bar                                                     | Active                                           |
| [D-113](#d-113-second-patient-identifier-on-accept-and-mark-done-no-initials-search-9-november-2026)                                                    | Second identifier on accept and Mark done; no initials search                          | Active                                           |
| [D-114](#d-114-allow-pull_request_target-for-three-workflows-only-9-november-2026)                                                                      | Allow pull_request_target for three workflows only                                     | Active                                           |
| [D-115](#d-115-one-count-on-every-screen-and-a-missing-patient-shown-everywhere-9-november-2026)                                                        | One count on every screen; missing patient shown everywhere                            | Active                                           |
| [D-116](#d-116-page-tops-the-pr-1581-recommendations-stand-9-november-2026)                                                                             | Page tops: PR #1581 recommendations stand                                              | Active                                           |
| [D-117](#d-117-care-plans-follow-up-frequent-presenter-count-tribunal-date-and-ward-flags-10-november-2026)                                             | Care plans follow-up: frequent presenter count, tribunal date, ward flags              | Active                                           |
| [D-118](#d-118-page-tops-referrals-and-ward-phone-limits-up-to-8-kb-above-main-10-november-2026)                                                        | Page tops: Referrals and Ward phone limits up to 8 KB above main                       | Active                                           |
| [D-119](#d-119-page-tops-phone-limits-raised-to-measured-sizes-trim-after-merge-10-november-2026)                                                       | Page tops: phone limits at measured sizes, trim after merge                            | Active                                           |
| [D-120](#d-120-discharge-and-capacity-values-pull-limit-transport-delay-and-discharge-date-slip-9-november-2026)                                        | Discharge and capacity values: pull limit, transport delay, date slip                  | Active                                           |
| [D-121](#d-121-working-rules-guards-and-your-pc-from-the-10-november-2026-audit-10-november-2026)                                                       | Working rules, guards and PC tidy from the 10 Nov audit                                | Active                                           |
| [D-122](#d-122-clinical-and-privacy-answers-from-the-10-november-2026-audit-10-november-2026)                                                           | Clinical and privacy answers from the 10 Nov audit                                     | Active                                           |
| [D-123](#d-123-master-audit-list-answers-two-clinical-fixes-and-five-working-rules-10-november-2026)                                                    | Master audit list answers: two clinical fixes and five working rules                   | Active                                           |
| [D-124](#d-124-offline-saves-whose-record-changed-are-refused-and-shown-10-november-2026)                                                               | Offline saves whose record changed: refuse and show                                    | Active                                           |
| [D-125](#d-125-top-10-audit-follow-ups-approved-10-november-2026)                                                                                       | Top 10 audit follow-ups: refusal toast, sign-out waits, executive report, ranked lists | Active                                           |
| [D-126](#d-126-ranked-lists-neutral-orders-approved-10-november-2026)                                                                                   | Ranked lists: neutral orders on 11 lists, lists 9 and 12 kept                          | Active                                           |
| [D-127](#d-127-neutral-wording-for-a-community-treatment-order-at-arrival-10-november-2026)                                                             | Neutral wording for a community treatment order at arrival                             | Active                                           |
| [D-128](#d-128-final-master-audit-nine-answers-10-november-2026)                                                                                        | Final master audit: nine answers                                                       | Active                                           |
| [D-129](#d-129-master-audit-findings-every-recommendation-approved-10-november-2026)                                                                    | Master audit findings: every recommendation approved                                   | Active                                           |
| [D-130](#d-130-audit-follow-ups-every-remaining-recommendation-approved-10-november-2026)                                                               | Audit follow-ups: every remaining recommendation approved                              | Active                                           |
| [D-131](#d-131-hard-case-demo-data-allowed-and-the-movement-diagram-follows-the-engine-10-november-2026)                                                | Hard-case demo data allowed, and the movement diagram follows the engine               | Active                                           |
| [D-132](#d-132-audit-fixes-group-1-docs-and-ci-guards-10-november-2026)                                                                                 | Audit fixes group 1: docs and CI guards; Claude-authored sensitive changes warn        | Active                                           |
| [D-137](#d-137-feature-build-batch-5-count-leak-first-tv-change-mark-and-qr-library-10-november-2026)                                                   | Feature build batch 5: count leak first, TV change mark 15 minutes, QR library         | Active                                           |
| [D-138](#d-138-phone-alert-urgency-by-kind-10-november-2026)                                                                                            | Phone alert urgency by kind                                                            | Active                                           |
| [D-143](#d-143-mhert-is-mherl-in-the-glossary-smhmr-deferred-11-november-2026)                                                                          | MHERT is MHERL in the glossary; SMHMR deferred                                         | Active                                           |

---

## D-1. Ward Flow is local only, with no linked repository (Replaced by D-27)

- **Date:** 25 September 2026. **Decided by:** Josh.
- **Decision:** All Ward Flow work lives on Josh's own computer, in
  `D:\Worktrees\Database\ward-lead` and worktrees made from it. No GitHub repository is linked.
  Nothing is pushed, and no pull request is opened, unless Josh asks.
- **Why:** The ward line shares history with the live PsychSift app, where pushing to `main`
  deploys the app and changes the live clinical database. Keeping Ward Flow local removes that risk.
  "Fold into main" always means the local ward line, never GitHub (ruling of 12 September).

## D-2. Railway is disconnected

- **Date:** 25 September 2026. **Decided by:** Josh.
- **Decision:** Railway (the hosting service used by the old app) must not be connected to Ward
  Flow. Any Railway or other deployment tool is ask-first, whatever name it appears under.
- **Why:** Ward Flow holds only invented data and is not ready to be hosted. Where it is eventually
  hosted is a separate decision (roadmap milestone 5).
- **Subsequent approval:** The Railway disconnection/no-hosting position was superseded by the
  [owner-approved hosting setup record of 27 September 2026](../hosting.md). Its Ward Flow-only
  resource boundaries apply; provider and deployment actions remain ask-first under `AGENTS.md`.

## D-3. The PsychSift and Database code is being retired from Ward Flow

- **Date:** 25 September 2026. **Decided by:** Josh.
- **Decision:** The PsychSift guideline search app and its Database deployment tooling that sit on
  the ward line are leftovers. Ward Flow work ignores them, and they will be removed from the ward
  line (roadmap milestone 1).
- **Why:** Ward Flow does not use them, and they slow every check and confuse every new chat.

## D-4. Synthetic patients only

- **Date:** 25 September 2026 (restating a standing rule). **Decided by:** Josh.
- **Decision:** Every patient, ward and figure in Ward Flow is made up. No real patient data is
  entered or loaded, and no invented clinical fact or figure is shown as if it were real data.
- **Why:** There is no privacy approval, clinical safety sign-off or legal advice yet (roadmap
  milestone 6). Invented figures presented as records would mislead anyone testing it.

## D-5. Parallel threads in separate worktrees, folded one at a time

- **Date:** 25 September 2026. **Decided by:** Josh.
- **Decision:** Many threads may work at once. Each thread that edits code works in its own git
  worktree and local branch, made from the latest ward line, and says which files it expects to
  change. The coordinator keeps two threads off the same files. Before folding, a thread merges the
  latest ward line into its branch, rebuilds and retests, then folds; only one thread folds at a
  time.
- **Why:** Two chats writing in one folder have deadlocked commits and lost work before. Folding one
  at a time keeps each merge small and checkable.

## D-6. Aboriginal cultural safety review deferred

- **Date:** 17 September 2026, restated 25 September 2026. **Decided by:** Josh.
- **Decision:** The Aboriginal cultural safety review is deferred. Threads do not raise it again
  unless Josh brings it back.
- **Why:** Josh's call. It needs outside reviewers this team cannot provide, and it is not needed
  while the app holds only invented data.

## D-7. The first four milestones, in this order

- **Date:** 25 September 2026. **Decided by:** Josh.
- **Decision:** The [roadmap](roadmap.md) runs in this order: (1) clean up the leftover PsychSift
  code, (2) get the ward tests passing, (3) remove invented data from the screens, (4) make the
  Coordinator bed board's full journey reliable, from referral in through bed held, transport,
  arrival and discharge. Milestones 5 and 6 are not yet approved.
- **Why:** Cleanup makes every later change smaller and safer. Until the tests pass, nobody can tell
  whether a new change broke something. Invented data shown as real (such as the wrong name on
  Handover) is the main clinical safety risk. The Coordinator view is the one Josh asked to be built
  first.

## D-8. Josh's standing rulings, numbered R1 to R16, for every session and tool

- **Later status (9 November 2026):** partly replaced. R1 by D-27; R4 by D-28 item 6. New rulings are numbered D entries in this log, not R17 onward (D-107).
- **Date:** 25 September 2026. **Decided by:** Josh (collected by the coordinator).
- **Decision:** Every session and tool reads this list before starting. New rulings are added here as
  R17 onward by the thread the coordinator routes them to, with the date and time.
  - **R1** No GitHub, remotes, cloud threads, Railway or Supabase. Nothing is pushed.
  - **R2** Fold everything to the local line before a thread is resolved; never resolve a thread
    without Josh's yes for that thread.
  - **R3** Back up before replacing anything; no early removal; archive, don't delete.
  - **R4** Keep the design exactly as on the line.
  - **R5** Legal (D5): no Act section numbers, no computed legal limits, typed times only, marked
    "Not legally checked".
  - **R6** Made-up patients only.
  - **R7** Gender and sex (10:56): gender is Female, Male, Non-binary, Different term or Not recorded;
    sex is Female, Male, Another term or Not recorded. If either is not female or male, the
    coordinator reviews and notes a reason before allocation, on every ward. Female and male allocate
    by gender identity. A binary mismatch on a single-sex ward refuses.
  - **R8** Demo data (10:08): an "EMHS demo" scenario and an "EMHS surge" state, plain ward labels,
    other health services too; only patients and linked records, never standalone figures.
  - **R9** Retire Care Plan, Caring Contacts and Developer Hub with PsychSift batch 3.
  - **R10** Shared board: PC only; keep "stop saving"; keep "reset all".
  - **R11** History: the Person screen and the Activity drawer; one event log shared with the shared
    board.
  - **R12** Bed board on the capacity screen, held until roadmap steps 1 to 3 fold.
  - **R13** Pilot: EMHS with site switching; the Coordinator view is primary.
  - **R14** Transport release: keep; "no bed" goes to the waitlist.
  - **R15** Run slots and batch folds: heavy checks only where needed, one wide run at a time, one
    fold steward; desktop-only screenshots (full rules in the AGENTS.md Ward Flow rulebook).
  - **R16** The Aboriginal cultural safety review is deferred; don't re-ask (see D-6).
- **Why:** One numbered list every tool reads means fewer relays and fewer mix-ups.

## D-9. Josh's rulings of 25 September, 11:43 to 12:00 (R17 to R21)

- **Date:** 25 September 2026. **Decided by:** Josh (relayed by the coordinator).
- **Decision:**
  - **R17** Gate priority: while a batch fold gate is queued or running, other threads run nothing
    heavy. The coordinator sends "go" after the fold.
  - **R18** Leave beds are linked to the patient's stay. An empty but blocked bed counts as held. A
    bed release is a named discharge.
  - **R19** Made-up trend charts show "Not recorded"; target lines stay, labelled; a ward's confirmed
    ready count is a record.
  - **R20** Legal: the dead clock arithmetic is removed, and 5B continues 5A.
  - **R21** Gender is shown to ward staff.
- **Why:** Recorded so every session and tool reads the same rulings without a relay.

## D-10. Gate build type check (R22)

- **Date:** 25 September 2026, 12:21 UTC. **Decided by:** Josh (decision card).
- **Decision:** **R22** In the fold gate, the app build skips its own type check (`WARD_GATE_BUILD=1`)
  only when the batch changes no page, layout or route file. Otherwise the build keeps it.
  `scripts/ward-flow/gate-build-flag.mjs` decides.
- **Why:** The gate's full type check already covers the code; only the build checks Next's
  generated route types, so route-shaped changes keep that check.

## D-11. Rulings of 25 September, 12:41 (R23 to R25)

- **Later status (9 November 2026):** partly replaced. R24 and R25 by D-26.
- **Date:** 25 September 2026, 12:41 UTC. **Decided by:** Josh ("yes to all").
- **Decision:**
  - **R23** Look-identical checks use about 8 representative screens, one per layout type, not
    every screen.
  - **R24** A READY branch may join a batch if it lands within about 15 minutes of the batch's
    planned start.
  - **R25** READY-FAST-ENGINE: an engine change with no screen, wording or demo-data change, whose
    own tests and full tsc pass on its tip, folds in fast-lane gaps without a gate. The next gate
    re-checks it, and a red is reverted first.
  - Also on 25 September (card): batch 2's journeys run in three shards straight away, without
    trial runs; a failing spec is rerun alone, unsharded, before any branch is blamed.
- **Why:** Fewer missed rounds and shorter gates, at a small, stated quality cost.

## D-12. Rulings of 25 September, 12:43 (R26 to R31)

- **Later status (9 November 2026):** partly replaced. R28 and R31 by D-26. R29 (stacked work) no longer applies: AGENTS.md says never stack PRs.
- **Date:** 25 September 2026, 12:43 UTC. **Decided by:** Josh ("yes 1-4", "also yes to 6-7").
- **Decision:**
  - **R26** Build memory: gate builds keep and reuse Next's working cache between runs, never the
    finished build output.
  - **R27** Ward-only test build: gate builds compile only the Ward Flow routes the journeys and
    screenshots visit, falling back automatically to a full build if a route is missing or the
    build fails.
  - **R28** Rolling batches: no fixed cut-off; the next gate starts when the last one ends, with
    whatever is READY, plus a 15-minute grace.
  - **R29** Stacked work: a branch may be built on an unfolded READY branch and fold in the same
    batch; if the base drops, the stacked branch drops too.
  - **R30** Owners' type check is incremental (`gate-tsc.mjs`); the gate keeps a full, clean tsc.
  - **R31** Owners run only the tests that use their changed files (`related-tests.mjs`), never a
    full suite of their own; the batch gate covers the rest.
- **Why:** Remove waits and duplicate runs at a small, stated cost.

## D-13. Tooling tests in batch gates (R32)

- **Date:** 25 September 2026, 13:07 UTC. **Decided by:** Josh ("apply more speed ups").
- **Decision:** **R32** In batch gates, tooling tests (tests of scripts, hooks and the gate itself,
  listed in `TOOLING_TESTS` in `scripts/check-ward-expected-reds.mjs`) run only when the batch
  changes scripts, hooks, package files, the test setup or tool config. Otherwise the gate prints
  "tooling tests skipped: no tooling change" with the list, and the night shift runs them on the
  line tip. Product guards that merely run a script are never on the list.
- **Why:** They are slow (real git fixtures) and cannot be affected by a product-only batch.

## D-14. Standing defaults: decide small things without asking

- **Later status (9 November 2026):** the "keep the design exactly (R4)" default was amended by D-28 item 6.
- **Date:** 25 September 2026. **Decided by:** Josh (approved the coordinator's speed audit).
- **Decision:** Where one of these covers a small choice, apply it and move on; ask only if none fits.
  - A blank or missing value shows "Not recorded", never a guess.
  - Fixtures record gender (and sex) for every made-up person.
  - Never guess a link between records; link only what the data holds.
  - Keep the current layout and design exactly (R4).
  - Made-up patients only (R6); no computed legal limits (R5).
- **Why:** Fewer round trips through the coordinator for choices Josh has already made in general.

## D-15. Rulings of 25 September, 13:26 (R33 to R35)

- **Date:** 25 September 2026, 13:26 UTC. **Decided by:** Josh ("implement all recommendations").
- **Decision:**
  - **R33** Journeys start from a prepared browser state (demo state injected before the page loads)
    in specs that are not testing setup; one dedicated spec per setup flow keeps setup covered.
  - **R34** The gate's type check covers Ward Flow code and tests plus everything they import
    (`tsconfig.ward-gate.json`, about 1,400 of 3,600 files). The full-app check runs nightly; a
    nightly error blocks the next fold until fixed.
  - **R35** Vitest `isolate: false` for a pure-logic subset only, after 3 identical runs prove the
    same pass list as isolated.
- **Why:** Shorter gates; the parts left out are covered nightly or proved equal first.

## D-16. Legal overrides and form receipts, 25 September 13:51 UTC

- **Date:** 25 September 2026, 13:51 UTC. **Decided by:** Josh ("all yes").
- **Decision:**
  - Ward authorisation for an involuntary patient is never overridable. `OVERRIDE_LEGAL_MISMATCH`
    (added 22 Sept, no screen used it) is removed; recording a mismatch (`FLAG_LEGAL_MISMATCH`)
    stays. Removed code kept on `backup/2026-09-25-legal-mismatch-override`.
  - A legal-form receipt may be recorded against any of the nine receivable legal forms, not only
    Form 1A (the 23 Sept widening, 6eec76bd85, is accepted).
- **Why:** The override contradicted the authorisation gate the engine already treats as fixed; the
  receipt widening matches the rule that every legal time is typed from the form and not legally
  checked.

## D-17. Morning roll-up time is Josh's own default (25 September)

- **Date:** 25 September 2026, 15:15 UTC. **Decided by:** Josh (answer A, "yes to all recommendations").
- **Decision:** The morning roll-up time of 09:30, adjustable from 08:00 to 11:00 in 15-minute steps,
  is Josh's own ward-practice default. It is not a Mental Health Act figure or any other legal time
  limit. The constants are renamed `MORNING_ROLLUP_TIME_MINUTES` and
  `MORNING_ROLLUP_TIME_RANGE_MINUTES` (from `_DEADLINE_`), and the legal-figure guard records this
  answer as their provenance. The guard itself is not widened.
- **Why:** The guard refuses any figure in the model with no named human source, and bans
  `_DEADLINE_` names there so an operational time is never read as statutory.

## D-18. The privacy lock stops saving only for typed text (25 September)

- **Date:** 25 September 2026, evening (Perth). **Decided by:** Josh ("Only for typed text").
- **Decision:** Saving to the browser stops only when someone types free text. A refused action no
  longer stops saving: refusals keep saving, but the saved copy carries no refusals, so a refusal's
  quoted id never reaches the device, and loading still rejects any stored refusal. Typed text stays
  off the device as before.
- **Why:** A refusal locked the whole session's saving though it held no typed text. A read-only
  privacy recheck against the 17 September finding found no new risk.
- **Subsequent exception (17 October 2026):** D-67 permits session draft recovery for the explicitly opted-in synthetic referral and legal forms. The general typed-event state saving lock remains unchanged.

## D-19. Rulings of 25 September, evening (walkthrough, leave beds, PsychSift, gender display)

- **Date:** 25 September 2026, evening (Perth). **Decided by:** Josh ("yes to all recommendations",
  15:15 UTC, and his answers to the coordinator's cards that evening).
- **Decision:**
  - Armadale leave beds WL-RD07 and WL-RD08 are kept, each linked to a named patient.
  - "Move the date" is left off.
  - The Command referral panel keeps its summary.
  - Sample history is labelled "Example history".
  - Where screens disagree about a discharge, the discharge record is the truth.
  - The involuntary discharge guard's mismatched label is fixed.
  - The side rail's bed counts match the board.
  - The delays badge and tab read "at a time limit or with nowhere to go".
  - The transport officer sees patient names.
  - Sample patient WF-003 is fixed.
  - The SCGH and FSH mixed wards with no locked beds go on the list to confirm before the pilot.
  - Removing the legal-mismatch override and recording receipts on the nine legal forms: see D-16.
  - PsychSift: keep only what Ward Flow requires, uses or finds useful; remove the rest.
  - R7 display: gender identity is shown beside sex on the ward screens, the referral board, the bed
    board and the referral details a ward opens (Q2 and the 13:11 UTC card, "Show").
- **Why:** Josh's answers to the live walkthrough and the coordinator's cards; recorded here so no
  session asks again.

**8 October implementation scope note:** The owner subsequently requested and approved
implementation of the audit remediation backlog, including CAP-001's expected-discharge
editor. Local implementation now uses the existing guarded date event. This records the
new task scope without changing the historical ruling or treating the earlier deliberate
omission as a confirmed accidental defect. No wider intervention or forecasting policy
is inferred.

## D-20. One high-contrast colour check retired (26 September)

- **Decision:** Josh chose "Retire" (decision card, 25 Sept 16:39 UTC): the search page's check
  "does repointing --ward-border under forced colours change what is painted?" is archived with a
  written reason, nothing deleted, nothing else changes.
- **Why:** a shared token layer (since 5 Sept) sets both border tokens to the same value on every
  Ward Flow screen, measured on 26 Sept, so the check could only ever read "identical" and measured
  nothing. Archive and measurement:
  `docs/history/archive/retired-tests/2026-09-26-forced-colours-ward-border-probe.md`.
- **Left open:** whether the screen-local forced-colours repoint blocks are now dead code.
- **Subsequent note (25 October 2026):** The archive file named above was removed with the old
  history documents in #296. It remains in git history only.

## D-21. Coordinator bed board: all nine recommended answers (26 September)

- **Date:** 26 September 2026, 00:53 Perth. **Decided by:** Josh ("go ahead with all recommendations").
- **Decision:** 1A the bed board lives in the existing Capacity screen; 2A urgency shows as recorded,
  with no time targets; 3A out of service, discharges held up and locked stay separately named; 4A HDU
  is left off until Josh defines it; 5A an out-of-service bed says its reason is not recorded; 6A no bay
  or room needs on queue cards; 7A queue cards keep today's words; 8A Capacity shows discharges due
  today and transfers today per ward, with "Not recorded" where unknown; 9A "Coordinator to review"
  shows as a flag on the queue card.
- **Why:** Show only what is recorded, keep the approved layout, and add no invented targets or words.
  The question list and options are in `ward-flow-logs/drafts/bed-board-decisions-2026-09-26.md`.

## D-22. No legal limits in hour rules; the rest are labelled defaults (26 September)

- **Date:** 26 September 2026. **Decided by:** Josh ("1A … go ahead with this please"; "yes to both";
  "yes to all recommendations" for 2A).
- **Decision:**
  - Any hour rule that claims a legal limit comes out. Where it is unclear whether a rule is a legal
    limit or an operational default, it comes out too and is listed for Josh's review (2A).
  - Every other hour or percentage rule becomes a labelled default, "your default, not a legal
    limit", like the 9:30 morning roll-up. They live in one module,
    `src/components/ward-management/ward-operational-defaults.ts`, with the values the screens used
    before, and the settings screen lists them read-only. Making them adjustable is later work.
  - The word "breach" is removed from everything a user sees or hears. Internal names are unchanged.
  - A guard test stops "breach", made-up figures and typed hour limits creeping back.
- **Why:** The screens stated legal limits the software never checked, and called operational
  thresholds breaches.

## D-23. Leave-bed fields kept; patient search stops matching by ward (26 September)

- **Date:** 26 September 2026, about 04:59 Perth. **Decided by:** Josh ("Yes both", to the
  coordinator's two questions).
- **Decision:**
  - Leave beds keep their kind (off-ward or medical trip) and the warning when leave has been open
    24 hours. The 24 hours is labelled as Josh's own default, not a legal limit, in the same style as
    the morning roll-up (D-17).
  - Patient search no longer matches a person through the referrals and movements linked to them.
    Typing a ward's name had listed everyone accepted there, which disclosed where a person was
    referred (it came in with 5d7f438126). Search matches the person's own record only.
- **Why:** The leave-bed fields name no patient and are useful; the search behaviour was a privacy
  leak nobody had ruled on.

## D-24. Hour-rules morning list: all A (26 September)

- **Date:** 26 September 2026, 01:42 UTC. **Decided by:** Josh ("Yes to all recommendation", answering
  "Hour rules: all A?").
- **Decision:** the six items taken out under D-22's 2A rule, settled:
  1. The 24-hour hospital wait comes back as Josh's default (`LONG_WAIT_MINUTES`), worded "Waiting over
     24 hours", in a neutral colour, labelled "your default, not a legal limit", with no "breach" and no
     "standard".
  2. The 12-hour handover flag stays out.
  3. The capacity tracker's "statutory deadline" alarm stays out.
  4. The morning census keeps "your morning roll-up, your default, not a legal limit".
  5. The Delays "Over 24 hours" group is plain grey. Josh overrode 5A on a card (01:47 UTC): "Neutral:
     plain grey like the other groups; no hint of a limit." The same neutral colour applies to
     "Waiting over 24 hours" everywhere (item 1).
  6. Superseded by the neutral card: no 24-hour line is drawn on the Delays chart ("no hint of a
     limit").
- **Also (question 14, "Yes to both"):** the 85% occupancy target, the 90% WEAT target and the ACEM
  8-hour target lines come off the screens until they have a source.
- **Also (card, 02:35 UTC):** the 1-hour and 3-hour warnings before a recorded legal due time stay as
  Josh's defaults (`DUE_SOON_URGENT_MINUTES`, `DUE_SOON_MINUTES`), labelled "your default, not a legal
  limit" and listed in Settings. Making them changeable in Settings is the same later work as the other
  defaults.
- **Why:** a long wait is worth seeing, but only as Josh's own threshold, never as a law.

## D-25. The lone-patient check counts free beds on both matching paths (26 September)

- **Date:** 26 September 2026, 02:26 UTC. **Decided by:** the coordinator's brief (Fix 2), applying the
  rule the referral path already followed (fix round C, F3); no new rule.
- **Decision:** the movement path's `sex_mix` check now reads free beds, `min(allocatable, empty)`,
  exactly as the referral path does, so a ward with 3 allocatable beds but 1 empty no longer passes it.
  Nothing else changes: the movement path's `allocatable_bed` check still reads `allocatable`.

## D-26. Select fold checks by changed risk (27 September)

- **Date:** 27 September 2026. **Decided by:** Josh ("overhaul this now and make it significantly more
  efficient" and avoid excessive heavy testing).
- **Decision:** `select-fold-gate.mjs` assigns STATIC, FOCUSED or FULL from the changed paths. Local
  tooling uses its focused contracts, Ward screens use focused unit and selected browser checks,
  and shared behaviour, test infrastructure, executable/test deletions and unknown scope use FULL.
  The complete offline suite runs once daily on the ward line as well. Reuse passing checks on an
  identical merged tree. Start batches with branches already READY; do not wait 15 minutes for a
  promised branch. This replaces D-5's blanket retest, R24's grace, R25's engine fast lane, R28's
  grace, R31's assumption that every branch waits for a full batch suite, and R38/R39/R48's former
  blanket check wording. The fold lock, backup, diff inspection and local-only boundary remain.
- **Why:** On 27 September, a three-file queue-tool change passed its four related merged-tree tests
  but then waited over 14 minutes in a roughly 9,600-test fold suite. The full suite did not target
  a plausible additional failure path for that change and blocked the shared wide slot.
- **Subsequent note (25 October 2026):** `select-fold-gate.mjs` was retired with other unused
  scripts (commit 97fa3e25), so the fold selection named here no longer runs.

## D-27. Ward Flow uses its dedicated repository (28 September)

- **Date:** 28 September 2026. **Decided by:** Josh.
- **Decision:** `BigSimmo/Ward-Flow` is the sole GitHub repository for current Ward Flow work. Use
  an isolated worktree based on its `main` and verify `git remote get-url origin` before any Git
  write or publication. `D:\Worktrees\Database\ward-lead` and `BigSimmo/Database` are legacy
  sources, not destinations for this project. Pushes, pull requests, merges and deployments remain
  separate actions requiring their applicable authorisation and checks. This supersedes D-1's
  local-only and no-linked-repository directions and R1's no-GitHub direction; their historical
  record remains above.
- **Why:** The old shared checkout pointed at PsychSift. Its instructions caused Ward Flow work to
  be aimed at the wrong repository. A verified dedicated repository prevents that mix-up.

## D-28. Design Modernization & Anti-Box Architecture (30 September 2026)

- **Later status (9 November 2026):** partly replaced. Item 4 by D-42; item 5's 2px left hairlines by D-94 item 2. Source unverified: the approval quoted above has no thread, time or message recorded; awaiting his keep/strike pass (9 Nov 2026 audit).
- **Date:** 30 September 2026. **Decided by:** Josh ("I approve these 7 recommendations").
- **Decision:** The 7 rigid design rules that caused repetitive boxy styling, clumsy accordion layout shifts, and artificial UI bloat are modernized:
  1. **Floating Dynamic Island HUD (0 Clicks, 0 Layout Shift):** The Standing Figures rule is modernized. Alarms remain 0-clicks away in a persistent header HUD that dynamically expands and pulses on active alerts, replacing the bulky accordion dropdown panel that shoved page content down.
  2. **Visual Priority Triage, No Runtime Crash:** The fatal runtime throw in `WardFigureStrip` (`flagged > 2`) is eliminated. Multiple alerts are handled gracefully with visual triage (highlighting primary breach + aggregate counter); the application never crashes on clinical alert surges.
  3. **Accessible Smart Badges:** Compact icon + number pills are authorized, paired with full screen-reader accessibility labels (`aria-label`) and progressive disclosure tooltips rather than forcing verbose sentences onto button faces.
  4. **Micro-Typography Exemption (10px–11px):** **Replaced by [D-42](#d-42-12px-typography-floor-with-no-uppercase-exception-reaffirmed-in-design-system-v9-910-october-2026); original decision retained below.** A scoped exemption to D-3's 12px floor is granted for uppercase, letter-spaced, high-contrast auxiliary metadata and telemetry tags (e.g. `HDU`, `OVERRIDES`, `CH 1`), keeping patient data and numbers >= 12px.
  5. **Subtle 2px Left Hairlines & Status Pips:** Fine left-border accent lines and status pips are authorized for clinical urgency indicators, removing the need to wrap metrics in heavy, full-bordered card boxes.
  6. **Anti-Box Modernization Authorized:** Rule R4 is amended with an official owner authorization: design modernization to replace outdated rectangular card boxes with dynamic HUDs, natural language statements, and clean Swiss layouts is approved across Ward Flow.
  7. **Fluid Inline Strips & Narrative Stacks:** Rigid 2/3/5-column metric grids (`.figureStrip`) may be replaced with flexible horizontal strips, natural language executive sentences, and adaptive inline pills.
- **Why:** The previous rules created a rigid design straitjacket where developers were forced into boxy cards, verbose buttons, and layout shifts to avoid breaking dogmatic rules.

## D-29. Act time limits shown as a labelled synthetic demo (4 October 2026)

- **Date:** 4 October 2026. **Replaced by D-70** (20 October 2026). **Decided by:** Josh (item 13 thread: "Go ahead for act drafting task",
  then "Ok I give permission" after reviewing the draft of the Act time limits).
- **Decision:** This narrows D5 for one purpose. The Legal forms screen may show the Mental Health
  Act period for a recorded form, with its section reference. It is labelled "Synthetic demo, not
  legally checked" and counts down from the written time a person typed. Only periods with a written
  source appear. They are held in one file,
  `src/components/ward-management/legal-forms/act-periods-demo.ts`, and the section-citation guard
  exempts that file and its test only. The typed expiry from the paper form stays the record, and
  the engine still never writes a computed `dueAt`. Forms 1B and 3D have no period until a source is
  confirmed. Everything else in D5 is unchanged.
- **Why:** Josh asked for statutory countdowns as a clearly labelled synthetic demo. The WA legal
  review on the "before any real patient" list is still required before any real use.

## D-30. Central Coordinator Approval for Inter-Ward Bed Transfers (6 October 2026)

- **Source unverified:** no words of Josh's recorded; awaiting his keep/strike pass (9 Nov 2026 audit).
- **Date:** 6 October 2026. **Decided by:** Josh (product owner & psychiatrist).
- **Decision:** Inter-ward patient transfers between hospitals/facilities must receive central bed coordinator approval and visibility; direct uncoordinated ward-to-ward transfers are not permitted in the matching engine. Direct community clinic referrals (e.g. Alma Street, Stirling Clinic) are deferred to Phase 2 (resolving DECISION-03).
- **Why:** Uncoordinated transfers between hospital wards bypass the statewide acute bed allocation queue, creating blind spots for ED patients awaiting urgent admission. Central coordinator oversight ensures equitable allocation based on statewide clinical acuity.

## D-31. Gender-Diverse Bed Placement Policy & Clinical Override Safety (6 October 2026)

- **Source unverified:** no words of Josh's recorded; awaiting his keep/strike pass (9 Nov 2026 audit).
- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** Automatic algorithmic room placement for gender-diverse or non-binary patients is deferred. The bed-matching engine retains gender eligibility rules in `ward-eligibility.ts` (Female, Male, Non-binary, Different term, Not recorded) and alerts the coordinator when a patient's gender identity requires individual room accommodation (e.g. single room with ensuite vs shared bay). Placement requires explicit clinician review, multi-disciplinary agreement, and documented clinical rationale (resolving DECISION-05).
- **Why:** Algorithmic assignment of shared multi-bed bays carries clinical, cultural, and psychological safety risks. Human clinical judgment must govern individual bed assignments while honoring patient identity and ward physical layout.

## D-32. FIFO Waiting Time with Clinical Triage Badging vs Algorithmic Urgency Sorting (6 October 2026)

- **Source unverified:** no words of Josh's recorded; awaiting his keep/strike pass (9 Nov 2026 audit).
- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** The emergency referral queue defaults to sorting by waiting time (FIFO) with prominent, standardized ATS Triage Category badges (1–5) and clinical urgency flags displayed on each row. Pure automated algorithmic re-ordering by urgency or predictive wait times is deferred (resolving DECISION-07).
- **Why:** Pure algorithmic re-sorting creates clinical bias, gaming, and "black box" queue jumping that obscures how long lower-acuity patients have been waiting in emergency departments. Clinicians and bed managers require transparent, chronological visibility with clear acuity visual aids to make defensible allocation decisions.

## D-33. Separation of Local Ward Shift Notes from Statewide Coordinator Telemetry (6 October 2026)

- **Source unverified:** no words of Josh's recorded; awaiting his keep/strike pass (9 Nov 2026 audit).
- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** Local nursing and medical shift notes recorded on the Handover screen remain strictly local to that ward's operational view. Only standardized operational telemetry—patient transfer status, departure/arrival timestamps, clinical alert flags (e.g., falls risk, 1:1 nursing requirement), and statutory MHA form statuses—are published to the central statewide coordinator (resolving DECISION-06).
- **Why:** Granular nursing observations and shift handovers contain sensitive, point-in-time clinical observations intended for direct bedside care. Publishing raw nursing notes statewide creates privacy exposure and information overload for central coordinators, who need concise operational facts.

## D-34. Acute Medical Deterioration Bed Release and Escalation Protocol (6 October 2026)

- **Source unverified:** no words of Josh's recorded; awaiting his keep/strike pass (9 Nov 2026 audit).
- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** When an emergency department patient accepted for psychiatric admission acutely deteriorates medically prior to transport, the bed allocation must be formally cancelled. The reserved inpatient bed is immediately released back to the statewide pool, tagged with the audit record "Medical Deterioration - ED Resuscitation Required", and the psychiatric referral is paused until medical stabilization and clinical re-clearance.
- **Why:** An acute medical emergency (e.g. overdose complications, sepsis, respiratory distress) takes absolute precedence over psychiatric transfer. Holding an inpatient psychiatric bed while a patient undergoes medical resuscitation blocks another waiting psychiatric patient from accessing care.

## D-35. Deferral of Regional Multi-Leg Transport & RFDS Repatriation (6 October 2026)

- **Source unverified:** no words of Josh's recorded; awaiting his keep/strike pass (9 Nov 2026 audit).
- **Date:** 6 October 2026. **Decided by:** Josh.
- **Decision:** Regional multi-leg patient journeys (e.g., Kimberley, Pilbara, or Goldfields transport involving Royal Flying Doctor Service flights and secondary road ambulances) are formally deferred to the post-pilot regional expansion phase. The current prototype models metropolitan road transport via St John WA Patient Transfer.
- **Why:** Regional aeromedical transfers involve complex flight logistics, weather delays, and multi-agency coordination that would add excessive complexity to the core metropolitan prototype demonstration.

## D-36. Affirmation of External Governance & Clinical Safety Hard Gates (6 October 2026) (Replaced by D-87)

- **Date:** 6 October 2026. **Decided by:** Josh (affirming Item 63 ruling of 17 September 2026).
- **Decision:** The 10 external human, legal, and ethical governance gates remain formally parked hard gates until the prototype progresses toward production readiness and before ANY real patient data or live EHR connection is permitted (per Item 63):
  - External Privacy & Multi-Tenant Azure Entra ID isolation.
  - WA Crown Law formal legal sign-off on Mental Health Act statutory forms and statutory limits.
  - Production multi-tenant cloud database connection and disaster recovery.
  - Live phone-verified statewide mental health service directory.
  - Formal appointment of an Australian Clinical Safety Officer (CSO) and live hazard log.
  - Independent Aboriginal Cultural Safety Review commissioned by Josh.
  - TGA Medical Device (SaMD) regulatory classification.
  - Formal External Privacy Impact Assessment (PIA).
  - Post-Incident Review (PIR) forensic audit logging standard.
- **Why:** These activities require external institutional, legal, and regulatory processes that cannot be simulated or solved in code. They are intentionally decoupled from the demonstration prototype per the Prototype Operating Mode.

## D-37. External Governance Hard Gate Operational Postures & Resolution Roadmap (6 October 2026) (Replaced by D-87)

> **Implementation clarification — 8 October 2026 (evidence, not a new owner ruling):**
> D-37 records intended standards and internal adoption. It does not constitute
> institutional, legal or TGA approval. Local roles are simulated, not authenticated
> staff accounts; the private Azure snapshot service is not shared service persistence;
> runtime logs are mutable and do not provide authenticated tamper-evident PIR exports.
> D-18 stops browser persistence after typed-text events. The current legal forms
> mapping identifies Form 5A as a community treatment order and Forms 6A/6B as
> inpatient treatment orders; the earlier 5A inpatient wording below is corrected.
> TGA exclusion/exemption applicability requires a function-scoped intended-purpose
> assessment; an excluded function and an exempt medical device have different duties.
> See [production-readiness evidence](governance/PRODUCTION-READINESS.md).

- **Date:** 6 October 2026. **Decided by:** Josh (product owner & psychiatrist).
- **Decision:** Following full review of the 10 parked external governance gates (Item 63 and Decision D-36), formal operational postures, clinical standards, and resolution pathways are ratified across all 9 domains:
  1. **External Privacy & Service-Scoped Authority:** Ratified 4-tier Role-Based Access Control (RBAC) specification: (1) Statewide Bed Coordinator, (2) Inpatient Nurse Unit Manager / Bed Manager, (3) ED Psychiatric Liaison Clinician, (4) Executive / Operations Viewer. Local demonstrations continue using mock role simulation; Entra ID SSO will map directly to these 4 roles during live hospital hosting commissioning.
  2. **WA Crown Law Legal Advice on Forms & Statutory Limits:** Ratified the "Advisory Notice Only" doctrine. Software displays advisory timers and countdown alerts based strictly on clinician-recorded timestamps; software never computes binding legal expiry or automatically alters/detains/discharges a patient under the WA _Mental Health Act 2014_. Physical signed statutory forms remain authoritative. Involuntary inpatient placements (`Forms 6A/6B`; Form 5A is a community treatment order) remain strictly locked to gazetted authorised hospital beds. Pre-drafted compliance pack (`docs/ward-flow/governance/WA-MENTAL-HEALTH-ACT-COMPLIANCE.md`) approved for State Solicitor's Office / Office of the Chief Psychiatrist submission.
  3. **Authoritative Multi-Tenant Persistence & Live Cloud Recovery:** Ratified cloud database deferral standard (affirming D-18). Backend Azure code and optimistic concurrency control (`expectedRevision`) are complete and verified; live cloud database connection remains parked until Health Service Provider pilot funding and dedicated GovNext network commissioning. Local JSON scenario persistence remains active for demonstrations.
  4. **WA Health Verified Service Directory:** Ratified "Advisory Directory with Coordinator Override" standard. The transcribed 2026 WA Health catchment schedule (~537 suburbs and catchments) is adopted as the demonstration baseline; live clinic-by-clinic phone audit is parked until site onboarding. Bed coordinators may manually assign out-of-catchment clinics by recording an auditable reason flag.
  5. **Clinical Safety Officer & Live Hazard Log:** Ratified Clinical Safety Case (`docs/ward-flow/governance/CLINICAL-SAFETY-CASE.md`) as the formal baseline. Josh acts as Clinical Sponsor / Lead Psychiatrist; Hazards HAZ-01 through HAZ-05 are actively mitigated in code; formal appointment of an external certified Australian CSO (or Health Service Clinical Governance Unit) is scheduled as an entry gate prior to real-patient clinical pilot.
  6. **Aboriginal Cultural Safety Review:** Ratified Aboriginal Cultural Safety Charter (`docs/ward-flow/governance/ABORIGINAL-CULTURAL-SAFETY-CHARTER.md`). The review is formally retained as an independent external engagement commissioned directly by Josh with Derbarl Yerrigan, WACHS Aboriginal Health Strategy, AHCWA, and Aboriginal Lived Experience representatives when real-world deployment is planned.
  7. **Medical Device TGA / SaMD Classification:** D-37 records an internal position, not a TGA determination. The classification remains pending a qualified assessor's review of each function, its intended purpose, claims and intended users against current TGA instruments, and a signed determination. Exclusion and exemption are distinct; an exempt clinical decision support software device remains a regulated device with applicable obligations. The internal position is that Ward Flow is an operational bed-coordination tool that does not automate diagnosis or therapy, does not process raw physiological signals, and requires independent clinician verification for all placement decisions (per D-31).
  8. **External Privacy Impact Assessment:** Ratified Privacy Architecture Standard. 100% synthetic patient isolation guaranteed; data minimisation on public flight decks and ward boards (Bed ID, initials, age, gender code, legal status only); detailed clinical notes restricted to authenticated role-scoped views. External legal PIA scheduled during hospital IT onboarding.
  9. **Post-Incident Review Architectural Scope:** Ratified PIR Immutable Telemetry Specification. The system captures append-only timeline events under Invariants I-01 through I-14 (recording occurrence, dispatch, and commit timestamps, user ID, prior state, new state, and clinician override reasons). A single-click "PIR Chronology Export" standard is adopted to supply tamper-evident chronologies for hospital clinical incident reviews (SAC 1) and Coronial inquiries.
- **Why:** Replaces passive parking with definitive, clinically and legally defensible governance standards across all 10 items, establishing complete pre-pilot governance readiness.

## D-38. Leave, absent without leave and CTO on the Patient page (9 October 2026)

- **Date:** 9 October 2026. **Decided by:** Josh, in the Patient page gate board session ("go
  ahead and do now", approving the engine change the build handed back).
- **Decision:** The Patient page shows On leave, Absent without leave and On a CTO as their own
  modes. On leave reads the existing leave bed on the stay (no new field). Absent without leave is
  recorded on that same held bed (`absentWithoutLeave`: when it was recorded and the time each of
  five fixed missing person steps was done), so no bed figure moves. A community treatment order is
  a new optional patient field, `communityTreatmentOrder` (Form 5A, when recorded and by which
  role). Four events carry them: `RECORD_ABSENT_WITHOUT_LEAVE` and `RECORD_ABSENCE_STEP` (ward),
  `RECORD_COMMUNITY_TREATMENT_ORDER` and `END_COMMUNITY_TREATMENT_ORDER` (community). Return from
  an absence uses the existing `END_LEAVE_BED`.
- **Limits:** Ids, fixed choices and times only, never typed text. No lapse or review time is held
  or computed for a CTO (D5). Next of kin, carer and guardian are still not on the record and stay
  labelled Preview.
- **Why:** The ward already has leave beds, but a missing person and a CTO could not be shown
  honestly without a field to read.

## D-39. Patients are identified by UMRN, never by a WF number (9 October 2026)

- **Date:** 9 October 2026. **Decided by:** Josh ("remove the old patient numbers you have
  everywhere, i.e. WF-005 ... replace them with UMRN ... and update docs to know this").
- **Decision:**
  - Every screen, drawer, feed, refusal and notice names a patient by **UMRN**. A `WF-...` number is
    never shown as the patient's number.
  - `WF-...` stays the internal id of one **journey** (a `Movement`): routes such as
    `/mockups/ward-flow/movements/WF-005`, React keys, `data-testid`s, engine events and fixtures.
    Renaming it would touch about 5,000 lines and every open pull request for no visible gain. It
    must not appear in visible text.
  - Read the UMRN through the D-14 resolver only: `movementUmrn` and `resolveSubjectPatient` in
    `ward-patient-resolver.ts`, or the `usePatientOf` and `useUmrnText` hooks in
    `ward-patient-name.ts` (ward screens use the provider's `resolvePatientIdentity`). Engine prose
    that quotes a journey id passes through `withUmrnInPlaceOfMovementIds` before it is shown;
    refusals are converted when they are raised. An unlinked, ambiguous or unknown journey shows
    "UMRN not recorded"; a refusal keeps the id in its `movementId` field for diagnosis. Pass the
    full records (referrals included, or a journey linked through a referral reads as unknown) and
    build that lookup once per render, because the resolver caches its index on the object.
  - **Synthetic UMRN format:** two letters `UM` then six digits, for example `UM100047`. A real WA
    UMRN is one letter then seven digits, so these can never be mistaken for a real patient, and
    the synthetic-data guard (`src/lib/synthetic-data-guard.ts`) does not flag them. Ranges: hand
    authored patients `UM1nnnnn`, generated patients `UM5nnnnn`, the rulings demo `UM60nnnn`, the
    demo network `UM7nnnnn`, the community demo cohort its own six digits.
  - **Update, 15 October 2026.** Decided by Josh ("you should have purged all these numberings
    from the site"). Referral (`RF-...`), patient (`PT-...`), admission (`AD-...`) and bed release
    (`WR-...`) numbers are now also kept off screens, toasts and accessible names. A screen names
    the person by name and UMRN, or says the record kind, such as "this referral". The ids stay in
    routes, keys, test ids, engine events and fixtures. Statistics screens keep admission ids
    because they deliberately show no patient identity.
  - **Addresses, 15 October 2026.** Decided by Josh ("Screens and addresses"). A link to a
    journey, person, referral or stay carries an address code that carries no record number. The
    same goes for query values that name a record. The code is made from the id itself, so a record
    added while the app runs gets a working link at once. Old links that still hold a raw id keep
    working: the movement and person pages send them on to the coded address with the query kept,
    and query readers accept either form. Refusals and notices say "this referral" or "this stay"
    in place of a record number, and the ids stay in their data fields. The code only keeps the
    number out of the address bar. It is not a privacy control.
  - Names and UMRNs come only from the resolver. When it has none, a screen shows "Name not
    recorded" and "UMRN not recorded". `patientIdentityLine` writes the shared "Family, Given ·
    UMRN" line.
- **Why:** Staff on shift search and hand over by UMRN. A journey number nobody else uses reads as
  a second patient number and invites mistakes.

## D-40. A second community treatment order keeps the first (9 October 2026)

- **Date:** 9 October 2026. **Decided by:** Josh ("take over and fix the CTO finding", PR #147).
- **Decision:** Recording a CTO after an earlier one has ended keeps the ended order. It moves into
  `earlier`, a list inside the same D-38 `communityTreatmentOrder` field, and Documents lists every
  earlier order as Closed. No new patient field is added. Each earlier order holds the same four
  facts as D-38 (Form 5A, when recorded, by which role, when ended) and nothing else.
- **Why:** Review found that a second CTO overwrote the first, so its Closed Form 5A vanished from
  Documents. Refusing a second order would have blocked a real re-order; a separate history field
  would have widened what the record holds.

## D-41. Delays board filters narrow the table and state the hidden count (9 October 2026)

- **Date:** 9 October 2026. **Decided by:** Josh.
- **Decision:** On the October 2026 Delays board, hero counts, whose-move tiles, chips and graph
  choices keep filtering the Waiting table, as the approved Delays page mockup draws it. Whenever a
  filter hides anyone, the table must say how many people are hidden and offer "Show everyone".
  For this board, this supersedes the 2026-09-07 "a chip highlights, it never hides" ruling. The
  old Delays table and graph components (`delays-data-views.tsx`, `delays-coordination.tsx` and
  their stylesheets) are deleted.
- **Why:** The mockup's narrowing is the approved behaviour. The hazard behind the September ruling
  (a filtered-out patient looking like a placed one) is closed by the stated hidden count, which
  `tests/ward-delays-screen.dom.test.tsx` guards.

## D-42. 12px typography floor with no uppercase exception reaffirmed in Design System v9 (9–10 October 2026)

- **Date:** 9–10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §4 & §14, reaffirming O-15.1).
- **Decision:** The 12px minimum font-size floor holds across all Ward Flow surfaces with no uppercase exception. Five page type steps are used (`20px`, `15px`, `14px`, `13px`, `12px`, plus `28px` for sign-in and print only); `11px` and `16px` steps are retired (`--wf-fs-11` aliases `12px` and `--wf-fs-16` aliases `15px`). This supersedes D-28 item 4's temporary 10px–11px uppercase micro-typography exemption.
- **Why:** Sub-12px uppercase eyebrows, counts, tier pills and chart ticks failed readability on ward monitors and contradicted ruling O-15.1.

## D-43. Colour lives in glyphs and the hero; red means act now with a thin 1px edge, never a fill (9 October 2026)

- **Later status (9 November 2026):** partly replaced by D-94 item 2. The thin act-now edge is gone; tone goes in the status glyph or a small tinted tag.
- **Date:** 9 October 2026 (`2026-10-09`). **Decided by:** Josh (`design/v9/design-system-v9.md` §1, §3 & §14).
- **Decision:** Semantic tone lives in status glyphs, the hero band, and a thin `1px` edge (`--wf-act-edge` via `.edge-act`) on act-now items. Red (`--wf-danger`) means "act now" and nothing else. Cards, rows and tiles take no tinted fill (except a free or fit bed, which keeps its soft fit tint), and standalone status words use their `-ink` token partner.
- **Why:** Full-card tinted washes and competing red badges diluted urgency cues and made normal operational rows look like clinical alarms.

## D-44. Compact sizing, white cards and smaller text retained over expression-test card tints (9 October 2026)

- **Date:** 9 October 2026 (`2026-10-09`). **Decided by:** Josh (`design/v8/design-system-v8.md` v8.2 & `design/v9/design-system-v9.md` §14).
- **Decision:** After comparing the v8.1 expression test against the earlier Ward page, Ward Flow retains the compact scale, white/surface cards, smaller text (`13px` body, `14px` card titles, `15px` mono figures) and compact hero chips, while retiring v8.1 card tints and 40px hero figures.
- **Why:** Compact white cards keep high-density clinical lists calm and scannable while preserving the shift timeline and dedicated phone design.

## D-45. Phone is its own 390×844 design, never a desktop reflow (9 October 2026)

- **Date:** 9 October 2026 (`2026-10-09`). **Decided by:** Josh (`design/v9/design-system-v9.md` §7 & §14).
- **Decision:** Phone (`390×844`, below `--wf-bp-narrow` `48rem`) is a dedicated mobile design—priority list, cards with one action, bottom sheets, a sticky `44px` bottom bar and a segmented control—never a squashed desktop multi-column reflow. Names render at `14px`, meta at `12px`, rows tap as a whole, row actions are at least `36px`, and phone bars use solid surfaces rather than glass blur.
- **Why:** Clinicians walking the ward on a phone need immediate priority triage and thumb-reachable bottom sheets rather than stacked desktop tables.
- **Subsequent note (25 October 2026):** The `--wf-bp-narrow` token no longer exists. The phone breakpoint is the same `48rem`, read from `WF_PHONE_QUERY` in [`use-is-phone.ts`](../../src/components/wf/use-is-phone.ts).

## D-46. Every page has a focal part, a part of its own, a page-specific hero and command-bar action rules (9 October 2026)

- **Date:** 9 October 2026 (`2026-10-09`). **Decided by:** Josh (`design/v9/design-system-v9.md` §1, §7, §9 & §14).
- **Decision:** Every page answers one question in 5 seconds: its focal part sits in the first screen with the most space, its hero title states the answer in five words or fewer (e.g. "Short 26 beds"), and each page carries a signature part of its own (such as the shift timeline on Ward Hub). The page owns its top command-bar action, the hero holds facts and at most one primary action on the left with page-specific actions on the right, and each area has at most one primary button.
- **Why:** Uniform template pages without a focal component or clear action hierarchy made every screen look identical and hid the primary shift task.

## D-47. Glass stays about 80% opaque with the top sheen kept (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh ("keep the Apple shine at 80% opacity", `design/v9/design-system-v9.md` §3 & §14).
- **Decision:** Chrome and overlay glass stays largely opaque at about 80% (`80%` day / `78%` night for `.glass.bar`, `84%` / `82%` for `.glass` popovers and palette, `88%` / `86%` for `.glass.sheet`), keeping the cool day tint (`rgba(244,247,250)`), `1px` bright top edge, top sheen gradient and `saturate(1.4)`. Never use glass on data tables or cards; reduced transparency and unsupported browsers fall back to solid `--wf-raised`.
- **Why:** Overly transparent glass lost legibility over busy clinical tables by day, whereas 80% opacity with the top sheen preserves depth and 4.6:1+ contrast.

## D-48. Figures stay in Geist Mono with tabular digits while chart axes use Geist Sans (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh ("keeps the control room feel", `design/v9/design-system-v9.md` §4 & §14).
- **Decision:** All operational figures—counts, percentages, durations (`.num`), hero chips, stat values, clock times, UMRNs and record IDs—render in `Geist Mono` with `tabular-nums`. Chart axes and tick labels use `Geist Sans` so charts read quietly, while chart data values stay in mono.
- **Why:** Tabular monospace digits give the bed-coordination board its control-room alignment and scannability without cluttering chart axis labels.

## D-49. Ward Flow 44px default row target (dense 36px, touch 52px) vs retired 48px PsychSift tap knob (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §5 & §14).
- **Decision:** Ward Flow rows, beds, controls and card heads bind to `data-density` on the shell (`--wf-row`): `44px` default, `36px` `dense` (long lists on large desktop screens), and `52px` `touch` (ward touchscreens and coarse pointers). Desktop pointer targets are at least `28px` (`--wf-target`) and reach `44px` on touch/phone via hit area. The `48px` `--spacing-tap` knob in `docs/design-system/DECISIONS.md` (C2) belongs exclusively to the retired PsychSift design system and does not govern Ward Flow.
- **Why:** Reconciles the Ward Flow density scale (`36px` / `44px` / `52px`) against legacy PsychSift documentation so agents do not apply PsychSift's 48px tap rule to Ward Flow rows.

## D-50. Neutral T1 urgency pill vs Form 1A amber statutory warning badge (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §10 & §14).
- **Decision:** The `T1` clinical urgency tier pill (`.tier`, `TierTile`) renders in neutral monospace styling rather than a red or coloured fill, because red is reserved strictly for "act now" glyphs and thin edges. By contrast, Mental Health Act statutory form expiry/assessment badges (such as a `Form 1A` approaching its recorded assessment window) carry the amber warning tone/glyph when due soon, never a red fill on a static tier label.
- **Why:** Keeps triage tier classification (`T1`–`T3`) visually distinct from time-critical statutory form warnings (`Form 1A`) and "act now" clinical alerts.

## D-51. Delays filters hide rows with a stated hidden count while other queues highlight by default (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §9 & §14, harmonising D-41).
- **Decision:** Across queues of 100 rows or fewer, filter chips (`HighlightPills`) highlight matching rows by default and dim non-matching rows with `--wf-dim` (`data-dim`, stating `"N of M highlighted, all rows stay"` with `Clear`). By explicit owner exception (D-41), the Delays board filters continue to hide non-matching rows and state the hidden count with `"Show everyone"`.
- **Why:** Preserves context on standard queues so waiting patients never vanish silently, while honouring the approved Delays board narrowing contract.
- **Subsequent note (25 October 2026):** The `HighlightPills` component no longer exists, and the Delays board is now the Waiting screen (`/ward-flow/waiting`). The names above are kept as they were decided.

## D-52. 10 October page review rulings: time-axis overdue zone, 15px/20px strip figures, 8px people pips and incremental shared parts (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §3, §4, §5, §10 & §14).
- **Decision:** From the 10 October page review: (1) `--wf-overdue-zone` (danger tone at 6% day / 8% night) tints the overdue region on time axes only, never cards, rows or tiles; (2) queues highlight by default (see D-51); (3) figures in strips and tiles use `15px` mono, with `20px` reserved for titles and at most one focal strip per page; (4) people pips use `8px` glyphs only when accompanied by their numeric figure; and (5) remaining shared parts (`ViewSwitch`, `WardCapacityRow`, `GroupHead`, `NeedsYou`, `KeyHints`, `RecordCard`, `RailSummary`) are built incrementally when each page is next touched.
- **Why:** Settles the pending page-review questions from the v8/v9 transition so screen migrations have one unambiguous specification.

## D-53. Elevate design language and Glare mode adopted for Design System v9 (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh ("Go ahead with all your recommendations", `design/v9/design-system-v9.md` §§9–14).
- **Decision:** The Elevate recommendations are adopted into Design System v9 and implemented in `src/app/ward-flow-v9-tokens.css` and `src/components/wf/v10-parts.tsx`: one action blue (`--wf-accent` `light-dark(#245a8c, #8cbcf0)`), a fixed top-right radial light on the hero, visible day glass, quiet slate (`--wf-data-closed`) with a dashed edge for closed beds (never gold), the Section 12 Elevate parts (`QuietUnits`, `MixedAnswer`, `FadeHairline`, `PressureArc`, `FigureRoll`, `AllClear`, `BedPlan`, `RowSpark`, `DeltaTwins`, `JourneyRibbon`, `SinceYouLooked`, `CommandPalette`, `UndoHairline`), and Glare mode (`data-mode="glare"` via `clinical-kb-glare` for ward PCs near windows).
- **Why:** Unifies the v9 token layer, Elevate shared components, and bright-ward readability mode into one standard.
- **Subsequent note (15 October 2026):** The Top 25 `CommandPalette` item was dropped in the 15 October Top 25 review, and its implementation and exports were removed. The original decision remains as historical context; the design-system inventory now treats the command palette as outline-only.

## D-54. Tier time thresholds remain synthetic demo values requiring clinical sign-off (10 October 2026)

- **Date:** 10 October 2026 (`2026-10-10`). **Decided by:** Josh (`design/v9/design-system-v9.md` §14).
- **Decision:** Urgency tier (`T1`–`T3`) time thresholds and target lines in the demonstration prototype remain synthetic placeholder values and require formal clinical governance sign-off before any real-patient or live operational use (consistent with D-4, D-22 and D-36).
- **Why:** Prevents synthetic demonstration wait thresholds from being mistaken for ratified WA Health clinical policy.
- **Subsequent note (15 October 2026):** Josh signed the tier targets for the prototype (D-56). This decision still stands: real-patient or live use needs formal clinical governance sign-off.
- **Subsequent note (16 October 2026):** Josh signed the remaining values for the prototype (D-63). This decision still stands, and only the health service's clinical governance process can close it.

## D-55. Supabase is Ward Flow's database and sign-in provider, and Azure is retired (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread "Big picture repo review").
- **Decision:** The dedicated Ward Flow Supabase project (`zakzoemeedfepxcstsou`) is the current database and sign-in provider for the shared synthetic workspace. The Azure Functions host, Azure Blob session vault, Azure PostgreSQL and Entra sign-in code are removed. Plain PostgreSQL stays behind the same provider seam as a fallback. [`DATABASE.md`](DATABASE.md) is the single source of truth for the provider and how to change it.
- **Why:** Supabase was already the default (PR #289), and keeping three providers left stale code and docs. One seam keeps a future switch to one adapter and one setting. Real patient data still needs separate hosting approval, a privacy impact assessment and clinical sign-off.

## D-56. Josh signs the clinical values that have a recorded source, for the prototype (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread "Clinical values file", decision card "Sign the 31 sourced"; the card miscounted, and 30 values have a recorded source).
- **Decision:** In [`ward-clinical-values.ts`](../../src/components/ward-management/ward-clinical-values.ts), every value with a recorded source (a decision id or an owner answer), 30 of the 44, is marked signed by Josh on 15 October 2026, at the figure the app ran on that day. The 14 values with "No decision recorded" as their source stay synthetic until a decision is made. Where two figures conflicted (for example the 85% bed alert against the 90% amber occupancy band), the figure the app runs on is the one signed. The other figure stays listed under "Other figures seen".
- **Why:** One file now holds every clinical threshold, so a sign-off can be recorded against each value instead of being implied. Signing is for the prototype. Real-patient or live use still needs formal clinical governance sign-off (D-54), and no value is a legal limit (D-22).

## D-57. Twenty Top 25 items move from the showcase into the real screens, each behind its own flag (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread on the Top 25 review: "Go ahead with all remaining recommendations outstanding", "Single PR").
- **Decision:** Each item below is built into a real screen from shared state, behind its own `top25-*` flag in [`ward-feature-flags.ts`](../../src/components/ward-management/ward-feature-flags.ts) (on in development and demo, off in production). Timings come from [`ward-clinical-values.ts`](../../src/components/ward-management/ward-clinical-values.ts). The Sovereign showcase and its local fixtures are removed. Items 9 and 16 are not built yet. For item 23 Josh picked option D of the phone mockups.
  - **1, discharge support notices:** after the ward confirms a discharge, the ward screen lists pharmacy, transport and cleaning with a send button that says "Not wired in this prototype." No event records them yet.
  - **2, referral cap:** asking more wards than the cap of 3 warns and asks for a reason, kept in the audit trail. Without a reason the engine still refuses. Acceptance already withdraws the other requests.
  - **3, next ward after a refusal:** the coordinator shortlist suggests the next eligible wards (main eligibility rules) and adds them through the existing Refer path. The ED declined flag names them.
  - **4, bed being made ready:** a bed still being made ready past `preparingBedStale` asks the ward to tap Ready. Nothing opens a bed or changes a count.
  - **5, discharge prep:** stays due out within `dischargePrepWindow` (24 hours) show on the ward's This shift list with their barrier. The bed drawer sets the barrier from the 7 item barrier list, from day `longStayPrompt`.
  - **6, Needs you by role:** one owner to role filter on the shared task list. The ED Needs you adds the ED owned task rows. The coordinator is never limited.
  - **7, silent ward:** the existing reminders at `silentWardFirstReminder` and `silentWardSecondReminder` suggest asking another ward at the second reminder. Nothing is moved automatically.
  - **8, step down board:** step down candidates on Capacity are matched by the main eligibility rules (single sex D-31, legal, forensic) through a stay adapter.
  - **11, seven day follow up:** every discharge shows whether follow up within `ctoFollowUpWindow` (7 days) is booked, with extra items on an active community treatment order. It warns and never blocks.
  - **12, stuck handover:** the existing Transport awaiting departure row is named "Handover waiting too long" past the transport booked target.
  - **13, ED wait steps:** one ladder from `edElevatedPressure`, `edSeverePressure`, `longWait` and `veryLongWait`, shown neutrally on ED board rows (D-24).
  - **14, arrival checklist:** a read only checklist on the ED person card from recorded medical clearance, legal form and transport. Contraband search and medication chart say "Not wired in this prototype."
  - **15, bed being made ready on a match:** the shortlist notes a bed being made ready and a medical pause read from the movement (D-34).
  - **17, undo:** the one undo pattern is `useUndoableStep`. Remaining hand made undo toasts are listed for conversion.
  - **19, paper legal form time left:** the patient forms register uses the one time left rule and the due soon settings (D-29). The radar's 4 hour amber is dropped.
  - **20, long stay summary:** the handover Beds tab lists stranded stays with barrier, hold and an escalation point at the typed expected date plus `delayedDischargeEscalation`. Not a legal limit.
  - **21, discharge date moved:** the bed tile and drawer show "Date moved N times" from the recorded count.
  - **23, phone walk round (option D):** on a phone, a bed strip in bed order sits above the grouped bed list. Tapping a bed walks the ward one bed at a time, with Reviewed, next bed and Back to list. Updates go through the bed's existing panel. Reviewed and changed this round marks are held on screen only, never saved.
  - **24, absent without leave:** the patient status card shows time away, steps done from the existing list and a bed hold review warning past `awolBedHoldWarning`.
  - **25, broadcast alerts:** the real banner can extend an alert by 2 hours (new `EXTEND_BROADCAST_ALERT`, same roles as stand down) or stand it down.
- **Why:** The showcase skipped the shared reducer and used its own unsigned rules. Building each item into the screen that already owns the job, from shared state and signed values, keeps one rule per job. Flags let unfinished items ship without changing production.
- **Open for Josh:** wording of the referral cap reasons and community treatment order items, WA Health names for the ED wait steps, whether a stuck handover turns red, the start point for the 72 hour escalation, the day 7 limit on recording a barrier, the edited date count of 3, and the unsigned values `awolBedHoldWarning` and `delayedDischargeEscalation`.

## D-58. Josh signs three more clinical values that have a national source, for the prototype (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread "Clinical values file", decision card "Sign the 3").
- **Decision:** Three of the 14 synthetic values in [`ward-clinical-values.ts`](../../src/components/ward-management/ward-clinical-values.ts) are marked signed by Josh on 15 October 2026, at the figure the app ran on that day. The ED wait escalated to a state coordinator broadcast from 12 hours takes its 12 hours from the ACEM 12 hour emergency department length of stay measure. ACEM sets the length of stay mark, not the broadcast, which stays a local workflow choice. Follow up booked within 7 days of departure takes its 7 days from the national mental health KPI for community care within 7 days of discharge (AIHW). The KPI counts a completed community contact after discharge from a public acute admitted mental health unit. The app's check is different: it looks for a booked appointment rather than a completed contact. It runs on every discharge and adds extra items for community treatment order patients, so it is a local workflow that borrows the KPI's window, not the KPI itself. The readmission flag within 28 days rests on the national mental health KPI for readmission within 28 days (AIHW). The other 11 stayed synthetic because they are local workflow choices with no external source. Later the same day the Top 25 follow-up (#339) retired the 12 hour broadcast value as unused, along with other unused synthetic values, so two D-58 values remain in the file.
- **Why:** Josh asked for a recommendation per value rather than a blanket sign-off, and only these three have a published national source. Signing is for the prototype. Real-patient or live use still needs formal clinical governance sign-off (D-54), and no value is a legal limit (D-22).

## D-59. Each role sees only what it needs, from one access table (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread "Role based access plan", plan v2 approved at 17:43 with the bed manager allowed patient pages, then "go ahead and build the plan" at 17:47).
- **Decision:** Ward Flow uses strict default deny. One table in [`ward-role-access.ts`](../../src/components/ward-management/ward-role-access.ts) says which screens each role may open and at which places, and it drives the routes, the rail, the phone menu and dock, and the desk switcher. [`ward-access-scope.ts`](../../src/components/ward-management/ward-access-scope.ts) trims the workspace to the desk's role and place before any screen reads it. The executive sees counts with no names, the access admin sees no patients, and the transport officer sees open jobs only and no longer raises referrals. Ward, ED, community and bed manager desks may break glass on one record, read only, with a reason, for a set time, and the coordinator reviews every opening. The app part ships behind the `role-access` flag. The server part (scoped replies, memberships, audit role) follows through the Backend thread and needs Josh's confirm before any live Supabase change.
- **Why:** Every desk saw the whole statewide workspace. Least privilege matches WA Health privacy expectations and keeps the demo honest about who can see what. The ward raising referrals in its own name stays on the existing borrowed-role pair until the reducer checks the referral source, so a ward cannot file a referral under another source.

## D-60. Criteria led discharge, for voluntary patients only (15 October 2026)

- **Date:** 15 October 2026 (`2026-10-15`). **Decided by:** Josh (project thread for the Top 25 follow-up, "Yes go ahead with all recommendations" at 23:21 UTC, on the review's item 9 verdict "Rework, needs your sign off").
- **Decision:** The bed panel's Plan to leave tab, on desktop and phone, records discharge criteria set by the treating psychiatrist, chosen from a fixed list of seven ([`ward-discharge-criteria.ts`](../../src/components/ward-management/ward-discharge-criteria.ts)). The ward ticks each criterion as it is met. When every one is met, the panel says the ward can confirm the discharge without waiting for the next review. It confirms nothing itself, and the existing discharge guards still apply. Only a patient recorded as voluntary is eligible. An involuntary patient is excluded because only a psychiatrist can revoke the order, and a patient with no recorded legal status or on a community treatment order is excluded until the status is recorded as voluntary. Criteria a patient already has pause if they stop being voluntary. Setting, changing or reviewing the list needs the ward to record that the treating psychiatrist set it. Criteria lapse after `dischargeCriteriaValidity` (72 hours, synthetic) and then need a review before more can be ticked. One event, `SET_DISCHARGE_CRITERIA`, sets, ticks and clears them. It ships behind the `top25-criteria-led-discharge` flag.
- **Why:** The review found criteria led discharge uncommon in inpatient mental health and safe only with criteria set per patient by the treating psychiatrist and with involuntary patients excluded. Requiring a recorded voluntary status rather than the absence of an involuntary one makes exclusion the failure mode. The criteria list and the 72 hours are prototype choices. Real patient use still needs clinical governance sign-off of both (D-54). Item 16, the inter ward swap matcher, stays parked as Later.
- **Subsequent note (16 October 2026):** D-63 cut the lapse to 24 hours and added two criteria, nine in all.
- **Subsequent note (16 October 2026):** D-64 put the criteria state on the bed tiles and beside "Record that they have left", and added the "patient told" confirmation.
- **Subsequent note (17 October 2026):** D-65 switched criteria led discharge on in production for the prototype and added up to three typed patient specific criteria.

## D-61. Tasks and Alerts are one queue called Alerts (16 October 2026)

- **Date:** 16 October 2026 (`2026-10-16`). **Decided by:** Josh (project thread "Merge Tasks and Alerts", chose design B of three mockups at 05:19 UTC, after "Go ahead with all follow-up tasks" at 05:01).
- **Decision:** The Tasks drawer and the Alerts screen showed the same list under two names, with different words for the same groups. They become one queue called Alerts. The bar button and the phone dock tab say Alerts with the same count. The desktop drawer stays as a quick look from pages other than the Alerts screen, uses the Alerts words (Act now, Waiting and Running, the same groups as the Alerts queue), and leads with Open the Alerts screen. A phone opens the Alerts screen instead of a drawer, from the dock, the Needs you row and anywhere else that opened Tasks. On the Alerts screen the button moves focus to the queue rather than opening a second copy. Only the bed coordinator's desk sees the one queue, because the task list is theirs. Other desks, and any desk whose role may not open the Alerts screen, keep the Tasks name and drawer. It ships behind the `alerts-one-queue` flag (on in development and demo, off in production).
- **Why:** Two names for one list made people wonder whether they were different work. Keeping the quick look on desktop saves leaving the current page, and the phone already had the full Alerts screen. When Josh signs it off, the flag, the Tasks words and the phone drawer path are removed.

## D-62. The one Alerts queue is signed off and its flag removed (16 October 2026)

- **Date:** 16 October 2026 (`2026-10-16`). **Decided by:** Josh (project thread "Merge Tasks and Alerts", "Permission to go ahead with your recommendations" at 06:55 UTC, answering the recommendation to remove the flag once signed off).
- **Decision:** D-61's one Alerts queue is signed off, so the `alerts-one-queue` flag is removed. The bed coordinator's desk always gets the Alerts quick look on desktop and the Alerts tab on a phone. Other desks keep the Tasks name and drawer, so the Tasks words and the phone Tasks drawer stay rather than being removed as D-61 expected.
- **Why:** Every flag stays off in production until it is removed, so removing the flag is how a signed-off change becomes permanent. Other desks still need the Tasks drawer.

## D-63. Josh signs the remaining clinical values and the criteria list, for the prototype (16 October 2026)

- **Date:** 16 October 2026 (`2026-10-16`). **Decided by:** Josh (project thread for the clinical sign-off sheet, "Yes to all" at 10:02 UTC on the clinical sign-off sheet of 16 October 2026, kept in the project's shared review files rather than this repository). The sheet's sources are listed in this entry.
- **Decision:** The 19 values still synthetic in [`ward-clinical-values.ts`](../../src/components/ward-management/ward-clinical-values.ts) are signed by Josh for the prototype. Seventeen keep their figure. Two change. The criteria led discharge lapse, `dischargeCriteriaValidity`, goes from 72 to 24 hours, because the WACHS Criteria Led Discharge Guideline (16 April 2026) needs a medical review within 24 hours before discharge. The unused role switch off, `accessUnused`, goes from 90 to 45 days, from Australian Government ISM-1404 and ISM-1648. The criteria led discharge list in [`ward-discharge-criteria.ts`](../../src/components/ward-management/ward-discharge-criteria.ts) gains "Safety plan reviewed with the patient" (MP 0181/24 Safety Planning for Mental Health Consumers Policy) and "Observations done and reviewed in the last 24 hours" (the WACHS guideline's observations on the day of discharge, worded to match the 24 hour validity), nine in all, and the list is signed for the prototype. Criteria led discharge stays behind its flag and off in production, because the WACHS guideline lists mental health patients as generally not recommended. A health service would first need to agree a mental health cohort.
- **Open before real use:** the absent without leave bed hold (MP 0012/16 leaves this to each health service's procedure), the downtime pack refresh (each health service's business continuity plan), patient specific criteria (the fixed list cannot hold typed text), and the ISM wording, which was checked on a third party copy.
- **Why:** Josh asked for a recommendation on each value rather than a blanket sign-off. The sheet gave a WA or Australian source where one exists and named local workflow choices as such. Signing is for the prototype. Real-patient or live use still needs formal clinical governance sign-off (D-54), and no value is a legal limit (D-22).
- **Subsequent note (17 October 2026):** D-65 closed or paused the items left open here, except clinical governance sign-off (D-54) and the downtime pack refresh, which need a health service.

## D-64. Criteria led discharge shows on the boards and warns at departure (16 October 2026)

- **Date:** 16 October 2026 (`2026-10-16`). **Decided by:** Josh (project thread for the criteria led discharge walk through, "Go ahead and review for any improvements ... then plan and build it" at 12:16 UTC, on the walk through's ranked findings).
- **Decision:** Building on D-60 and D-63, behind the same `top25-criteria-led-discharge` flag. The bed tiles show a short chip (CLD ready, CLD 2 of 5 as "CLD 2/5", CLD review, CLD paused), and the bed panel's Legal tile reads the same records as the criteria card so the two agree. Beside "Record that they have left" the panel says where the criteria stand and, when any is unmet or lapsed, asks for a medical review before the patient leaves. It warns and never blocks. Saving criteria now also needs the ward to confirm the patient was told they are on criteria led discharge. Nothing new is recorded by that confirmation. Each tick shows when it was made, ticks from before a lapse read "Met before it lapsed", and the bed timeline gains "Discharge criteria set or reviewed" and "All discharge criteria met". Two Dabakarn demo patients start with criteria, one part way and one with every criterion met.
- **Why:** The WACHS Criteria Led Discharge Guideline (16 April 2026) asks for a patient's criteria led discharge status on handover, journey boards and whiteboards (s 2.4, 2.5), for patients to be told (s 2.2), and for the clinician facilitating the discharge to instigate a medical review when any criterion is unmet (s 3). The walk through found the ready state visible only inside the bed panel and the Legal tile disagreeing with the card. The "patient told" confirmation is new wording for the prototype and needs the same clinical governance sign-off as the list (D-54).
- **Subsequent note (17 October 2026):** Josh signed off the "patient told" wording for the prototype (D-65). Real patient use still needs D-54.

## D-65. Criteria led discharge on in production, typed patient specific criteria, and the AWOL bed hold review paused (17 October 2026)

- **Date:** 17 October 2026 (`2026-10-17`). **Decided by:** Josh (project thread for the clinical sign-off sheet, "Please complete these issues and switch on criteria led discharge, also turn on typed text, also AWOL bed hold pause for now and review later" at 02:52 UTC, on the list of items still open after D-63).
- **Decision:** Four changes for the prototype.
  - The `top25-criteria-led-discharge` flag is on in production as well as development and demo. The flag stays, so the feature can still be switched off. It is the one flag on in production, a deliberate exception to D-62's rule that a signed-off flag is removed instead.
  - The treating psychiatrist can add up to three patient specific criteria as typed text, each up to 120 characters, after the fixed list ([`ward-discharge-criteria.ts`](../../src/components/ward-management/ward-discharge-criteria.ts)). They are ticked, counted and lapse like the fixed ones, and the card marks them "Patient specific". This matches Part B of the WACHS criteria led discharge form MR28. A save or tick that names a typed criterion is typed text, so it stops browser saving for the session like every other typed-text event (`eventCarriesTypedTextPayload`). A save of fixed criteria only stays safe.
  - The absent without leave bed hold review warning is paused behind a new flag, `awol-bed-hold-review`, off everywhere. The tracker still shows the time away and the steps. `awolBedHoldWarning` keeps its signed figure for when Josh reviews it.
  - The ISM wording behind `idleLock` and `accessUnused` was checked against the September 2026 ISM on cyber.gov.au. ISM-1404 (revision 5) and ISM-1648 (revision 2) both disable access after 45 days of inactivity. ISM-0428 (revision 11) locks a session after at most 15 minutes of inactivity. It also caps a session at 12 hours overall and needs every sign-in factor to unlock. Ward Flow does not do those two yet.
- **Still open:** clinical governance sign-off before real patient use (D-54) and the downtime pack refresh (each health service's business continuity plan). Both need a health service. The WACHS guideline still lists mental health patients as generally not recommended for criteria led discharge, so a health service would need to agree a mental health cohort before real use.
- **Why:** Josh is the product owner and wanted the remaining sign-off items finished for the prototype. Typed criteria were the only way to record patient specific criteria. Typed text already has one rule across the app, so the criteria follow it rather than a new one.
- **Subsequent note (17 October 2026):** Josh chose to keep the self-ticked "Set by the treating psychiatrist" box for typed criteria in the prototype. His answer, verbatim, on the decision card in the clinical sign-off sheet thread at 05:14 UTC: "Keep tick box", to the question "Keep the psychiatrist tick box for typed discharge criteria in the prototype?" The app cannot check who ticked it. The fixed D-60 criteria use the same tick box. Before any real use, setting, changing or reviewing any criteria, fixed or typed, needs a real psychiatrist sign in, not the tick box.
- **Subsequent note (17 October 2026):** Josh, verbatim, in the clinical sign-off sheet thread at 05:29 UTC: "Go ahead with all recommendations and I give full permission for sign off". For the prototype this signs off the D-64 "patient told" wording, the typed criteria rules above, and community teams seeing numbered placeholders instead of the typed wording (task ledger 7.82 item 1). It does not close D-54. Real patient use still needs clinical governance sign-off by a health service.
- **Subsequent note (17 October 2026):** Josh, verbatim, in the clinical sign-off sheet thread at 06:55 UTC: "Go ahead with your recommendations", to the recommendation to build the ISM-0428 12 hour session limit only. The signed-in shared site now refuses any request from a sign-in more than 12 hours old (`sessionLimit` in the clinical values module), reads included, and the app signs the person out with the reason. It counts from the first sign-in factor, which a token refresh or a later factor never moves, so only a fresh password sign-in resets it. A sign-in with no recorded time is refused. Asking for every sign-in factor to unlock the screen lock is not built. The screen lock stays a local privacy screen.
- **Subsequent note (21 October 2026):** Correction from a source check. The line above and the ISM item in the decision understate what is built. In the signed-in shared workspace the idle lock (`WardIdleLock` in [`shell/ward-access.tsx`](../../src/components/ward-management/shell/ward-access.tsx)) signs the person out, here and on the server, so carrying on needs a full fresh sign-in. The ISM-0428 unlock requirement is therefore met in signed-in mode. Only the local demo, which has no sign-in, keeps the lock as a privacy screen.
- **Subsequent note (20 October 2026):** Josh switched every finished feature on for the prototype on 20 October 2026 (overall review project thread; relayed to this change by the coordinating session, not quoted here). That includes `awol-bed-hold-review`, so the absent without leave bed hold review warning described above as paused and "off everywhere" is no longer paused; it uses the signed `awolBedHoldWarning` figure. The flag change itself is in PR #487. The same day Josh chose to keep demo reset off on the live site.

## D-66. Granted roles work without a second approval (17 October 2026)

- **Date:** 17 October 2026 (`2026-10-17`). **Decided by:** Josh in the shared backend setup thread: "Please remove the second approver requirement".
- **Decision:** Remove the second approval requirement for coordinator and access-admin role grants in the synthetic Ward Flow prototype. An authorised grant works immediately. Existing unexpired, unrevoked and recently used grants with null approval fields also work; their history is preserved rather than recording an approval that did not happen. The compatibility `/approve` endpoint refuses an unnecessary approval without changing the record.
- **Still required:** Sign-in, an authorised granter, no self grants, a valid place within the granter's scope, a future end date, automatic switch off when unused, revocation, recent sign-in for access changes, and the existing audit trail. This decision does not authorise real patient data.
- **Why:** The only bootstrap coordinator could grant the synthetic test admin a role but could not also provide its second approval. Josh chose to remove that prototype requirement. This replaces the second approval part of the role access plan; it is a policy change, not evidence of independent approval.
- **Before real data:** D-86 (27 October 2026) overrides D-80 item 17: there is no second approver, at pilot or otherwise. This decision stands.

## D-67. Recover synthetic form drafts within the browser session (17 October 2026)

- **Date:** 17 October 2026 (`2026-10-17`). **Decided by:** Josh in the five-task Ward Flow handover thread. The request specifies 500ms sessionStorage draft recovery for referral and legal forms, then authorises implementation: "Go ahead and update and perfect the plan and launch it now and work autonomously for me and fix all the issues you have confirmed".
- **Decision:** Permit typed drafts only for the explicitly opted-in synthetic referral drawer and legal form editor, scoped to the current account/session, scenario and form subject. Restore into the form for human review; never submit or change a clinical record automatically. Show a restored-draft notice with Clear. Successful submission, sign-out, session termination and reset clear the relevant drafts and invalidate pending writes. Rejected submissions retain the draft for correction.
- **Boundary:** This is a narrow exception to D-18 for the synthetic prototype. The general typed-event state saving lock remains in force. No real patient information is authorised. Do not put draft text in localStorage, URLs, logs, screenshots, commit messages or memory services. Browser session restoration may preserve sessionStorage across a restart, so browser-close deletion is not a guaranteed property.
- **Why:** The existing memory-only referral draft survives closing and reopening its drawer but is lost on refresh. The requested exception supports refresh recovery while preserving explicit session cleanup and human submission.

## D-68. Bed meeting TV content and access (19 October 2026)

- **Later status (9 November 2026):** partly replaced. Item 1 by D-83 (full names on every TV); item 3 by D-79 (name and UMRN before the ward answers).
- **Date:** 19 October 2026 (`2026-10-19`). **Decided by:** Josh in the project chat, answering the design audit questions: "yes to all recommendations".
- **Decision:** (1) For synthetic demonstrations the bed meeting TV may keep showing initials, sex and day of stay. (2) Ward desks may open the bed meeting TV view, because they attend the meeting; ED desks may not. (3) The audit also recommended showing the referral number on the ward's accept card. That is not built: it conflicts with D-39 (no record numbers printed on screens, Josh, 15 October 2026), which the recommendation missed. The card stays as it is, with no name, UMRN or record number until the ward accepts (D-14, FD-23), until Josh decides between the two. **Replaced by D-79** for the name and UMRN: the ward sees both before it answers. No record number shows, as before.
- **Boundary:** Before any real patient data, the TV content needs a privacy review: a wall screen in a shared room shows initials, sex and day of stay to anyone who walks past. This decision does not authorise real data.
- **Why:** The design audit found that ward staff at the bed meeting could not open its view (decision questions), and that the accept card gives the ward nothing to quote when phoning the coordinator (DA-34).

## D-69. A referral with no legal status: "Needs an involuntary-capable bed until status is set." (20 October 2026)

- **Date:** 20 October 2026 (`2026-10-20`). **Decided by:** Josh, in his own words, at 2:02 PM AWST: "Needs an involuntary-capable bed until status is set."
- **Decision:** A referral with no legal status recorded is allocated as needing a bed that can hold someone involuntarily until a status is set. It never defaults to Voluntary. Only a recorded Voluntary status clears the need; Involuntary, any form, a blank or "Not recorded" keeps it. The rule lives in `involuntaryBedNeededForLegalStatus` (`src/components/ward-management/referrals/ward-referral-drawer-model.ts`) and is tested in `tests/ward-referral-unknown-legal-status-bed.test.ts`.
- **Boundary:** This is a prototype allocation rule for synthetic data, not a legal determination about the person, and not clinical governance sign-off (D-54).
- **Why:** PR #465 made every legal status start blank. Unknown status is the safe direction: it widens nothing and routes to a bed that can hold the person whatever their status turns out to be.

## D-70. No computed Mental Health Act periods: show only the recorded due time (20 October 2026)

- **Date:** 20 October 2026 (`2026-10-20`). **Decided by:** Josh, on the overall review of 20 October 2026 (section 1, item 1): "Fix all of these issues ... Go ahead with all recommendations." The recommendation was "Remove the computed countdown. Show only the due time a person recorded."
- **Decision:** This replaces D-29. The Legal forms screen no longer works out when an Act period ends, never picks an under-18 period from age, and no longer counts down to a computed end or orders a list by one. It shows only the due time a person recorded from the form (`legalForm.dueAt`), and says no deadline is recorded when there is none. `legal-forms/act-periods-demo.ts` and its test are deleted, and the section-citation guard exempts no file. D5 applies everywhere again.
- **Why:** The standing rule rules out computed Act times and expiry, including the under-18 periods. The legal question pack is unanswered, and the screen itself said the periods were not legally checked.

## D-71. Audit 1 clinical safety fixes: no suggested wards, wait-order queues, recorded facts only (20 October 2026)

- **Date:** 20 October 2026 (`2026-10-20`). **Decided by:** Josh, on Audit 1 (clinical safety and the never-build rule, `main` `3ff8503`), at 10:03 PM AWST: "Please go ahead with all recommendations and fix all issues identified."
- **Decision:** All seven Audit 1 recommendations apply:
  1. The ward answer view shows no invented clinical summary and no "Admit to" line, only recorded facts or "Not recorded".
  2. No suggested, ranked, capped or pre-selected ward anywhere: "Suggested destination" goes, wards not yet asked are listed in full in a fixed order, the ED board gives a count only, and the phone accept starts with no ward chosen.
  3. Waiting lists default to wait order. Flags, act-now and form due times are highlights that do not move rows. This restores D-32 (first in, first out), which the Home queue, Waiting, Movements and step-down lists had drifted from.
  4. No points score: "Why this wait" gives plain reasons only.
  5. ~~"Time left" counted down to an expiry a person typed from the form stays: it computes nothing about the Act (D-70 is unchanged).~~ **Replaced by D-93** (31 October 2026): a legal form's time shows only as typed, never as a countdown.
  6. Road time "nearest ready beds" stays, captioned "Distance only, not suitability". Make-room chains stay switched off outside local builds. Candidate wards use a fixed order within each fit group, not catchment or free-bed tiers.
  7. Every copy to the clipboard starts with the synthetic line. Whether real names may appear in copied text is decided before any real data.
- **Why:** The standing never-build rule (19 October 2026) excludes best-match ward suggestions, automatic placement, re-sorting the ED queue and risk scores, and the audit found these built before the rule. Findings and evidence: `/mnt/project-files/audits/2026-10-20-clinical-safety-audit/`.

## D-72. Seven product decisions for the 21 October fix plan (21 October 2026)

- **Later status (9 November 2026):** partly replaced. Items 3 (live updates) and 4 (six core screens) by D-74.
- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the "App backlog and recommendations" project thread at 6:59 PM AWST: "Yes to all", to the session's seven recommendations on the fix plan for the 14 big product issues.
- **Decision:**
  1. **Work lost on refresh.** After a typed-text event the browser keeps saving every change that holds no typed text, and typed fields are saved as "Typed text not kept on this device". The live site moves to shared mode by default later, once shared boards are reliable. D-18's rule that typed text never reaches the device is unchanged.
  2. **Outage copy.** The downtime pack regenerates hourly and at each shift change as a print or a saved file only. No board data is kept in the browser cache.
  3. **Supabase Realtime and a history table.** Approved in principle for shared live updates and occupancy and wait history, expected to sit inside the plan's included allowances. Enabling either on the Ward Flow project is still a provider change that needs Josh's confirmation at the time, after the live plan and price are checked, and any charge needs his spending approval.
  4. **Six core coordinator screens.** Home ("Needs you now", with Alerts as its drawer), Referrals (Queue, Waiting and Delays merged), Beds (Board, Capacity, Wards and Network merged), Movements (Transport and Out of area merged), Discharges, and Handover (with the bed meeting and TV view). Statistics, the directories, Search, Legal forms and Settings stay as secondary screens. Command, Hub, Constellation, Exceptions and Escalation fold into the six. The layout is tried as a mockup first (`design/third-edition-mockups/coordinator-six-screens-mockup.html`) before any app change.
  5. **Observation levels.** General (hourly), Intermittent (interval typed, 15 or 30 minutes), Constant within sight (1:1), Constant within arm's length (1:1) and Two staff constant (2:1). Each 1:1 counts as one staff member against a ward's observation capacity and 2:1 as two; General and Intermittent count as none. The labels stay editable in the clinical values, because names vary by health service. Nothing is scored or suggested from a level (D-71).
  6. **Seclusion and restraint.** An operational view only: what is in use now and seclusion room availability, typed times, no computed limits (D-70). The legal register stays in the health service's own system.
  7. **Unfinished controls hidden by Audit 7.** Build the answer view's bed hold field (wired to the existing hold event) and its nurse unit manager field (wired to the existing high-acuity override tick). Delete the referral Call button and replace it with "Log a call" from the new call log. Delete the Add patient "After adding" card and go straight to the patient's page. Delete the cockpit's "Confirm a destination" section, which leans toward suggesting a ward (D-71). Build Assign referral with the call log.
- **Boundary:** Synthetic data only. This decides product direction, not clinical governance sign-off (D-54), and authorises no provider, deployment or spending step.
- **Why:** A source review of 21 October 2026 found 14 product issues; these were the decisions the fix plan needed from the owner before building. Plan: `/mnt/project-files/plan/ward-flow-fix-plan-2026-10-21.md` (project files, outside the repository).
- **Subsequent note (25 October 2026):** The fix plan named above is no longer kept in the project files, so that path no longer opens.

## D-73. Batch merge safeguards (21 October 2026)

- **Later status (9 November 2026):** item 5 is closed by D-107: no merge queue is in use.
- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the project's health check thread at 7:46 PM AWST: "yes to all", to that session's seven recommendations.
- **Decision:**
  1. The Work loss, Observation levels and Phase 0 threads may push their branches and open PRs.
  2. The Referral owner and Observation levels threads share engine files by section: each edits only its own lines, and the second PR to merge resolves any conflict.
  3. An old record with `specialling: true` is read as Within sight 1:1, and `false` as General.
  4. The Node 24 install lives in the cloud environment's setup script. The repository ships no `.claude` folder.
  5. The merge queue is used for this batch. Josh switches it on himself.
  6. A read-only check of the Supabase plan and Realtime quota is allowed before fix plan items 1 (shared boards) or 6 (history) start.
  7. Issues #430 (CAD number validation) and #431 (seeded surname check) join Phase 2 of the fix plan. Issues #314, #315 and #374 to #376 are closed once each is verified as fixed in the source.
- **Boundary:** Synthetic data only. A push or PR is not a merge, deployment or provider change; each still needs its own authority (AGENTS.md hard rule 10).
- **Why:** Several threads were building fix plan items in parallel, and the batch needed agreed rules for publishing, shared files and merge order.
- **Subsequent note (21 October 2026):** Item 5 cannot be applied as approved: GitHub's merge queue is unavailable for a personally owned repository. Josh accepted a lighter substitute in the health check thread at 7:51 PM AWST, in his words "yes but this slows things down", then "yes ok", to that session's proposal as relayed by the coordinating session: "Require branches to be up to date before merging" stays off; only the three riskier PRs (Work loss, Referral owner and Observation levels) merge `main` in and re-run CI just before they are marked ready; the smaller PRs merge as they are.

## D-74. Owner answers to the 21 October open questions (21 October 2026)

- **Later status (9 November 2026):** D-79 later let wards see the name and UMRN before they answer. D-79 keeps item 5: no referral number shows on the card. D-83 replaces item 6: copies keep full names.
- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the project chat at 8:02 PM AWST: "please go ahead with all recommendations... EXCEPT... ANYTHING YOU ARE BUILDING A MOCKUP FOR", to the coordinating session's 17 recommendations.
- **Decision:**
  1. **Shared boards Realtime** is closed. The 3-second refresh is accepted for the prototype. This supersedes D-72 item 3 for live updates; the history table stays as D-72 left it.
  2. **Community workflow gaps** join Phase 2 of the fix plan: an accepted community referral can be moved, transported and arrived; the coordinator can ask more wards; a community team sees the referrals it sent and whether a ward accepted.
  3. **Community referral purpose (Q9).** A new community team referral needs a purpose, "Community follow-up" or "Assess for admission". Older records read as "Community follow-up".
  4. **Six-screen mockup rejected and build cancelled.** Josh, in the project chat at 8:04 PM AWST: "CAN THAT 6 CORE SCREENS BUILD!!!! THE MOCKUP LOOKS TERRIBLE!!!". The mockup was removed before merge, and D-72 item 4 is withdrawn: the current coordinator screens stay as they are.
  5. **D-39** is kept: no referral number shows on the accept card until the ward accepts.
  6. **Copied text** carries no real names.
  7. **OA-58** (internal patient codes) stays parked until the privacy review.
  8. **Pilot** runs beside the ward whiteboard first.
  9. **D-57 wording** items left over are closed as covered by D-63 and D-65.
  10. **Assign referral** records the community desk only, with no clinician names.
  11. **R19** (costed ward questions) stays parked until a pilot ward is chosen.
  12. **Hosted checks.** The hosted save and conflict test and the hosted fresh browser check are approved, with synthetic data only.
- **Standing rule:** Josh, in the project chat at 8:02 PM AWST: "DO NOT EVER GO AHEAD UNTIL I APPROVE THE MOCKUP". Nothing is built from any mockup until Josh explicitly approves that mockup.
- **Boundary:** Synthetic data only. This authorises no deployment, provider configuration change or spending. The Supabase connector, open sign-up, restore drill, iPhone walkthrough and pilot roles are for Josh to do himself.
- **Why:** The parallel threads had raised open questions that needed owner answers before Phase 2 and the hosted checks could go ahead.

## D-75. UX audit follow-up, page caching, community gaps and the extra-travel bed hold (21 October 2026)

- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the project chat at 9:58 PM AWST, answering five recommendations: "yes to these."
- **Decision:**
  1. **UX simplification audit.** The small fixes the audit found go to the fix threads now: the top 10 to the audit thread and the rest to the area threads. The 10 bigger changes go to a mock-up first, under the D-74 standing rule.
  2. **PERF-03.** Pages keep the per-request security (CSP) nonce, and HTML is not cached at the edge. Every page stays dynamic: that is the accepted cost, because a cached page would replay one nonce to every visitor. The `src/proxy.ts` header comment (PR #541) carries the same ruling, and it closes TASK-L4-11.
  3. **Community workflow gaps** (fix plan items 15 to 17, D-74 item 2) start in their own thread after the current merges. The Q9 purpose is already in the trends work.
  4. **Seclusion view** may claim the two screen-map files their previous owner released.
  5. **Extra-travel bed hold.** A bed hold for a person with extra travel adds 60 minutes to the hold set in Settings.
- **Mock-up evidence rule:** Josh, in the project chat at 8:40 PM AWST: "Disregard any mockups that did not utilise up to date live or local site and visual assessment". A mock-up counts only when it was made from screenshots of the running app at current `main` or the hosted site, and it says which commit.
- **Boundary:** Synthetic data only. This authorises no deployment, provider configuration change or spending, and no build from a mock-up before Josh approves it.
- **Why:** The audit and the fix threads needed owner answers before the quick wins, caching work, community gaps and bed hold timing could go ahead.

## D-76. Community referral gaps: the full move journey and asking more wards (21 October 2026)

- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the Community referral gaps thread at 10:05 PM AWST: "Go ahead with all recommendations", on the scope in `community-gaps-scope-2026-10-21.md`.
- **Decision:**
  1. **Fix plan item 15.** An accepted community referral is built as the full journey: it can be moved, transported and arrived, and it shows on the Movements and Transport boards. The journey records a community origin by team name, with no address. This updates owner ruling 8 of 1 September 2026, which said a journey never starts at a community team, for an accepted community referral. The smaller option, where the ward records "arrived from community" against the held bed with no movement, is not taken.
  2. **Fix plan item 16.** The coordinator can ask more wards about an open community referral. Each ward added is recorded with who added it and when. No more than 3 wards may be waiting at once (`PARALLEL_REFERRAL_CAP`), and wards that declined do not count. Wards are listed alphabetically and are never ranked or suggested (D-71).
- **Boundary:** Synthetic data only. The engine work waits until the trends work has merged, because both touch the same event, model and drawer files. This authorises no deployment, provider configuration change or spending.
- **Why:** D-74 item 2 put the community gaps into Phase 2, and the scope showed that only the full journey puts community transport on the boards that coordinators and transport officers already use.

## D-77. The ten bigger UX changes approved for build (22 October 2026)

- **Date:** 22 October 2026 (`2026-10-22`), 12:52 AM AWST. **Decided by:** Josh, on the decision card in the Bigger UX changes mock-ups thread, choosing "Build all ten, as recommended", after "Ok go ahead and build this for me now". The mock-ups were made from the running app at `main` 1459fb5, as D-75 requires, and the D-74 approval rule is met.
- **Decision:** build these ten changes and the desktop top bar fix:
  1. **Short community referral form.** Purpose is asked only on referrals to a community team, and purpose and first contact are required. There is no Documents step. The form has team search and a Sent tab.
  2. **ED board** shows where its referral stands, using the words "Bed held". **Replaced by D-81** for the words: the ED board says "Bed pulled".
  3. **Desktop decision pane** uses the phone list, with Clinical override behind one button.
  4. **Ask wards** is a checkbox list of up to 3 wards (D-76 item 2).
  5. **Legal forms** loses the strip and side panels. Board now and Check a form time are dropped, and Form times stays in Tools.
  6. **Add a patient** asks for identity only. Aboriginal status stays an optional field.
  7. **Alerts drawer** gives one action per alert.
  8. **Demo menu** sits under the Synthetic pill, and all 7 scenarios are kept.
  9. **Statistics.** Summary and Overview become one Network page with no duplicate figures.
  10. **Phone Bed board** shows every bed, above the day figures, with no legend on the phone.
  11. **Top bar** at 1280 px is fixed.
- **Not decided:** the "Not legally checked" notice stays on the live Legal forms screen, and D-70 is unchanged, until Josh answers that question. The card's recommendation to remove it is not acted on.
- **Process:** one pull request per group, each from current `main`, with a visual check. Nothing merges without Josh.
- **Boundary:** Synthetic data only. This authorises no deployment, provider configuration change or spending.
- **Why:** Josh reviewed the ten mock-ups, made from the current app, and approved them with the recommended answers to their open questions.

## D-78. One decline list for wards and coordinators (22 October 2026)

- **Date:** 22 October 2026 (`2026-10-22`). **Decided by:** Josh, on two decision cards. At 12:04 AM AWST on 22 October (16:04 UTC on 21 October) he chose to merge the ward and coordinator decline lists. At 4:39 PM AWST on 22 October, in the Decline reasons merge thread, he chose "Keep it as a ward-only reason" for Capability mismatch.
- **Decision:**
  1. **One list.** A ward declining a movement and a coordinator declining a referral pick from one decline list, in the coordinator's wording.
  2. **Ward-only reasons stay.** Four clinically distinct reasons are kept for ward declines only: Specialling unavailable, Acuity mix, Bed pulled for earlier referral and Capability mismatch. Capability mismatch is kept because neither Age band not provided here nor Secure bed unavailable fully covers it, for example a ward with no ECT or eating disorder capability.
  3. **Retired ward values map across.** No bed becomes No suitable bed, Sex mix becomes Sex designation unavailable and Out of catchment becomes Belongs to another service. Old saves are converted when they load, so no recorded decline is lost.
  4. **Limits kept.** A ward refusing a movement is still not offered Sex designation unavailable (T10), and an ED decline gets none of the ward-only reasons.
- **Boundary:** Synthetic data only. Built in PR #579, which cites D-78 in its code comments. This authorises no deployment, provider configuration change or spending.
- **Why:** two lists with different words for the same reason made decline records hard to compare across the network. Keeping the ward-only reasons and converting old values keeps what earlier records meant.

## D-79. Wards see the full referral, with name and UMRN, before they answer (23 October 2026)

- **Date:** 23 October 2026 (`2026-10-23`), 1:52 AM AWST (17:52 UTC on 22 October). **Decided by:** Josh, on the decision card in the Ward referral detail view thread, choosing "Approve and build" over "Approve, but no identity yet". This followed his messages in that thread at 7:04 PM AWST on 22 October: "they need to see all the details and documents attached", "There should be a way to click on the patient and the full referral details are visible" and "the wards should not see where the patient is referred. But they need to see all the other information." The mock-up was made from the running app at `main` a9c7763, as D-75 requires, and the D-74 approval rule is met.
- **Decision:**
  1. **Full referral before answering.** A ward reviewing a referral sees the whole submitted referral, including the patient's name and UMRN, before it accepts or declines. Tapping the patient's name on the incoming card opens it, and attached documents open in an in-app viewer.
  2. **Never other destinations.** The ward never sees which other wards or teams the patient was referred to (FD-23, and D-17 in `archive/dated-notes/owner-decisions-2026-09-1x.md`, not the D-17 in this log).
  3. **Fit lines split.** The card shows the patient's checks on one line and the ward's own state, such as a stale bed count or no free bed, on another, so a ward problem no longer reads as the patient failing.
- **What it replaces:** Josh's 26 September 2026 rule that a ward sees no identity before it accepts, and the part of D-68 item 3 that kept the name and UMRN off the accept card until acceptance. D-39 and D-74 item 5 stand: no `WF-...` journey number or referral number shows on the card.
- **Boundary:** Synthetic data only, with synthetic referral forms and documents for the seeded journeys. Showing identity before acceptance needs the privacy review before any real patient data. Being built in PR #588, still a draft when this was recorded. This authorises no deployment, provider configuration change or spending.
- **Why:** A ward cannot make a safe decision on a referral it cannot read. The engine already held about half the fields, and community teams already saw them.

## D-80. Role access plan version 2: all 17 recommendations (23 October 2026)

- **Date:** 23 October 2026 (`2026-10-23`), 9:02 PM AWST (13:02 UTC). **Decided by:** Josh, on the decision card in the Role access plan thread, choosing "Approve all recommendations" over "Leak and bug fixes only" and "I'll answer item by item". The plan is the version 2 role access review, read from `main` a41ddee.
- **Decision:** build in this order.
  1. **PR 1, the FD-23 journey leak (#600).** A ward's and a bed manager's copy of a journey no longer carries other wards that declined, withdrawn or overridden requests, the number of wards tried or the accepting ward, in the browser or on the server. This enforces FD-23 and needs no new rule.
  2. **PR 2, bugs that change no rules.** Bed manager discharge records, the phone Add patient check, the access admin label, the executive taken out of broadcast entries, demo controls per desk, and the same break glass reply for any id.
  3. **PR 3, items 1 to 4 (bed manager).** Site bed-flow actions: confirm beds, bed releases, discharge blockers, close or reopen a ward, handover sign-off, bed meeting actions, replying to a bed call, marking notices read and its own tasks. A read-only Referrals list for its site. Seclusion and restraint view and room status only, with recording back to the ward. Capacity shows its own site in detail and other sites as counts. Acceptance, placement and discharge stay with the ward.
  4. **PR 4, items 5, 6, 8 and 16.** Ward and community referrers get the sender tools for their own referrals only: correct, mark information supplied, change urgency and legal status. The sending ward or team may mark a legal form received for its own journey. Cover goes only to accounts that already hold a ward or ED role. Role grants have a 12 month ceiling.
  5. **PR 5, items 7, 9 to 13 and 15.** Transport officers see their own service's jobs only, with the referral's risk categories as flags. Wards, EDs and community teams get own-place Statistics as counts. Community teams get a Movements screen for their own journeys. Phone alerts go to officers for new or changed jobs, and to community teams when a referral is answered or a catchment client is admitted or discharged. The ward sees the readmission flag once it has accepted, which changes Josh's 9 October 2026 ruling. The ED sees the wards asked, their state and the accepting ward, but not other wards' decline reasons. Opening the full referral detail is logged as a record view.
- **Mock-ups first (item 14):** a review screen for break glass openings and record views, read from the server, for statewide and service coordinators, and an Access log in Settings for the access admin. Both are made from the running app at current `main` and built only after Josh approves them (D-74).
- **Pre-pilot only (item 17):** before any real data, a second approver comes back for role grants, and a coordinator opening a clinical ward record gives an "on behalf of the ward" reason. This is recorded now and built at pilot. Until then D-66 stands. _Subsequent note (27 October 2026): D-86 drops the second approver part of this item; the "on behalf of the ward" reason is unchanged._
- **Boundary:** Synthetic data only. No Supabase change beyond reading tables that already exist. No new roles, and nothing a coordinator, ward or ED needs is taken away. This authorises no deployment, provider configuration change or spending.
- **Why:** the review found the FD-23 leak, a broken bed manager Discharges screen, cover that could go to any account, break glass review with no screen, and gaps in daily work for sending wards, community teams and transport officers.
- **Later change (2 November 2026):** the site bed manager no longer marks a bed meeting action done, which narrows item 3 above and the 31 October Q61 ruling. The bed meeting agenda is read only for that desk (Decision 46). Ward, ED and community desks still mark their own agreed actions done. Built in PR #1214 (Q97, 1 November 2026); Josh approved recording it here on 2 November 2026 ("Yes to all recommendations").

## D-81. Pulled, with a pull time limit, for a bed kept for an incoming patient (24 October 2026)

- **Date:** 24 October 2026 (`2026-10-24`), 10:42 PM AWST (14:42 UTC). **Decided by:** Josh, on the decision card in the usability review project thread.
- **Decision:** a bed kept for an incoming patient is called "Pulled", and how long it is kept is the "Pull time limit". "Held" and "hold" are used only for a bed kept for its own patient while they are on leave or away, as Josh ruled on 1 September 2026 ([pull and hold ruling](../history/archive/dated-notes/owner-rulings-2026-09-01-pull-and-hold.md)). This replaces the "Bed held" words in D-77 item 2 on the ED board, and the "bed hold" words in D-72 and D-75 where they mean a bed kept for an incoming patient. The rules in those entries are unchanged.
- **Boundary:** visible words only. Code names, event names, flags and stored values keep their names, and recorded notice and audit text is not rewritten. Nothing is re-sorted or ranked.
- **Why:** one screen said "Bed held" and another "Pulled" about the same incoming bed, and "held" already meant a bed kept for a patient on leave. One word for each meaning stops the two being confused.

## D-82. A PR may raise a phone size limit by up to 5 KB per screen without asking (26 October 2026)

- **Date:** 26 October 2026 (`2026-10-26`). **Decided by:** Josh, in the Ward Flow review thread. His words: "add a rule for automatic increase in size without asking"; he then approved the design with "Yes go ahead".
- **Decision:** a pull request may raise a phone size limit in `script-budget.json` by up to 5 KB per screen in total, added up across the PR, without asking Josh. Above 5 KB on any screen Josh's explicit yes is needed first, as before. There is no once-per-PR restriction. Before raising, the PR tries an easy safe trim, raises only by what it needs plus a small margin, and states each route's old limit, new limit, measured size and why it grew in the PR body. A limit is never raised to hide a jump that has not been diagnosed.
- **Replaces:** the working practice of asking Josh for each raise, and the 21 October 2026 "no raises" instruction, which asked for trims instead. Trimming first is still required.
- **Where it lives:** the rule text is in [HOW-WE-WORK section 6](HOW-WE-WORK.md#6-owner-rules-that-fail-builds-or-reviews); this entry is the record.
- **Why:** each owner approval for a 1 to 4 KB raise held up otherwise finished PRs, and the cap keeps the total growth small and visible.

## D-83. Patient names stay in full on every screen, copy and TV; privacy work must not make the app less useful (26 October 2026)

- **Later status (9 November 2026):** partly replaced by D-102 for downloads only. Patient-table exports carry no names. Names stay in full on screens, prints and TV views.
- **Date:** 26 October 2026 (`2026-10-26`), 4:03 PM AWST (08:03 UTC). **Decided by:** Josh, in the Ward Flow project chat, answering the 26 October list of open decisions. His words: "Go ahead with all your recommendations above please. However... hide names is not required. I prefer names to be shown as it is more useful and clear. Keep names on TV view also. For privacy... dont let it impact anything that makes the app less useful or intuitive."
- **Decision:** patient names are shown in full wherever the app shows them today, including copies, prints, downloads and every TV view. There is no "Hide names" default and no initials-only mode. Every TV view, and any alert banner shown over a TV view, shows full names; this goes further than D-68 point (1), which allowed initials on the bed meeting TV. Privacy and security work goes ahead only where it does not make the app less useful or less intuitive for the people using it.
- **Closed as won't fix by this decision:** initials plus UMRN by default and copies following "Hide names" (handover question A10; NB-26-14, GV-11, PR-17, CS-12, PS-11); alert type only on TV broadcast banners (A12, TV-02); no initials on the ED tea-room TV (A13, TV-D4); and counts only on the bed-meeting TV (A14).
- **Not closed: the read-only TV login that locks (A11, TV-01) goes ahead.** At 4:11 PM AWST (08:11 UTC) Josh answered the follow-up list with "go ahead with all recommendations here also", which confirmed A11. It is a read-only TV login that locks when someone leaves the TV view ("Lock as TV": the browser stays on TV views until someone unlocks it with the account's password; browser-only, with no server role change), and it still shows full names. That work belongs to the bed meeting and TV screens stream.
- **Still going ahead, because it does not reduce usefulness:** clearing half-typed text when the app signs someone out (A30, SM2-12, PS-10), deleting dead security-shaped code (A39, CQ-14, BCC-06), and groundwork for the health service's own sign-in with a second step (Part B item 49, GV-05, SRC-3). The other answers in the same message are recorded in the 26 October handover list and in each work thread.
- **Boundary:** synthetic data only. This is not approval to use real patient data. Whether full names may be shown with real data is still for the privacy officer and the privacy impact assessment before any real-data pilot (Part B), and D-68's Boundary (a privacy review of the TV content before any real data) still stands. This authorises no deployment, provider change or spending.
- **Why:** names make the boards clearer and faster to use, and masking them would make the app harder to use for no benefit while the data is synthetic.

## D-84. The live app stays on Railway Singapore for now, and there is no server-side TV account yet (26 October 2026)

- **Date:** 26 October 2026 (`2026-10-26`), 4:51 PM AWST (08:51 UTC). **Decided by:** Josh, in the Ward Flow project chat, answering the two hosting and TV questions. His words: "1 = stay 2 = your recommendations".
- **Decision:** (1) the live app's three services stay on Railway in Singapore. Nothing is moved now. Railway has no Australian region (its regions are California, Virginia, Amsterdam and Singapore, checked 26 October 2026), so Australian hosting would mean leaving Railway. The database is already in Sydney. (2) No server-side TV account or TV role is built yet. The locking read-only TV login in D-83 ("Lock as TV") stays browser-only.
- **Revisit:** both before any real patient data, together with the health service's IT (which Australian host they will approve, so the app moves once) and the privacy officer. Steps and options are in the B5 and B7 handover note for the sign-in and privacy stream.
- **Boundary:** synthetic data only. This authorises no deployment, provider change or spending. A later move needs Josh's yes at the time, with a spending approval and hard cap for any new host.
- **Why:** with synthetic data, moving hosts now is one to two days of work and a new monthly cost for no present benefit, and moving before IT names their host risks moving twice. A server-side TV account adds a role to the access model before anyone needs it.

## D-85. "Held" only for a bed kept for its own patient; "pulled" for an incoming bed; "held up" for a delay (26 October 2026)

- **Date:** 26 October 2026 (`2026-10-26`), 6:35 PM AWST (10:35 UTC). **Decided by:** Josh, in the Ward Flow project chat, answering the coordinator's blocker list. His words: "go ahead with al recommendations".
- **Decision:** confirms D-81 for the wording question WL-Q4. A bed kept for a patient who is not yet on the ward is "pulled", in notices as well as on screens: the revoked examination, diversion, cancelled transport and withdrawn acceptance notices now say the bed stays pulled, no bed is pulled, or the bed pulled for them. "Held" on its own is used only for a bed kept for its own patient while they are on leave or away (for example at an emergency department). A delayed discharge is "held up".
- **Boundary:** visible words only, as D-81. Code names, event names and stored values keep their names, and saved notice and audit text is not rewritten. Nothing is re-sorted or ranked.
- **Why:** the 26 October wording audit (WL-08) found notices still calling an incoming bed "held", the word kept for leave beds.

## D-86. No second approver for role grants, at pilot or otherwise (27 October 2026)

- **Date:** 27 October 2026 (`2026-10-27`), 1:21 AM AWST (17:21 UTC on 26 October). **Decided by:** Josh, in the Ward Flow project chat, answering the security stream's question about a deputy access admin. His words: "No I don't want two approver switch".
- **Decision:** overrides the second approver part of D-80 item 17. An authorised role grant works at once, as D-66 decided, and no second approver is built, including behind a switch. The security stream's branch removed its switched-off second approver build before any PR.
- **Unchanged:** every D-66 safeguard (sign-in, an authorised granter, no self grants, a place within the granter's scope, a future end date, automatic switch off when unused, revocation, recent sign-in for access changes and the audit trail), and the rest of D-80 item 17.
- **Why:** Josh does not want a two-person approval step for access grants.

## D-87. D-36 and D-37 are replaced by the real-data gate (27 October 2026)

- **Date:** 27 October 2026 (`2026-10-27`). **Decided by:** Josh, in the Ward Flow project chat, approving the governance recommendation (H-0736). His words: "Go ahead with all recommendations please".
- **Decision:** D-36 and D-37 are replaced. Their wording overstated governance readiness (for example "complete pre-pilot governance readiness", "approved for submission", "tamper-evident" and Azure Entra ID isolation). None of that has been approved by any institution. Azure is retired (D-55).
- **What applies instead:**
  - The intended purpose statement in `governance/02-intended-purpose-statement.md` (shared project folder), once signed.
  - The real-data gate: a sponsor, clinical safety owner and privacy officer named; the privacy impact assessment signed; a privacy review of names shown everywhere (D-83); HSP ICT approval; a hosting review (D-84 covers the prototype only); a private repository; and Supabase Pro with a proven restore. No real data until all are signed.
  - The Clinical Safety Case and Cultural Safety Charter remain reference material for the prototype, not gates (Prototype Operating Mode).
- **Also:** the PRODUCTION-READINESS GOV-001 wording on "timer functions" and "countdown alerts" is replaced by the intended purpose statement.
- **Boundary:** this records no institutional, legal or regulatory approval and authorises no real data, deployment, provider change or spending. D-36 and D-37 text is kept as history.
- **Why:** untrue readiness claims make reviewers distrust the honest drafts (governance audit 26 October 2026, GV-18).

## D-88. The public demo opens with a demo code once the front door is on (27 October 2026)

- **Date:** 27 October 2026 (`2026-10-27`), 6:37 PM AWST (10:37 UTC). **Decided by:** Josh, in the Ward Flow project, answering the outstanding desk decisions list, where item 4 was "Add a demo code to the public demo". His words: "yes to all."
- **Decision:** reverses the open public demo of 28 September 2026, when the developer key was removed. Once the front door is switched on for the public demo (`WARD_FRONT_DOOR=required`), `/sign-in` asks for the code in `WARD_DEMO_CODE` before any page opens. A code opens the demo in that browser for 8 hours. Ten wrong tries from one address pause it for 10 minutes. The signed-in site never opens with a code, only with an account.
- **Not yet decided:** switching the front door on, on either hosted site. The switch stays off until Josh has seen the built screens and says yes. Setting `WARD_PASS_SECRET` and `WARD_DEMO_CODE` in Railway also needs his yes (AGENTS.md rule 3).
- **Why:** the demo shows the whole synthetic network and should be shared on purpose, not found by chance.

## D-89. Redesign mock-up copies of large screens may pass the 1,500-line cap (30 October 2026)

- **Date:** 30 October 2026 (`2026-10-30`). **Decided by:** Josh, in the redesign mock-up work (draft PR #1118), when told some mock-up copies of today's screens would pass the cap: raising the limit is fine.
- **Decision:** a mock-up page under `src/components/ward-redesign/` that copies a real screen may pass the 1,500-line cap when splitting it would break the line-by-line match with the real file. It gets its own entry in `eslint-rules/max-lines-baseline.mjs`, with the reason in the change, as any other file over the cap. Never make room by changing on-screen words (Josh, 26 October 2026).
- **First use:** `src/components/ward-redesign/ward-answer/ward-answer-view.tsx` (1,717 lines), the copy of the Ward answer view, whose real file already has its own entry.
- **Boundary:** mock-up copies only. It does not raise the default cap, change any real screen (D-74) or approve any page for building.
- **Why:** each mock-up is a copy of today's screen, so the difference between the two files is exactly the design change to build. Splitting a large copy makes that difference much harder to read and apply.

## D-90. Help gets How do I…, Show me runs everywhere, and Help is built without a separate mock-up step (30 October 2026)

- **Date:** 30 October 2026 (`2026-10-30`). **Decided by:** Josh, in the Ward Flow project, asking for the Help menu to be reviewed against the PR #1118 mock-up and the Core Pages artifact, then perfected, with "common tasks or questions specifically for the app and when clicked on there is launched the interactive help part that highlights where it is with steps". He then answered three questions: build the real Help now; switch Show me on everywhere; and put the tasks in a new "How do I…" tab.
- **Decision:**
  1. Help is built in the real app straight from the PR #1118 Help, tour and shortcuts mock-ups and the artifact, as one draft pull request for Josh to review. This is an exception to the D-74 standing rule (mock-up first, then approval) for Help only. Merging still needs Josh.
  2. The `help-ask` switch (Ask a question and Show me) is on in development, demo and production.
  3. Help opens on a new first tab, **How do I…**, from the side menu and the phone Menu: the desk's own tasks, those on the current screen first, then in fixed groups, each with Show me. The header's ? still opens This screen (Josh, 24 October 2026).
- **Why:** staff should be able to browse the common jobs and be walked through each one on the real screen, not only find them by typing a question.
- **Safeguards kept:** Show me only lights controls; it never presses anything. Tasks are grouped, never ranked. Nothing typed in Help is stored or sent. Mental Health Act times stay as typed (D-70), so that how-to has no Show me.
- **Later change:** D-91 (31 October 2026, recorded with the redesign mock-ups) overrides item 2: Show me stays off on the demo and live sites until Josh has seen it in the mock-ups, so `help-ask` is on in development only. Items 1 and 3 stand. On 2 November 2026, after seeing the Help showcase, Josh switched Show me on for the demo site (which the live site also runs as); a production build keeps it off.

## D-91. One design home for the redesign, and Josh's answers on Help, Settings, search and notifications (31 October 2026)

- **Later status (9 November 2026):** partly replaced by D-107. Design work follows the design review prompt, not the single redesign mock-up viewer.
- **Date:** 31 October 2026 (`2026-10-31`). **Decided by:** Josh, in the redesign mock-up work (draft PR #1118), answering the 26 questions from the alignment review of #1119, #1122, #1123 and #1124. His words: "Yes to all your recommendations." (D-90 is reserved by draft PR #1119.)
- **Decision, how the work fits together:**
  - All visual design lives in the redesign mock-up viewer (`/mockups/ward-flow-redesign`, PR #1118). Until Josh approves a page, the real-app pull requests carry only behaviour and accessibility fixes.
  - Merge order into `main`, each fixed first and each with Josh's yes: #1120, #1119, the behaviour part of #1124, then #1123.
  - Clear-cut real-app bugs go in small separate pull requests: restore says nine rules where there are twelve; Settings Export and Import do not match; Community save failures vanish (CT-09).
  - #1118 stays a draft until Josh approves the design direction. It then merges with the mock-ups still blocked in production, and each page build deletes its own mock-up copy (`docs/history/mockup-retirement-policy.md`).
  - Build order after Josh's page-by-page review: the shared frame, control sizes and notice position first, then Home, then one page per pull request.
- **Help (#1119):** the live switch for Show me stays off until Josh has seen it in the mock-ups. The first tab is "How do I…", and the sidebar's Help opens on it with this screen's tasks first. Phone tabs sit on one sliding row at the kit size.
- **Settings (#1122):** round 3 merges into the mock-ups after its four conflicts and small fixes. In the new frame, Settings drops its own "Go to a desk", which the sidebar already offers.
- **Search and forms (#1123):**
  - Phone search opens full height, like Help. Computers keep today's popover, with matched words highlighted.
  - Every page search box has one look.
  - Forms get time buttons (Now, +15m, +30m, +1h) form by form, starting with ED expected arrival and the discharge care dates. Any legal-form time offers Now only (D5, D-70).
  - The duplicate finders become one each: the two Statistics "Open a unit", the two "Find a ward" lists and the three suburb lookups.
  - Help answers show in the header search for queries of three letters or more, after people unless the query is a question.
  - The search box reads "Search Ward Flow".
  - The search boxes #1123 removed are ratified here: the community team patient search, the record History and Documents filters, the executive phone "Filter pages", the Referrals "Filter queue", the All EDs keyword box, and the Statistics ward and ED table filters. Josh approved them on 30 October without a mock-up.
- **Notifications (#1124):**
  - Missed notices go into Activity's "Recent activity" tab, not a separate Recent chip, and clear on idle lock and desk switch.
  - Notices sit clear of the phone's bottom bar.
  - The folded stack and the corner-card moves are mocked up before they are built.
  - Confirmed: each notice is read aloud once; undo windows keep running in a hidden tab; On-call keeps its notice inside its sheet.
- **The mock-ups:**
  - The new sidebar and header (`shell-next`) is the default frame, with a switch back to today's.
  - On computers the bell shows its icon and count. The word "Alerts" is in the phone dock and the button's spoken label.
  - Waiting's and Patients' phone chips put the count first.
  - The TV view and printouts keep a small synthetic-data mark.
  - Pinned pages last for one browser tab; remembering them per person needs a privacy decision before the real build.
  - Handover stays off the phone dock for the nurse in charge and the bed manager.
- **Boundary:** this approves mock-up work and the order of work. It approves no page for building, no merge, release or deployment, and no real data.
- **Why:** four pull requests changed the same screens in different directions. One design home and one order stop them breaking each other and leaving the mock-ups out of date.

## D-92. Help goes live before its mock-up review, one search box on Capacity, and referral rows on Home open the panel (31 October 2026)

- **Date:** 31 October 2026 (`2026-10-31`). **Decided by:** Josh, in the Ward Flow project chat, answering three questions from the build with "Yes to all recommendations" (08:37 UTC).
- **Decision:**
  1. The Help redesign (PR #1119: the Help sheet, the tour and the shortcuts) goes live with the first daily release after it merges, before Josh has reviewed those screens in the mock-ups. Show me stays off on the demo and live sites (D-91).
  2. The search update (PR #1123) also removes the Capacity matrix's own filter box, alongside the Statistics table filters D-91 already approved, so each page keeps one search box.
  3. On Home, clicking a "Referrals to decide" row opens that referral in the right-hand panel, as the other rows do. Only its Decide button goes to the Referrals page. This goes into the Home mock-up and the Home build.
- **Why:** D-90 and D-91 already approved building Help directly; one search box per page; every Home row behaves the same way, with the decision still one tap away.
- **Safeguards kept:** merging each PR still needs Josh's yes. Show me only lights controls and stays off live. Legal-form times stay as typed (D-70).

## D-93. Legal form times show only as typed, never as a countdown (31 October 2026)

- **Date:** 31 October 2026 (`2026-10-31`), 4:05 PM AWST (08:05 UTC). **Decided by:** Josh, in the Ward Flow project, approving the parallel build plan, whose legal-fix lane set out this change. His words: "Yes to all except 3…" (question 3 was the live site, not this).
- **Decision:** replaces D-71 item 5 and extends D-70 to every page. A legal form's time is shown only as the clock time a person typed from the form: "Ends 15:42 as typed", or "Ended 15:42 as typed" once that time has gone by, or with the form's full name, "Form 4C (Transfer order) · ends 15:42 as typed". Nothing is worked out from it: no "3h 20m left", "due in 2h", "passed 1h 05m ago" or "1h 15m overdue", no age since the typed time on an alert, and no bar filling towards it.
- **Unchanged:** the warning colours from each user's own settings stay, always with their words ("within 1h", "within 3h", "passed"), and lists still order by the typed time without moving rows (D-71 item 3). D5 and D-70 hold: nothing computes a Mental Health Act period. Bed pull limits, transport waits and decision targets are not legal times and keep their own wording.
- **Where:** Legal forms, the Patient page, Home (queue and placement panel), Movements and the movement drawer, Waiting, the ED board, Patients search, My ward, Alerts (queue, detail and copied text), the Tasks drawer and Home's alert cards. The shared wording lives in `legal-forms/legal-time-as-typed.ts`, and `tests/ward-legal-as-typed-guard.test.ts` fails if a duration formatter is applied to a legal time again.
- **Why:** staff read the typed time against the paper form. A running figure beside it is a second, unchecked number that can disagree with the form, which the as-typed rule exists to prevent. The mock-ups already show legal times this way (D-91 design master).

## D-94. Design rulings of 31 October 2026

- **Date:** 31 October 2026 (`2026-10-31`). **Decided by:** Josh, in the redesign work (the 48px exception at 10:34 UTC).
- **Decision:**
  1. No 48px controls. On a phone a kit button is drawn at 40px (32px small) and keeps the 48px tap area with an invisible cover. Phone tabs are 32px in a 40px track. Desktop segmented and pill tabs are 30px at 13px. Placement decisions (Accept, Pull, Decline) stay a full 48px on phones, the one exception (Josh, 10:34). The 12px text floor stays.
  2. No coloured side edges, stripes or tone-coloured borders on rows, cards, tiles or stat boxes ("it feels tacky"). Tone goes in the StatusGlyph or a small tinted tag. This replaces the 9 October thin act-now edge.
  3. The kit's styled "Leave this page?" confirm replaces the browser's own box.
  4. Dates are typed in the kit's DD/MM/YYYY date box.
  5. Fewer warnings, kept only where a rule or real risk needs them. Safeguard wording stays word for word.
  6. The drawer is headed "Alerts". Sidebar pins last for the open tab only.
- **Boundary:** approves no page build, merge or release.
- **Written rules:** `design/v9/design-system-v9.md` section 14 and HOW-WE-WORK section 6.

## D-95. One page scroll, and a click outside closes a drawer (3 November 2026)

- **Date:** 3 November 2026 (`2026-11-03`), 10:09 AM AWST (02:09 UTC). **Decided by:** Josh, in the Ward Flow project, asking for the most intuitive scrolling and for a click outside a drawer to close it, then answering "Yes to both" to publishing and to dropping the set-height Handover table.
- **Decision:**
  1. A page has one scrollbar. Tables and lists grow with the page and only their head row pins, just under the top bar (design system v9 section 7). A shorter side column pins in view as the shared side rail does. A box that scrolls inside the page is kept only for a chart with its own axes, such as the Movements timeline, and for a view held to the window, such as Enlarge.
  2. This replaces the 9 October ruling that the Handover table "stops at a set height and scrolls inside its card". On-call, Referrals and Movements follow the same rule.
  3. A click or tap outside a drawer, sheet or pop-up closes it. Inline panels beside a list (Waiting, Delays, Referrals) stay open until closed or switched, and a confirmation that needs a choice ("Close without sending?") and the idle lock stay until answered.
- **How:** a hand-built drawer whose backdrop sits beside its panel marks it `data-sheet-scrim` (`src/components/wf/sheet-focus.ts`), so the shared focus trap leaves that backdrop live.
- **Boundary:** approves no merge or release.

## D-96. A named bed is pulled, and its patient is not also waiting (8 November 2026)

- **Date:** 8 November 2026 (`2026-11-08`), 10:53 AM AWST (02:53 UTC). **Decided by:** Josh, in the Ward Flow project, answering "Go ahead with all recommendations" after being asked to confirm this rule.
- **Decision:**
  1. A bed named for a referral or journey (WF-FIG-017, 7 November 2026) counts as pulled, not free, on every screen that counts beds: Find a bed, the forecast, Mismatch cards, the bed map, the network table, the ward drawer, the TVs, the bed meeting sheet and the shortlist.
  2. A journey that has pulled a named bed is not also counted as waiting for a bed, so one patient is never counted twice.
- **How:** `numberedReservationBeds` (`src/components/ward-management/ward-movement-bed-hold.ts`), built in PR #1506.
- **Boundary:** a prototype rule on synthetic data; approves no merge or release.
- **Wording:** reworded 9 November 2026 (D-107 audit), meaning unchanged. It said "held"; a bed kept for an incoming patient is "pulled" (D-81, D-85).

## D-97. Owner answers on seven open items: N21, N25, N26, N29, N40, N41 and WF-B008 (8 November 2026)

- **Date:** 8 November 2026 (`2026-11-08`), 10:56 AM AWST (02:56 UTC). **Decided by:** Josh, in the Ward Flow project, answering "Go ahead with all recommendations" to one recommendation per item.
- **Decision:**
  1. **N21, eight account password resets:** Josh does these himself on his own accounts. No agent touches them.
  2. **N25, heavy-test lock:** a lock whose owner process has stopped may be reclaimed, and only then. This is what `scripts/test-run-lock.mjs` already does (`ownerDirectoryIsStale` reclaims only when the owner PID is gone; an old heartbeat alone never frees a live owner). Never delete coordinator state by hand (development-speed-playbook section 8).
  3. **N26, cloud environment settings (read only, 8 November 2026):** two Claude cloud environments, "Default" and "Cloud". Both are personal, have unrestricted network access, no setup script, no network secrets and no listed environment variables. Josh's PC bridge environments for Ward-Flow, Database and ai-rules are separate. Cloud sessions start shallow with Node 22, so Ward Flow work there needs Node 24 from `/opt/node24/bin`. Nothing was changed.
  4. **N29, external domain review:** deferred until a real need. It needs spending authority and nothing depends on it.
  5. **N41, monitoring, licence and downtime owners:** Josh owns all three while Ward Flow is a prototype.
  6. **WF-B008 / October WF-021, sign-in limits:** keep the per-client limits already in `src/lib/front-door-admission.ts`. Review them before any real users sign in. No denial-of-service failure has been shown on the deployed site.
  7. **N40, Tier 4 items 19–23 and 25:** on hold until Josh names them for building.
- **Boundary:** approves no spending, provider change, merge or release.

## D-98. Friction pass: Quick bar, Patient peek and Ward peek (8 November 2026)

- **Date:** 9 November 2026 (`2026-11-09`), 4:21 AM AWST (20:21 UTC on 8 November). **Decided by:** Josh, in the Ward Flow project, answering "Go ahead with all recommendations" on the friction-pass mock-ups (Notes 7 and 8). Placement refined by Josh on 9 November 2026: under the hero's act now row, and on a phone one Quick actions button.
- **Decision:**
  1. **Quick bar:** each desk's home shows its most used controls under the hero's act now row: a chip row on desktop and tablet, and one Quick actions button that opens a bottom sheet on a phone. Tool controls open Tools at that tool; New referral opens the referral drawer on the same page. None opens a new page. A desk only gets controls its role can open.
  2. **Patient peek:** panel buttons that went to the Patient page (Waiting's Movement, Home's Patient record, Referrals' Patient, Handover's Open patient) open the person's placement deck in a side panel (a bottom sheet on a phone), with "Open full Patient page" one link away. **This changes where Ask wards (D-77 item 4) opens from Movements:** it used to go to the Patient page and now opens in the Patient peek. The 3-ward limit (D-76) is unchanged. A new-tab click still opens the full page.
  3. **Ward peek and pop-ups:** ward buttons in Capacity and Discharges panels show the ward's ready and in-use beds with a link to the ward's board or ward page. Waiting's Coordinator and ED board buttons open pop-ups that do the common job (Wards tab, Find a bed, the ED's waiting and longest wait).
- **Boundary:** no change to who may see what; each peek is offered only where the desk could open the page it replaces. Synthetic data only.

## D-99. "Real details" in the referral drawer's sample patients (25 September 2026)

- **Date:** 25 September 2026, recorded here on 9 November 2026. **Decided by:** Josh, who chose "Real details" after the 25 September 2026 audit (A6). His own words were not found. This entry is recorded from the code comment on `SAMPLE_PATIENTS` in `src/components/ward-management/referrals/ward-referral-drawer-model.ts` and confirmed by Josh on 9 November 2026 ("Yes to all recommendations", project thread).
- **Decision:** the referral drawer's sample patients show the record's own name, record number, origin, legal status and urgency. Where the record holds none, they show "Not recorded". The free-text fields start empty. No made-up profile is laid over a real record.
- **Why:** the old typed-in profiles named a different person from the record (WF-009 read "Tobias Wren" where the record says Bao Davenport), and the medical clearance switch wrote to that real movement.

## D-100. "Under a form" means one rule everywhere (9 November 2026)

- **Date:** 9 November 2026. **Decided by:** Josh, choosing option A in the "Fix ED forms count mismatch" thread.
- **Decision:** a person counts as under a form when a legal form is recorded, or when their legal status is "Detained awaiting examination" or "Involuntary inpatient". "Voluntary" and "Referred for psychiatric examination" count only with a recorded form. A held person with no form shows "Form not recorded". One helper, `isUnderAForm` in `src/components/ward-management/ed/ed-home-derivations.ts`, answers this for every screen.
- **Status:** being built in PR #1553, open when this was recorded.
- **Why:** Home said Armadale had 15 people on forms while the ED desk said 13. Two rules gave two counts.

## D-101. Clinically ready for discharge, with one delay reason (9 November 2026)

- **Date:** 9 November 2026. **Decided by:** Josh, on the decision card in the "Build discharge and capacity features" thread.
- **Decision:**
  1. A ward records "Clinically ready for discharge since [date]" and one delay reason. The reasons come from `DISCHARGE_BARRIERS` (`src/components/ward-management/ward-admissions.ts`) without "Clinical / Treatment": Accommodation / Housing, NDIS, SAT / Public Guardian, RACF / Aged Care, Social / Family and Several.
  2. Delayed bed-days count from that date, by reason, in Statistics > Weekly, with a heatmap.
  3. `BED_RELEASE_BLOCKERS` (`ward-change-reasons.ts`) is a separate list and does not change.
- **Why:** once a person is clinically ready, the delay is not clinical. Counting bed-days by reason shows where the beds are lost.

## D-102. Report-a-problem screenshots are blurred, and patient-table exports carry no names (9 November 2026)

- **Date:** 9 November 2026. **Decided by:** Josh, on the decision card in the "Build search, export and training tools" thread.
- **Decision:**
  1. A Report-a-problem screenshot blurs all page content. Navigation stays readable. It is off by default, shown as a preview before it is copied or saved, and nothing is sent anywhere.
  2. A patient-table CSV export carries the record id or UMRN, ward, bed, times and status labels. It never carries names, initials or typed notes. This matches the Out of area export.
- **What it replaces:** the "downloads" part of D-83 only. Names stay in full on screens, prints and TV views. The rest of D-83 stands.
- **Why:** a file or screenshot leaves the app and can travel anywhere. A screen does not.

## D-103. Any coordinator on shift may mark a bed override reviewed (9 November 2026)

- **Date:** 9 November 2026. **Decided by:** Josh, on the decision card in the Home notes 4 thread.
- **Decision:** in Home's Today's review, any coordinator on shift may mark a bed override reviewed. The reviewer's name and the time are recorded. The person who made the override is not excluded.
- **Boundary:** saving the review to the shared database still needs a separate Supabase yes (AGENTS.md rule 3).
- **Why:** a review that waits for a second coordinator often never happens on a busy shift. The name and time keep it accountable.

## D-104. Care plans and safety flags: five defaults (9 November 2026)

- **Date:** 9 November 2026. **Decided by:** Josh, approving "all five" in the "Build care plans and patient safety flags" thread.
- **Decision:**
  1. **Referral risk flags** show as worded tags on ED and bed request cards, with the referral date. Nothing is stored on the patient record, so R-2026-09-04-A still holds for flags. A new flag, "Needs security escort", is added.
  2. **Care plans** use structured fields. Attachments keep metadata only (name, type and size). No file is stored until hosting and a privacy assessment allow it. A replaced plan is marked Superseded and never deleted. Anyone who can see the patient can see the plan.
  3. **Frequent presenter** means 4 or more ED presentations in 12 months, tagged "Care plan on file" or "No care plan". The threshold is synthetic and must be checked before any clinical use.
  4. **Tribunal hearing date** shows as typed. Once it passes with no outcome recorded, it shows "Hearing date passed, outcome not recorded". There is no countdown (D-93). **Carer told** is recorded as Told or Not yet for each admission, transfer and discharge, with who was told and when.
  5. **Cultural support requested** is recorded only when the person or their family asks. It is never worked out from Aboriginal status.
- **Boundary:** synthetic data only. No clinical value here is signed.
- **Why:** the safety information people need already exists in referrals and ward practice. These defaults show it without inventing a risk score or storing more than needed.

## D-105. Optional clerk details on the patient record (8 November 2026)

- **Date:** 8 November 2026. **Decided by:** Josh, on the decision card in the Note 3 thread. Its id in the tests is `NOTE3-2026-11-08` (`tests/ward-patient-model.test.ts`).
- **Decision:** next of kin and a nominated person or carer may be recorded as optional, record-only fields. So may the other optional administrative details a clerk records. There are 22 in all, listed in `ADMIN_DETAIL_FIELDS` (`src/components/ward-management/ward-patients.ts`). None is required. All are withheld from boards, lists and transport views through `RECORD_DETAIL_FIELDS` (`src/components/ward-management/ward-shared-record-detail.ts`).
- **What it replaces:** part of R-2026-09-04-A. That ruling added only two fields beyond its approved seven and left next of kin and carer contact out. D-105 replaces that limit for these 22 optional, record-only administrative fields. The rest of Ruling A stands: risk flags or alerts, diagnosis and medication are still not on the patient record, and each new field still needs its own entry in the field guard.
- **Why:** clerks record these details for every admission. Keeping them on the record, and off the boards, makes the record useful without showing more on shared screens.

## D-106. Clinical values from the 9 November 2026 documentation audit (9 November 2026)

- **Date:** 9 November 2026. **Decided by:** Josh, in the project thread at 11:07 UTC: "Yes to all recommendations".
- **Decision:**
  1. **Medical trip bed rule.** `edMedicalBedRelease` stays at 24 hours, and this entry records it as a decision. The register changes in items 1 to 3 and 5 are built in the separate held clinical PR (#1556) and apply once it merges; until then the register shows the earlier labels and status. The 14 October "clinical owner ruling" had no D entry, and FD-19 said 48 hours. The value is renamed "Review the held bed after 24 hours", because the app flags the bed for review and never frees it.
  2. **General observations (hourly)** are signed, as D-72 item 5 already approved.
  3. **Four timings** join the clinical values register as synthetic and unsigned: an old Form 5A or 5B leave paper warns after 3 days; an act-now alert can be hidden for at most 60 minutes; the carer, PSP and MHAS notification list looks back 72 hours; and a staff access grant defaults to 90 days.
  4. **R-2026-09-04-G** ("It suggests nothing" withdrawn) is replaced by D-71: no suggested or ranked wards.
  5. **Patient history labels** read the readmission window from the register (`readmissionWindow`) instead of typing "28 days".
- **Boundary:** synthetic data only. Signing a value here is for the prototype, as D-56 and D-63, not clinical governance sign-off (D-54).
- **Why:** the audit found clinical values quoted in code and documents with no decision behind them, and one value recorded two ways.

## D-107. Working rules and documentation from the 9 November 2026 audit (9 November 2026)

- **Date:** 9 November 2026. **Decided by:** Josh, in the project thread at 11:07 UTC: "Yes to all recommendations".
- **Decision:**
  1. **History download before a push** (`git fetch --unshallow` or `--deepen`) is pre-approved. It is read-only; any other network Git still needs a yes.
  2. **Fewest PRs.** One PR per thread. A held clinical change is the only reason to split one off.
  3. **Design work** follows [`docs/design/design-review-artifact-prompt.md`](../design/design-review-artifact-prompt.md), a copy of the standing project prompt. This replaces D-91's rule that all visual design lives in the redesign mock-up viewer.
  4. **No merge queue is in use.** PRs merge directly once required checks pass. This changes only the merge mechanism: who may merge, and when Josh's yes is needed, stays as AGENTS.md hard rule 6, D-91 and D-92 set it. Workflows keep their dormant `merge_group` triggers. This closes D-73 item 5.
  5. **Documents are reorganised:** older material moves to history, and the backlog lives on one page, `docs/ward-flow/backlog.md`.
  6. **Every new ruling gets a D-number** in this log, in the same PR that builds it. D-8's "R17 onward" numbering is no longer used.
  7. **A bare D-number in `src/` or `tests/` means this log.** A comment that cites the delegated rulings in [`owner-decisions-2026-09-1x.md`](../history/archive/dated-notes/owner-decisions-2026-09-1x.md) writes "archived D-n".
- **Also from the audit:** D-96 was reworded so a bed named for a referral is "pulled", matching D-81 and D-85. D-28 and D-30 to D-35 are marked "Source unverified", awaiting Josh's keep or strike pass. Old entries that later ones replace now say so in place.
- **Why:** fewer PRs and one decision home mean fewer conflicts and fewer rulings lost between threads.

## D-108. Six bed-flow features: keep D-93 and D-72, ED long-wait next steps (9 November 2026)

- **Date:** 9 November 2026, 8:00 PM AWST (12:00 UTC). **Decided by:** Josh, in the Ward Flow project, answering "Go ahead with all your recommendations" on the six features review.
- **Decision:**
  1. **Keep D-93 and D-72.** No countdown to legal deadlines (legal times stay as typed), and no offline copy of the board on the device (downtime stays print or PDF only).
  2. **ED long-wait next steps.** Each ED wait step shows a suggested next step for a person to take: Step 1, ask wards with a free bed; Step 2, call the site bed manager; Step 3, consider an out-of-area bed and add to the bed meeting; Step 4, tell the executive on call. This is prototype wording, not WA Health escalation policy. It suggests no ward and does not change the queue order (D-71).
  3. **Build only the gaps.** Home shows tomorrow's expected discharges and planned admissions from recorded dates, labelled "Not a prediction". The bed meeting agenda gains a Run meeting mode that steps through each health service and ends on a printable summary. The weekly report, bed meeting print and TV views, ED step badges, expected discharge dates and downtime pack already existed and are not rebuilt.
- **Boundary:** synthetic data only; approves no merge, release or provider change.

## D-109. Home's bed alert line tests the whole number shown (9 November 2026)

- **Date:** 9 November 2026 (`2026-11-09`). **Decided by:** Josh, in the Ward Flow project, choosing "Test the shown whole number" on a decision card.
- **Decision:** the statewide figure at the top of Home, and every bed alert dot and count, reads "at risk" when the whole percentage it shows is at or above the bed alert line, and "beds in use" below it. So 84.5% to 84.9% shows "85% at risk", never "85% beds in use".
- **How:** `coordinator-screen.tsx` compares `Math.round(statewideOccupancy)` with the bed alert line, and `isBedAlert` (`ward-service-bed-alerts.ts`) rounds the same way, so the rail, phone menu and executive bed alert dots and counts match. Built in PR #1561.
- **Boundary:** a prototype display rule on synthetic data; approves no merge or release.

## D-110. ED and referral flow: neutral fit line, clearance timing and alternatives to admission (9 November 2026)

- **Date:** 9 November 2026 (`2026-11-09`). **Decided by:** Josh, in the Ward Flow project: "Show fit, keep neutral order" on a decision card, then "Yes to all recommendations" for medical clearance and alternatives to admission, then "Yes, one PR".
- **Decision:**
  - Smart bed match is a plain fit line on every shortlist ward card (sex, security, age, special care: met, not met, to check). The order stays neutral; there is no ranking or best match, so the never-build rule against best-match suggestions stands.
  - Medical clearance is still recorded yes or no by a clinician. Ward Flow shows time since arrival or time to clearance, marks it amber after 6 hours with nothing recorded (`edClearanceNotRecorded` in `docs/ward-flow/clinical-values.md`), and adds a median time to clearance in ED Statistics.
  - Alternatives to admission are an unranked, optional list on ward-bed referrals from ED or community: crisis team home visit, MH Hospital in the Home, step-up/step-down unit, short-stay unit and next-day community follow-up. Each can be marked not suitable, tried or declined by patient. It never blocks Send. Service names are placeholders until checked against local services.
- **Why:** these cut the work of placing a patient without letting the app rank patients or wards, or make a clinical call.
- **Boundary:** prototype rules on synthetic data; approves no merge or release.

## D-111. Review and audit plan: first guards and four open answers (9 November 2026)

- **Date:** 9 November 2026 (`2026-11-09`), 11:37 PM AWST (15:37 UTC). **Decided by:** Josh, in the Ward Flow project thread "Plan reviews and audits for Ward Flow", answering "go ahead with all recommendations" and "go ahead with the response you recommend for all the questions".
- **Decision:**
  1. **Audit plan:** the 84-item ranked review and audit plan (Claude Doc, 9 Nov 2026) is the working plan. Issues #1564 to #1577 cover its top five and the two items next in line. The other items get issues when Josh names them.
  2. **First build, ruling guards (#1572):** each of D-93, D-71, D-72 item 2 and R-2026-09-04-A keeps a named guard test, listed in `tests/ward-ruling-guardrails.test.ts`. D-72 item 2 gains its own guard, `tests/ward-downtime-pack-device-storage.dom.test.tsx`. The guards protect the rulings and change none of them.
  3. **Signed values drift (#1573):** covered for its stated scope by `tests/ward-clinical-values.test.ts`. It checks the named constants and selected inline patterns against the table in `ward-clinical-values.ts`; it does not catch every threshold typed elsewhere, and it allows the separately typed `ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS`. The 24 h versus FD-19 48 h question for `edMedicalBedRelease` is a clinical question and stays with the held clinical PR.
  4. **Phone size limits:** D-82 stands (up to 5 KB per screen per PR without asking). The trend is tracked as audit item 80.
  5. **"rph-adult-secure":** this is the secure adult ward's board, not a separate page. No separate secure page is planned.
  6. **Shift-change load test (audit item 52):** run at the 7:00 am, 3:00 pm and 9:30 pm Perth handovers with 100 concurrent synthetic users. These are defaults, to be confirmed with the pilot site before the test.
  7. **Overnight alerts (audit item 55):** while Ward Flow holds synthetic data only, the uptime job's backend-down GitHub issue to Josh is enough and nobody is paged at night (Josh owns monitoring, D-97 item 5). Before real data, a named person gets phone alerts.
  8. **Real patient data:** no date is set. Real data waits until audit items 16 (hazard log), 33 (database rules), 34 (privacy impact assessment), 35 (residency map), 42 (TGA classification), 43 (breach plan) and 44 (penetration test) are done, in addition to the real-data gate (D-87).
- **Boundary:** synthetic data only. Approves no provider change, spending, merge or release, and changes no signed clinical value or clinical rule.

## D-112. Phone bottom bar: the floating bar (9 November 2026)

- **Date:** 9 November 2026 (`2026-11-09`). **Decided by:** Josh, in the Ward Flow project. He rejected a light polish of the flat bar ("You are not polishing it at all"), chose option A, "Floating bar", of three built options on a decision card, and asked for it "compact ... and beautifully sized", following what large companies do for floating bars.
- **Decision:** the phone bottom bar (dock) is a compact frosted capsule floating above the foot: 59 px tall, 14 px from each side and 10 px (or the home indicator) above the foot, with a hairline edge, a faint top highlight and a tight plus a wide low-opacity shadow (iOS and Material 3 style); the page fades into the canvas behind it. The page you are on is a soft accent pill holding its icon and label; the + is a 44 px round navy button in the middle. Badges sit on the icon corner and mean work waiting only, so Capacity's free-bed figure is not a badge (screen readers still hear it). A tab answers a press at once, and tapping the tab for the page you are on scrolls back to the top. A desk with a two-line label ("Coming and going", 31 October ruling) gets a 67 px capsule.
- **Why:** the flat bar's + was heavy and pressed against its edge, badges hid their icons and mixed good news with work waiting, taps gave no feedback, and a second tap on the current tab did nothing. Josh wanted a significant, premium redesign.
- **How:** `shell/ward-phone-menu.module.css` (floating bar block), `shell/ward-phone-page-dock.module.css` and `shell-next/next-phone-dock.module.css` (insets and the `--wf-dock-clear` / `--wf-dock-top` values that pinned bars and notices follow), `shell-next/next-phone-menu.tsx` (badge rule, tap again for top). Which tabs each desk has is unchanged. Replaces the 9 November flat-bar dock styling from the sticky header redesign.
- **Numbering:** recorded as D-112 because D-111 is claimed by the audit-answers entry in PR #1579.
- **Boundary:** a prototype display change on synthetic data; no clinical logic changes; approves no merge or release.

## D-113. Second patient identifier on accept and Mark done; no initials search (9 November 2026)

- **Date:** 9 November 2026 (`2026-11-09`), 12:20 AM AWST on 10 November (16:20 UTC). **Decided by:** Josh, answering "Go ahead with all recommendations I approve" to the three choices raised by audits 1 and 3 (#1564, #1566). D-112 is claimed by PR #1580.
- **Decision:**
  1. **Accept in principle:** the Ward home "accept in principle" dialog shows the patient's UMRN beside the name, so a second identifier is visible at the moment of accepting.
  2. **Bed meeting "Mark done":** the action names the patient it belongs to. No extra confirm step is added, so the action stays one tap.
  3. **Initials search:** typed initials without full stops (such as "AM") do not match a patient by initials. Loose initials matches would raise the chance of picking the wrong person.
- **Also in the same PR:** an exact typed name or UMRN now ranks first in the global search People group, so longer look-alike names can no longer push the exact match out of the six shown (audit 3 bug fix; search relevance, not a suggestion, so D-71 holds).
- **Boundary:** synthetic data only. Display and search wording only; changes no signed clinical value or clinical rule, and approves no merge or release.

## D-114. Allow pull_request_target for three workflows only (9 November 2026)

- **Date:** 9 November 2026 (`2026-11-09`). **Decided by:** Josh, in the Ward Flow project, choosing "Allow just these 3 workflows" on a decision card.
- **Decision:** from 2 December 2026 GitHub blocks `pull_request_target` in public repositories unless an Actions event policy allows it ([GitHub changelog, 2 Nov 2026](https://github.blog/changelog/2026-11-02-pull_request_target-blocked-by-default-december-2)). Ward Flow keeps the trigger and adds a repository Actions event policy that allows it only for `pr-hold.yml`, `bot-author-policy.yml` and `ward-flow-ci-tidy.yml`. Everything else keeps GitHub's default block.
- **How:** Josh adds the policy in the repository's Actions settings before the second brownout (16 November 2026, 16:00 to 18:00 UTC). The policy must also allow the other events those three files use (`merge_group`, `schedule`, `workflow_dispatch`). `ward-flow-budget-recheck.yml` is left out while its job stays switched off (`if: false`); turning it back on needs it added. No workflow file changes.
- **Why:** the hold and bot-author checks must read their rules from `main`, so a pull request cannot edit its own check to pass. All three never check out or run pull-request code, which is the safe use GitHub describes. Switching them to `pull_request` would lose that protection.
- **Boundary:** a repository setting Josh makes himself; agents do not change it.

## D-115. One count on every screen, and a missing patient shown everywhere (9 November 2026)

- **Date:** 9 November 2026 (`2026-11-09`), 1:20 AM AWST on 10 November (17:20 UTC). **Decided by:** Josh, answering "All of your recommendations" to six choices raised by audits 4 and 6 (#1567, #1569). D-114 is claimed by PR #1582.
- **Decision:**
  1. **"Coming in":** the ward board and the ward TV count the same thing: beds pulled or waitlisted for an admission.
  2. **"Going out today and tomorrow":** every screen counts confirmed discharges only. An unconfirmed discharge is not counted.
  3. **Beds ready after a referral is accepted into a named bed:** that bed is no longer ready on any screen (Home, ward board, Statistics, TV and print), because it is spoken for.
  4. **Ward board tiles:** a patient absent without leave shows "Absent without leave" in red on their bed tile, as the ward screen already does.
  5. **Downtime pack:** adds a line naming anyone absent without leave on each ward. The pack stays print or saved file only (D-72).
  6. **Executive statistics:** counts an absence without leave separately from approved leave (D-38).
- **Also in the same PR:** the Statistics ward rosters show "Absent without leave", not "On leave" (D-38, no new ruling needed).
- **Built:** items 1, 2 and 5 in PR #1579; items 3, 4 and 6 in the follow-up PR from the same thread (Josh, 10 November 2026: "Complete this"). Item 3 passes the named holds (open journeys and accepted referrals; the ward board uses its ward-scoped referral inbox) to the "beds ready now" figures on Home, the rail, the ward board, Statistics (hero, Overview cards, map, compare, journey), Handover, Referrals and the executive figures. A named bed moves from Ready to Pulled in the four bed boxes; occupancy and the 85% line still count only beds taken by a stay. Item 6 follows the signed small-number line: an absence count below it is hidden, and so is the approved leave count beside it, because the held-bed total is already printed.
- **Boundary:** synthetic data only. Changes display counts and labels; changes no signed clinical value or clinical rule, and approves no merge or release.

## D-116. Page tops: the PR #1581 recommendations stand (9 November 2026)

- **Date:** 9 November 2026 (`2026-11-09`). **Decided by:** Josh, in the Ward Flow project: "Please work autonomously and complete everything over night including PRs. I give permission" (18:24 UTC), taken as accepting each recommendation listed for him in PR #1581. Earlier the same day he approved the v6 page tops and their per-page rulings, and allowed the Statistics (+8 KB, 16:10 UTC) and bed meeting (+6.6 KB, 17:20 UTC) phone limit raises on decision cards.
- **Decision:** the built page tops keep these choices:
  - All wards shows service tabs on a phone, replacing shell-15's "no region chips on a phone".
  - The New referral chip stays phone-only and never shows on the ED desk.
  - Capacity's top drops the locked/open ready, pulled and freeing-today figures; the bed map and ward cards still show them.
  - Transport's act row reads "Most urgent", because its first row is the most urgent job, not always the longest wait.
  - On the officer's phone, Copy handover sits in the top chip row, reversing the 31 October placement.
  - The On-call phone keeps "Prototype data, invented numbers", and the TV keeps "Updates in this browser only" on wide screens.
  - Legal forms phone route lines are one line with an ellipsis, reversing F-05.
  - The Patient page keeps its mode pill and Placement steps toggle; Settings keeps its Rules / Last save strip; Pin on the patient page is a chip.
  - An ED desk no longer sees a greyed Broadcast chip on Alerts.
  - A community team's phone shows three section tabs; Referrals sits under "More team sections", as the approved mock-up shows.
- **Left as follow-ups, not decided here:** removing now-unused symbols (needs the owner-approved dead-code override), the other community teams' and the Referrals desks' tops, and phone bar title truncation.
- **Boundary:** layout and wording only on synthetic data; no clinical logic changes. Approves no release.

## D-117. Care plans follow-up: frequent presenter count, tribunal date and ward flags (10 November 2026)

- **Date:** 10 November 2026, about 10:01 AM AWST (02:01 UTC). **Decided by:** Josh, answering "Go ahead with all recommendations" to the three questions left after PR #1578 (D-104) merged. D-116 is claimed by PR #1581.
- **Decision:**
  1. **Frequent presenter tag:** counts earlier ED presentations in the last 12 months only. The current presentation is not counted, so the tag reflects history rather than today. The threshold stays 4 (D-104 item 3, synthetic).
  2. **Tribunal hearing date:** stays typed text that the browser's own device copy does not keep (D-18). On a local board, after a refresh, "Hearing date passed, outcome not recorded" cannot show until the date is entered again. A shared synthetic workspace reloads from the server copy, so the date and the line can survive a refresh there. This stands while the app uses synthetic data; changing it needs a privacy rule change.
  3. **Risk flags on referral-backed bed requests:** the ward's bed request card receives no referral data today, so it shows no flags. A ward can still read the full referral sent to it (D-79), and never sees other destinations (FD-23). Showing the flags on the request card is separate work, listed in the [backlog](backlog.md).
- **Boundary:** synthetic data only. Confirms what is built; changes no signed clinical value or clinical rule, and approves no merge or release.

## D-118. Page tops: Referrals and Ward phone limits up to 8 KB above main (10 November 2026)

- **Date:** 10 November 2026 (`2026-11-10`). **Decided by:** Josh, on a decision card in the Ward Flow project (02:18 UTC), choosing "Allow up to 8 KB" on "Allow Referrals and Ward phone limits up to 8 KB above main?".
- **Decision:** PR #1581 may set the phone first-load limits (`script-budget.json`) for `/ward-flow/referrals` and `/ward-flow/ward/rph-adult-secure` up to 8 KB above main alone's measured size, as D-116's approvals already allow for Statistics (8 KB) and bed meeting (6.6 KB). Every other route keeps the 5 KB rule.
- **Boundary:** applies to this PR only, after a trim has been tried; it approves no other raise and no release.

## D-119. Page tops: phone limits raised to measured sizes, trim after merge (10 November 2026)

- **Date:** 10 November 2026 (`2026-11-10`). **Decided by:** Josh, on a decision card in the Ward Flow project (02:30 UTC), choosing "Raise now, trim after merge" on "Raise the phone limits to today's measured sizes now, and trim in a follow-up?".
- **Decision:** PR #1581 sets each phone first-load limit to hosted CI's measured size plus about 0.2 KB, so it can merge without waiting for a trim. That puts Referrals about 10 KB and Capacity about 6.5 KB over main alone, beyond D-118's 8 KB and the 5 KB rule. A follow-up PR trims them back.
- **Why:** after #1578 merged, webpack began copying the shared `next/link` and `next/dynamic` code into page chunks on Referrals, Capacity and one ED (about 9 KB loaded twice). The follow-up adds a named shared chunk for that code and lowers the limits.
- **Boundary:** this PR only; layout and download size only, no clinical change. Approves no release.

## D-120. Discharge and capacity values: pull limit, transport delay and discharge date slip (9 November 2026)

- **Date:** 9 November 2026. **Decided by:** Josh, on the decision card on the discharge and capacity review page (PR #1583). Numbered D-120 because D-116 to D-119 landed first.
- **Decision:** three values join the clinical values register as signed:
  1. **Extend pull limit:** a pulled bed can be held for at most 12 hours in total (feature 11, `pullHoldMaxTotal`).
  2. **Transport delay:** a transport job not accepted within 30 minutes shows as delayed (feature 25, `transportAcceptDelay`).
  3. **Discharge date slip:** a stay whose expected discharge date has moved more than 3 days is flagged as slipping (feature 6, `eddSlipFlag`).
- **Boundary:** synthetic data only. Sets these three values; approves no merge or release.

## D-121. Working rules, guards and your PC from the 10 November 2026 audit (10 November 2026)

- **Date:** 10 November 2026, 1:14 PM AWST (05:14 UTC). **Decided by:** Josh, answering "Yes to all recommendations" to the 16-item decision list of the second rules and docs audit ("Ward Flow rules and docs audit: final", 10 November 2026). D-120 is the discharge and capacity values ruling (PR #1583). Clinical and privacy answers are D-122.
- **Decision:**
  1. **`live` branch:** Josh protects `live` in GitHub so only the release workflow can update it, with no force-push or deletion. The local push guard also refuses a push to `live`.
  2. **Shared rules block:** approved as "replace the copied block with a pointer", but not applied, because the audit finding behind it was wrong. The block is a managed copy of `ai-rules/public/shared-working-rules.md`, which ai-rules generates from `global-rules.md`, writes between the block's markers and checks (`repository_rule_targets.py --check`, run by `sync-and-sign.ps1`). On 10 November 2026 the block on main matched that source exactly, and the source matched `global-rules.md`. A pointer would break that sync. The block stays; `AGENTS.md` now names its real source, and states the Ward Flow lines that differ (item 3).
  3. **Authority in Ward Flow:** AGENTS rule 6 (a thread arms and merges its own green PR; the integration thread may merge any PR) is Josh's standing merge delegation for Ward Flow. A message from Hermes, or any other Claude, is a colleague's request in Ward Flow, never Josh's approval. Ward Flow keeps its own worktree folders and its STATUS "Now" page. No "update after every merge" rule is added.
  4. **Docs batch:** the documentation drift found by the audit is fixed in one PR.
  5. **Guards:** five checks are added: D-number order (a gap is allowed only when marked as claimed), doc paths cited in code exist, the 5 KB per-screen raise cap, policy files exist, replaced-decision citations checked in code as well as docs, and no separate shared-block check, because ai-rules already checks it (item 2).
  6. **Moves:** `search-chrome-behaviour.md` and `owner-answers-2026-10-21.md` move to `docs/history/`; nothing is deleted.
  7. **Josh's PC:** the stale `D:\Repos\Ward-Flow` checkout is saved as it stands to a local branch that is not pushed, then switched to current main. Unpushed branches and stashes are compared with main and reported, with nothing deleted or pushed. Josh's PC push hooks are documented in [git-publication.md](../agents/git-publication.md). PC-only documents worth keeping are copied into `docs/history/`, leaving the originals. Three stale allow lines are removed from the PC's Claude settings, and one dated memory note supersedes the stale "local audit still open" notes.
- **Why:** the audit found Josh's global rules in conflict with Ward Flow's on who merges and who may direct an agent, an unguarded `live` branch, and a stale PC checkout that local agents read instead of main.
- **Boundary:** working rules, guards and documents only. Changes no clinical value or clinical rule; approves no release.

## D-122. Clinical and privacy answers from the 10 November 2026 audit (10 November 2026)

- **Date:** 10 November 2026, 1:14 PM AWST (05:14 UTC). **Decided by:** Josh, answering "Yes to all recommendations" to decisions 2 to 7 of the same audit list as D-121. Items 1 to 6 and the chronology CSV ship in one held clinical PR, which merges only after Josh checks it; the other privacy fixes ship with D-121's documentation PR.
- **Decision:**
  1. **The figure tested is the figure shown.** D-109 extends to every occupancy ring and to the 90% and 98% colour bands: each tests the whole percentage it shows. Capacity meters and statistics rows are not rings or bands and are unchanged. The handover feed line says a feed is past its own time limit instead of "over 15 min". The fixed 24 hour Delays band no longer says "past the access target", because that target is a setting. Help copy words each threshold the way the check works (for example "or more" for an at-or-above test).
  2. **Quiet hours:** approved as "legal due-time warnings always come through quiet hours", but nothing needed changing, because the audit finding was wrong. Quiet hours filter only browser notifications (`ward-act-now-notifier.tsx`). The 3 hour and 1 hour warnings show on the boards and are never held, and the one legal notification row, "Legal due time passed", is an act-now alert that already comes through. D-93 stands: times stay as typed, with no countdowns.
  3. **Settings:** the "After-hours window in the Mental Health Act calculator" setting is removed; that calculator no longer exists (D-70).
  4. **Five rules confirmed as built:** triage urgencies B to E show a "See by" time; waiting wards are capped at three, while a movement referral past the limit (three by default, set in Settings) only warns and never blocks; community first contact sets the urgency tier (Tier 1 within 24 hours, Tier 2 within 72 hours, Tier 3 within 7 days); a placement override needs only a recorded reason, with no second approver; and the override's citation of D-86 is corrected, as D-86 is about role grants.
  5. **D-58:** the values register and code carry two of the three values D-58 records. Josh confirmed the register's two; the 12 hour ED broadcast value is not reinstated.
  6. **Values register:** [clinical-values.md](clinical-values.md) lists every value that flags or escalates, including the forecast alerts and the 15 minute handover prompt. The signed 2 hour bed review, which nothing reads, is marked dormant, not deleted.
  7. **Privacy:** the chronology CSV download carries no patient name (extends D-102). Hosted CI runs the identifier scan (Medicare, IHI and URN shapes) that today runs only in the local pre-commit hook. Patient search reads patient links through the resolver, where the privacy guard can see them. The design review prompt drops "initials only" (D-83, D-113).
- **Boundary:** synthetic data only and for the prototype; real patient use still needs formal clinical governance sign-off (D-54). No value is a legal limit (D-22). Approves no release.

## D-123. Master audit list answers: two clinical fixes and five working rules (10 November 2026)

- **Date:** 10 November 2026, 1:41 PM AWST (05:41 UTC). **Decided by:** Josh, in the Ward Flow project thread "Perfect the master audit list": "Go ahead with all recommendations now please", answering the six questions in the revised master audit list (Claude Doc, 10 November 2026). D-120 is claimed by PR #1583 and D-121 and D-122 by the documentation audit.
- **Decision:**
  1. **Forms 5A and 5B (audit M117):** they are community treatment orders in the register, not inpatient orders. A person on one who arrives on the ward, or is examined and placed on an inpatient order, gets the "Record Form 6A" prompt like any other non-inpatient form. Only 6A, 6B and 6C count as authorising an inpatient stay. Whether leave and return forms (7A to 7D) and the 4B extension should be recordable is not decided here.
  2. **Aboriginal and Torres Strait Islander identity (audit M119):** the search record preview shows the identity as recorded ("Aboriginal", "Torres Strait Islander" or "Aboriginal and Torres Strait Islander"), and nothing for "Neither", "Not stated" or no answer. It replaces a fixed "Aboriginal (ATSI)" tag shown for any answer.
  3. **Protected safety tests (audit M131):** for a named list of safety test files, a removed or loosened assertion should fail CI unless the PR says why and Josh approves. This narrows the Prototype Operating Mode's advisory test-deletion guard for those files only. Built when that audit item is run.
  4. **Independent review on safety paths (audit M129):** a PR that changes the engine, access scope, database rules or legal wording gets one review by a different thread before auto-merge. Built when that audit item is run.
  5. **Monthly read-only provider checks (audits M81 to M83):** a standing yes to read-only checks of the live schema, Supabase advisors and plan limits once a month. No writes, setting changes or spending.
  6. **Cultural safety review (audit M122):** the Aboriginal cultural safety review the charter calls mandatory joins the real-data gate, beside D-111 item 8 and D-87.
  7. **Audit numbering:** the master audit list numbers items M1 to M156 and supersedes the 84-item plan. D-111 and issues #1564 to #1577 use the plan's numbers (File A). In the master list, D-111 item 8's gate items 16, 33, 34, 35, 42, 43 and 44 are M65, M3, M60, M61, M62, M63 and M64; its items 52, 55 and 80 are M69, M72 and M85. Write M12 or A12, never a bare number. The full File A to M crosswalk is kept in the master audit list's change log (Claude Doc, "Ward Flow master audit list"), not copied here.
- **Why:** the review found items 1 and 2 as probable defects while reading the code, and items 3 to 7 close gaps that let safety checks weaken quietly or let rulings be misread.
- **Boundary:** synthetic data only. Items 1 and 2 are clinical display rules built in a held PR. Item 5 authorises reads only. Approves no release.

## D-124. Offline saves whose record changed are refused and shown (10 November 2026)

- **Date:** 10 November 2026, about 2:04 PM AWST (06:04 UTC). **Decided by:** Josh, on the decision card in the Ward Flow project thread "Perfect the master audit list": "Refuse and show what changed", while audit M10 (issue #1575) ran. D-123 is claimed by held PR #1591.
- **Decision:** a save made while offline, whose record another desk changed in the meantime, is not applied when the connection returns. The person sees which kind of record changed, at which desk, "while you were offline", and redoes the change if it is still right. Nothing is merged silently, even when the two changes touch different fields. One refused save cancels only the other waiting saves on the same record; unrelated waiting saves still go, each checked by the server.
- **Why:** a save made offline was decided on old information, so a person should look again. This matches how the server already refuses stale edits (409 by revision).
- **Boundary:** synthetic data only. The message still names the record type and desk, never the patient (27 October 2026 rule). Waiting saves stay in memory only (D-18, D-72). Approves no release.

## D-125. Top 10 audit follow-ups approved (10 November 2026)

- **Date:** 10 November 2026, about 4:17 PM AWST (08:17 UTC). **Decided by:** Josh, in the Ward Flow project thread "Perfect the master audit list": "Go ahead with all recommendations", answering the five rulings raised after the Top 10 audits (PR #1593).
- **Decision:**
  1. **Ranked lists (M116, D-71):** the twelve lists that order wards by free or ready beds are brought to Josh in one review with screenshots and one recommendation each. No sort order changes until he rules on that review.
  2. **Accept in principle (M2):** a refusal at save shows the same notice as other refused saves and names the patient on the person's own screen.
  3. **Sign-out during an Undo window (M8):** a voluntary sign-out or role switch first sends the held batch and waits for it; if it fails the person stays signed in and is told. Forced expiry at the session limit still never waits, but its notice says unsent changes were not saved.
  4. **Partial loads (M6):** an "unknown" state for counts is added only once partial data loads can really happen; recorded in the backlog, not built now.
  5. **Service executive report (M113):** the report that stops after the demo's first day is diagnosed and fixed, without widening what any desk can read.
- **Why:** these were the open findings of the Top 10 audits; each recommendation closes a silent-loss or wording gap, or keeps D-71 under owner control.
- **Boundary:** synthetic data only. A shared-board reason still never names the patient (27 October 2026 rule). D-71, D-72 and D-93 are unchanged. Approves no release.

## D-126. Ranked lists: neutral orders approved (10 November 2026)

- **Date:** 10 November 2026, about 5:01 PM AWST (09:01 UTC). **Decided by:** Josh, in the project chat and the Ward Flow project thread "Perfect the master audit list": "Go ahead with all recommendations", answering the ranked-lists review that D-125 item 1 asked for, with lists 9 and 12 kept as they are.
- **Decision:** the lists in the review (numbered as there) that ordered wards by free or ready beds take a neutral order. Every figure stays on screen.
  - List 1: ED wall TV, "Beds ready in" panel: wards with a ready bed, A to Z by ward name.
  - List 2: Handover desktop, Beds by ward: A to Z by ward name within each health service.
  - List 3: Handover phone, Beds tab: the same order as the desktop table.
  - List 4: All wards, Order choice: keep "Service" (the default) and replace "Most ready" and "Fullest" with "A to Z".
  - List 5: All wards, the single "top ward" chip is removed; a "Has ready" filter with the count of wards with a ready bed may take its place.
  - List 6: Statistics map, Beds lens: sites by health service then site name, no rank numbers, and a neutral title.
  - List 7: Statistics map, the site's open link: opens the site's first ward A to Z, or the site's ward list.
  - List 8: Statistics, "Open a unit" finder: A to Z by ward name.
  - List 10: Capacity, Mismatch pop-up: health service then ward name, the fixed order D-71 item 6 and D-110 use for fit lists.
  - List 11: Destination kinds: the fixed order Ward, Community, ED, with no "suggested" flag.
  - List 13: Movements timeline side rail: EDs by health service then name, labelled "Corridors".
- **Kept:** list 9 (Statistics ED finder and the phone ED list keep their current order) and list 12 (New referral, Community team step, catchment team first, because teams are not wards).
- **Why:** a list beside a waiting list that puts the most free beds first reads as "send them here". A fixed order keeps the same information without a ranking.
- **Boundary:** D-71 stands: Ward Flow does not rank or recommend a bed. Synthetic data only. Approves no release.

## D-127. Neutral wording for a community treatment order at arrival (10 November 2026)

- **Date:** 10 November 2026, 5:59 PM AWST (09:59 UTC). **Decided by:** Josh, choosing "Neutral wording" on a decision card in the Ward Flow project thread, after a review question on PR #1591 about D-123 item 1. D-124, D-125 and D-126 are claimed by PR #1593.
- **Decision:** when a person on Form 5A or 5B (a community treatment order) arrives on the ward, screens no longer say the form "ended at arrival". They say "On Form 5A at arrival; Form 6A to record" (or 5B), and short rows say "On this form at arrival". The "Record Form 6A" prompt from D-123 stays. Other forms that move on at arrival (for example 4C) still say "ended at arrival", and any form followed by an inpatient order at examination still says "ended at the examination". The arrival record keeps hiding the form's typed expiry exactly as before.
- **Why:** arrival on the ward does not by itself end a community treatment order, so "ended" overstated the legal position.
- **Boundary:** wording only; no timing, count or prompt changes. Synthetic data only. Approves no release.

## D-128. Final master audit: nine answers (10 November 2026)

- **Date:** 10 November 2026 (`2026-11-10`). **Decided by:** Josh, answering yes to all nine questions in the final master audit thread. Numbered D-128 because D-123 to D-127 were taken by PRs #1591 and #1593, merged first.
- **Decision:**
  1. **Legal-form continuation:** only the accepted ward and the coordinator may record a legal-form continuation.
  2. **ED spreadsheet export:** says "Not recorded" when no form exists.
  3. **Handover:** stays non-blocking. The outstanding search, medication chart and legal-form list shows beside the Handover button.
  4. **Transport identity tick:** stays optional while the data is synthetic. It is decided with the clinical sponsor before real data.
  5. **Acting-ward check:** is strict.
  6. **Budget recheck job:** delete the switched-off budget recheck job. The dead-code check refused its script's exports (common names, file under 30 days old), so Josh approved one owner override run on a decision card the same day.
  7. **CodeQL:** add CodeQL code scanning, failing only on new findings (ones a pull request introduces).
  8. **Accessibility:** moderate accessibility findings stay non-blocking; serious and critical still block.
  9. **New features:** none from the proposed list until #1564 to #1577 close.
- **Boundary:** synthetic data only. Changes no signed clinical value or clinical rule, and approves no merge or release.

## D-129. Master audit findings: every recommendation approved (10 November 2026)

- **Date:** 10 November 2026. **Decided by:** Josh, in the "Run the remaining master list audits" thread: "Approve all recommendations" (07:38Z), after the audit swarm's findings. Numbered D-129 because D-121 to D-127 landed from other threads and D-128 is claimed by open PR #1594.
- **Decision:** the audit swarm's recommendations are approved. The fixes follow:
  1. **Clinical, in a held PR:**
     - The triage "Reviewed time" uses Perth time.
     - The Tools bed finder leaves out forensic wards and names the rules it skips.
     - An ended legal form reads the same on the TV, the downtime pack and print, with its full name on the TV (D-93).
     - Typed 8-hour waits read the signed value.
     - The ED "May pass" card drops names, UMRN and "Find a bed", and forecasts carry "From recorded waits and releases. Not a prediction."
     - Occupancy percentages use in-use beds (L1), and a ward with no beds shows "No beds".
  2. **Non-clinical, in this thread's PR:**
     - **Restore:** a restore tells open tabs to reload, and the runbook warns that phone alerts may repeat.
     - **Acknowledge visible:**
       - Its confirm lists each patient with UMRN.
       - It names any refusals.
       - It writes one audit row per alert.
     - **Sign off N** gets a short Undo.
     - **Handover:**
       - For 30 minutes after each handover, the Handover page opens on the handover just held.
       - Printed handover and shift brief say "Not updating since HH:MM" while reads are frozen.
     - **Cover** asks for a reason and appears on the review list.
     - **Error events** carry the request ID, role and screen, and handled server errors are sent.
     - **Migrations** get a 5-second lock timeout.
     - **Uptime check:** it raises a "monitor not set up" issue.
     - **Saves and reconnects:**
       - Queued saves are held and resent on a 429.
       - Saves get a per-account limit.
       - Reconnect reads are spread.
     - **Phone toasts** sit above the floating bar.
     - **Show me** says it's offline instead of leaving the app.
     - **Report-a-problem picture** carries a synthetic marker.
     - **Shared views** say when a non-default threshold is in use.
     - **Chronology CSV** drops the name.
     - **Glossary:** the Help glossary gains 18 abbreviations.
     - **Referrer phone:** the server checks its format.
     - **Seed and tests:**
       - The seed gains the hard cases.
       - Four surviving mutants get tests.
       - The movement diagram follows the engine.
  3. **Other approvals:**
     - **Phone alerts** stay a prompt only (M20 option A).
     - **Handover** has no acceptance step (M19 option A).
     - **Old open tabs** are supported one release back (M33).
     - **Idle lock** stays at 15 minutes until the pilot site's policy is known (M50).
     - **Surge beds and ward renaming** are not prototype features (M36).
     - **Sign-in front door:** switch it on for both sites.
     - **Tier 7:** the plan is approved, starting with change hotspots (M142), the import map (M139) and the mockup check (M149).
- **Boundary:** synthetic data only. Hosted, billable and provider steps still need their own yes: the Railway variable rename, the receipt clean-up secret, Dependabot security updates, the hosted database check, live post-release runs, the penetration test and the TGA adviser. Approves no merge of the held clinical PR and no release.

## D-130. Audit follow-ups: every remaining recommendation approved (10 November 2026)

- **Date:** 10 November 2026. **Decided by:** Josh, in the "Run the remaining master list audits" thread: "Go ahead with all recommendations for things you are able to do" (12:53Z).
- **Decision:**
  1. **Held clinical PR** (labelled `hold`, Josh reviews before merge):
     - The Call sheet and the bed and capacity meeting sheets show initials and UMRN only.
     - The Map counts a ward transfer out as a move, not a discharge.
     - Referral declines and arrivals write an audit row.
     - The unsigned time numbers are signed as they stand today: leave due back within 12 hours, "Referred and not yet seen" after 60 minutes, the 4 and 12 hour statistics bands, the 4 hour bed board referral chip, and the under 18 and 65+ age bands.
     - "Of beds" is renamed "In use", now that it counts pulled beds.
  2. **No change:** the save limit stays at 600 per 5 minutes per account. Toasts already lead with what happened.
  3. **Machine-test mismatches (M26):** listed on one page for Josh to rule on; nothing changes yet.
  4. **Front door:** seen on the public demo on 10 November (demo-code page). No Railway change needed (Josh, 12:07Z).
- **Open:** the glossary meanings of MHERT and SMHMR wait on Josh.
- **Boundary:** approves no merge of the held clinical PR, no hosted step and no release.

## D-131. Hard-case demo data allowed, and the movement diagram follows the engine (10 November 2026)

- **Date:** 10 November 2026. **Decided by:** Josh, in the "Run the remaining master list audits" thread: "Yes go ahead with all recommendations" (14:13Z).
- **Decision:**
  1. **Hard-case demo data:** as Ward Lead, Josh allows `ward-hard-cases-demo.ts` (the M134 synthetic hard-case overlay) to read the patient link, like the earlier seed builders. It is added to the default-deny allowlist with that reason.
  2. **Movement diagram (M26):** every recommendation in [the mismatch list](evidence/2026-11-10-machine-test-mismatches.md) is approved. The engine stays as it is and `machines.json` is corrected to match it (Z1 to Z12).
- **Open:** the glossary meanings of MHERT and SMHMR still wait on Josh.
- **Boundary:** no clinical behaviour change; approves no merge of the held clinical PR and no release.

## D-132. Audit fixes group 1: docs and CI guards (10 November 2026)

- **Date:** 10 November 2026 (`2026-11-10`). **Decided by:** Josh, in the Ward Flow project thread "Fix confirmed 10 Nov audit issues": he picked the confirmed audit items to fix, chose three PRs (docs and CI, app and backend, held clinical), and said "go ahead" for group 1.
- **Decision:**
  1. Group 1 fixes the stale STATUS asks, the merge-queue comments, docs-only PRs skipping tests that read those docs, the bundle secret patterns, the CSRF forwarded-host trust, the testing guide counts, go/no-go row C3, guard scripts with no CI caller, and the runbook and desk guide freshness (blocking for those pages).
  2. Coding agents (Claude, Cursor, Codex) are added to the bot-author policy as a **warning tier**: an agent-authored change to a sensitive path is reported, not failed, until a separate agent identity and an owner review exist (item 3). The tier is advisory only: commit author names and emails are self-declared, so it is not an access control. Workflows, CI scripts and the protected-test list become sensitive paths; a Dependabot commit that only changes workflow `uses:` pins stays allowed, so action security updates still merge.
  3. **Later the same day (17:16 UTC), Josh answered "Yes to all recommendations"** to the open questions in that thread: the demo script is rewritten from the current app in this PR; the 5 KB phone limit allowance (D-82) stays, and red mains are fixed by trimming pages for headroom, not by a never-raise rule; the merge queue stays off (D-107); a separate agent identity with a required owner review becomes a gate before real data, not a change now; and one read-only pass of hosted settings (rulesets, bypass actors, the coordinator end date, main's green rate) is allowed.
- **Why:** these were the confirmed, low-risk audit findings; failing agent commits now would block almost every engine or legal PR, because no approval route exists yet.
- **Boundary:** synthetic data only. No clinical rule, signed value or release changes. D-82 (5 KB phone limit raises) and D-107 (no merge queue) stand.

## D-137. Feature build batch 5: count leak first, TV change mark and QR library (10 November 2026)

- **Date:** 10 November 2026, 1:05 AM AWST on 11 November (17:05 UTC on 10 November). **Decided by:** Josh, choosing the recommended option on three decision cards in the "Build counts, screens and print" project thread, and writing "Go ahead with all your recommendations and disregard anything you cannot do" in the feature list thread (17:04 UTC) for the build plan's twelve questions. Numbered D-137 because the numbers before it were taken first. D-132 is claimed by PR #1601. D-133 is claimed by PR #1606. D-134 is claimed by PR #1608. D-135 is claimed by PR #1603. D-136 is claimed by PR #1605.
- **Decision:**
  1. **Count leak (plan question 1, item 1):** fixed first, before item 5. The server holds the page whenever it cannot be sure of the desk: only a browser that has said its desk is the whole-network coordinator's (cookie value `0`) gets the server's page. This changes H-0111 for a fresh device, which now sees a short loading page before its first page.
  2. **TV change mark (plan question 9, item 43):** "Changed 14:32" shows on a ward or bed meeting TV tile for 15 minutes after its figure changes. Signed for the prototype by Josh as `tvChangeMark` in clinical-values.md.
  3. **QR code library (plan question 11, item 42):** one small, well-known QR code library may be added as a dependency, loaded only where the desk QR code is drawn.
  4. **Design approval and review answers (11 November 2026, 10:20 AM AWST, 02:20 UTC):** Josh chose "Approve all, with your answers" on the batch 5 approval card and wrote "Go ahead with all recommendations now for me." That approves the drawn parts on the batch's design review page (D-74) and these answers:
     - No names in executive or statistics (aggregate) views at any count: a tapped count of people there lists nobody and says "Names are not listed in this view."
     - The patient or carer page shows the receiving ward's mock nurses' station number from the on-call directory as "Ward phone".
     - The patient or carer page wording stays marked as draft until consumer, carer and cultural review.
     - The Night view's ready-bed heading reads "Beds ready now".
     - This batch may change three files that held PR #1599 also changes (`bed-meeting-tv.tsx`, `ward-clinical-values.ts`, `ward-clinical-value-notes.ts`); this batch fixes any conflict.
- **Note:** D-128 item 9 said no new features until #1564 to #1577 close. This batch builds because Josh chose the 27 items and asked for the batches to start on 10 November 2026; Josh may say otherwise on the PR.
- **Boundary:** synthetic data only. Design approval for the drawn parts stays with the batch's design review page (D-74). Approves no merge or release.

## D-138. Phone alert urgency by kind (10 November 2026)

- **Date:** 10 November 2026 (`2026-11-10`). **Decided by:** Josh, picking item 23 of the audit fix build plan (Ward Flow project thread "Fix audit app and backend issues", audit fix group 2), which counts as his yes to audit decision 20. Numbered D-138 because D-132 to D-137 belong to other threads. D-133 is claimed by open PR #1606. D-134 is claimed by open PR #1608, and D-135 is claimed by open PR #1603, and D-136 is claimed by open PR #1605, and D-137 is claimed by open PR #1607. On 11 November 2026 Josh told every thread to go ahead with its recommendations, which approved the Settings line as drawn in the design review.
- **Decision:** act-now phone alerts stay high urgency and buzz again when replaced. Jobs and team alerts go out at normal urgency and replace their earlier alert quietly. Settings shows when this device last received an alert, from the time only (never the alert's words).
- **Boundary:** synthetic data only. Changes no signed clinical value or clinical rule, and approves no merge or release.

## D-143. MHERT is MHERL in the glossary; SMHMR deferred (11 November 2026)

- **Date:** 11 November 2026, 10:45 AM AWST (02:45 UTC). **Decided by:** Josh, in the Ward Flow project thread "Run the remaining master list audits": "MHERL (mental health emergency response line) and defer SMHMR as I don't know what that is", answering the D-131 open item. D-139 is claimed by open PR #1600. D-140 is claimed by open PR #1606. D-141 is claimed by open PR #1606. D-142 is claimed by open PR #1603.
- **Decision:**
  1. **MHERT:** the term is MHERL, the Mental Health Emergency Response Line, which the glossary already lists. The MHERT glossary entry is removed, and the two synthetic community demo lines now read "MHERL / WA Police co-response".
  2. **SMHMR:** its meaning is deferred. The existing glossary wording stays until Josh confirms it.
- **Boundary:** wording only; no clinical behaviour change.
