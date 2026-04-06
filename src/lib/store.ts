import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Company, PeriodData, Scenario } from "./types";

const STORAGE_KEY = "plAnalyzerData";
const SLOTS_INDEX_KEY = "plAnalyzerSlots";
const ACTIVE_SLOT_KEY = "plAnalyzerActiveSlot";

// ── スロット管理（複数企業データの保存・読込） ──

export interface SavedSlot {
  id: string;
  name: string;
  companyName: string;
  savedAt: string;
}

/** 保存済みスロット一覧を取得 */
export function getSavedSlots(): SavedSlot[] {
  try {
    const raw = localStorage.getItem(SLOTS_INDEX_KEY);
    if (!raw) return [];
    const slots = JSON.parse(raw) as SavedSlot[];
    // 旧形式（companyNameなし）への互換
    return slots.map((s) => ({ ...s, companyName: s.companyName || s.name }));
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
  const existing = slots.find((s) => s.id === name || s.name === name);
  const id = existing?.id || uuidv4();
  const savedAt = new Date().toISOString();
  const companyName = data.company.name || "未設定";

  localStorage.setItem(`plAnalyzerData_${id}`, JSON.stringify(data));

  if (existing) {
    existing.savedAt = savedAt;
    existing.companyName = companyName;
  } else {
    slots.push({ id, name, companyName, savedAt });
  }
  localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(slots));

  return id;
}

/** スロットIDで保存（上書き専用） */
export function saveSlotById(
  id: string,
  data: { company: Company; periods: PeriodData[]; scenarios: Scenario[] }
): void {
  const slots = getSavedSlots();
  const existing = slots.find((s) => s.id === id);
  if (existing) {
    existing.savedAt = new Date().toISOString();
    existing.companyName = data.company.name || "未設定";
    localStorage.setItem(`plAnalyzerData_${id}`, JSON.stringify(data));
    localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(slots));
  }
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

/** スロット名を変更 */
export function renameSlot(id: string, newName: string): void {
  const slots = getSavedSlots();
  const slot = slots.find((s) => s.id === id);
  if (slot) {
    slot.name = newName;
    localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(slots));
  }
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
  activeSlotId: string | null;

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

  // 複数企業管理
  switchToSlot: (slotId: string) => void;
  saveCurrentAsSlot: (name?: string) => string;
  createNewCompany: () => void;
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
  activeSlotId: null,

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
      // アクティブスロットIDも保存
      if (state.activeSlotId) {
        localStorage.setItem(ACTIVE_SLOT_KEY, state.activeSlotId);
      }
    } catch {
      toast.error("データの保存に失敗しました", {
        description: "ブラウザのストレージ容量が不足している可能性があります。",
      });
    }
  },

  loadFromLocalStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const activeSlotId = localStorage.getItem(ACTIVE_SLOT_KEY) || null;

      // マイグレーション: 既存データがあるがスロットが空の場合、初回スロットを自動作成
      const slots = getSavedSlots();
      if (slots.length === 0 && data.company?.name) {
        const name = data.company.name || "初期データ";
        const newSlotId = saveSlot(name, data);
        set({
          company: data.company,
          periods: data.periods,
          scenarios: data.scenarios || [createDefaultScenario("", 0)],
          activeSlotId: newSlotId,
        });
        localStorage.setItem(ACTIVE_SLOT_KEY, newSlotId);
        return true;
      }

      set({
        company: data.company,
        periods: data.periods,
        scenarios: data.scenarios || [createDefaultScenario("", 0)],
        activeSlotId,
      });
      return true;
    } catch {
      toast.error("保存データの読み込みに失敗しました");
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
      activeSlotId: null,
    });
    localStorage.removeItem(ACTIVE_SLOT_KEY);
  },

  // ── 複数企業管理 ──

  switchToSlot: (slotId) => {
    const state = get();
    // 現在のデータをアクティブスロットに自動保存
    if (state.activeSlotId) {
      saveSlotById(state.activeSlotId, {
        company: state.company,
        periods: state.periods,
        scenarios: state.scenarios,
      });
    }

    // 対象スロットをロード
    const data = loadSlot(slotId);
    if (!data) {
      toast.error("企業データの読み込みに失敗しました");
      return;
    }

    set({
      company: data.company,
      periods: data.periods,
      scenarios: data.scenarios || [createDefaultScenario("", 0)],
      activeSlotId: slotId,
      currentStep: 1,
      selectedPeriodIndex: 0,
    });

    // 作業データとアクティブスロットIDを更新
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(ACTIVE_SLOT_KEY, slotId);
    } catch {
      toast.error("データの保存に失敗しました");
    }
  },

  saveCurrentAsSlot: (name?) => {
    const state = get();
    const slotName = name || state.company.name || "無題の企業";
    const data = {
      company: state.company,
      periods: state.periods,
      scenarios: state.scenarios,
    };

    // 既存スロットがあればIDで上書き、なければ新規作成
    if (state.activeSlotId) {
      saveSlotById(state.activeSlotId, data);
      // スロット名も更新
      const slots = getSavedSlots();
      const slot = slots.find((s) => s.id === state.activeSlotId);
      if (slot) {
        slot.name = slotName;
        slot.companyName = state.company.name || "未設定";
        slot.savedAt = new Date().toISOString();
        localStorage.setItem(SLOTS_INDEX_KEY, JSON.stringify(slots));
      }
      return state.activeSlotId;
    }

    const newId = saveSlot(slotName, data);
    set({ activeSlotId: newId });
    localStorage.setItem(ACTIVE_SLOT_KEY, newId);
    return newId;
  },

  createNewCompany: () => {
    const state = get();
    // 現在のデータをスロットに保存
    if (state.activeSlotId) {
      saveSlotById(state.activeSlotId, {
        company: state.company,
        periods: state.periods,
        scenarios: state.scenarios,
      });
    } else if (state.company.name) {
      // スロット未割当だが企業名がある場合、新規スロット作成
      const newId = saveSlot(state.company.name, {
        company: state.company,
        periods: state.periods,
        scenarios: state.scenarios,
      });
      // 保存はしたが、これからリセットするので activeSlotId には設定しない
      void newId;
    }

    // 空データにリセット
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
      activeSlotId: null,
    });
    localStorage.removeItem(ACTIVE_SLOT_KEY);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        company: newCompany,
        periods: [
          createEmptyPeriod(newCompany.id, "第1期"),
          createEmptyPeriod(newCompany.id, "第2期"),
          createEmptyPeriod(newCompany.id, "第3期"),
        ],
        scenarios: [createDefaultScenario("", 0)],
      }));
    } catch {
      // ignore
    }
  },
}));
