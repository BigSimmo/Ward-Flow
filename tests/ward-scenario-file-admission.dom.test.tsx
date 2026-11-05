import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { ScenarioFileLoader } from "@/components/ward-management/ward-scenario-import-owner";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// Independent boundary assertion: metadata is varied without allocating a large file.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const load = vi.fn<ScenarioFileLoader>();
let adopted: string[];
function Override({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  return <WardFlowOverride value={{ ...value, loadScenarioFile: load }}>{children}</WardFlowOverride>;
}
function mount() {
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Override>
        <WardDemoPanel oneList />
      </Override>
    </WardFlowProvider>,
  );
  return view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
}
function fileWithSize(size: number, read: () => Promise<string> = async () => "{}") {
  const file = new File(["{}"], "synthetic-scenario.json", { type: "application/json" });
  const text = vi.fn(read);
  Object.defineProperties(file, { size: { value: size }, text: { value: text } });
  return { file, text };
}
async function select(input: HTMLInputElement, file: File) {
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}
beforeEach(() => {
  adopted = [];
  load.mockReset().mockImplementation(async (source, isCurrent = () => true) => {
    const text = await source;
    if (!isCurrent()) return { ok: false, reason: "The demo changed while the file was loading. Nothing was loaded." };
    adopted.push(text);
    return { ok: true };
  });
});

describe("scenario file admission before browser decoding", () => {
  it("allows the exact 10 MiB boundary through the existing loader", async () => {
    const input = mount();
    const { file, text } = fileWithSize(MAX_FILE_BYTES);
    await select(input, file);
    expect(text).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(adopted).toEqual(["{}"]);
    expect(screen.getByRole("status")).toHaveTextContent("Scenario loaded.");
  });

  it("rejects one byte over the limit without reading it, then accepts a subsequent valid selection", async () => {
    const input = mount();
    const oversized = fileWithSize(MAX_FILE_BYTES + 1);
    await select(input, oversized.file);
    expect(oversized.text).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("larger than 10 MiB");
    expect(adopted).toEqual([]);
    const valid = fileWithSize(2);
    await select(input, valid.file);
    expect(valid.text).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(adopted).toEqual(["{}"]);
    expect(screen.getByRole("status")).toHaveTextContent("Scenario loaded.");
  });

  it("invalidates an older pending import even when the newer selection is rejected for size", async () => {
    const input = mount();
    let finish!: (text: string) => void;
    const pending = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const first = fileWithSize(2, () => pending);
    await select(input, first.file);
    expect(load).toHaveBeenCalledTimes(1);
    const oversized = fileWithSize(MAX_FILE_BYTES + 1);
    await select(input, oversized.file);
    expect(oversized.text).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish("{}");
      await pending;
    });
    expect(adopted).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("larger than 10 MiB");
    expect(screen.getByRole("status")).not.toHaveTextContent("Scenario loaded.");
  });
});
