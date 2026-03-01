"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

export interface WaterfallFactors {
  salesContribution: number;
  marginalRateContribution: number;
  fixedCostContribution: number;
  nonOperatingContribution: number;
}

export interface WaterfallChartProps {
  previousPeriodLabel: string;
  currentPeriodLabel: string;
  previousOrdinaryProfit: number;
  currentOrdinaryProfit: number;
  factors: WaterfallFactors;
  /** 全チャート共通のY軸ドメイン [min, max]。未指定時は自動計算 */
  yDomain?: [number, number];
}

/**
 * ウォーターフォールチャートのY軸に必要な範囲を計算する
 */
export function calcWaterfallYRange(
  previousOrdinaryProfit: number,
  factors: WaterfallFactors
): [number, number] {
  let cumulative = previousOrdinaryProfit;
  let min = Math.min(0, cumulative);
  let max = Math.max(0, cumulative);

  const items = [
    factors.salesContribution,
    factors.marginalRateContribution,
    factors.fixedCostContribution,
    factors.nonOperatingContribution,
  ];

  for (const v of items) {
    cumulative += v;
    min = Math.min(min, cumulative);
    max = Math.max(max, cumulative);
  }

  return [min, max];
}

interface WaterfallBar {
  name: string;
  invisible: number;
  value: number;
  total: number;
  color: string;
}

const NAVY = "#1F3864";
const BLUE = "#2E75B6";
const RED = "#C00000";

export default function WaterfallChart({
  previousPeriodLabel,
  currentPeriodLabel,
  previousOrdinaryProfit,
  currentOrdinaryProfit,
  factors,
  yDomain,
}: WaterfallChartProps) {
  const data = useMemo(() => {
    const bars: WaterfallBar[] = [];
    let cumulative = previousOrdinaryProfit;

    bars.push({
      name: `${previousPeriodLabel}\n経常利益`,
      invisible: 0,
      value: previousOrdinaryProfit,
      total: previousOrdinaryProfit,
      color: NAVY,
    });

    const factorItems = [
      { name: "売上高\n貢献", value: factors.salesContribution },
      { name: "加工高比率\n貢献", value: factors.marginalRateContribution },
      { name: "固定費\n貢献", value: factors.fixedCostContribution },
      { name: "営業外損益\n貢献", value: factors.nonOperatingContribution },
    ];

    for (const item of factorItems) {
      const color = item.value >= 0 ? BLUE : RED;
      const invisible = item.value >= 0 ? cumulative : cumulative + item.value;
      bars.push({
        name: item.name,
        invisible: Math.max(0, invisible),
        value: Math.abs(item.value),
        total: cumulative + item.value,
        color,
      });
      cumulative += item.value;
    }

    bars.push({
      name: `${currentPeriodLabel}\n経常利益`,
      invisible: 0,
      value: currentOrdinaryProfit,
      total: currentOrdinaryProfit,
      color: NAVY,
    });

    return bars;
  }, [
    previousPeriodLabel,
    currentPeriodLabel,
    previousOrdinaryProfit,
    currentOrdinaryProfit,
    factors,
  ]);

  const formatValue = (v: number) => {
    return v.toLocaleString("ja-JP", { maximumFractionDigits: 0 });
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#374151" }}
            interval={0}
          />
          <YAxis
            tickFormatter={formatValue}
            tick={{ fontSize: 11 }}
            domain={yDomain ?? ["auto", "auto"]}
            label={{
              value: "千円",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 12 },
            }}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === "invisible") return [null, null];
              return [formatValue(Number(value)) + " 千円", "金額"];
            }}
            labelFormatter={(label) => String(label).replace("\n", " ")}
          />
          <ReferenceLine y={0} stroke="#000" />
          <Bar dataKey="invisible" stackId="stack" fill="transparent" />
          <Bar dataKey="value" stackId="stack" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex justify-center gap-6 text-xs mt-2">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: NAVY }} />
          前期/当期 経常利益
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: BLUE }} />
          改善（正の要因）
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: RED }} />
          悪化（負の要因）
        </span>
      </div>
    </div>
  );
}
