"use client";

/**
 * TR4 (3 Nov 2026): the providers' numbers beside Log booking, so the officer does not leave the
 * dialog to find them. Every number is synthetic, from the ACMA range set aside for fiction
 * ((08) 5550 xxxx), and the block says so. Copy puts the number on the clipboard; nothing dials.
 */
import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import type { TransportProvider, TravelMode } from "@/components/ward-management/ward-model";

import own from "./officer-booking-contacts.module.css";
import styles from "./officer.module.css";

const CONTACTS: readonly { provider: TravelMode; number: string; hours: string }[] = [
  { provider: "Patient transport service", number: "(08) 5550 0141", hours: "24 hours" },
  { provider: "Mental Health Transport", number: "(08) 5550 0172", hours: "24 hours" },
  { provider: "Ambulance (St John)", number: "(08) 5550 0118", hours: "24 hours" },
  { provider: "RFDS", number: "(08) 5550 0190", hours: "Country transfers" },
];

/** The synthetic number for a provider named on a booking, if the list has one. */
function providerNumber(provider: string | undefined): string | undefined {
  return CONTACTS.find((contact) => contact.provider === provider)?.number;
}

/** TR2 (3 Nov 2026): the provider's synthetic number in the job's facts, with a quiet copy button. */
export function ProviderNumber({ provider }: { provider: string | undefined }) {
  const [copied, setCopied] = useState(false);
  const number = providerNumber(provider);
  if (!number) return null;
  return (
    <span className={own.factNumber}>
      <span className={styles.mono}>{number}</span>
      <span className={own.synthetic}>synthetic</span>
      <button
        type="button"
        className={styles.contactCopy}
        aria-label={`Copy the ${provider} number`}
        onClick={() =>
          void copyTextToClipboard(number).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        {copied ? (
          <Check size={14} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

/**
 * The list is also the provider picker: choosing a row answers "Who is collecting" in the form beside
 * it, so the officer finds the number and records the provider in one tap.
 */
export function OfficerBookingContacts({
  selected,
  onPick,
  note = "Choose the one you booked and it fills Who is collecting.",
  headingId = "ward-officer-contacts-heading",
  className,
}: {
  selected?: TransportProvider;
  onPick?: (provider: TravelMode) => void;
  note?: string;
  headingId?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (number: string) => {
    void copyTextToClipboard(number).then(
      () => setCopied(number),
      () => setCopied(null),
    );
  };
  return (
    <section className={className ? `${styles.contacts} ${className}` : styles.contacts} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.contactsHead}>
        Call a provider
        <span className={styles.contactsTag}>Synthetic numbers</span>
      </h3>
      <ul className={styles.contactsList}>
        {CONTACTS.map((contact) => {
          const chosen = selected === contact.provider;
          return (
            <li
              key={contact.provider}
              className={`${styles.contactRow} ${own.row}`}
              data-chosen={chosen ? "true" : undefined}
            >
              <button
                type="button"
                className={own.pick}
                aria-pressed={chosen}
                onClick={() => onPick?.(contact.provider)}
                data-testid={`ward-officer-contact-${contact.provider}`}
              >
                <span className={styles.contactText}>
                  <b>
                    {chosen ? <Check size={14} strokeWidth={1.75} aria-hidden="true" /> : null}
                    {contact.provider}
                  </b>
                  <span>
                    <span className={styles.mono}>{contact.number}</span> · {contact.hours}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={styles.contactCopy}
                onClick={() => copy(contact.number)}
                aria-label={`Copy the ${contact.provider} number`}
              >
                {copied === contact.number ? (
                  <Check size={14} strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Copy size={14} strokeWidth={1.75} aria-hidden="true" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className={own.note}>{note}</p>
    </section>
  );
}
