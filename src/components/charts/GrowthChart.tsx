"use client";

import React, { useMemo, useRef, useEffect } from "react";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
  Cell,
} from "recharts";

export interface GrowthChartDataPoint {
  label: string;
  salesOku: number;
  marginalProfitRate: number;
  marginalProfitOku: number;
}

export interface GrowthChartProps {
  data: GrowthChartDataPoint[];
}

const POINT_COLORS = ["#1F3864", "#2E75B6", "#C00000", "#70AD47", "#FFC000"];

function calcAxisRange(values: number[], marginRatio: number) {
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range = dataMax - dataMin || dataMax * 0.5 || 1;
  const margin = range * marginRatio;
  return {
    min: Math.max(0, Math.floor((dataMin - margin) * 10) / 10),
    max: Math.ceil((dataMax + margin) * 10) / 10,
  };
}

function generateIsolineValues(dataPoints: GrowthChartDataPoint[]): number[] {
  if (dataPoints.length === 0) return [];
  const mpValues = dataPoints.map((d) => d.marginalProfitOku);
  const mpMin = Math.min(...mpValues);
  const mpMax = Math.max(...mpValues);
  const rangeSpan = mpMax - mpMin || mpMax * 0.5 || 1;
  const start = Math.max(0.5, Math.floor((mpMin - rangeSpan * 0.5) * 2) / 2);
  const end = Math.ceil((mpMax + rangeSpan * 0.5) * 2) / 2;
  const values: number[] = [];
  for (let v = start; v <= end; v += 0.5) {
    values.push(Math.round(v * 10) / 10);
  }
  return values;
}

function generateIsolinePoints(
  marginalProfitOku: number,
  xMin: number,
  xMax: number,
  yMax: number
) {
  const points: { x: number; y: number }[] = [];
  const step = (xMax - xMin) / 100;
  for (let rate = Math.max(xMin, 0.5); rate <= xMax; rate += step) {
    const salesOku = marginalProfitOku / (rate / 100);
    if (salesOku >= 0 && salesOku <= yMax * 1.5) {
      points.push({
        x: Math.round(rate * 100) / 100,
        y: Math.round(salesOku * 1000) / 1000,
      });
    }
  }
  return points;
}

interface CustomTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d || d.label === undefined) return null;
  return (
    <div className="rounded-md border bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold mb-1">{d.label}</p>
      <p>売上高: {d.salesOku.toFixed(2)} 億円</p>
      <p>限界利益率: {d.marginalProfitRate.toFixed(1)}%</p>
      <p>限界利益: {d.marginalProfitOku.toFixed(2)} 億円</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = POINT_COLORS[(payload.index ?? 0) % POINT_COLORS.length];
  return (
    <circle cx={cx} cy={cy} r={7} fill={color} stroke="#fff" strokeWidth={2} />
  );
}

export default function GrowthChart({ data }: GrowthChartProps) {
  const indexedData = useMemo(
    () => data.map((d, i) => ({ ...d, index: i })),
    [data]
  );

  const xRange = useMemo(
    () => calcAxisRange(data.map((d) => d.marginalProfitRate), 0.4),
    [data]
  );
  const yRange = useMemo(
    () => calcAxisRange(data.map((d) => d.salesOku), 0.5),
    [data]
  );

  const isolineValues = useMemo(() => generateIsolineValues(data), [data]);
  const isolineDataSets = useMemo(
    () =>
      isolineValues.map((mp) => ({
        value: mp,
        points: generateIsolinePoints(mp, xRange.min, xRange.max, yRange.max),
      })),
    [isolineValues, xRange, yRange]
  );

  const arrowLineData = useMemo(
    () =>
      indexedData.map((d) => ({
        x: d.marginalProfitRate,
        y: d.salesOku,
      })),
    [indexedData]
  );

  // ── 矢印描画: useEffect で SVG DOM に直接矢印を挿入 ──
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || indexedData.length < 2) return;

    const drawArrows = () => {
      const container = chartRef.current;
      if (!container) return;
      const svg = container.querySelector("svg");
      if (!svg) return;

      // 前回の矢印を削除
      svg.querySelectorAll(".growth-chart-arrow").forEach((el) => el.remove());

      // Scatter の circle 要素を取得（r="7", stroke="#fff" で識別）
      const circles = Array.from(svg.querySelectorAll("circle")).filter(
        (c) =>
          c.getAttribute("r") === "7" &&
          c.getAttribute("stroke") === "#fff" &&
          c.getAttribute("stroke-width") === "2"
      );

      if (circles.length < 2) return;

      // ピクセル座標を取得
      const coords = circles.map((c) => ({
        x: parseFloat(c.getAttribute("cx") || "0"),
        y: parseFloat(c.getAttribute("cy") || "0"),
      }));

      // 各セグメントの中間点に矢印を描画
      for (let i = 0; i < coords.length - 1; i++) {
        const from = coords[i];
        const to = coords[i + 1];
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const angle =
          Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);

        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "growth-chart-arrow");
        g.setAttribute(
          "transform",
          `translate(${midX},${midY}) rotate(${angle})`
        );

        const poly = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "polygon"
        );
        poly.setAttribute("points", "-7,-6 7,0 -7,6");
        poly.setAttribute("fill", "#555");
        g.appendChild(poly);

        svg.appendChild(g);
      }
    };

    // ResponsiveContainer のレンダリング完了を待つ
    const timer = setTimeout(drawArrows, 150);
    return () => clearTimeout(timer);
  }, [indexedData]);

  return (
    <div className="w-full" ref={chartRef}>
      <ResponsiveContainer width="100%" height={500}>
        <ComposedChart margin={{ top: 20, right: 40, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[xRange.min, xRange.max]}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            stroke="#6b7280"
            fontSize={12}
          >
            <Label
              value="限界利益率（%）"
              position="bottom"
              offset={10}
              style={{ fontSize: 13, fill: "#374151" }}
            />
          </XAxis>
          <YAxis
            type="number"
            dataKey="y"
            domain={[yRange.min, yRange.max]}
            tickFormatter={(v: number) => `${v.toFixed(1)}`}
            stroke="#6b7280"
            fontSize={12}
          >
            <Label
              value="売上高（億円）"
              angle={-90}
              position="insideLeft"
              offset={0}
              style={{ fontSize: 13, fill: "#374151", textAnchor: "middle" }}
            />
          </YAxis>
          <Tooltip content={<CustomTooltip />} />

          {isolineDataSets.map((iso) => (
            <Line
              key={`iso-${iso.value}`}
              data={iso.points}
              dataKey="y"
              type="monotone"
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="6 3"
              dot={false}
              activeDot={false}
              legendType="none"
              isAnimationActive={false}
              name={`${iso.value}億円`}
            />
          ))}

          {/* 軌跡線（破線） */}
          <Line
            data={arrowLineData}
            dataKey="y"
            type="linear"
            stroke="#555"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            activeDot={false}
            legendType="none"
            isAnimationActive={false}
            name="__trajectory__"
          />

          <Scatter
            data={indexedData.map((d) => ({
              ...d,
              x: d.marginalProfitRate,
              y: d.salesOku,
            }))}
            shape={<CustomDot />}
            isAnimationActive={false}
          >
            {indexedData.map((_d, i) => (
              <Cell key={`cell-${i}`} fill={POINT_COLORS[i % POINT_COLORS.length]} />
            ))}
          </Scatter>
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-4 mt-4 mb-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-sm">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: POINT_COLORS[i % POINT_COLORS.length] }}
            />
            <span>
              {d.label}（{d.salesOku.toFixed(2)}億円 / {d.marginalProfitRate.toFixed(1)}%
              / 限界利益{d.marginalProfitOku.toFixed(2)}億円）
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-3 mt-1 mb-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <svg width="24" height="8">
            <line x1="0" y1="4" x2="24" y2="4" stroke="#9ca3af" strokeWidth="1" strokeDasharray="4 2" />
          </svg>
          等高線 = 一定の限界利益額
        </span>
        <span className="flex items-center gap-1">
          <svg width="28" height="10">
            <line x1="0" y1="5" x2="18" y2="5" stroke="#555" strokeWidth="1.5" strokeDasharray="4 2" />
            <polygon points="18,2 26,5 18,8" fill="#555" />
          </svg>
          期間推移の方向
        </span>
      </div>

    </div>
  );
}
