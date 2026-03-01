import {
  PeriodData,
  CalculatedMetrics,
  CompositionRatios,
  WaterfallFactors,
  Scenario,
  ScenarioResult,
} from "./types";

/**
 * 期別実績データから自動計算項目を算出
 */
export function calculateMetrics(period: PeriodData): CalculatedMetrics {
  const totalVariableCost =
    period.materialCost +
    period.outsourcingCost +
    period.merchandisePurchase +
    period.otherVariableCost;

  const marginalProfit = period.sales - totalVariableCost;
  const marginalProfitRate =
    period.sales !== 0 ? (marginalProfit / period.sales) * 100 : 0;

  const totalFixedCost =
    period.laborCost + period.depreciation + period.otherExpenses;

  const operatingProfit = marginalProfit - totalFixedCost;
  const ordinaryProfit = operatingProfit + period.nonOperatingIncome;

  const laborShareRate =
    marginalProfit !== 0 ? (period.laborCost / marginalProfit) * 100 : 0;

  const emp = period.employeeCount || 1;
  const salesPerEmployee = period.sales / emp;
  const marginalProfitPerEmployee = marginalProfit / emp;
  const monthlyMarginalProfitPerEmployee = marginalProfitPerEmployee / 12;
  const ordinaryProfitPerEmployee = ordinaryProfit / emp;

  return {
    totalVariableCost,
    marginalProfit,
    marginalProfitRate,
    totalFixedCost,
    operatingProfit,
    ordinaryProfit,
    laborShareRate,
    salesPerEmployee,
    marginalProfitPerEmployee,
    monthlyMarginalProfitPerEmployee,
    ordinaryProfitPerEmployee,
  };
}

/**
 * 構成比（対売上高比率）を算出
 */
export function calculateCompositionRatios(
  period: PeriodData,
  metrics: CalculatedMetrics
): CompositionRatios {
  const s = period.sales || 1;
  return {
    materialCostRate: (period.materialCost / s) * 100,
    outsourcingCostRate: (period.outsourcingCost / s) * 100,
    merchandisePurchaseRate: (period.merchandisePurchase / s) * 100,
    otherVariableCostRate: (period.otherVariableCost / s) * 100,
    totalVariableCostRate: (metrics.totalVariableCost / s) * 100,
    marginalProfitRate: (metrics.marginalProfit / s) * 100,
    laborCostRate: (period.laborCost / s) * 100,
    depreciationRate: (period.depreciation / s) * 100,
    otherExpensesRate: (period.otherExpenses / s) * 100,
    totalFixedCostRate: (metrics.totalFixedCost / s) * 100,
    operatingProfitRate: (metrics.operatingProfit / s) * 100,
    nonOperatingIncomeRate: (period.nonOperatingIncome / s) * 100,
    ordinaryProfitRate: (metrics.ordinaryProfit / s) * 100,
  };
}

/**
 * 前期比増減率（%）を算出
 */
export function calculateYoYChange(
  current: number,
  previous: number
): number {
  if (previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * ウォーターフォール要因計算
 * ①売上高貢献 =（当期売上高 − 前期売上高）× 前期加工高比率
 * ②加工高比率貢献 = 当期売上高 ×（当期加工高比率 − 前期加工高比率）
 * ③固定費貢献 = −（当期固定費計 − 前期固定費計）
 * ④営業外損益貢献 = 当期営業外損益 − 前期営業外損益
 */
export function calculateWaterfallFactors(
  current: PeriodData,
  previous: PeriodData
): WaterfallFactors {
  const currentMetrics = calculateMetrics(current);
  const previousMetrics = calculateMetrics(previous);

  const prevMarginalRate = previousMetrics.marginalProfitRate / 100;
  const currMarginalRate = currentMetrics.marginalProfitRate / 100;

  const salesContribution =
    (current.sales - previous.sales) * prevMarginalRate;
  const marginalRateContribution =
    current.sales * (currMarginalRate - prevMarginalRate);
  const fixedCostContribution = -(
    currentMetrics.totalFixedCost - previousMetrics.totalFixedCost
  );
  const nonOperatingContribution =
    current.nonOperatingIncome - previous.nonOperatingIncome;

  return {
    salesContribution,
    marginalRateContribution,
    fixedCostContribution,
    nonOperatingContribution,
  };
}

/**
 * 検算: 営業利益 = 限界利益 − 固定費計
 */
export function validateOperatingProfit(period: PeriodData): {
  isValid: boolean;
  difference: number;
} {
  const metrics = calculateMetrics(period);
  const expected = metrics.marginalProfit - metrics.totalFixedCost;
  const diff = Math.abs(metrics.operatingProfit - expected);
  return { isValid: diff < 0.01, difference: diff };
}

/**
 * 検算: 経常利益 = 営業利益 + 営業外損益
 */
export function validateOrdinaryProfit(period: PeriodData): {
  isValid: boolean;
  difference: number;
} {
  const metrics = calculateMetrics(period);
  const expected = metrics.operatingProfit + period.nonOperatingIncome;
  const diff = Math.abs(metrics.ordinaryProfit - expected);
  return { isValid: diff < 0.01, difference: diff };
}

/**
 * シナリオ計算
 */
export function calculateScenario(
  basePeriod: PeriodData,
  scenario: Scenario
): ScenarioResult {
  const baseMetrics = calculateMetrics(basePeriod);

  // 試算売上高
  const sales = basePeriod.sales * (1 + scenario.salesChangeRate / 100);

  // 実績変動費率
  const baseVariableCostRate =
    basePeriod.sales !== 0
      ? baseMetrics.totalVariableCost / basePeriod.sales
      : 0;

  // 試算変動費計
  const totalVariableCost =
    sales * (baseVariableCostRate + scenario.variableCostRateChange / 100);

  // 変動費各項目を構成比で按分
  const baseTotal = baseMetrics.totalVariableCost || 1;
  const materialCost =
    totalVariableCost * (basePeriod.materialCost / baseTotal);
  const outsourcingCost =
    totalVariableCost * (basePeriod.outsourcingCost / baseTotal);
  const merchandisePurchase =
    totalVariableCost * (basePeriod.merchandisePurchase / baseTotal);
  const otherVariableCost =
    totalVariableCost * (basePeriod.otherVariableCost / baseTotal);

  // 試算固定費
  const laborCost =
    basePeriod.laborCost * (1 + scenario.laborCostChangeRate / 100);
  const depreciation =
    basePeriod.depreciation * (1 + scenario.fixedCostChangeRate / 100);
  const otherExpenses =
    basePeriod.otherExpenses * (1 + scenario.fixedCostChangeRate / 100);

  const totalFixedCost = laborCost + depreciation + otherExpenses;
  const marginalProfit = sales - totalVariableCost;
  const marginalProfitRate = sales !== 0 ? (marginalProfit / sales) * 100 : 0;
  const operatingProfit = marginalProfit - totalFixedCost;
  const nonOperatingIncome = basePeriod.nonOperatingIncome; // 据え置き
  const ordinaryProfit = operatingProfit + nonOperatingIncome;

  const emp = scenario.employeeCount || 1;
  const laborShareRate =
    marginalProfit !== 0 ? (laborCost / marginalProfit) * 100 : 0;

  const baseOrdinary = baseMetrics.ordinaryProfit;

  return {
    scenario,
    sales,
    totalVariableCost,
    materialCost,
    outsourcingCost,
    merchandisePurchase,
    otherVariableCost,
    marginalProfit,
    marginalProfitRate,
    laborCost,
    depreciation,
    otherExpenses,
    totalFixedCost,
    operatingProfit,
    nonOperatingIncome,
    ordinaryProfit,
    laborShareRate,
    salesPerEmployee: sales / emp,
    marginalProfitPerEmployee: marginalProfit / emp,
    monthlyMarginalProfitPerEmployee: marginalProfit / emp / 12,
    ordinaryProfitPerEmployee: ordinaryProfit / emp,
    salesChangeFromActual: calculateYoYChange(sales, basePeriod.sales),
    ordinaryProfitChangeFromActual:
      baseOrdinary !== 0
        ? calculateYoYChange(ordinaryProfit, baseOrdinary)
        : 0,
  };
}

/**
 * 数値フォーマット: 千円単位、カンマ区切り、小数第1位
 */
export function formatNumber(value: number, decimals: number = 1): string {
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 千円→億円変換
 */
export function toOku(senEn: number): number {
  return senEn / 100000; // 千円÷100,000 = 億円
}

/**
 * Growth Chart用の等高線計算
 * 売上高 = 限界利益額 ÷ 限界利益率
 */
export function calculateIsoline(
  marginalProfitOku: number,
  ratePercent: number
): number {
  if (ratePercent === 0) return Infinity;
  return marginalProfitOku / (ratePercent / 100);
}
