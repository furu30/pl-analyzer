"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  type AiProvider,
  type AiConfig,
  getAiConfig,
  setAiConfig,
  providerLabels,
} from "@/lib/api-key-storage";
import { Eye, EyeOff, Key } from "lucide-react";

const providerInfo: Record<
  AiProvider,
  { placeholder: string; description: string }
> = {
  claude: {
    placeholder: "sk-ant-...",
    description: "Anthropic Consoleから取得",
  },
  gemini: {
    placeholder: "AIza...",
    description: "Google AI Studioから取得",
  },
  openai: {
    placeholder: "sk-...",
    description: "OpenAI Platformから取得",
  },
};

const providers: AiProvider[] = ["claude", "gemini", "openai"];

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onKeySaved: () => void;
}

export default function ApiKeyDialog({
  open,
  onOpenChange,
  onKeySaved,
}: ApiKeyDialogProps) {
  const [config, setConfig] = useState<AiConfig>({
    provider: "claude",
    keys: { claude: "", gemini: "", openai: "" },
  });
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) {
      setConfig(getAiConfig());
      setShowKey(false);
    }
  }, [open]);

  const activeProvider = config.provider;
  const activeKey = config.keys[activeProvider];
  const info = providerInfo[activeProvider];

  const handleProviderChange = (provider: AiProvider) => {
    setConfig((prev) => ({ ...prev, provider }));
    setShowKey(false);
  };

  const handleKeyChange = (value: string) => {
    setConfig((prev) => ({
      ...prev,
      keys: { ...prev.keys, [activeProvider]: value },
    }));
  };

  const handleSave = () => {
    setAiConfig(config);
    onKeySaved();
    onOpenChange(false);
  };

  const canSave = config.keys[config.provider].trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            AI APIキー設定
          </DialogTitle>
          <DialogDescription>
            PDF解析に使用するAIサービスを選択し、APIキーを入力してください。キーはブラウザに保存されます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* プロバイダー選択タブ */}
          <div className="flex rounded-lg border bg-muted p-1 gap-1">
            {providers.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleProviderChange(p)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeProvider === p
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {providerLabels[p]}
                {config.keys[p] && (
                  <span className="ml-1 text-green-500 text-xs">●</span>
                )}
              </button>
            ))}
          </div>

          {/* APIキー入力 */}
          <div className="space-y-2">
            <Label>{providerLabels[activeProvider]} APIキー</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={activeKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder={info.placeholder}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{info.description}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
