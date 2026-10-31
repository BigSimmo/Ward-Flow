"use client";

import { useState, type ReactNode } from "react";

import { ServicePickerMock } from "./service-picker";

/** The Service picker mock-up, drawn over its page and opened on load. `page` is the page it opens over. */
export function PopServicePicker({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {page}
      {open ? <ServicePickerMock onClose={() => setOpen(false)} /> : null}
    </>
  );
}
