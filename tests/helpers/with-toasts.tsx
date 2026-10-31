import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { ToastProvider } from "@/components/wf/toast-provider";

/**
 * Renders a screen inside the shared `ToastProvider`, as the Ward Flow layout does. A screen's own
 * outcome (`useActionToast`) is drawn by the provider, so without it the toast never shows. The
 * wrapper stays on `rerender`.
 */
export function renderWithToasts(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { ...options, wrapper: ToastProvider });
}
