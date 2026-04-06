"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { calculateMetrics, calculateWaterfallFactors, toOku } from "@/lib/calculations";
import type { GrowthChartDataPoint } from "@/components/charts/GrowthChart";
import { exportReportPdf, PdfReportSections } from "@/lib/pdf-export";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import WaterfallChart from "@/components/charts/WaterfallChart";
import GrowthChart from "@/components/charts/GrowthChart";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  CheckSquare,
  Square,
  Building2,
  Calendar,
  BarChart3,
} from "lucide-react";

// ウォーターフォールのY軸範囲計算（balance-chartからの再利用ヘルパー）
function calcWaterfallYRange(factors: ReturnType<typeof calculateWaterfallFactors>, prevProfit: number) {
  const values = [
    prevProfit,
    factors.salesContribution,
    factors.marginalRateContribution,
    factors.fixedCostContribution,
    factors.nonOperatingContribution,
    prevProfit + factors.salesContribution + factors.marginalRateContribution + factors.fixedCostContribution + factors.nonOperatingContribution,
  ];
  const maxAbs = Math.max(...values.map(Math.abs));
  return [-maxAbs * 1.3, maxAbs * 1.3];
}

export default function ReportPage() {
  const { company, periods, scenarios } = useAppStore();
  const [isExporting, setIsExporting] = useState(false);
  const [sections, setSections] = useState<PdfReportSections>({
    coverPage: true,
    plTable: true,
    waterfallChart: true,
    growthChart: true,
    simulation: true,
  });

  const offscreenRef = useRef<HTMLDivElement>(null);

  const toggleSection = (key: keyof PdfReportSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasValidData = periods.some((p) => p.sales > 0);
  const validPeriods = periods.filter((p) => p.sales > 0);

  // ウォーターフォール比較ペア
  const waterfallPairs = useMemo(() => {
    const pairs: { prev: typeof periods[0]; curr: typeof periods[0]; index: number }[] = [];
    for (let i = 0; i < validPeriods.length - 1; i++) {
      pairs.push({ prev: validPeriods[i], curr: validPeriods[i + 1], index: i });
    }
    return pairs;
  }, [validPeriods]);

  // 推定ページ数
  const estimatedPages = useMemo(() => {
    let count = 0;
    if (sections.coverPage) count++;
    if (sections.plTable) count++;
    if (sections.waterfallChart) count += waterfallPairs.length;
    if (sections.growthChart && validPeriods.length >= 2) count++;
    if (sections.simulation) count++;
    return count;
  }, [sections, waterfallPairs.length, validPeriods.length]);

  const handleExport = useCallback(async () => {
    if (!hasValidData) {
      toast.error("実績データが入力されていません");
      return;
    }

    setIsExporting(true);
    try {
      // チャート画像をキャプチャ
      const waterfallImages: string[] = [];
      if (sections.waterfallChart && offscreenRef.current) {
        const waterfallEls = offscreenRef.current.querySelectorAll<HTMLElement>(
          "[data-report-waterfall]"
        );
        for (const el of waterfallEls) {
          const dataUrl = await toPng(el, {
            backgroundColor: "#ffffff",
            pixelRatio: 3,
            cacheBust: true,
          });
          waterfallImages.push(dataUrl);
        }
      }

      let growthChartImage: string | undefined;
      if (sections.growthChart && offscreenRef.current) {
        const growthEl = offscreenRef.current.querySelector<HTMLElement>(
          "[data-report-growth]"
        );
        if (growthEl) {
          growthChartImage = await toPng(growthEl, {
            backgroundColor: "#ffffff",
            pixelRatio: 3,
            cacheBust: true,
          });
        }
      }

      await exportReportPdf({
        company,
        periods: validPeriods,
        scenarios,
        sections,
        waterfallImages,
        growthChartImage,
      });

      toast.success("PDFレポートを出力しました");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("PDFレポートの出力に失敗しました");
    } finally {
      setIsExporting(false);
    }
  }, [company, validPeriods, scenarios, sections, hasValidData]);

  const sectionOptions: { key: keyof PdfReportSections; label: string; available: boolean }[] = [
    { key: "coverPage", label: "表紙", available: true },
    { key: "plTable", label: "損益比較表", available: validPeriods.length >= 1 },
    { key: "waterfallChart", label: "ウォーターフォールチャート", available: waterfallPairs.length >= 1 },
    { key: "growthChart", label: "Growth Chart", available: validPeriods.length >= 2 },
    { key: "simulation", label: "損益シミュレーション", available: scenarios.length >= 1 },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <FileText className="w-6 h-6 text-[#1F4E79]" />
        レポート出力
      </h1>

      {/* レポート概要 */}
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
            <span className="font-medium">
              {validPeriods.length === 0
                ? "データなし"
                : validPeriods.length === 1
                  ? validPeriods[0].label
                  : `${validPeriods[0].label} ～ ${validPeriods[validPeriods.length - 1].label}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">推定ページ数:</span>
            <span className="font-medium">{estimatedPages}ページ</span>
          </div>
        </CardContent>
      </Card>

      {/* セクション選択 */}
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
                available
                  ? "hover:bg-gray-50 cursor-pointer"
                  : "opacity-40 cursor-not-allowed"
              }`}
            >
              {sections[key] && available ? (
                <CheckSquare className="w-4 h-4 text-[#1F4E79] shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-gray-300 shrink-0" />
              )}
              <span>{label}</span>
              {!available && (
                <span className="text-xs text-muted-foreground ml-auto">
                  データ不足
                </span>
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* 出力ボタン */}
      <Button
        onClick={handleExport}
        disabled={isExporting || !hasValidData || estimatedPages === 0}
        size="lg"
        className="w-full bg-[#1F4E79] hover:bg-[#163a5c]"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            PDFを生成中...
          </>
        ) : (
          <>
            <FileText className="w-5 h-5 mr-2" />
            PDFレポートを出力
          </>
        )}
      </Button>

      {!hasValidData && (
        <p className="text-sm text-muted-foreground text-center">
          実績データを入力してからレポートを出力してください
        </p>
      )}

      {/* ── オフスクリーン描画エリア（チャートキャプチャ用） ── */}
      <div
        ref={offscreenRef}
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          width: "800px",
          pointerEvents: "none",
        }}
      >
        {/* ウォーターフォールチャート */}
        {waterfallPairs.map(({ prev, curr, index }) => {
          const factors = calculateWaterfallFactors(curr, prev);
          const prevMetrics = calculateMetrics(prev);
          const [yMin, yMax] = calcWaterfallYRange(factors, prevMetrics.ordinaryProfit);
          return (
            <div
              key={index}
              data-report-waterfall
              style={{ width: "800px", height: "400px", padding: "16px", background: "white" }}
            >
              <p style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "14px" }}>
                {prev.label} → {curr.label} 利益変動要因
              </p>
              <WaterfallChart
                factors={factors}
                previousOrdinaryProfit={prevMetrics.ordinaryProfit}
                currentOrdinaryProfit={calculateMetrics(curr).ordinaryProfit}
                previousPeriodLabel={prev.label}
                currentPeriodLabel={curr.label}
                yDomain={[yMin, yMax]}
              />
            </div>
          );
        })}

        {/* Growth Chart */}
        {validPeriods.length >= 2 && (
          <div
            data-report-growth
            style={{ width: "800px", height: "500px", padding: "16px", background: "white" }}
          >
            <GrowthChart
              data={validPeriods.map((p): GrowthChartDataPoint => {
                const m = calculateMetrics(p);
                return {
                  label: p.label,
                  salesOku: toOku(p.sales),
                  marginalProfitRate: m.marginalProfitRate,
                  marginalProfitOku: toOku(m.marginalProfit),
                };
              })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
