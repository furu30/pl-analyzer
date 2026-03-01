"use client";

import { useState, useCallback, useMemo } from "react";
import { ExtractedPeriodData, PeriodData } from "@/lib/types";
import { getActiveApiKey } from "@/lib/api-key-storage";
import { getVariableCostItems } from "@/lib/variable-cost-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle2, HelpCircle, ShieldCheck, ShieldAlert, Loader2, Send } from "lucide-react";

interface FieldDef {
  key: string;
  label: string;
  unit: string;
  group: "variable" | "fixed" | "other";
}

const fields: FieldDef[] = [
  { key: "sales", label: "売上高", unit: "千円", group: "other" },
  { key: "materialCost", label: "材料費", unit: "千円", group: "variable" },
  { key: "outsourcingCost", label: "外注費", unit: "千円", group: "variable" },
  { key: "merchandisePurchase", label: "商品仕入", unit: "千円", group: "variable" },
  { key: "otherVariableCost", label: "その他変動費", unit: "千円", group: "variable" },
  { key: "laborCost", label: "人件費", unit: "千円", group: "fixed" },
  { key: "depreciation", label: "減価償却費", unit: "千円", group: "fixed" },
  { key: "otherExpenses", label: "その他経費", unit: "千円", group: "fixed" },
  { key: "nonOperatingIncome", label: "営業外損益", unit: "千円", group: "other" },
  { key: "employeeCount", label: "従業員数", unit: "人", group: "other" },
];

function n(val: number | null | undefined): number {
  return val ?? 0;
}

function formatNum(v: number): string {
  return v.toLocaleString();
}

function ConfidenceBadge({
  level,
}: {
  level: "high" | "medium" | "low" | undefined;
}) {
  if (!level || level === "high") {
    return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  }
  if (level === "medium") {
    return <HelpCircle className="w-4 h-4 text-yellow-500" />;
  }
  return <AlertTriangle className="w-4 h-4 text-red-500" />;
}

interface CalcSummary {
  totalVariableCost: number;
  marginalProfit: number;
  marginalProfitRate: number;
  totalFixedCost: number;
  operatingProfit: number;
  ordinaryProfit: number;
  /** 決算書記載の経常利益（null = 不明） */
  ordinaryProfitFromPdf: number | null;
  /** 計算値と決算書記載値の差分（0 = 整合, null = 比較不可） */
  discrepancy: number | null;
}

function calcSummary(data: ExtractedPeriodData): CalcSummary {
  const sales = n(data.sales);
  const totalVariableCost =
    n(data.materialCost) +
    n(data.outsourcingCost) +
    n(data.merchandisePurchase) +
    n(data.otherVariableCost);
  const marginalProfit = sales - totalVariableCost;
  const marginalProfitRate = sales > 0 ? (marginalProfit / sales) * 100 : 0;
  const totalFixedCost =
    n(data.laborCost) + n(data.depreciation) + n(data.otherExpenses);
  const operatingProfit = marginalProfit - totalFixedCost;
  const ordinaryProfit = operatingProfit + n(data.nonOperatingIncome);

  const ordinaryProfitFromPdf = data.ordinaryProfitFromPdf ?? null;
  const discrepancy =
    ordinaryProfitFromPdf !== null
      ? ordinaryProfit - ordinaryProfitFromPdf
      : null;

  return {
    totalVariableCost,
    marginalProfit,
    marginalProfitRate,
    totalFixedCost,
    operatingProfit,
    ordinaryProfit,
    ordinaryProfitFromPdf,
    discrepancy,
  };
}

/**
 * 保存前の整合性チェック＋自動補正
 * 経常利益（計算値）と決算書記載値が一致しない場合、otherExpenses を調整して整合を取る
 */
function validateAndFix(data: ExtractedPeriodData): ExtractedPeriodData {
  const pdfOrdinary = data.ordinaryProfitFromPdf;
  if (pdfOrdinary === null || pdfOrdinary === undefined) return data;

  const sales = n(data.sales);
  const totalVariable =
    n(data.materialCost) +
    n(data.outsourcingCost) +
    n(data.merchandisePurchase) +
    n(data.otherVariableCost);
  const marginalProfit = sales - totalVariable;
  const operatingProfit = marginalProfit - n(data.laborCost) - n(data.depreciation) - n(data.otherExpenses);
  const ordinaryProfit = operatingProfit + n(data.nonOperatingIncome);
  const diff = ordinaryProfit - pdfOrdinary;

  if (Math.abs(diff) < 1) return data; // 1千円未満の誤差は無視

  // otherExpenses を調整: diff > 0 → 経常利益が多すぎ → otherExpenses を増やす
  const adjustedOtherExpenses = n(data.otherExpenses) + diff;

  return {
    ...data,
    otherExpenses: Math.round(adjustedOtherExpenses),
  };
}

interface ExtractedDataReviewProps {
  allExtracted: ExtractedPeriodData[];
  storePeriods: PeriodData[];
  initialTargetIndex: number;
  pdfBase64?: string;
  onSaveAndContinue: (targetIndex: number, data: ExtractedPeriodData) => void;
  onSaveAndFinish: (targetIndex: number, data: ExtractedPeriodData) => void;
  onBack: () => void;
  readOnly?: boolean;
}

export default function ExtractedDataReview({
  allExtracted,
  storePeriods,
  initialTargetIndex,
  pdfBase64,
  onSaveAndContinue,
  onSaveAndFinish,
  onBack,
  readOnly = false,
}: ExtractedDataReviewProps) {
  const [selectedExtractedIndex, setSelectedExtractedIndex] = useState(0);
  const [editedPeriods, setEditedPeriods] = useState<ExtractedPeriodData[]>(
    () => allExtracted.map((p) => ({ ...p }))
  );
  const [targetIndex, setTargetIndex] = useState(initialTargetIndex);

  // 修正チャット
  const [correctionText, setCorrectionText] = useState("");
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionError, setCorrectionError] = useState("");

  const data = editedPeriods[selectedExtractedIndex];
  const summary = useMemo(() => calcSummary(data), [data]);

  const handleCorrection = useCallback(async () => {
    if (!correctionText.trim() || isCorrecting) return;
    const active = getActiveApiKey();
    if (!active) return;

    setIsCorrecting(true);
    setCorrectionError("");

    try {
      const response = await fetch("/api/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: active.apiKey,
          provider: active.provider,
          mode: "correction",
          currentData: data,
          correctionInstruction: correctionText,
          pdfBase64: pdfBase64 || undefined,
          variableCostItems: getVariableCostItems(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "修正APIの呼び出しに失敗しました");
      }

      const result = await response.json();
      if (result.periods && result.periods.length > 0) {
        setEditedPeriods((prev) => {
          const updated = [...prev];
          updated[selectedExtractedIndex] = result.periods[0];
          return updated;
        });
        setCorrectionText("");
      }
    } catch (err: unknown) {
      setCorrectionError(
        err instanceof Error ? err.message : "修正中にエラーが発生しました"
      );
    } finally {
      setIsCorrecting(false);
    }
  }, [correctionText, isCorrecting, data, pdfBase64, selectedExtractedIndex]);

  const handleFieldChange = useCallback(
    (key: string, rawValue: string) => {
      const cleaned = rawValue.replace(/,/g, "").trim();
      const num = cleaned === "" ? null : Number(cleaned);
      setEditedPeriods((prev) => {
        const updated = [...prev];
        const d = { ...updated[selectedExtractedIndex] };
        const current = (d as unknown as Record<string, unknown>)[key];
        (d as unknown as Record<string, unknown>)[key] =
          num !== null && isNaN(num) ? current : num;
        updated[selectedExtractedIndex] = d;
        return updated;
      });
    },
    [selectedExtractedIndex]
  );

  const handleLabelChange = useCallback(
    (value: string) => {
      setEditedPeriods((prev) => {
        const updated = [...prev];
        updated[selectedExtractedIndex] = {
          ...updated[selectedExtractedIndex],
          label: value,
        };
        return updated;
      });
    },
    [selectedExtractedIndex]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">抽出データの確認・編集</CardTitle>
        <p className="text-sm text-muted-foreground">
          AIが抽出した値を確認し、必要に応じて修正してください。
          下部の計算サマリーが自動更新されます。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 複数期選択 */}
        {allExtracted.length > 1 && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm font-medium text-blue-800 mb-2">
                PDFから{allExtracted.length}
                期分のデータを検出しました。使用する期を選択してください:
              </p>
              <div className="flex gap-2 flex-wrap">
                {allExtracted.map((p, i) => (
                  <Button
                    key={i}
                    variant={
                      selectedExtractedIndex === i ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setSelectedExtractedIndex(i)}
                  >
                    {p.label || `期${i + 1}`}
                  </Button>
                ))}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* 保存先 */}
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Label className="w-32 shrink-0 text-sm font-bold">保存先</Label>
            <Select
              value={String(targetIndex)}
              onValueChange={(v) => setTargetIndex(Number(v))}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {storePeriods.map((sp, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {sp.label}
                    {sp.sales > 0 && " (データあり・上書き)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ラベル */}
        <div className="flex items-center gap-2">
          <Label className="w-32 shrink-0 text-sm font-bold">
            決算期ラベル
          </Label>
          <Input
            value={data.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="例: R6年4月期"
            className="max-w-xs"
            readOnly={readOnly}
          />
        </div>

        <Separator />

        {/* AI解析メモ */}
        {data.notes && data.notes.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 space-y-1">
            <p className="text-sm font-medium text-yellow-800">AI解析メモ:</p>
            {data.notes.map((note, i) => (
              <p key={i} className="text-sm text-yellow-700">
                {note}
              </p>
            ))}
          </div>
        )}

        {/* ── 売上高 ── */}
        <TooltipProvider>
          {renderField(fields[0], data, handleFieldChange, readOnly)}

          {/* ── 変動費セクション ── */}
          <div className="mt-2">
            <p className="text-xs font-bold text-muted-foreground mb-1">
              ▼ 変動費
            </p>
          </div>
          {fields
            .filter((f) => f.group === "variable")
            .map((field) => renderField(field, data, handleFieldChange, readOnly))}

          {/* 変動費合計 + 限界利益 */}
          <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">変動費合計</span>
              <span className="tabular-nums font-medium">
                {formatNum(summary.totalVariableCost)} 千円
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold">限界利益（加工高）</span>
              <span
                className={`tabular-nums font-bold ${summary.marginalProfit < 0 ? "text-red-600" : ""}`}
              >
                {formatNum(summary.marginalProfit)} 千円
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({summary.marginalProfitRate.toFixed(1)}%)
                </span>
              </span>
            </div>
          </div>

          {/* ── 固定費セクション ── */}
          <div className="mt-2">
            <p className="text-xs font-bold text-muted-foreground mb-1">
              ▼ 固定費
            </p>
          </div>
          {fields
            .filter((f) => f.group === "fixed")
            .map((field) => renderField(field, data, handleFieldChange, readOnly))}

          {/* 固定費合計 + 営業利益 */}
          <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">固定費合計</span>
              <span className="tabular-nums font-medium">
                {formatNum(summary.totalFixedCost)} 千円
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold">営業利益</span>
              <span
                className={`tabular-nums font-bold ${summary.operatingProfit < 0 ? "text-red-600" : ""}`}
              >
                {formatNum(summary.operatingProfit)} 千円
              </span>
            </div>
          </div>

          {/* ── 営業外損益 ── */}
          <div className="mt-2">
            <p className="text-xs font-bold text-muted-foreground mb-1">
              ▼ 営業外損益
            </p>
          </div>
          {renderField(fields.find((f) => f.key === "nonOperatingIncome")!, data, handleFieldChange, readOnly)}

          {/* 経常利益 */}
          <div
            className={`rounded-md px-3 py-2 border ${
              summary.ordinaryProfit < 0
                ? "bg-red-50 border-red-300"
                : "bg-emerald-50 border-emerald-300"
            }`}
          >
            <div className="flex justify-between text-sm">
              <span className="font-bold">経常利益</span>
              <span
                className={`tabular-nums font-bold ${summary.ordinaryProfit < 0 ? "text-red-600" : "text-emerald-700"}`}
              >
                {formatNum(summary.ordinaryProfit)} 千円
              </span>
            </div>
            {/* 整合性チェック表示 */}
            {summary.ordinaryProfitFromPdf !== null && (
              <div className="mt-1 pt-1 border-t border-dashed">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">決算書記載の経常利益</span>
                  <span className="tabular-nums font-medium">
                    {formatNum(summary.ordinaryProfitFromPdf)} 千円
                  </span>
                </div>
                {summary.discrepancy !== null && Math.abs(summary.discrepancy) >= 1 ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs text-amber-600">
                      差額 {formatNum(summary.discrepancy)} 千円 → 保存時にその他経費を自動調整します
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs text-green-600">計算値と一致しています</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 従業員数 ── */}
          <div className="mt-2">
            <p className="text-xs font-bold text-muted-foreground mb-1">
              ▼ その他
            </p>
          </div>
          {renderField(fields.find((f) => f.key === "employeeCount")!, data, handleFieldChange, readOnly)}
        </TooltipProvider>

        {/* ── 修正チャット ── */}
        {!readOnly && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-bold">AIに修正を指示</p>
              <p className="text-xs text-muted-foreground">
                計算根拠を確認し、修正が必要な場合は指示を入力してください。AIが元のPDFを再確認して修正します。
              </p>
              <div className="flex gap-2">
                <Textarea
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  placeholder="例: 減価償却費に製造原価報告書の分が含まれていません。販管費の減価償却費だけでなく製造原価の減価償却費も合算してください。"
                  className="text-sm min-h-[60px] flex-1"
                  disabled={isCorrecting}
                />
                <Button
                  onClick={handleCorrection}
                  disabled={!correctionText.trim() || isCorrecting}
                  className="shrink-0 self-end"
                  size="sm"
                >
                  {isCorrecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      修正
                    </>
                  )}
                </Button>
              </div>
              {correctionError && (
                <p className="text-xs text-destructive">{correctionError}</p>
              )}
            </div>
          </>
        )}

        <Separator />

        {/* アクションボタン */}
        {readOnly ? (
          <div className="flex justify-center">
            <Button variant="outline" onClick={onBack}>
              閉じる
            </Button>
          </div>
        ) : (
          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack}>
              戻る
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onSaveAndContinue(targetIndex, validateAndFix(data))}
              >
                保存して別の期を読み取る
              </Button>
              <Button onClick={() => onSaveAndFinish(targetIndex, validateAndFix(data))}>
                保存してStep 2へ
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** 1フィールドの入力行を描画 */
function renderField(
  field: FieldDef,
  data: ExtractedPeriodData,
  onChange: (key: string, rawValue: string) => void,
  readOnly?: boolean
) {
  const value = (data as unknown as Record<string, unknown>)[field.key];
  const confidence = data.confidence?.[field.key] as
    | "high"
    | "medium"
    | "low"
    | undefined;
  const displayValue =
    value !== null && value !== undefined ? String(value) : "";
  const breakdown = data.breakdown?.[field.key];

  return (
    <div key={field.key} className="space-y-0.5">
      <div className="flex items-center gap-2">
        <Label className="w-32 shrink-0 text-sm font-medium">{field.label}</Label>
        <div className="relative flex-1">
          <Input
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={(e) => onChange(field.key, e.target.value)}
            placeholder="0"
            readOnly={readOnly}
            className={`text-right pr-12 tabular-nums ${
              readOnly ? "bg-muted" : ""
            } ${
              confidence === "low"
                ? "border-red-300 bg-red-50"
                : confidence === "medium"
                  ? "border-yellow-300 bg-yellow-50"
                  : ""
            }`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            {field.unit}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <ConfidenceBadge level={confidence} />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {confidence === "high"
              ? "高確信度"
              : confidence === "medium"
                ? "中確信度（要確認）"
                : confidence === "low"
                  ? "低確信度（要確認）"
                  : "確信度不明"}
          </TooltipContent>
        </Tooltip>
      </div>
      {/* 計算根拠 */}
      {breakdown && (
        <p className="text-xs text-muted-foreground pl-[8.5rem]">
          {breakdown}
        </p>
      )}
    </div>
  );
}
