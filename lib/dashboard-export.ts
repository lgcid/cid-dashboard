import { getFontEmbedCSS, toJpeg, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { BRAND } from "@/lib/config";

export type DashboardExportTab = "main" | "summary" | "trends" | "c3";

export const SCREENSHOT_EXPORT_SCALE = 2;
export const SUMMARY_EXPORT_MODE_CLASS = "summary-export-mode";
export const PDF_EXPORT_MODE_CLASS = "dashboard-pdf-export-mode";
export const SUMMARY_IMAGE_EXPORT_WIDTH = 1414;
export const SUMMARY_IMAGE_EXPORT_HEIGHT = 2000;
const PDF_IMAGE_EXPORT_SCALE = 1.25;
const PDF_IMAGE_JPEG_QUALITY = 0.72;
const PDF_HEADER_IMAGE_ALIAS = "dashboard-pdf-header";
const PDF_FOOTER_IMAGE_ALIAS = "dashboard-pdf-footer";

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PDF_MARGIN_X = 38;
const PDF_CONTENT_GAP = 20;
const PDF_BODY_TEXT_WIDTH = A4_WIDTH_PT - PDF_MARGIN_X * 2;
const PDF_HEADER_ASPECT_RATIO = 584 / 2872;
const PDF_FOOTER_ASPECT_RATIO = 220 / 2874;
const PDF_HEADER_HEIGHT = A4_WIDTH_PT * PDF_HEADER_ASPECT_RATIO;
const PDF_FOOTER_HEIGHT = A4_WIDTH_PT * PDF_FOOTER_ASPECT_RATIO;
const PDF_FIRST_PAGE_TOP = PDF_HEADER_HEIGHT + 36;
const PDF_LATER_PAGE_TOP = PDF_HEADER_HEIGHT + 24;
const PDF_BOTTOM_LIMIT = A4_HEIGHT_PT - PDF_FOOTER_HEIGHT - 18;
const PDF_BLOCK_GAP = 18;
const PDF_BODY_COPY = "Weekly and historical operational performance for stakeholders, covering safety, cleaning, social upliftment, and general incidents.";
const PDF_FONT_FAMILY = "Roboto";

type PdfBlock = {
  render: () => HTMLElement;
};

type RenderedImage = {
  dataUrl: string;
  format: "PNG" | "JPEG";
  width: number;
  height: number;
};

let robotoFontDataPromise: Promise<{ regular: string; bold: string }> | null = null;

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

function buildDashboardExportFilename(tab: DashboardExportTab, weekToken: string): string {
  return `lgcid-${buildTabToken(tab)}-${weekToken}.png`;
}

function buildDashboardPdfFilename(tab: DashboardExportTab, weekToken: string): string {
  return `lgcid-${buildTabToken(tab)}-${weekToken}.pdf`;
}

async function renderDashboardNodeToPng({
  exportNode,
  exportWidth,
  exportHeight,
  canvasScale = SCREENSHOT_EXPORT_SCALE,
  modeClass,
  filter
}: {
  exportNode: HTMLElement;
  exportWidth?: number;
  exportHeight?: number;
  canvasScale?: number;
  modeClass?: string;
  filter?: (node: HTMLElement) => boolean;
}): Promise<{ pngDataUrl: string; width: number; height: number }> {
  const targetDocument = exportNode.ownerDocument;

  if (modeClass) {
    exportNode.classList.add(modeClass);
  }
  exportNode.classList.add(SUMMARY_EXPORT_MODE_CLASS);

  try {
    await waitForNextPaint(targetDocument);

    const fonts = "fonts" in targetDocument ? targetDocument.fonts : undefined;
    if (fonts) {
      await fonts.ready;
    }

    const measuredWidth = exportWidth ?? Math.ceil(exportNode.scrollWidth);
    const measuredHeight = exportHeight ?? Math.ceil(exportNode.scrollHeight);
    const fontEmbedCSS = await getFontEmbedCSS(exportNode);
    const pngDataUrl = await toPng(exportNode, {
      backgroundColor: BRAND.colors.white,
      cacheBust: true,
      width: measuredWidth,
      height: measuredHeight,
      canvasWidth: measuredWidth * canvasScale,
      canvasHeight: measuredHeight * canvasScale,
      pixelRatio: 1,
      fontEmbedCSS,
      filter: filter ? (node) => !(node instanceof HTMLElement) || filter(node) : undefined,
      style: {
        width: `${measuredWidth}px`,
        height: `${measuredHeight}px`
      }
    });

    return {
      pngDataUrl,
      width: measuredWidth,
      height: measuredHeight
    };
  } finally {
    if (modeClass) {
      exportNode.classList.remove(modeClass);
    }
    exportNode.classList.remove(SUMMARY_EXPORT_MODE_CLASS);
  }
}

async function renderDashboardNodeToJpeg({
  exportNode,
  exportWidth,
  exportHeight,
  canvasScale = PDF_IMAGE_EXPORT_SCALE,
  modeClass,
  filter
}: {
  exportNode: HTMLElement;
  exportWidth?: number;
  exportHeight?: number;
  canvasScale?: number;
  modeClass?: string;
  filter?: (node: HTMLElement) => boolean;
}): Promise<RenderedImage> {
  const targetDocument = exportNode.ownerDocument;

  if (modeClass) {
    exportNode.classList.add(modeClass);
  }
  exportNode.classList.add(SUMMARY_EXPORT_MODE_CLASS);

  try {
    await waitForNextPaint(targetDocument);

    const fonts = "fonts" in targetDocument ? targetDocument.fonts : undefined;
    if (fonts) {
      await fonts.ready;
    }

    const measuredWidth = exportWidth ?? Math.ceil(exportNode.scrollWidth);
    const measuredHeight = exportHeight ?? Math.ceil(exportNode.scrollHeight);
    const fontEmbedCSS = await getFontEmbedCSS(exportNode);
    const jpegDataUrl = await toJpeg(exportNode, {
      backgroundColor: BRAND.colors.white,
      cacheBust: true,
      width: measuredWidth,
      height: measuredHeight,
      canvasWidth: measuredWidth * canvasScale,
      canvasHeight: measuredHeight * canvasScale,
      pixelRatio: 1,
      fontEmbedCSS,
      quality: PDF_IMAGE_JPEG_QUALITY,
      filter: filter ? (node) => !(node instanceof HTMLElement) || filter(node) : undefined,
      style: {
        width: `${measuredWidth}px`,
        height: `${measuredHeight}px`
      }
    });

    return {
      dataUrl: jpegDataUrl,
      format: "JPEG",
      width: measuredWidth,
      height: measuredHeight
    };
  } finally {
    if (modeClass) {
      exportNode.classList.remove(modeClass);
    }
    exportNode.classList.remove(SUMMARY_EXPORT_MODE_CLASS);
  }
}

async function imageUrlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`Failed to read image asset: ${url}`));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read image asset: ${url}`));
    reader.readAsDataURL(blob);
  });
}

async function fontUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function ensurePdfRobotoFonts(pdf: jsPDF): Promise<void> {
  if (!robotoFontDataPromise) {
    robotoFontDataPromise = (async () => {
      const [regular, bold] = await Promise.all([
        fontUrlToBase64("/fonts/Roboto-Regular.ttf"),
        fontUrlToBase64("/fonts/Roboto-Bold.ttf")
      ]);
      return { regular, bold };
    })();
  }

  const fontData = await robotoFontDataPromise;
  pdf.addFileToVFS("Roboto-Regular.ttf", fontData.regular);
  pdf.addFont("Roboto-Regular.ttf", PDF_FONT_FAMILY, "normal");
  pdf.addFileToVFS("Roboto-Bold.ttf", fontData.bold);
  pdf.addFont("Roboto-Bold.ttf", PDF_FONT_FAMILY, "bold");
}

function addPdfChrome(pdf: jsPDF, headerDataUrl: string, footerDataUrl: string) {
  pdf.addImage(headerDataUrl, "PNG", 0, 0, A4_WIDTH_PT, PDF_HEADER_HEIGHT, PDF_HEADER_IMAGE_ALIAS);
  pdf.addImage(footerDataUrl, "PNG", 0, A4_HEIGHT_PT - PDF_FOOTER_HEIGHT, A4_WIDTH_PT, PDF_FOOTER_HEIGHT, PDF_FOOTER_IMAGE_ALIAS);
}

function addPdfIntro({
  pdf,
  title,
  detailLine
}: {
  pdf: jsPDF;
  title: string;
  detailLine: string;
}): number {
  let cursorY = PDF_FIRST_PAGE_TOP;

  pdf.setTextColor(23, 25, 29);
  pdf.setFont(PDF_FONT_FAMILY, "bold");
  pdf.setFontSize(10.5);
  pdf.text("WEEKLY OPERATIONS DASHBOARD", PDF_MARGIN_X, cursorY);
  cursorY += 35;

  pdf.setFont(PDF_FONT_FAMILY, "bold");
  pdf.setFontSize(26);
  pdf.text(title, PDF_MARGIN_X, cursorY);
  cursorY += 10;

  pdf.setFont(PDF_FONT_FAMILY, "normal");
  pdf.setFontSize(10.75);
  const descriptionLines = pdf.splitTextToSize(PDF_BODY_COPY, PDF_BODY_TEXT_WIDTH);
  pdf.text(descriptionLines, PDF_MARGIN_X, cursorY, { baseline: "top" });
  cursorY += descriptionLines.length * 13 + 14;

  pdf.setFont(PDF_FONT_FAMILY, "normal");
  pdf.setFontSize(10.5);
  const detailLines = pdf.splitTextToSize(detailLine, PDF_BODY_TEXT_WIDTH);
  pdf.text(detailLines, PDF_MARGIN_X, cursorY, { baseline: "top" });
  cursorY += detailLines.length * 12 + 8;

  return cursorY;
}

function createStagingRoot(targetDocument: Document): HTMLDivElement {
  const root = targetDocument.createElement("div");
  root.className = `${PDF_EXPORT_MODE_CLASS} ${SUMMARY_EXPORT_MODE_CLASS}`;
  Object.assign(root.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: "0",
    height: "0",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "-1",
    background: BRAND.colors.white
  });
  targetDocument.body.appendChild(root);
  return root;
}

function cloneBlockNode(sourceNode: HTMLElement, width: number): HTMLElement {
  const clone = sourceNode.cloneNode(true) as HTMLElement;
  clone.style.width = `${Math.ceil(width)}px`;
  clone.style.maxWidth = "none";
  clone.style.margin = "0";
  clone.style.background = BRAND.colors.white;
  return clone;
}

function buildGridRowBlock({
  items,
  width,
  columns,
  gap
}: {
  items: HTMLElement[];
  width: number;
  columns: number;
  gap: number;
}): PdfBlock {
  return {
    render: () => {
      const wrapper = document.createElement("div");
      wrapper.style.width = `${Math.ceil(width)}px`;
      wrapper.style.display = "grid";
      wrapper.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
      wrapper.style.gap = `${gap}px`;
      wrapper.style.alignItems = "stretch";
      wrapper.style.background = BRAND.colors.white;

      for (const item of items) {
        const itemClone = item.cloneNode(true) as HTMLElement;
        itemClone.style.margin = "0";
        wrapper.appendChild(itemClone);
      }

      return wrapper;
    }
  };
}

function buildElementBlock(sourceNode: HTMLElement): PdfBlock {
  const rect = sourceNode.getBoundingClientRect();
  const width = rect.width || sourceNode.scrollWidth || sourceNode.clientWidth;

  return {
    render: () => cloneBlockNode(sourceNode, width)
  };
}

function elementChildren(element: Element | null): HTMLElement[] {
  if (!(element instanceof HTMLElement)) {
    return [];
  }
  return Array.from(element.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
}

function buildPdfBlocksForMain(exportNode: HTMLElement): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const currentWeekSection = exportNode.querySelector("#current-week");
  const incidentsSection = exportNode.querySelector("#incidents");

  if (currentWeekSection instanceof HTMLElement) {
    const currentWeekBody = currentWeekSection.querySelector(":scope > .space-y-4");
    const rows = elementChildren(currentWeekBody);
    if (rows.length) {
      blocks.push(...rows.map((row) => buildElementBlock(row)));
    } else {
      blocks.push(buildElementBlock(currentWeekSection));
    }
  }

  if (incidentsSection instanceof HTMLElement) {
    blocks.push(buildElementBlock(incidentsSection));
  }

  return blocks;
}

function buildPdfBlocksForSummary(exportNode: HTMLElement): PdfBlock[] {
  const summaryGrid = exportNode.querySelector(".summary-infographic-grid");
  const rows = elementChildren(summaryGrid);
  return rows.length ? rows.map((row) => buildElementBlock(row)) : [];
}

function buildPdfBlocksForTrends(exportNode: HTMLElement): PdfBlock[] {
  const trendsGrid = exportNode.querySelector("#trends > .grid");
  if (!(trendsGrid instanceof HTMLElement)) {
    return [];
  }

  const items = elementChildren(trendsGrid);
  const gap = Number.parseFloat(globalThis.getComputedStyle(trendsGrid).rowGap || globalThis.getComputedStyle(trendsGrid).gap || "20") || 20;
  const width = trendsGrid.getBoundingClientRect().width || trendsGrid.scrollWidth || trendsGrid.clientWidth;
  const blocks: PdfBlock[] = [];

  for (let index = 0; index < items.length; index += 2) {
    blocks.push(
      buildGridRowBlock({
        items: items.slice(index, index + 2),
        width,
        columns: Math.min(2, items.slice(index, index + 2).length),
        gap
      })
    );
  }

  return blocks;
}

function buildPdfBlocksForC3(exportNode: HTMLElement): PdfBlock[] {
  const c3Section = exportNode.querySelector("#c3");
  return elementChildren(c3Section).map((block) => buildElementBlock(block));
}

function buildPdfBlocks(exportNode: HTMLElement, tab: DashboardExportTab): PdfBlock[] {
  switch (tab) {
    case "main":
      return buildPdfBlocksForMain(exportNode);
    case "summary":
      return buildPdfBlocksForSummary(exportNode);
    case "trends":
      return buildPdfBlocksForTrends(exportNode);
    case "c3":
      return buildPdfBlocksForC3(exportNode);
  }
}

async function renderPdfBlockToImage({
  targetDocument,
  stagingRoot,
  block
}: {
  targetDocument: Document;
  stagingRoot: HTMLElement;
  block: PdfBlock;
}): Promise<RenderedImage> {
  const blockNode = block.render();
  stagingRoot.appendChild(blockNode);

  try {
    await waitForNextPaint(targetDocument);

    const fonts = "fonts" in targetDocument ? targetDocument.fonts : undefined;
    if (fonts) {
      await fonts.ready;
    }

    const exportWidth = Math.ceil(blockNode.scrollWidth);
    const exportHeight = Math.ceil(blockNode.scrollHeight);
    const fontEmbedCSS = await getFontEmbedCSS(blockNode);
    const jpegDataUrl = await toJpeg(blockNode, {
      backgroundColor: BRAND.colors.white,
      cacheBust: true,
      width: exportWidth,
      height: exportHeight,
      canvasWidth: exportWidth * PDF_IMAGE_EXPORT_SCALE,
      canvasHeight: exportHeight * PDF_IMAGE_EXPORT_SCALE,
      pixelRatio: 1,
      fontEmbedCSS,
      quality: PDF_IMAGE_JPEG_QUALITY,
      style: {
        width: `${exportWidth}px`,
        height: `${exportHeight}px`
      }
    });

    return {
      dataUrl: jpegDataUrl,
      format: "JPEG",
      width: exportWidth,
      height: exportHeight
    };
  } finally {
    blockNode.remove();
  }
}

function startPdfPage(pdf: jsPDF, headerDataUrl: string, footerDataUrl: string): number {
  pdf.addPage();
  addPdfChrome(pdf, headerDataUrl, footerDataUrl);
  return PDF_LATER_PAGE_TOP;
}

function addBlockImageWithPagination({
  pdf,
  image,
  headerDataUrl,
  footerDataUrl,
  cursorY
}: {
  pdf: jsPDF;
  image: RenderedImage;
  headerDataUrl: string;
  footerDataUrl: string;
  cursorY: number;
}): number {
  const imageWidth = PDF_BODY_TEXT_WIDTH;
  const imageProps = pdf.getImageProperties(image.dataUrl);
  const renderedImageHeight = (imageProps.height * imageWidth) / imageProps.width;
  const fullPageHeight = PDF_BOTTOM_LIMIT - PDF_LATER_PAGE_TOP;

  if (renderedImageHeight <= PDF_BOTTOM_LIMIT - cursorY) {
    pdf.addImage(image.dataUrl, image.format, PDF_MARGIN_X, cursorY, imageWidth, renderedImageHeight, undefined, "MEDIUM");
    return cursorY + renderedImageHeight + PDF_BLOCK_GAP;
  }

  if (renderedImageHeight <= fullPageHeight) {
    const nextPageTop = startPdfPage(pdf, headerDataUrl, footerDataUrl);
    pdf.addImage(image.dataUrl, image.format, PDF_MARGIN_X, nextPageTop, imageWidth, renderedImageHeight, undefined, "MEDIUM");
    return nextPageTop + renderedImageHeight + PDF_BLOCK_GAP;
  }

  let remainingHeight = renderedImageHeight;
  let offsetY = 0;
  let pageCursorY = cursorY;

  while (remainingHeight > 0) {
    let availableHeight = PDF_BOTTOM_LIMIT - pageCursorY;
    if (availableHeight < 40) {
      pageCursorY = startPdfPage(pdf, headerDataUrl, footerDataUrl);
      availableHeight = PDF_BOTTOM_LIMIT - pageCursorY;
    }

    const consumedHeight = Math.min(availableHeight, remainingHeight);
    pdf.addImage(image.dataUrl, image.format, PDF_MARGIN_X, pageCursorY - offsetY, imageWidth, renderedImageHeight, undefined, "MEDIUM");
    remainingHeight -= consumedHeight;
    offsetY += consumedHeight;

    if (remainingHeight > 0) {
      pageCursorY = startPdfPage(pdf, headerDataUrl, footerDataUrl);
    } else {
      pageCursorY += consumedHeight + PDF_BLOCK_GAP;
    }
  }

  return pageCursorY;
}

export async function exportNodePng({
  exportNode,
  downloadName,
  width,
  height,
  canvasScale = 1
}: {
  exportNode: HTMLElement;
  downloadName: string;
  width?: number;
  height?: number;
  canvasScale?: number;
}): Promise<{ downloadName: string; pngDataUrl: string }> {
  const targetDocument = exportNode.ownerDocument;
  const { pngDataUrl } = await renderDashboardNodeToPng({
    exportNode,
    exportWidth: width,
    exportHeight: height,
    canvasScale
  });

  const link = targetDocument.createElement("a");
  link.href = pngDataUrl;
  link.download = downloadName;
  link.click();

  return { downloadName, pngDataUrl };
}

export async function exportDashboardPdf({
  exportNode,
  tab,
  weekToken,
  title,
  detailLine
}: {
  exportNode: HTMLElement;
  tab: DashboardExportTab;
  weekToken: string;
  title: string;
  detailLine: string;
}): Promise<{ downloadName: string }> {
  const targetDocument = exportNode.ownerDocument;
  const stagingRoot = createStagingRoot(targetDocument);
  const [headerDataUrl, footerDataUrl] = await Promise.all([
    imageUrlToDataUrl("/pdfs/header.png"),
    imageUrlToDataUrl("/pdfs/footer.png")
  ]);

  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });
    await ensurePdfRobotoFonts(pdf);

    addPdfChrome(pdf, headerDataUrl, footerDataUrl);
    let cursorY = addPdfIntro({
      pdf,
      title,
      detailLine
    }) + PDF_CONTENT_GAP;

    const blocks = buildPdfBlocks(exportNode, tab);

    if (!blocks.length) {
      const image = await renderDashboardNodeToJpeg({
        exportNode,
        modeClass: PDF_EXPORT_MODE_CLASS,
        filter: (node) => !(node.classList.contains("export-image-header") || node.classList.contains("export-image-footer"))
      });
      cursorY = addBlockImageWithPagination({
        pdf,
        image,
        headerDataUrl,
        footerDataUrl,
        cursorY
      });
    } else {
      for (const block of blocks) {
        const image = await renderPdfBlockToImage({
          targetDocument,
          stagingRoot,
          block
        });
        cursorY = addBlockImageWithPagination({
          pdf,
          image,
          headerDataUrl,
          footerDataUrl,
          cursorY
        });
      }
    }

    const downloadName = buildDashboardPdfFilename(tab, weekToken);
    pdf.save(downloadName);

    return { downloadName };
  } finally {
    stagingRoot.remove();
  }
}
