"use client";

import React, { useMemo, useRef, useCallback, useState } from "react";
import { toPng } from "html-to-image";
import { useAppStore } from "@/lib/store";
import {
  calculateMetrics,
  calculateCompositionRatios,
  calculateYoYChange,
  calculateWaterfallFactors,
  formatNumber,
} from "@/lib/calculations";
import WaterfallChart, { calcWaterfallYRange } from "@/components/charts/WaterfallChart";
import { exportBalanceChartExcel } from "@/lib/excel-export";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ComparisonPair {
  prevIndex: number;
  currIndex: number;
}

interface ComparisonTableProps extends ComparisonPair {
  waterfallYDomain?: [number, number];
  companyName: string;
}

function ComparisonTable({ prevIndex, currIndex, waterfallYDomain, companyName }: ComparisonTableProps) {
  const periods = useAppStore((s) => s.periods);
  const prev = periods[prevIndex];
  const curr = periods[currIndex];
  const cardRef = useRef<HTMLDivElement>(null);
  const [isPngExporting, setIsPngExporting] = useState(false);

  const prevMetrics = useMemo(() => calculateMetrics(prev), [prev]);
  const currMetrics = useMemo(() => calculateMetrics(curr), [curr]);
  const prevRatios = useMemo(
    () => calculateCompositionRatios(prev, prevMetrics),
    [prev, prevMetrics]
  );
  const currRatios = useMemo(
    () => calculateCompositionRatios(curr, currMetrics),
    [curr, currMetrics]
  );
  const factors = useMemo(
    () => calculateWaterfallFactors(curr, prev),
    [curr, prev]
  );

  const fmt = (v: number) => formatNumber(v, 0);
  const fmtR = (v: number) => formatNumber(v, 1);

  type RowDef = {
    label: string;
    bgClass: string;
    prevVal: number;
    currVal: number;
    prevRate: number;
    currRate: number;
    indent?: boolean;
    bold?: boolean;
  };

  const rows: RowDef[] = [
    {
      label: "売上高",
      bgClass: "bg-sales",
      prevVal: prev.sales,
      currVal: curr.sales,
      prevRate: 100,
      currRate: 100,
      bold: true,
    },
    {
      label: "材料費",
      bgClass: "bg-variable",
      prevVal: prev.materialCost,
      currVal: curr.materialCost,
      prevRate: prevRatios.materialCostRate,
      currRate: currRatios.materialCostRate,
      indent: true,
    },
    {
      label: "外注費",
      bgClass: "bg-variable",
      prevVal: prev.outsourcingCost,
      currVal: curr.outsourcingCost,
      prevRate: prevRatios.outsourcingCostRate,
      currRate: currRatios.outsourcingCostRate,
      indent: true,
    },
    {
      label: "商品仕入",
      bgClass: "bg-variable",
      prevVal: prev.merchandisePurchase,
      currVal: curr.merchandisePurchase,
      prevRate: prevRatios.merchandisePurchaseRate,
      currRate: currRatios.merchandisePurchaseRate,
      indent: true,
    },
    {
      label: "その他変動費",
      bgClass: "bg-variable",
      prevVal: prev.otherVariableCost,
      currVal: curr.otherVariableCost,
      prevRate: prevRatios.otherVariableCostRate,
      currRate: currRatios.otherVariableCostRate,
      indent: true,
    },
    {
      label: "変動費合計",
      bgClass: "bg-variable",
      prevVal: prevMetrics.totalVariableCost,
      currVal: currMetrics.totalVariableCost,
      prevRate: prevRatios.totalVariableCostRate,
      currRate: currRatios.totalVariableCostRate,
      bold: true,
    },
    {
      label: "限界利益",
      bgClass: "bg-sales",
      prevVal: prevMetrics.marginalProfit,
      currVal: currMetrics.marginalProfit,
      prevRate: prevRatios.marginalProfitRate,
      currRate: currRatios.marginalProfitRate,
      bold: true,
    },
    {
      label: "人件費",
      bgClass: "bg-fixed",
      prevVal: prev.laborCost,
      currVal: curr.laborCost,
      prevRate: prevRatios.laborCostRate,
      currRate: currRatios.laborCostRate,
      indent: true,
    },
    {
      label: "その他経費",
      bgClass: "bg-fixed",
      prevVal: prev.otherExpenses,
      currVal: curr.otherExpenses,
      prevRate: prevRatios.otherExpensesRate,
      currRate: currRatios.otherExpensesRate,
      indent: true,
    },
    {
      label: "減価償却費",
      bgClass: "bg-fixed",
      prevVal: prev.depreciation,
      currVal: curr.depreciation,
      prevRate: prevRatios.depreciationRate,
      currRate: currRatios.depreciationRate,
      indent: true,
    },
    {
      label: "固定費合計",
      bgClass: "bg-fixed",
      prevVal: prevMetrics.totalFixedCost,
      currVal: currMetrics.totalFixedCost,
      prevRate: prevRatios.totalFixedCostRate,
      currRate: currRatios.totalFixedCostRate,
      bold: true,
    },
    {
      label: "営業利益",
      bgClass: "bg-profit",
      prevVal: prevMetrics.operatingProfit,
      currVal: currMetrics.operatingProfit,
      prevRate: prevRatios.operatingProfitRate,
      currRate: currRatios.operatingProfitRate,
      bold: true,
    },
    {
      label: "営業外損益",
      bgClass: "",
      prevVal: prev.nonOperatingIncome,
      currVal: curr.nonOperatingIncome,
      prevRate: prevRatios.nonOperatingIncomeRate,
      currRate: currRatios.nonOperatingIncomeRate,
    },
    {
      label: "経常利益",
      bgClass: "bg-profit",
      prevVal: prevMetrics.ordinaryProfit,
      currVal: currMetrics.ordinaryProfit,
      prevRate: prevRatios.ordinaryProfitRate,
      currRate: currRatios.ordinaryProfitRate,
      bold: true,
    },
  ];

  const handlePngExport = useCallback(async () => {
    if (!cardRef.current) return;
    setIsPngExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      const name = (companyName || "利益バランス図表").trim();
      link.download = `${name}_${prev.label}→${curr.label}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("PNG export failed:", err);
      alert("PNG画像の生成に失敗しました。");
    } finally {
      setIsPngExporting(false);
    }
  }, [companyName, prev.label, curr.label]);

  return (
    <div className="mb-8">
      <div ref={cardRef}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {prev.label} → {curr.label} 比較
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-3 w-36">項目</th>
                    <th className="text-right py-2 px-2" colSpan={2}>
                      {prev.label}
                    </th>
                    <th className="text-right py-2 px-2" colSpan={2}>
                      {curr.label}
                    </th>
                    <th className="text-right py-2 px-2">前期比(%)</th>
                  </tr>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th></th>
                    <th className="text-right py-1 px-2">金額</th>
                    <th className="text-right py-1 px-2">構成比</th>
                    <th className="text-right py-1 px-2">金額</th>
                    <th className="text-right py-1 px-2">構成比</th>
                    <th className="text-right py-1 px-2">増減率</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const yoy = calculateYoYChange(row.currVal, row.prevVal);
                    return (
                      <tr key={row.label} className={`border-b ${row.bgClass}`}>
                        <td
                          className={`py-1.5 px-3 ${row.indent ? "pl-8" : ""} ${row.bold ? "font-bold" : ""}`}
                        >
                          {row.label}
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">
                          {fmt(row.prevVal)}
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">
                          {fmtR(row.prevRate)}%
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums">
                          {fmt(row.currVal)}
                        </td>
                        <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">
                          {fmtR(row.currRate)}%
                        </td>
                        <td
                          className={`text-right py-1.5 px-2 tabular-nums ${
                            yoy > 0
                              ? "text-blue-600"
                              : yoy < 0
                                ? "text-red-600"
                                : ""
                          }`}
                        >
                          {row.prevVal !== 0 ? `${fmtR(yoy)}%` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-b">
                    <td className="py-1.5 px-3">労働分配率</td>
                    <td className="text-right py-1.5 px-2 tabular-nums">
                      {fmtR(prevMetrics.laborShareRate)}%
                    </td>
                    <td></td>
                    <td className="text-right py-1.5 px-2 tabular-nums">
                      {fmtR(currMetrics.laborShareRate)}%
                    </td>
                    <td></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div data-waterfall-pair={`${prevIndex}-${currIndex}`}>
              <h4 className="text-sm font-semibold mb-2">
                経常利益 変動要因分解（ウォーターフォール）
              </h4>
              <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
                <p>① 売上高貢献: {fmt(factors.salesContribution)} 千円</p>
                <p>② 加工高比率貢献: {fmt(factors.marginalRateContribution)} 千円</p>
                <p>③ 固定費貢献: {fmt(factors.fixedCostContribution)} 千円</p>
                <p>④ 営業外損益貢献: {fmt(factors.nonOperatingContribution)} 千円</p>
              </div>
              <WaterfallChart
                previousPeriodLabel={prev.label}
                currentPeriodLabel={curr.label}
                previousOrdinaryProfit={prevMetrics.ordinaryProfit}
                currentOrdinaryProfit={currMetrics.ordinaryProfit}
                factors={factors}
                yDomain={waterfallYDomain}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex justify-end mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePngExport}
          disabled={isPngExporting}
          className="text-muted-foreground hover:text-foreground"
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          {isPngExporting ? "生成中..." : "PNGダウンロード"}
        </Button>
      </div>
    </div>
  );
}

export default function BalanceChartPage() {
  const periods = useAppStore((s) => s.periods);
  const company = useAppStore((s) => s.company);
  const [isExcelExporting, setIsExcelExporting] = useState(false);

  const validPeriods = useMemo(
    () => periods.filter((p) => p.sales > 0),
    [periods]
  );
  const hasEnoughData = validPeriods.length >= 2;

  const pairs: ComparisonPair[] = useMemo(() => {
    const result: ComparisonPair[] = [];
    for (let i = 0; i < periods.length - 1; i++) {
      if (periods[i].sales > 0 && periods[i + 1].sales > 0) {
        result.push({ prevIndex: i, currIndex: i + 1 });
      }
    }
    return result;
  }, [periods]);

  // 全ウォーターフォールチャートで共通のY軸ドメインを計算
  const globalYDomain = useMemo((): [number, number] | undefined => {
    if (pairs.length < 2) return undefined; // 1つしかなければ統一不要
    let globalMin = Infinity;
    let globalMax = -Infinity;
    for (const pair of pairs) {
      const prev = periods[pair.prevIndex];
      const curr = periods[pair.currIndex];
      const prevM = calculateMetrics(prev);
      const factors = calculateWaterfallFactors(curr, prev);
      const [min, max] = calcWaterfallYRange(prevM.ordinaryProfit, factors);
      if (min < globalMin) globalMin = min;
      if (max > globalMax) globalMax = max;
    }
    // 余白を10%追加
    const range = globalMax - globalMin;
    const margin = range * 0.1;
    return [globalMin - margin, globalMax + margin];
  }, [pairs, periods]);

  // Excelエクスポート: ウォーターフォールチャート画像をキャプチャしてExcelに埋め込む
  const handleExcelExport = useCallback(async () => {
    setIsExcelExporting(true);
    try {
      // DOM上のウォーターフォールチャートをキャプチャ
      const waterfallElements = document.querySelectorAll<HTMLElement>("[data-waterfall-pair]");
      const waterfallImages: string[] = [];
      for (const el of waterfallElements) {
        try {
          const dataUrl = await toPng(el, {
            backgroundColor: "#ffffff",
            pixelRatio: 2,
            cacheBust: true,
          });
          waterfallImages.push(dataUrl);
        } catch {
          waterfallImages.push(""); // キャプチャ失敗時は空文字
        }
      }
      await exportBalanceChartExcel(periods, company.name, waterfallImages);
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Excelエクスポートに失敗しました。");
    } finally {
      setIsExcelExporting(false);
    }
  }, [periods, company.name]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">利益バランス図表</h1>

      {!hasEnoughData ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              利益バランス図表を表示するには、売上高が入力された期が2期以上必要です。
              <br />
              Step 2（データ入力）で各期の売上高を入力してください。
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {pairs.map((pair) => (
            <ComparisonTable
              key={`${pair.prevIndex}-${pair.currIndex}`}
              prevIndex={pair.prevIndex}
              currIndex={pair.currIndex}
              waterfallYDomain={globalYDomain}
              companyName={company.name}
            />
          ))}

          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={handleExcelExport}
              disabled={isExcelExporting}
            >
              {isExcelExporting ? "Excel生成中..." : "Excelダウンロード"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
