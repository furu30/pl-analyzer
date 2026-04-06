import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";
import { Company } from "./types";

// ── 型定義 ──

export interface PdfReportSections {
  coverPage: boolean;
  plTable: boolean;
  waterfallChart: boolean;
  growthChart: boolean;
  simulation: boolean;
}

export interface PdfReportOptions {
  company: Company;
  sections: PdfReportSections;
  // 全セクションの画像（DOMキャプチャ済み）
  coverImage?: string;
  plTableImage?: string;
  waterfallImages?: string[];
  growthChartImage?: string;
  simulationImage?: string;
}

// ── 定数 ──

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 10;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_HEIGHT = PAGE_HEIGHT - MARGIN * 2;

// ── メイン関数 ──

export async function exportReportPdf(options: PdfReportOptions): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { sections } = options;
  let isFirstPage = true;

  const addNewPage = () => {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
  };

  const addImagePage = (imageDataUrl: string) => {
    addNewPage();
    embedImageFit(doc, imageDataUrl);
  };

  if (sections.coverPage && options.coverImage) {
    addImagePage(options.coverImage);
  }

  if (sections.plTable && options.plTableImage) {
    addImagePage(options.plTableImage);
  }

  if (sections.waterfallChart && options.waterfallImages?.length) {
    for (const img of options.waterfallImages) {
      addImagePage(img);
    }
  }

  if (sections.growthChart && options.growthChartImage) {
    addImagePage(options.growthChartImage);
  }

  if (sections.simulation && options.simulationImage) {
    addImagePage(options.simulationImage);
  }

  // ダウンロード
  const fileName = `${options.company.name || "損益分析"}_レポート.pdf`;
  const blob = doc.output("blob");
  saveAs(blob, fileName);
}

// ── 画像をA4ページにフィットして埋め込み ──

function embedImageFit(doc: jsPDF, imageDataUrl: string) {
  try {
    const imgProps = doc.getImageProperties(imageDataUrl);
    const imgAspect = imgProps.width / imgProps.height;

    let imgWidth = CONTENT_WIDTH;
    let imgHeight = imgWidth / imgAspect;

    if (imgHeight > CONTENT_HEIGHT) {
      imgHeight = CONTENT_HEIGHT;
      imgWidth = imgHeight * imgAspect;
    }

    const x = MARGIN + (CONTENT_WIDTH - imgWidth) / 2;
    const y = MARGIN + (CONTENT_HEIGHT - imgHeight) / 2;

    doc.addImage(imageDataUrl, "PNG", x, y, imgWidth, imgHeight);
  } catch {
    // 画像の埋め込みに失敗した場合は空白ページ
  }
}
