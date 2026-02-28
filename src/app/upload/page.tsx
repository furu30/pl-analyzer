"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { ExtractedPeriodData } from "@/lib/types";
import { extractFromPDF } from "@/lib/pdf-extract";
import { getActiveApiKey } from "@/lib/api-key-storage";
import {
  getVariableCostItems,
  setVariableCostItems,
} from "@/lib/variable-cost-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import PdfUploader from "@/components/pdf/PdfUploader";
import ExtractedDataReview from "@/components/pdf/ExtractedDataReview";
import ApiKeyDialog from "@/components/pdf/ApiKeyDialog";
import { exportPdfToExcel, PdfExcelData } from "@/lib/excel-export";
import {
  Key,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Circle,
  X,
  Plus,
  Eye,
  FileUp,
  ClipboardList,
  ArrowLeft,
} from "lucide-react";

type Phase = "upload" | "extracting" | "parsing" | "review" | "error" | "saved-review" | "excel-converting";

export default function UploadPage() {
  const router = useRouter();
  const { updatePeriod, periods, addPeriod, removePeriod } = useAppStore();

  const [inputMode, setInputMode] = useState<"select" | "pdf">("select");
  const [phase, setPhase] = useState<Phase>("upload");
  const [error, setError] = useState("");
  const [extractedPeriods, setExtractedPeriods] = useState<
    ExtractedPeriodData[]
  >([]);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [parseMode, setParseMode] = useState<"text" | "image">("text");
  const [targetPeriodIndex, setTargetPeriodIndex] = useState(0);
  const [lastPdfBase64, setLastPdfBase64] = useState("");
  const [reviewingPeriodIndex, setReviewingPeriodIndex] = useState(0);

  // 期の追加・削除
  const canAddPeriod = periods.length < 5;
  const canRemovePeriod = periods.length > 2;

  const handleAddPeriod = useCallback(() => {
    if (!canAddPeriod) return;
    addPeriod(`第${periods.length + 1}期`);
  }, [canAddPeriod, periods.length, addPeriod]);

  const handleRemovePeriod = useCallback(() => {
    if (!canRemovePeriod) return;
    const lastIndex = periods.length - 1;
    removePeriod(lastIndex);
    if (targetPeriodIndex >= periods.length - 1) {
      setTargetPeriodIndex(Math.max(0, periods.length - 2));
    }
  }, [canRemovePeriod, periods.length, removePeriod, targetPeriodIndex]);

  // その他変動費に含める項目
  const [vcItems, setVcItems] = useState<string[]>([]);
  const [vcInput, setVcInput] = useState("");

  useEffect(() => {
    setVcItems(getVariableCostItems());
  }, []);

  const addVcItem = () => {
    const trimmed = vcInput.trim();
    if (!trimmed || vcItems.includes(trimmed)) return;
    const updated = [...vcItems, trimmed];
    setVcItems(updated);
    setVariableCostItems(updated);
    setVcInput("");
  };

  const removeVcItem = (item: string) => {
    const updated = vcItems.filter((v) => v !== item);
    setVcItems(updated);
    setVariableCostItems(updated);
  };

  const handleVcInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addVcItem();
    }
  };

  const handleFileSelected = useCallback(
    async (file: File) => {
      const active = getActiveApiKey();
      if (!active) {
        setApiKeyDialogOpen(true);
        return;
      }

      try {
        setPhase("extracting");
        setError("");
        const pdfResult = await extractFromPDF(file);
        setLastPdfBase64(pdfResult.pdfBase64);

        // Claude/Gemini → PDF直接送信（最高精度）
        // OpenAI → テキスト or 画像モード（PDF直接送信非対応）
        const isPdfCapable = active.provider === "claude" || active.provider === "gemini";
        let mode: "pdf" | "text" | "image";
        if (isPdfCapable) {
          mode = "pdf"; // 常にPDF直接送信を使用
        } else {
          mode = pdfResult.hasText ? "text" : "image";
        }
        setParseMode(mode === "pdf" ? (pdfResult.hasText ? "text" : "image") : mode);

        if (mode === "image" && pdfResult.images.length === 0) {
          throw new Error(
            "PDFから画像を生成できませんでした。PDFファイルが正しいか確認してください。"
          );
        }

        setPhase("parsing");

        const body: Record<string, unknown> = {
          apiKey: active.apiKey,
          provider: active.provider,
          mode,
          variableCostItems: vcItems,
        };

        if (mode === "pdf") {
          // PDF直接送信（Claude/Gemini用）
          body.pdfBase64 = pdfResult.pdfBase64;
          // OpenAIフォールバック用にテキスト・画像も添付
          if (pdfResult.hasText) {
            body.text = pdfResult.text;
          }
          body.images = pdfResult.images;
        } else if (mode === "text") {
          body.text = pdfResult.text;
        } else {
          body.images = pdfResult.images;
        }

        const response = await fetch("/api/parse-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "API呼び出しに失敗しました");
        }

        const result = await response.json();

        if (result.periods && result.periods.length > 0) {
          setExtractedPeriods(result.periods);
          setPhase("review");
        } else {
          throw new Error(
            "決算データを抽出できませんでした。PDFの内容を確認してください。"
          );
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "予期しないエラーが発生しました";
        setError(message);
        setPhase("error");
      }
    },
    [vcItems]
  );

  const savePeriod = useCallback(
    (targetIndex: number, data: ExtractedPeriodData) => {
      const periodData: Record<string, unknown> = {
        label:
          data.label ||
          periods[targetIndex]?.label ||
          `第${targetIndex + 1}期`,
      };

      const numericFields = [
        "sales",
        "materialCost",
        "outsourcingCost",
        "merchandisePurchase",
        "otherVariableCost",
        "laborCost",
        "depreciation",
        "otherExpenses",
        "nonOperatingIncome",
        "employeeCount",
      ] as const;

      for (const field of numericFields) {
        const val = data[field];
        periodData[field] = val !== null && val !== undefined ? val : 0;
      }

      if ((periodData.employeeCount as number) < 1)
        periodData.employeeCount = 1;

      updatePeriod(targetIndex, periodData);
    },
    [periods, updatePeriod]
  );

  const handleSaveAndContinue = useCallback(
    (targetIndex: number, data: ExtractedPeriodData) => {
      savePeriod(targetIndex, data);
      const nextEmpty = periods.findIndex(
        (p, i) => i !== targetIndex && p.sales === 0
      );
      setTargetPeriodIndex(nextEmpty >= 0 ? nextEmpty : 0);
      setPhase("upload");
      setError("");
      setExtractedPeriods([]);
      setParseMode("text");
    },
    [savePeriod, periods]
  );

  const handleSaveAndFinish = useCallback(
    (targetIndex: number, data: ExtractedPeriodData) => {
      savePeriod(targetIndex, data);
      router.push("/input");
    },
    [savePeriod, router]
  );

  // 保存済みデータを確認・編集する
  const handleViewSavedPeriod = useCallback(
    (index: number) => {
      const period = periods[index];
      if (!period || period.sales === 0) return;

      // PeriodData → ExtractedPeriodData に変換（確認・編集用）
      const asExtracted: ExtractedPeriodData = {
        label: period.label,
        sales: period.sales,
        materialCost: period.materialCost,
        outsourcingCost: period.outsourcingCost,
        merchandisePurchase: period.merchandisePurchase,
        otherVariableCost: period.otherVariableCost,
        laborCost: period.laborCost,
        depreciation: period.depreciation,
        otherExpenses: period.otherExpenses,
        nonOperatingIncome: period.nonOperatingIncome,
        employeeCount: period.employeeCount,
        ordinaryProfitFromPdf: null,
        confidence: {},
        breakdown: {},
        notes: [],
      };
      setExtractedPeriods([asExtracted]);
      setReviewingPeriodIndex(index);
      setPhase("saved-review");
    },
    [periods]
  );

  // ── PDF → Excel変換 ──
  const handleExcelConvert = useCallback(
    async (file: File) => {
      const active = getActiveApiKey();
      if (!active) {
        setApiKeyDialogOpen(true);
        return;
      }

      try {
        setPhase("excel-converting");
        setError("");

        const pdfResult = await extractFromPDF(file);

        // API送信モード決定
        const isPdfCapable = active.provider === "claude" || active.provider === "gemini";
        let mode: "pdf" | "text" | "image";
        if (isPdfCapable) {
          mode = "pdf";
        } else {
          mode = pdfResult.hasText ? "text" : "image";
        }

        const body: Record<string, unknown> = {
          apiKey: active.apiKey,
          provider: active.provider,
          mode,
        };

        if (mode === "pdf") {
          body.pdfBase64 = pdfResult.pdfBase64;
          if (pdfResult.hasText) body.text = pdfResult.text;
          body.images = pdfResult.images;
        } else if (mode === "text") {
          body.text = pdfResult.text;
        } else {
          body.images = pdfResult.images;
        }

        const response = await fetch("/api/pdf-to-excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "API呼び出しに失敗しました");
        }

        const result = (await response.json()) as PdfExcelData;

        if (!result.sheets || result.sheets.length === 0) {
          throw new Error("決算書のテーブルデータを抽出できませんでした。");
        }

        // Excelファイル生成・ダウンロード
        const baseName = file.name.replace(/\.pdf$/i, "");
        await exportPdfToExcel(result, `決算書_${baseName}`);
        setPhase("upload");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "予期しないエラーが発生しました";
        setError(message);
        setPhase("error");
      }
    },
    []
  );

  const handleReset = () => {
    setPhase("upload");
    setError("");
    setExtractedPeriods([]);
    setParseMode("text");
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl">
        {/* ── 入力方式の選択画面 ── */}
        {inputMode === "select" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Step 1: データ入力</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                データの入力方式を選択してください。
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setInputMode("pdf")}
                  className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-muted hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer text-center"
                >
                  <FileUp className="w-10 h-10 text-primary" />
                  <div>
                    <p className="font-semibold">PDF取込</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      決算書PDFからAIが自動抽出
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => router.push("/input")}
                  className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-muted hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer text-center"
                >
                  <ClipboardList className="w-10 h-10 text-primary" />
                  <div>
                    <p className="font-semibold">手入力</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      損益データを直接入力
                    </p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── PDF取込モード ── */}
        {inputMode === "pdf" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInputMode("select")}
                  className="h-8 w-8 p-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <CardTitle className="text-lg">
                    決算書PDF読み取り
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    決算書のPDFをアップロードすると、AIが損益計算書の数値を自動的に抽出します。
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApiKeyDialogOpen(true)}
              >
                <Key className="w-4 h-4 mr-1" />
                APIキー
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {phase === "upload" && (
              <>
                {/* 期スロット状況 */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium flex-1">
                      各期のデータ状況:
                    </p>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddPeriod}
                        disabled={!canAddPeriod}
                        className="h-7 text-xs"
                      >
                        <Plus className="w-3 h-3 mr-0.5" />
                        追加
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemovePeriod}
                        disabled={!canRemovePeriod}
                        className="h-7 text-xs text-destructive hover:text-destructive"
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {periods.map((period, index) => {
                      const hasData = period.sales > 0;
                      return (
                        <div key={period.id} className="flex items-center gap-0.5">
                          <Button
                            variant={
                              targetPeriodIndex === index ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setTargetPeriodIndex(index)}
                            className="gap-1.5"
                          >
                            {hasData ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                            {period.label}
                          </Button>
                          {hasData && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewSavedPeriod(index)}
                              className="h-7 w-7 p-0"
                              title="保存済みデータを確認・編集"
                            >
                              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    読み取り先:
                    <span className="font-medium ml-1">
                      {periods[targetPeriodIndex]?.label}
                    </span>
                    {periods[targetPeriodIndex]?.sales > 0 && (
                      <span className="text-destructive ml-1">
                        （データあり・上書きされます）
                      </span>
                    )}
                  </p>
                </div>

                {/* その他変動費に含める項目 */}
                <div className="mb-5 p-3 bg-muted/50 rounded-lg border">
                  <p className="text-sm font-medium mb-2">
                    その他変動費に含める勘定科目:
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    以下の項目に該当する費用はAIが「その他変動費」に振り分けます。
                    それ以外は「その他経費（固定費）」に分類されます。
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {vcItems.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeVcItem(item)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {vcItems.length === 0 && (
                      <span className="text-xs text-muted-foreground italic">
                        項目が未設定です
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={vcInput}
                      onChange={(e) => setVcInput(e.target.value)}
                      onKeyDown={handleVcInputKeyDown}
                      placeholder="例: 消耗品費、荷造運賃..."
                      className="text-sm h-8"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addVcItem}
                      disabled={!vcInput.trim()}
                      className="h-8 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      追加
                    </Button>
                  </div>
                </div>

                <PdfUploader
                  onFileSelected={handleFileSelected}
                  onExcelConvert={handleExcelConvert}
                  isProcessing={false}
                />
              </>
            )}

            {phase === "excel-converting" && (
              <div className="py-12 text-center space-y-4">
                <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                <div>
                  <p className="font-medium">決算書をExcelに変換中...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    AIが決算書の表データを読み取っています（30秒〜1分程度）
                  </p>
                </div>
              </div>
            )}

            {(phase === "extracting" || phase === "parsing") && (
              <div className="py-12 text-center space-y-4">
                <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                <div>
                  <p className="font-medium">
                    {phase === "extracting"
                      ? "PDFを処理中..."
                      : "AIが決算書を解析中..."}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {phase === "extracting"
                      ? "PDFを処理しています"
                      : parseMode === "image"
                        ? "画像認識で決算書を読み取っています（1〜2分程度）"
                        : "AIが損益計算書の数値を抽出しています（30秒〜1分程度）"}
                  </p>
                  {phase === "parsing" && parseMode === "image" && (
                    <p className="text-xs text-blue-600 mt-2">
                      スキャンPDFを検出 → 画像認識モードで解析中
                    </p>
                  )}
                </div>
              </div>
            )}

            {phase === "error" && (
              <div className="py-8 text-center space-y-4">
                <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    エラーが発生しました
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
                <Button variant="outline" onClick={handleReset}>
                  やり直す
                </Button>
              </div>
            )}

            {phase === "review" && extractedPeriods.length > 0 && (
              <ExtractedDataReview
                allExtracted={extractedPeriods}
                storePeriods={periods}
                initialTargetIndex={targetPeriodIndex}
                pdfBase64={lastPdfBase64}
                onSaveAndContinue={handleSaveAndContinue}
                onSaveAndFinish={handleSaveAndFinish}
                onBack={handleReset}
              />
            )}

            {phase === "saved-review" && extractedPeriods.length > 0 && (
              <ExtractedDataReview
                allExtracted={extractedPeriods}
                storePeriods={periods}
                initialTargetIndex={reviewingPeriodIndex}
                pdfBase64={lastPdfBase64}
                onSaveAndContinue={handleSaveAndContinue}
                onSaveAndFinish={handleSaveAndFinish}
                onBack={handleReset}
              />
            )}

          </CardContent>
        </Card>
        )}
      </div>

      <ApiKeyDialog
        open={apiKeyDialogOpen}
        onOpenChange={setApiKeyDialogOpen}
        onKeySaved={() => {}}
      />
    </div>
  );
}
