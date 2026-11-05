import { referralDraftMemory } from "./referral-draft-lifecycle";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WardFlowEvent } from "../ward-flow-events";
import type { Patient, Gender } from "../ward-patients";
import type { RecordedSex } from "../ward-model-vocabulary";
import type { PatientRegistrationScope } from "../ward-patient-registration";
import { calendarDateOf, perthIsoDay, type Instant } from "../ward-clock";
import type { WardFlowRole } from "../ward-flow-events";
import type { Referral } from "../ward-model";
import type { WardCommandDispatch, WardCommandOutcome } from "../ward-shared-client";
import { referralDraftSessionVersion } from "./referral-draft-cache";
import type { ReferralIntakeDetails } from "./referral-submission";

/** Opaque submission identity, including HTTP browsers without randomUUID. No patient data. */
export function submissionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type ReferralCommand = Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }> & { intake: ReferralIntakeDetails };
type PendingReferralSubmission = {
  id: string;
  intake: ReferralIntakeDetails;
  generation: number;
  ownerVersion: number;
  outcome?: WardCommandOutcome;
  unconfirmed?: WardCommandOutcome;
};
// The recoverable draft owns the task, not a particular drawer mount. Never write intake to disk here.
const recoverableSubmissions = referralDraftMemory.submissions as Map<string, PendingReferralSubmission>;
const submissionListeners = new Set<() => void>();
const publishSubmission = () => submissionListeners.forEach((listener) => listener());

export function useReferralCommandCompletion({
  dispatch,
  referrals,
  generation,
  draftOwnerVersion,
  recoveryId,
  setPending,
  onError,
  onCommitted,
  onAccepted,
}: {
  dispatch: WardCommandDispatch;
  referrals: readonly Referral[];
  generation: number;
  draftOwnerVersion: number;
  recoveryId?: string;
  setPending: (pending: boolean) => void;
  onError: (message: string | null) => void;
  onCommitted: (intake: ReferralIntakeDetails) => void;
  onAccepted: (referral: Referral, intake: ReferralIntakeDetails) => void;
}) {
  const [openingGeneration] = useState(generation);
  const [id] = useState(() => recoveryId ?? submissionId());
  const key = `${draftOwnerVersion}/${generation}/${id}`;
  const submissionRef = useRef<PendingReferralSubmission | null>(recoverableSubmissions.get(key) ?? null);
  const [completion, setCompletion] = useState(0);
  const recovering = recoverableSubmissions.get(key);
  const submissionAwaitingRecord =
    recovering?.outcome?.status === "accepted" &&
    recovering.outcome.isCurrent?.() !== false &&
    recovering.unconfirmed?.isCurrent?.() !== false &&
    draftOwnerVersion === referralDraftSessionVersion() &&
    openingGeneration === generation &&
    !referrals.some((referral) => referral.submissionId === id);
  const retired = useRef<PendingReferralSubmission | null>(null);
  const delivered = useRef<string | null>(null);
  useEffect(() => {
    const listener = () => setCompletion((value) => value + 1);
    submissionListeners.add(listener);
    // Includes an answer that arrived between render and subscribing.
    listener();
    return () => {
      submissionListeners.delete(listener);
    };
  }, []);
  function submitReferral(event: ReferralCommand) {
    if (
      recoverableSubmissions.has(key) ||
      openingGeneration !== generation ||
      draftOwnerVersion !== referralDraftSessionVersion()
    )
      return;
    const submitted: PendingReferralSubmission = {
      id,
      intake: event.intake,
      generation,
      ownerVersion: draftOwnerVersion,
    };
    recoverableSubmissions.set(key, submitted);
    submissionRef.current = submitted;
    setPending(true);
    const settle = (outcome?: WardCommandOutcome) => {
      if (recoverableSubmissions.get(key) !== submitted || submitted.ownerVersion !== referralDraftSessionVersion())
        return;
      if (outcome?.status === "accepted" || outcome?.status === "refused" || outcome?.isCurrent?.() === false) {
        submitted.outcome = outcome;
      } else if (outcome?.status === "failed" && outcome.confirmation && !submitted.unconfirmed) {
        submitted.unconfirmed = outcome;
        void outcome.confirmation.then(
          (confirmed) => {
            if (confirmed.commandId === outcome.commandId) settle(confirmed);
          },
          () => {},
        ); // A lost confirmation is still uncertain, so retain the same identity.
      } else if (!submitted.unconfirmed) {
        submitted.outcome = outcome ?? {
          status: "failed",
          commandId: id,
          message: "Referral could not be confirmed. Check the Referrals board before trying again.",
        };
      }
      publishSubmission();
    };
    try {
      const result = dispatch({ ...event, type: "RECEIVE_REFERRAL", submissionId: id });
      if (result && "then" in result) void result.then(settle, () => settle());
      else settle(result ?? undefined);
    } catch {
      settle();
    }
  }
  useEffect(() => {
    if (openingGeneration !== generation || draftOwnerVersion !== referralDraftSessionVersion()) {
      submissionRef.current = null;
      setPending(false);
      onError("The workspace changed. Check the Referrals board before sending again.");
      return;
    }
    const submitted = recoverableSubmissions.get(key);
    if (!submitted) {
      if (
        submissionRef.current &&
        (submissionRef.current.generation !== generation ||
          submissionRef.current.ownerVersion !== referralDraftSessionVersion())
      ) {
        setPending(false);
        onError("The workspace changed. Check the Referrals board before sending again.");
      }
      submissionRef.current = null;
      // A refreshed recoverable draft can reconcile from the authoritative snapshot too.
      const saved = recoveryId ? referrals.find((referral) => referral.submissionId === id) : undefined;
      if (saved?.intake && delivered.current !== saved.id) {
        delivered.current = saved.id;
        onCommitted(saved.intake);
        onAccepted(saved, saved.intake);
        setPending(false);
      }
      return;
    }
    submissionRef.current = submitted;
    const outcome = submitted.outcome;
    if (
      submitted.ownerVersion !== referralDraftSessionVersion() ||
      submitted.unconfirmed?.isCurrent?.() === false ||
      outcome?.isCurrent?.() === false
    ) {
      recoverableSubmissions.delete(key);
      submissionRef.current = null;
      setPending(false);
      onError("The workspace changed. Check the Referrals board before sending again.");
      return;
    }
    if (outcome?.status === "accepted") {
      if (retired.current !== submitted) {
        retired.current = submitted;
        onCommitted(submitted.intake);
      }
      const created = referrals.find((referral) => referral.submissionId === id);
      setPending(false);
      onError(null);
      if (created && delivered.current !== created.id) {
        delivered.current = created.id;
        // Keep the accepted identity until this opening ends, including scoped snapshots with no record.
        onAccepted(created, submitted.intake);
        submissionRef.current = null;
        recoverableSubmissions.delete(key);
      }
    } else if (outcome) {
      recoverableSubmissions.delete(key);
      submissionRef.current = null;
      setPending(false);
      onError(outcome.message ?? "Referral could not be confirmed. Check the Referrals board before trying again.");
    } else {
      setPending(true);
      if (submitted.unconfirmed)
        onError(
          submitted.unconfirmed.message ??
            "Referral save is not confirmed. Check the Referrals board before trying again.",
        );
    }
  }, [
    completion,
    referrals,
    generation,
    openingGeneration,
    draftOwnerVersion,
    key,
    id,
    recoveryId,
    onAccepted,
    onCommitted,
    onError,
    setPending,
  ]);
  return { submissionRef, submitReferral, submissionAwaitingRecord };
}

/** The Add patient form. WT-05 (walk-through, 26 Oct 2026): recorded sex is asked here, once, beside
 *  gender, so the referral and every later step start from it. Blank means not recorded. */
export type NewPatientDraft = {
  givenName: string;
  familyName: string;
  umrn: string;
  dateOfBirth: string;
  gender: Gender | "";
  sex?: RecordedSex | "";
  suburb: string;
};

export const EMPTY_NEW_PATIENT: NewPatientDraft = {
  familyName: "",
  givenName: "",
  dateOfBirth: "",
  umrn: "",
  gender: "",
  sex: "",
  suburb: "",
};

/** Each edit, opening/Cancel or patient choice retires only the old registration's UI intent. */
export function useReferralRegistrationDraft() {
  const intent = useRef(0);
  const [intentVersion, setIntentVersion] = useState(0);
  const [newPatientOpen, setOpen] = useState(false);
  const [newPatient, setDraft] = useState(EMPTY_NEW_PATIENT);
  const invalidateRegistration = useCallback(() => {
    intent.current += 1;
    setIntentVersion(intent.current);
  }, []);
  const setNewPatientOpen = useCallback(
    (next: React.SetStateAction<boolean>) => {
      invalidateRegistration();
      setOpen(next);
    },
    [invalidateRegistration],
  );
  const setNewPatient = useCallback(
    (next: React.SetStateAction<NewPatientDraft>) => {
      invalidateRegistration();
      setDraft(next);
    },
    [invalidateRegistration],
  );
  const getIntentVersion = useCallback(() => intent.current, []);
  return {
    newPatientOpen,
    setNewPatientOpen,
    newPatient,
    setNewPatient,
    intentVersion,
    getIntentVersion,
    invalidateRegistration,
  };
}

type PendingPatientRegistration = {
  priorIds: Set<string>;
  umrn: string;
  accepted: boolean;
  outcome?: WardCommandOutcome;
  generation: number;
  ownerVersion: number;
  intentVersion: number;
  context: string;
};

/** Registers one identity and never mistakes a concurrent registration for that patient. */
export function useReferralPatientRegistration({
  patients,
  generation,
  dispatch,
  now,
  dayZero,
  role,
  registrationScope,
  requiresRegistrationScope,
  allowed,
  reason,
  patient,
  onSelect,
  getIntentVersion,
  intentVersion = 0,
}: {
  patients: readonly Patient[];
  generation: number;
  dispatch: WardCommandDispatch;
  now: Instant;
  /** The demo calendar's day zero, so the reducer bounds a birth date by the demo day (H-0372). */
  dayZero?: Date;
  role: WardFlowRole;
  registrationScope?: PatientRegistrationScope;
  requiresRegistrationScope?: boolean;
  allowed: boolean;
  reason?: string;
  patient: NewPatientDraft;
  onSelect: (id: string) => void;
  getIntentVersion?: () => number;
  intentVersion?: number;
}) {
  const [newPatientError, setNewPatientError] = useState<string | null>(null);
  const pendingNewPatient = useRef<PendingPatientRegistration | null>(null);
  const [newPatientPending, setNewPatientPending] = useState(false);
  const [completion, setCompletion] = useState(0);
  const currentGeneration = useRef(generation);
  const context = JSON.stringify([role, registrationScope]);
  const currentContext = useRef(context);
  const mounted = useRef(false);
  useEffect(() => {
    currentGeneration.current = generation;
  }, [generation]);
  useEffect(() => {
    currentContext.current = context;
  }, [context]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const pending = pendingNewPatient.current;
    if (!pending) return;
    if (pending.intentVersion !== intentVersion || pending.context !== context) {
      pendingNewPatient.current = null;
      setNewPatientPending(false);
      return;
    }
    if (
      pending.generation !== generation ||
      pending.ownerVersion !== referralDraftSessionVersion() ||
      pending.outcome?.isCurrent?.() === false
    ) {
      pendingNewPatient.current = null;
      setNewPatientPending(false);
      setNewPatientError("The workspace changed. Review the patient before trying again.");
      return;
    }
    if (!pending.accepted) return;
    const added = patients.find(
      (record) => !pending.priorIds.has(record.id) && record.umrn.trim().toLowerCase() === pending.umrn,
    );
    if (!added) return;
    pendingNewPatient.current = null;
    setNewPatientPending(false);
    onSelect(added.id);
  }, [patients, completion, generation, onSelect, context, intentVersion]);
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
    const pending: PendingPatientRegistration = {
      priorIds: new Set(patients.map((record) => record.id)),
      umrn: umrn.toLowerCase(),
      accepted: false,
      generation,
      ownerVersion: referralDraftSessionVersion(),
      intentVersion,
      context,
    };
    pendingNewPatient.current = pending;
    setNewPatientPending(true);
    const settle = (outcome?: WardCommandOutcome) => {
      if (!mounted.current || pendingNewPatient.current !== pending) return;
      if (
        pending.intentVersion !== (getIntentVersion?.() ?? intentVersion) ||
        pending.context !== currentContext.current
      ) {
        pendingNewPatient.current = null;
        setNewPatientPending(false);
        return;
      }
      if (
        pending.generation !== currentGeneration.current ||
        pending.ownerVersion !== referralDraftSessionVersion() ||
        outcome?.isCurrent?.() === false
      ) {
        pendingNewPatient.current = null;
        setNewPatientPending(false);
        setNewPatientError("The workspace changed. Review the patient before trying again.");
      } else if (outcome?.status === "accepted") {
        pending.accepted = true;
        pending.outcome = outcome;
        setCompletion((value) => value + 1);
      } else {
        pendingNewPatient.current = null;
        setNewPatientPending(false);
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
        ...(dayZero ? { demoToday: perthIsoDay(calendarDateOf(now, dayZero)) } : {}),
        ...(patient.gender ? { gender: patient.gender } : {}),
        ...(patient.sex ? { sex: patient.sex } : {}),
        ...(patient.suburb.trim() ? { suburb: patient.suburb.trim() } : {}),
      });
      if (result && "then" in result) void result.then(settle, () => settle());
      else settle(result ?? undefined);
    } catch {
      settle();
    }
  }
  return { newPatientError, setNewPatientError, pendingNewPatient, newPatientPending, addNewPatient };
}
