"use client";

import React, { useMemo, useRef, useCallback, useState } from "react";
import { toPng } from "html-to-image";
import { useAppStore } from "@/lib/store";
import { calculateMetrics, toOku, formatNumber } from "@/lib/calculations";
import GrowthChart, { GrowthChartDataPoint } from "@/components/charts/GrowthChart";
import { exportGrowthChartExcel } from "@/lib/excel-export";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

export default function GrowthChartPage() {
  const periods = useAppStore((s) => s.periods);
  const company = useAppStore((s) => s.company);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [isPngExporting, setIsPngExporting] = useState(false);
  const [isExcelExporting, setIsExcelExporting] = useState(false);

  const chartData: GrowthChartDataPoint[] = useMemo(() => {
    return periods
      .filter((p) => p.sales > 0)
      .map((p) => {
        const metrics = calculateMetrics(p);
        return {
          label: p.label,
          salesOku: toOku(p.sales),
          marginalProfitRate: metrics.marginalProfitRate,
          marginalProfitOku: toOku(metrics.marginalProfit),
        };
      });
  }, [periods]);

  const hasEnoughData = chartData.length >= 2;

  const handlePngExport = useCallback(async () => {
    if (!chartAreaRef.current) return;
    setIsPngExporting(true);
    try {
      const dataUrl = await toPng(chartAreaRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      const name = (company.name || "GrowthChart").trim();
      link.download = `${name}_GrowthChart.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("PNG export failed:", err);
      alert("PNG画像の生成に失敗しました。");
    } finally {
      setIsPngExporting(false);
    }
  }, [company.name]);

  const handleExcelExport = useCallback(async () => {
    setIsExcelExporting(true);
    try {
      // チャート画像をキャプチャ
      let chartImage: string | undefined;
      const chartEl = document.querySelector<HTMLElement>("[data-growth-chart]");
      if (chartEl) {
        try {
          chartImage = await toPng(chartEl, {
            backgroundColor: "#ffffff",
            pixelRatio: 2,
            cacheBust: true,
          });
        } catch {
          // キャプチャ失敗時は画像なしで進行
        }
      }
      await exportGrowthChartExcel(periods, company.name, chartImage);
    } catch (err) {
      console.error("Excel export failed:", err);
      alert("Excelエクスポートに失敗しました。");
    } finally {
      setIsExcelExporting(false);
    }
  }, [periods, company.name]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Growth Chart</h1>

      {!hasEnoughData ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Growth Chart を表示するには、売上高が入力された期が2期以上必要です。
              <br />
              Step 2（データ入力）で各期の売上高を入力してください。
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div ref={chartAreaRef}>
            <Card>
              <CardHeader>
                <CardTitle>成長チャート（売上高 × 限界利益率）</CardTitle>
              </CardHeader>
              <CardContent>
                <div data-growth-chart>
                  <GrowthChart data={chartData} />
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>データサマリー</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>期</TableHead>
                      <TableHead className="text-right">売上高（億円）</TableHead>
                      <TableHead className="text-right">限界利益率（%）</TableHead>
                      <TableHead className="text-right">限界利益（億円）</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartData.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{d.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(d.salesOku, 2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(d.marginalProfitRate, 1)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(d.marginalProfitOku, 2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handlePngExport}
              disabled={isPngExporting}
            >
              <Download className="w-4 h-4 mr-1.5" />
              {isPngExporting ? "画像生成中..." : "PNG画像としてダウンロード"}
            </Button>
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
