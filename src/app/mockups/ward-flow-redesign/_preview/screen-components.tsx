"use client";

import type { ComponentType } from "react";

import { CapacityRedesign } from "@/components/ward-redesign/capacity/capacity-redesign";
import { EdIndexRedesign } from "@/components/ward-redesign/eds/eds-redesign";
import { HomeRedesign } from "@/components/ward-redesign/home/home-redesign";
import { MovementsRedesign } from "@/components/ward-redesign/movements/movements-redesign";
import { WaitingRedesign } from "@/components/ward-redesign/waiting/waiting-redesign";

import type { BuiltPageSlug } from "./built-pages";

export type MockupPageProps = { openOnLoad?: string };

/** Preview only: the redesigned page drawn for each mock-up slug. */
export const MOCKUP_PAGES: Readonly<Record<string, ComponentType<MockupPageProps>>> = {
  capacity: CapacityRedesign,
  home: HomeRedesign,
  movements: MovementsRedesign,
  waiting: WaitingRedesign,
  eds: EdIndexRedesign,
} satisfies Record<BuiltPageSlug, ComponentType<MockupPageProps>>;
