import { useEffect, useRef, useState } from "react";
import type { WardFlowEvent } from "../ward-flow-events";
import type { Patient, Gender } from "../ward-patients";
import type { PatientRegistrationScope } from "../ward-patient-registration";
import type { Instant } from "../ward-clock";
import type { WardFlowRole } from "../ward-flow-events";
import type { Referral } from "../ward-model";
import type { WardCommandDispatch, WardCommandOutcome } from "../ward-shared-client";
import { referralDraftSessionVersion } from "./referral-draft-cache";
import type { ReferralIntakeDetails } from "./referral-submission";

/** Opaque submission identity, including HTTP browsers without randomUUID. No patient data. */
function submissionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type ReferralCommand = Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }> & { intake: ReferralIntakeDetails };
/** A snapshot is confirmation only after this command accepts and its opaque identity matches. */
export function useReferralCommandCompletion({
  dispatch,
  referrals,
  generation,
  draftOwnerVersion,
  setPending,
  onError,
  onCommitted,
  onAccepted,
}: {
  dispatch: WardCommandDispatch;
  referrals: readonly Referral[];
  generation: number;
  draftOwnerVersion: number;
  setPending: (pending: boolean) => void;
  onError: (message: string) => void;
  onCommitted: (intake: ReferralIntakeDetails) => void;
  onAccepted: (referral: Referral, intake: ReferralIntakeDetails) => void;
}) {
  const submissionRef = useRef<{
    id: string;
    intake: ReferralIntakeDetails;
    generation: number;
    outcome?: WardCommandOutcome;
  } | null>(null);
  const [completion, setCompletion] = useState(0);
  const [submissionAwaitingRecord, setSubmissionAwaitingRecord] = useState(false);
  const currentGeneration = useRef(generation);
  const mounted = useRef(false);
  useEffect(() => {
    currentGeneration.current = generation;
  }, [generation]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const changedMessage = "The workspace changed. Check the Referrals board before sending again.";
  function submitReferral(event: ReferralCommand) {
    if (submissionRef.current) return;
    const submitted = { id: submissionId(), intake: event.intake, generation };
    submissionRef.current = submitted;
    setPending(true);
    const settle = (outcome?: WardCommandOutcome) => {
      if (!mounted.current || submissionRef.current !== submitted) return;
      if (
        submitted.generation !== currentGeneration.current ||
        draftOwnerVersion !== referralDraftSessionVersion() ||
        outcome?.isCurrent?.() === false
      ) {
        submissionRef.current = null;
        onError(changedMessage);
        setPending(false);
      } else if (outcome?.status === "accepted") {
        submissionRef.current = { ...submitted, outcome };
        // Acceptance is definitive even when a scoped snapshot cannot show the new record.
        // Retire recovery now so closing/reopening cannot turn the saved intake into another Send.
        onCommitted(submitted.intake);
        setSubmissionAwaitingRecord(true);
        setPending(false);
        setCompletion((value) => value + 1);
      } else {
        submissionRef.current = null;
        onError(outcome?.message ?? "Referral could not be confirmed. Check the Referrals board before trying again.");
        setPending(false);
      }
    };
    try {
      const result = dispatch({ ...event, type: "RECEIVE_REFERRAL", submissionId: submitted.id });
      if (result && "then" in result) void result.then(settle, () => settle());
      else settle(result ?? undefined);
    } catch {
      settle();
    }
  }
  useEffect(() => {
    const submitted = submissionRef.current;
    if (!submitted?.outcome) return;
    if (
      submitted.generation !== generation ||
      submitted.outcome.isCurrent?.() === false ||
      draftOwnerVersion !== referralDraftSessionVersion()
    ) {
      submissionRef.current = null;
      setSubmissionAwaitingRecord(false);
      setPending(false);
      onError(changedMessage);
      return;
    }
    const created = referrals.find((referral) => referral.submissionId === submitted.id);
    if (!created) return;
    submissionRef.current = { ...submitted, outcome: undefined };
    setSubmissionAwaitingRecord(false);
    onAccepted(created, submitted.intake);
    setPending(false);
  }, [completion, referrals, generation, draftOwnerVersion, onAccepted, onError, setPending]);
  return { submissionRef, submitReferral, submissionAwaitingRecord };
}

/** Registers one identity and never mistakes a concurrent registration for that patient. */
export function useReferralPatientRegistration({
  patients,
  generation,
  dispatch,
  now,
  role,
  registrationScope,
  requiresRegistrationScope,
  allowed,
  reason,
  patient,
  onSelect,
}: {
  patients: readonly Patient[];
  generation: number;
  dispatch: WardCommandDispatch;
  now: Instant;
  role: WardFlowRole;
  registrationScope?: PatientRegistrationScope;
  requiresRegistrationScope?: boolean;
  allowed: boolean;
  reason?: string;
  patient: {
    givenName: string;
    familyName: string;
    umrn: string;
    dateOfBirth: string;
    gender: Gender | "";
    suburb: string;
  };
  onSelect: (id: string) => void;
}) {
  const [newPatientError, setNewPatientError] = useState<string | null>(null);
  const pendingNewPatient = useRef<{
    priorIds: Set<string>;
    umrn: string;
    accepted: boolean;
    generation: number;
    ownerVersion: number;
  } | null>(null);
  const [completion, setCompletion] = useState(0);
  const currentGeneration = useRef(generation);
  const mounted = useRef(false);
  useEffect(() => {
    currentGeneration.current = generation;
  }, [generation]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const pending = pendingNewPatient.current;
    if (!pending) return;
    if (pending.generation !== generation || pending.ownerVersion !== referralDraftSessionVersion()) {
      pendingNewPatient.current = null;
      setNewPatientError("The workspace changed. Review the patient before trying again.");
      return;
    }
    if (!pending.accepted) return;
    const added = patients.find(
      (record) => !pending.priorIds.has(record.id) && record.umrn.trim().toLowerCase() === pending.umrn,
    );
    if (!added) return;
    pendingNewPatient.current = null;
    onSelect(added.id);
  }, [patients, completion, generation, onSelect]);
  function addNewPatient(event: React.FormEvent) {
    event.preventDefault();
    if (pendingNewPatient.current) return;
    const familyName = patient.familyName.trim();
    const givenName = patient.givenName.trim();
    const umrn = patient.umrn.trim();
    if (!familyName || !givenName) return setNewPatientError("Enter the family and given names.");
    if (!patient.dateOfBirth) return setNewPatientError("Enter the date of birth.");
    if (!umrn) return setNewPatientError("Enter the UMRN.");
    if (!allowed) return setNewPatientError(reason ?? null);
    if (requiresRegistrationScope && !registrationScope)
      return setNewPatientError("Open the referral from a single source ward before registering the patient.");
    setNewPatientError(null);
    const pending = {
      priorIds: new Set(patients.map((record) => record.id)),
      umrn: umrn.toLowerCase(),
      accepted: false,
      generation,
      ownerVersion: referralDraftSessionVersion(),
    };
    pendingNewPatient.current = pending;
    const settle = (outcome?: WardCommandOutcome) => {
      if (!mounted.current || pendingNewPatient.current !== pending) return;
      if (
        pending.generation !== currentGeneration.current ||
        pending.ownerVersion !== referralDraftSessionVersion() ||
        outcome?.isCurrent?.() === false
      ) {
        pendingNewPatient.current = null;
        setNewPatientError("The workspace changed. Review the patient before trying again.");
      } else if (outcome?.status === "accepted") {
        pending.accepted = true;
        setCompletion((value) => value + 1);
      } else {
        pendingNewPatient.current = null;
        setNewPatientError(outcome?.message ?? "Patient could not be added. Check the record before trying again.");
      }
    };
    try {
      const result = dispatch({
        type: "ADD_PATIENT",
        registrationScope,
        role,
        now,
        givenName,
        familyName,
        umrn,
        dateOfBirth: patient.dateOfBirth,
        ...(patient.gender ? { gender: patient.gender } : {}),
        ...(patient.suburb.trim() ? { suburb: patient.suburb.trim() } : {}),
      });
      if (result && "then" in result) void result.then(settle, () => settle());
      else settle(result ?? undefined);
    } catch {
      settle();
    }
  }
  return { newPatientError, setNewPatientError, pendingNewPatient, addNewPatient };
}
