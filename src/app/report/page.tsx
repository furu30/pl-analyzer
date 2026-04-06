"use client";

import { useState, useRef, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import {
  calculateMetrics,
  calculateCompositionRatios,
  calculateWaterfallFactors,
  calculateScenario,
  formatNumber,
  toOku,
} from "@/lib/calculations";
import type { GrowthChartDataPoint } from "@/components/charts/GrowthChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import WaterfallChart from "@/components/charts/WaterfallChart";
import GrowthChart from "@/components/charts/GrowthChart";
import {
  FileText,
  Printer,
  CheckSquare,
  Square,
  Building2,
  Calendar,
  BarChart3,
} from "lucide-react";

interface ReportSections {
  coverPage: boolean;
  plTable: boolean;
  waterfallChart: boolean;
  growthChart: boolean;
  simulation: boolean;
}

function calcWaterfallYRange(
  factors: ReturnType<typeof calculateWaterfallFactors>,
  prevProfit: number
) {
  const values = [
    prevProfit,
    factors.salesContribution,
    factors.marginalRateContribution,
    factors.fixedCostContribution,
    factors.nonOperatingContribution,
    prevProfit +
      factors.salesContribution +
      factors.marginalRateContribution +
      factors.fixedCostContribution +
      factors.nonOperatingContribution,
  ];
  const maxAbs = Math.max(...values.map(Math.abs));
  return [-maxAbs * 1.3, maxAbs * 1.3];
}

export default function ReportPage() {
  const { company, periods, scenarios } = useAppStore();
  const [sections, setSections] = useState<ReportSections>({
    coverPage: true,
    plTable: true,
    waterfallChart: true,
    growthChart: true,
    simulation: true,
  });
  const printRef = useRef<HTMLDivElement>(null);

  const toggleSection = (key: keyof ReportSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasValidData = periods.some((p) => p.sales > 0);
  const validPeriods = periods.filter((p) => p.sales > 0);

  const waterfallPairs = useMemo(() => {
    const pairs: { prev: (typeof periods)[0]; curr: (typeof periods)[0]; index: number }[] = [];
    for (let i = 0; i < validPeriods.length - 1; i++) {
      pairs.push({ prev: validPeriods[i], curr: validPeriods[i + 1], index: i });
    }
    return pairs;
  }, [validPeriods]);

  const estimatedPages = useMemo(() => {
    let count = 0;
    if (sections.coverPage) count++;
    if (sections.plTable) count++;
    if (sections.waterfallChart) count += waterfallPairs.length;
    if (sections.growthChart && validPeriods.length >= 2) count++;
    if (sections.simulation) count++;
    return count;
  }, [sections, waterfallPairs.length, validPeriods.length]);

  const handlePrint = () => {
    window.print();
  };

  const sectionOptions: { key: keyof ReportSections; label: string; available: boolean }[] = [
    { key: "coverPage", label: "表紙", available: true },
    { key: "plTable", label: "損益比較表", available: validPeriods.length >= 1 },
    { key: "waterfallChart", label: "ウォーターフォールチャート", available: waterfallPairs.length >= 1 },
    { key: "growthChart", label: "Growth Chart", available: validPeriods.length >= 2 },
    { key: "simulation", label: "損益シミュレーション", available: scenarios.length >= 1 },
  ];

  const basePeriod = validPeriods[validPeriods.length - 1];
  const baseMetrics = basePeriod ? calculateMetrics(basePeriod) : null;

  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 作成`;
  const periodRange =
    validPeriods.length === 0
      ? ""
      : validPeriods.length === 1
        ? validPeriods[0].label
        : `${validPeriods[0].label} ～ ${validPeriods[validPeriods.length - 1].label}`;

  return (
    <>
      {/* ===== 通常表示（印刷時は非表示） ===== */}
      <div className="p-4 md:p-6 space-y-6 max-w-3xl print:hidden">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#1F4E79]" />
          レポート出力
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">レポート概要</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">企業名:</span>
              <span className="font-medium">{company.name || "未設定"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">分析期間:</span>
              <span className="font-medium">{periodRange || "データなし"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">推定ページ数:</span>
              <span className="font-medium">{estimatedPages}ページ</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">出力セクション</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sectionOptions.map(({ key, label, available }) => (
              <button
                key={key}
                onClick={() => available && toggleSection(key)}
                disabled={!available}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-left transition-colors ${
                  available ? "hover:bg-gray-50 cursor-pointer" : "opacity-40 cursor-not-allowed"
                }`}
              >
                {sections[key] && available ? (
                  <CheckSquare className="w-4 h-4 text-[#1F4E79] shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-gray-300 shrink-0" />
                )}
                <span>{label}</span>
                {!available && (
                  <span className="text-xs text-muted-foreground ml-auto">データ不足</span>
                )}
              </button>
            ))}
          </CardContent>
        </Card>

        <Separator />

        <Button
          onClick={handlePrint}
          disabled={!hasValidData || estimatedPages === 0}
          size="lg"
          className="w-full bg-[#1F4E79] hover:bg-[#163a5c]"
        >
          <Printer className="w-5 h-5 mr-2" />
          PDF / 印刷（ブラウザの印刷ダイアログで「PDFに保存」を選択）
        </Button>

        {!hasValidData && (
          <p className="text-sm text-muted-foreground text-center">
            実績データを入力してからレポートを出力してください
          </p>
        )}
      </div>

      {/* ===== 印刷用レイアウト（通常時は非表示、印刷時のみ表示） ===== */}
      <div ref={printRef} className="hidden print:block print-report">
        {/* 表紙 */}
        {sections.coverPage && (
          <div className="report-page cover-page">
            <div className="cover-top-bar" />
            <div className="cover-content">
              <h1 className="cover-company">{company.name || "企業名未設定"}</h1>
              <h2 className="cover-title">損益分析レポート</h2>
              <div className="cover-line" />
              {periodRange && <p className="cover-period">分析期間: {periodRange}</p>}
              <p className="cover-date">{dateStr}</p>
            </div>
            <div className="cover-footer">PL Analyzer - 製造業損益分析</div>
          </div>
        )}

        {/* 損益比較表 */}
        {sections.plTable && validPeriods.length >= 1 && (
          <div className="report-page">
            <h2 className="report-section-title">損益比較表</h2>
            <p className="report-unit">（単位：千円）</p>
            <table className="report-table">
              <thead>
                <tr>
                  <th className="text-left">項目</th>
                  {validPeriods.map((p) => (
                    <th key={p.id} className="text-right">{p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: { label: string; cls: string; getValue: (p: typeof validPeriods[0]) => string; bold?: boolean }[] = [
                    { label: "売上高", cls: "bg-sales", getValue: (p) => formatNumber(p.sales, 0), bold: true },
                    { label: "　材料費", cls: "bg-variable", getValue: (p) => formatNumber(p.materialCost, 0) },
                    { label: "　外注費", cls: "bg-variable", getValue: (p) => formatNumber(p.outsourcingCost, 0) },
                    { label: "　商品仕入", cls: "bg-variable", getValue: (p) => formatNumber(p.merchandisePurchase, 0) },
                    { label: "　その他変動費", cls: "bg-variable", getValue: (p) => formatNumber(p.otherVariableCost, 0) },
                    { label: "変動費合計", cls: "bg-variable", getValue: (p) => formatNumber(calculateMetrics(p).totalVariableCost, 0), bold: true },
                    { label: "限界利益", cls: "bg-marginal", getValue: (p) => formatNumber(calculateMetrics(p).marginalProfit, 0), bold: true },
                    { label: "限界利益率(%)", cls: "bg-marginal", getValue: (p) => formatNumber(calculateMetrics(p).marginalProfitRate, 1) + "%" },
                    { label: "　人件費", cls: "bg-fixed", getValue: (p) => formatNumber(p.laborCost, 0) },
                    { label: "　減価償却費", cls: "bg-fixed", getValue: (p) => formatNumber(p.depreciation, 0) },
                    { label: "　その他経費", cls: "bg-fixed", getValue: (p) => formatNumber(p.otherExpenses, 0) },
                    { label: "固定費合計", cls: "bg-fixed", getValue: (p) => formatNumber(calculateMetrics(p).totalFixedCost, 0), bold: true },
                    { label: "営業利益", cls: "bg-profit", getValue: (p) => formatNumber(calculateMetrics(p).operatingProfit, 0), bold: true },
                    { label: "営業外損益", cls: "", getValue: (p) => formatNumber(p.nonOperatingIncome, 0) },
                    { label: "経常利益", cls: "bg-profit", getValue: (p) => formatNumber(calculateMetrics(p).ordinaryProfit, 0), bold: true },
                    { label: "従業員数(人)", cls: "", getValue: (p) => String(p.employeeCount) },
                    { label: "労働分配率(%)", cls: "", getValue: (p) => formatNumber(calculateMetrics(p).laborShareRate, 1) + "%" },
                  ];
                  return rows.map((row, i) => (
                    <tr key={i} className={row.cls}>
                      <td style={{ fontWeight: row.bold ? 700 : 400 }}>{row.label}</td>
                      {validPeriods.map((p) => (
                        <td key={p.id} className="text-right" style={{ fontWeight: row.bold ? 700 : 400 }}>
                          {row.getValue(p)}
                        </td>
                      ))}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>

            {validPeriods.length >= 2 && (
              <>
                <h3 style={{ fontSize: "12px", fontWeight: 700, marginTop: "16px", marginBottom: "6px" }}>
                  【構成比 (%)】
                </h3>
                <table className="report-table">
                  <tbody>
                    {[
                      { label: "変動費率", getRate: (p: typeof validPeriods[0]) => calculateCompositionRatios(p, calculateMetrics(p)).totalVariableCostRate },
                      { label: "限界利益率", getRate: (p: typeof validPeriods[0]) => calculateCompositionRatios(p, calculateMetrics(p)).marginalProfitRate },
                      { label: "固定費率", getRate: (p: typeof validPeriods[0]) => calculateCompositionRatios(p, calculateMetrics(p)).totalFixedCostRate },
                      { label: "営業利益率", getRate: (p: typeof validPeriods[0]) => calculateCompositionRatios(p, calculateMetrics(p)).operatingProfitRate },
                      { label: "経常利益率", getRate: (p: typeof validPeriods[0]) => calculateCompositionRatios(p, calculateMetrics(p)).ordinaryProfitRate },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td>{row.label}</td>
                        {validPeriods.map((p) => (
                          <td key={p.id} className="text-right">{formatNumber(row.getRate(p), 1)}%</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ウォーターフォールチャート */}
        {sections.waterfallChart &&
          waterfallPairs.map(({ prev, curr, index }) => {
            const factors = calculateWaterfallFactors(curr, prev);
            const prevMetrics = calculateMetrics(prev);
            const [yMin, yMax] = calcWaterfallYRange(factors, prevMetrics.ordinaryProfit);
            return (
              <div key={index} className="report-page">
                <h2 className="report-section-title">
                  {prev.label} → {curr.label} 利益変動要因分析
                </h2>
                <div style={{ width: "100%", height: "400px" }}>
                  <WaterfallChart
                    factors={factors}
                    previousOrdinaryProfit={prevMetrics.ordinaryProfit}
                    currentOrdinaryProfit={calculateMetrics(curr).ordinaryProfit}
                    previousPeriodLabel={prev.label}
                    currentPeriodLabel={curr.label}
                    yDomain={[yMin, yMax]}
                  />
                </div>
              </div>
            );
          })}

        {/* Growth Chart */}
        {sections.growthChart && validPeriods.length >= 2 && (
          <div className="report-page">
            <h2 className="report-section-title">Growth Chart（成長軌跡図）</h2>
            <div style={{ width: "100%", height: "450px" }}>
              <GrowthChart
                data={validPeriods.map(
                  (p): GrowthChartDataPoint => {
                    const m = calculateMetrics(p);
                    return {
                      label: p.label,
                      salesOku: toOku(p.sales),
                      marginalProfitRate: m.marginalProfitRate,
                      marginalProfitOku: toOku(m.marginalProfit),
                    };
                  }
                )}
              />
            </div>
          </div>
        )}

        {/* シミュレーション */}
        {sections.simulation && basePeriod && baseMetrics && (
          <div className="report-page">
            <h2 className="report-section-title">損益シミュレーション</h2>
            <p className="report-unit">（{basePeriod.label} ベース / 単位：千円）</p>
            <table className="report-table" style={{ fontSize: "11px" }}>
              <thead>
                <tr>
                  <th className="text-left">項目</th>
                  <th className="text-right">実績({basePeriod.label})</th>
                  {scenarios.map((s) => (
                    <th key={s.id} className="text-right">{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const results = scenarios.map((s) => calculateScenario(basePeriod, s));
                  const simRows: { label: string; base: string; getVal: (r: typeof results[0]) => string }[] = [
                    { label: "売上高", base: formatNumber(basePeriod.sales, 0), getVal: (r) => formatNumber(r.sales, 0) },
                    { label: "変動費合計", base: formatNumber(baseMetrics.totalVariableCost, 0), getVal: (r) => formatNumber(r.totalVariableCost, 0) },
                    { label: "限界利益", base: formatNumber(baseMetrics.marginalProfit, 0), getVal: (r) => formatNumber(r.marginalProfit, 0) },
                    { label: "限界利益率(%)", base: formatNumber(baseMetrics.marginalProfitRate, 1) + "%", getVal: (r) => formatNumber(r.marginalProfitRate, 1) + "%" },
                    { label: "人件費", base: formatNumber(basePeriod.laborCost, 0), getVal: (r) => formatNumber(r.laborCost, 0) },
                    { label: "固定費合計", base: formatNumber(baseMetrics.totalFixedCost, 0), getVal: (r) => formatNumber(r.totalFixedCost, 0) },
                    { label: "営業利益", base: formatNumber(baseMetrics.operatingProfit, 0), getVal: (r) => formatNumber(r.operatingProfit, 0) },
                    { label: "経常利益", base: formatNumber(baseMetrics.ordinaryProfit, 0), getVal: (r) => formatNumber(r.ordinaryProfit, 0) },
                    { label: "労働分配率(%)", base: formatNumber(baseMetrics.laborShareRate, 1) + "%", getVal: (r) => formatNumber(r.laborShareRate, 1) + "%" },
                    { label: "1人当たり売上高", base: formatNumber(baseMetrics.salesPerEmployee, 0), getVal: (r) => formatNumber(r.salesPerEmployee, 0) },
                    { label: "1人当たり加工高", base: formatNumber(baseMetrics.marginalProfitPerEmployee, 0), getVal: (r) => formatNumber(r.marginalProfitPerEmployee, 0) },
                    { label: "1人当たり経常利益", base: formatNumber(baseMetrics.ordinaryProfitPerEmployee, 0), getVal: (r) => formatNumber(r.ordinaryProfitPerEmployee, 0) },
                  ];
                  return simRows.map((row, i) => (
                    <tr key={i}>
                      <td>{row.label}</td>
                      <td className="text-right">{row.base}</td>
                      {results.map((r, j) => (
                        <td key={j} className="text-right">{row.getVal(r)}</td>
                      ))}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 印刷用CSSはglobals.cssに定義済み */}
    </>
  );
}
