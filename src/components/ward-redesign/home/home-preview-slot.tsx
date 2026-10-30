"use client";

import { createContext, type ReactNode } from "react";

/**
 * Preview only: extra referral actions a state mock-up asks Home to draw inside its Referral placement
 * panel (the Not wired mock-up's Contact referrer). When set, Home opens on the oldest referral to
 * decide, so the panel is on screen. Nothing else on Home reads it; it is empty in every other view.
 */
export const HomeReferralActionsSlot = createContext<ReactNode>(null);
