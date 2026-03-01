"use client";

import React, { useMemo, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { calculateMetrics, calculateScenario } from "@/lib/calculations";
import { exportSimulationExcel } from "@/lib/excel-export";
import SimulationTable from "@/components/charts/SimulationTable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scenario } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

function ScenarioCard({
  index,
  canRemove,
}: {
  index: number;
  canRemove: boolean;
}) {
  const scenario = useAppStore((s) => s.scenarios[index]);
  const updateScenario = useAppStore((s) => s.updateScenario);
  const removeScenario = useAppStore((s) => s.removeScenario);

  const handleChange = useCallback(
    (field: keyof Scenario, value: number | string) => {
      updateScenario(index, { [field]: value });
    },
    [index, updateScenario]
  );

  if (!scenario) return null;

  const sliderParams: {
    key: keyof Scenario;
    label: string;
    min: number;
    max: number;
    step: number;
    unit: string;
  }[] = [
    {
      key: "salesChangeRate",
      label: "売上高変化率",
      min: -50,
      max: 100,
      step: 1,
      unit: "%",
    },
    {
      key: "variableCostRateChange",
      label: "変動費率変化",
      min: -10,
      max: 10,
      step: 0.5,
      unit: "%pt",
    },
    {
      key: "laborCostChangeRate",
      label: "人件費変化率",
      min: -30,
      max: 50,
      step: 1,
      unit: "%",
    },
    {
      key: "fixedCostChangeRate",
      label: "その他固定費変化率",
      min: -30,
      max: 50,
      step: 1,
      unit: "%",
    },
  ];

  return (
    <Card className="min-w-[280px] flex-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Input
            value={scenario.label}
            onChange={(e) => handleChange("label", e.target.value)}
            className="text-sm font-semibold h-8 w-32 border-none shadow-none p-0 focus-visible:ring-0"
          />
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeScenario(index)}
              className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sliderParams.map((param) => (
          <div key={param.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{param.label}</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={scenario[param.key] as number}
                  onChange={(e) =>
                    handleChange(param.key, parseFloat(e.target.value) || 0)
                  }
                  className="w-20 h-7 text-right text-xs tabular-nums"
                  step={param.step}
                  min={param.min}
                  max={param.max}
                />
                <span className="text-xs text-muted-foreground w-8">
                  {param.unit}
                </span>
              </div>
            </div>
            <Slider
              value={[scenario[param.key] as number]}
              onValueChange={(v) => handleChange(param.key, v[0])}
              min={param.min}
              max={param.max}
              step={param.step}
              className="w-full"
            />
          </div>
        ))}

        <Separator />

        <div className="space-y-1.5">
          <Label className="text-xs">従業員数</Label>
          <Input
            type="number"
            value={scenario.employeeCount}
            onChange={(e) =>
              handleChange("employeeCount", parseInt(e.target.value) || 1)
            }
            className="h-8 text-right text-sm"
            min={1}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function SimulationPage() {
  const periods = useAppStore((s) => s.periods);
  const company = useAppStore((s) => s.company);
  const scenarios = useAppStore((s) => s.scenarios);
  const addScenario = useAppStore((s) => s.addScenario);

  const validPeriods = useMemo(
    () =>
      periods
        .map((p, i) => ({ period: p, index: i }))
        .filter((x) => x.period.sales > 0),
    [periods]
  );

  const [basePeriodIndex, setBasePeriodIndex] = React.useState<number>(
    validPeriods.length > 0 ? validPeriods[validPeriods.length - 1].index : 0
  );

  const basePeriod = periods[basePeriodIndex];
  const baseMetrics = useMemo(
    () => (basePeriod ? calculateMetrics(basePeriod) : null),
    [basePeriod]
  );

  const scenarioResults = useMemo(() => {
    if (!basePeriod) return [];
    return scenarios.map((s) => calculateScenario(basePeriod, s));
  }, [basePeriod, scenarios]);

  const canAdd = scenarios.length < 5;
  const canRemove = scenarios.length > 1;
  const hasData = validPeriods.length > 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">損益シミュレーション</h1>

      {!hasData ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              シミュレーションを行うには、売上高が入力された期が1期以上必要です。
              <br />
              Step 2（データ入力）でデータを入力してください。
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基準期の選択</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={String(basePeriodIndex)}
                onValueChange={(v) => setBasePeriodIndex(parseInt(v, 10))}
              >
                <SelectTrigger className="w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validPeriods.map((x) => (
                    <SelectItem key={x.index} value={String(x.index)}>
                      {x.period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">シナリオパラメータ</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={addScenario}
                disabled={!canAdd}
              >
                <Plus className="w-4 h-4 mr-1" />
                シナリオ追加
              </Button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {scenarios.map((_, index) => (
                <ScenarioCard key={index} index={index} canRemove={canRemove} />
              ))}
            </div>
          </div>

          {basePeriod && baseMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  損益シミュレーション結果
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SimulationTable
                  basePeriod={basePeriod}
                  baseMetrics={baseMetrics}
                  scenarioResults={scenarioResults}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (basePeriod) {
                  exportSimulationExcel(basePeriod, scenarios, company.name);
                }
              }}
            >
              Excelダウンロード
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
