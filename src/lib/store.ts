import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { Company, PeriodData, Scenario } from "./types";

const STORAGE_KEY = "plAnalyzerData";
const SLOTS_INDEX_KEY = "plAnalyzerSlots";

// ── スロット管理（複数データセットの保存・読込） ──

export interface SavedSlot {
  id: string;
  name: string;
  savedAt: string;
}

/** 保存済みスロット一覧を取得 */
export function getSavedSlots(): SavedSlot[] {
  try {
    const raw = localStorage.getItem(SLOTS_INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedSlot[];
  } catch {
    return [];
  }
}

/** 現在のデータを名前付きスロットに保存。スロットidを返す */
export function saveSlot(
  name: string,
  data: { company: Company; periods: PeriodData[]; scenarios: Scenario[] }
): string {
  const slots = getSavedSlots();
  // 同名スロットがあれば上書き
  const existing = slots.find((s) => s.name === name);
  const id = existing?.id || uuidv4();
  const savedAt = new Date().toISOString();

  // データ本体を保存
  localStorage.setItem(`plAnalyzerData_${id}`, JSON.stringify(data));

  // インデックスを更新
  if (existing) {
    existing.savedAt = savedAt;
  } else {
    slots.push({ id, name, savedAt });
  }
  localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(slots));

  return id;
}

/** スロットからデータを読み込む */
export function loadSlot(id: string): { company: Company; periods: PeriodData[]; scenarios: Scenario[] } | null {
  try {
    const raw = localStorage.getItem(`plAnalyzerData_${id}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** スロットを削除 */
export function deleteSlot(id: string): void {
  const slots = getSavedSlots().filter((s) => s.id !== id);
  localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(slots));
  localStorage.removeItem(`plAnalyzerData_${id}`);
}

function createEmptyPeriod(companyId: string, label: string): PeriodData {
  return {
    id: uuidv4(),
    companyId,
    label,
    sales: 0,
    materialCost: 0,
    outsourcingCost: 0,
    merchandisePurchase: 0,
    otherVariableCost: 0,
    laborCost: 0,
    depreciation: 0,
    otherExpenses: 0,
    nonOperatingIncome: 0,
    employeeCount: 1,
  };
}

function createDefaultScenario(periodId: string, index: number): Scenario {
  return {
    id: uuidv4(),
    periodId,
    label: `試算${["①", "②", "③", "④", "⑤"][index]}`,
    salesChangeRate: 0,
    variableCostRateChange: 0,
    laborCostChangeRate: 0,
    fixedCostChangeRate: 0,
    employeeCount: 1,
  };
}

interface AppStore {
  company: Company;
  periods: PeriodData[];
  scenarios: Scenario[];
  currentStep: number;
  selectedPeriodIndex: number;

  // 企業
  setCompanyName: (name: string) => void;

  // 期別データ
  addPeriod: (label: string) => void;
  removePeriod: (index: number) => void;
  updatePeriod: (index: number, data: Partial<PeriodData>) => void;
  setSelectedPeriodIndex: (index: number) => void;

  // シナリオ
  addScenario: () => void;
  removeScenario: (index: number) => void;
  updateScenario: (index: number, data: Partial<Scenario>) => void;

  // ナビゲーション
  setCurrentStep: (step: number) => void;

  // データ管理
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => boolean;
  exportToJSON: () => string;
  importFromJSON: (json: string) => boolean;
  resetData: () => void;
}

const defaultCompany: Company = {
  id: uuidv4(),
  name: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const useAppStore = create<AppStore>((set, get) => ({
  company: { ...defaultCompany },
  periods: [
    createEmptyPeriod(defaultCompany.id, "第1期"),
    createEmptyPeriod(defaultCompany.id, "第2期"),
    createEmptyPeriod(defaultCompany.id, "第3期"),
  ],
  scenarios: [createDefaultScenario("", 0)],
  currentStep: 1,
  selectedPeriodIndex: 0,

  setCompanyName: (name) =>
    set((state) => ({
      company: { ...state.company, name, updatedAt: new Date().toISOString() },
    })),

  addPeriod: (label) =>
    set((state) => {
      if (state.periods.length >= 5) return state;
      return {
        periods: [
          ...state.periods,
          createEmptyPeriod(state.company.id, label),
        ],
      };
    }),

  removePeriod: (index) =>
    set((state) => {
      if (state.periods.length <= 2) return state;
      const newPeriods = state.periods.filter((_, i) => i !== index);
      const newSelectedIndex = Math.min(
        state.selectedPeriodIndex,
        newPeriods.length - 1
      );
      return { periods: newPeriods, selectedPeriodIndex: newSelectedIndex };
    }),

  updatePeriod: (index, data) =>
    set((state) => {
      const newPeriods = [...state.periods];
      newPeriods[index] = { ...newPeriods[index], ...data };
      return { periods: newPeriods };
    }),

  setSelectedPeriodIndex: (index) => set({ selectedPeriodIndex: index }),

  addScenario: () =>
    set((state) => {
      if (state.scenarios.length >= 5) return state;
      const basePeriod = state.periods[state.periods.length - 1];
      const newScenario = createDefaultScenario(
        basePeriod?.id || "",
        state.scenarios.length
      );
      newScenario.employeeCount = basePeriod?.employeeCount || 1;
      return { scenarios: [...state.scenarios, newScenario] };
    }),

  removeScenario: (index) =>
    set((state) => {
      if (state.scenarios.length <= 1) return state;
      return { scenarios: state.scenarios.filter((_, i) => i !== index) };
    }),

  updateScenario: (index, data) =>
    set((state) => {
      const newScenarios = [...state.scenarios];
      newScenarios[index] = { ...newScenarios[index], ...data };
      return { scenarios: newScenarios };
    }),

  setCurrentStep: (step) => set({ currentStep: step }),

  saveToLocalStorage: () => {
    const state = get();
    const data = {
      company: state.company,
      periods: state.periods,
      scenarios: state.scenarios,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      console.error("ローカルストレージへの保存に失敗しました");
    }
  },

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      set({
        company: data.company,
        periods: data.periods,
        scenarios: data.scenarios || [createDefaultScenario("", 0)],
      });
      return true;
    } catch {
      return false;
    }
  },

  exportToJSON: () => {
    const state = get();
    return JSON.stringify(
      {
        company: state.company,
        periods: state.periods,
        scenarios: state.scenarios,
      },
      null,
      2
    );
  },

  importFromJSON: (json) => {
    try {
      const data = JSON.parse(json);
      if (!data.company || !data.periods) return false;
      set({
        company: data.company,
        periods: data.periods,
        scenarios: data.scenarios || [createDefaultScenario("", 0)],
      });
      return true;
    } catch {
      return false;
    }
  },

  resetData: () => {
    const newCompany: Company = {
      id: uuidv4(),
      name: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({
      company: newCompany,
      periods: [
        createEmptyPeriod(newCompany.id, "第1期"),
        createEmptyPeriod(newCompany.id, "第2期"),
        createEmptyPeriod(newCompany.id, "第3期"),
      ],
      scenarios: [createDefaultScenario("", 0)],
      currentStep: 1,
      selectedPeriodIndex: 0,
    });
  },
}));
