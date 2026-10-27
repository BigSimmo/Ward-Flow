import { WardMovementNotFound } from "@/components/ward-management/ward-movement-not-found";

/**
 * A1K-05 / H-0195 (Josh, 27 Oct 2026): a malformed patient address is a real 404 that keeps the
 * tailored wording. Nothing from the address is quoted back: it may hold a UMRN (D-39).
 */
export default function PatientAddressNotFound() {
  return <WardMovementNotFound requestedId="" reason="not-a-person-id" />;
}
