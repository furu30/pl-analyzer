const STORAGE_KEY = "plAnalyzerVariableCostItems";

const DEFAULT_ITEMS = [
  "消耗品費",
  "荷造運賃",
  "動力費",
  "燃料費",
];

export function getVariableCostItems(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_ITEMS];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_ITEMS];
  } catch {
    return [...DEFAULT_ITEMS];
  }
}

export function setVariableCostItems(items: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    console.error("変動費項目の保存に失敗しました");
  }
}
