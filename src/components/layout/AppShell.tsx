"use client";

import { useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";
import { useAppStore } from "@/lib/store";
import { useSidebarStore } from "@/lib/sidebar-store";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const loadFromLocalStorage = useAppStore((s) => s.loadFromLocalStorage);
  const { isOpen, close } = useSidebarStore();

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  return (
    <div className="app-shell relative flex h-screen overflow-hidden">
      {/* モバイルオーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={close}
        />
      )}
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="app-main flex-1 overflow-auto">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
