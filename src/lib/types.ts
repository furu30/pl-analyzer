export interface Company {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodData {
  id: string;
  companyId: string;
  label: string; // 決算期ラベル（例：R6年4月期）
  sales: number; // 売上高（千円）
  materialCost: number; // 材料費
  outsourcingCost: number; // 外注費
  merchandisePurchase: number; // 商品仕入
  otherVariableCost: number; // その他変動費
  laborCost: number; // 人件費（製造労務費+販管人件費合計）
  depreciation: number; // 減価償却費
  otherExpenses: number; // その他経費（残差計算）
  nonOperatingIncome: number; // 営業外損益（収益−費用）
  employeeCount: number; // 従業員数
}

// 自動計算項目
export interface CalculatedMetrics {
  totalVariableCost: number; // 変動費合計
  marginalProfit: number; // 限界利益
  marginalProfitRate: number; // 限界利益率（%）
  totalFixedCost: number; // 固定費合計
  operatingProfit: number; // 営業利益
  ordinaryProfit: number; // 経常利益
  laborShareRate: number; // 労働分配率（%）
  salesPerEmployee: number; // 1人当たり売上高
  marginalProfitPerEmployee: number; // 1人当たり加工高（年間）
  monthlyMarginalProfitPerEmployee: number; // 1人当たり加工高（月間）
  ordinaryProfitPerEmployee: number; // 1人当たり経常利益
}

// 構成比
export interface CompositionRatios {
  materialCostRate: number;
  outsourcingCostRate: number;
  merchandisePurchaseRate: number;
  otherVariableCostRate: number;
  totalVariableCostRate: number;
  marginalProfitRate: number;
  laborCostRate: number;
  depreciationRate: number;
  otherExpensesRate: number;
  totalFixedCostRate: number;
  operatingProfitRate: number;
  nonOperatingIncomeRate: number;
  ordinaryProfitRate: number;
}

// ウォーターフォール要因
export interface WaterfallFactors {
  salesContribution: number; // ①売上高貢献
  marginalRateContribution: number; // ②加工高比率貢献
  fixedCostContribution: number; // ③固定費貢献
  nonOperatingContribution: number; // ④営業外損益貢献
}

// シナリオデータ
export interface Scenario {
  id: string;
  periodId: string;
  label: string; // シナリオ名
  salesChangeRate: number; // 売上高変化率（%）
  variableCostRateChange: number; // 変動費率変化（%pt）
  laborCostChangeRate: number; // 人件費変化率（%）
  fixedCostChangeRate: number; // その他固定費変化率（%）
  employeeCount: number; // 従業員数
}

// シナリオ計算結果
export interface ScenarioResult {
  scenario: Scenario;
  sales: number;
  totalVariableCost: number;
  materialCost: number;
  outsourcingCost: number;
  merchandisePurchase: number;
  otherVariableCost: number;
  marginalProfit: number;
  marginalProfitRate: number;
  laborCost: number;
  depreciation: number;
  otherExpenses: number;
  totalFixedCost: number;
  operatingProfit: number;
  nonOperatingIncome: number;
  ordinaryProfit: number;
  laborShareRate: number;
  salesPerEmployee: number;
  marginalProfitPerEmployee: number;
  monthlyMarginalProfitPerEmployee: number;
  ordinaryProfitPerEmployee: number;
  // 実績比増減率
  salesChangeFromActual: number;
  ordinaryProfitChangeFromActual: number;
}

// PDF解析結果
export interface ExtractedPeriodData {
  label: string;
  sales: number | null;
  materialCost: number | null;
  outsourcingCost: number | null;
  merchandisePurchase: number | null;
  otherVariableCost: number | null;
  laborCost: number | null;
  depreciation: number | null;
  otherExpenses: number | null;
  nonOperatingIncome: number | null;
  employeeCount: number | null;
  ordinaryProfitFromPdf: number | null; // 決算書記載の経常利益（整合性チェック用）
  confidence: Record<string, "high" | "medium" | "low">;
  breakdown: Record<string, string>; // 各項目の計算根拠（例: "製造労務費 25,000 + 役員報酬 10,000 = 35,000"）
  notes: string[];
}

// アプリ全体の状態
export interface AppState {
  company: Company;
  periods: PeriodData[];
  scenarios: Scenario[];
  currentStep: number;
  selectedPeriodIndex: number;
}
