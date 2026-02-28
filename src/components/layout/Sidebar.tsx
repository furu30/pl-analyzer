"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileUp,
  ClipboardList,
  BarChart3,
  TrendingUp,
  Calculator,
  Save,
  FolderOpen,
  RotateCcw,
} from "lucide-react";
import { useRef, useCallback } from "react";

const steps = [
  {
    step: 1,
    label: "データ入力",
    path: "/upload",
    icon: FileUp,
  },
  {
    step: 2,
    label: "実績データ入力",
    path: "/input",
    icon: ClipboardList,
  },
  {
    step: 3,
    label: "利益バランス図表",
    path: "/balance-chart",
    icon: BarChart3,
  },
  {
    step: 4,
    label: "Growth Chart",
    path: "/growth-chart",
    icon: TrendingUp,
  },
  {
    step: 5,
    label: "損益シミュレーション",
    path: "/simulation",
    icon: Calculator,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const {
    company,
    exportToJSON,
    importFromJSON,
    saveToLocalStorage,
    resetData,
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── データ保存（PCにJSONファイルを直接ダウンロード） ──
  const handleSaveToFile = useCallback(() => {
    const name = (company.name || "無題").trim();
    const json = exportToJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    // ブラウザの作業データとしても保存（次回起動時に復元用）
    saveToLocalStorage();
  }, [company.name, exportToJSON, saveToLocalStorage]);

  // ── データ読込（PCからJSONファイルを選択） ──
  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      const success = importFromJSON(json);
      if (success) {
        // ブラウザの作業データとしても保存
        saveToLocalStorage();
        alert(`「${file.name}」を読み込みました`);
      } else {
        alert("データの読み込みに失敗しました。ファイル形式を確認してください。");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── リセット ──
  const handleReset = () => {
    if (confirm("データをリセットしますか？この操作は取り消せません。")) {
      resetData();
    }
  };

  return (
    <>
      <aside className="w-64 bg-[#1F4E79] text-white flex flex-col h-full shrink-0">
        <div className="p-4">
          <h1 className="text-xl font-bold tracking-wide">PL Analyzer</h1>
          <p className="text-xs text-blue-200 mt-1">製造業 損益分析</p>
        </div>

        <Separator className="bg-blue-400/30" />

        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-2">
            {steps.map(({ step, label, path, icon: Icon }) => {
              const isActive = pathname === path;
              return (
                <li key={step}>
                  <Link
                    href={path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-white/20 text-white font-semibold"
                        : "text-blue-100 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-xs font-bold shrink-0">
                      {step}
                    </span>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <Separator className="bg-blue-400/30" />

        <div className="p-3 space-y-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-blue-100 hover:text-white hover:bg-white/10"
            onClick={handleSaveToFile}
          >
            <Save className="w-4 h-4 mr-2" />
            データ保存
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-blue-100 hover:text-white hover:bg-white/10"
            onClick={handleLoadClick}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            データ読込
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
          <Separator className="bg-blue-400/30" />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-red-300 hover:text-red-200 hover:bg-white/10"
            onClick={handleReset}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            データリセット
          </Button>
        </div>
      </aside>

    </>
  );
}
