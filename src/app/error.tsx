"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
      <AlertCircle className="w-12 h-12 text-red-500" />
      <h2 className="text-xl font-semibold">エラーが発生しました</h2>
      <p className="text-muted-foreground text-center max-w-md">
        予期しないエラーが発生しました。再度お試しいただくか、ページを再読み込みしてください。
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>再試行</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          ページを再読み込み
        </Button>
      </div>
    </div>
  );
}
