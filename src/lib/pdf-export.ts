import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PeriodData,
  Scenario,
  Company,
} from "./types";
import {
  calculateMetrics,
  calculateCompositionRatios,
  calculateYoYChange,
  calculateScenario,
  formatNumber,
} from "./calculations";

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
  periods: PeriodData[];
  scenarios: Scenario[];
  sections: PdfReportSections;
  waterfallImages?: string[]; // PNG data URLs
  growthChartImage?: string; // PNG data URL
}

// ── 定数 ──

const THEME_COLOR: [number, number, number] = [31, 78, 121]; // #1F4E79
const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// 色定数（RGB）
const SALES_BG: [number, number, number] = [226, 239, 218]; // #E2EFDA
const VARIABLE_BG: [number, number, number] = [255, 242, 204]; // #FFF2CC
const FIXED_BG: [number, number, number] = [252, 228, 214]; // #FCE4D6
const PROFIT_BG: [number, number, number] = [252, 228, 236]; // #FCE4EC

// ── メイン関数 ──

export async function exportReportPdf(options: PdfReportOptions): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // 日本語フォント登録（動的import）
  const { registerJapaneseFont } = await import("./pdf-fonts");
  registerJapaneseFont(doc);

  const { sections } = options;
  let isFirstPage = true;

  const addNewPage = () => {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
  };

  if (sections.coverPage) {
    addNewPage();
    renderCoverPage(doc, options);
  }

  if (sections.plTable && options.periods.length >= 1) {
    addNewPage();
    renderPLTable(doc, options);
  }

  if (sections.waterfallChart && options.waterfallImages?.length) {
    for (const img of options.waterfallImages) {
      addNewPage();
      renderChartPage(doc, img, "利益変動要因分析（ウォーターフォールチャート）");
    }
  }

  if (sections.growthChart && options.growthChartImage) {
    addNewPage();
    renderChartPage(doc, options.growthChartImage, "Growth Chart（成長軌跡図）");
  }

  if (sections.simulation && options.scenarios.length >= 1 && options.periods.length >= 1) {
    addNewPage();
    renderSimulationTable(doc, options);
  }

  addPageNumbers(doc, options.company.name);

  // ダウンロード
  const fileName = `${options.company.name || "損益分析"}_レポート.pdf`;
  doc.save(fileName);
}

// ── 表紙 ──

function renderCoverPage(doc: jsPDF, options: PdfReportOptions) {
  const { company, periods } = options;

  // テーマカラーの帯（上部）
  doc.setFillColor(...THEME_COLOR);
  doc.rect(0, 0, PAGE_WIDTH, 8, "F");

  // 企業名
  doc.setFont("NotoSansJP", "normal");
  doc.setFontSize(28);
  doc.setTextColor(30, 30, 30);
  doc.text(company.name || "企業名未設定", PAGE_WIDTH / 2, 100, { align: "center" });

  // サブタイトル
  doc.setFontSize(18);
  doc.setTextColor(...THEME_COLOR);
  doc.text("損益分析レポート", PAGE_WIDTH / 2, 120, { align: "center" });

  // テーマカラーの罫線
  doc.setDrawColor(...THEME_COLOR);
  doc.setLineWidth(0.8);
  doc.line(MARGIN + 20, 135, PAGE_WIDTH - MARGIN - 20, 135);

  // 分析期間
  if (periods.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    const periodRange = periods.length === 1
      ? periods[0].label
      : `${periods[0].label} ～ ${periods[periods.length - 1].label}`;
    doc.text(`分析期間: ${periodRange}`, PAGE_WIDTH / 2, 150, { align: "center" });
  }

  // 作成日
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 作成`;
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 120);
  doc.text(dateStr, PAGE_WIDTH / 2, 165, { align: "center" });

  // フッター帯
  doc.setFillColor(...THEME_COLOR);
  doc.rect(0, PAGE_HEIGHT - 12, PAGE_WIDTH, 12, "F");

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("PL Analyzer - 製造業損益分析", PAGE_WIDTH / 2, PAGE_HEIGHT - 4.5, { align: "center" });
}

// ── 損益比較表 ──

function renderPLTable(doc: jsPDF, options: PdfReportOptions) {
  const { periods } = options;

  doc.setFont("NotoSansJP", "normal");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("損益比較表", MARGIN, 18);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("（単位：千円）", MARGIN + 55, 18);

  // テーブルデータ構築
  type RowDef = {
    label: string;
    bg?: [number, number, number];
    getValue: (p: PeriodData, m: ReturnType<typeof calculateMetrics>) => number;
    pct?: boolean;
    bold?: boolean;
  };

  const rowDefs: RowDef[] = [
    { label: "売上高", bg: SALES_BG, getValue: (p) => p.sales, bold: true },
    { label: "  材料費", bg: VARIABLE_BG, getValue: (p) => p.materialCost },
    { label: "  外注費", bg: VARIABLE_BG, getValue: (p) => p.outsourcingCost },
    { label: "  商品仕入", bg: VARIABLE_BG, getValue: (p) => p.merchandisePurchase },
    { label: "  その他変動費", bg: VARIABLE_BG, getValue: (p) => p.otherVariableCost },
    { label: "変動費合計", bg: VARIABLE_BG, getValue: (_p, m) => m.totalVariableCost, bold: true },
    { label: "限界利益", bg: SALES_BG, getValue: (_p, m) => m.marginalProfit, bold: true },
    { label: "限界利益率(%)", bg: SALES_BG, getValue: (_p, m) => m.marginalProfitRate, pct: true },
    { label: "  人件費", bg: FIXED_BG, getValue: (p) => p.laborCost },
    { label: "  減価償却費", bg: FIXED_BG, getValue: (p) => p.depreciation },
    { label: "  その他経費", bg: FIXED_BG, getValue: (p) => p.otherExpenses },
    { label: "固定費合計", bg: FIXED_BG, getValue: (_p, m) => m.totalFixedCost, bold: true },
    { label: "営業利益", bg: PROFIT_BG, getValue: (_p, m) => m.operatingProfit, bold: true },
    { label: "営業外損益", getValue: (p) => p.nonOperatingIncome },
    { label: "経常利益", bg: PROFIT_BG, getValue: (_p, m) => m.ordinaryProfit, bold: true },
    { label: "従業員数(人)", getValue: (p) => p.employeeCount },
    { label: "労働分配率(%)", getValue: (_p, m) => m.laborShareRate, pct: true },
  ];

  // ヘッダー
  const head = [["項目", ...periods.map((p) => p.label)]];

  // ボディ
  const body = rowDefs.map((def) => {
    const values = periods.map((p) => {
      const m = calculateMetrics(p);
      const v = def.getValue(p, m);
      return def.pct ? formatNumber(v, 1) + "%" : formatNumber(v, 0);
    });
    return [def.label, ...values];
  });

  // 構成比セクション
  if (periods.length >= 2) {
    body.push(["", ...periods.map(() => "")]);
    body.push(["【構成比 (%)】", ...periods.map(() => "")]);

    const ratioRows: { label: string; getRate: (p: PeriodData) => number }[] = [
      { label: "変動費率", getRate: (p) => { const m = calculateMetrics(p); return calculateCompositionRatios(p, m).totalVariableCostRate; } },
      { label: "限界利益率", getRate: (p) => { const m = calculateMetrics(p); return calculateCompositionRatios(p, m).marginalProfitRate; } },
      { label: "固定費率", getRate: (p) => { const m = calculateMetrics(p); return calculateCompositionRatios(p, m).totalFixedCostRate; } },
      { label: "営業利益率", getRate: (p) => { const m = calculateMetrics(p); return calculateCompositionRatios(p, m).operatingProfitRate; } },
      { label: "経常利益率", getRate: (p) => { const m = calculateMetrics(p); return calculateCompositionRatios(p, m).ordinaryProfitRate; } },
    ];

    for (const rr of ratioRows) {
      body.push([rr.label, ...periods.map((p) => formatNumber(rr.getRate(p), 1) + "%")]);
    }
  }

  autoTable(doc, {
    startY: 24,
    head,
    body,
    theme: "grid",
    styles: {
      font: "NotoSansJP",
      fontSize: 8,
      cellPadding: 2,
      halign: "right",
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: THEME_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 38 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const rowIdx = data.row.index;
        if (rowIdx < rowDefs.length) {
          const def = rowDefs[rowIdx];
          if (def.bg) {
            data.cell.styles.fillColor = def.bg;
          }
          if (def.bold) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
      // 数値列にも背景色適用
      if (data.section === "body" && data.column.index > 0) {
        const rowIdx = data.row.index;
        if (rowIdx < rowDefs.length && rowDefs[rowIdx].bg) {
          data.cell.styles.fillColor = rowDefs[rowIdx].bg;
        }
      }
    },
  });
}

// ── チャート画像ページ ──

function renderChartPage(doc: jsPDF, imageDataUrl: string, title: string) {
  doc.setFont("NotoSansJP", "normal");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(title, MARGIN, 18);

  // 画像をフィット
  try {
    const imgProps = doc.getImageProperties(imageDataUrl);
    const imgAspect = imgProps.width / imgProps.height;
    let imgWidth = CONTENT_WIDTH;
    let imgHeight = imgWidth / imgAspect;

    // 高さがページに収まらない場合
    const maxHeight = PAGE_HEIGHT - 40 - MARGIN;
    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = imgHeight * imgAspect;
    }

    const x = MARGIN + (CONTENT_WIDTH - imgWidth) / 2;
    doc.addImage(imageDataUrl, "PNG", x, 26, imgWidth, imgHeight);
  } catch {
    doc.setFontSize(10);
    doc.setTextColor(200, 0, 0);
    doc.text("チャート画像の埋め込みに失敗しました", MARGIN, 40);
  }
}

// ── シミュレーション表 ──

function renderSimulationTable(doc: jsPDF, options: PdfReportOptions) {
  const { periods, scenarios } = options;
  const basePeriod = periods[periods.length - 1];
  if (!basePeriod) return;

  doc.setFont("NotoSansJP", "normal");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("損益シミュレーション", MARGIN, 18);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`（${basePeriod.label} ベース / 単位：千円）`, MARGIN + 70, 18);

  const baseMetrics = calculateMetrics(basePeriod);
  const results = scenarios.map((s) => calculateScenario(basePeriod, s));

  const head = [["項目", `実績(${basePeriod.label})`, ...scenarios.map((s) => s.label)]];

  type SimRow = {
    label: string;
    baseValue: number;
    getResult: (r: ReturnType<typeof calculateScenario>) => number;
    pct?: boolean;
  };

  const simRows: SimRow[] = [
    { label: "売上高", baseValue: basePeriod.sales, getResult: (r) => r.sales },
    { label: "変動費合計", baseValue: baseMetrics.totalVariableCost, getResult: (r) => r.totalVariableCost },
    { label: "限界利益", baseValue: baseMetrics.marginalProfit, getResult: (r) => r.marginalProfit },
    { label: "限界利益率(%)", baseValue: baseMetrics.marginalProfitRate, getResult: (r) => r.marginalProfitRate, pct: true },
    { label: "人件費", baseValue: basePeriod.laborCost, getResult: (r) => r.laborCost },
    { label: "固定費合計", baseValue: baseMetrics.totalFixedCost, getResult: (r) => r.totalFixedCost },
    { label: "営業利益", baseValue: baseMetrics.operatingProfit, getResult: (r) => r.operatingProfit },
    { label: "経常利益", baseValue: baseMetrics.ordinaryProfit, getResult: (r) => r.ordinaryProfit },
    { label: "労働分配率(%)", baseValue: baseMetrics.laborShareRate, getResult: (r) => r.laborShareRate, pct: true },
    { label: "1人当たり売上高", baseValue: baseMetrics.salesPerEmployee, getResult: (r) => r.salesPerEmployee },
    { label: "1人当たり加工高", baseValue: baseMetrics.marginalProfitPerEmployee, getResult: (r) => r.marginalProfitPerEmployee },
    { label: "1人当たり経常利益", baseValue: baseMetrics.ordinaryProfitPerEmployee, getResult: (r) => r.ordinaryProfitPerEmployee },
  ];

  const body = simRows.map((def) => {
    const baseStr = def.pct
      ? formatNumber(def.baseValue, 1) + "%"
      : formatNumber(def.baseValue, 0);
    const vals = results.map((r) => {
      const v = def.getResult(r);
      return def.pct ? formatNumber(v, 1) + "%" : formatNumber(v, 0);
    });
    return [def.label, baseStr, ...vals];
  });

  // シナリオパラメータ行を追加
  body.push(["", "", ...scenarios.map(() => "")]);
  body.push(["【シナリオ条件】", "", ...scenarios.map(() => "")]);
  body.push(["売上高変化率", "", ...scenarios.map((s) => `${s.salesChangeRate >= 0 ? "+" : ""}${s.salesChangeRate}%`)]);
  body.push(["変動費率変化", "", ...scenarios.map((s) => `${s.variableCostRateChange >= 0 ? "+" : ""}${s.variableCostRateChange}%pt`)]);
  body.push(["人件費変化率", "", ...scenarios.map((s) => `${s.laborCostChangeRate >= 0 ? "+" : ""}${s.laborCostChangeRate}%`)]);
  body.push(["その他固定費変化率", "", ...scenarios.map((s) => `${s.fixedCostChangeRate >= 0 ? "+" : ""}${s.fixedCostChangeRate}%`)]);

  autoTable(doc, {
    startY: 24,
    head,
    body,
    theme: "grid",
    styles: {
      font: "NotoSansJP",
      fontSize: 7.5,
      cellPadding: 1.8,
      halign: "right",
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: THEME_COLOR,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 38 },
    },
  });
}

// ── ページ番号 ──

function addPageNumbers(doc: jsPDF, companyName?: string) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("NotoSansJP", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${i} / ${totalPages}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 8, { align: "center" });

    if (companyName && i > 1) {
      doc.text(companyName, MARGIN, PAGE_HEIGHT - 8);
    }
  }
}
