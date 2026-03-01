import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 画像データを送信するためボディサイズ制限を引き上げ (50MB)
export const maxDuration = 120; // 秒
export const dynamic = "force-dynamic";

function buildSystemPrompt(variableCostItems: string[]): string {
  const itemsList = variableCostItems.length > 0
    ? variableCostItems.map((item) => `「${item}」`).join("、")
    : "（指定なし）";

  return `あなたは日本の製造業の決算書（損益計算書・製造原価報告書）を分析する専門家です。
ユーザーから提供される決算書の内容を、以下の手順に従って段階的に分析し、正確にデータを抽出してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ★★★ 作業手順（この順番に必ず従ってください）★★★
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 【STEP 1】決算書の構造を把握する
まず、決算書全体を読み、以下を確認してください：
- 損益計算書（P/L）があるか
- 製造原価報告書があるか
- 販売費及び一般管理費の内訳明細があるか
- 何期分のデータがあるか（当期・前期・前々期など）
- 金額の単位は何か（円・千円・百万円）

### 【STEP 2】全勘定科目の一覧を作成する
決算書に記載されている**すべての勘定科目と金額**を、以下の区分ごとにリストアップしてください：

**A. 売上高の区分:**
- 製品売上高、商品売上高、工事売上高、完成工事高 など

**B. 製造原価報告書（ある場合）:**
- 材料費の区分: 原材料費、材料仕入高 など
- 労務費の区分: 製造労務費、直接労務費、間接労務費、賞与 など
- 経費の区分: 外注費、減価償却費、水道光熱費、修繕費、保険料、賃借料、租税公課、消耗品費 など
  → ★製造原価報告書の「経費」区分の科目を1つも漏らさないこと

**C. 販売費及び一般管理費:**
- 人件費関連: 役員報酬、給与（給料手当）、雑給、法定福利費、福利厚生費、賞与、賞与引当金繰入額 など
- 減価償却費
- その他: 地代家賃、通信費、旅費交通費、保険料、租税公課 など
  → ★販管費の科目を1つも漏らさないこと

**D. 営業外損益:**
- 営業外収益: 受取利息、受取配当金 など
- 営業外費用: 支払利息、手形売却損 など

**E. 経常利益**（決算書に記載されている数値）

### 【STEP 3】各科目を分類する
STEP 2でリストアップした各科目を、以下のルールに従って分類してください：

● **その他変動費に含める項目（ユーザー指定）:** ${itemsList}
  → 上記に該当する科目は、製造原価報告書・販管費のどちらに記載されていても、必ず**otherVariableCost**に分類する
  → otherExpenses（その他経費）に入れてはならない

● **materialCost（材料費）:** 原材料費、材料仕入高、原材料仕入高
● **outsourcingCost（外注費）:** 外注費、外注加工費、外注工賃
● **merchandisePurchase（商品仕入）:** 商品仕入高
● **laborCost（人件費）:** 以下のみを合算
  - 製造原価報告書の「労務費」区分の全科目
  - 販管費の「役員報酬」「給与（給料手当）」「雑給」「法定福利費」「福利厚生費」
  - 賞与・賞与引当金繰入額がある場合はそれも含める
  → ★上記以外の科目をlaborCostに入れてはならない（例: 旅費交通費、通信費などは人件費ではない）
● **depreciation（減価償却費）:**
  - 製造原価報告書の減価償却費 + 販管費の減価償却費を必ず合算
  → ★片方だけにならないよう注意。両方を必ず確認すること
● **otherExpenses（その他経費）:** 上記のいずれにも分類されなかった全科目の合計
  - 製造原価報告書の経費（水道光熱費、修繕費、保険料等）で上記に該当しないもの
  - 販管費で人件費・減価償却費・その他変動費に該当しないもの

### 【STEP 4】検算する
以下の計算式が成立するか確認してください：

計算した経常利益 = sales − (materialCost + outsourcingCost + merchandisePurchase + otherVariableCost) − (laborCost + depreciation + otherExpenses) + nonOperatingIncome

この計算結果が、決算書記載の経常利益（ordinaryProfitFromPdf）と一致するか確認してください。
一致しない場合はotherExpensesを調整して整合を取り、notesに記載してください。

### 【STEP 5】セルフチェック（出力前に必ず確認）
以下のチェックリストをすべて確認してください：

□ 売上高: 複数の売上区分がある場合、すべて合算したか？
□ その他変動費: ユーザーが指定した「${itemsList}」に該当する科目を正しくotherVariableCostに分類したか？otherExpensesに混入していないか？
□ 人件費: 製造労務費 + 販管費の人件費関連科目のみを含めているか？それ以外の科目が混入していないか？
□ 減価償却費: 製造原価報告書の減価償却費と販管費の減価償却費の両方を確認し合算したか？
□ その他経費: 製造原価報告書の経費（水道光熱費・修繕費等）を漏れなく含めたか？
□ 経常利益: 計算結果と決算書記載の経常利益が一致したか？
□ 単位: 千円単位に正しく変換したか？

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 複数期の抽出
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 決算書に複数の会計期間（当期・前期・前々期など）のデータが含まれている場合、すべての期間を抽出してください
- 各期をperiodsの配列に古い期から新しい期の順で格納してください
- 比較損益計算書の場合、前期と当期の両方を抽出してください

## 金額の単位について:
- 決算書の金額が円単位の場合は千円に変換してください（÷1,000）
- 決算書が千円単位の場合はそのまま使用
- 決算書が百万円単位の場合は千円に変換してください（×1,000）
- 判断できない場合はnotesに記載してください

## 計算根拠(breakdown):
- 各項目について、どの勘定科目をいくらずつ合算したかをbreakdownに記載してください
- 形式: 「勘定科目名 金額 + 勘定科目名 金額 = 合計」（千円単位）
- 単一の勘定科目の場合は「勘定科目名 金額」のみ
- 該当する勘定科目が見つからない場合は「該当なし」と記載
- breakdownは人が読んで計算根拠を確認できるよう、具体的な科目名と金額を記載すること

## 応答フォーマット:
分析の思考過程をまず記述してから、最後にJSON結果を \`\`\`json ... \`\`\` のコードブロックで出力してください。

**思考過程の記述（テキスト）：**
STEP 1〜5の各ステップの作業内容を簡潔に記述してください。特にSTEP 2（全科目リストアップ）とSTEP 3（分類結果）は必ず記載してください。

**JSON出力（コードブロック内）：**

\`\`\`json
{
  "periods": [
    {
      "label": "決算期ラベル",
      "sales": 数値またはnull,
      "materialCost": 数値またはnull,
      "outsourcingCost": 数値またはnull,
      "merchandisePurchase": 数値またはnull,
      "otherVariableCost": 数値またはnull,
      "laborCost": 数値またはnull,
      "depreciation": 数値またはnull,
      "otherExpenses": 数値またはnull,
      "nonOperatingIncome": 数値またはnull,
      "employeeCount": 数値またはnull,
      "ordinaryProfitFromPdf": 数値またはnull,
      "confidence": {
        "sales": "high/medium/low",
        "materialCost": "high/medium/low",
        "outsourcingCost": "high/medium/low",
        "merchandisePurchase": "high/medium/low",
        "otherVariableCost": "high/medium/low",
        "laborCost": "high/medium/low",
        "depreciation": "high/medium/low",
        "otherExpenses": "high/medium/low",
        "nonOperatingIncome": "high/medium/low",
        "employeeCount": "high/medium/low"
      },
      "breakdown": {
        "sales": "どの勘定科目をいくら合算したかの説明（例: 製品売上高 120,000 + 商品売上高 30,000 = 150,000）",
        "materialCost": "同上",
        "outsourcingCost": "同上",
        "merchandisePurchase": "同上",
        "otherVariableCost": "同上（例: 荷造運賃 2,000 + 消耗品費 1,500 = 3,500）",
        "laborCost": "同上（例: 製造労務費 25,000 + 役員報酬 10,000 + 給料手当 15,000 + 法定福利費 5,000 + 福利厚生費 2,000 = 57,000）",
        "depreciation": "同上（例: 製造原価・減価償却費 8,000 + 販管費・減価償却費 3,000 = 11,000）",
        "otherExpenses": "同上（例: 【製造経費】水道光熱費 3,000 + 修繕費 1,500 + 保険料 800 + 【販管費】地代家賃 2,000 + 通信費 500 + 旅費交通費 1,200 = 9,000）",
        "nonOperatingIncome": "同上",
        "employeeCount": "同上"
      },
      "notes": ["注意事項1", "注意事項2"]
    }
  ]
}
\`\`\``;
}

const USER_MESSAGE_TEXT = (text: string) =>
  `以下の決算書PDFから抽出したテキストを分析し、損益計算書の数値を抽出してください。\n\n${text}`;

const USER_MESSAGE_IMAGE = "添付の決算書PDF画像を分析し、損益計算書の数値を抽出してください。画像内の数値を正確に読み取ってください。";

const USER_MESSAGE_PDF = "添付の決算書PDFを分析し、損益計算書の数値を抽出してください。すべてのページを確認し、数値を正確に読み取ってください。";

function extractJSON(responseText: string): unknown {
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  return JSON.parse(jsonStr);
}

// ── テキストモード ──

async function callClaudeText(apiKey: string, text: string, systemPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: USER_MESSAGE_TEXT(text) }],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}

async function callOpenAIText(apiKey: string, text: string, systemPrompt: string): Promise<string> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: USER_MESSAGE_TEXT(text) },
    ],
  });
  return completion.choices[0]?.message?.content || "";
}

async function callGeminiText(apiKey: string, text: string, systemPrompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(USER_MESSAGE_TEXT(text));
  return result.response.text();
}

// ── 画像モード（Vision API）──

async function callClaudeVision(apiKey: string, images: string[], systemPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });

  const imageBlocks: Anthropic.ImageBlockParam[] = images.map((base64) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: "image/jpeg",
      data: base64,
    },
  }));

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: USER_MESSAGE_IMAGE },
        ],
      },
    ],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}

async function callOpenAIVision(apiKey: string, images: string[], systemPrompt: string): Promise<string> {
  const client = new OpenAI({ apiKey });

  const imageContent: OpenAI.ChatCompletionContentPart[] = images.map((base64) => ({
    type: "image_url" as const,
    image_url: {
      url: `data:image/jpeg;base64,${base64}`,
      detail: "high" as const,
    },
  }));

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          ...imageContent,
          { type: "text", text: USER_MESSAGE_IMAGE },
        ],
      },
    ],
  });
  return completion.choices[0]?.message?.content || "";
}

async function callGeminiVision(apiKey: string, images: string[], systemPrompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  const imageParts = images.map((base64) => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: base64,
    },
  }));

  const result = await model.generateContent([
    ...imageParts,
    { text: USER_MESSAGE_IMAGE },
  ]);
  return result.response.text();
}

// ── PDF直接送信モード（高精度）──

async function callClaudePdf(apiKey: string, pdfBase64: string, systemPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          { type: "text", text: USER_MESSAGE_PDF },
        ],
      },
    ],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}

async function callGeminiPdf(apiKey: string, pdfBase64: string, systemPrompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBase64,
      },
    },
    { text: USER_MESSAGE_PDF },
  ]);
  return result.response.text();
}

// ── API ルート ──

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, provider = "claude", text, images, pdfBase64, mode, variableCostItems = [], correctionInstruction, currentData } = body as {
      apiKey: string;
      provider: string;
      text?: string;
      images?: string[];
      pdfBase64?: string;
      mode?: "text" | "image" | "pdf" | "correction";
      variableCostItems?: string[];
      correctionInstruction?: string;
      currentData?: unknown;
    };

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "APIキーが提供されていません" },
        { status: 400 }
      );
    }

    // ── 修正モード ──
    if (mode === "correction" && correctionInstruction && currentData) {
      const correctionSystemPrompt = buildSystemPrompt(variableCostItems);
      const correctionUserMessage = `あなたは以前この決算書から以下のデータを抽出しました。ユーザーから修正指示が出ています。

## 現在の抽出結果:
${JSON.stringify(currentData, null, 2)}

## ユーザーの修正指示:
${correctionInstruction}

上記の修正指示に従ってデータを修正してください。
修正した項目のbreakdownも更新してください。
修正した箇所をnotesに記載してください（例: 「修正: 減価償却費に製造原価報告書分を追加」）。
整合性チェック（経常利益の計算一致）も行ってください。

応答は同じJSON形式（periodsの配列）で返してください。`;

      let correctionResponse: string;

      if (pdfBase64 && (provider === "claude" || provider === "gemini")) {
        // PDF付きで修正（元PDFを確認しながら修正）
        if (provider === "gemini") {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: correctionSystemPrompt,
          });
          const result = await model.generateContent([
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
            { text: correctionUserMessage },
          ]);
          correctionResponse = result.response.text();
        } else {
          const client = new Anthropic({ apiKey });
          const message = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            system: correctionSystemPrompt,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
                { type: "text", text: correctionUserMessage },
              ],
            }],
          });
          correctionResponse = message.content[0].type === "text" ? message.content[0].text : "";
        }
      } else {
        // テキストのみで修正
        switch (provider) {
          case "openai":
            correctionResponse = await callOpenAIText(apiKey, correctionUserMessage, correctionSystemPrompt);
            break;
          case "gemini":
            correctionResponse = await callGeminiText(apiKey, correctionUserMessage, correctionSystemPrompt);
            break;
          default:
            correctionResponse = await callClaudeText(apiKey, correctionUserMessage, correctionSystemPrompt);
            break;
        }
      }

      const parsed = extractJSON(correctionResponse);
      return NextResponse.json(parsed);
    }

    const usePdfMode = mode === "pdf" && pdfBase64 && pdfBase64.length > 0;
    const useImageMode = mode === "image" && images && images.length > 0;

    if (!usePdfMode && !useImageMode && (!text || typeof text !== "string")) {
      return NextResponse.json(
        { error: "PDFテキストまたは画像が提供されていません" },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(variableCostItems);
    let responseText: string;

    if (usePdfMode) {
      // PDF直接送信モード（最高精度。Claude/Geminiのみ対応）
      switch (provider) {
        case "openai":
          // OpenAIはPDF直接送信非対応 → 画像モードにフォールバック
          if (images && images.length > 0) {
            responseText = await callOpenAIVision(apiKey, images, systemPrompt);
          } else {
            responseText = await callOpenAIText(apiKey, text || "", systemPrompt);
          }
          break;
        case "gemini":
          responseText = await callGeminiPdf(apiKey, pdfBase64, systemPrompt);
          break;
        default:
          responseText = await callClaudePdf(apiKey, pdfBase64, systemPrompt);
          break;
      }
    } else if (useImageMode) {
      // 画像モード（スキャンPDF対応）
      switch (provider) {
        case "openai":
          responseText = await callOpenAIVision(apiKey, images, systemPrompt);
          break;
        case "gemini":
          responseText = await callGeminiVision(apiKey, images, systemPrompt);
          break;
        default:
          responseText = await callClaudeVision(apiKey, images, systemPrompt);
          break;
      }
    } else {
      // テキストモード
      switch (provider) {
        case "openai":
          responseText = await callOpenAIText(apiKey, text!, systemPrompt);
          break;
        case "gemini":
          responseText = await callGeminiText(apiKey, text!, systemPrompt);
          break;
        default:
          responseText = await callClaudeText(apiKey, text!, systemPrompt);
          break;
      }
    }

    const parsed = extractJSON(responseText);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("PDF parse error:", error);

    const errMsg = error instanceof Error ? error.message : String(error);
    const apiError = error as { status?: number; statusCode?: number; code?: string };
    const status = apiError?.status || apiError?.statusCode;

    // 認証エラー
    if (
      status === 401 || status === 403 ||
      errMsg.includes("API_KEY_INVALID") ||
      errMsg.includes("PERMISSION_DENIED") ||
      errMsg.includes("Incorrect API key") ||
      errMsg.includes("authentication")
    ) {
      return NextResponse.json(
        { error: `APIキーが無効です。正しいキーを入力してください。\n詳細: ${errMsg}` },
        { status: 401 }
      );
    }

    // レート制限
    if (
      status === 429 ||
      errMsg.includes("RATE_LIMIT") ||
      errMsg.includes("RESOURCE_EXHAUSTED") ||
      errMsg.includes("quota")
    ) {
      return NextResponse.json(
        { error: `APIレート制限に達しました。しばらくしてからお試しください。\n詳細: ${errMsg}` },
        { status: 429 }
      );
    }

    // ペイロードサイズ超過
    if (
      errMsg.includes("too large") ||
      errMsg.includes("payload") ||
      errMsg.includes("413")
    ) {
      return NextResponse.json(
        { error: `PDFの画像サイズが大きすぎます。ページ数の少ないPDFをお試しください。\n詳細: ${errMsg}` },
        { status: 413 }
      );
    }

    return NextResponse.json(
      { error: `PDF解析中にエラーが発生しました。\n詳細: ${errMsg}` },
      { status: 500 }
    );
  }
}
