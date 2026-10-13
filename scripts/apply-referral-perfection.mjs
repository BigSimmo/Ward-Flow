import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

// 1. Update referral-board.tsx
const boardPath = path.join(root, "src/components/ward-management/referrals/referral-board.tsx");
let boardSrc = fs.readFileSync(boardPath, "utf8");

// A: imports
if (!boardSrc.includes("candidateAccepts,")) {
  boardSrc = boardSrc.replace(
    '  referralState,\n  referralSuburbLabel,\n} from "@/components/ward-management/ward-referrals";',
    '  referralState,\n  referralSuburbLabel,\n  candidateAccepts,\n  referralCandidates,\n} from "@/components/ward-management/ward-referrals";'
  );
}

// B: computation
const targetCompute = 'const selectedPatientInfo = resolveSubjectPatient(selectedReferral, { patients, referrals, movements });';
const replacementCompute = `const selectedPatientInfo = resolveSubjectPatient(selectedReferral, { patients, referrals, movements });
  const selectedWardAddressing = selectedReferral?.destinations.find(
    (addressing) => addressing.destination.kind === "psychiatric_ward",
  );
  const readyVacanciesCount =
    selectedReferral && selectedWardAddressing && selectedWardAddressing.destination.kind === "psychiatric_ward"
      ? referralCandidates(selectedReferral, selectedWardAddressing.destination, units, now).filter(candidateAccepts).length
      : 0;`;

if (!boardSrc.includes("const readyVacanciesCount =") && boardSrc.includes(targetCompute)) {
  boardSrc = boardSrc.replace(targetCompute, replacementCompute);
}

// C: tab badge
const targetBadge = `                      <span>Bed Placement</span>
                      <span className="sr-only"> &amp; Network Triage</span>`;
const replacementBadge = `                      <span>Bed Placement</span>
                      {readyVacanciesCount > 0 ? (
                        <span className={styles.tabBadge}>{readyVacanciesCount} ready</span>
                      ) : null}
                      <span className="sr-only"> &amp; Network Triage</span>`;

if (!boardSrc.includes("styles.tabBadge") && boardSrc.includes(targetBadge)) {
  boardSrc = boardSrc.replace(targetBadge, replacementBadge);
}

fs.writeFileSync(boardPath, boardSrc, "utf8");
console.log("referral-board.tsx updated successfully.");

// 2. Update referrals.module.css
const cssPath = path.join(root, "src/components/ward-management/referrals/referrals.module.css");
let cssSrc = fs.readFileSync(cssPath, "utf8");

const targetGrid = `.clinicalMetaGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r2, 6px);
  padding: 10px 14px;
  margin-top: 4px;
}`;

const replacementGrid = `.clinicalMetaGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r2, 6px);
  padding: 10px 14px;
  margin-top: 4px;
}

@media (min-width: 48rem) {
  .clinicalMetaGrid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
}`;

if (cssSrc.includes(targetGrid)) {
  cssSrc = cssSrc.replace(targetGrid, replacementGrid);
}

const targetTab = `.tabBtnActive,
.tabBtn[aria-selected="true"] {
  color: var(--accent);
  background: var(--surface);
  border-color: var(--line);
  font-weight: 700;
  box-shadow: 0 1px 2px rgb(var(--ward-shadow-rgb) / 0.05);
}`;

const replacementTab = `.tabBtnActive,
.tabBtn[aria-selected="true"] {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
  font-weight: 700;
  box-shadow: 0 1px 2px rgb(var(--ward-shadow-rgb) / 0.05);
}

.tabBadge {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: inherit;
  margin-left: 2px;
  transition: all 0.15s ease;
}

.tabBtnActive .tabBadge,
.tabBtn[aria-selected="true"] .tabBadge {
  background: var(--accent);
  color: var(--ward-fixed-white, #ffffff);
  border-color: var(--accent);
}`;

if (cssSrc.includes(targetTab)) {
  cssSrc = cssSrc.replace(targetTab, replacementTab);
}

fs.writeFileSync(cssPath, cssSrc, "utf8");
console.log("referrals.module.css updated successfully.");
