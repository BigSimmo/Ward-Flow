"use client";

/**
 * TR4 (3 Nov 2026): the providers' numbers beside Log booking, so the officer does not leave the
 * dialog to find them. Every number is synthetic, from the ACMA range set aside for fiction
 * ((08) 5550 xxxx), and the block says so. Copy puts the number on the clipboard; nothing dials.
 */
import { useState } from "react";
import { Check, Copy, Phone } from "lucide-react";

import { Button } from "@/components/wf";

import styles from "./officer.module.css";

const CONTACTS: readonly { provider: string; number: string; hours: string }[] = [
  { provider: "Patient transport service", number: "(08) 5550 0141", hours: "24 hours" },
  { provider: "Mental Health Transport", number: "(08) 5550 0172", hours: "24 hours" },
  { provider: "Ambulance (St John)", number: "(08) 5550 0118", hours: "24 hours" },
  { provider: "RFDS", number: "(08) 5550 0190", hours: "Country transfers" },
];

/** The synthetic number for a provider named on a booking, if the list has one. */
export function providerNumber(provider: string | undefined): string | undefined {
  return CONTACTS.find((contact) => contact.provider === provider)?.number;
}

/** TR2 (3 Nov 2026): copy the provider's number from the job panel foot. */
export function CopyProviderNumber({ provider, iconOnly }: { provider: string | undefined; iconOnly: boolean }) {
  const [copied, setCopied] = useState(false);
  const number = providerNumber(provider);
  if (!number) return null;
  return (
    <Button
      variant="sec"
      size="sm"
      icon={copied ? Check : Phone}
      iconOnly={iconOnly}
      title={`${provider}, ${number} (synthetic)`}
      aria-label={`Copy ${provider} number, ${number}, synthetic`}
      onClick={() =>
        void navigator.clipboard?.writeText(number.replace(/[^\d]/g, "")).then(
          () => setCopied(true),
          () => setCopied(false),
        )
      }
    >
      {copied ? "Copied" : "Provider"}
    </Button>
  );
}

export function OfficerBookingContacts() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (number: string) => {
    void navigator.clipboard?.writeText(number.replace(/[^\d]/g, "")).then(
      () => setCopied(number),
      () => setCopied(null),
    );
  };
  return (
    <section className={styles.contacts} aria-labelledby="ward-officer-contacts-heading">
      <h3 id="ward-officer-contacts-heading" className={styles.contactsHead}>
        Provider numbers
        <span className={styles.contactsTag}>Synthetic numbers</span>
      </h3>
      <ul className={styles.contactsList}>
        {CONTACTS.map((contact) => (
          <li key={contact.provider} className={styles.contactRow}>
            <span className={styles.contactText}>
              <b>{contact.provider}</b>
              <span>
                <span className={styles.mono}>{contact.number}</span> · {contact.hours}
              </span>
            </span>
            <button
              type="button"
              className={styles.contactCopy}
              onClick={() => copy(contact.number)}
              aria-label={`Copy the ${contact.provider} number`}
            >
              {copied === contact.number ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
              {copied === contact.number ? "Copied" : "Copy"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
