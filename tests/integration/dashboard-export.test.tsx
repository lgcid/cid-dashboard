// @vitest-environment jsdom

import { useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toPngMock } = vi.hoisted(() => ({
  toPngMock: vi.fn()
}));

vi.mock("dom-to-image", () => ({
  default: {
    toPng: toPngMock
  }
}));

import {
  DASHBOARD_EXPORT_MODE_CLASS,
  SCREENSHOT_EXPORT_SCALE,
  SUMMARY_EXPORT_MODE_CLASS,
  exportDashboardPng
} from "@/lib/dashboard-export";
import { BRAND } from "@/lib/config";

function ExportHarness() {
  const exportRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div ref={exportRef} data-testid="export-target">
        Dashboard export target
      </div>
      <button
        type="button"
        onClick={() => {
          if (!exportRef.current) {
            return;
          }

          void exportDashboardPng({
            exportNode: exportRef.current,
            tab: "summary",
            weekToken: "2026-03-02_to_2026-03-08"
          });
        }}
      >
        Print
      </button>
    </div>
  );
}

describe("dashboard screenshot export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, "fonts", {
      value: { ready: Promise.resolve() },
      configurable: true
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports a png with the expected filename and temporary export classes", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    toPngMock.mockImplementation(async (node: HTMLElement, options: Record<string, unknown>) => {
      expect(node.classList.contains(DASHBOARD_EXPORT_MODE_CLASS)).toBe(true);
      expect(node.classList.contains(SUMMARY_EXPORT_MODE_CLASS)).toBe(true);
      expect(options).toMatchObject({
        bgcolor: BRAND.colors.white,
        cacheBust: true,
        width: 1280,
        height: 720,
        style: {
          transform: `scale(${SCREENSHOT_EXPORT_SCALE})`,
          transformOrigin: "top left",
          width: "640px",
          height: "360px"
        }
      });

      return "data:image/png;base64,exported";
    });

    render(<ExportHarness />);

    const exportTarget = screen.getByTestId("export-target");
    Object.defineProperty(exportTarget, "scrollWidth", {
      value: 640,
      configurable: true
    });
    Object.defineProperty(exportTarget, "scrollHeight", {
      value: 360,
      configurable: true
    });

    fireEvent.click(screen.getByRole("button", { name: "Print" }));

    await waitFor(() => {
      expect(toPngMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    const downloadLink = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(downloadLink.download).toBe("lgcid-summary-2026-03-02_to_2026-03-08.png");
    expect(downloadLink.href).toContain("data:image/png;base64,exported");
    expect(exportTarget.classList.contains(DASHBOARD_EXPORT_MODE_CLASS)).toBe(false);
    expect(exportTarget.classList.contains(SUMMARY_EXPORT_MODE_CLASS)).toBe(false);
  });
});
