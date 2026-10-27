import { WardMovementNotFound } from "@/components/ward-management/ward-movement-not-found";

/**
 * A1K-05 / H-0195 (Josh, 27 Oct 2026): a malformed movement address is a real 404 that keeps the
 * tailored wording. Nothing from the address is quoted back.
 */
export default function MovementAddressNotFound() {
  return <WardMovementNotFound requestedId="" reason="not-a-movement-id" />;
}
