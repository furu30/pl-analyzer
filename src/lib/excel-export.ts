import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { PeriodData, ScenarioResult, CalculatedMetrics } from "./types";
import {
  calculateMetrics,
  calculateCompositionRatios,
  calculateYoYChange,
  calculateWaterfallFactors,
  calculateScenario,
  toOku,
} from "./calculations";
import { Scenario } from "./types";

// ── PDF → Excel変換用の型定義 ──

interface PdfSheetRow {
  label: string;
  level: number;
  values: (number | null)[];
  isSummary?: boolean;
}

interface PdfSheetData {
  name: string;
  columns: string[];
  rows: PdfSheetRow[];
}

export interface PdfExcelData {
  unit: string;
  sheets: PdfSheetData[];
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E79" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: "FFFFFFFF" },
  bold: true,
  size: 10,
};
const SALES_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2EFDA" },
};
const VARIABLE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF2CC" },
};
const FIXED_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFCE4D6" },
};
const PROFIT_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFCE4EC" },
};

function applyBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
}

function numFmt(cell: ExcelJS.Cell, format: string = "#,##0") {
  cell.numFmt = format;
  cell.alignment = { horizontal: "right" };
}

/**
 * 実績データExcelエクスポート
 */
export async function exportActualDataExcel(
  periods: PeriodData[],
  companyName: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("実績データ");

  // ヘッダー行
  const headerRow = ws.addRow([
    "項目",
    ...periods.map((p) => p.label),
  ]);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    applyBorder(cell);
  });

  const rowDefs: {
    label: string;
    fill?: ExcelJS.Fill;
    getValue: (p: PeriodData, m: CalculatedMetrics) => number;
    pct?: boolean;
    bold?: boolean;
  }[] = [
    { label: "売上高", fill: SALES_FILL, getValue: (p) => p.sales, bold: true },
    { label: "材料費", fill: VARIABLE_FILL, getValue: (p) => p.materialCost },
    { label: "外注費", fill: VARIABLE_FILL, getValue: (p) => p.outsourcingCost },
    { label: "商品仕入", fill: VARIABLE_FILL, getValue: (p) => p.merchandisePurchase },
    { label: "その他変動費", fill: VARIABLE_FILL, getValue: (p) => p.otherVariableCost },
    { label: "変動費合計", fill: VARIABLE_FILL, getValue: (_p, m) => m.totalVariableCost, bold: true },
    { label: "限界利益", fill: SALES_FILL, getValue: (_p, m) => m.marginalProfit, bold: true },
    { label: "限界利益率(%)", fill: SALES_FILL, getValue: (_p, m) => m.marginalProfitRate, pct: true },
    { label: "人件費", fill: FIXED_FILL, getValue: (p) => p.laborCost },
    { label: "減価償却費", fill: FIXED_FILL, getValue: (p) => p.depreciation },
    { label: "その他経費", fill: FIXED_FILL, getValue: (p) => p.otherExpenses },
    { label: "固定費合計", fill: FIXED_FILL, getValue: (_p, m) => m.totalFixedCost, bold: true },
    { label: "営業利益", fill: PROFIT_FILL, getValue: (_p, m) => m.operatingProfit, bold: true },
    { label: "営業外損益", getValue: (p) => p.nonOperatingIncome },
    { label: "経常利益", fill: PROFIT_FILL, getValue: (_p, m) => m.ordinaryProfit, bold: true },
    { label: "従業員数", getValue: (p) => p.employeeCount },
    { label: "労働分配率(%)", getValue: (_p, m) => m.laborShareRate, pct: true },
  ];

  for (const def of rowDefs) {
    const values = periods.map((p) => {
      const m = calculateMetrics(p);
      return def.getValue(p, m);
    });
    const row = ws.addRow([def.label, ...values]);
    row.eachCell((cell, colNumber) => {
      if (def.fill) cell.fill = def.fill;
      if (def.bold) cell.font = { bold: true, size: 10 };
      applyBorder(cell);
      if (colNumber > 1) {
        numFmt(cell, def.pct ? "#,##0.0" : "#,##0");
      }
    });
  }

  ws.getColumn(1).width = 16;
  for (let i = 2; i <= periods.length + 1; i++) {
    ws.getColumn(i).width = 14;
  }

  // タイトル情報
  ws.insertRow(1, [companyName ? `${companyName} 実績データ` : "実績データ"]);
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.insertRow(2, []);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `実績データ_${companyName || "export"}.xlsx`);
}

/**
 * 利益バランス図表Excelエクスポート
 * waterfallImages: 各比較ペアのウォーターフォールチャート画像(data URL)の配列（オプション）
 */
export async function exportBalanceChartExcel(
  periods: PeriodData[],
  companyName: string,
  waterfallImages?: string[]
) {
  const wb = new ExcelJS.Workbook();

  let pairIdx = 0;
  for (let i = 0; i < periods.length - 1; i++) {
    const prev = periods[i];
    const curr = periods[i + 1];
    if (prev.sales === 0 || curr.sales === 0) continue;

    const prevM = calculateMetrics(prev);
    const currM = calculateMetrics(curr);
    const prevR = calculateCompositionRatios(prev, prevM);
    const currR = calculateCompositionRatios(curr, currM);
    const factors = calculateWaterfallFactors(curr, prev);

    const ws = wb.addWorksheet(`${prev.label}→${curr.label}`);

    ws.addRow([`${prev.label} → ${curr.label} 利益バランス図表`]);
    ws.getCell("A1").font = { bold: true, size: 12 };
    ws.addRow([]);

    const header = ws.addRow([
      "項目",
      `${prev.label} 金額`,
      `${prev.label} 構成比`,
      `${curr.label} 金額`,
      `${curr.label} 構成比`,
      "前期比(%)",
    ]);
    header.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      applyBorder(cell);
    });

    const rows = [
      { label: "売上高", pV: prev.sales, pR: 100, cV: curr.sales, cR: 100, fill: SALES_FILL },
      { label: "変動費合計", pV: prevM.totalVariableCost, pR: prevR.totalVariableCostRate, cV: currM.totalVariableCost, cR: currR.totalVariableCostRate, fill: VARIABLE_FILL },
      { label: "限界利益", pV: prevM.marginalProfit, pR: prevR.marginalProfitRate, cV: currM.marginalProfit, cR: currR.marginalProfitRate, fill: SALES_FILL },
      { label: "固定費合計", pV: prevM.totalFixedCost, pR: prevR.totalFixedCostRate, cV: currM.totalFixedCost, cR: currR.totalFixedCostRate, fill: FIXED_FILL },
      { label: "営業利益", pV: prevM.operatingProfit, pR: prevR.operatingProfitRate, cV: currM.operatingProfit, cR: currR.operatingProfitRate, fill: PROFIT_FILL },
      { label: "営業外損益", pV: prev.nonOperatingIncome, pR: prevR.nonOperatingIncomeRate, cV: curr.nonOperatingIncome, cR: currR.nonOperatingIncomeRate },
      { label: "経常利益", pV: prevM.ordinaryProfit, pR: prevR.ordinaryProfitRate, cV: currM.ordinaryProfit, cR: currR.ordinaryProfitRate, fill: PROFIT_FILL },
    ];

    for (const r of rows) {
      const yoy = calculateYoYChange(r.cV, r.pV);
      const row = ws.addRow([r.label, r.pV, r.pR, r.cV, r.cR, yoy]);
      row.eachCell((cell, col) => {
        if (r.fill) cell.fill = r.fill;
        applyBorder(cell);
        if (col > 1) numFmt(cell, col === 3 || col === 5 || col === 6 ? "#,##0.0" : "#,##0");
      });
    }

    ws.addRow([]);
    const factorHeaderRow = ws.addRow(["ウォーターフォール要因分解"]);
    factorHeaderRow.getCell(1).font = { bold: true, size: 10 };
    const factorRows = [
      ws.addRow(["①売上高貢献", factors.salesContribution]),
      ws.addRow(["②加工高比率貢献", factors.marginalRateContribution]),
      ws.addRow(["③固定費貢献", factors.fixedCostContribution]),
      ws.addRow(["④営業外損益貢献", factors.nonOperatingContribution]),
    ];
    for (const fRow of factorRows) {
      numFmt(fRow.getCell(2));
      applyBorder(fRow.getCell(1));
      applyBorder(fRow.getCell(2));
    }

    // ウォーターフォールチャート画像を埋め込む
    const imgDataUrl = waterfallImages?.[pairIdx];
    if (imgDataUrl && imgDataUrl.startsWith("data:image/png")) {
      const base64 = imgDataUrl.split(",")[1];
      const imageId = wb.addImage({
        base64,
        extension: "png",
      });
      // 現在の行数 + 1行空けた位置に画像を配置
      const startRow = ws.rowCount + 1;
      ws.addRow([]);
      ws.addImage(imageId, {
        tl: { col: 0, row: startRow },
        ext: { width: 700, height: 350 },
      });
      // 画像分の行を確保（約20行分）
      for (let r = 0; r < 20; r++) ws.addRow([]);
    }

    ws.getColumn(1).width = 18;
    for (let c = 2; c <= 6; c++) ws.getColumn(c).width = 14;

    pairIdx++;
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `利益バランス図表_${companyName || "export"}.xlsx`);
}

/**
 * 損益シミュレーションExcelエクスポート
 */
export async function exportSimulationExcel(
  basePeriod: PeriodData,
  scenarios: Scenario[],
  companyName: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("損益シミュレーション");

  const baseMetrics = calculateMetrics(basePeriod);
  const results = scenarios.map((s) => calculateScenario(basePeriod, s));

  ws.addRow([
    `${companyName || ""} 損益シミュレーション（${basePeriod.label} ベース）`,
  ]);
  ws.getCell("A1").font = { bold: true, size: 12 };
  ws.addRow([]);

  const header = ws.addRow([
    "項目",
    `実績(${basePeriod.label})`,
    ...results.map((r) => r.scenario.label),
  ]);
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    applyBorder(cell);
  });

  const rowDefs: {
    label: string;
    fill?: ExcelJS.Fill;
    baseVal: number;
    getVal: (r: ScenarioResult) => number;
    pct?: boolean;
  }[] = [
    { label: "売上高", fill: SALES_FILL, baseVal: basePeriod.sales, getVal: (r) => r.sales },
    { label: "変動費合計", fill: VARIABLE_FILL, baseVal: baseMetrics.totalVariableCost, getVal: (r) => r.totalVariableCost },
    { label: "限界利益", fill: SALES_FILL, baseVal: baseMetrics.marginalProfit, getVal: (r) => r.marginalProfit },
    { label: "限界利益率(%)", fill: SALES_FILL, baseVal: baseMetrics.marginalProfitRate, getVal: (r) => r.marginalProfitRate, pct: true },
    { label: "人件費", fill: FIXED_FILL, baseVal: basePeriod.laborCost, getVal: (r) => r.laborCost },
    { label: "減価償却費", fill: FIXED_FILL, baseVal: basePeriod.depreciation, getVal: (r) => r.depreciation },
    { label: "その他経費", fill: FIXED_FILL, baseVal: basePeriod.otherExpenses, getVal: (r) => r.otherExpenses },
    { label: "固定費合計", fill: FIXED_FILL, baseVal: baseMetrics.totalFixedCost, getVal: (r) => r.totalFixedCost },
    { label: "営業利益", fill: PROFIT_FILL, baseVal: baseMetrics.operatingProfit, getVal: (r) => r.operatingProfit },
    { label: "営業外損益", baseVal: basePeriod.nonOperatingIncome, getVal: (r) => r.nonOperatingIncome },
    { label: "経常利益", fill: PROFIT_FILL, baseVal: baseMetrics.ordinaryProfit, getVal: (r) => r.ordinaryProfit },
    { label: "労働分配率(%)", baseVal: baseMetrics.laborShareRate, getVal: (r) => r.laborShareRate, pct: true },
    { label: "1人当たり売上高", baseVal: baseMetrics.salesPerEmployee, getVal: (r) => r.salesPerEmployee },
    { label: "1人当たり加工高(年)", baseVal: baseMetrics.marginalProfitPerEmployee, getVal: (r) => r.marginalProfitPerEmployee },
    { label: "1人当たり経常利益", baseVal: baseMetrics.ordinaryProfitPerEmployee, getVal: (r) => r.ordinaryProfitPerEmployee },
  ];

  for (const def of rowDefs) {
    const row = ws.addRow([
      def.label,
      def.baseVal,
      ...results.map((r) => def.getVal(r)),
    ]);
    row.eachCell((cell, col) => {
      if (def.fill) cell.fill = def.fill;
      applyBorder(cell);
      if (col > 1) numFmt(cell, def.pct ? "#,##0.0" : "#,##0");
    });
  }

  ws.getColumn(1).width = 22;
  for (let c = 2; c <= results.length + 2; c++) ws.getColumn(c).width = 14;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(
    blob,
    `損益シミュレーション_${basePeriod.label}_${companyName || "export"}.xlsx`
  );
}

/**
 * PDF → Excel変換: AIが抽出した決算書テーブルデータをExcelファイルに変換しダウンロードする
 */
export async function exportPdfToExcel(
  data: PdfExcelData,
  fileName: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PL Analyzer";
  wb.created = new Date();

  for (const sheet of data.sheets) {
    const ws = wb.addWorksheet(sheet.name);

    // ── ヘッダー行 ──
    const headerRow = ws.addRow(sheet.columns);
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      applyBorder(cell);
    });

    // ── データ行 ──
    for (const row of sheet.rows) {
      const indent = "  ".repeat(row.level);
      const cleanLabel = row.label.replace(/^\s+/, "");
      const rowValues: (string | number | null)[] = [
        indent + cleanLabel,
        ...row.values,
      ];
      const excelRow = ws.addRow(rowValues);

      // 勘定科目列のスタイル
      const labelCell = excelRow.getCell(1);
      labelCell.alignment = { horizontal: "left", vertical: "middle" };
      if (row.isSummary) {
        labelCell.font = { bold: true, size: 10 };
      } else {
        labelCell.font = { size: 10 };
      }
      if (row.level > 0) {
        labelCell.alignment = { indent: row.level * 2, vertical: "middle" };
      }
      applyBorder(labelCell);

      // 金額列のスタイル
      for (let i = 1; i < rowValues.length; i++) {
        const cell = excelRow.getCell(i + 1);
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.numFmt = "#,##0";
        if (row.isSummary) {
          cell.font = { bold: true, size: 10 };
        } else {
          cell.font = { size: 10 };
        }
        applyBorder(cell);
      }

      // 合計行の背景色
      if (row.isSummary) {
        excelRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF0F4F8" },
          };
        });
      }
    }

    // ── 列幅の調整 ──
    ws.getColumn(1).width = 35;
    for (let i = 2; i <= sheet.columns.length; i++) {
      ws.getColumn(i).width = 18;
    }

    // ── 単位の注記 ──
    ws.addRow([]);
    const noteRow = ws.addRow([`（単位: ${data.unit}）`]);
    noteRow.getCell(1).font = { size: 9, italic: true, color: { argb: "FF666666" } };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${fileName}.xlsx`);
}

/**
 * Growth Chart Excelエクスポート
 * chartImage: チャート画像(data URL)（オプション）
 */
export async function exportGrowthChartExcel(
  periods: PeriodData[],
  companyName: string,
  chartImage?: string
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Growth Chart");

  const validPeriods = periods.filter((p) => p.sales > 0);

  // タイトル
  ws.addRow([companyName ? `${companyName} Growth Chart` : "Growth Chart"]);
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.addRow([]);

  // ヘッダー
  const header = ws.addRow(["期", "売上高（億円）", "限界利益率（%）", "限界利益（億円）"]);
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    applyBorder(cell);
  });

  // データ行
  for (const p of validPeriods) {
    const m = calculateMetrics(p);
    const row = ws.addRow([
      p.label,
      toOku(p.sales),
      m.marginalProfitRate,
      toOku(m.marginalProfit),
    ]);
    row.getCell(1).font = { bold: true, size: 10 };
    applyBorder(row.getCell(1));
    for (let c = 2; c <= 4; c++) {
      const cell = row.getCell(c);
      numFmt(cell, c === 3 ? "#,##0.0" : "#,##0.00");
      applyBorder(cell);
    }
  }

  // 前期比の変化行
  if (validPeriods.length >= 2) {
    ws.addRow([]);
    const changeHeader = ws.addRow(["前期比変化", "売上高変化（億円）", "限界利益率変化（pt）", "限界利益変化（億円）"]);
    changeHeader.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      applyBorder(cell);
    });
    for (let i = 1; i < validPeriods.length; i++) {
      const prev = validPeriods[i - 1];
      const curr = validPeriods[i];
      const prevM = calculateMetrics(prev);
      const currM = calculateMetrics(curr);
      const row = ws.addRow([
        `${prev.label}→${curr.label}`,
        toOku(curr.sales) - toOku(prev.sales),
        currM.marginalProfitRate - prevM.marginalProfitRate,
        toOku(currM.marginalProfit) - toOku(prevM.marginalProfit),
      ]);
      row.getCell(1).font = { size: 10 };
      applyBorder(row.getCell(1));
      for (let c = 2; c <= 4; c++) {
        const cell = row.getCell(c);
        numFmt(cell, c === 3 ? "+#,##0.0;-#,##0.0;0.0" : "+#,##0.00;-#,##0.00;0.00");
        applyBorder(cell);
      }
    }
  }

  // チャート画像を埋め込む
  if (chartImage && chartImage.startsWith("data:image/png")) {
    const base64 = chartImage.split(",")[1];
    const imageId = wb.addImage({ base64, extension: "png" });
    const startRow = ws.rowCount + 2;
    ws.addRow([]);
    ws.addImage(imageId, {
      tl: { col: 0, row: startRow },
      ext: { width: 750, height: 500 },
    });
    for (let r = 0; r < 28; r++) ws.addRow([]);
  }

  ws.getColumn(1).width = 20;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 16;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `GrowthChart_${companyName || "export"}.xlsx`);
}
