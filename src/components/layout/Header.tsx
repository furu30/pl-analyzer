"use client";

import { useAppStore } from "@/lib/store";
import { useSidebarStore } from "@/lib/sidebar-store";
import { Input } from "@/components/ui/input";
import { Building2, Menu } from "lucide-react";

export default function Header() {
  const { company, setCompanyName } = useAppStore();
  const toggle = useSidebarStore((s) => s.toggle);

  return (
    <header className="app-header h-14 border-b bg-white flex items-center px-3 md:px-6 shrink-0">
      <button
        onClick={toggle}
        className="md:hidden p-2 -ml-1 mr-2 rounded-md hover:bg-gray-100"
        aria-label="メニューを開く"
      >
        <Menu className="w-5 h-5 text-[#1F4E79]" />
      </button>
      <div className="flex items-center gap-3 flex-1">
        <Building2 className="w-5 h-5 text-[#1F4E79] hidden md:block" />
        <Input
          value={company.name}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="企業名を入力..."
          className="max-w-[180px] md:max-w-xs border-none shadow-none text-base font-semibold placeholder:text-muted-foreground/50 focus-visible:ring-0 p-0 h-auto"
        />
      </div>
      <div className="text-xs text-muted-foreground">
        単位: 千円
      </div>
    </header>
  );
}
