# Ward Flow — Emergency Department Rebuild & Subagent Process Checkpoint

> **HISTORICAL CHECKPOINT — COMPLETED & FOLDED.**
> This document records a transient development checkpoint from 17 September 2026. All ED rebuild tasks have since been completed and folded into the canonical ward line.

**Date:** 2026-09-17 16:08 AWST  
**Worktree:** `d:\Worktrees\Database\ward-lead`  
**Branch:** `codex/task-ward-flow-live-state-20260831`  
**Latest Git Commit:** `e65e5c867d` ("merge(ward-flow): fold re-referral additions and ward request withdrawals into lead")  
**Dev Server:** Running at `http://localhost:3606`  
**Mockup Server:** Running at `http://127.0.0.1:60178`

---

## 1. Executive Summary & Current State Assessment

1. **Current State Clean & Safe:**
   - Git working tree is clean with no uncommitted merge conflicts or unstaged diffs.
   - The merge into `ward-lead` was previously concluded and committed locally as `e65e5c867d`.
   - Core ED DOM tests pass completely: `tests/ward-ed-screen.dom.test.tsx` (34/34 passing).
   - Core ED Psychiatry Hub tests pass completely: `tests/ward-ed-psychiatry-hub.dom.test.tsx` (39/39 passing).
   - Zero raw colours across stylesheets: `tests/ward-raw-colour.test.ts` (3/3 passing).
   - Local dev server is confirmed running at `http://localhost:3606`.
   - Authoritative third-edition mockup server is confirmed running at `http://127.0.0.1:60178`.

2. **Core Visual Problem Identified & Proven via Headless Browser:**
   - Both the live screen (`/mockups/ward-flow/ed/arm-ed`) and the authoritative third-edition mockup (`emergency-department-third-edition.html`) were rendered and screenshotted in Chrome DevTools MCP.
   - Side-by-side inspection revealed the exact reasons why the live ED screen was rejected:
     - **Severe Vertical Spacing Void in Table Rows:** Action buttons and table cells had unconstrained heights, blowing up table rows to hundreds of vertical pixels with massive empty voids between patients.
     - **Needs Attention Panel Hijacked:** The mockup's clean `.lst` priority alert stream (with status dots for legal deadline breach, unbooked transport, pending reviews, and expected arrivals) was replaced by bulky nested cards ("Expects" and "Referrals").
     - **Department Lists Missing 4 Status Tabs:** The mockup features 4 clinical tabs ("Awaiting review", "Medically cleared", "Expected", "Under a form"). The live app only had 2 operational pipeline tabs ("Recently answered" and "Still to be moved").
     - **Missing 24-Hour Timeline Panel:** The mockup has a dedicated full-width panel "Seen in the last 24 hours" with a multi-column chronological event feed. The live app lacked this entirely.
     - **Missing Footer Disclosure:** "What is invented and what is real" panel was missing.
     - **Patient Drawer Missing Journey Timeline:** The slide-out drawer lacked Block 3 ("The journey the record holds").

3. **Subagent Findings Preserved:**
   - All three subagents successfully executed and delivered comprehensive analyses before the server restart. Their full reports are archived verbatim in sections 2, 3, and 4 below.

---

## 2. Subagent 1 Report: Mockup Architecture & Design Specification

**Source:** `docs/ward-flow/mockups/emergency-department-third-edition.html` (381 KB, 11,946 lines)

### 2.1 DOM Structure (`renderAll()`, lines 8808–8886)

The page body `#edBody` is organized into 5 primary panels:

1. **Emergency Departments Switcher Strip & Identity Panel (`section.panel.full`)**:
   - Header `<h2>Emergency departments</h2>`, note explaining wait bar comparison against network longest.
   - Horizontal scrolling list `<ul class="edList" id="edList">` of 8 department cards (`.edCard`).
   - Integrated identity banner (`.edIdent`):
     - Department code, health service tracking e.g. `ARM EAST METRO` (`.svc[data-svc="east"]`), and name e.g. `Armadale Hospital Emergency Department`.
     - 6 count chips (`.chip`): on the board, waiting for a bed, awaiting review, expected, under a form, longest wait.
2. **Needs Attention Panel (`section.panel.mod`, 6-col width on desktop)**:
   - Header: `Needs attention`, `X flags`, note: `Forms, transport, acceptances and reviews, worst first.`
   - Priority stream: `.lstWrap > ul.lst > li.lstRow` with status indicator dot (`.tick` with `data-tone="danger|warn|good|quiet"`).
   - Row elements: Title (`.lstTitle`), metadata line with patient button (`.meta > .idBtn.tiny`), clinical rationale (`.lstWhy`), action button (`.lstAct > .ctl.small`), and relative timestamp (`.stamp`).
   - Evaluates:
     - `danger`: Legal deadline passed (`m.legalDue < NOW`). Action: "Renew or discharge the form".
     - `warn`: Transport not booked (`!m.transport`), every ward declined, unassigned owner, unseen >60m, medical clearance overdue >180m. Actions: "Book transport", "Ask another ward", "Record the review", "Chase medical result".
     - `good`: Acceptance received (`accepted_awaiting_bed`). Action: "Pull the bed".
     - `quiet`: Left department, expected arrival within the hour.
3. **The Department's Lists Panel (`section.panel.mod`, 6-col width on desktop)**:
   - Header: `Department lists`, active tab count, note: `Four readings of the same department. Press a name to open the person.`
   - Segmented tab bar (`.tabbar` with `role="tablist"`):
     - Tab 1: `Awaiting review` (count badge `.tabNum`)
     - Tab 2: `Medically cleared` (count badge `.tabNum`)
     - Tab 3: `Expected` (count badge `.tabNum`)
     - Tab 4: `Under a form` (count badge `.tabNum`)
     - Active tab highlighted with a 2px brass bar (`var(--gilt)`), zero counts formatted as italic `none`.
   - Content: `.lstWrap#edpane` rendering matching `.lstRow` items with patient name button (`.nameBtn`), bay, demographic tags, rationale, and wait duration.
4. **Emergency Department Board Panel (`section.panel.full`)**:
   - Header: `[Site] board`, people count, note: `Everyone this department has on its psychiatry list. Press a row to open the person, or a form to change it on this screen.`
   - Filter chips (`.boardChips`): `Everyone`, `Not reviewed`, `Under a form`, `No destination`, `For discharge`.
   - Filter bar: `#qFilter` showing active subset and "Show all" button.
   - Table: `.dataTable.boardTable` inside `.tableWrap.boardWrap`:
     - 9 Columns: `Identifier`, `Patient`, `In department`, `Bay`, `Form`, `Presenting`, `Review`, `Plan`, `Destination`.
     - Compact padding (10px 14px); `td.story` wrapping; wait track progress bar against 24h target; inline form dropdown pill (`.formPill`).
5. **Seen in the Last Twenty Four Hours Panel (`section.panel.full`)**:
   - Header: `Seen in the last 24 hours`, `X events`, note: `What was recorded, not everything that happened.`
   - Timeline: `.tlWrap > ol.tl > li.tlRow` with relative timestamp (`.tlAt`), continuous hairline rail with tick dot (`.tlMark > .tick`), event description (`.tlWhat`), and author attribution (`.tlBy`).
   - Responsive multi-column layout (1 col mobile, 2 col >= 1240px, 3 col >= 1760px).
6. **What is Invented and What is Real Panel (`section.panel.full`)**:
   - Collapsible `<details class="edMore">` explaining synthetic data vs real hospitals and legal codes.
7. **Patient Slide-Out Drawer (`.pxDrawer`)**:
   - Fixed slide-out drawer on right edge with backdrop scrim (`var(--scrim)`).
   - Three structured blocks:
     - Block 1: `Where they are up to` (key-value definition list `.pairs .pair`).
     - Block 2: `Handover` (clinical paragraphs for Presenting, Plan, Transport).
     - Block 3: `The journey the record holds` (chronological patient event timeline `.tl.tlTight`).

---

## 3. Subagent 2 Report: Gap Analysis (Live App vs Mockup)

1. **Table Row Layout Defect (Primary Visual Rejection Reason):**
   - The live app table (`.boardTable`) placed extensive action buttons (`.tableActionGroup`), form expiry warnings, and status cards inside the 10th column of every row.
   - This caused each row to expand vertically by hundreds of pixels, destroying the clean tabular comparison of the third-edition design.
   - **Remedy:** Keep base table rows compact (10px 14px cell padding). Make action subforms expand in a dedicated subform row (`<tr className={styles.subFormRow}><td colSpan={10}>...</td></tr>`) only when an action is actively chosen.

2. **Needs Attention Panel:**
   - Live app had two nested sections: "Expects" and "Referrals" containing referral cards and buttons.
   - Mockup has a single unified `.lst` priority stream.
   - **Remedy:** Restore the unified `.lstRow` priority list for "Needs attention", while ensuring referral triage actions and expected arrival triage are accessible cleanly.

3. **Department Lists 4 Tabs:**
   - Live app had only 2 tabs ("Recently answered" and "Still to be moved").
   - Mockup specifies 4 tabs: "Awaiting review", "Medically cleared", "Expected", "Under a form".
   - **Remedy:** Implement the authoritative 4 tabs front and center using `.tabbar` and `.tabBtn`, while keeping the operational pipeline tabs ("Recently answered" and "Still to be moved") accessible as sub-views or additional tabs so tests pass.

4. **Missing Panels:**
   - "Seen in the last 24 hours" was omitted entirely.
   - "What is invented and what is real" was omitted entirely.
   - **Remedy:** Implement both panels at the bottom of the screen.

5. **Patient Drawer Timeline:**
   - Live drawer had "Where they are up to" and "Clinical notes", but omitted "The journey the record holds".
   - **Remedy:** Add Block 3 with the patient journey timeline.

---

## 4. Subagent 3 Report: Test Inventory & Invariant Contracts

### 4.1 Key Test IDs & Element Selectors

- **Intake Form:** `ward-ed-raise-referral-toggle`, `ward-ed-referral-form`, `ward-ed-referral-legal-form`, `ward-ed-referral-cohort`, `ward-ed-referral-security`, `ward-ed-referral-sex`, `ward-ed-referral-legal-status`, `ward-ed-referral-urgency`, `ward-ed-referral-specialling-required`/`not-required`, `ward-ed-referral-high-acuity-required`/`not-required`, `ward-ed-referral-legal-form-due-at-date`/`time`, `ward-ed-referral-submit`.
- **Patient Rows & Cards:** `ward-ed-patient-${id}`, `ward-ed-tier-${id}`, `ward-ed-form-expiry-${id}`, `ward-ed-form-expiry-warning-${id}`, `ward-ed-access-target-${id}`, `ward-ed-outstanding-${id}`, `ward-ed-police-${id}`, `ward-ed-medical-clearance-${id}`.
- **Action Subforms:**
  - Form Expiry / Extension: `ward-ed-legal-form-expiry-toggle-${id}`, `date-${id}`, `time-${id}`, `save-${id}`, `history-${id}`.
  - Examination: `ward-ed-examine-toggle-${id}`, `ward-ed-examine-form-${id}`, submit button "Confirm examination outcome".
  - Legal Status: `ward-change-legal-status-toggle-${id}`, select `id="ward-change-legal-status-reason-${id}"`.
  - Urgency: `ward-change-urgency-toggle-${id}`, select `id="ward-change-urgency-reason-${id}"`.
  - Transport: `ward-ed-book-transport-toggle-${id}`, `ward-ed-book-transport-${id}`, escort radios (must start unchecked!), submit `ward-ed-book-transport-confirm-${id}`.
  - Handover Ready: `ward-ed-handover-${id}` (disabled unless pulled + transport booked).
  - CMHT Referral: `ed-refer-cmht-${id}`, `ward-ed-cmht-panel-${id}`, `ward-ed-cmht-select-${id}`, `ward-ed-cmht-confirm-${id}`, `ward-ed-mark-left-${id}`.
- **Operational Sections:**
  - Expects: `ward-ed-expects`, `ward-ed-expects-row-${id}`, `ward-ed-expects-arrived-${id}`.
  - Psychiatry Inbox: `ward-ed-inbox`, `ward-ed-inbox-row-${id}`, `ward-ed-inbox-clearance-${id}`, `ward-ed-inbox-decline-${id}`.
  - Recently Answered: `ward-ed-answered`, `ward-ed-answered-row-${id}`, `ward-ed-answered-state-${id}`.
  - Outbox: Tab `/Still to be moved/`, panel `ward-ed-outbox`, row `ward-ed-outbox-row-${id}`.

### 4.2 Language & Text Invariants

- Urgency tiers: must say `urgencyTierLabel(level)` (e.g. `"Tier 1 · most urgent"`).
- Form expiry without `dueAt`: exact text `"No expiry recorded from the form."`.
- Past due warning: `"Warning: past the expiry written on the form. Check the form."` with `data-level="warning"`.
- Clocks: term `"In department"`, value `"${duration} since triage"` (never words triage as "arrived").
- Vocabulary: use `"not bed pulled"` (never `"not bed held"`).
- Zero count rule: zero displays as italic `none`, never bare `0`.

---

## 5. Implementation Roadmap for Resuming Session

1. **Fix Table Row Height & Whitespace in `ed.module.css`**:
   - Enforce compact `padding: 10px 14px` on `.boardTable td`.
   - Ensure action buttons use a compact button row and only expand full subforms on click via `.subFormRow`.
2. **Rebuild "Needs attention"**:
   - Implement the worst-first `.lstRow` priority stream with status dots (`.tick`).
3. **Rebuild "Department lists"**:
   - Add the 4 clinical tabs (`Awaiting review`, `Medically cleared`, `Expected`, `Under a form`) using `.tabbar`.
   - Keep "Recently answered" and "Still to be moved" tabs accessible so all existing tests pass.
4. **Add Missing Panels**:
   - "Seen in the last 24 hours" timeline panel.
   - "What is invented and what is real" disclosure footer.
   - Patient drawer 24-hour journey timeline.
5. **Verify Full Parity**:
   - Take full-page screenshot of live page and compare with mockup.
   - Run `npx vitest run tests/ward-ed-*.ts*`.
   - Run `npx tsc -p tsconfig.typecheck.json --noEmit`.
   - Run `npx vitest run tests/ward-raw-colour.test.ts`.
