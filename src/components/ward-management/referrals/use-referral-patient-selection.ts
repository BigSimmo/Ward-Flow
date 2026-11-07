import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestConfirm } from "@/components/wf";
import { fieldsMatchEveryWord } from "../search/search-text";
import { rankByNameStart } from "./referral-patient-rank";
import type { Instant } from "../ward-clock";
import { EMPTY_NEW_PATIENT, type useReferralRegistrationDraft } from "./use-referral-command-completion";
import { referralDraftSessionVersion } from "./referral-draft-cache";
import { NO_PATIENT_KEY, patientKeyFor, sampleProfile, type MockPatientProfile } from "./ward-referral-drawer-model";

type RegistrationDraft = ReturnType<typeof useReferralRegistrationDraft>;
type PatientRecords = Parameters<typeof sampleProfile>[1];

/** Unregistered identity stays in memory; incomplete date text is work even without an ISO value. */
export function useReferralRegistrationWork({ newPatient, setNewPatient, invalidateRegistration }: RegistrationDraft) {
  const [newPatientDateText, setDateText] = useState<string | undefined>(undefined);
  const setNewPatientDateText = useCallback(
    (text: string) => {
      invalidateRegistration();
      setDateText(text);
    },
    [invalidateRegistration],
  );
  const resetNewPatient = () => {
    setNewPatient(EMPTY_NEW_PATIENT);
    setDateText(undefined);
  };
  const newPatientDirty = !!newPatientDateText || JSON.stringify(newPatient) !== JSON.stringify(EMPTY_NEW_PATIENT);
  return { newPatientDateText, setNewPatientDateText, newPatientDirty, resetNewPatient };
}

/** Patient search and its guarded selection share one record lookup and registration-intent fence. */
export function useReferralPatientSelection({
  activePatientKey,
  searchQuery,
  profiles,
  record,
  now,
  dirty,
  revision,
  ownerVersion,
  registrationDraft,
  setSearchQuery,
  setIsSearchOpen,
  onSelect,
}: {
  activePatientKey: string;
  searchQuery: string;
  profiles: Record<string, MockPatientProfile>;
  record: PatientRecords;
  now: Instant;
  dirty: boolean;
  revision: string;
  ownerVersion: number;
  registrationDraft: RegistrationDraft;
  setSearchQuery: (query: string) => void;
  setIsSearchOpen: (open: boolean) => void;
  onSelect: (key: string, addedInForm: boolean) => void;
}) {
  const context = JSON.stringify([activePatientKey, revision]);
  const contextRef = useRef<string | null>(context);
  useEffect(() => {
    contextRef.current = context;
    return () => {
      contextRef.current = null;
    };
  }, [context]);
  const { movements, patients, referrals, dayZero } = record;
  // Match like header search: every folded word, with commas separating names, never near spellings.
  const filteredPatients = useMemo(() => {
    const query = searchQuery.replace(/,/g, " ").trim();
    const visible = Object.values(profiles).filter((patient) => patient.id !== NO_PATIENT_KEY);
    if (!query) return visible;
    const matches = visible.filter((patient) =>
      fieldsMatchEveryWord(query, [patient.name, patient.umrn, patient.dob, patient.origin]),
    );
    const shown = new Set(visible.map((patient) => patient.umrn));
    const records = { movements, patients, referrals, dayZero };
    const more = patients
      .filter(
        (patient) =>
          !shown.has(patient.umrn) &&
          fieldsMatchEveryWord(query, [`${patient.givenName} ${patient.familyName}`, patient.umrn]),
      )
      .slice(0, 8)
      .map((patient) => sampleProfile(patientKeyFor(patient.id, records) ?? "custom", records, now));
    return rankByNameStart([...matches, ...more], query);
  }, [searchQuery, profiles, movements, patients, referrals, dayZero, now]);

  function handleSelectPatient(key: string, addedInForm = false) {
    // Retire an earlier registration before awaiting confirmation, so its late result cannot select.
    registrationDraft.invalidateRegistration();
    const selectionIntent = registrationDraft.getIntentVersion();
    if (key === activePatientKey) {
      setSearchQuery("");
      setIsSearchOpen(false);
      return;
    }
    if (!addedInForm && dirty) {
      const selected = profiles[key] ?? sampleProfile(key, record, now);
      void requestConfirm({
        title: "Change patient?",
        message: `Changing to ${selected.name}, ${selected.umrn}, discards the current patient's referral details. Keep editing to retain them.`,
        confirmLabel: "Discard and change patient",
      }).then((confirmed) => {
        if (
          confirmed &&
          contextRef.current === context &&
          registrationDraft.getIntentVersion() === selectionIntent &&
          ownerVersion === referralDraftSessionVersion()
        )
          onSelect(key, addedInForm);
      });
      return;
    }
    onSelect(key, addedInForm);
  }
  return { filteredPatients, handleSelectPatient };
}
