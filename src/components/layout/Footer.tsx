"use client";

import { useAppStore } from "@/lib/store";
import { calculateMetrics } from "@/lib/calculations";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function Footer() {
  const { periods } = useAppStore();

  const validations = periods.map((period) => {
    if (period.sales === 0) return { label: period.label, status: "empty" as const };
    const metrics = calculateMetrics(period);
    const opCheck = Math.abs(
      metrics.operatingProfit - (metrics.marginalProfit - metrics.totalFixedCost)
    );
    const ordCheck = Math.abs(
      metrics.ordinaryProfit - (metrics.operatingProfit + period.nonOperatingIncome)
    );
    const isValid = opCheck < 0.01 && ordCheck < 0.01;
    return { label: period.label, status: isValid ? ("ok" as const) : ("ng" as const) };
  });

  const hasData = validations.some((v) => v.status !== "empty");

  return (
    <footer className="h-10 border-t bg-gray-50 flex items-center px-6 text-xs shrink-0">
      <span className="text-muted-foreground mr-3">検算:</span>
      {!hasData ? (
        <span className="text-muted-foreground">データ未入力</span>
      ) : (
        <div className="flex items-center gap-4">
          {validations
            .filter((v) => v.status !== "empty")
            .map((v) => (
              <span key={v.label} className="flex items-center gap-1">
                {v.status === "ok" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                )}
                <span
                  className={
                    v.status === "ok" ? "text-green-700" : "text-red-700"
                  }
                >
                  {v.label}: {v.status === "ok" ? "OK" : "NG"}
                </span>
              </span>
            ))}
        </div>
      )}
    </footer>
  );
}
