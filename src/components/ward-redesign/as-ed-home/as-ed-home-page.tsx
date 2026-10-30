"use client";

import { EdBoardPage } from "@/components/ward-redesign/ed-board/ed-board-page";

/**
 * As ED clinician: the ED board mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsEdHomePage() {
  return <EdBoardPage />;
}
