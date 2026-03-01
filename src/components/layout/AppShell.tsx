"use client";

import { useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";
import { useAppStore } from "@/lib/store";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const loadFromLocalStorage = useAppStore((s) => s.loadFromLocalStorage);

  useEffect(() => {
    loadFromLocalStorage();
  }, [loadFromLocalStorage]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
