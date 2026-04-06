import { toast } from "sonner";

export type AiProvider = "claude" | "gemini" | "openai";

export interface AiConfig {
  provider: AiProvider;
  keys: Record<AiProvider, string>;
}

const STORAGE_KEY = "plAnalyzerAiConfig";

const defaultConfig: AiConfig = {
  provider: "claude",
  keys: { claude: "", gemini: "", openai: "" },
};

export function getAiConfig(): AiConfig {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // 旧形式からのマイグレーション
      const oldKey = sessionStorage.getItem("plAnalyzerClaudeApiKey");
      if (oldKey) {
        const config: AiConfig = {
          provider: "claude",
          keys: { claude: oldKey, gemini: "", openai: "" },
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        sessionStorage.removeItem("plAnalyzerClaudeApiKey");
        return config;
      }
      return { ...defaultConfig };
    }
    const parsed = JSON.parse(raw) as AiConfig;
    return {
      provider: parsed.provider || "claude",
      keys: {
        claude: parsed.keys?.claude || "",
        gemini: parsed.keys?.gemini || "",
        openai: parsed.keys?.openai || "",
      },
    };
  } catch {
    return { ...defaultConfig };
  }
}

export function setAiConfig(config: AiConfig): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    toast.error("API設定の保存に失敗しました");
  }
}

export function getActiveApiKey(): { provider: AiProvider; apiKey: string } | null {
  const config = getAiConfig();
  const apiKey = config.keys[config.provider];
  if (!apiKey) return null;
  return { provider: config.provider, apiKey };
}

export const providerLabels: Record<AiProvider, string> = {
  claude: "Claude",
  gemini: "Gemini",
  openai: "ChatGPT",
};
