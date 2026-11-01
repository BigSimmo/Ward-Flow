"use client";

// The patient search page's sections: people, results with their Show facets and rows, and the
// access record. Moved out of `patient-search.tsx` to keep it under the line cap.
import Link from "next/link";
import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { type PatientSearchResult } from "@/components/ward-management/ward-derivations";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { formatDateOfBirth, patientListName, type Patient } from "@/components/ward-management/ward-patients";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { patientIdentityLine, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { type AccessEntry } from "./access-record";
import { handOffTypedPatientQuery, isNewTabClick } from "./patient-query-handoff";
import { buildMovementSummary, buildReferralSummary } from "./record-preview";
import styles from "./search.module.css";
import { isCommunityReferral } from "./community-referral";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { ACCESS_RECORD_EMPTY, SHOW_FACETS, getPatientPresence, type ShowFacetKey } from "./patient-search-model";

export function PeopleSection({
  people,
  query,
  otherMatches,
  onPreview,
  selectedPatientId,
  referrals,
  movements,
}: {
  people: readonly Patient[];
  query: string;
  otherMatches: number;
  onPreview: (patient: Patient) => void;
  selectedPatientId?: string | null;
  referrals: readonly Referral[];
  movements: readonly Movement[];
}) {
  return (
    <WardPanel
      title={people.length === 0 ? "No people" : people.length === 1 ? "1 person" : `${people.length} people`}
      testId="ward-patient-search-people"
    >
      {query.length === 0 ? (
        <p className={styles.peopleIdleNote} data-testid="ward-patient-search-people-idle">
          Enter a name or UMRN above.
        </p>
      ) : people.length === 0 ? (
        <div className={styles.peopleEmptyNote} data-testid="ward-patient-search-people-empty">
          <p>
            {otherMatches > 0
              ? "No matching person."
              : "No matches. Check the spelling or UMRN before adding a patient."}
          </p>
          <Link
            className={styles.addPersonLink}
            href={WARD_ADD_PERSON_HREF}
            data-testid="ward-patient-search-people-empty-add"
            onClick={(event) => {
              if (isNewTabClick(event)) {
                handOffTypedPatientQuery("", "carried");
                return;
              }
              handOffTypedPatientQuery(query, "carried");
            }}
          >
            Add patient
          </Link>
        </div>
      ) : (
        <ul className={styles.peopleList} data-testid="ward-patient-search-people-list">
          {people.map((patient) => {
            const presence = getPatientPresence(patient, referrals, movements);
            const isSelected = selectedPatientId === patient.id;
            return (
              <li
                key={patient.id}
                className={`${styles.peopleRow} ${isSelected ? styles.selectedRow : ""}`.trim()}
                data-testid={`ward-patient-search-person-${patient.id}`}
              >
                <div className={styles.personHeaderCluster}>
                  <span className={`${styles.presenceTag} ${styles[presence.key]}`}>
                    {presence.key === "live"
                      ? "● On this board"
                      : presence.key === "community"
                        ? "○ Not in Hosp"
                        : "◌ Past"}
                  </span>
                  <span className={styles.personUmrn}>{patient.umrn}</span>
                  <span className={styles.personName}>{patientListName(patient)}</span>
                  <span className={styles.personDob}>DOB {formatDateOfBirth(patient.dateOfBirth)}</span>
                  {(patient as { confidential?: boolean }).confidential && (
                    <span className={styles.confidentialBadge} data-testid={`ward-patient-confidential-${patient.id}`}>
                      🔒 Restricted
                    </span>
                  )}
                </div>
                {onPreview ? (
                  <button
                    type="button"
                    className={styles.previewButton}
                    data-testid={`ward-patient-search-person-preview-${patient.id}`}
                    aria-label={`Preview ${patientListName(patient)}`}
                    onClick={() => onPreview(patient)}
                  >
                    Preview
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </WardPanel>
  );
}

export function ResultsSection({
  results,
  units,
  now,
  viewMode = "cards",
  onPreviewMovement,
  selectedMovementId,
  onPreviewReferral,
  selectedReferralId,
  patients = [],
  referrals = [],
}: {
  results: PatientSearchResult[];
  units: Unit[];
  now: number;
  viewMode?: "cards" | "dense";
  onPreviewMovement?: (movement: Movement) => void;
  selectedMovementId?: string | null;
  onPreviewReferral?: (referral: Referral) => void;
  selectedReferralId?: string | null;
  /** For naming each movement's patient; absent, rows read "Name not recorded", never the id. */
  patients?: Patient[];
  referrals?: Referral[];
}) {
  const referralResults = results.filter((result) => result.kind === "referral");
  // D-39: a referral row names its person by name and UMRN, never by the referral number.
  const umrnLookup = { patients, referrals };
  const movementResults = results.filter((result) => result.kind === "movement");

  const [facetKey, setFacetKey] = useState<ShowFacetKey>("all");

  const facetCounts = useMemo(() => {
    const map = new Map<ShowFacetKey, number>();
    for (const facet of SHOW_FACETS) {
      map.set(facet.key, movementResults.filter((result) => facet.test(result.movement, now)).length);
    }
    return map;
  }, [movementResults, now]);

  const activeFacet = SHOW_FACETS.find((facet) => facet.key === facetKey) ?? SHOW_FACETS[0];
  const shownMovementResults = useMemo(
    () => movementResults.filter((result) => activeFacet.test(result.movement, now)),
    [movementResults, activeFacet, now],
  );

  function onShowFacetsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const order = SHOW_FACETS.map((facet) => facet.key);
    const current = order.indexOf(facetKey);
    let next = -1;
    if (event.key === "ArrowRight") next = (current + 1) % order.length;
    if (event.key === "ArrowLeft") next = (current - 1 + order.length) % order.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = order.length - 1;
    if (next === -1) return;
    event.preventDefault();
    const target = order[next];
    if (target === undefined) return;
    setFacetKey(target);
    const el = event.currentTarget.querySelector<HTMLButtonElement>(`[data-show-facet-tab="${target}"]`);
    el?.focus();
  }

  return (
    <WardPanel
      title={results.length === 1 ? "1 match" : `${results.length} matches`}
      testId="ward-patient-search-results"
    >
      {referralResults.length > 0 && (
        <ul className={styles.referralList} data-testid="ward-patient-search-referrals">
          {referralResults.map(({ referral }) => {
            const summary = buildReferralSummary(referral);
            const isComm = isCommunityReferral(referral);
            const presenceKey = isComm ? "community" : "live";
            const presenceLabel = isComm ? "○ Not in Hosp" : "● On this board";
            const isSelected = selectedReferralId === referral.id;
            return (
              <li
                key={referral.id}
                className={`${styles.referralRow} ${isSelected ? styles.selectedRow : ""}`.trim()}
                data-testid={`ward-patient-search-referral-${referral.id}`}
              >
                <div className={styles.referralHeaderCluster}>
                  <span className={`${styles.presenceTag} ${styles[presenceKey]}`}>{presenceLabel}</span>
                  <span className={styles.referralId}>
                    {patientIdentityLine(resolveSubjectPatient(referral, umrnLookup))}
                  </span>
                </div>
                <span className={styles.referralNote}>
                  {summary.originLine} — {summary.declineNote}
                </span>
                {onPreviewReferral ? (
                  <button
                    type="button"
                    className={styles.previewButton}
                    data-testid={`ward-patient-search-referral-preview-${referral.id}`}
                    aria-label={`Preview ${patientIdentityLine(resolveSubjectPatient(referral, umrnLookup))}`}
                    onClick={() => onPreviewReferral(referral)}
                  >
                    Preview
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {results.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-empty">
          No matches.
        </p>
      ) : movementResults.length === 0 ? (
        <p className={styles.emptyNote} data-testid="ward-patient-search-no-movements">
          No open movement matches.
        </p>
      ) : (
        <>
          <p className={styles.movementScopeNote} data-testid="ward-patient-search-movement-scope-note">
            Movement filters only; people and waiting referrals are unchanged.
          </p>

          {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item */}
          <div
            className={styles.showFacets}
            role="tablist"
            aria-label="What to show"
            onKeyDown={onShowFacetsKeyDown}
            data-testid="ward-patient-search-show-facets"
          >
            {SHOW_FACETS.map((facet) => {
              const count = facetCounts.get(facet.key) ?? 0;
              const selected = facet.key === facetKey;
              return (
                <button
                  key={facet.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  data-show-facet-tab={facet.key}
                  className={selected ? styles.showFacetTabActive : styles.showFacetTab}
                  onClick={() => setFacetKey(facet.key)}
                >
                  {facet.label}{" "}
                  <span
                    className={count === 0 ? styles.showFacetCountZero : styles.showFacetCount}
                    data-testid={`ward-patient-search-show-facet-count-${facet.key}`}
                  >
                    {count === 0 ? "none" : count}
                  </span>
                </button>
              );
            })}
          </div>

          {shownMovementResults.length === 0 ? (
            <p className={styles.emptyNote} data-testid="ward-patient-search-facet-empty">
              {activeFacet.empty}
            </p>
          ) : (
            <WardTable
              className={`${styles.table} ${viewMode === "cards" ? styles.cardsView : styles.denseCaseload}`}
              wrapperClassName={styles.tableScroll}
            >
              <thead>
                <tr>
                  <th scope="col">Movement</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Department</th>
                  <th scope="col">Destination</th>
                  <th scope="col">Open for</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownMovementResults.map(({ movement }) => (
                  <ResultRow
                    key={movement.id}
                    movement={movement}
                    units={units}
                    now={now}
                    viewMode={viewMode}
                    onPreview={onPreviewMovement}
                    isSelected={selectedMovementId === movement.id}
                    patients={patients}
                    referrals={referrals}
                  />
                ))}
              </tbody>
            </WardTable>
          )}
        </>
      )}
    </WardPanel>
  );
}

function ResultRow({
  movement,
  units,
  now,
  viewMode = "cards",
  onPreview,
  isSelected,
  patients,
  referrals,
}: {
  movement: Movement;
  units: Unit[];
  now: number;
  viewMode?: "cards" | "dense";
  onPreview?: (movement: Movement) => void;
  isSelected?: boolean;
  patients: Patient[];
  referrals: Referral[];
}) {
  const summary = buildMovementSummary(movement, units, now);
  // P139: surname first ("Zircon, Marcus"), as every other row in the finder names a person.
  const patientName = resolveSubjectPatient(movement, { patients, referrals }).formalName;
  const rowClass =
    `${viewMode === "cards" ? styles.patientCard : styles.denseRow} ${isSelected ? styles.selectedRow : ""}`.trim() ||
    undefined;

  return (
    <tr className={rowClass}>
      <td className={styles.cellIdentity}>
        <div className={styles.movementIdCluster}>
          <span className={`${styles.presenceTag} ${styles.live}`}>● On this board</span>
          {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
          <span className={styles.movementIdText}>{patientName}</span>
        </div>
      </td>
      <td className={styles.cellStage}>{summary.stageLabel}</td>
      <td className={styles.cellDept}>{summary.departmentText}</td>
      <td className={styles.cellDest}>{summary.destinationCell}</td>
      <td className={styles.cellWait}>{summary.elapsedText}</td>
      <td className={styles.actionsCell}>
        {onPreview ? (
          <button
            type="button"
            className={styles.previewButton}
            data-testid={`ward-patient-search-movement-preview-${movement.id}`}
            aria-label={`Preview ${patientName}`}
            onClick={() => onPreview(movement)}
          >
            Preview
          </button>
        ) : null}
        <Link className={styles.resultLink} href={movementHref(movement.id)}>
          Open
        </Link>
      </td>
    </tr>
  );
}

export function AccessRecordPanel({ entries, now }: { entries: readonly AccessEntry[]; now: number }) {
  return (
    <WardPanel
      title="Access record"
      count={entries.length === 1 ? "1 search" : `${entries.length} searches`}
      blurb="Search terms and times. Kept for this session only."
      testId="ward-patient-search-access-record"
    >
      {entries.length === 0 ? (
        <p className={styles.accessRecordEmpty} data-testid="ward-patient-search-access-record-empty">
          {ACCESS_RECORD_EMPTY}
        </p>
      ) : (
        <ol className={styles.accessRecordList} data-testid="ward-patient-search-access-record-list">
          {entries.map((entry, index) => (
            <li
              key={`${entry.words}-${entry.at}-${index}`}
              className={styles.accessRecordItem}
              data-testid={`ward-patient-search-access-record-row-${index}`}
            >
              <span className={styles.accessRecordWords}>“{entry.words}”</span>
              <span className={styles.accessRecordMeta}>searched at {formatInstantWithDay(entry.at, now)}</span>
            </li>
          ))}
        </ol>
      )}
    </WardPanel>
  );
}
