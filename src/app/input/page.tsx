"use client";

import { useCallback, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import { exportActualDataExcel } from "@/lib/excel-export";
import { PeriodData } from "@/lib/types";
import {
  calculateMetrics,
  formatNumber,
  validateOperatingProfit,
} from "@/lib/calculations";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type EditableField = keyof Pick<
  PeriodData,
  | "sales"
  | "materialCost"
  | "outsourcingCost"
  | "merchandisePurchase"
  | "otherVariableCost"
  | "laborCost"
  | "depreciation"
  | "otherExpenses"
  | "nonOperatingIncome"
  | "employeeCount"
>;

interface FieldDef {
  key: EditableField;
  label: string;
  unit: string;
}

const salesFields: FieldDef[] = [
  { key: "sales", label: "売上高", unit: "千円" },
];

const variableFields: FieldDef[] = [
  { key: "materialCost", label: "材料費", unit: "千円" },
  { key: "outsourcingCost", label: "外注費", unit: "千円" },
  { key: "merchandisePurchase", label: "商品仕入", unit: "千円" },
  { key: "otherVariableCost", label: "その他変動費", unit: "千円" },
];

const fixedFields: FieldDef[] = [
  { key: "laborCost", label: "人件費", unit: "千円" },
  { key: "depreciation", label: "減価償却費", unit: "千円" },
  { key: "otherExpenses", label: "その他経費", unit: "千円" },
];

const nonOperatingFields: FieldDef[] = [
  { key: "nonOperatingIncome", label: "営業外損益", unit: "千円" },
];

const otherFields: FieldDef[] = [
  { key: "employeeCount", label: "従業員数", unit: "人" },
];

function useNumberInput(
  value: number,
  onChange: (v: number) => void,
  allowNegative: boolean = false
) {
  const [isFocused, setIsFocused] = useState(false);
  const [rawText, setRawText] = useState("");

  const displayValue = isFocused
    ? rawText
    : value !== 0
      ? value.toLocaleString("ja-JP")
      : "";

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setRawText(value !== 0 ? String(value) : "");
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const cleaned = rawText.replace(/,/g, "").trim();
    if (cleaned === "" || cleaned === "-") {
      onChange(0);
      return;
    }
    const num = Number(cleaned);
    if (!isNaN(num)) {
      onChange(allowNegative ? num : Math.abs(num));
    }
  }, [rawText, onChange, allowNegative]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (allowNegative) {
        if (/^-?[\d,]*\.?\d*$/.test(val) || val === "" || val === "-") {
          setRawText(val);
        }
      } else {
        if (/^[\d,]*\.?\d*$/.test(val) || val === "") {
          setRawText(val);
        }
      }
    },
    [allowNegative]
  );

  return { displayValue, handleFocus, handleBlur, handleChange };
}

function NumberInputCell({
  field,
  value,
  onChange,
  allowNegative = false,
}: {
  field: FieldDef;
  value: number;
  onChange: (v: number) => void;
  allowNegative?: boolean;
}) {
  const { displayValue, handleFocus, handleBlur, handleChange } =
    useNumberInput(value, onChange, allowNegative);

  return (
    <div className="flex items-center gap-2">
      <Label className="w-32 shrink-0 text-sm font-medium">{field.label}</Label>
      <div className="relative flex-1">
        <Input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="0"
          className="text-right pr-12 tabular-nums"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {field.unit}
        </span>
      </div>
    </div>
  );
}

function ReadOnlyRow({
  label,
  value,
  unit = "千円",
  decimals = 0,
  bold = false,
}: {
  label: string;
  value: number;
  unit?: string;
  decimals?: number;
  bold?: boolean;
}) {
  const formatted =
    decimals > 0
      ? formatNumber(value, decimals)
      : value.toLocaleString("ja-JP");
  const isNegative = value < 0;
  return (
    <div className="flex items-center gap-2">
      <Label className={`w-32 shrink-0 text-sm ${bold ? "font-bold" : "font-medium"}`}>
        {label}
      </Label>
      <div className="relative flex-1">
        <div
          className={`h-9 w-full rounded-md border border-input bg-muted/50 px-3 pr-12 py-1 text-right text-sm tabular-nums flex items-center justify-end ${
            bold ? "font-bold" : ""
          } ${isNegative ? "text-red-600" : ""}`}
        >
          {formatted}
        </div>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {unit}
        </span>
      </div>
    </div>
  );
}

function SectionHeader({ title, bgClass }: { title: string; bgClass?: string }) {
  return (
    <div className={`px-3 py-1.5 rounded-md text-sm font-bold ${bgClass || "bg-muted"}`}>
      {title}
    </div>
  );
}

function PeriodForm({ periodIndex }: { periodIndex: number }) {
  const period = useAppStore((s) => s.periods[periodIndex]);
  const updatePeriod = useAppStore((s) => s.updatePeriod);

  const metrics = useMemo(() => calculateMetrics(period), [period]);
  const validation = useMemo(() => validateOperatingProfit(period), [period]);

  const handleFieldChange = useCallback(
    (field: EditableField, value: number) => {
      updatePeriod(periodIndex, { [field]: value });
    },
    [periodIndex, updatePeriod]
  );

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updatePeriod(periodIndex, { label: e.target.value });
    },
    [periodIndex, updatePeriod]
  );

  if (!period) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="shrink-0 text-sm font-bold">決算期ラベル</Label>
        <Input
          type="text"
          value={period.label}
          onChange={handleLabelChange}
          placeholder="例: R6年4月期"
          className="max-w-xs"
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <SectionHeader title="売上高" bgClass="bg-sales" />
        {salesFields.map((f) => (
          <NumberInputCell
            key={f.key}
            field={f}
            value={period[f.key]}
            onChange={(v) => handleFieldChange(f.key, v)}
          />
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <SectionHeader title="変動費" bgClass="bg-variable" />
        {variableFields.map((f) => (
          <NumberInputCell
            key={f.key}
            field={f}
            value={period[f.key]}
            onChange={(v) => handleFieldChange(f.key, v)}
          />
        ))}
        <ReadOnlyRow label="変動費合計" value={metrics.totalVariableCost} bold />
      </div>

      <Separator />

      <div className="space-y-2">
        <SectionHeader title="限界利益" bgClass="bg-marginal" />
        <ReadOnlyRow label="限界利益" value={metrics.marginalProfit} bold />
        <ReadOnlyRow label="限界利益率" value={metrics.marginalProfitRate} unit="%" decimals={1} />
      </div>

      <Separator />

      <div className="space-y-2">
        <SectionHeader title="固定費" bgClass="bg-fixed" />
        {fixedFields.map((f) => (
          <NumberInputCell
            key={f.key}
            field={f}
            value={period[f.key]}
            onChange={(v) => handleFieldChange(f.key, v)}
          />
        ))}
        <ReadOnlyRow label="固定費合計" value={metrics.totalFixedCost} bold />
      </div>

      <Separator />

      <div className="space-y-2">
        <SectionHeader title="営業利益" bgClass="bg-profit" />
        <ReadOnlyRow label="営業利益" value={metrics.operatingProfit} bold />
      </div>

      <Separator />

      <div className="space-y-2">
        <SectionHeader title="営業外損益" />
        {nonOperatingFields.map((f) => (
          <NumberInputCell
            key={f.key}
            field={f}
            value={period[f.key]}
            onChange={(v) => handleFieldChange(f.key, v)}
            allowNegative
          />
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <SectionHeader title="経常利益" bgClass="bg-profit" />
        <ReadOnlyRow label="経常利益" value={metrics.ordinaryProfit} bold />
      </div>

      <Separator />

      <div className="space-y-2">
        <SectionHeader title="その他" />
        {otherFields.map((f) => (
          <NumberInputCell
            key={f.key}
            field={f}
            value={period[f.key]}
            onChange={(v) => handleFieldChange(f.key, v)}
          />
        ))}
        <ReadOnlyRow label="労働分配率" value={metrics.laborShareRate} unit="%" decimals={1} />
      </div>

      <Separator />

      <div className="flex items-center gap-3 rounded-lg border p-3">
        <span className="text-sm font-medium">検算: 営業利益 = 限界利益 - 固定費合計</span>
        <div className="ml-auto">
          {validation.isValid ? (
            <Badge className="bg-green-600 hover:bg-green-600 text-white">OK</Badge>
          ) : (
            <Badge variant="destructive">NG (差額: {formatNumber(validation.difference, 0)})</Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InputPage() {
  const periods = useAppStore((s) => s.periods);
  const company = useAppStore((s) => s.company);
  const selectedPeriodIndex = useAppStore((s) => s.selectedPeriodIndex);
  const setSelectedPeriodIndex = useAppStore((s) => s.setSelectedPeriodIndex);
  const addPeriod = useAppStore((s) => s.addPeriod);
  const removePeriod = useAppStore((s) => s.removePeriod);

  const canAdd = periods.length < 5;
  const canRemove = periods.length > 2;

  const handleAddPeriod = useCallback(() => {
    if (!canAdd) return;
    addPeriod(`第${periods.length + 1}期`);
  }, [canAdd, periods.length, addPeriod]);

  const handleRemovePeriod = useCallback(
    (index: number) => {
      if (!canRemove) return;
      removePeriod(index);
    },
    [canRemove, removePeriod]
  );

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Step 2: 実績データ入力・編集</CardTitle>
            <p className="text-sm text-muted-foreground">
              各決算期の損益計算書データを入力してください。金額は千円単位で入力します。
            </p>
          </CardHeader>
          <CardContent>
            <Tabs
              value={String(selectedPeriodIndex)}
              onValueChange={(v) => setSelectedPeriodIndex(parseInt(v, 10))}
            >
              <div className="flex items-center gap-2 mb-4">
                <TabsList className="flex-1">
                  {periods.map((period, index) => (
                    <TabsTrigger key={period.id} value={String(index)}>
                      {period.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="flex gap-1 shrink-0">
                  <Button variant="outline" size="sm" onClick={handleAddPeriod} disabled={!canAdd}>
                    + 追加
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemovePeriod(selectedPeriodIndex)}
                    disabled={!canRemove}
                    className="text-destructive hover:text-destructive"
                  >
                    削除
                  </Button>
                </div>
              </div>

              {periods.map((period, index) => (
                <TabsContent key={period.id} value={String(index)}>
                  <PeriodForm periodIndex={index} />
                </TabsContent>
              ))}
            </Tabs>

            <Separator className="my-4" />
            <Button
              variant="outline"
              onClick={() => exportActualDataExcel(periods, company.name)}
            >
              Excelエクスポート
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
