import domtoimage from "dom-to-image";
import { BRAND } from "@/lib/config";

export type DashboardExportTab = "main" | "summary" | "trends" | "c3";

export const SCREENSHOT_EXPORT_SCALE = 2;
export const DASHBOARD_EXPORT_MODE_CLASS = "dashboard-export-mode";
export const SUMMARY_EXPORT_MODE_CLASS = "summary-export-mode";

function buildTabToken(tab: DashboardExportTab): string {
  return tab === "main" ? "current-week" : tab;
}

async function waitForNextPaint(targetDocument: Document): Promise<void> {
  const requestFrame = targetDocument.defaultView?.requestAnimationFrame;
  if (!requestFrame) {
    return;
  }

  await new Promise<void>((resolve) => {
    requestFrame(() => {
      requestFrame(() => resolve());
    });
  });
}

export function buildDashboardExportFilename(tab: DashboardExportTab, weekToken: string): string {
  return `lgcid-${buildTabToken(tab)}-${weekToken}.png`;
}

export async function exportDashboardPng({
  exportNode,
  tab,
  weekToken
}: {
  exportNode: HTMLElement;
  tab: DashboardExportTab;
  weekToken: string;
}): Promise<{ downloadName: string; pngDataUrl: string }> {
  const targetDocument = exportNode.ownerDocument;
  const downloadName = buildDashboardExportFilename(tab, weekToken);

  exportNode.classList.add(DASHBOARD_EXPORT_MODE_CLASS);
  exportNode.classList.add(SUMMARY_EXPORT_MODE_CLASS);

  try {
    await waitForNextPaint(targetDocument);

    const fonts = "fonts" in targetDocument ? targetDocument.fonts : undefined;
    if (fonts) {
      await fonts.ready;
    }

    const exportWidth = Math.ceil(exportNode.scrollWidth);
    const exportHeight = Math.ceil(exportNode.scrollHeight);
    const pngDataUrl = await domtoimage.toPng(exportNode, {
      bgcolor: BRAND.colors.white,
      cacheBust: true,
      width: exportWidth * SCREENSHOT_EXPORT_SCALE,
      height: exportHeight * SCREENSHOT_EXPORT_SCALE,
      style: {
        transform: `scale(${SCREENSHOT_EXPORT_SCALE})`,
        transformOrigin: "top left",
        width: `${exportWidth}px`,
        height: `${exportHeight}px`
      }
    });

    const link = targetDocument.createElement("a");
    link.href = pngDataUrl;
    link.download = downloadName;
    link.click();

    return { downloadName, pngDataUrl };
  } finally {
    exportNode.classList.remove(DASHBOARD_EXPORT_MODE_CLASS);
    exportNode.classList.remove(SUMMARY_EXPORT_MODE_CLASS);
  }
}
