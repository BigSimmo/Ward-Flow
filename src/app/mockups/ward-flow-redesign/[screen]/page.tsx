import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MOCKUP_SCREENS, screenBySlug } from "../_preview/screens";
import { PreviewScreen, type PreviewTheme } from "../_preview/preview-screen";

type Props = {
  params: Promise<{ screen: string }>;
  searchParams: Promise<{ pop?: string; theme?: string }>;
};

export function generateStaticParams() {
  return MOCKUP_SCREENS.map((screen) => ({ screen: screen.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const screen = screenBySlug((await params).screen);
  return { title: `${screen?.label ?? "Mock-up"} (redesign mock-up) — Ward Flow`, robots: { index: false } };
}

export default async function RedesignScreenPage({ params, searchParams }: Props) {
  const screen = screenBySlug((await params).screen);
  if (!screen) notFound();
  const query = await searchParams;
  const theme: PreviewTheme = query.theme === "dark" || query.theme === "light" ? query.theme : null;
  return <PreviewScreen slug={screen.slug} pop={query.pop ?? null} theme={theme} />;
}
