"use client";

import { useAppStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Building2 } from "lucide-react";

export default function Header() {
  const { company, setCompanyName } = useAppStore();

  return (
    <header className="h-14 border-b bg-white flex items-center px-6 shrink-0">
      <div className="flex items-center gap-3 flex-1">
        <Building2 className="w-5 h-5 text-[#1F4E79]" />
        <Input
          value={company.name}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="企業名を入力..."
          className="max-w-xs border-none shadow-none text-base font-semibold placeholder:text-muted-foreground/50 focus-visible:ring-0 p-0 h-auto"
        />
      </div>
      <div className="text-xs text-muted-foreground">
        単位: 千円
      </div>
    </header>
  );
}
