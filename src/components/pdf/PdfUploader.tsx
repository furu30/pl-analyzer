"use client";

import { useCallback, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, BarChart3, FileSpreadsheet } from "lucide-react";

interface PdfUploaderProps {
  onFileSelected: (file: File) => void;
  onExcelConvert?: (file: File) => void;
  isProcessing: boolean;
}

export default function PdfUploader({
  onFileSelected,
  onExcelConvert,
  isProcessing,
}: PdfUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file.type !== "application/pdf") {
      alert("PDFファイルを選択してください");
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleAnalyze = () => {
    if (selectedFile) onFileSelected(selectedFile);
  };

  const handleExcel = () => {
    if (selectedFile && onExcelConvert) onExcelConvert(selectedFile);
  };

  const handleClear = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragOver
            ? "border-primary bg-primary/5"
            : selectedFile
              ? "border-green-500 bg-green-50"
              : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-8 h-8 text-green-600" />
            <div className="text-left">
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="ml-4"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              決算書PDFをドラッグ＆ドロップ、またはクリックして選択
            </p>
            <p className="text-xs text-muted-foreground/75">
              対応形式: PDF（損益計算書、決算報告書など）
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {selectedFile && (
        <div className="flex gap-2">
          <Button
            onClick={handleAnalyze}
            disabled={isProcessing}
            className="flex-1"
          >
            <BarChart3 className="w-4 h-4 mr-1.5" />
            {isProcessing ? "処理中..." : "PDFを解析する"}
          </Button>
          {onExcelConvert && (
            <Button
              variant="outline"
              onClick={handleExcel}
              disabled={isProcessing}
              className="flex-1"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              Excel変換する
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
