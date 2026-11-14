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

_Updated 2026-11-10 - added D-139, added D-121 and D-122 and corrected the D-58, D-74, D-94 and D-100 status rows; Documentation owns. Earlier changes are in Git history._

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
| [D-80](#d-80-role-access-plan-version-2-all-17-recommendations-23-october-2026)                                                                         | Role access plan version 2: all 17 recommendations                                     | Partly replaced by D-86 and D-142                |
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
| [D-93](#d-93-legal-form-times-show-only-as-typed-never-as-a-countdown-31-october-2026)                                                                  | Legal form times show only as typed, never as a countdown                              | Wording replaced by D-218                        |
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
| [D-114](#d-114-allow-pull_request_target-for-three-workflows-only-9-november-2026)                                                                      | Allow pull_request_target for three workflows only                                     | Done (policy set 13 Nov 2026)                    |
| [D-115](#d-115-one-count-on-every-screen-and-a-missing-patient-shown-everywhere-9-november-2026)                                                        | One count on every screen; missing patient shown everywhere                            | Active                                           |
| [D-116](#d-116-page-tops-the-pr-1581-recommendations-stand-9-november-2026)                                                                             | Page tops: PR #1581 recommendations stand                                              | Active                                           |
| [D-117](#d-117-care-plans-follow-up-frequent-presenter-count-tribunal-date-and-ward-flags-10-november-2026)                                             | Care plans follow-up: frequent presenter count, tribunal date, ward flags              | Active                                           |
| [D-118](#d-118-page-tops-referrals-and-ward-phone-limits-up-to-8-kb-above-main-10-november-2026)                                                        | Page tops: Referrals and Ward phone limits up to 8 KB above main                       | Active                                           |
| [D-119](#d-119-page-tops-phone-limits-raised-to-measured-sizes-trim-after-merge-10-november-2026)                                                       | Page tops: phone limits at measured sizes, trim after merge                            | Active                                           |
| [D-120](#d-120-discharge-and-capacity-values-pull-limit-transport-delay-and-discharge-date-slip-9-november-2026)                                        | Discharge and capacity values: pull limit, transport delay, date slip                  | Active                                           |
| [D-121](#d-121-working-rules-guards-and-your-pc-from-the-10-november-2026-audit-10-november-2026)                                                       | Working rules, guards and PC tidy from the 10 Nov audit                                | Active; item 1 done in part (13 Nov 2026)        |
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
| [D-133](#d-133-batch-1-ed-and-referral-flow-three-answers-10-november-2026)                                                                             | Batch 1: escalation record, 30 min not opened, home team heads-up                      | Active                                           |
| [D-134](#d-134-ward-arrival-and-beds-batch-how-to-hold-advocate-line-night-list-and-the-feature-freeze-10-november-2026)                                | Ward arrival and beds batch: held split, advocate line, night list, feature freeze     | Active                                           |
| [D-135](#d-135-batch-4-outages-and-pilot-control-pack-age-and-plan-answers-10-november-2026)                                                            | Batch 4, outages and pilot control: pack age and plan answers                          | Active                                           |
| [D-136](#d-136-feature-batch-3-shift-change-and-follow-up-two-signed-values-10-november-2026)                                                           | Feature batch 3: two signed values (7-day diversion return, 30-minute handover list)   | Active                                           |
| [D-137](#d-137-feature-build-batch-5-count-leak-first-tv-change-mark-and-qr-library-10-november-2026)                                                   | Feature build batch 5: count leak first, TV change mark 15 minutes, QR library         | Active                                           |
| [D-138](#d-138-phone-alert-urgency-by-kind-10-november-2026)                                                                                            | Phone alert urgency by kind                                                            | Active                                           |
| [D-139](#d-139-phone-statistics-ward-list-a-to-z-and-leave-return-times-as-typed-10-november-2026)                                                      | Phone Statistics ward list A to Z, and leave return times as typed                     | Wording replaced by D-218                        |
| [D-140](#d-140-feature-list-adopted-and-wave-1-begins-10-november-2026)                                                                                 | Feature list adopted, and Wave 1 begins                                                | Active                                           |
| [D-141](#d-141-batch-1-ed-and-referral-flow-design-approved-with-eleven-answers-11-november-2026)                                                       | Batch 1 design approved, with eleven answers                                           | Active                                           |
| [D-142](#d-142-batch-4-design-review-and-all-twelve-answers-approved-d-80-amended-for-site-features-11-november-2026)                                   | Batch 4: design review and all twelve answers approved, D-80 amended for site features | Active                                           |
| [D-143](#d-143-mhert-is-mherl-in-the-glossary-smhmr-deferred-11-november-2026)                                                                          | MHERT is MHERL in the glossary; SMHMR deferred                                         | Active                                           |
| [D-144](#d-144-chip-rows-move-only-sideways-on-a-phone-11-november-2026)                                                                                | Chip rows move only sideways on a phone                                                | Active                                           |
| [D-145](#d-145-repository-review-fixes-features-and-code-health-approved-11-november-2026)                                                              | Repository review: fixes, features and code health approved                            | Active                                           |
| [D-146](#d-146-performance-audit-fixes-and-the-phone-speed-target-11-november-2026)                                                                     | Performance audit fixes and the phone speed target                                     | Active                                           |
| [D-147](#d-147-demo-code-tries-keep-per-address-keying-until-a-trusted-proxy-is-set-11-november-2026)                                                   | Demo-code tries keep per-address keying until a trusted proxy is set                   | Active                                           |
| [D-148](#d-148-closing-a-bed-stays-one-tap-and-its-toast-offers-a-reason-11-november-2026)                                                              | Closing a bed stays one tap, and its toast offers a reason                             | Active                                           |
| [D-149](#d-149-a-record-whose-only-links-are-withdrawn-referrals-can-be-archived-11-november-2026)                                                      | A record whose only links are withdrawn referrals can be archived                      | Active                                           |
| [D-150](#d-150-the-signed-in-site-runs-on-real-perth-time-11-november-2026)                                                                             | The signed-in site runs on real Perth time                                             | Active                                           |
| [D-151](#d-151-a-bed-tile-says-when-a-change-is-waiting-to-save-11-november-2026)                                                                       | A bed tile says when a change is waiting to save                                       | Active                                           |
| [D-152](#d-152-returned-to-ed-prompt-sees-every-return-in-shared-mode-11-november-2026)                                                                 | Returned to ED prompt sees every return in shared mode                                 | Active                                           |
| [D-153](#d-153-keep-the-drawn-time-settle-check-and-defer-a-separate-agent-github-identity-11-november-2026)                                            | Keep the drawn-time settle check, and defer a separate agent GitHub identity           | Active                                           |
| [D-154](#d-154-the-community-desks-ed-heads-up-reads-a-narrow-scoped-list-11-november-2026)                                                             | The community desk's ED heads-up reads a narrow scoped list                            | Active                                           |
| [D-155](#d-155-check-the-live-clock-offset-before-clearing-it-11-november-2026)                                                                         | Check the live clock offset before clearing it                                         | Active                                           |
| [D-156](#d-156-reset-the-synthetic-live-world-after-the-clock-fix-11-november-2026)                                                                     | Post-release reset of the live synthetic world withdrawn                               | Withdrawn 12 November 2026                       |
| [D-157](#d-157-legal-forms-print-and-export-include-people-admitted-on-a-form-12-november-2026)                                                         | Legal forms Print and Export include people admitted on a form                         | Active                                           |
| [D-158](#d-158-a-this-shift-staff-request-is-refused-once-that-shift-has-ended-12-november-2026)                                                        | A This-shift staff request is refused once that shift has ended                        | Active                                           |
| [D-159](#d-159-fixes-from-the-10-to-12-november-pr-review-12-november-2026)                                                                             | Fixes from the 10 to 12 November PR review                                             | Active                                           |
| [D-160](#d-160-a-trusted-proxy-list-of-plain-addresses-falls-back-to-per-address-keying-12-november-2026)                                               | A trusted proxy list of plain addresses falls back to per-address keying               | Active                                           |
| [D-161](#d-161-homes-changes-since-strip-is-one-line-12-november-2026)                                                                                  | Home's changes-since strip is one line                                                 | Active                                           |
| [D-162](#d-162-fixes-from-the-12-november-whole-site-component-review-12-november-2026)                                                                 | Fixes from the 12 November whole-site component review                                 | Active                                           |
| [D-163](#d-163-pre-demo-audits-use-the-public-demo-after-d-162-is-live-12-november-2026)                                                                | Pre-demo audits use the public demo after D-162 is live                                | Active                                           |
| [D-164](#d-164-homes-changes-since-strip-names-escalations-first-and-leaves-movements-off-12-november-2026)                                             | Home's changes-since strip names escalations first and leaves movements off            | Active                                           |
| [D-165](#d-165-the-patient-screen-is-a-dashboard-grid-on-every-tab-13-november-2026)                                                                    | The patient screen is a dashboard grid on every tab                                    | Active                                           |
| [D-166](#d-166-ci-runs-faster-without-dropping-a-check-12-november-2026)                                                                                | CI runs faster without dropping a check                                                | Active                                           |
| [D-167](#d-167-the-triage-page-has-a-left-sign-off-nav-and-joined-section-steps-13-november-2026)                                                       | The Triage page has a left sign-off nav and joined section steps                       | Active                                           |
| [D-168](#d-168-the-demo-script-follows-the-13-november-pre-demo-audit-13-november-2026)                                                                 | The demo script follows the 13 November pre-demo audit                                 | Active                                           |
| [D-169](#d-169-demo-script-wording-follows-the-hard-questions-audit-13-november-2026)                                                                   | Demo script wording follows the hard questions audit                                   | Active                                           |
| [D-170](#d-170-clinical-wording-rulings-from-the-13-november-audit-13-november-2026)                                                                    | Clinical wording rulings from the 13 November audit                                    | Active                                           |
| [D-171](#d-171-hosted-database-brought-to-schema-18-migrations-017-and-018-13-november-2026)                                                            | Hosted database brought to schema 18 (migrations 017 and 018)                          | Active                                           |
| [D-172](#d-172-the-community-desks-ed-heads-up-stays-as-built-in-d-154-13-november-2026)                                                                | The community desk's ED heads-up stays as built in D-154                               | Active                                           |
| [D-173](#d-173-turning-off-supabase-open-sign-up-is-deferred-13-november-2026)                                                                          | Turning off Supabase open sign-up is deferred                                          | Done 14 November 2026                            |
| [D-174](#d-174-audit-findings-name-the-system-cause-and-the-fix-round-ships-in-two-pull-requests-13-november-2026)                                      | Audit findings name the system cause, and the fix round ships in two pull requests     | Active                                           |
| [D-175](#d-175-audit-16-and-the-demo-data-root-cause-review-approved-fixes-13-november-2026)                                                            | Audit 16 and the demo-data root-cause review: approved fixes                           | Active                                           |
| [D-176](#d-176-clinical-check-pack-answers-13-november-2026)                                                                                            | Clinical check pack answers                                                            | Active                                           |
| [D-177](#d-177-audit-15-answers-on-the-public-footprint-13-november-2026)                                                                               | Audit 15 answers on the public footprint                                               | Active                                           |
| [D-178](#d-178-audits-4-and-5-answers-13-november-2026)                                                                                                 | Audits 4 and 5 answers                                                                 | Active                                           |
| [D-179](#d-179-audit-9-answers-from-a-real-shift-13-november-2026)                                                                                      | Audit 9 answers from a real shift                                                      | Active                                           |
| [D-180](#d-180-audits-12-and-14-answers-13-november-2026)                                                                                               | Audits 12 and 14 answers                                                               | Active                                           |
| [D-181](#d-181-fix-round-answers-13-november-2026)                                                                                                      | Fix round answers                                                                      | Active                                           |
| [D-182](#d-182-audit-chat-and-end-report-answers-13-november-2026)                                                                                      | Audit chat and end-report answers                                                      | Active                                           |
| [D-183](#d-183-end-report-addendum-answers-13-november-2026)                                                                                            | End report addendum answers                                                            | Active                                           |
| [D-184](#d-184-the-system-fixes-merge-before-the-demo-13-november-2026)                                                                                 | The system fixes merge before the demo                                                 | Active                                           |
| [D-185](#d-185-design-critique-v2-answers-and-the-brand-mark-for-the-demo-13-november-2026)                                                             | Design critique v2 answers and the brand mark for the demo                             | Active                                           |
| [D-186](#d-186-clinical-sign-off-sitting-part-1-timing-and-the-audit-backed-recommendations-13-november-2026)                                           | Clinical sign-off sitting, part 1: timing and the audit-backed recommendations         | Active                                           |
| [D-187](#d-187-clinical-sign-off-sitting-part-2-the-recommendations-for-q17-to-q44-13-november-2026)                                                    | Clinical sign-off sitting, part 2: the recommendations for Q17 to Q44                  | Active                                           |
| [D-188](#d-188-the-home-pull-form-is-filled-from-the-record-and-can-be-changed-13-november-2026)                                                        | The Home pull form is filled from the record and can be changed                        | Active                                           |
| [D-189](#d-189-handling-the-open-sitting-questions-and-how-the-remaining-items-are-built-13-november-2026)                                              | Handling the open sitting questions, and how the remaining items are built             | Partly replaced by D-209                         |
| [D-190](#d-190-the-six-pr-fix-plan-13-november-2026)                                                                                                    | The six-PR fix plan                                                                    | Active                                           |
| [D-191](#d-191-home-ward-and-capacity-mock-ups-approved-13-november-2026)                                                                               | Home, Ward and Capacity mock-ups approved                                              | Active                                           |
| [D-192](#d-192-shared-design-parts-approved-for-building-wave-3-pr-e-13-november-2026)                                                                  | Shared design parts approved for building (wave 3, PR E)                               | Active                                           |
| [D-193](#d-193-checked-travel-times-wait-until-after-the-demo-13-november-2026)                                                                         | Checked travel times wait until after the demo                                         | Active                                           |
| [D-194](#d-194-time-audit-answers-13-november-2026)                                                                                                     | Time audit answers                                                                     | Active                                           |
| [D-195](#d-195-merge-each-pull-request-when-its-checks-pass-13-november-2026)                                                                           | Merge each pull request when its checks pass                                           | Active                                           |
| [D-196](#d-196-threads-decide-on-their-own-to-keep-work-moving-13-november-2026)                                                                        | Threads decide on their own to keep work moving                                        | Active                                           |
| [D-197](#d-197-system-fixes-calls-taken-under-d-196-13-november-2026)                                                                                   | System-fixes calls taken under D-196                                                   | Active                                           |
| [D-198](#d-198-one-owner-per-screen-for-forecast-words-and-reserved-bed-retired-13-november-2026)                                                       | One owner per screen for forecast words; "reserved bed" retired                        | Active                                           |
| [D-199](#d-199-ed-and-ward-phone-limits-raised-past-the-allowance-13-november-2026)                                                                     | ED and Ward phone limits raised past the allowance                                     | Active                                           |
| [D-200](#d-200-shared-design-parts-and-the-home-ward-and-capacity-redesign-go-live-together-13-november-2026)                                           | E and F go live together after the 14 November release                                 | Active                                           |
| [D-201](#d-201-overnight-merging-without-josh-13-november-2026)                                                                                         | Overnight merging without Josh                                                         | Active                                           |
| [D-202](#d-202-joint-go-summary-recommendations-14-november-2026)                                                                                       | Joint go summary recommendations                                                       | Active                                           |
| [D-203](#d-203-scoped-takeover-of-pr-e-and-pr-f-by-the-e-thread-14-november-2026)                                                                       | Scoped takeover of PR E and PR F by the E thread (undone the same day)                 | Undone                                           |
| [D-204](#d-204-a-signed-triage-shows-the-desks-name-14-november-2026)                                                                                   | A signed triage shows the desk's name                                                  | Active                                           |
| [D-205](#d-205-release-now-once-each-pr-merges-14-november-2026)                                                                                        | Release now, once each PR merges and its main CI passes                                | Active                                           |
| [D-206](#d-206-codeql-storage-alerts-are-false-positives-for-the-demo-14-november-2026)                                                                 | CodeQL storage alerts are false positives for the demo                                 | Active                                           |
| [D-207](#d-207-fit-to-travel-recorded-as-not-cleared-and-the-clinical-go-14-november-2026)                                                              | Fit to travel: not cleared, and the clinical go                                        | Partly replaced by D-211                         |
| [D-208](#d-208-appraised-findings-fix-three-real-display-bugs-14-november-2026)                                                                         | Appraised findings: fix three real display bugs                                        | Active                                           |
| [D-209](#d-209-nine-open-clinical-items-signed-avoiding-restriction-and-friction-14-november-2026)                                                      | Nine open clinical items signed, avoiding restriction and friction                     | Active                                           |
| [D-210](#d-210-mechanics-and-clock-audit-fixes-14-november-2026)                                                                                        | Mechanics and clock audit fixes, one PR                                                | Active                                           |
| [D-211](#d-211-not-medically-cleared-pauses-onward-transfer-14-november-2026)                                                                           | Not medically cleared pauses onward transfer                                           | Active                                           |
| [D-212](#d-212-the-master-stress-test-replaces-audits-6-11-and-18-14-november-2026)                                                                     | The master stress test replaces Audits 6, 11 and 18                                    | Active                                           |
| [D-213](#d-213-the-clock-follows-perth-time-from-one-setting-and-the-stored-signed-in-world-is-moved-onto-it-14-november-2026)                          | Clock follows Perth time from one setting                                              | Active                                           |
| [D-214](#d-214-stress-test-answers-severity-legal-wording-stale-counts-the-site-bed-manager-and-one-beds-ready-figure-14-november-2026)                 | Stress test answers: legal, stale counts, Beds ready                                   | Active                                           |
| [D-215](#d-215-stress-test-answers-for-after-the-demo-14-november-2026)                                                                                 | Stress test answers for after the demo                                                 | Active                                           |
| [D-216](#d-216-the-36-sign-off-recommendations-from-the-stress-test-pack-14-november-2026)                                                              | The 36 sign-off recommendations                                                        | Active                                           |
| [D-217](#d-217-hand-check-answers-medical-trips-and-undo-after-referring-14-november-2026)                                                              | Hand check answers: medical trips and Undo                                             | Active                                           |
| [D-218](#d-218-no-legal-disclaimer-wording-on-screens-14-november-2026)                                                                                 | No legal disclaimer wording on screens                                                 | Active                                           |
| [D-229](#d-229-demo-pause-holds-board-time-and-seeded-wait-lists-match-the-engine-14-november-2026)                                                     | Demo Pause holds Board time; seeded wait lists match the engine                        | Active                                           |

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
- **Boundary:** synthetic data only. This decides product direction, not clinical governance sign-off (D-54), and authorises no provider, deployment or spending step.
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
- **Boundary:** synthetic data only. A push or PR is not a merge, deployment or provider change; each still needs its own authority (AGENTS.md hard rule 10).
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
- **Boundary:** synthetic data only. This authorises no deployment, provider configuration change or spending. The Supabase connector, open sign-up, restore drill, iPhone walkthrough and pilot roles are for Josh to do himself.
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
- **Boundary:** synthetic data only. This authorises no deployment, provider configuration change or spending, and no build from a mock-up before Josh approves it.
- **Why:** The audit and the fix threads needed owner answers before the quick wins, caching work, community gaps and bed hold timing could go ahead.

## D-76. Community referral gaps: the full move journey and asking more wards (21 October 2026)

- **Date:** 21 October 2026 (`2026-10-21`). **Decided by:** Josh, in the Community referral gaps thread at 10:05 PM AWST: "Go ahead with all recommendations", on the scope in `community-gaps-scope-2026-10-21.md`.
- **Decision:**
  1. **Fix plan item 15.** An accepted community referral is built as the full journey: it can be moved, transported and arrived, and it shows on the Movements and Transport boards. The journey records a community origin by team name, with no address. This updates owner ruling 8 of 1 September 2026, which said a journey never starts at a community team, for an accepted community referral. The smaller option, where the ward records "arrived from community" against the held bed with no movement, is not taken.
  2. **Fix plan item 16.** The coordinator can ask more wards about an open community referral. Each ward added is recorded with who added it and when. No more than 3 wards may be waiting at once (`PARALLEL_REFERRAL_CAP`), and wards that declined do not count. Wards are listed alphabetically and are never ranked or suggested (D-71).
- **Boundary:** synthetic data only. The engine work waits until the trends work has merged, because both touch the same event, model and drawer files. This authorises no deployment, provider configuration change or spending.
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
- **Boundary:** synthetic data only. This authorises no deployment, provider configuration change or spending.
- **Why:** Josh reviewed the ten mock-ups, made from the current app, and approved them with the recommended answers to their open questions.

## D-78. One decline list for wards and coordinators (22 October 2026)

- **Date:** 22 October 2026 (`2026-10-22`). **Decided by:** Josh, on two decision cards. At 12:04 AM AWST on 22 October (16:04 UTC on 21 October) he chose to merge the ward and coordinator decline lists. At 4:39 PM AWST on 22 October, in the Decline reasons merge thread, he chose "Keep it as a ward-only reason" for Capability mismatch.
- **Decision:**
  1. **One list.** A ward declining a movement and a coordinator declining a referral pick from one decline list, in the coordinator's wording.
  2. **Ward-only reasons stay.** Four clinically distinct reasons are kept for ward declines only: Specialling unavailable, Acuity mix, Bed pulled for earlier referral and Capability mismatch. Capability mismatch is kept because neither Age band not provided here nor Secure bed unavailable fully covers it, for example a ward with no ECT or eating disorder capability.
  3. **Retired ward values map across.** No bed becomes No suitable bed, Sex mix becomes Sex designation unavailable and Out of catchment becomes Belongs to another service. Old saves are converted when they load, so no recorded decline is lost.
  4. **Limits kept.** A ward refusing a movement is still not offered Sex designation unavailable (T10), and an ED decline gets none of the ward-only reasons.
- **Boundary:** synthetic data only. Built in PR #579, which cites D-78 in its code comments. This authorises no deployment, provider configuration change or spending.
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
- **Boundary:** synthetic data only. No Supabase change beyond reading tables that already exist. No new roles, and nothing a coordinator, ward or ED needs is taken away. This authorises no deployment, provider configuration change or spending.
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
- **Status (13 November 2026):** done. The repository Actions policy now allows `pull_request_target` only for `pr-hold.yml`, `bot-author-policy.yml` and `ward-flow-ci-tidy.yml`, set on Josh's PC with his approval before the 16 November brownout.

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
- **Status (13 November 2026):** item 1 is done in part. A repository ruleset, "Live protections", now blocks deleting `live` and force-pushing to it, with no bypass. "Restrict updates" (only the release workflow may move `live`) was not added, because GitHub Actions cannot be a ruleset bypass actor, so that rule would stop the daily release. A rollback needs the ruleset switched off briefly ([OPERATIONS-RUNBOOK.md](OPERATIONS-RUNBOOK.md#rolling-back-the-app), step 4).

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

## D-133. Batch 1 (ED and referral flow): three answers (10 November 2026)

- **Date:** 10 November 2026, 17:02 UTC (1:02 AM AWST on 11 November). **Decided by:** Josh, on three decision cards in the Ward Flow project thread "Build ED and referral flow features", after asking at 17:00 UTC for Batches 1 and 2 of the feature build plan (Claude Doc "Ward Flow feature build plan: 27 chosen items") to begin. That request is his go-ahead for these items despite D-128 item 9. D-140 is in this PR.
- **Decision:**
  1. **Escalation call outcomes (item 3):** a shared record everyone can see (Agreed a plan, No bed, No answer, Left a message), not a browser-only log like the Tools call log.
  2. **Referral not opened yet (item 16):** a sent referral that no ward has opened shows "Not opened yet" after 30 minutes. Signed into clinical-values.md.
  3. **Home team heads-up (item 46):** an open community team episode's team is told the ED name and arrival time only, and nothing for closed episodes. No reason, diagnosis, risk or free text.
- **Why:** item 3 exists to show that escalation was done, which a browser-only log can't; 30 minutes lets a busy ward look before chasing; the home team already holds the open episode.
- **Boundary:** synthetic data only. Item 46 with real data still needs the D-87 privacy review. Approves no merge or release. D-74 still applies to anything drawn.

## D-134. Ward arrival and beds batch: how to hold, advocate line, night list and the feature freeze (10 November 2026)

- **Date:** 10 November 2026, about 1:02 AM to 1:08 AM AWST on 11 November (17:02 to 17:08 UTC on 10 November). **Decided by:** Josh, on two decision cards in the Ward Flow project thread "Build ward arrival and bed features", then "Yes to all recommendations please" to the thread's numbered questions. Numbered D-134 because the numbers before it were taken first. D-133 is claimed by open PR #1606.
- **Decision:**
  1. **Held split:** items 6 (bed closure review time), 7 (plan staffing for an arrival), 13 (overnight intake window) and 18 (left the ward, waiting for transport) go in one PR that may merge once green. Items 4 (young person on an adult ward) and 15 (interpreter, Aboriginal liaison and advocate lines at arrival) go in a second PR with the `hold` label until Josh signs them off.
  2. **Advocate line (item 15):** "Mental Health Advocacy Service told" shows on the arrival checklist for every patient the app already treats as detained, the same group the existing support and advocacy notification checklist covers, and reuses that record.
  3. **Item 4:** nothing is built until Josh gives the legal duty and the exact notice wording.
  4. **Night list (item 13):** a "Tonight's intake windows" card on the Capacity page, beside "Closed beds past review", in the neutral service-then-name order (D-126).
  5. **Feature freeze:** Josh's instruction to begin the feature batches replaces D-128 item 9 for the 27 items he chose on 10 November. Other features stay frozen until #1564 to #1577 close.
  6. **Design review first:** Josh approves the batch's design review page before its PR is opened (D-74, D-107).
- **Addendum, 11 November 2026, about 10:19 AM AWST (02:19 UTC):** Josh wrote "Go ahead with all recommendations now for me" in the project thread "Perfect the ranked feature list", and the same words two minutes later in this batch's thread "Build ward arrival and bed features". They answer this batch's two open cards with their recommended options, and the item 4 design that thread drew:

  7. **Design approval:** the review page for items 6, 7, 13 and 18 is approved as drawn (version 3: "Has their transport come?" is two buttons, not a drop-down).
  8. **ED may record the advocate line (item 15):** ED can record "Mental Health Advocacy Service told" on an accepted move of a detained patient before arrival. The ward sees it and can change it after arrival. It uses the one existing advocacy record.
  9. **Item 4 wording and behaviour (replaces item 3):** the patient card of a patient under 18 on a ward that is not a youth ward shows "Under 18 on an adult ward. Check the Mental Health Act 2014 requirements for a child on an adult ward, including notifying the Chief Psychiatrist." It shows automatically from the date of birth and the ward type. It has one optional typed field, "Chief Psychiatrist notified at", never pre-filled (D-93). Once a time is entered it stays visible but goes quiet. It goes away at 18 or on a move to a youth ward. It never blocks a bed offer and never pre-selects anything. It quotes no section number or time limit, because neither has been verified. It stays in the held PR.

- **Addendum, 11 November 2026, about 11:05 to 11:24 AM AWST (03:05 to 03:24 UTC):** Josh wrote "I approve all your recommendations" in this batch's thread, then "I sign off on everything here" to the project's PR summary, which listed the held PR #1609 as waiting on his sign-off.

  10. **Held items signed off:** items 4 and 15 (#1609) are signed off, so its `hold` label comes off and it may merge once green.
  11. **Legal wording check:** the legal language check lets through only his exact item 4 sentence ("check the Mental Health Act 2014 requirements for a child on an adult ward"). It tells staff to check the Act rather than claiming authority. "2014" stays in the notice.

- **Boundary:** synthetic data only. Information and prompts only: nothing ranks or recommends a ward or bed (D-71), and no clinical value changes. Approves no merge or release.

## D-135. Batch 4, outages and pilot control: pack age and plan answers (10 November 2026)

- **Date:** 10 November 2026 (`2026-11-10`). **Decided by:** Josh, choosing "Older than 24 hours" on a decision card in the Batch 4 thread (17:04 UTC), and saying "Go ahead with all your recommendations" for the feature build plan in the project chat (17:04 UTC). D-132 is claimed by open PR #1601. D-133 is claimed by open PR #1606 (Batch 1). D-134 is claimed by open PR #1608 (Batch 2).
- **Decision:**
  1. **Outage pack age (item 24):** a ward's downtime pack counts as old once its last print or PDF save is more than 24 hours ago (`PACK_OLD_AFTER_MINUTES`, clinical-values.md). The server keeps only the time and ward of each print, never the pack.
  2. **Site switch-off (item 20):** a fixed allow-list says which features can be switched off at one site. Safety notices, legal times, ruling guards, role access, the AWOL bed hold review, ward closure and the demo reset can never be switched off.
  3. **Catch-up after an outage (item 25):** a prompt only. It starts when the coordinator types "We were down from __ to __", nothing is filled in or guessed from the device, and a ward is caught up only when it confirms "Beds still correct" after the outage ended.
- **Boundary:** the screens for items 20, 24 and 25 wait for Josh's approval of the Batch 4 design review (D-74). Until he rules on D-80, only the statewide coordinator can switch a site feature. Synthetic data only. Approves no merge or release.

## D-136. Feature batch 3 (shift change and follow-up): two signed values (10 November 2026)

- **Date:** 10 November 2026 (`2026-11-10`). **Decided by:** Josh, on two decision cards in the batch 3 build thread, and "Go ahead with all your recommendations" on the feature build plan the same day. Numbered D-136 by the coordinator's allocation. D-133 is claimed by PR #1606. D-134 is claimed by PR #1608. D-135 is claimed by PR #1603.
- **Decision:**
  1. **Diversion return (item 28):** a person offered an alternative to admission (D-110) who returns to ED within 7 days prompts the team that took them to review. Signed as `diversionReturnReview`.
  2. **End-of-shift handover (item 21):** the handover page lists your own open work, with "Hand to", once the shift has 30 minutes or less to run. Signed as `handoverOwnWorkLead`.
  3. **Batch scope:** batch 3 builds items 11, 12, 21, 22, 23 and 28 of the feature build plan. Josh's go-ahead on the plan, given after D-128 item 9, starts these features while #1564 to #1577 are still open.
  4. **Design approved (11 November 2026):** the batch 3 design review page (six screens, D-74) is approved as built, by Josh's "go ahead with all your recommendations" relayed to this thread.
  5. **D-14 allowlist (11 November 2026):** `community/diversion-return-review.ts` joins the patient-link allowlist. It compares ids only, for one referral this team took and a later ED request, and shows the team that person's link and two times.
  6. **Item 21 placement (11 November 2026):** the "Your open work" list sits at the top of the Handover page.
- **Boundary:** synthetic data only. Both values are prompts: neither blocks sign-out, ranks a person or judges the alternative. Approves no merge or release.

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

- **Date:** 10 November 2026 (`2026-11-10`). **Decided by:** Josh, picking item 23 of the audit fix build plan (Ward Flow project thread "Fix audit app and backend issues", audit fix group 2), which counts as his yes to audit decision 20. Numbered D-138 because D-132 to D-137 belong to other threads. D-133 is claimed by open PR #1606. D-135 is claimed by open PR #1603, and D-136 is claimed by open PR #1605, and D-137 is claimed by open PR #1607. On 11 November 2026 Josh told every thread to go ahead with its recommendations, which approved the Settings line as drawn in the design review.
- **Decision:** act-now phone alerts stay high urgency and buzz again when replaced. Jobs and team alerts go out at normal urgency and replace their earlier alert quietly. Settings shows when this device last received an alert, from the time only (never the alert's words).
- **Boundary:** synthetic data only. Changes no signed clinical value or clinical rule, and approves no merge or release.

## D-139. Phone Statistics ward list A to Z, and leave return times as typed (10 November 2026)

- **Date:** 10 November 2026 (`2026-11-10`), about 1:08 AM AWST on 11 November (17:08 UTC). **Decided by:** Josh, in the Ward Flow project. Item 1: launching audit fix group 3 ("Also launch group 2 and group 3 please"), which counts as his yes to audit decision 4. Item 2: choosing "Yes, typed time only" on a decision card in the thread "Fix held clinical audit items", and "Yes to all recommendations please" in the project chat. D-135 is claimed by open PR #1603. D-136 is claimed by open PR #1605. D-133 is claimed by open PR #1606. D-137 is claimed by open PR #1607. D-134 is claimed by open PR #1608.
- **Decision:**
  1. **Phone Statistics, "By ward" list** (audit fix list item 9): A to Z by ward name, with every count kept. It extends D-126 to a list that review did not cover. The "By hospital" list is unchanged.
  2. **Leave return times** (item 26, audit A1-06): leave and medical trip return times follow D-93. They show only as the time the ward typed ("Due back 15:40 tomorrow", "Typed by the ward"), and once that time has gone by, "That time has passed" with the warning colour. Nothing is worked out from it: no "Overdue by 2h" or "In 3h" on the Patient page status card, and the Patient summary's second figure reads "Passed" or "Not yet" under "Typed time" instead of "Overdue 2h" or "From now 3h". `tests/ward-legal-as-typed-guard.test.ts` fails if a duration formatter takes a leave return time again.
- **Unchanged:** the time absent without leave still shows as a running figure, because it counts from when the absence was recorded, not from a typed return time. Leave lists still order by return time.
- **Why:** a list that puts the most ready beds first reads as "send them here" (D-126). A return time comes from the leave form, which staff read against paper; a running figure beside it is a second, unchecked number, the reason D-93 exists.
- **Boundary:** D-71 and D-93 stand. Order and wording only; no figure, clinical value or rule changes. Synthetic data only. Approves no merge or release.

## D-140. Feature list adopted, and Wave 1 begins (10 November 2026)

- **Date:** 10 November 2026, 10:09 PM AWST (14:09 UTC). **Decided by:** Josh, in the Ward Flow project thread "Perfect the ranked feature list": "Go ahead with all your recommendations", answering the six questions in the reviewed feature list (Claude Doc "Ward Flow feature list: reviewed and re-ranked", 10 November 2026). Numbered D-140 because D-132 to D-139 were taken first; D-133 is in the same PR. D-134 is claimed by open PR #1608. D-135 is claimed by open PR #1603. D-136 is claimed by open PR #1605. D-137 is claimed by open PR #1607. D-139 is claimed by open PR #1600.
- **Decision:**
  1. **Working list:** the reviewed list (39 build items in four waves, pilot items P1 to P3, ruling items R1 to R6) replaces the order in the 10 November feature handover. Each item is re-checked against `main` before it is built.
  2. **Two-point ID:** rows, cards and toasts on signed-in screens show age and sex as recorded and the full UMRN beside the full name, the same UMRN format as D-113, and mark same-name clashes on a list. Never on the wall TV. Built in a held PR, after PR #1599.
  3. **A person under 18 placed on an adult ward:** treated as clinical. Nothing is built until Josh gives the legal duty and wording.
  4. **Left the ward, waiting for transport:** the bed counts as Ready as soon as the ward marks the person gone. There is no cleaning step; "Bed cleaned tap" stays on the do-not-build list.
  5. **Wave 1:** items 1 to 7 are built in one thread, starting with the role-scope count leak (item 1); items 2 and 4 go in that thread's one held PR.
  6. **Bed round:** wards stay in the fixed order (D-126); wards that have not answered "Please confirm your beds" get a tag and a filter, and are not moved to the top.
- **Why:** the code check found several listed items already built, and six needed changes to stay within D-71, D-113, D-126 and the do-not-build list.
- **Boundary:** synthetic data only. Changes no signed clinical value; approves no release. D-74 still applies to anything drawn.

## D-141. Batch 1 (ED and referral flow) design approved, with eleven answers (11 November 2026)

- **Date:** 11 November 2026, 02:19 UTC (10:19 AM AWST). **Decided by:** Josh, in the Ward Flow project thread "Build ED and referral flow features": "Approve all your recommendations", answering the eleven questions on the Batch 1 design review page (artifact "Batch 1 design review", v1). D-133 and D-140 are in the same PR.
- **Decision:**
  1. **Design:** Batch 1 (items 3, 9, 10, 16, 26, 27 and 46) is approved as built (D-74).
  2. **New features:** Josh's request to begin Batches 1 and 2 (10 November, 17:00 UTC) overrides D-128 item 9 for Batch 1.
  3. **Who to call:** desktop and tablet only; phone shows no wait step, so it has no link.
  4. **Step 1 contact:** the service bed coordinator, as one contact, rather than each ward's nurse in charge.
  5. **Escalation record:** keeps only the latest call outcome for each step.
  6. **Privacy guard:** D-133 covers the home team heads-up's one extra reader of the patient link in the D-14 guard.
  7. **Open episode:** the patient record's community list stands in for a stored community episode until one exists.
  8. **Demo seed:** one unopened referral to a named ward and one with a ward's ask are added, so items 10 and 16 show without set-up.
  9. **Brought by:** a new ED arrival can be marked "Brought by: Police" or "Ambulance", nothing pre-selected, so crew times can be recorded for it.
  10. **Crews line on Home:** one total line across departments, not one per department tile.
  11. **Heads-up identity:** the home team heads-up shows the UMRN, and still no name, reason, diagnosis, risk or free text.
- **Also fixed:** the white strip between the ED board's hero and its Board tabs (Josh's screenshot, 11 November 2026).
- **Boundary:** synthetic data only. Changes no signed clinical value. Item 46 with real data still needs the D-87 privacy review. Approves no release.

## D-142. Batch 4: design review and all twelve answers approved, D-80 amended for site features (11 November 2026)

- **Date:** 11 November 2026 (`2026-11-11`). **Decided by:** Josh, writing "Go ahead with all recommendations now for me." in the Batch 4 thread (02:21 UTC), and confirming in the project chat that every thread should go ahead with all its recommendations (02:22 UTC). D-136 is claimed by open PR #1605, D-138 is claimed by open PR #1604 and D-139 is claimed by open PR #1600. D-140 and D-141 are claimed by open PR #1606 (Batch 1). D-137 is claimed by open PR #1607 (Batch 5).
- **Decision:**
  1. **Design review (D-74):** the Batch 4 screens are built as drawn in the review page.
  2. **Site switch-off (item 20):** the allow-list holds five features (bed meeting TV, Top 25 criteria-led discharge, referral opened receipts, referral information needs and Help ask). The card "Features at this site" sits in the access admin's Access tab. One tap switches a feature, with Undo.
  3. **D-80 amended:** the access admin may switch site features as well as the statewide coordinator. Protected features still cannot be switched off by anyone.
  4. **Pack age (item 24):** the old-pack list lives on the Downtime screen, with a pointer on Home. A ward that has never printed is listed as old. Print times may sit in the device's cleaned copy of the state.
  5. **Catch-up (item 25):** the outage start is a blank Today or Yesterday choice. Each bed not confirmed since the outage shows "Not confirmed since the outage" in full. Catch-up starts only after the coordinator records the outage, and only the ward's own confirm counts.
- **Later the same day (04:13 UTC):** Josh chose "Mark ready now" on a decision card, so this PR was marked ready past the five-PR cap.
- **Boundary:** synthetic data only. Approves the screens and the D-80 amendment only; no release.

## D-143. MHERT is MHERL in the glossary; SMHMR deferred (11 November 2026)

- **Date:** 11 November 2026, 10:45 AM AWST (02:45 UTC). **Decided by:** Josh, in the Ward Flow project thread "Run the remaining master list audits": "MHERL (mental health emergency response line) and defer SMHMR as I don't know what that is", answering the D-131 open item. D-139 is claimed by open PR #1600. D-140 is claimed by open PR #1606. D-141 is claimed by open PR #1606. D-142 is claimed by open PR #1603.
- **Decision:**
  1. **MHERT:** the term is MHERL, the Mental Health Emergency Response Line, which the glossary already lists. The MHERT glossary entry is removed, and the two synthetic community demo lines now read "MHERL / WA Police co-response".
  2. **SMHMR:** its meaning is deferred. The existing glossary wording stays until Josh confirms it.
- **Boundary:** wording only; no clinical behaviour change.

## D-144. Chip rows move only sideways on a phone (11 November 2026)

- **Date:** 11 November 2026 (`2026-11-11`). **Decided by:** Josh, on a decision card in the Ward Flow project thread "Stop chip rows dragging up and down", choosing "Lock rows to sideways only" over measuring on his iPhone first. Numbered D-144 because D-133 to D-143 belong to other threads. D-140 is claimed by open PR #1606, and D-141 is claimed by open PR #1606. D-142 is claimed by open PR #1603.
- **Decision:** on a phone, the page-top quick-link chip rows, the Home quick bar, the shared phone chip row and Home's "Waiting in ED" strip take `touch-action: pan-x`. A finger on one of these rows can only move it sideways. The accepted trade-off is that a vertical swipe starting on one of these rows does not scroll the page. Reason: iPhone still slid the rows up and down after three layout fixes (#1596, #1602, #1610), and the cause could not be reproduced off the device.
- **Boundary:** presentation only, synthetic data. Changes no clinical value or rule, and approves no merge or release.

## D-145. Repository review: fixes, features and code health approved (11 November 2026)

- **Date:** 11 November 2026 (`2026-11-11`). **Decided by:** Josh, in the Ward Flow project thread "Review repository for issues and new features": "Go ahead with all these recommendations please" (03:55 UTC), answering the review doc "Ward Flow repository review, 11 November 2026". Numbered D-145 because D-133 to D-144 belong to other threads. D-139 is claimed by open PR #1600, D-140 is claimed by open PR #1606, D-141 is claimed by open PR #1606, D-142 is claimed by open PR #1603, D-143 is claimed by open PR #1612, and D-144 is claimed by open PR #1617.
- **Decision:**
  1. **Clinical display fixes, one held PR:** a ward's expected occupancy no longer counts a patient twice when they hold a named bed and also have a booked planned admission to that ward; an ended legal form says it ended and gives the expiry only as it was typed; the ED screen flags a long wait at 24 hours or more, like every other screen.
  2. **Non-clinical fixes:** one lapse check for pull holds, staff requests keep the shift the person chose, one reader for typed times, one length-of-stay calculation, a demo code shorter than 12 characters counts as no code (added after PR #1615 merged; spaces and dashes not counted), and a demo pass stops working when the code changes. Two lines added to the real-data go/no-go list (record ids never built from UMRNs; a check of the push library).
  3. **Features that finish existing screens** (not covered by the D-128 item 9 pause): Leave page links, print and entry point; Help for pages that had none; print and spreadsheet export on Legal forms and Movements. Triage risk reviews due waits until #1564 to #1577 close and needs its own clinical sign-off.
  4. **Code health:** the file line cap counts code lines, not comments or blank lines; one shared CI setup step; shared helpers for the forked side rail; reasons or fixes for unexplained React hook rule switch-offs; patch-level dependency updates.
  5. **Josh's own action:** turn off Supabase open sign-up before real data. Done 14 November 2026 (see D-173).
- **Screens approved (11 November 2026, 05:46 UTC):** after the design review page "Leave and export review", Josh chose "Yes, add them" on the decision card. This approves the item 3 screens and two new patterns: an icon-only Print button on phones, and the Export status line hidden until it has something to say (this affects every list with Export).
- **Clinical sign-off (11 November 2026, 05:51 UTC):** Josh wrote "I approve all of them to remove labels" in the thread "Get all open PRs merged", approving the item 1 fixes in PR #1621 as built, including the Legal forms wording "Form ended; expiry as typed was HH:MM".
- **Why:** findings from the 11 November review, each checked against source; the clinical items were display bugs, not changes to signed values.
- **Boundary:** synthetic data only. Changes no signed clinical value; clinical items merge only after Josh checks the held PR. Approves no release.

## D-146. Performance audit fixes and the phone speed target (11 November 2026)

- **Date:** 11 November 2026 (`2026-11-11`). **Decided by:** Josh, in the Ward Flow project thread "Audit Ward Flow performance" ("Go ahead with all the issues and fixes for all the findings please", 03:55 UTC), approving every recommendation in the performance audit report. Numbered D-146 because D-139 to D-144 are claimed by open PRs #1600, #1606, #1603, #1612 and #1617, and D-145 is claimed by open PR #1623 (the repository review thread).
- **Decision:** build the audit's fixes for screen redraws, phone first-load size, database round trips, indexes and CI time in one PR. The phone speed target (M84) is: a screen usable within 3 seconds, with under 0.3 seconds of main-thread blocking after first paint, on a mid-range phone over 4G (measured as Chromium at 4 times CPU slowdown). CI unit shards may start after the static checks instead of after the production build, replacing the 4 November "cheap first" ordering for that one job. Read-only GitHub reads of CI run times, and the D-111 shift-change load test against a hosted synthetic database, are approved. The triage "days since discharge" Perth-date finding needs no change: PR #1599 (D-129) already counts it on the Perth clock. Data retention stays with the existing BE-008 register item; this ruling sets no retention period.
- **Boundary:** synthetic data only. Changes no signed clinical value or clinical rule, and approves no merge into `main`, release or migration on a hosted database beyond the normal PR flow.

## D-147. Demo-code tries keep per-address keying until a trusted proxy is set (11 November 2026)

- **Date:** 11 November 2026, 2:37 PM AWST (06:37 UTC). **Decided by:** Josh, on a decision card in the Ward Flow project thread "Get all open PRs merged", choosing "Add a safe fallback, then merge" for PR #1615 (A4-02). Numbered D-147 because D-145 and D-146 belong to other threads. D-145 is claimed by open PR #1623. D-146 is claimed by open PR #1624.
- **Decision:** while `WARD_TRUSTED_PROXY_ADDRESSES` names no proxy on the Next service, the front door's demo-code try limit keeps keying on the edge's `X-Real-IP`, else the last `X-Forwarded-For` hop, as it did before A4-02. Once it names a proxy (or `*`), A4-02's trusted-proxy rule applies. Reason: the Next session route has no socket address, so the strict rule alone would put every caller in one shared bucket, and ten wrong tries from anyone in ten minutes would refuse every presenter.
- **Boundary:** no Railway or environment change; setting `WARD_TRUSTED_PROXY_ADDRESSES` stays a separate, approved provider action. The fallback logs nothing. Synthetic data only; changes no clinical value or rule, and approves no release.

## D-148. Closing a bed stays one tap, and its toast offers a reason (11 November 2026)

- **Date:** 11 November 2026. **Decided by:** Josh, approving every recommendation in the "Ward Flow live audit: verified findings and fix plan" (decision item 4) after fact-checking: "Go ahead with all recommendations after fact checking please". Numbered D-148 because D-145 is claimed by open PR #1623. D-146 is claimed by open PR #1624. D-147 is claimed by open PR #1615.
- **Decision:** "Close this bed" in the bed drawer still saves on one tap with Undo (the 26 October fast-workflow choice). No confirm step is added. Its toast now offers "Add a reason", a kit menu of the existing ward closure reasons (`WARD_CLOSURE_REASONS`). Choosing one undoes the close and closes the bed again with that reason, so the reason is chosen, never typed, and the audit trail keeps both steps (the bed's History shows the closure with its reason).
- **Why:** the live audit found closures with no reason; a reason helps the bed meeting without slowing the close.
- **Boundary:** synthetic data only. No engine rule changes: `SET_BED_CLOSED` already took an optional reason.

## D-149. A record whose only links are withdrawn referrals can be archived (11 November 2026)

- **Date:** 11 November 2026. **Decided by:** Josh, approving decision item 9 of the live audit fix plan, as for D-148. This gives the 26 October rule (#816: "archive only, coordinator only, for records added in error") its D-number.
- **Decision:**
  1. Archiving stays coordinator only, for a record added in error, and still never destroys anything.
  2. A record can now be archived when the only things naming it are front-door referrals that nobody answered (every destination withdrawn by the referrer or cancelled), audit rows, and Undo records older than the Undo window. Any journey, stay, form, bed record, answered or open referral, or fact recorded on the person still keeps the record. The withdrawn referral stays in the history but no longer links to the archived record.
  3. The coordinator's "Record added in error" card no longer hides when archive is not available. It says why in one line.
- **Why:** the live audit's test patient could never be archived because a withdrawn referral and record-view audit rows named it, so test and mistaken records stayed on the board for good.
- **Boundary:** synthetic data only. Archiving the live audit's test patient and the old TEST-Helper4 records is a live write that waits for Josh's yes after release.
- **Done (14 November 2026):** on the live signed-in site, PT-A06 (ZZAUDIT-1111) and both TEST-Helper4 records (UMTEST4001 and TESTH4001) were archived as "Test record" with the app's own archive control.
- **Note (11 November 2026, 15:34 UTC):** Josh approved, on a decision card in the Ward Flow project thread for PR #1626, adding `ward-patient-archive-reducer.ts` to the D-14 patient-link allowlist (60 to 61 files). The archive step reads `referral.patientId` only to unlink that one record's withdrawn front-door referrals; it reads no other referral and shows nothing.

## D-150. The signed-in site runs on real Perth time (11 November 2026)

- **Date:** 11 November 2026. **Decided by:** Josh, approving decision item 5 of the live audit fix plan, as for D-148.
- **Decision:** the shared world's clock is the real minutes since its day zero (a Perth midnight). A new world's seed is re-anchored onto that time, as the public demo already does (`ward-reanchor.ts`). The scripted clock that starts at 10:42 stays on the public demo only, and the advance-clock controls are hidden on the signed-in site.
- **Why:** the shared clock started at 10:42 whenever the world was made, so the board, labelled AWST, ran about 48 minutes fast all day.
- **Note:** an existing shared world's clock steps back once by that gap when this is released, so steps recorded in the last 48 minutes before the release briefly read as a little in the future.
- **Boundary:** synthetic data only. No clinical rule or signed value changes.

## D-151. A bed tile says when a change is waiting to save (11 November 2026)

- **Date:** 11 November 2026. **Decided by:** Josh, approving decision item 3 of the live audit fix plan, as for D-148.
- **Decision:** the privacy rule stands (D-18, D-72, D-124): a save waiting on the signed-in site is held in this page's memory only, never on the device. The ward bed tile now says "Waiting to save" while a save for that bed is waiting. The browser's warning before the page closes or reloads with a save waiting was already in place (since 23 October), so it is unchanged.
- **Why:** the live audit closed a bed offline and the tile still read "Ready", with nothing on it to say the change had not gone.
- **Boundary:** presentation only, synthetic data. Nothing new is stored on the device.

## D-152. Returned to ED prompt sees every return in shared mode (11 November 2026)

- **Date:** 11 November 2026 (`2026-11-11`). **Decided by:** Josh, "Yes go ahead with all recommendations" in the Ward Flow project thread "Show every ED return in shared mode", approving the follow-up the batch 3 thread recorded on PR #1605. Numbered D-152 because D-145 to D-151 belong to other threads. D-145 is claimed by open PR #1623. D-146 is claimed by open PR #1624. D-148 is claimed by open PR #1626. D-149 is claimed by open PR #1626. D-150 is claimed by open PR #1626. D-151 is claimed by open PR #1626.
- **Decision:** the item 28 "Please review: returned to ED" prompt (D-136 item 1) now sees a return in shared mode even when the later ED request is not in the community desk's copy. When the server cuts a community team desk's copy (`scopeWardFlowState`), it finds that team's returns in the whole workspace and sends `diversionReturns`: for each one, the id of a referral the desk is already sent and the time back in ED. The browser rebuilds the prompt from its own copy of that referral, so the desk learns one time and nothing else.
- **Role access, kept narrow:** only a community desk scoped to one team receives `diversionReturns`, and only for referrals it took and is already sent. Ward, ED, officer, admin, executive and service coordinator copies never carry them. A statewide coordinator already holds the whole workspace. The record names no ED, movement or person, carries no typed text, and the reducer never writes it. A shared copy whose return names a referral the desk was not sent fails the shared-state check.
- **D-14:** no new patient-link reader. The match still runs in `community/diversion-return-review.ts`, which D-136 item 5 allows.
- **Boundary:** synthetic data only. A review prompt only, as D-136. Changes no signed clinical value or rule, and approves no merge or release.

## D-153. Keep the drawn-time settle check, and defer a separate agent GitHub identity (11 November 2026)

- **Date:** 11 November 2026, 11:41 PM AWST (15:41 UTC). **Decided by:** Josh, "Yes to all recommendations" in the Ward Flow project chat, answering the coordinator's list of five open questions. Two of those answers are rulings and are recorded here. The community desk ED heads-up answer is still unclear and will be recorded separately. The uptime monitor secrets and the GitHub and Railway settings are tasks for Josh, not rulings.
- **Decision:**
  1. **Phone release gate settle check:** the shared helper `waitForAccessibleReadiness` (`tests/helpers/ward-release-gate.ts`, changed in PR #1607) stays as it is. It counts a 100 ms tick against its 5-second settle budget only when the browser drew a frame in that tick, or while fonts load. A cold WebKit page held by D-137 can pause drawing after its first frame. Finite motion, or geometry that keeps changing while the browser draws, still fails after 5 seconds, and the test timeout still bounds a renderer that never recovers. The helper ignores infinite animations and the running Undo availability bar, so those can carry on while the page settles.
  2. **A9-01, a separate GitHub identity for the agents:** deferred until after the pilot. Agents keep publishing as they do now.
- **Boundary:** synthetic data only. Changes no clinical value or rule, weakens no release gate check, and approves no merge, release or settings change.

## D-154. The community desk's ED heads-up reads a narrow scoped list (11 November 2026)

- **Date:** 11 November 2026 (`2026-11-11`). **Decided by:** Josh, choosing "Yes, in a follow-up PR" on a decision card in the Ward Flow project thread "Batch 1: ED and referral flow", then "Yes I approve" in the project chat (15:43 UTC) when asked again whether to build it. Numbered D-154 because D-153 belongs to the counts thread's docs PR and D-145 to D-152 belong to other threads.
- **Decision:** the item 46 "Your patients in ED" card (D-133, D-141) now works on a community team desk. That desk's movements hold only the journeys its own referrals touch, so the card was empty there. When `scopeWorkspace` cuts a community team desk's view, it now finds that team's open-episode patients who are in an ED in the whole workspace, and adds `communityEdArrivals` beside the scoped records. The card reads that list on a community desk and its own movements anywhere else.
- **Role access, kept narrow:** each item is the UMRN, the ED's name and the time the stay was recorded, keyed by the journey id, and nothing else. The ED journey and the person's record stay out of the desk's movements and patients. Only a community desk scoped to one team gets the list; every other desk's view has none.
- **Episode list:** the mock-up community episodes' team and status moved to `patients/community-episode-teams.ts`, the one place they are typed. The patient record mock-ups spread them in. That keeps the record mock-ups out of the shared access code.
- **Not covered:** shared mode. A shared community desk's copy comes from the server's `scopeWardFlowState`, which does not send this list yet, so the card stays empty there, as before. Sending it the way D-152 sends `diversionReturns` is a separate change.
- **Boundary:** synthetic data only. Display only. No event, stored field or signed clinical value changes, and this approves no merge or release.

## D-155. Check the live clock offset before clearing it (11 November 2026)

- **Date:** 11 November 2026 (`2026-11-11`). **Decided by:** Josh, "Go ahead with all recommendations" in the Ward Flow project thread for PRs #1622, #1623 and #1626, choosing the recommended option on the decision card about the live world's clock offset. Numbered D-155 because D-153 and D-154 belong to other threads, and both are recorded above (PR #1630 and PR #1632).
- **Decision:** D-150 keeps `clockOffsetMinutes` on purpose, because test servers use it to move the clock. After this PR is released, the live shared world's stored offset is read once, read-only, and reported to Josh. If it is not 0, nothing is written: clearing it is a live write that waits for Josh's own yes.
- **Why:** under D-150 a leftover offset would keep the signed-in site's clock ahead of real Perth time by that amount. Reading the value is harmless, and Josh decides on the live write once the number is known.
- **Boundary:** synthetic data only. No code change, and no live write is approved. Changes no clinical rule or signed value, and approves no merge or release.

## D-156. Reset the synthetic live world after the clock fix (11 November 2026)

- **Date:** 11 November 2026 (`2026-11-11`). **Decided by:** Josh, choosing "Reset the synthetic live world" on the decision card in the Ward Flow project thread for PR #1626 (18:07 UTC), about the times stored before D-150's clock change.
- **Decision:** after PR #1626 is released, the live shared world is reset to a fresh synthetic seed, so every stored time is on the new clock. Its current demo history goes, PT-A06 and TEST-Helper4 included, which also covers the D-149 archive of those records. This supersedes D-155's "clearing it waits for Josh's own yes": the reset clears any stored clock offset as well, so no separate offset write is needed. D-155's text stands as recorded.
- **Why:** the live world holds synthetic data only, so a reset is the simplest fix. It leaves no lasting skew from D-150's clock change: without it, times stored before release stay about 48 minutes ahead of the new clock, so waits recorded before release read short and an expired Undo could briefly come back.
- **Boundary:** synthetic data only. No code change in this PR. The reset is one live write, made by this thread after release, not by CI. Changes no clinical rule or signed value, and approves no merge or release.
- **Withdrawn (12 November 2026):** Josh withdrew the post-release reset of the live synthetic shared world on 12 November 2026 (`2026-11-12`). No reset happens without a verified pre-reset backup and a tested restore, plus a fresh yes from Josh. D-149's after-release archive of PT-A06 and TEST-Helper4 is restored: that live write still waits for Josh's yes. D-155 stands as recorded: after release, the live world's stored clock offset is read once, read-only, and reported; any clear of that offset is a live write that waits for Josh's yes. This entry's 11 November decision to reset after release is withdrawn and does not supersede D-149 or D-155.

## D-157. Legal forms Print and Export include people admitted on a form (12 November 2026)

- **Date:** 12 November 2026, 8:44 AM to 8:45 AM AWST (00:44 to 00:45 UTC). **Decided by:** Josh, ruling on the two open review threads on PR #1623. Numbered D-157 because D-145 through D-156 are already on main (D-148 to D-156 arrived with PR #1626; D-156 is withdrawn but the number stays taken).
- **Decision:** Legal forms Print, Export and the disabled condition for those buttons include the "Admitted on a form" people together with the open-movement rows, using the same `admitted` set as the on-screen admitted list (the same role filter). Highlights do not narrow the export. Print is `window.print()` of the current page, so that admitted group also shows on the Checklist view, not only On a form (clocks), and a Checklist print includes those people.
- **Boundary:** synthetic data only. No signed clinical value or clinical rule. Approves no merge or release.

## D-158. A This-shift staff request is refused once that shift has ended (12 November 2026)

- **Date:** 12 November 2026, 8:44 AM to 8:45 AM AWST (00:44 to 00:45 UTC). **Decided by:** Josh, ruling on the two open review threads on PR #1623. Numbered D-158 because D-157 records the Legal forms ruling from the same answers, and D-155 and D-156 are already on main via PR #1626.
- **Decision:** A `this_shift` staff request whose chosen shift has already ended is refused, using the Staff needed sheet's existing save error, with the reason "This shift has already ended. Choose this shift or next shift again". "Next shift" late-save behaviour is unchanged: a Next-shift request that lands just after the shift changes is still kept.
- **Boundary:** synthetic data only. No signed clinical value or clinical rule. Approves no merge or release.

## D-159. Fixes from the 10 to 12 November PR review (12 November 2026)

- **Date:** 12 November 2026, 12:04 PM AWST (04:04 UTC). **Decided by:** Josh, "Yes to all" in the Ward Flow project thread "Review recent PRs for design regressions", answering its three numbered questions: fix the review's findings in one PR, keep v6's quick-link chip rows as the rule, and refresh the master design's Home and Ward tabs from main.
- **Decision:**
  1. **Page header rule:** a page top has at most one on-hero button, the next step's light button, plus one row of quick-link chips under it that scrolls sideways on a phone (page tops v6, D-116). DESIGN-SYSTEM.md says so in place of "one on-hero action".
  2. **New referral chip:** phone-only on the ward top, as D-116 says; off the phone the bar's New menu is the way in.
  3. **Chip rows (D-144 follow-up):** a sideways chip row still never slides up and down, but a finger that starts on it scrolls the page (`touch-action: pan-x pan-y`, `overflow-y: hidden`).
  4. **Home's Waiting in ED strip on a tablet:** cells keep their whole words and the strip scrolls sideways when the departments do not fit.
  5. **The other review findings** are fixed as recommended: eight rows then Show more on the new lists, Leave on the band hero, one phone rule for Print and Export, kit control sizes, shorter transport choices, honest outage catch-up labels, one ready count (D-115), one ended-form wording, the uptime issue raised before the run fails, a trusted proxy list other than `*` ignored, and Home's loading cards no longer hiding the page.
  6. **MHERL wording:** the synthetic community example reads "joint assessment with the WA Police co-response team, referred through MHERL", so the phone line refers rather than attends. Josh may reword it.
- **Boundary:** synthetic data only. No signed clinical value, time limit or clinical rule changes. Approves no release.

## D-160. A trusted proxy list of plain addresses falls back to per-address keying (12 November 2026)

- **Date:** 12 November 2026, 7:56 PM AWST (11:56 UTC). **Decided by:** Josh, "Keep it as is" on the decision card in the Ward Flow project thread "Review recent PRs for design regressions", answering CodeRabbit's security note on PR #1637.
- **Decision:** when `WARD_TRUSTED_PROXY_ADDRESSES` lists plain addresses rather than `*`, the demo-code limit ignores the list with one warning and keys wrong tries per address as D-147 does. It does not fall back to one shared bucket, because ten wrong tries from anyone would then lock out every presenter.
- **Accepted risk:** someone who can forge a forwarding header could avoid the 10-wrong-tries limit for one address. The network-wide cap of 200 wrong tries per 10 minutes still applies. The live sites use `*`, so the setting is not used there.
- **Boundary:** synthetic data only. Changes no setting on Railway and approves no release.

## D-161. Home's changes-since strip is one line (12 November 2026)

- **Date:** 12 November 2026, 9:39 PM AWST (13:39 UTC). **Decided by:** Josh, "Build option A" in the Ward Flow project thread "Tidy the Since the shift started strip", after the mock-up showed options A and B at 390, 820, 1280 and 1440 in light and dark. Numbered D-161 because D-159 and D-160 arrived with PR #1637.
- **Decision:** Home's "since" strip (feature 40) stays on one line at every width. It leads with "This shift" before any review and "Since 15:02 yesterday" after one, drops "new" from each count, sets each figure in mono, names three counts where the line is wide and fewer where it is narrow (one on a phone), and ends with "+N more" matching what is hidden. Screen readers hear the whole sentence with every count. The card, the Review button and the sheet it opens are unchanged.
- **Not decided:** Josh did not answer the two follow-up questions (put escalations first; leave movements off the line), so the count order and the counts shown are unchanged.
- **Boundary:** synthetic data only. No clinical rule changes. Approves no release.

## D-162. Fixes from the 12 November whole-site component review (12 November 2026)

- **Date:** 12 November 2026, 11:25 PM AWST (15:25 UTC). **Decided by:** Josh, "Yes go ahead with all recommendations" in the Ward Flow project thread "Review every site component for issues", answering its two numbered questions.
- **Decision:**
  1. **One fix PR:** the review's findings 2 to 26 are fixed as recommended in one PR. These include a retry on every lazily loaded part so Try again recovers, demo Accept and Decline on the community waiting list that act (with Undo), no unwired triage buttons, visible error lines for failed saves, a kit focus ring in the seclusion dialog, "Showing N of M" lines where a list is cut short, named bed board tiles, a pausable bed meeting TV view, keyboard and screen-reader fixes across the kit and screens, rem breakpoints, lighter cross-tab sync and saving, a capped saved audit trail, timers that pause in hidden tabs, hover shading only on devices that hover, and 24px phone tap areas.
  2. **Phone bundle (finding 1):** the build is measured first, then the demo data and less-used logic load after first paint where that is safe. This is in the same PR (Josh, "go ahead with all recommendations").
  3. **Saved audit trail (finding 22):** not capped. Trimming the saved copy would break restore, Today's review counts and the audit trail itself, and the existing "storage unavailable" notice already tells staff when saving stops. Josh agreed at 12:58 AM AWST on 13 November (16:58 UTC on 12 November), "I agree with your recommendations".
  4. **Open-tab sync (finding 13):** narrowed. Each tab keeps its own saved day, so the whole day still travels between tabs. The receiving tab now skips the double comparison when the worlds clearly differ, and it no longer redraws every clock view on each message.
- **Boundary:** synthetic data only. No signed clinical value, time limit or clinical rule changes. Approves no release.

## D-163. Pre-demo audits use the public demo after D-162 is live (12 November 2026)

- **Date:** 12 November 2026, 11:39 PM AWST (15:39 UTC). **Decided by:** Josh, "Yes to all recommendations" in the Ward Flow project thread "Write pre-demo audit prompts", answering its three numbered questions. Numbered D-163 because D-162 is claimed by open PR #1639.
- **Decision:**
  1. **Site to show:** the health service demonstration uses the public demo (state kept on the device, with Reset demo), not the signed-in shared site. The shared world still holds the PT-A06 and TEST-Helper4 test records, and clearing them stays a live write that waits for Josh's yes (D-149, D-156).
  2. **Timing:** the pre-demo audit prompts run after PR #1639 (D-162) has merged and reached `live`, so they do not re-find its fixes.
  3. **Public demo walk:** the demo rehearsal prompt may do one read-only walk of the public demo address, using on-screen controls only. It never signs in to the shared site, writes to the live world or calls another provider.
- **Boundary:** synthetic data only. No code, clinical rule or signed value changes. Approves no live write, release, hosted CI run or other provider action.

## D-164. Home's changes-since strip names escalations first and leaves movements off (12 November 2026)

- **Date:** 12 November 2026, 11:27 PM AWST (15:27 UTC). **Decided by:** Josh, "Go ahead and fix all recommendations" in the Ward Flow project thread "Tidy the Since the shift started strip", answering the two follow-up questions left open by D-161. Numbered D-164 because D-162 is claimed by open PR #1639.
- **Decision:** the strip's counts run escalations, delays, referrals, beds freed, then acceptances withdrawn, discharge dates moved and records updated, so a phone line, which names one count, shows an escalation when there is one. New movements are left off the line and stay in the Review sheet; when movements are the only change, the line names them so Review stays reachable from Home.
- **Boundary:** synthetic data only. Changes no clinical rule, only the order and choice of counts on one line. Approves no release.

## D-165. The patient screen is a dashboard grid on every tab (13 November 2026)

- **Date:** 13 November 2026, 5:21 AM AWST (12 November, 21:21 UTC). **Decided by:** Josh, "Yes, open the PR" on the card "Approve version 2 of the patient screen so I can open the PR?" in the Ward Flow project thread "Redesign the patient screen". He had asked for the screen to be overhauled so the Now cards stop stretching across the page, saw version 1, said the History figure strip looked better as it was and gave free rein for a visual upgrade, then approved version 2 as shown at 390, 820, 1280 and 1440 in light and dark, with its five recommended answers.
- **Decision:** the screen opened by clicking a patient is a dashboard grid on every tab from tablet landscape up: a 2:1 main and side column on Now, History and Community, and two level columns on Details and Documents.
  1. **Now, main column:** the next step; the status gates as rows, each with a tinted icon and its action on the right edge, joined to a one-line Destination, Transport and Review foot that shows titles only; Triage and risk and Carer call back as two rows of one card under that work; then Care and safety.
  2. **Now, side column:** Legal now, Discharge readiness, the leave or absence card, Who to call (stacked when narrow, so a name is never cut short), Recent changes, Why, and one "Hand over and print" card in place of the separate print cards.
  3. **Moved:** "Where the hours went" sits on History beside the record, for a moving patient only; "Record added in error" sits at the foot of Details.
  4. **History** keeps its joined figure strip across the top, as it was.
  5. **Top band:** every patient gets the same band (chips, figures, tags), whether moving or staying; on a phone it drops the duplicate "Ends ... as typed" line.
- **Boundary:** synthetic data only. Layout and appearance only: no action, wording of a clinical rule, permission or saved record changes. Approves no release.

## D-166. CI runs faster without dropping a check (12 November 2026)

- **Date:** 13 November 2026, 5:26 AM AWST (12 November, 21:26 UTC). **Decided by:** Josh, "Yes to all recommendations" in the Ward Flow project thread "Speed up CI without losing quality", answering its three numbered questions on the CI review. Numbered D-166 because D-165 is claimed by PR #1644 (patient screen redesign).
- **Decision:**
  1. **Draft lane:** a draft PR runs only the scope plan, static checks and production build. The unit shards, coverage, backend proof, browser journeys and release gate run when it is marked ready, and only that run can pass Ward Flow required.
  2. **Phone release gate:** runs as two jobs (journeys then referrals, and checks alone). This reverses the phone half of the 4 November "fewer jobs" ruling; desktop keeps its three suites in one job.
  3. **The rest of the review:** the unit shards are dealt from main's newest measured timings (falling back to `scripts/ward-flow/unit-durations.json`); the push guard warns when it cannot see a PR; threads keep PRs in draft while iterating; `npm run check:phone-budget` checks phone limits before a push; and main reuses a PR's unit evidence apart from the legal-figure sweep.
- **Boundary:** no check is removed, skipped on a ready PR or loosened. Phone limits, coverage floors and test populations are unchanged. Approves no release, provider action or settings change.

## D-167. The Triage page has a left sign-off nav and joined section steps (13 November 2026)

- **Date:** 13 November 2026, 7:26 AM AWST (12 November, 23:26 UTC). **Decided by:** Josh, "Yes, open the PR" on the approval card and then "Yes to all recommendations" in the Ward Flow project thread "Redesign the Triage page", answering its five numbered questions on version 2 of the mock-up. Forty minutes earlier, on version 1, he wrote "isn't it better to have the nav on the left please as that is more natural". Numbered D-167 because D-165 is claimed by PR #1644 (patient screen redesign).
- **Decision:** Start a triage and the Triage and risk form are redrawn in the patient screen's row pattern (D-165), with no change to what any action does, to clinical wording, to permissions or to saved records.
  1. **Sign-off card on the left:** from 1001 px one sticky "Before you sign" card on the left lists the six sections, shows what is left and carries the Sign button. It replaces the old left list, the progress bar and the Sign button at the form's foot. On a tablet the card sits after the form; a phone keeps its bottom bar. On 7 November 2026 Josh kept the left column to the sections only and moved the "Before you sign" list out of it; this entry replaces that for the left column, because the one card is now both the section list and the sign-off list.
  2. **Signature part:** the sections are drawn as steps joined by a line, with a filled chip for the section in view, in the card and in the form. This is the page's one signature part.
  3. **Pills everywhere:** pick-one answers are round pills at every width. Pick-any answers stay square with a tick.
  4. **Start a triage:** "Waiting by source" and "Signed triages" keep a right-hand column beside the numbered queue.
  5. **Top band:** unchanged in this PR. Josh set its button row on 9 November 2026.
- **Boundary:** synthetic data only. Changes no clinical rule, signed value, time limit or permission. Does not touch the patient screen's Triage card (PR #1644). Approves no release.

## D-168. The demo script follows the 13 November pre-demo audit (13 November 2026)

- **Date:** 13 November 2026, 12:17 PM AWST (04:17 UTC). **Decided by:** Josh, "Go ahead and do this as recommended" in the Ward Flow project thread "Update demo script from audit", accepting the recommendations of the pre-demo master audit (audit prompt 0).
- **Decision:** `DEMO-SCRIPT.md` is changed to match the screen, with no app change in this PR.
  1. **Act 3** shows Cyril Coldharbour's referral, whose Place tab shows all three groups, instead of Orla Vallowen's, which since D-141 shows one ward.
  2. **Keira's Form 3B:** the script alone changes for now. It says her form ended at the examination and the app prompts for the next form, and makes the "no expiry is worked out" point on another patient's row. Making the ED board, panel and transport "Legal now" line read the ended state is a later app fix that needs Josh's clinical check.
  3. **Form numbers** (Form 6A, Form 4A) stay out of the Say lines until Josh has checked them clinically.
  4. **Setup and rules:** the demo runs on the public demo; Reset demo is pressed as the audience sits down because Keira leaves "Later today" about an hour after it; the script no longer says Reset returns the clock to 10:42; and Reload page, not Try again, recovers a failed page load.
- **Boundary:** documentation only. Changes no app behaviour, clinical rule or permission. Approves no release.

## D-169. Demo script wording follows the hard questions audit (13 November 2026)

- **Date:** 13 November 2026, 12:52 PM AWST (04:52 UTC). **Decided by:** Josh, "Yes to all recommendations" in the Ward Flow project thread "Prepare for hard demo questions (prompt 7)", accepting the three recommendations of the hard questions audit (audit prompt 7).
- **Decision:**
  1. **Five script wording fixes** go into `DEMO-SCRIPT.md` as one script-only change: the script no longer states "not a medical device" as settled; Keira's form is "shown as ended" by a rule that still needs legal review; a patient whose gender is not recorded as female or male takes the same recorded, ward-checked route as a non-binary patient; RFDS can be recorded as the carrier, with nothing specific to air transport built; and role access is described as built in the shared version, with its checks not finished.
  2. **Invented ward descriptions:** the next on-screen audit checks where the "what each ward admits" lines show under real ward names.
  3. **Cost:** the answer in the room is that there is no price today.
- **Boundary:** documentation only. Changes no app behaviour, clinical rule or permission. Gives no regulatory, legal or clinical view. Approves no release.

## D-170. Clinical wording rulings from the 13 November audit (13 November 2026)

- **Date:** 13 November 2026, 1:04 PM AWST (05:04 UTC). **Decided by:** Josh, "Yes to all recommendations. Lock them in and update coordinator" in the Ward Flow project thread "Audit clinical wording (prompt 3)", answering the seven numbered questions of the clinical wording audit (audit prompt 3). Fifteen minutes later (1:19 PM AWST, 05:19 UTC) he wrote "Yes to all recommendations and update coordinator" to the four follow-up recommendations for items 3, 4, 6 and 7. Numbered D-170 because D-169 is claimed by PR #1649 (demo script wording).
- **Decision:**
  1. **Next form:** a patient page no longer names Form 6A as the next form. It says "Next form to record", with no form number. A form is shown as ended at arrival only when a person records that it ended; "ended at the examination" is unchanged. This replaces Josh's 13 October 2026 default of a single "Record Form 6A" prompt.
  2. **Demo story:** the script keeps the ambulance booking and the Form 4A check for Keira's move inside Royal Perth, and gains one presenter sentence saying the booking is shown to demonstrate the step. After the demo the story moves to a patient who crosses sites.
  3. **Examination outcome:** "revoked" comes out of the examination outcome wording in all seven places. The list says "No order made, does not proceed", the chip says "No order made", and the notice says "The examination made no order. The patient is not coming."
  4. **Sample legal status:** the four sample people on a Form 4A with no examination recorded become "Referred for psychiatric examination". The three on a Form 3B whose examination records an inpatient order keep "Involuntary inpatient", because item 1 changes how their old form reads. Only sample data changes.
  5. **Transport check:** the check says "Transport or transfer order not uploaded", with no form number.
  6. **Triage windows:** the four triage see-by windows are signed as they are once Josh confirms they match the triage form; until he confirms, they stay unsigned. The Frequent presenter number is signed as a prototype default, not a clinical threshold. No value is proposed or changed here.
  7. **Ward profile panel:** the invented "Admits" lines are removed until a service supplies its own words, the "Forms held" row is dropped, and the forensic chip changes from "CLMA" to "CLMI Act", added to the glossary as the Criminal Law (Mental Impairment) Act 2023. The Act name was given from memory, so the fix checks it against the WA legislation site before it is built.
- **Boundary:** records the rulings only. This PR changes no app wording, script or sample data; the fixes are built later under the audit plan. None of the wording was checked against the Act's text. Still open: Josh's confirmation that the triage windows match the form. Sets no clinical value. Approves no release.

## D-171. Hosted database brought to schema 18 (migrations 017 and 018) (13 November 2026)

- **Date:** 13 November 2026, 1:34 PM AWST (05:34 UTC). **Decided by:** Josh, choosing "Apply 017 then 018" on a decision card in the Ward Flow project thread "Audit Ward Flow performance". He had said "Go ahead" to applying migration 018 after PR #1624 merged (11 November). D-170 is claimed by open PR #1650.
- **Finding:** the hosted Ward Flow Supabase database (project `zakzoemeedfepxcstsou`) was still at schema 16. Migration 017 (Help remembered by account, 4 November) had never been applied, so 018 could not go on alone.
- **Decision:** apply 017 and then 018 together, after the release carrying PR #1624 was live (the backend refuses a schema newer than it knows). This was done at 05:37 UTC in one transaction under advisory lock `782322`, with a starting-version check, the checksum-verified migration files and the runtime grants, as `migrate-supabase.mjs` does. Afterwards: schema 18, the four new indexes present, the runtime role can read, add and update `account_preferences` but not delete, browser roles have no access, and row security is on.
- **Boundary:** synthetic data only. Schema and grants only, with rollback files 018 then 017. No release, Railway or clinical change.

## D-172. The community desk's ED heads-up stays as built in D-154 (13 November 2026)

- **Date:** 13 November 2026, 1:46 PM AWST (05:46 UTC). **Decided by:** Josh, "Ok yes to all recommendations" in the Ward Flow project chat. The recommendation for the community desk ED heads-up (PR #1606, item 46) was to leave it as it is. Numbered D-172 because D-170 is taken by open PR #1650 and D-171 by PR #1651. The two other answers in the same message, on Legal forms Print and Export and on an ended This-shift staff request, were already recorded as D-157 and D-158 on 12 November and are built on main.
- **Decision:** the item 46 "Your patients in ED" card stays as D-154 built it. A community team desk in local mode gets the narrow scoped list (UMRN, ED name and recorded time for its open-episode patients). In shared mode the server still sends no such list, so a shared community desk's card stays empty. Sending the list from `scopeWardFlowState`, the way D-152 sends `diversionReturns`, is not built now.
- **Why:** the shared-mode gap fails closed and exposes nothing extra. Widening what the community role receives from the server is a privacy change (D-14, D-87) that can wait for real-data planning.
- **Boundary:** synthetic data only. No code change. Item 46 with real data still needs the D-87 privacy review. Approves no merge or release.

## D-173. Turning off Supabase open sign-up is deferred (13 November 2026)

- **Date:** 13 November 2026 (`2026-11-13`). **Decided by:** Josh, in the Ward Flow project chat: "defer supabase issue" (05:46 UTC), alongside his yes to the remaining live audit recommendations. Numbered D-173 because D-170 to D-172 are recorded above.
- **Decision:** Josh's own action from D-145 item 5, turning off Supabase open sign-up, is deferred. The site stays on synthetic data, so nothing changes now. It must still be done before any real data, and it stays on the real-data gate.
- **Why:** the shared site holds synthetic data only, so an outside Supabase account that gets past the site lock reaches no real patient information.
- **Boundary:** synthetic data only. No code change and no provider change. Changes no clinical rule or signed value, and approves no release.
- **Done (14 November 2026):** Josh turned off "Allow new users to sign up" in the Ward Flow Supabase project (`zakzoemeedfepxcstsou`) on 14 November 2026. This closes D-145 item 5 and the real-data gate's sign-up line.

## D-174. Audit findings name the system cause, and the fix round ships in two pull requests (13 November 2026)

- **Date:** 13 November 2026. **Decided by:** Josh in the Ward Flow project chat, relayed to the fix thread "Fixes": 4:39 PM AWST (08:39 UTC), "the specific mistakes for the demo data is not about the demo data... it is about the system and behaviour that made or displayed that mistake"; 4:58 PM AWST, start all safe, approved, non-clinical fixes now; 5:07 PM AWST, the decision card option "Two PRs, big changes after demo"; 5:51 PM AWST, "await my posting the audit from 12 and 14 however before fixes". Numbered D-174 because D-173 is claimed by open PR #1653.
- **Decision:**
  1. **Root cause rule:** a mistake seen in sample data is a finding about the generator, calculation, logic or display that made or showed it. The fix corrects that behaviour and adds a guard test. Hand-editing one sample record is not a fix.
  2. **Two pull requests:** the demo-safe fixes go in one pull request. The sample-day generator, travel band, worked-example, hold-up list and other after-demo changes go in a second pull request labelled `hold` until after the demo.
  3. **Hold:** neither pull request is marked ready or merged until the findings of Audits 12 and 14 are folded in. Draft pull requests may run CI.
- **Boundary:** sets no clinical value. Approves no merge or release; a release still needs Josh's "release now" or the daily run.

## D-175. Audit 16 and the demo-data root-cause review: approved fixes (13 November 2026)

- **Date:** 13 November 2026. **Decided by:** Josh in the Ward Flow project threads "Audit 16" and "Trace demo-data mistakes to system causes": 4:38 PM AWST "ok go ahead with all your recommendations please" (Audit 16, all 12); 4:44 PM "yes to all your recommendations and pass along" (the system parts of A16-08 to A16-11); 4:52 PM "yes to all four" (the revised fixes); 4:53 PM the root-cause review answers, in the narrower form the coordinator advised.
- **Decision:**
  1. **Audit 16:** all recommendations, built as system fixes under D-174. Travel bands are shown only when someone has checked them; until then a pair reads as not checked. Hold-up reasons are split by occupied or empty bed (the two lists are a draft for Josh to sign). The Armadale worked examples become a presenter switch after the demo. A sample-day check suite guards the seed.
  2. **Root-cause question 1:** only small fixes on the demo path go before the demo; the rest follow, grouped by cause.
  3. **Question 2:** the app may hold "observation not recorded"; a missing level is never shown as General.
  4. **Question 3:** Home gains a "Past planned time" group, so a late planned move does not drop off.
  5. **Question 4:** Day N counts Perth calendar days, and the arrival day is Day 1.
  6. **Question 5 (wording only):** the fit sentence names what was checked and says that recorded risks, escort need and medical clearance are not part of the check.
  7. **Question 8:** reminders and the call log say "on this device only" now; a shared record comes before real data.
  8. **Question 10:** four rows join the real-data go/no-go list (C10 to C13).
- **Still Josh's (clinical):** whether any recorded risk becomes a fit check (question 5); whether "Involuntary" filters and detained counts include people referred for examination (question 6); the ED wait ladder against the values register (question 7); which legal status and form pairings get a warning (question 9); the Calder, Keira, Saoirse and Cyril sample-record calls; the length-of-stay spread and the hold-up lists.
- **Boundary:** synthetic data only. Sets no clinical value.

## D-176. Clinical check pack answers (13 November 2026)

- **Date:** 13 November 2026, 4:09 PM AWST (08:09 UTC). **Decided by:** Josh, agreeing every recommendation on the tick sheet of the clinical check pack (audit prompt 17), in the Ward Flow project thread "Build the clinical check pack".
- **Decision:**
  1. **A1:** a legal form, such as Keira's Form 3B, shows as recorded on every screen until a person records it ended. This changes the D-168 direction for the script and the D-170 item 1 reading of an old form.
  2. **B1, B2:** the form numbers 6A and 4A stay out of the script's Say lines; the D-170 presenter sentence stays.
  3. **C1 to C5:** the triage see-by windows and the frequent presenter number stay unsigned until Josh compares them with a current SMHMR900. Triage stays out of the demo. **C6:** the windows carry a visible "not signed" label.
  4. **D1:** the glossary describes SMHMR as the form-number prefix of WA's statewide mental health documents, with no expansion of the letters.
  5. **E1:** the forensic chip goes with the "Forms held" row. Elsewhere the Act is named in full: Criminal Law (Mental Impairment) Act 2023.
  6. **F1, F4:** said as scripted. **F2:** the script says "usually up to three wards at once". **F3:** the Undo and three-ward limits join the values register after the demo.
- **Frequent presenter number:** D-170 item 6 signed it as a prototype default; C5 leaves it unsigned. Josh chose unsigned on 13 November 2026 (D-181 item 3), which replaces D-170 item 6.
- **Boundary:** sets no clinical value.

## D-177. Audit 15 answers on the public footprint (13 November 2026)

- **Date:** 13 November 2026, 5:03 PM AWST "Go ahead with all your recommendations and update the coordinator chat", and 5:05 PM AWST "Yes to all recommendations" on the five open choices, in the Ward Flow project thread "Audit 15".
- **Decision:** all Audit 15 recommendations are approved for the fix round. Of the five choices: the demo phone numbers copy and never dial (A15-14); reference addresses show the suburb only (A15-16); the seclusion room list stays and only the invented incidents and staff request leave wards that carry a real ward's own name (A15-27); neutral health-service colours wait until after the demo (A15-30); the coordinator handover page is deleted (A15-02).
- **Still Josh's:** the privacy route for A15-01 part 1, the crisis numbers (A15-17, clinical) and his own settings checks (A15-10, A15-22, A15-24).
- **Boundary:** synthetic data only. Approves no release.

## D-178. Audits 4 and 5 answers (13 November 2026)

- **Date:** 13 November 2026, about 5:48 PM AWST (09:48 UTC). **Decided by:** Josh, "yes to all recommendations" for the venue resilience audit (Audit 4) and the layout audit (Audit 5), in the Ward Flow project chat, and again "Yes to all recommendations" in the "Audit 5" thread.
- **Decision:** the script gains the Audit 4 presenter lines (the 15-minute idle cover and Carry on, an offline booking is not kept, the Act 2 fallback). The app fixes follow: the cause of an offline booking lost on reload, a server check before a full page load, a half-filled booking holding a reload, retrying a part that did not load, and a lint rule for unhandled loads. All Audit 5 layout fixes are approved, with its after-demo items after the demo.
- **Boundary:** the 15-minute idle limit is a signed value and does not change. Sets no clinical value.

## D-179. Audit 9 answers from a real shift (13 November 2026)

- **Date:** 13 November 2026, 5:50 PM AWST (09:50 UTC). **Decided by:** Josh, "yes to all your recommendations" in the Ward Flow project thread "Audit 9", confirmed for question 7 at 5:54 PM AWST.
- **Decision:**
  1. **Before the demo:** only A9-01 to A9-04 (surname first on the Act 6A card and panel, the script's Undo and fallback lines, and the held-up discharges line). The rest of Audit 9 waits until after the demo.
  2. **Standing rule (question 2):** no clinical choice starts selected on any form. Bed security, discharge destination, and the kind of leave and its return time start empty and ask.
  3. **Question 3, wording only:** the clearance card says what the app does today. Whether transport and handover wait for fit to travel stays Josh's to rule.
  4. **Question 4:** the Home pull form shows what was recorded and who recorded it, after a mock-up.
  5. **Question 5:** one ward's acceptance keeps closing a parallel ED review request, and says so. **Question 6:** handover sign-off stays allowed with checks open; the button counts them and History records them.
  6. **Question 7:** the Triage safety plan rule is Josh's, as the form applies it (`triage-risk-state.ts`): a safety plan is needed at urgency A or B, when any current risk is marked present, or when an alert other than a background one is recorded. No app change.
  7. **Questions 8 to 10:** Review details stays open until Aboriginal or Torres Strait Islander status and interpreter need are answered; a reviewed time in the future shows no See by time; a triage signed on a desk carries that desk's own sample person.
  8. **Question 11:** "ready" no longer includes a bed still being made ready, on every screen together. This replaces the 5 September 2026 owner ruling that such a bed is still offered and counted.
  9. **Question 12:** a site bed manager's TV shows only that site. **Question 13:** the small-number rule in Executive Statistics stays; only its wording changes. **Question 14:** deferred to the community redesign.
- **Boundary:** synthetic data only. Sets no clinical value beyond confirming the safety plan rule as built.

## D-180. Audits 12 and 14 answers (13 November 2026)

- **Date:** 13 November 2026, 4:44 PM to 5:59 PM AWST, in the other Ward Flow chat (the audit chat), handed to this project at 6:42 PM AWST (10:42 UTC) with "Ok here is 12 and 14" and "Please continue with all recommendations also". The handover file is the source; its times are Perth time.
- **Decision:**
  1. **Recovery card (4:44 PM):** the recovery-card lines and the new recovery wording for Keira leaving Later today go ahead. "Mark absent" and "Record no transport needed" stay as they are for the demo and are decided after it.
  2. **Test records (4:52 PM and 4:55 PM):** PT-A06 and TEST-Helper4 are cleared from the live signed-in site with the app's own controls in Josh's signed-in browser, never by a database edit. The temporary handover file is removed in this project's own PR.
  3. **The fix pull request (4:55 PM):** six items from the underlying-system check are approved: the legal-form family reads the ended state the patient page uses, says "Next form to record" and labels the check "Transport or transfer order not uploaded" (K1, K14, K18); the ED step-1 "Ask wards" prompt stops once a ward has accepted (K6); "Open patient" on the ED board opens the patient page (A12-04); Esc closes the Record a form box and the ED transport booking box (A12-08); the hotspot line goes in the script (L1); a "Change" control beside "No transport needed" after the demo (K37).
  4. **Script (5:13 PM and 5:47 PM):** A14-P1 is handled before the demo by a script line; the seven Audit 14 script edits go into one docs pull request before the demo. A14-P2, A14-12 and A14-13 wait until after it.
  5. **Order (5:59 PM):** the docs pull request first, then the fix pull request. The after-demo list in the handover's section 9 follows the demo.
- **Boundary:** sets no clinical value. The handover's clinical questions (section 8) are for Josh's tick sheet and nothing is built from them.

## D-181. Fix round answers (13 November 2026)

- **Date:** 13 November 2026, 6:46 PM AWST (10:46 UTC). **Decided by:** Josh, "Yes to all 15" in the Ward Flow project chat, answering the fix thread's 15 numbered recommendations.
- **Decision:**
  1. The three legal-panel exports left unused by removing the "Forms held" row and the forensic chip are deleted.
  2. Josh's 4:55 PM yes (D-180 item 3) is the clinical check for Keira's form lines: a form shows as recorded until a person records it ended.
  3. The frequent presenter number stays unsigned. This replaces D-170 item 6.
  4. Whether transport booking and "Mark handover ready" wait for fit to travel: no change before the demo; decided after it.
  5. A bed being made ready may still be pulled, and is shown separately from ready beds (with D-179 item 8).
  6. The hold-up reason lists are signed as drafted: an empty bed can only be "Awaiting clean"; an occupied bed takes every other reason.
  7. Travel times stay "not checked" until after the demo, when Josh supplies checked times for the site pairs used.
  8. The sample's length-of-stay spread (a fixed shuffle per ward) is kept as a sample choice, labelled as such.
  9. The worked examples are on in the demo and off for real data.
  10. An arrival with no pulled bed creates a named stay. This replaces the unrecorded 25 September 2026 ruling that an arrival never creates a stay.
  11. A typed date of birth no longer stops saving. A follow-up counts such a person as "age not recorded" rather than Adult.
  12. GP, crisis-service and inter-hospital referrals keep their bed pull on the ward board for now.
  13. On a short laptop screen the menu hides its grey second lines so "More" stays in view.
  14. An observation level that is not recorded is counted separately and never as constant observation.
  15. The invented "Mental Health Transport" booking contact stays, labelled as sample data.
- **Boundary:** synthetic data only. Items 6, 7 and 8 sign sample and reference choices, not clinical thresholds.

## D-182. Audit chat and end-report answers (13 November 2026)

- **Date:** 13 November 2026, 4:56 PM to 6:47 PM AWST. **Decided by:** Josh, in the audit chat (handed over at 6:42 PM) and the Ward Flow project chat. The end report's Addendum 1, section A8, lists these as rulings 16, 19, 21 and 23; the others there are D-180 and D-181.
- **Decision:**
  1. **No fixes in the audit chat (4:56 PM and 5:49 PM):** fixes are built only in the main Ward Flow project. The cloud report is the one combined Audit 14 report.
  2. **The demo code (5:49 PM):** the message that holds it is deleted, and the code is changed after the demo.
  3. **"Continue with all recommendations" (6:43 PM),** for the end report's section 2B: Audit 3's nine after-demo wording fixes go in the held pull request, with the legal-rule sentences and the "not authorised" wording shown to Josh first; the forensic chip is removed, not renamed; whether a bed still being made ready may be matched ahead of time is not changed now and is decided with the after-demo build; the other seven scenarios get a root-cause trace after the demo, at low priority; the avoid list stands; releases are frozen once the re-check passes and the freeze is cleared after the demo (the switch is Josh's); the public-site pass runs after the fixes are released and the deep audit after the demo.
  4. **"Go ahead with all final recommendations" (6:47 PM)** answered a message setting out the merge order: the documents pull request first, then the fix pull request, each by auto-merge once its checks pass. It is not a "release now". Josh confirmed this at 7:04 PM (11:04 UTC) with "Go ahead with all recommendations": the demo date is unknown, so nothing reaches the live site beyond the normal 6 am update and there is no manual release.
- **Boundary:** sets no clinical value. The open clinical calls stay on Josh's tick sheet.

## D-183. End report addendum answers (13 November 2026)

- **Date:** 13 November 2026, 7:04 PM AWST (11:04 UTC). **Decided by:** Josh, "Yes to all recommendations" in the Audit 19 thread, answering the end report's Addendum 1, part A2 (ruling 24 in its A8 list).
- **Decision:**
  1. Two gates join the "before real data" list: the sign-in token can be read by page scripts, and the TV shows full names with no privacy review done ([REAL-DATA-GO-NO-GO](governance/REAL-DATA-GO-NO-GO.md) rows C14 and C15).
  2. A new word for "Suggested now" and "Suggested next step", and one word in place of "Forecast" and "likely", are chosen after the demo from options the fix thread shows Josh. Nothing is renamed before then.
  3. Audit 7's open business questions, and a regulatory adviser's view on whether Ward Flow is a medical device, are taken in one sitting after the demo.
  4. The clinical tick sheet is answered in one sitting after the demo.
- **Not decided by this answer:** the demo date and screen size, and A15-01 (Josh's privacy decision).
- **Boundary:** sets no clinical value. Nothing is built from T9, T25 or T26.

## D-184. The system fixes merge before the demo (13 November 2026)

- **Date:** 13 November 2026, 8:01 PM AWST (12:01 UTC). **Decided by:** Josh, on a decision card in the Fixes thread, after saying the demo is about two weeks away and "I want all the work done please".
- **Decision:** the second pull request (the sample-day generator and the system fixes) merges before the demo, by about 20 November, once its checks pass and the fixes are re-checked. Nothing merges after 22 November, so Josh rehearses on the final screens. This replaces the "after the demo" part of D-174; the two-PR split stays.
- **Boundary:** sets no clinical value. Clinical calls from the tick sheet still wait for Josh's sitting.

## D-185. Design critique v2 answers and the brand mark for the demo (13 November 2026)

- **Date:** 13 November 2026, 8:08 PM AWST (12:08 UTC). **Decided by:** Josh, "Yes to all recommendations please" in the project chat, answering the appraisal of design critique v2 (32 findings).
- **Decision:**
  1. The 27 agreed items go ahead in the PRs the appraisal names: 14 small demo-safe fixes in the first fix PR, 3 in the system-fixes PR, 5 in the shared-parts wave and 4 in the page waves. The five rejected findings stay rejected.
  2. The app keeps the care-cross mark for the demo. A Ward Flow mark of its own is chosen after the demo.
  3. Where a fix largely changes a screen's design, Josh sees a mock-up first. Small wording and bug fixes do not need one.
- **Not decided by this answer:** whether an "Intermittent" observation level starts with no interval (critique item 18). That is a clinical call for Josh's sitting.
- **Boundary:** sets no clinical value.

## D-186. Clinical sign-off sitting, part 1: timing and the audit-backed recommendations (13 November 2026)

- **Date:** 13 November 2026, 8:09 PM AWST (12:09 UTC). **Decided by:** Josh, choosing "Yes, Q1 a and Q2 to Q16" on a decision card in the Ward Flow project thread "Prepare the clinical sign-off sitting", after "Yes to all recommendations please" in the project chat (12:08 UTC) and "I approve and agree with all recommendations" in that thread (12:09 UTC). The questions are in the sitting's question list (Doc "Clinical sign-off sitting: questions", 13 November 2026), built from the end report's tick sheet (T1 to T26), the clinical check pack and fix plan wave 2. Numbered D-186 because D-173 is claimed by PR #1653 and D-174 to D-185 by the Fixes thread's PRs.
- **Decision:**
  1. **Timing (Q1).** The clinical changes are shown at the demo (about 27 November 2026) only if this PR is merged and re-checked on Josh's PC by 20 November 2026. Otherwise it waits until after the demo. D-184's merge freeze from 22 November still applies.
  2. **Empty risk flags (Q2, T2).** A referral with no risk flags entered reads "None recorded", not "None flagged".
  3. **Story-built sample people (Q3, T1).** Generated sample people are built from a short story, so their tier, wait, form, review and reason agree. They are no longer worked out from the record number. What a long wait must show stays open (Q17).
  4. **Two named legal rules (Q4, T6, F-112).** The code keeps two named rules, "not voluntary" and "detained", and each screen and count says which one it uses. Which screen uses which stays open (Q24).
  5. **Warnings, never blocks (Q5, T8).** Legal pairing and out-of-order problems stay warnings, never blocks, and the order rules live in one place used by both the record actions and the sample-data check. This records Josh's 27 October 2026 "warning, never a block" ruling, which until now lived only in a code comment (`ward-legal-form-fit.ts`). Which pairings warn stays open (Q27).
  6. **One transport paperwork rule (Q6, T9, T25).** One rule reads the person's form and both sites. The paperwork table is held as a signed setting, and today's behaviour is its starting content until Josh rules on Q28.
  7. **One source for legal lines (Q7, T15).** The patient page's top band and its "Legal now" card read one source and show only recorded facts.
  8. **"Not authorised" wording (Q8, T24).** The four places that call a hospital "not authorised" say "not set up for involuntary admissions (demo)". The flag itself and what it drives are unchanged; which hospitals are truly authorised stays open (Q42).
  9. **Legal-rule sentences (Q9, T24).** "A Form 1B can only be made once, so check the paper." becomes "Form 1B is already recorded. Check the paper." (the same for 4B). The two discharge sentences become "Criteria led discharge is switched on for voluntary patients only."
  10. **Triage banner (Q10, T16).** The Triage banner shows the ward and legal status the patient page shows, and keeps "Not legally checked".
  11. **Triage legal labels (Q11, T16).** The form's own status reads "Chosen today" and the record's reads "On record". A status picked from buttons reads "as chosen"; "as typed" is kept for the typed form and date only.
  12. **Crisis numbers (Q12, T19).** Each crisis number on the Triage safety plan carries "checked by" and "checked on", and reads "Not checked" until Josh supplies them (Q41). No number changes.
  13. **Gender in the record preview (Q13, T22).** The record preview shows recorded gender beside sex, as the ward screens and referral board already do (D-19, R7).
  14. **What signing a triage saves (Q14).** The signed-triage line and the How to page list everything signing saves, including problems, actions, venue and referral type.
  15. **The Triage safety-plan rule (Q15).** The rule Josh confirmed on 13 November 2026 (5:55 PM AWST, Audit 9 question 7) is the rule as written in `triage/triage-risk-state.ts` (lines 477 to 485 at main `692bd97`), including "an Other risk entered as Current". The end report's paraphrase differs and does not govern.
  16. **Unsigned triage timings in the register (Q16, T17).** The Triage follow-up choices (24 hours, 72 hours, 7 days), the 72-hour follow-up hint and its 28-day discharge look-back, and the "Review risk by" choices are listed in the values register as synthetic values. No value changes.
- **Boundary:** synthetic data only. Items 2 to 16 set structure and wording only. They set no clinical value, threshold, pairing, paperwork table or authorisation fact. Questions 17 to 44 of the sitting stay open, including the triage windows (T17), which stay unsigned. Built in one held clinical PR (label `hold`). Approves no merge or release; Josh lifts the hold.

## D-187. Clinical sign-off sitting, part 2: the recommendations for Q17 to Q44 (13 November 2026)

- **Date:** 13 November 2026, 8:30 PM AWST (12:30 UTC). **Decided by:** Josh, "Yes to all Q17-44" in the Ward Flow project thread "Prepare the clinical sign-off sitting". He was answering a list that gave a recommendation with its source for 19 of the questions and said "no basis to recommend" for 9. The yes approves the 19 recommendations only. A yes cannot supply the content of the 9 without a recommendation, so they stay open.
- **Decision:**
  1. **Two legal statuses (Q19, T2).** A person keeps both the ED stay's status and the patient record's status, and the app flags when they differ (a warning, per D-186 item 5).
  2. **Form 1A before examination (Q21, T3, T8).** The sample status that goes with a Form 1A before the examination is "Referred for psychiatric examination", as in D-170 item 4. Josh still confirms that this is legally right for a 1A.
  3. **"Involuntary" (Q24, T6).** The "Involuntary" search filter and the detained counts both leave out people referred for psychiatric examination, which is today's behaviour for the counts and a change for the filter. This follows the Act s 4 as quoted in the clinical check pack, and the 9 October 2026 rule "Referred is not involuntary".
  4. **A Voluntary person with a form on file (Q25, F-112).** Their chip shows both the status and the form. The arrivals corridor says "involuntary" only from the recorded status, never because a form is on file.
  5. **ED wait ladder (Q26, T7).** The four steps of D-108 item 2 stand (3, 8, 24 and 48 hours, all unchanged). The values register is reworded to name each step. The 48-hour value keeps its status and source.
  6. **Order of forms (Q27, T8).** A follow-on form recorded with no earlier form on file raises a warning. The status for each form in the sample follows D-170 and item 2 above. Which other pairings warn, whether an examination needs a referral form first, and the locked-ward notice stay open.
  7. **Transport paperwork (Q28, T9).** A Form 4C clears the transport or transfer order check, in line with D-170 item 5's "transfer order". Same-site moves, Form 4B and the forms-pack slot stay open.
  8. **Missing person (Q29, T15).** "Order stays in force while absent" is dropped; the page shows only the recorded status and form. Which status shows for a patient gone to ED, and the community order row, stay open.
  9. **Ward fit check (Q30, T5).** Recorded risk, escort need, observation level and medical clearance are shown in the fit check as "to check", never as a fail, as observation already is (D-71: nothing is scored).
  10. **Fit to travel (Q31, T10).** Booking transport and "Mark handover ready" without medical clearance recorded raise a warning that asks for a reason. Neither is blocked.
  11. **A referral with no tier (Q33, T12).** It reads "Tier not recorded" and keeps today's overdue window (tier 3's).
  12. **A pull past its limit (Q34, T13).** Today's display stays: the bed stays pulled until a person releases it, and no automatic release is added. A pull with no limit recorded says so.
  13. **The Seclusion tab (Q35, T14).** Non-seclusion incidents stay on this tab, because ward desks cannot open Governance. How rooms are grouped, and rooms at a hospital marked not authorised, stay open.
  14. **"Ward for" in the bed finder (Q36, T22).** It offers gender choices beyond Female and Male. Those choices lead to the coordinator-review message and filter no ward, as ruling R7 sets.
  15. **The Home pull form when nothing is recorded (Q37, T23): held, not decided.** In the same minute Josh also approved the "Redesign Home, Ward and Capacity" card, whose question 1 says the opposite: the pull form reads legal status, form and observation from the record with their source, and the ED or referrer records them. The two answers conflict, so neither is built from this entry. Josh is asked to choose, and his answer will be recorded separately. Decided in D-188.
  16. **One-press actions (Q38, T26).** "Mark absent" and "Record no transport needed" stay one press. Their Undo lasts the five minutes it promises, and the absent Undo message no longer says "Back on leave" for a person who was on the ward (D-148, D-113 item 2).
  17. **Triage's copied handover (Q39, T16).** The Recommendation part carries the safety plan's Plan and Crisis lines. Crisis numbers carry their "Not checked" mark (D-186 item 12). The words for "confirmed none present" and "not known", and whether the assessment note is included, stay open.
  18. **Triage wording read (Q43).** The 11 lines flagged "Contradicts" in the Triage wording sheet are brought into line with D-170 and D-186. Every other line waits for Josh's read.
  19. **The Intermittent interval (Q44).** Choosing "Intermittent" leaves the interval blank until someone picks 15 or 30 minutes, and it cannot be saved without one. This follows the Audit 9 question 2 rule that no clinical choice starts selected. Both signed values are unchanged. Josh's 27 October 2026 warnings-not-blocks ruling (D-186 item 5) covers legal pairings and order problems only, so it does not apply to this form.
- **Still open (no recommendation could be given):** Q17 (Calder and long waits), Q18 (Keira), Q20 (Saoirse), Q22 (Cyril), Q23 (observation mix), Q32 (signing a triage with Aboriginal status or interpreter need unanswered), Q40 (triage windows), Q41 (crisis numbers) and Q42 (authorised hospitals). The parts of Q27, Q28, Q29, Q35 and Q39 named above as open also stay open.
- **Items 9 and 10 settled at the go questions:** 14 November 2026, 1:28 AM AWST (13 November, 17:28 UTC), Josh, "Go ahead with all recommendations" in the Ward Flow project chat, answering the coordinator's post of go questions 1 to 4 for the held clinical PR. Item 10 (go question 1): booking and "Mark handover ready" with no medical clearance recorded keep asking for a reason every time, and the labels stay as built: "Continue without a reason" and "Record why, or save without a reason." Item 9 (go question 3): when the person's recorded legal status needs an involuntary-capable bed, or no status is recorded (the D-69 rule), the "To check" group also shows "Involuntary admissions: not stated", and the card line ends with that sentence. It is still never counted and never a fail. Go question 2 (separate words for "nothing recorded" and "recorded as not cleared"): Josh agrees to two lines, but the words are his, so it stays open and the prompt reads as built. Go question 4 (the signer's name on a signed triage) stays open. No clinical value is involved. Recorded here, not under a new number, because it settles two of this ruling's own items and a new number would leave unclaimed gaps in the log while PR E holds D-200 and D-201.
- **Item 10, no live transport job:** 14 November 2026, 7:02 AM AWST (13 November, 23:02 UTC), Josh, "Please continue with all recommendations" in the Ward Flow project thread "Review clinical and redesign builds early", answering the independent review's open questions. Its question 10 recommended accepting as built that "Mark handover ready" asks nothing about fit to travel when no transport job is live (no transport needed, or the job was cancelled), because arrival asks instead. Josh then asked what question 10 was. The review thread set out the two choices (accept as built, or ask at "Mark handover ready" for moves with no transport too) and the cost (for a move without transport the reminder comes after arrival, not before the person leaves ED). Josh answered "Accept" (14 November 2026, 7:31 AM AWST; 23:31 UTC). Accepted as built. In the 7:02 AM message, the review's questions 2 (the words for "recorded as not cleared"), 4 (the signer's name) and 9 (how long waits look) stay open: their recommendations were to decide on screen or leave the words to Josh. No clinical value is involved. Recorded here, not under a new number, for the same reason as the line above.
- **Boundary:** synthetic data only. No clinical value or threshold changes. Items 11 and 12 are built by the owners of F-30 and F-46 in the six-PR plan, and item 15 waits for Josh; the rest are built in the held clinical PR. Approves no merge or release.

## D-188. The Home pull form is filled from the record and can be changed (13 November 2026)

- **Date:** 13 November 2026, 8:34 PM AWST (12:34 UTC). **Decided by:** Josh, in the Ward Flow project thread "Redesign Home, Ward and Capacity": "No read from the record as the clinician should set this or the ward coordinator", then "So it is both. It should be filled in but can be altered". He was settling the clash between D-187 item 15 (sitting question Q37) and question 1 of the "Redesign Home, Ward and Capacity" card.
- **Decision:** On the Home pull form, legal status, form and observation level are filled in from the patient record, each showing its source. The clinician or the ward coordinator can change them on the form. A field with nothing recorded reads "Not recorded" and starts with nothing selected (Audit 9 question 2 rule). This replaces D-187 item 15 and the three options of Q37.
- **Still open:** whether a change made on the pull form also updates the patient record, and how the form names who made the change.
- **Tightened the same evening:** 13 November 2026, 9:40 PM AWST (13:40 UTC), Josh, "Yes t[o] all other recommendations" in the Ward Flow project thread "Redesign Home, Ward and Capacity". The clinician or coordinator must choose an observation level on the pull form before the bed can be pulled, both when the referral holds none and when the ED board recorded it as "Not recorded". Before this, "Not recorded" let the pull go ahead. Recorded here, not under a new number, because it changes this ruling's own form and a new number would leave unclaimed gaps in the log before PR C opens. The two open points above were settled in that thread's own ruling for PR F.
- **Tightened again, to every pull:** 14 November 2026, 1:17 AM AWST (13 November, 17:17 UTC), Josh, choosing "Yes, on every pull" on the decision card "Ask for an observation level on every bed pull, not only the pull form?" in the Ward Flow project thread "Review clinical and redesign builds early". The option read: "The Ward page asks for a level when none is recorded, in this build. A later fix makes the engine refuse any pull with no level, so no screen can skip it." So every way of pulling a bed asks for an observation level when the journey has none recorded, and the engine refuses a pull that would leave the level "Not recorded". The Ward page's two pulls are built in PR F; the engine refusal and the remaining pull buttons follow in the held clinical PR after PR F merges. No clinical value is involved. Recorded here, not under a new number, for the same reason as the line above.
- **Boundary:** synthetic data only. No clinical value, threshold or legal rule changes. The form is built from an approved mock-up by the owner of the Home page in the six-PR plan; the held clinical PR builds nothing that contradicts it. Approves no merge or release.

## D-189. Handling the open sitting questions, and how the remaining items are built (13 November 2026)

- **Date:** 13 November 2026, 8:51 PM AWST (12:51 UTC). **Decided by:** Josh, "Yes to blocker recs" in the Ward Flow project chat, answering the coordinator's handling recommendations for the nine sitting questions that D-187 left open. The recommendations were about handling only and proposed no clinical value.
- **Decision:** each item stays unsigned for the demo and is settled at a later sitting. Until then:
  1. **Calder, Keira, Saoirse and Cyril (Q17, Q18, Q20, Q22).** Their sample stories stay as they run today, unsigned.
  2. **Observation mix (Q23).** The sample day's observation levels are labelled "sample mix, not clinical guidance" until Josh sets a mix.
  3. **Aboriginal status and interpreter need at signing (Q32).** Signing a triage warns when either is unanswered and never blocks, which is today's behaviour.
  4. **Triage windows (Q40).** They keep showing as not signed. Josh checks them against the SMHMR900 himself.
  5. **Crisis numbers (Q41).** They stay copy-only text, never a call link, and keep the "Not checked" mark from D-186 item 12 until each is checked.
  6. **Authorised hospitals (Q42).** No real hospital is shown as authorised or not authorised. How is item 8.
  7. **Photos (A15-01).** Josh raises this with his health service's privacy officer before any health service sees the project, and deletes any copies he holds unless the privacy officer asks him to keep them. Nothing is built.
  8. **How authorised hospitals and the transport check read until signed** (Josh, "Yes to both" in the project chat, 13 November 2026, 9:06 PM AWST, 13:06 UTC, answering two handling questions from the plan's stress test). (a) Every real hospital reads "not stated" for authorisation, replacing D-186 item 8's "not set up for involuntary admissions (demo)" wording where the two differ. Until Q42 is signed, the app's invented authorisation flag no longer steers the ward fit check or the bed finder, and a test checks that the label and the placement filter agree. This also settles Q35's open point about rooms at a hospital marked not authorised. (b) Before the Q28 forms table is signed, today's transport paperwork check stays and is labelled "not signed".
  9. **How the remaining items are built** (Josh, "Yes to all" in the project chat, 13 November 2026, 9:25 PM AWST, 13:25 UTC, answering nine build questions from the clinical PR thread; recorded here rather than as D-200 so the decision log carries no unclaimed gap before PR C opens). (a) Item 8's switch also stops the invented flag refusing handover, transport and arrival at a held bed, raising the "no longer lawful" alert and the legal mismatch flag, and asking a reason on planned admissions, so every placement path agrees with "not stated"; the sample generator's own filter is left alone. (b) Saoirse keeps her story (item 1) as a named exception to D-187 item 2, and goes to the later sitting. (c) D-187 item 6's warning fires, for now, only when a form is recorded as a continuation with no form on file. Which form codes count as follow-on stays Josh's legal call and is open. (d) D-187 item 7: either the recorded form or an uploaded Form 4C clears the order check. (e) D-187 item 10: the screen asks for a reason every time; the press goes through without one. (f) A9-29: a signed triage shows the name of the desk that signed it; Josh sees a picture before the hold lifts. (g) Checks on typed times and the transport order (book, handover, collect) stay blocks: they check data entry, not legal order, so D-186 item 5 does not cover them. (h) D-186 item 3's "agree" is mechanical only: each sample person's tier, wait, form and review come from one story line, and nothing is added about what a long wait should show (Q17 stays open). (i) Wording: a "To check" group with "Recorded risk", "Escort need", "Observation level" and "Medical clearance", each with the recorded fact or "Not recorded"; the bed finder note reads "Authorisation is not stated for any ward, so this does not narrow the list."
- **Item 8(b), the transport rule's starting content:** 14 November 2026, 7:02 AM AWST (13 November, 23:02 UTC), Josh, "Please continue with all recommendations", answering the independent review's question 5. As recommended, the one transport paperwork rule stays as built and labelled "rule not signed" (an order is needed unless the person is voluntary; a recorded or uploaded Form 4A or 4C clears it), and its content is settled with Q28 at the after-demo sitting. Nothing changes. Recorded here, not under a new number, because it confirms this item's own handling.
- **Boundary:** synthetic data only. No clinical value or threshold changes. Items 1 to 7 are labels and placeholders only; items 8 and 9(a) also stop the invented authorisation flag steering placement, by Josh's rulings. Items 2, 6, 8 and 9 are built in the held clinical PR after Fixes PR C merges, because the fit check, bed finder, transport and sample files are also changed there. Which hospitals are authorised (Q42) and the forms table (Q28) stay Josh's to sign. Approves no merge or release.

## D-190. The six-PR fix plan (13 November 2026)

- **Date:** 13 November 2026, 8:11 PM AWST (12:11 UTC). **Decided by:** Josh, approving every recommendation of the master fix plan in the Ward Flow project chat. D-186 to D-189 are held for the clinical sitting.
- **Decision:**
  1. The demo is about 27 November 2026. Rehearse at 1366x768 until the room's screen size is known.
  2. The order of work is: fix the system, then the clinical sitting, then shared parts, then pages (pull requests B to F).
  3. Layout fixes are folded into each page's redesign. Capacity is the third page in the first page wave.
  4. F-112 goes to the clinical sitting. F-116 is accepted as a prototype risk. F-118 is a rehearsal note in the first fix PR. F-120 is checked.
  5. A full clinical read of the Triage wording joins the clinical sitting.
  6. The 36 older role views are retired in a later page wave.
  7. The merged documents branch `claude/delete-handover-2026-11-13` is deleted.
  8. Audit 7's business questions and a regulatory view are taken in one sitting after the demo.
- **Boundary:** sets no clinical value.

## D-191. Home, Ward and Capacity mock-ups approved (13 November 2026)

- **Date:** 13 November 2026, 8:31 PM AWST (12:31 UTC), with follow-ups at 8:34 PM, 8:51 PM and 8:56 PM AWST. **Decided by:** Josh, "Yes to all" on the decision card "Approve the Home, Ward and Capacity mock-ups and their 13 recommendations?" in the Ward Flow thread "Redesign Home, Ward and Capacity" (review page v1.1), and "Yes to all 4" on the four build questions in the project chat. This settles the "Still open" line of D-188, which the clinical sign-off pull request records.
- **Decision:** the Home, Ward (coordinator and ward desk, bed board on a phone, All wards header) and Capacity (with the executive desk and bed meeting sheet) designs are approved, with these 13 points:
  1. **Pull the bed (clinical, see D-188):** legal status, form and observation level are filled in from the record, each showing its source. The clinician or ward coordinator pulling the bed can change any of them, and a changed value names that person as its source. A fact the record does not hold is left blank ("Not recorded"), with nothing guessed or selected.
  2. Home's Needs you loses "Waiting on others". Late planned arrivals go to Past planned time. Discharge notifications stay in Alerts.
  3. After a pull the row stays with "Undo pull · until HH:MM", and focus moves to the next row.
  4. The 85% figure reads "In use", as on Capacity, with the amber dot kept, not "at risk".
  5. "Held up" means due by tomorrow (overdue, today or tomorrow) on Capacity, Ward, the TV, the sheet and Home. Discharges keeps "any date" as its own group, and "by tomorrow" joins the window words.
  6. "Short" adds each bed type's shortfall and never subtracts a spare youth bed.
  7. Bed squares drop the 4 November coloured discharge cells. Held up is said in words on the note line, in one pattern for Ward, Capacity and All wards that moves into the kit.
  8. A shorter Capacity Overview: one hero action (Bed meeting sheet), Find a bed on the map, the forecast chart behind the Forecast card, and the Planned card only on its tab.
  9. The Ward hero's third figure is "Arrivals · today", replacing "ready by 15:00".
  10. Ward shows a quiet "Obs not recorded" count beside "Staff on constant obs" (clinical; no level proposed).
  11. Confirming an arrival with no pulled bed opens the pull step first, asking which ready bed, then the arrival. Closed beds are never offered.
  12. Arrival rows keep the legal tag as recorded, in the fix round's wording (clinical wording).
  13. Planned admissions get full synthetic names (F-148).
- **Build answers (8:51 PM AWST):** both the ward-desk clinician and the ward coordinator may pull a bed, and the record names which one did. A change on the pull form stays on the pull, shown as "changed by …", and does not update the patient record. The person is named by desk role, since there are no personal sign-ins. Points 5 and 6 are built in the system-fixes pull request; the page waves relabel.
- **Build defaults (8:56 PM AWST, "Yes to all recommendations and update coordinator"):** the Home, Ward and Capacity pull request makes no TV edits and builds the bed squares. The window word is dropped where the page title already says "now". The Home forecast line reads "Tomorrow N short · range … · From ward dates".
- **Boundary:** synthetic data only. Sets no clinical value.

## D-192. Shared design parts approved for building, wave 3, PR E (13 November 2026)

- **Date:** 13 November 2026, 8:36 PM AWST (12:36 UTC). **Decided by:** Josh, choosing "Approve all, recommended words" on the decision card in the "Redesign shared design parts" thread, after the review page https://claude.ai/artifact/6ocLc57jWNs6BKRUJKSuBL (17 items, before and after on the real app). Numbered D-192 because the master plan thread reserved it for PR E; D-174 to D-191 belong to other open PRs.
- **Decision:** build the 17 shared design parts as one PR (PR E) and record these rulings:
  1. Health-service brand colours leave every screen. A service shows as its short name in a neutral tag, or nothing where the name is already written beside it (F-78).
  2. A count shows its time window as a quiet word ("Discharges · any date") only when it differs from what the page title already says or when one strip mixes windows. Window words: now, today, by tomorrow, next 4h, next 24h, last 24h, this week, since 07:00, any date. Which window each count uses stays with F-105.
  3. Undo messages carry one clock time ("Undo until 10:47"), sit bottom-right on desktop and above the pinned bar on phone, and Undo stays on the row for the whole window. The window stays at today's stated 5 minutes.
  4. Words: Tools "Suggested now" becomes "Needs you"; ED Who to call "Suggested next step" becomes "Next escalation step"; Home and Capacity "Forecast" and "likely" become "From ward dates" (the forecast line drops "likely").
  5. A desk never sees a button it can never use; one quiet line names who does it. A button unavailable for now keeps its reason drawn under it, on phone too.
  6. Every enlarged or full-screen view carries a small neutral "Synthetic data" tag.
  7. The Demo panel puts the clock, a Pause and Reset demo first; phone Tools gains a Help row; viewing as another desk shows a slim bar with "Back to coordinator".
- **Why:** these fix approved audit findings (F-03, F-39, F-49, F-54, F-57, F-60, F-61, F-62, F-78, F-94, F-103, F-109 and design critique v2 items 19 to 23) once, in the kit, so every page inherits them.
- **Boundary:** synthetic data only. No clinical value, clinical rule or safety wording changes. Undo logic, desk permissions, focus paths, count definitions and the header progress label are built in PR C; PR E adds the shared look and kit parts. Approves no release.

## D-193. Checked travel times wait until after the demo (13 November 2026)

- **Date:** 13 November 2026, 8:36 PM AWST (12:36 UTC). D-192 is claimed by open PR #1658, the shared design parts pull request. **Decided by:** Josh, in the Ward Flow project chat ("Please defer the travel times").
- **Decision:**
  1. No checked travel times are added before the demo. The app keeps showing only checked travel bands (D-174), so every pair reads as not checked and the Out of area page lists nobody as far from home, saying how many people have no travel time recorded.
  2. Checks that need a travel band test that honest "not recorded" state instead of failing. They are not skipped or disabled. Their full paths come back when checked times are added.
  3. This replaces the Fixes thread's recommendation to supply one checked time before the demo.
- **Boundary:** sets no clinical value and adds no travel time.

## D-194. Time audit answers (13 November 2026)

- **Date:** 13 November 2026, 9:16 PM AWST (13:16 UTC). **Decided by:** Josh, "Yes to all recommendations" in the Ward Flow project chat, on the five calls from the thread "Audit and fix time handling".
- **Decision:**
  1. **ED wait ladder names (clinical, built in the clinical pull request):** the four values-register entries are renamed to match the D-108 ladder: 3 hours, step 1 "Ask wards"; 8 hours, step 2; 24 hours, step 3; 48 hours, step 4 "Tell the executive on call". The values do not change.
  2. **TV legal board "Ending soon" (clinical, built in the clinical pull request):** it uses the signed 3-hour "due soon" value instead of an unsigned 24-hour window.
  3. **Waits over 24 hours (clinical display rule, built in the clinical pull request):** they go back to neutral, per D-24, on the TV and the Delays board.
  4. **"One shift" wording (clinical register wording, built in the clinical pull request):** the break-glass and cover lengths stay at 12 hours, and the words say "12 hours", not "one shift".
  5. **Training clock (product, built in the system-fixes pull request):** the signed-in site keeps the scripted 10:42 clock, with +15 min in training, as intended under D-150. The header labels it "Training clock".
- **Also (enforces D-93, no new ruling):** a legal "as typed" line shows the date, never "N days ago" or "in N days".
- **Boundary:** no signed number changes.

## D-195. Merge each pull request when its checks pass (13 November 2026)

- **Date:** 13 November 2026, 9:29 PM AWST (13:29 UTC), with the plan changes approved at 9:41 PM AWST (13:41 UTC). **Decided by:** Josh, in the Ward Flow project chat: the direction at 9:29 PM, then "Yes to all recommendations" on the plan changes that follow from it (plan thread, fix-plan-all-issues.md "Critical path" and stress-test points 2, 6, 7 and 10).
- **Decision:** the fix round has no calendar dates. Each pull request merges as soon as its build and checks pass, and Josh's sign-offs happen when each item is ready. The 22 November freeze (D-184) stays as the latest cut-off.
  1. The shared design parts and the Home, Ward and Capacity pull requests arm auto-merge only together, at Josh's joint go. Until then, the shared design parts pull request is merge-ready, not armed.
  2. Time-audit fixes go into the system-fixes pull request until its final test run starts.
  3. F-101: the system-fixes pull request builds the Change button and the Undo timing; the clinical pull request adds the labels only.
  4. There are two script walks on the clinical pull request's build before Josh's clinical go.
  5. Audit prompts 18 and 11 run after the release that carries the last merge. Prompt 13 runs two days before the demo, and prompt 8 on the demo morning.
- **Boundary:** every gate stays: tests, auto-merge only, no stacked pull requests, the D-number ledger and the release rule (only the daily release or Josh's "release now" moves the live site).

## D-196. Threads decide on their own to keep work moving (13 November 2026)

- **Date:** 13 November 2026, 9:49 PM AWST (13:49 UTC). **Decided by:** Josh, in the Ward Flow project chat: "can you tell all threads to work autonomously and make decisions on their own without me to keep work moving efficient and as fast as safely possible".
- **Decision:** where a thread would normally ask Josh, it takes its own recommendation, records it (with a D-number where needed) and tells the coordinator in one line.
- **Still Josh's:** clinical values and legal calls; his sign-off gates (the script re-check, the clinical go, the joint design go, "release now" and the release pause); anything irreversible or outward-facing; anything that would break a project rule.

## D-197. System-fixes calls taken under D-196 (13 November 2026)

- **Date:** 13 November 2026, 9:55 PM AWST (13:55 UTC). **Decided by:** the Fixes thread, under D-196. Each call is the thread's own recommendation; none sets or changes a clinical value or a legal rule. Josh can reverse any of them.
- **Decision:**
  1. **Undo messages that name no time** keep their short timer (about 8 seconds) for the demo. They promise no time, so they are honest, and longer timers would put more messages on a 1366 x 768 screen. Revisit after the demo.
  2. **Reset** clears the Tools reminders and call log for the demo day.
  3. **Reset wording (F-34):** Reset keeps the demo clock running; the confirm says it does not set the clock back to its start time.
  4. **Midland Decline and Ask for more** keep saying they are not wired in the demo.
  5. **The ward TV "Going out" panel** names its held-up count as "confirmed held up", using the by-tomorrow window (D-191).
  6. **The clinical board's "Today" lane** uses the same by-tomorrow held-up window (D-191).
  7. **The ward desk's Pull** on Home, Alerts and History arrives with the Home, Ward and Capacity redesign, not in the system fixes.
  8. **Guard registers:** the new time constants are entered in the existing guard registers with their reasons.
  9. **After the demo:** reserving space for the transport form's legal-reason field (F-106), and the duplicate-patient check on a given name alone (F-119, with the Add patient fixes).
  10. **Network bed counts** stay visible to every desk as now; the counts are totals, not patient detail.
  11. **Zone words:** the demo's board clock and the times it stamps say "demo time"; the signed-in site says "AWST" (F-113). Typed-time form labels follow the same rule, and the Help glossary says so.
  12. **Community sample days** use the house day format ("Thu 23 Sep").
  13. **The sample day's closed ward** is never one that open asks are waiting on (A16-17), and never a ward that already carries another adverse example.
  14. **Worked examples** stay off until switched on in Tools (A16-14). The demo script's Setup step switches them on, so the demo is unchanged and a fresh board shows only the base day.
  15. **Code seams:** the new shared date formatter (`wf/format`) and the offline boundary for the health check are entered in their registers as recorded.
  16. **Month words:** dates keep the Australian "Sept" from the shared formatter.
  17. **Comparison tables:** a "Dates met" cell whose two counts are both withheld reads "not shown", not "an unstated number of an unstated number met"; one withheld count keeps the F-55 sentence.
  18. **Tomorrow's short** adds each bed kind's shortfall too, the same rule as today's (D-191 item 6), so the headline equals the sum of the kinds shown beside it and never nets off a spare youth bed (Audit G FM-8). This applies on Capacity (the network forecast and its scenarios). The Ward page's own tomorrow line keeps the plain sum for now, because it shows one ward, and the by-kind code would push it past its phone size limit; it follows after the demo.
  19. **Ward page "Discharges today"** counts only open releases dated today; a past-date release stays under "Past date" (F-151, Audit G FS-1).
- **Boundary:** clinical values, legal calls, Josh's sign-off gates, anything irreversible or outward-facing, and project-rule exceptions still go to Josh.

## D-198. One owner per screen for forecast words, and "reserved bed" retired (13 November 2026)

- **Date:** 13 November 2026, about 10:00 PM AWST (14:00 UTC). **Decided by:** the "Plan fixes for every audit finding" thread under Josh's standing autonomy direction (D-196), not by Josh. It settles review item E-1 on PR #1658 and the overlap between PR E and PR F.
- **Decision:**
  1. One owner per screen for the D-192 ruling 4 words "Forecast" and "likely". PR F changes every page-level line (Home planned list, the three Capacity files, the Ward phone row). PR E changes only the shared kit words and the Home beds-gap line. The TV line goes in PR C if it fits, otherwise after the demo.
  2. The Home ED-wait row reads "18 reach 24 hours in ED by tomorrow unless placed", and "Forecast · 10 at Armadale ED · See who" becomes "From ward dates · 10 at Armadale ED · See who". PR F builds both.
  3. "reserved bed" joins the word list's banned words (say "Pulled", D-81). The one ED medical-deterioration safety line that uses it stays word for word, as a listed exception, and goes on the clinical sign-off sitting list.
- **Why:** two PRs editing the same lines would clash and could leave a page half-changed; "reserved bed" means the same as Pulled and confuses the bed states.
- **Boundary:** wording only. No clinical value, clinical rule or safety wording changes; the safety line is untouched until the clinical sitting rules on it.

## D-199. ED and Ward phone limits raised past the allowance (13 November 2026)

- **Date:** 13 November 2026, 11:37 PM AWST (15:37 UTC). D-198 is claimed by open PR #1658. **Decided by:** Josh, choosing "Yes, raise ED and Ward by ~7 KB" on a decision card in the Fixes thread.
- **Decision:** PR C (#1660) raises the ED page's phone script limit from 538.5 to 545.5 KB (+7.0) and the Ward page's from 618.2 to 625.4 KB (+7.2), past the 5 KB a pull request may add without asking (D-82, D-111).
- **Why:** both pages' own code is the same size as main; the growth is the shared script every page loads (real fix and time-audit code), after a trim that took 6 to 20 KB off every page. The next lever, swapping `tailwind-merge`, is too large a change before the demo. Detail: `docs/script-budget-history/2026-11-13-pr-c-system-fixes.md`.
- **Follow-up (14 November 2026, 12:46 AM AWST, 16:46 UTC):** Josh chose "Yes, raise Ward, ED, Referrals" on a second card in the Fixes thread, after the CI fixes added about 0.3 KB to the shared script (the Ward desk's bed seats, F-150). Final limits: ED 545.8 (+7.3), Ward 625.6 (+7.4), Referrals 595.3 (+5.4, past the 5 KB allowance).

## D-200. Shared design parts and the Home, Ward and Capacity redesign go live together (13 November 2026)

- **Date:** 14 November 2026, 12:48 AM AWST (13 November, 16:48 UTC). **Decided by:** Josh, "Please go ahead with all your recommendations", taking the coordinator's joint-go recommendation for PR E (#1658) and PR F.
- **Decision:**
  1. The joint go for PR E and PR F comes after the 6 am Perth release on 14 November, so the two never reach the live site one without the other. D-201, seven minutes later, gave the go and lets the merges run overnight on its own conditions.
  2. Until that go, each stays ready (checks green, reviewed) with auto-merge off. At the go both are armed; whichever merges second carries the FM-13 change (the Home pull message passes its Undo time to the shared toast).
  3. They go live together at the next normal release. If the second merge looks likely to run past 9 pm Perth (21:00 UTC), the coordinator is told at once, so Josh can pause the release.
  4. Before the go, the two are walked together locally at 1366 x 768.
- **Why:** E changes the shared parts F's pages are built from. Shipping one without the other would show the room half of each design.
- **Boundary:** a release-timing ruling only; it approves no release and changes no clinical value.

## D-201. Overnight merging without Josh (13 November 2026)

- **Date:** 14 November 2026, 12:55 AM AWST (13 November, 16:55 UTC). **Decided by:** Josh, "Go ahead with all recommendations and autonomously and ensure you autonomously merge the GitHub PRs as well overnight", as worded by the plan thread in `merge-day-checklists.md`.
- **Decision:** the joint E and F go (D-200) is given, and the owning threads merge their own pull requests overnight, by auto-merge only:
  1. PR C (#1660) merges itself when green. The clinical PR (#1656) stays held.
  2. PR E (#1658) and PR F each get ready on their own: checks green, must-fix review items closed, merge checklist items 1 to 8 done, including the joint local walk at 1366 x 768.
  3. E arms first, and only once F is also ready and F's local trial of main with E passes. After E lands, F merges main in, takes the FM-13 change (the Home pull message passes its Undo time to the shared toast), goes green and arms.
  4. E arms by 3:30 AM AWST (19:30 UTC) at the latest, so both can go live together at the 6 am release. Past that time neither arms until the 6 am release has run, and both merge during the day; D-200 still holds.
  5. If F looks like missing 5:30 AM AWST (21:30 UTC) after E has landed, the coordinator is told at once.
- **Why:** Josh asked for the merges to go ahead overnight without him, while D-200 keeps the two designs reaching the live site together.
- **Boundary:** merge timing only. It approves no release, and changes no clinical value and no hold.

## D-202. Joint go summary recommendations (14 November 2026)

- **Date:** 14 November 2026, 1:19 AM AWST (13 November, 17:19 UTC). **Decided by:** Josh, "Go ahead with all recommendations" on `joint-go-summary.md`, relayed by the plan thread.
- **Decision:**
  1. "Obs not recorded" on the Ward page stays as built: it also counts beds pulled for a person who has not arrived, as "Staff on constant obs" does (26 October rule). Its screen-reader label says "including pulled beds".
  2. The ED site page and Statistics may rise more than 5 KB over PR C's phone limits in the shared design parts PR (#1658), but only after a trim has been tried. The final measured figures are recorded in `script-budget.json` and its history.
- **Why:** the reviewer's and the plan thread's recommendations, accepted together so the joint E and F go (D-201) is not held on a sub-kilobyte size gap.
- **Boundary:** the clinical questions in the same summary (observation level on every pull) are not covered; they are asked separately. No clinical value changes.

## D-203. Scoped takeover of PR E and PR F by the E thread (14 November 2026)

- **Date:** 14 November 2026, 7:01 AM AWST (13 November, 23:01 UTC). **Decided by:** Josh, on a decision card from the plan thread.
- **Decision:** the E thread (Audit C) takes over PR F (#1659) as well as PR E (#1658) until both merge, because the F thread had reported a usage limit. It may arm auto-merge on both under D-201. No other PR, no force-push, no stacking.
- **Why:** so the joint E and F go (D-200, D-201) did not wait days for the F thread.
- **Undone:** at 23:16 UTC the same day, because the F thread resumed; F stays with its own thread. The E thread pushed nothing to F's branch and passed its F work over as patches.

## D-204. A signed triage shows the desk's name (14 November 2026)

- **Date:** 14 November 2026, 7:05 AM AWST (13 November, 23:05 UTC). D-203 is claimed by open PR #1659. **Decided by:** Josh, "Yes to all recommendations above. Defer 2 and 3" in the Ward Flow project chat, answering the coordinator's post whose first item recommended that a signed triage show the desk's name instead of the nurse persona's name (go question 4 for the held clinical PR).
- **Decision:** a signed triage, its summary, its iSoBAR "Identify" line, the patient card's "Signed … by" line and an unsigned triage's "Reviewer" name the desk by its own name ("Bed coordinator", "ED clinician", "Nurse in charge"), never the desk's sample persona. This changes how D-189 item 9(f) (A9-29) is shown; the signer is still read from the saved record's desk.
- **Still open:** the words for fit to travel recorded as "Not cleared" (go question 2). The held clinical PR keeps its hold until Josh says "lift the hold".
- **Boundary:** synthetic data only. No clinical value, threshold or rule changes. Built in the held clinical PR (#1656).

## D-205. Release now once each PR merges (14 November 2026)

- **Date:** 14 November 2026, 7:15 AM AWST (13 November, 23:15 UTC). **Decided by:** Josh, "Please launch everything live that is working now".
- **Decision:** a release-now go (the "release now" of AGENTS.md hard rule 12) for each PR as it merges, once its merge commit's main CI passes. The plan thread runs the release; E and F still go live together (D-200).
- **Boundary:** only work that has merged and passed main CI. No clinical value changes, no live data writes.

## D-206. CodeQL storage alerts are false positives for the demo (14 November 2026)

- **Date:** 14 November 2026, 7:15 AM AWST (13 November, 23:15 UTC). D-203 is claimed by open PR #1659. D-205 is claimed by open PR #1659. **Decided by:** Josh, in the Fixes thread ("Go ahead with recommendations"), on the recommendation to dismiss these alerts.
- **Decision:** the CodeQL "clear-text storage of sensitive information" alerts #35, #36, #37, #39, #40, #41, #50 and #51, and the "incomplete string escaping" alert #30, are dismissed on GitHub as false positives with the note "synthetic demo data only; revisit in privacy review before real data". Every other alert raised on PR C (#1660) is fixed in code in PR #1661.
- **Why:** the prototype keeps its synthetic demo day, drafts, "since last look" snapshots, chosen service and mockup device in the browser's session or local storage by design; nothing stored is a password, token or real patient record. For #30, escaping backslashes would print doubled backslashes inside the code spans of `docs/skipped-tests-inventory.md`.
- **Follow-up:** the privacy review required before any real data covers what the browser stores, for how long, and on shared ward PCs. A dismissal can be reopened.

## D-207. Fit to travel recorded as not cleared, and the clinical go (14 November 2026)

- **Date:** 14 November 2026, 7:12 AM AWST (13 November, 23:12 UTC). D-205 is claimed by open PR #1659. **Decided by:** Josh, in the Ward Flow project chat: "1. Lift the hold", then "Fit to travel: not cleared" in answer to the coordinator's question on the words for go question 2, and "Go ahead with recommendations" in the clinical PR's thread.
- **Decision:** when medical clearance is recorded as "Not cleared", the fit to travel check at booking, Mark handover ready, collection and arrival reads "Fit to travel: not cleared", and a saved reason names it the same way. "Fit to travel not recorded" stays for a journey with no clearance recorded. Both still ask for a reason and never block (D-187 item 10, D-189 item 9(e)). This settles go question 2.
- **Clinical go:** Josh lifted the hold on the clinical PR (#1656). It may merge once its required checks pass. Review questions 2, 4 and 9 and the items labelled "not signed", "to verify" or "not stated" stay open for the clinical sitting.
- **Boundary:** synthetic data only. No clinical value or threshold changes. Built in #1656.

## D-208. Appraised findings: fix three real display bugs (14 November 2026)

- **Date:** 14 November 2026, 8:40 AM AWST (00:40 UTC). **Decided by:** Josh, "yes to all recommendations" on the appraisal of a pasted list of 15 findings, in the thread "Check which remaining-issue findings are real".
- **Decision:**
  1. Fix in one small PR: ED bays show "Bay not recorded" instead of a number made up from the record's id (B3); the TV unlock box in the demo no longer asks for a password it does not need (A2); a repeated acknowledgement of the same task by the same role is not saved twice (B7). This replaces the event's earlier append-only design: the record names only the role, and only the coordinator acknowledges, so a second entry added nothing but a duplicate.
     Ward bed tiles (B4) are not changed. The positional tags the finding named were never shown; the tiles follow the bed-number rule (locked beds are numbered first) that the placement checks also use, so relabelling tiles alone would offer placements the checks then refuse. The remaining gap, a stay whose recorded bed kind differs from its bed number's kind, needs the bed seating to change and waits until after the demo.
  2. Test accounts: one read-only Supabase read of the 8 test accounts' access dates. Result: all expire 2 February 2027, so the reported 16 November expiry was wrong and nothing changes.
  3. The old audit worktree on Josh's PC stays until after the demo. A read-only check found its branch merged into `main` (#1501) and no unsaved files, so removing it later loses nothing.
- **Why:** of the 15 findings, 3 were wrong, 1 already fixed, 1 a repeat and 3 only partly right. These were real and cheap to fix, and B3 cut against D-21 (show only what is recorded).
- **Boundary:** no clinical value or rule changes.

## D-209. Nine open clinical items signed, avoiding restriction and friction (14 November 2026)

- **Date:** 14 November 2026, 9:38 AM AWST (01:38 UTC), and 9:48 AM AWST (01:48 UTC) for item 3(b). D-208 is claimed by open PR #1663. **Decided by:** Josh, in the "Sign the nine open clinical items" thread: "Yes to all recommendations please. But avoiding restrictive and friction also. Dont do anything to interrupt the PR1659", then "Intermittent, every 30 min" on the decision card for Saoirse's observation level.
- **Decision:** the nine items D-189 left open (sitting questions Q17, Q18, Q20, Q22, Q23, Q32, Q40, Q41 and Q42), plus Q28, are settled as follows. Where a choice was open, the least restrictive reading that adds no new block was taken.
  1. **Calder Ridgeholt and long ED waits (Q17).** Left as is for the demo; the script still avoids her row. Whether a tier 1 person may sit with no form time, review, ward asked or reason stays open for after the demo.
  2. **Keira Pellingworth (Q18).** Tier 1, a locked bed and General observation are signed as reading true together; her referral records no risk flags; a Form 1A (referral for examination, written in ED four hours before now) is on file before her Form 3B. Still open: the printed Form 3B is headed "Forms 3A and 3B", so whether a 3A also belongs is for the sitting.
  3. **Saoirse Loxbury (Q20).** (a) She is referred to a locked ward, Graylands Adult Secure, not SJGM Adult Open; her need reads Secure. (b) Her ED observation is Intermittent, every 30 minutes (the register's longer intermittent interval).
  4. **Cyril Coldharbour (Q22).** Kept as written, including legal status "Not recorded" and medical clearance unconfirmed. Act 3 is unchanged.
  5. **Observation levels on the sample day (Q23).** Every ward stay stays General, and the "sample mix, not clinical guidance" label stays. No stay is made "Not recorded".
  6. **Aboriginal status and interpreter need at signing (Q32).** Warn-only, as now; signing never waits for either.
  7. **Triage see-by windows (Q40).** B 2 hours, C 12 hours, D 48 hours and E 2 weeks are signed for the prototype, matching WA Health's "Triage to Discharge" Mental Health Framework, Version 11.0 (9 August 2021), Appendix 1, Crisis Triage Rating Scale, word for word. The follow-up choices and "Review risk by" stay unsigned.
  8. **Crisis numbers (Q41).** The five numbers read "checked by Josh on 14 Nov 2026", checked against the Mental Health Commission WA Helplines page (last updated 3 November 2026). No numbers are added. They stay copy-only text (D-189 item 5).
  9. **Authorised hospitals (Q42).** Sixteen sample wards read "Involuntary admissions: authorised (Chief Psychiatrist register, 7 Sep 2026)"; the two SJG Subiaco wards read "not on the authorised register (7 Sep 2026)"; the four invented older adult wards at RPH, SCGH, FSH and Graylands, and every demo-network ward, read "not stated". Authorisation steers no placement: the fit check, bed finder, held beds, transport and arrival are not filtered or refused by it (D-189 item 8 stays off).
  10. **Transport paperwork (Q28).** Deferred to the sitting after the demo; the "rule not signed" label stays. A Form 4B on its own does not clear the order check, as today.
- **Why:** items 7, 8 and 9 match published WA sources read on 14 November 2026. The rest are Josh's clinical calls on synthetic stories. "Avoiding restrictive and friction" means no new block, no steering and the least restrictive observation level that fits.
- **Boundary:** synthetic data only; a prototype, not validated clinical decision support. No real authorisation status is relied on for a placement.

## D-210. Mechanics and clock audit fixes (14 November 2026)

- **Date:** 14 November 2026, 9:53 AM AWST (01:53 UTC). **Decided by:** Josh, in the "Fix app mechanics and clock faults" thread: "Yes to all recommendations. Except ED will alert the ED team screens please and clinician roles. fix everything in 1 PR", answering the ten questions of the mechanics and clock audit (`audit-handover/mechanics-clock-audit-2026-11-14.md`).
- **Decision:**
  1. **Offline saves** record the time the person acted. The engine accepts it only when it is not later than the server's time and not earlier than the record's last change; history shows "entered offline, sent HH:MM". Otherwise the save is refused and the person is asked to redo it.
  2. **A typed legal expiry that passes** for a person admitted on a form raises Act now on the ward desk, a coordinator alert and the Forms counts. For a person still in ED, the alert also reaches the ED team screens (ED desk) and the ED clinician role, as well as the coordinator.
  3. **TV legal board** matches Forms, Delays and ED: red "Act now" within the Settings urgent warning, amber "Ending soon" within the Settings soon warning. The TV "forms ending soon" figure counts amber rows only.
  4. **Tier overdue waits** count from the referral time. With no referral time, the screen says "Referral time not recorded" and never shows the person as overdue. No clinical value changes.
  5. **Stay and patient legal status:** the TV uses the patient page's rule and the same "statuses differ" mark.
  6. **Form 3E** is recorded one way only, as a new form that supersedes the 3A. A 3C after a 3D is refused.
  7. **Pull form for an ended form** shows "Form 3B ended HH:MM" as information and leaves the form "Not recorded". An ended form or a passed expiry is never copied forward.
  8. **A bed held for someone admitted elsewhere** is flagged on the coordinator's Home with an offer to release the bed. The admission is not blocked.
  9. **Repatriation security** follows the stay's locked or open bed type, not the ward.
  10. **One PR** for every finding of the audit (H1 to H10, M1 to M15 and the Lows), each with a guard test, fixed at the shared rule rather than per screen.
- **Why:** the audit found five root mechanisms behind about 45 faults: the same fact worked out separately on each screen; steps stamped when delivered, not when done; linked records not changed together; capacity mixed into suitability checks; and a setting inferred from the records a desk can see.
- **Boundary:** synthetic data only. No clinical value or threshold changes. Josh chose to merge before the 22 November freeze (14 November, 04:50 UTC).
- **Phone size (decision card, 04:33 UTC):** Josh allowed Home and Ward's phone script limits to rise 5.4 and 5.5 KB, past the 5 KB a PR may take alone, because the growth is the engine fixes every screen loads (`docs/script-budget-history/2026-11-14-pr1670-mechanics-clock-fixes.md`).
- **Movement phone size (decision card, 05:31 UTC):** after #1668 merged first, Josh allowed Movement's phone script limit to rise 5.1 KB over main's (627.8 to 632.9), 0.1 KB past the allowance, as the same shared-engine growth.

## D-211. Not medically cleared pauses onward transfer (14 November 2026)

- **Date:** 14 November 2026, 12:16 PM AWST (04:16 UTC). **Decided by:** Josh, "continue with all recommendations" on the plan thread's recommendations for the fit to travel check, then, in the Ward Flow project chat, "yes go ahead with this" on option 1: keep the rule that a not-cleared journey cannot go on, and fix the screen text that offered a way round it.
- **Decision:** when medical clearance is recorded as "Not medically cleared", onward transfer stops until the patient is cleared again. The engine's refusal of booking, Mark handover ready, transport accepted, en route, collected and arrived stays. The screens now match it: the booking form and the handover, collection and arrival checks no longer offer "save without a reason" or "Continue without a reason", and say "Onward transfer is paused until re-clearance." instead. "Fit to travel not recorded" (nothing recorded) is unchanged: a reason is still asked for and never required (D-187 item 10, D-189 item 9(e)).
- **Why:** D-207 said a not-cleared journey asks for a reason and never blocks, but the engine already refused the step, so the screens offered a way on that could not work. A recorded "not cleared" is a clinical stop, not a missing fact.
- **Replaces:** the "never block" wording of D-207 for "not cleared" only. D-207's words "Fit to travel: not cleared" stay.
- **Boundary:** synthetic data only. No clinical value or threshold changes. Built in #1668.

## D-212. The master stress test replaces Audits 6, 11 and 18 (14 November 2026)

- **Date:** 14 November 2026, 12:43 PM AWST (04:43 UTC). **Decided by:** Josh, "ok go ahead with next recommendations please" on the Audit G thread's recommendation, then at 12:44 PM AWST (04:44 UTC): "1920×1080 run at this size also as this is the most common size for monitors in hospital", and at 12:47 PM AWST (04:47 UTC), in the Ward Flow project chat, asking to add Audit 6: "Please send audit 18, 11 and audit 6 as well please with the full walkthrough".
- **Decision:**
  1. The master stress test replaces Audits 6, 11 and 18; their checklists and full walkthroughs are handed to it. If the stress test has not run by the 22 November freeze, the fallback is one session on Josh's PC.
  2. Screen checks and demo rehearsal run at 1920 by 1080, the most common hospital monitor size, as well as at 1366 by 768.
- **Why:** one run instead of three covers the same ground with less waiting before the demo.
- **Boundary:** no app, clinical value or data changes. Recorded in #1668.

## D-213. The clock follows Perth time from one setting, and the stored signed-in world is moved onto it (14 November 2026)

- **Date:** 14 November 2026, 9:53 PM AWST (13:53 UTC). **Decided by:** Josh, in the Ward Flow project chat, answering item 1 of the stress test questions: "The clock should easily be able to be changed. However, please link it automatically to AWST (Perth time), also ensure it is live please and this is reflected in the demo."
- **Decision:**
  1. The app's time zone is one setting, `WARD_TIME_ZONE` in `src/lib/ward-time-zone.ts`, default `Australia/Perth` (AWST). Every clock face, day zero, typed time and date label reads it; offsets come from the zone's own rules. The backend config keeps one copy, held equal by a test.
  2. The stored signed-in world, made by an older build with day zero at a UTC midnight, is moved onto the Perth midnight before it: day zero 8 hours earlier, every stored instant 8 hours later, so every real moment stays put and only the clock face changes (findings Desks-R5-1, Together-X1a-2). The one-off data fix is `backend/ward-flow/proposals/019-perth-day-zero.sql`, run by hand on a copy first, then on the named Ward Flow database in a quiet window, with a backup and an exact rollback.
  3. The public demo already starts its day at the Perth midnight of the day it opens, through the same setting, and keeps its scripted 10:42 opening time so the script's timed moments line up (D-190 stands). Josh, 10:26 PM AWST (14:26 UTC), decision card: "Keep scripted 10:42 start".
- **Why:** every signed-in board, referral, letter and legal time read 8 hours behind Perth.
- **Boundary:** synthetic data only. No clinical value changes. Not a user-facing Settings control.

## D-214. Stress test answers: severity, legal wording, stale counts, the site bed manager and one Beds ready figure (14 November 2026)

- **Date:** 14 November 2026, 9:53 PM AWST (13:53 UTC). **Decided by:** Josh, "Apart from those 2, yes to all recommendations", and for item 7: "Ensure all screens align because I need the behaviour determining those numbers to all align".
- **Decision:**
  1. A diversion back to ED that the ward and ED never see (Together-X1b-3) and the Leave page naming the wrong bed (Demo-Rules-RV1b-5) count as Critical for real records. Both are fixed.
  2. Demo script Act 6A says the signed D-209 item 9 "authorised" wording; the worked examples stay off until the legal-mismatch display is live.
  3. A recorded legal mismatch reads "Legal status does not match this ward. Check before moving." It shows on the ED board, patient page, Handover, and as a "Legal mismatch" chip on Movements, Search and the Capacity drawer. Display only.
  4. A ward bed count is stale after the signed 1 hour (`bedCountFresh`, D-63) on every screen. This replaces P025 (27 October 2026, option B: each ward keeps its own time).
  5. The site bed manager may confirm bed numbers (AK-A-03), and its answer page hides the referral decisions it cannot take, naming who answers.
  6. "Beds ready now" is one figure on every desk: a desk not sent a ward's records gets a count-only ready partition for it, with no person or record id (Demo-Rules-RV2-17).
- **Why:** findings from the 14 November master stress test.
- **Boundary:** synthetic data only; display and permission alignment, no new clinical threshold.

## D-215. Stress test answers for after the demo (14 November 2026)

- **Date:** 14 November 2026, 9:53 PM AWST (13:53 UTC). **Decided by:** Josh, "yes to all recommendations" (items 8 to 13).
- **Decision:**
  1. Form 3E: whether it ends the order is decided after the demo; legal form entry stays off the demo script. Until then a record after an ended order warns in plain words and never blocks (AK-L-14), and the Forms count shows only forms in force.
  2. Speed target: Home appears within 4 seconds on a weak mobile signal. A target, not a CI gate, and it does not block the demo.
  3. After the demo: every save writes one History line naming the desk that acted; one definition of a late arrival (the estimate plus the signed 1 hour, with a notice to the referrer and the accepting ward); each Statistics window and its start written into the definitions in Perth time; am/pm on screen, with the 24-hour clock kept in printed legal times.
- **Boundary:** recorded now, built after the demo (see the post-demo backlog).

## D-216. The 36 sign-off recommendations from the stress test pack (14 November 2026)

- **Date:** 14 November 2026, 9:53 PM AWST (13:53 UTC). **Decided by:** Josh, "yes to all recommendations" on item 14.
- **Decision:** all 36 recommendations tagged "Needs your sign-off" in the stress test pack (`master-stress-test/pack/recs/`) are approved as written, with these choices: Capacity draws its 90% and 98% bands; the 7-day discharge-plan prompt is added; the default broadcast length is 4 hours; one figure dictionary (R-FIGS-9) and one permission source (R-STRUCT-1) come after the demo. The items built in this PR and those deferred are listed in the post-demo backlog.
- **Boundary:** synthetic data only. No signed value changes except as named in D-214.

## D-217. Hand check answers: medical trips and Undo after referring (14 November 2026)

- **Date:** 14 November 2026, 10:13 PM AWST (14:13 UTC). **Decided by:** Josh, "Yes to all recommendations", on the hand-check questions.
- **Decision:**
  1. A medical trip expected to last over 24 hours flags the held bed for review when the trip is recorded, as D-106 describes. Words only; the bed is never freed automatically.
  2. The public demo offers Undo after the coordinator refers a person to wards, as the signed-in site does.
- **Boundary:** synthetic data only. No value changes.

## D-218. No legal disclaimer wording on screens (14 November 2026)

- **Date:** 14 November 2026, 10:31 to 10:33 PM AWST (14:31 to 14:33 UTC). **Decided by:** Josh, in the Ward Flow project: "Remove all the excessive wording in the designs in tables. I. E like within 1 hour as typed for forms etc", "Remove all the legal wording like as typed not legally checked please", "Remove from the actual build and mockups", "Remove all things like this" and "Avoid all the excessive legal phrasing in the actual site please!"
- **Decision:** a standing wording rule for every screen, table, print, copied text, help page and tour step. Ward Flow does not add hedging or disclaimer phrases to what it shows, and a table cell holds the value or a short label only, with any needed explanation once in the header or a tooltip: no "as typed", "not legally checked", "legal limits not checked here", "as entered", "not verified" or "check before relying", and no paragraphs whose only job is to disclaim. A legal form time reads "Ends 15:42" or "Ended 15:42".
- **Second rule (14:39 UTC):** Josh, "Extra wording should play a role. Not just policy or empty etc". Words stay on a screen only if they tell someone what to do or prevent a mistake. Policy text, filler, empty-state padding and anything the screen already shows are cut. A desk that can never use an action sees no button and no "who does this" line (D-192 item 5 hides the button). Josh's ruling on each open recommendation (remove, a one-word label or tooltip, or keep one short line) is copied into [backlog.md](backlog.md) for the build that takes it up.
- **Arrival form (14:59 UTC):** Josh, "Yes to your recommendation". The arrival plan form no longer promises that a late notice goes to the referrer and accepting ward (Together-X1b-5), because none is stored yet. The notice itself is built after the demo with the one late-arrival rule (D-215).
- **Replaces:** the wording parts of D-93 ("Ends 15:42 as typed"), D-139 (leave return times "as typed") and the "Not legally checked" notice kept in the 11 November Legal forms sign-off and the Triage banner. Their behaviour is unchanged.
- **Unchanged:** D-93 and D-70 behaviour. A legal time is still shown only as the time a person entered from the form, never as a countdown, and nothing works out a Mental Health Act period. Warnings that ask someone to act stay, with their words: the legal status mismatch warning, "Check authorisation", "Save Form N anyway", the real-identifier note, and the "within 1h", "within 3h" and "passed" band words beside their colours. "Not recorded" stays, because it is a state, not a disclaimer. The one synthetic data line in the footer stays (hard rule 1).
- **Boundary:** wording only. No clinical value, threshold or saved field changes.

D-219 is claimed by open PR #1673. D-220 is claimed by open PR #1673. D-221 is claimed by open PR #1673. D-222 is claimed by open PR #1673. D-223 is claimed by open PR #1673. D-224 is claimed by open PR #1672. D-225 is claimed by open PR #1672. D-226 is claimed by open PR #1675. D-227 is claimed by open PR #1675. D-228 is claimed by open PR #1675.

## D-229. Demo Pause holds Board time, and seeded wait lists match the engine (14 November 2026)

- **Date:** 14 November 2026, 11:00 PM AWST (15:00 UTC). **Decided by:** Josh, in the Ward Flow project chat, asking for every open stress-test issue to be fixed ("Otherwise confirm all issues and launch appropriate threads to fix and address all of them", 14:56 UTC), then "Yes to all recommendations" (15:02 UTC). Built in the "Fix demo and seed data issues" thread.
- **Decision:**
  1. **Pause holds Board time** (stress test D1a-S-1). On this device's demo, the Demo panel's Pause stops Board time as well as freezing the page's lists, and Resume carries on from the paused minute. +15 min and +1 hour still move a paused clock. Reset or a scenario card ends the pause and starts the new day at the paused minute. Loading a file, a restored save or a reload also ends it; after a reload the paused minutes count as time passed. The shared board's clock is the server's, so there Pause stays the page's own pause. This replaces "Pause does not stop Board time, by design" (INV-SCENARIO-011).
  2. **Seeded wait lists are written as the engine writes a waitlist answer** (D1a-E-1): a live referral, a "waitlisted" answer and, for the worked example, the decline that carries its reason. Worked example RD-05 and the standard day's two Royal Perth Adult Secure wait lists now show on the ED board and person page as they do on the ward. A seed check covers every scenario, with and without the worked examples.
  3. **A refused demo day with more patients than beds says why** (RV2-18): "a ward holds more patients than it has beds", as the two-ward-stays refusal already did.
  4. **Seeded ward bed counts stay fresh through the demo.** A count older than the signed bed count time refuses a pull (D-214), and the presenter may wait up to 15 minutes after Reset, so each seeded count is confirmed 6 to 15 minutes before the start. Graylands Older Adult stays stale on purpose, as the ward the script names as still to confirm.
- **Handed on:** the header step count after Mark handover ready (REG2-6, card X12) and the person page for a named ward wait-list stay with no referral (Lead-VM-1) go to design Lane D, whose patient-page work replaces that count and owns that page.
- **Boundary:** synthetic data only. No clinical value or rule changes.

The next free number is D-230.
