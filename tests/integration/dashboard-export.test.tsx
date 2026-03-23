// @vitest-environment jsdom

import { useRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toPngMock } = vi.hoisted(() => ({
  toPngMock: vi.fn()
}));

const { jsPdfInstances, jsPdfSaveMock } = vi.hoisted(() => {
  const saveMock = vi.fn();
  const instances: Array<Record<string, unknown>> = [];
  return {
    jsPdfInstances: instances,
    jsPdfSaveMock: saveMock
  };
});

vi.mock("html-to-image", () => ({
  getFontEmbedCSS: vi.fn().mockResolvedValue("@font-face { font-family: MockFont; }"),
  toPng: toPngMock
}));

vi.mock("jspdf", () => ({
  jsPDF: class MockJsPdf {
    addFileToVFS = vi.fn();
    addFont = vi.fn();
    addImage = vi.fn();
    addPage = vi.fn();
    getImageProperties = vi.fn().mockReturnValue({ width: 800, height: 1600 });
    save = jsPdfSaveMock;
    setFont = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    splitTextToSize = vi.fn((text: string) => [text]);
    text = vi.fn();

    constructor() {
      jsPdfInstances.push(this as unknown as Record<string, unknown>);
    }
  }
}));

import {
  PDF_EXPORT_MODE_CLASS,
  SCREENSHOT_EXPORT_SCALE,
  SUMMARY_IMAGE_EXPORT_HEIGHT,
  SUMMARY_IMAGE_EXPORT_WIDTH,
  SUMMARY_EXPORT_MODE_CLASS,
  exportDashboardPdf,
  exportNodePng
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

          void exportNodePng({
            exportNode: exportRef.current,
            downloadName: "lgcid-summary-image-2026-03-02_to_2026-03-08.png",
            width: SUMMARY_IMAGE_EXPORT_WIDTH,
            height: SUMMARY_IMAGE_EXPORT_HEIGHT
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
    jsPdfInstances.length = 0;
    Object.defineProperty(document, "fonts", {
      value: { ready: Promise.resolve() },
      configurable: true
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/fonts/")) {
        return {
          arrayBuffer: async () => new TextEncoder().encode("mock-font").buffer
        } as Response;
      }

      return {
        blob: async () => new Blob(["mock"])
      } as Response;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports a png with the expected filename and temporary export classes", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    toPngMock.mockImplementation(async (node: HTMLElement, options: Record<string, unknown>) => {
      expect(node.classList.contains(SUMMARY_EXPORT_MODE_CLASS)).toBe(true);
      expect(options).toMatchObject({
        backgroundColor: BRAND.colors.white,
        cacheBust: true,
        width: SUMMARY_IMAGE_EXPORT_WIDTH,
        height: SUMMARY_IMAGE_EXPORT_HEIGHT,
        canvasWidth: SUMMARY_IMAGE_EXPORT_WIDTH,
        canvasHeight: SUMMARY_IMAGE_EXPORT_HEIGHT,
        pixelRatio: 1,
        fontEmbedCSS: "@font-face { font-family: MockFont; }",
        style: {
          width: `${SUMMARY_IMAGE_EXPORT_WIDTH}px`,
          height: `${SUMMARY_IMAGE_EXPORT_HEIGHT}px`
        }
      });

      return "data:image/png;base64,exported";
    });

    render(<ExportHarness />);

    const exportTarget = screen.getByTestId("export-target");
    fireEvent.click(screen.getByRole("button", { name: "Print" }));

    await waitFor(() => {
      expect(toPngMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    const downloadLink = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(downloadLink.download).toBe("lgcid-summary-image-2026-03-02_to_2026-03-08.png");
    expect(downloadLink.href).toContain("data:image/png;base64,exported");
    expect(exportTarget.classList.contains(SUMMARY_EXPORT_MODE_CLASS)).toBe(false);
  });

  it("exports a pdf with the expected filename and temporary export classes", async () => {
    toPngMock.mockImplementation(async (node: HTMLElement, options: Record<string, unknown>) => {
      expect(node.classList.contains(PDF_EXPORT_MODE_CLASS)).toBe(true);
      expect(node.classList.contains(SUMMARY_EXPORT_MODE_CLASS)).toBe(true);
      expect(options).toMatchObject({
        backgroundColor: BRAND.colors.white,
        cacheBust: true,
        width: 640,
        height: 360,
        canvasWidth: 1280,
        canvasHeight: 720,
        pixelRatio: 1
      });

      return "data:image/png;base64,exported";
    });

    const exportTarget = document.createElement("div");
    exportTarget.textContent = "Dashboard export target";
    Object.defineProperty(exportTarget, "scrollWidth", {
      value: 640,
      configurable: true
    });
    Object.defineProperty(exportTarget, "scrollHeight", {
      value: 360,
      configurable: true
    });
    document.body.appendChild(exportTarget);

    await exportDashboardPdf({
      exportNode: exportTarget,
      tab: "main",
      weekToken: "2026-02-09_to_2026-02-15",
      title: "Current Week",
      detailLine: "Detailed operational results across each CID focus area from 09 Feb 2026 to 15 Feb 2026."
    });

    expect(jsPdfSaveMock).toHaveBeenCalledWith("lgcid-current-week-2026-02-09_to_2026-02-15.pdf");
    expect(exportTarget.classList.contains(PDF_EXPORT_MODE_CLASS)).toBe(false);
    expect(exportTarget.classList.contains(SUMMARY_EXPORT_MODE_CLASS)).toBe(false);
    expect(jsPdfInstances).toHaveLength(1);

    const pdf = jsPdfInstances[0] as {
      addImage: ReturnType<typeof vi.fn>;
      text: ReturnType<typeof vi.fn>;
    };

    expect(pdf.addImage).toHaveBeenCalled();
    expect(pdf.text).toHaveBeenCalledWith("WEEKLY OPERATIONS DASHBOARD", expect.any(Number), expect.any(Number));
    expect((pdf as { addFileToVFS: ReturnType<typeof vi.fn> }).addFileToVFS).toHaveBeenCalled();
  });
});
