"use client";

import React from "react";
import { PeriodData, ScenarioResult, CalculatedMetrics } from "@/lib/types";
import { formatNumber } from "@/lib/calculations";

interface SimulationTableProps {
  basePeriod: PeriodData;
  baseMetrics: CalculatedMetrics;
  scenarioResults: ScenarioResult[];
}

interface RowDef {
  label: string;
  bgClass: string;
  getValue: (base: { period: PeriodData; metrics: CalculatedMetrics }) => number;
  getScenarioValue: (sr: ScenarioResult) => number;
  unit?: string;
  decimals?: number;
  bold?: boolean;
  indent?: boolean;
}

const rows: RowDef[] = [
  {
    label: "売上高",
    bgClass: "bg-sales",
    getValue: (b) => b.period.sales,
    getScenarioValue: (sr) => sr.sales,
    bold: true,
  },
  {
    label: "材料費",
    bgClass: "bg-variable",
    getValue: (b) => b.period.materialCost,
    getScenarioValue: (sr) => sr.materialCost,
    indent: true,
  },
  {
    label: "外注費",
    bgClass: "bg-variable",
    getValue: (b) => b.period.outsourcingCost,
    getScenarioValue: (sr) => sr.outsourcingCost,
    indent: true,
  },
  {
    label: "商品仕入",
    bgClass: "bg-variable",
    getValue: (b) => b.period.merchandisePurchase,
    getScenarioValue: (sr) => sr.merchandisePurchase,
    indent: true,
  },
  {
    label: "その他変動費",
    bgClass: "bg-variable",
    getValue: (b) => b.period.otherVariableCost,
    getScenarioValue: (sr) => sr.otherVariableCost,
    indent: true,
  },
  {
    label: "変動費合計",
    bgClass: "bg-variable",
    getValue: (b) => b.metrics.totalVariableCost,
    getScenarioValue: (sr) => sr.totalVariableCost,
    bold: true,
  },
  {
    label: "限界利益",
    bgClass: "bg-sales",
    getValue: (b) => b.metrics.marginalProfit,
    getScenarioValue: (sr) => sr.marginalProfit,
    bold: true,
  },
  {
    label: "限界利益率",
    bgClass: "bg-sales",
    getValue: (b) => b.metrics.marginalProfitRate,
    getScenarioValue: (sr) => sr.marginalProfitRate,
    unit: "%",
    decimals: 1,
  },
  {
    label: "人件費",
    bgClass: "bg-fixed",
    getValue: (b) => b.period.laborCost,
    getScenarioValue: (sr) => sr.laborCost,
    indent: true,
  },
  {
    label: "減価償却費",
    bgClass: "bg-fixed",
    getValue: (b) => b.period.depreciation,
    getScenarioValue: (sr) => sr.depreciation,
    indent: true,
  },
  {
    label: "その他経費",
    bgClass: "bg-fixed",
    getValue: (b) => b.period.otherExpenses,
    getScenarioValue: (sr) => sr.otherExpenses,
    indent: true,
  },
  {
    label: "固定費合計",
    bgClass: "bg-fixed",
    getValue: (b) => b.metrics.totalFixedCost,
    getScenarioValue: (sr) => sr.totalFixedCost,
    bold: true,
  },
  {
    label: "営業利益",
    bgClass: "bg-profit",
    getValue: (b) => b.metrics.operatingProfit,
    getScenarioValue: (sr) => sr.operatingProfit,
    bold: true,
  },
  {
    label: "営業外損益",
    bgClass: "",
    getValue: (b) => b.period.nonOperatingIncome,
    getScenarioValue: (sr) => sr.nonOperatingIncome,
  },
  {
    label: "経常利益",
    bgClass: "bg-profit",
    getValue: (b) => b.metrics.ordinaryProfit,
    getScenarioValue: (sr) => sr.ordinaryProfit,
    bold: true,
  },
];

const perEmployeeRows: RowDef[] = [
  {
    label: "1人当たり売上高",
    bgClass: "",
    getValue: (b) => b.metrics.salesPerEmployee,
    getScenarioValue: (sr) => sr.salesPerEmployee,
  },
  {
    label: "1人当たり加工高(年)",
    bgClass: "",
    getValue: (b) => b.metrics.marginalProfitPerEmployee,
    getScenarioValue: (sr) => sr.marginalProfitPerEmployee,
  },
  {
    label: "1人当たり加工高(月)",
    bgClass: "",
    getValue: (b) => b.metrics.monthlyMarginalProfitPerEmployee,
    getScenarioValue: (sr) => sr.monthlyMarginalProfitPerEmployee,
  },
  {
    label: "1人当たり経常利益",
    bgClass: "",
    getValue: (b) => b.metrics.ordinaryProfitPerEmployee,
    getScenarioValue: (sr) => sr.ordinaryProfitPerEmployee,
  },
];

export default function SimulationTable({
  basePeriod,
  baseMetrics,
  scenarioResults,
}: SimulationTableProps) {
  const base = { period: basePeriod, metrics: baseMetrics };

  const fmt = (v: number, decimals?: number) =>
    decimals ? formatNumber(v, decimals) : v.toLocaleString("ja-JP", { maximumFractionDigits: 0 });

  const renderRow = (row: RowDef) => {
    const baseVal = row.getValue(base);
    return (
      <tr key={row.label} className={`border-b ${row.bgClass}`}>
        <td className={`py-1.5 px-3 ${row.indent ? "pl-8" : ""} ${row.bold ? "font-bold" : ""}`}>
          {row.label}
        </td>
        <td className="text-right py-1.5 px-2 tabular-nums font-medium">
          {fmt(baseVal, row.decimals)}
          {row.unit || ""}
        </td>
        {scenarioResults.map((sr) => {
          const scenarioVal = row.getScenarioValue(sr);
          const isProfit = row.label === "経常利益";
          const profitImproved = isProfit && scenarioVal > baseVal;
          const profitWorsened = isProfit && scenarioVal < baseVal;
          return (
            <td
              key={sr.scenario.id}
              className={`text-right py-1.5 px-2 tabular-nums ${
                profitImproved ? "text-blue-600 font-semibold" : profitWorsened ? "text-red-600 font-semibold" : ""
              }`}
            >
              {fmt(scenarioVal, row.decimals)}
              {row.unit || ""}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="text-left py-2 px-3 w-40">項目</th>
            <th className="text-right py-2 px-2 min-w-[110px]">
              実績
              <br />
              <span className="text-xs font-normal text-muted-foreground">
                {basePeriod.label}
              </span>
            </th>
            {scenarioResults.map((sr) => (
              <th key={sr.scenario.id} className="text-right py-2 px-2 min-w-[110px]">
                {sr.scenario.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(renderRow)}

          {/* 経常利益の実績比増減率 */}
          <tr className="border-b bg-gray-50">
            <td className="py-1.5 px-3 text-xs text-muted-foreground">経常利益 実績比</td>
            <td className="text-right py-1.5 px-2 text-xs text-muted-foreground">-</td>
            {scenarioResults.map((sr) => (
              <td
                key={sr.scenario.id}
                className={`text-right py-1.5 px-2 text-xs tabular-nums ${
                  sr.ordinaryProfitChangeFromActual > 0
                    ? "text-blue-600"
                    : sr.ordinaryProfitChangeFromActual < 0
                      ? "text-red-600"
                      : ""
                }`}
              >
                {formatNumber(sr.ordinaryProfitChangeFromActual, 1)}%
              </td>
            ))}
          </tr>

          {/* 労働分配率 */}
          <tr className="border-b">
            <td className="py-1.5 px-3">労働分配率</td>
            <td className="text-right py-1.5 px-2 tabular-nums">
              {formatNumber(baseMetrics.laborShareRate, 1)}%
            </td>
            {scenarioResults.map((sr) => (
              <td key={sr.scenario.id} className="text-right py-1.5 px-2 tabular-nums">
                {formatNumber(sr.laborShareRate, 1)}%
              </td>
            ))}
          </tr>

          {/* 区切り */}
          <tr>
            <td colSpan={2 + scenarioResults.length} className="py-1 px-3 text-xs font-bold bg-gray-100">
              1人当たり指標（千円）
            </td>
          </tr>

          {perEmployeeRows.map(renderRow)}
        </tbody>
      </table>
    </div>
  );
}
