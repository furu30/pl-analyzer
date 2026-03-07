import { v4 as uuidv4 } from "uuid";
import { Company, PeriodData, Scenario } from "./types";

/**
 * デモデータ: サンプル製造株式会社（3期分）
 *
 * 中小製造業を想定したリアルなPLデータ。
 * 売上5.2億→5.8億→6.5億と成長し、利益率も改善するストーリー。
 * 金額はすべて千円単位。
 */
export function generateDemoData(): {
  company: Company;
  periods: PeriodData[];
  scenarios: Scenario[];
} {
  const companyId = uuidv4();
  const now = new Date().toISOString();

  const company: Company = {
    id: companyId,
    name: "サンプル製造株式会社",
    createdAt: now,
    updatedAt: now,
  };

  const period1Id = uuidv4();
  const period2Id = uuidv4();
  const period3Id = uuidv4();

  const periods: PeriodData[] = [
    {
      id: period1Id,
      companyId,
      label: "R4年3月期",
      sales: 520000,
      materialCost: 130000,
      outsourcingCost: 52000,
      merchandisePurchase: 15000,
      otherVariableCost: 26000,
      laborCost: 156000,
      depreciation: 20800,
      otherExpenses: 104000,
      nonOperatingIncome: -5200,
      employeeCount: 45,
    },
    {
      id: period2Id,
      companyId,
      label: "R5年3月期",
      sales: 580000,
      materialCost: 145000,
      outsourcingCost: 61000,
      merchandisePurchase: 17400,
      otherVariableCost: 29000,
      laborCost: 162000,
      depreciation: 22000,
      otherExpenses: 110000,
      nonOperatingIncome: -4600,
      employeeCount: 48,
    },
    {
      id: period3Id,
      companyId,
      label: "R6年3月期",
      sales: 650000,
      materialCost: 162500,
      outsourcingCost: 68000,
      merchandisePurchase: 19500,
      otherVariableCost: 32500,
      laborCost: 175000,
      depreciation: 24000,
      otherExpenses: 120000,
      nonOperatingIncome: -3800,
      employeeCount: 52,
    },
  ];

  const scenarios: Scenario[] = [
    {
      // 現状維持+微成長: 売上微増、コスト横ばい
      id: uuidv4(),
      periodId: period3Id,
      label: "試算① 現状維持",
      salesChangeRate: 3,
      variableCostRateChange: 0,
      laborCostChangeRate: 2,
      fixedCostChangeRate: 1,
      employeeCount: 53,
    },
    {
      // 売上拡大路線: 営業強化で売上10%増、変動費率改善
      id: uuidv4(),
      periodId: period3Id,
      label: "試算② 売上拡大",
      salesChangeRate: 10,
      variableCostRateChange: -1,
      laborCostChangeRate: 3,
      fixedCostChangeRate: 2,
      employeeCount: 55,
    },
    {
      // コスト削減重視: 売上維持、変動費率と固定費を削減
      id: uuidv4(),
      periodId: period3Id,
      label: "試算③ コスト削減",
      salesChangeRate: 0,
      variableCostRateChange: -2,
      laborCostChangeRate: -1,
      fixedCostChangeRate: -3,
      employeeCount: 50,
    },
    {
      // 積極投資: 増員+設備投資で売上15%増、固定費も増加
      id: uuidv4(),
      periodId: period3Id,
      label: "試算④ 積極投資",
      salesChangeRate: 15,
      variableCostRateChange: 0,
      laborCostChangeRate: 8,
      fixedCostChangeRate: 5,
      employeeCount: 60,
    },
    {
      // 悲観シナリオ: 景気悪化で売上減、コスト上昇
      id: uuidv4(),
      periodId: period3Id,
      label: "試算⑤ 悲観",
      salesChangeRate: -5,
      variableCostRateChange: 2,
      laborCostChangeRate: 1,
      fixedCostChangeRate: 3,
      employeeCount: 52,
    },
  ];

  return { company, periods, scenarios };
}
