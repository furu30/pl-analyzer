import { describe, it, expect } from "vitest";
import {
  calculateMetrics,
  calculateCompositionRatios,
  calculateYoYChange,
  calculateWaterfallFactors,
  validateOperatingProfit,
  validateOrdinaryProfit,
  calculateScenario,
  formatNumber,
  toOku,
  calculateIsoline,
} from "../calculations";
import { PeriodData, Scenario } from "../types";

// ── ヘルパー ──

function makePeriod(overrides?: Partial<PeriodData>): PeriodData {
  return {
    id: "test-id",
    companyId: "test-company",
    label: "テスト期",
    sales: 500000,
    materialCost: 150000,
    outsourcingCost: 50000,
    merchandisePurchase: 0,
    otherVariableCost: 20000,
    laborCost: 120000,
    depreciation: 30000,
    otherExpenses: 80000,
    nonOperatingIncome: -5000,
    employeeCount: 50,
    ...overrides,
  };
}

function makeScenario(overrides?: Partial<Scenario>): Scenario {
  return {
    id: "scenario-1",
    periodId: "test-id",
    label: "テストシナリオ",
    salesChangeRate: 0,
    variableCostRateChange: 0,
    laborCostChangeRate: 0,
    fixedCostChangeRate: 0,
    employeeCount: 50,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════
// calculateMetrics
// ═══════════════════════════════════════════════
describe("calculateMetrics", () => {
  it("正常値で全指標を正しく算出する", () => {
    const period = makePeriod();
    const m = calculateMetrics(period);

    expect(m.totalVariableCost).toBe(220000); // 150k+50k+0+20k
    expect(m.marginalProfit).toBe(280000); // 500k-220k
    expect(m.marginalProfitRate).toBeCloseTo(56, 1); // 280k/500k*100
    expect(m.totalFixedCost).toBe(230000); // 120k+30k+80k
    expect(m.operatingProfit).toBe(50000); // 280k-230k
    expect(m.ordinaryProfit).toBe(45000); // 50k+(-5k)
    expect(m.laborShareRate).toBeCloseTo(42.857, 1); // 120k/280k*100
    expect(m.salesPerEmployee).toBe(10000); // 500k/50
    expect(m.marginalProfitPerEmployee).toBe(5600); // 280k/50
    expect(m.monthlyMarginalProfitPerEmployee).toBeCloseTo(466.667, 0); // 5600/12
    expect(m.ordinaryProfitPerEmployee).toBe(900); // 45k/50
  });

  it("売上0の場合、限界利益率は0になる", () => {
    const m = calculateMetrics(makePeriod({ sales: 0 }));
    expect(m.marginalProfitRate).toBe(0);
  });

  it("従業員数0の場合、1人扱いでNaN/Infinityにならない", () => {
    const m = calculateMetrics(makePeriod({ employeeCount: 0 }));
    expect(Number.isFinite(m.salesPerEmployee)).toBe(true);
    expect(Number.isFinite(m.marginalProfitPerEmployee)).toBe(true);
    expect(Number.isFinite(m.ordinaryProfitPerEmployee)).toBe(true);
  });

  it("全項目0でもエラーにならない", () => {
    const m = calculateMetrics(
      makePeriod({
        sales: 0,
        materialCost: 0,
        outsourcingCost: 0,
        merchandisePurchase: 0,
        otherVariableCost: 0,
        laborCost: 0,
        depreciation: 0,
        otherExpenses: 0,
        nonOperatingIncome: 0,
        employeeCount: 0,
      })
    );
    expect(m.totalVariableCost).toBe(0);
    expect(m.marginalProfit).toBe(0);
    expect(m.operatingProfit).toBe(0);
    expect(m.ordinaryProfit).toBe(0);
  });

  it("限界利益が負の場合も正しく計算される", () => {
    const m = calculateMetrics(
      makePeriod({ sales: 100000, materialCost: 150000 })
    );
    expect(m.marginalProfit).toBeLessThan(0);
    expect(m.marginalProfitRate).toBeLessThan(0);
  });
});

// ═══════════════════════════════════════════════
// calculateCompositionRatios
// ═══════════════════════════════════════════════
describe("calculateCompositionRatios", () => {
  it("正常値で構成比を正しく算出する", () => {
    const period = makePeriod();
    const metrics = calculateMetrics(period);
    const ratios = calculateCompositionRatios(period, metrics);

    expect(ratios.materialCostRate).toBeCloseTo(30, 1); // 150k/500k*100
    expect(ratios.outsourcingCostRate).toBeCloseTo(10, 1);
    expect(ratios.totalVariableCostRate).toBeCloseTo(44, 1);
    expect(ratios.marginalProfitRate).toBeCloseTo(56, 1);
    expect(ratios.laborCostRate).toBeCloseTo(24, 1);
    expect(ratios.operatingProfitRate).toBeCloseTo(10, 1);
    expect(ratios.ordinaryProfitRate).toBeCloseTo(9, 1);
  });

  it("売上0の場合、分母1でフォールバックしNaN/Infinityにならない", () => {
    const period = makePeriod({ sales: 0 });
    const metrics = calculateMetrics(period);
    const ratios = calculateCompositionRatios(period, metrics);

    for (const value of Object.values(ratios)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("全13フィールドが返される", () => {
    const period = makePeriod();
    const metrics = calculateMetrics(period);
    const ratios = calculateCompositionRatios(period, metrics);

    const expectedKeys = [
      "materialCostRate",
      "outsourcingCostRate",
      "merchandisePurchaseRate",
      "otherVariableCostRate",
      "totalVariableCostRate",
      "marginalProfitRate",
      "laborCostRate",
      "depreciationRate",
      "otherExpensesRate",
      "totalFixedCostRate",
      "operatingProfitRate",
      "nonOperatingIncomeRate",
      "ordinaryProfitRate",
    ];
    expect(Object.keys(ratios).sort()).toEqual(expectedKeys.sort());
  });
});

// ═══════════════════════════════════════════════
// calculateYoYChange
// ═══════════════════════════════════════════════
describe("calculateYoYChange", () => {
  it("増加: (200, 100) → 100%", () => {
    expect(calculateYoYChange(200, 100)).toBeCloseTo(100);
  });

  it("減少: (50, 100) → -50%", () => {
    expect(calculateYoYChange(50, 100)).toBeCloseTo(-50);
  });

  it("全減: (0, 100) → -100%", () => {
    expect(calculateYoYChange(0, 100)).toBeCloseTo(-100);
  });

  it("前期0の場合は0を返す", () => {
    expect(calculateYoYChange(100, 0)).toBe(0);
  });

  it("負の値: (-50, -100) → +50% (損失が半減=改善)", () => {
    // (-50 - (-100)) / |(-100)| * 100 = 50%
    expect(calculateYoYChange(-50, -100)).toBeCloseTo(50);
  });
});

// ═══════════════════════════════════════════════
// calculateWaterfallFactors
// ═══════════════════════════════════════════════
describe("calculateWaterfallFactors", () => {
  it("2期比較で4要因を算出する", () => {
    const prev = makePeriod({ sales: 400000, materialCost: 120000 });
    const curr = makePeriod({ sales: 500000, materialCost: 150000 });
    const factors = calculateWaterfallFactors(curr, prev);

    expect(Number.isFinite(factors.salesContribution)).toBe(true);
    expect(Number.isFinite(factors.marginalRateContribution)).toBe(true);
    expect(Number.isFinite(factors.fixedCostContribution)).toBe(true);
    expect(Number.isFinite(factors.nonOperatingContribution)).toBe(true);
  });

  it("同一期間では全要因が0になる", () => {
    const period = makePeriod();
    const factors = calculateWaterfallFactors(period, period);

    expect(factors.salesContribution).toBeCloseTo(0);
    expect(factors.marginalRateContribution).toBeCloseTo(0);
    expect(factors.fixedCostContribution).toBeCloseTo(0);
    expect(factors.nonOperatingContribution).toBeCloseTo(0);
  });

  it("4要因の合計 ≈ 経常利益の変動額（ウォーターフォール恒等式）", () => {
    const prev = makePeriod({
      sales: 400000,
      materialCost: 120000,
      outsourcingCost: 40000,
      laborCost: 100000,
      otherExpenses: 70000,
      nonOperatingIncome: -3000,
    });
    const curr = makePeriod();
    const factors = calculateWaterfallFactors(curr, prev);

    const prevMetrics = calculateMetrics(prev);
    const currMetrics = calculateMetrics(curr);
    const actualChange =
      currMetrics.ordinaryProfit - prevMetrics.ordinaryProfit;

    const factorSum =
      factors.salesContribution +
      factors.marginalRateContribution +
      factors.fixedCostContribution +
      factors.nonOperatingContribution;

    expect(factorSum).toBeCloseTo(actualChange, 0);
  });
});

// ═══════════════════════════════════════════════
// validateOperatingProfit / validateOrdinaryProfit
// ═══════════════════════════════════════════════
describe("validateOperatingProfit", () => {
  it("正常データでは常にvalid", () => {
    const result = validateOperatingProfit(makePeriod());
    expect(result.isValid).toBe(true);
    expect(result.difference).toBeLessThan(0.01);
  });

  it("ゼロデータでもvalid", () => {
    const result = validateOperatingProfit(
      makePeriod({
        sales: 0,
        materialCost: 0,
        outsourcingCost: 0,
        merchandisePurchase: 0,
        otherVariableCost: 0,
        laborCost: 0,
        depreciation: 0,
        otherExpenses: 0,
      })
    );
    expect(result.isValid).toBe(true);
  });
});

describe("validateOrdinaryProfit", () => {
  it("正常データでは常にvalid", () => {
    const result = validateOrdinaryProfit(makePeriod());
    expect(result.isValid).toBe(true);
    expect(result.difference).toBeLessThan(0.01);
  });

  it("ゼロデータでもvalid", () => {
    const result = validateOrdinaryProfit(
      makePeriod({
        sales: 0,
        materialCost: 0,
        outsourcingCost: 0,
        merchandisePurchase: 0,
        otherVariableCost: 0,
        laborCost: 0,
        depreciation: 0,
        otherExpenses: 0,
        nonOperatingIncome: 0,
      })
    );
    expect(result.isValid).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// calculateScenario
// ═══════════════════════════════════════════════
describe("calculateScenario", () => {
  it("変化率0のシナリオは実績値と一致する", () => {
    const period = makePeriod();
    const scenario = makeScenario();
    const result = calculateScenario(period, scenario);
    const base = calculateMetrics(period);

    expect(result.sales).toBeCloseTo(period.sales);
    expect(result.marginalProfit).toBeCloseTo(base.marginalProfit);
    expect(result.operatingProfit).toBeCloseTo(base.operatingProfit);
    expect(result.ordinaryProfit).toBeCloseTo(base.ordinaryProfit);
  });

  it("売上+10%で売上高が1.1倍になる", () => {
    const period = makePeriod();
    const result = calculateScenario(
      period,
      makeScenario({ salesChangeRate: 10 })
    );
    expect(result.sales).toBeCloseTo(period.sales * 1.1);
  });

  it("人件費+20%で人件費のみ変化する", () => {
    const period = makePeriod();
    const result = calculateScenario(
      period,
      makeScenario({ laborCostChangeRate: 20 })
    );
    expect(result.laborCost).toBeCloseTo(period.laborCost * 1.2);
    // depreciation/otherExpensesはfixedCostChangeRate=0なので変化しない
    expect(result.depreciation).toBeCloseTo(period.depreciation);
    expect(result.otherExpenses).toBeCloseTo(period.otherExpenses);
  });

  it("従業員数0でもNaN/Infinityにならない", () => {
    const period = makePeriod();
    const result = calculateScenario(
      period,
      makeScenario({ employeeCount: 0 })
    );
    expect(Number.isFinite(result.salesPerEmployee)).toBe(true);
    expect(Number.isFinite(result.marginalProfitPerEmployee)).toBe(true);
  });

  it("変動費合計0の基準期でもNaNにならない", () => {
    const period = makePeriod({
      materialCost: 0,
      outsourcingCost: 0,
      merchandisePurchase: 0,
      otherVariableCost: 0,
    });
    const result = calculateScenario(period, makeScenario());
    expect(Number.isFinite(result.materialCost)).toBe(true);
    expect(Number.isFinite(result.totalVariableCost)).toBe(true);
  });
});

// ═══════════════════════════════════════════════
// formatNumber
// ═══════════════════════════════════════════════
describe("formatNumber", () => {
  it("カンマ区切り・小数1桁", () => {
    const result = formatNumber(1234567.89, 1);
    expect(result).toContain("1,234,567.9");
  });

  it("0はフォーマットされる", () => {
    expect(formatNumber(0)).toBe("0.0");
  });

  it("負の数も正しくフォーマット", () => {
    const result = formatNumber(-1234.5, 1);
    expect(result).toContain("1,234.5");
  });

  it("小数桁0で整数表示", () => {
    const result = formatNumber(100, 0);
    expect(result).toBe("100");
  });
});

// ═══════════════════════════════════════════════
// toOku
// ═══════════════════════════════════════════════
describe("toOku", () => {
  it("100,000千円 = 1億円", () => {
    expect(toOku(100000)).toBe(1);
  });

  it("0千円 = 0億円", () => {
    expect(toOku(0)).toBe(0);
  });

  it("50,000千円 = 0.5億円", () => {
    expect(toOku(50000)).toBe(0.5);
  });
});

// ═══════════════════════════════════════════════
// calculateIsoline
// ═══════════════════════════════════════════════
describe("calculateIsoline", () => {
  it("限界利益1億・利益率50% → 売上2億", () => {
    expect(calculateIsoline(1, 50)).toBe(2);
  });

  it("利益率0%ではInfinityを返す", () => {
    expect(calculateIsoline(1, 0)).toBe(Infinity);
  });

  it("限界利益0 → 売上0", () => {
    expect(calculateIsoline(0, 50)).toBe(0);
  });
});
