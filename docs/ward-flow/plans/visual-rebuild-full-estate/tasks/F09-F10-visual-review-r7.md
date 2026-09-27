# F09/F10 visual review r7

Date: 2026-09-13  
Reviewer: independent visual reviewer (`/root/hub_inventory`)  
Scope: Transport officer, On-call and contacts, Alerts, and Legal forms  
Evidence level: served light-theme screenshots at 1440 px and 390 px; source inspection only where needed to separate presentation gaps from engine requirements

## Verdict

No P1 issue is visible in the supplied first-viewport captures. The four screens remain materially short of the drawings in structure and density. The shared cause is that all four page roots still use the legacy `wardTokens` screen treatment and omit the rebuilt-screen marker, leaving white ground, heavy borders, old typography, and obsolete phone top spacing. Alerts also retains a condition-definition-first information hierarchy where the drawing calls for alert records first.

The fixes below must preserve the engine's real counts, scope statements, absence states, refusal behavior, legal grouping, and contact limitations. Fixture names and counts in the drawings are not acceptance targets.

## P2 findings

### 1. All four screens retain the legacy frame and an obsolete phone-bar reserve

**Evidence.** At 1440 px, each app screen paints a white page with heavy, dark panel strokes and older heading density, while its paired drawing uses the third-edition ground, softer attached panels, and compact headers. At 390 px, every app capture has a large blank band between the end of the in-flow shell chrome and the first page content; the drawing leaves only normal page spacing. The gap is especially clear above Transport jobs, the On-call warning, the Alerts warning, and the Legal forms warning.

**Source check.** The four roots still compose `wardTokens` and do not expose `data-ward-design="third-edition"`. Their local CSS also retains a `max-width: 40rem` `.screen` top padding based on the former phone-bar reserve. The current shell is already in flow, so that reserve is no longer a behavior requirement.

**Correction.** Opt each page root into the established third-edition marker/token carrier and canonical ground treatment. Remove or reset the obsolete narrow-screen top reserve in each page-local stylesheet. Preserve the shared shell and the existing 48 px interaction targets.

### 2. On-call, Alerts, and Legal forms duplicate route introductions and let governance copy dominate the first viewport

**Evidence.** The shared bar already names the route, but each app repeats a large local title/subtitle after a full-width warning. On phone, this stack consumes most of the first viewport:

- On-call reaches the useful **On call now** panel only after the warning and a second **On-call and contacts** introduction.
- Alerts reaches **Needs you** only after the warning and a second **Alerts** introduction.
- Legal forms reaches **Legal forms and deadlines** only after the warning and a second **Legal forms** introduction.

The paired drawings begin with the primary work panel and keep explanatory material subordinate.

**Source check.** The warnings contain required scope, synthetic-data, legal, and contact-refusal statements. They cannot simply be removed. Each screen already has, or can use, an end-of-page provenance/disclosure surface without changing engine behavior.

**Correction.** Keep one visually hidden local `h1` for page semantics. Move the complete explanatory copy into a compact native disclosure at the existing final provenance surface: the On-call foot panel, the Alerts **What is invented and what is real** panel, and a Legal forms footer disclosure or the existing **If nobody renews it** explanatory panel. Keep the short panel-level context needed to interpret the records visible. Print must expose the full disclosure content.

### 3. Alerts is condition-definition-first instead of alert-record-first

**Evidence.** In the 1440 px app capture, **Needs you** is dominated by three large condition blocks: **Legal deadline passed**, **Every ward asked has declined**, and **Destination no longer lawful**. Their watcher descriptions and empty-state prose take more space than the actual alert record. **For other roles** repeats the same pattern. The drawing presents compact alert cards as the primary scan surface, with identity, timing, explanation, ownership/clearance context, and a short group blurb.

**Source check.** The screen already derives the alert sets independently (`legal`, `declined`, `unlawful`, `pullExpired`, `transport`, and related groups). The watched-condition definitions, measured-none sentences, and explicit exclusions are safety context, not a reason to put definitions ahead of live records.

**Correction.** Render the existing actual alert rows first in their current derived order. Move the complete watched-condition definitions, measured-none statements, and **does not watch** limitations into a compact native disclosure/footer beneath each relevant group or in the existing provenance panel. Preserve every statement, current alert count, role split, urgency wording, and absence case. Do not synthesize alerts.

### 4. Legal-form records read as flat table bands rather than inset records

**Evidence.** The app's left column uses broad full-width green deadline/reason bands beneath flat group headings. The drawing uses inset record cards whose state is integrated with each record, making identity, deadline, and action easier to scan. The current treatment amplifies the status color and panel borders over the record content.

**Source check.** The two source groups—forms with a deadline and forms without a deadline—are deliberate. Deadline-less forms cannot be placed in a single urgency ranking, so group separation and order are behavior requirements.

**Correction.** Keep both group headings, their order, and all absence text. Restyle each existing `WardRecordRow` as an inset record card and integrate its existing deadline/state treatment within that card rather than as a full-width slab. Do not introduce a global sort or infer deadlines.

### 5. Two visible route labels are less specific than their screen purpose

**Evidence.** The app shell labels are **Officer** and **On-call**, while the drawings and the local page semantics use **Transport officer** and **On-call and contacts**. At desktop width there is room for the specific labels, and the shorter names make the route less clear.

**Source check.** The Transport officer screen metadata and local semantic heading already use the full name. The navigation catalog supplies the shortened visible labels, so this is a shared navigation/chrome dependency rather than a reason to duplicate another page title.

**Correction.** Use **Transport officer** and **On-call and contacts** as the visible route titles in the top bar. A compact rail may retain a short visual abbreviation only when its full accessible name remains available.

## Required behavior and content deviations to retain

- Transport officer intentionally exposes the four real stage actions for the selected job and uses **Work this job** to select an unselected record. The phone action bar, refusal guards, and selection behavior are settled behavior; do not replace them with the drawing's simpler static control treatment.
- The Transport officer **Refused actions** surface appears only after a real reducer rejection and persists independently of the visible job filter. Its absence in the app capture is a valid state, not a missing panel. Do not add a fake empty refusal record.
- The transport corridor list must continue to show the engine's real jobs, stages, scopes, and counts. Its taller cards are partly explained by retained facts; the correction should improve hierarchy without dropping them.
- On-call must retain actual service coverage, contact availability/refusal wording, and the WACHS/private-provider distinctions. Do not invent contacts to resemble drawing fixtures.
- Alerts must retain all monitored-condition definitions, explicit exclusions, role grouping, measured absence statements, and engine-derived order/counts.
- Legal forms must retain separate deadline and no-deadline groups, all legal caveats, and the engine's real record values. Do not fabricate expiry dates or collapse the two groups into a false urgency order.

## Evidence inspected

All files are under `.superpowers/sdd/2026-09-13-visual-rebuild-full-estate/` and were viewed at original detail.

| Image                                      | SHA-256                                                            |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `transport-officer-app-1440-light-r7.png`  | `15C016C8FB139A951504B8653AA8873C166E3A4F54E748505E7FF05D2FD64C0B` |
| `transport-officer-mock-1440-light-r7.png` | `AE33B94B04CDFD71914A374022C75375F8F753D48B20712347555071DFE8583E` |
| `transport-officer-app-390-light-r7.png`   | `928975D4445A8A6901F826ED8FF06D70B9FE3C6503028DCC8C44CA0BE0676BA1` |
| `transport-officer-mock-390-light-r7.png`  | `5BB1FA6431008968EF3CF2077CE6838C2B88625456E4DEA877019C5129C91BA6` |
| `on-call-app-1440-light-r7.png`            | `CCB574A50A2896750264FFFB78C5EC64D439DF426CF8C756644291BD10468EDE` |
| `on-call-mock-1440-light-r7.png`           | `7CB3F0762309B5EC602B697EFF22E6A4521D02665CB87E4F689E09125479D014` |
| `on-call-app-390-light-r7.png`             | `C4151438FCE5561815A69FA0734B7DA1F661DD0964F2BEB368ADD2E8CD34E41D` |
| `on-call-mock-390-light-r7.png`            | `06A0ABE160DB4AB837EB9DE6C3B8DE623DFD725B962CEF443E79F6D8C79F8BEA` |
| `alerts-app-1440-light-r7.png`             | `D776BEFF4E5D49DBDDAA85B8E30B122F8AEE67BB235887933379D993ABA85356` |
| `alerts-mock-1440-light-r7.png`            | `0E649630CDB7B9F84DB1E13687FD0670BBE1632BB985EBA2A84293F698C69992` |
| `alerts-app-390-light-r7.png`              | `FEBD5935633E4618EF66655B661DDE1D12579CDBFB3853EB4C5600EF1DA06873` |
| `alerts-mock-390-light-r7.png`             | `8C8E661952010E1B11E1457B07CB0E175DC9277999AD9F871B02A3D10A2E5F37` |
| `legal-forms-app-1440-light-r7.png`        | `7291EF2A56F4BB0B68900F7FE374CD7EF50AB82AD4FF6C89495EB3F03E45F682` |
| `legal-forms-mock-1440-light-r7.png`       | `1C2980EF24449DC6F2F490C85DFD1A0314F0F8D4446A9FF913CE08EB15722F2F` |
| `legal-forms-app-390-light-r7.png`         | `5DCBF5C4044E0253DC40A9F946B75C07A2BA35050E84DB41484BB953B132F323` |
| `legal-forms-mock-390-light-r7.png`        | `5FC24EFB47717F6D551785C59C501B094A4EE3AC4F76F6659E8C3B1F39A3F32D` |

## Review limits

- These are first-viewport captures at scroll position zero, not six-cell acceptance matrices.
- Only light theme at 1440 px and 390 px was supplied. Tablet, dark theme, forced colors, print, reduced motion, and zoom were not reviewed.
- The phone captures do not prove below-fold job actions, later alert groups, the second legal-form group, disclosures, scroll ends, or fixed-action-bar content clearance.
- Desktop captures do not show the complete legal list, liaison/contact table, or lower provenance surfaces.
- No interaction evidence was supplied for keyboard order, focus return, selection, refusal handling, filters, disclosure restoration, or action results.
- App and drawing fixtures differ. Names, counts, presence/absence, and timestamps were treated as engine-authoritative rather than visual parity requirements.
- No browser actions, tests, server actions, or production-source edits were performed for this review.
