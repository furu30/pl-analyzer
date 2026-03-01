import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `あなたは日本の製造業の決算書を正確にExcel形式に変換する専門家です。

ユーザーから提供される決算書PDF（損益計算書・製造原価報告書・販売費及び一般管理費内訳）を読み取り、決算書の表構造をそのまま再現するためのJSON形式で出力してください。

## 重要なルール:
1. 決算書の表構造（勘定科目名・金額・階層構造）をそのまま再現する
2. 数値を加工・計算・分類する必要はない。決算書に記載されている通りに転記する
3. 複数のシート（損益計算書、製造原価報告書、販管費内訳）がある場合、シートを分ける
4. 比較損益計算書の場合、当期・前期など複数列を作る
5. 金額はそのままの単位で記載（千円なら千円、円なら円）
6. インデントやサブカテゴリの階層構造はlevelフィールドで表現する（0=大分類, 1=中分類, 2=小分類）

## 応答フォーマット:
以下のJSON形式で出力してください。思考過程は不要です。JSONのみ出力してください。

\`\`\`json
{
  "unit": "千円",
  "sheets": [
    {
      "name": "損益計算書",
      "columns": ["勘定科目", "前期", "当期"],
      "rows": [
        { "label": "売上高", "level": 0, "values": [100000, 120000] },
        { "label": "  製品売上高", "level": 1, "values": [80000, 95000] },
        { "label": "  商品売上高", "level": 1, "values": [20000, 25000] },
        { "label": "売上原価", "level": 0, "values": [70000, 85000] },
        { "label": "売上総利益", "level": 0, "values": [30000, 35000], "isSummary": true },
        { "label": "販売費及び一般管理費", "level": 0, "values": [20000, 22000] },
        { "label": "営業利益", "level": 0, "values": [10000, 13000], "isSummary": true }
      ]
    },
    {
      "name": "製造原価報告書",
      "columns": ["勘定科目", "前期", "当期"],
      "rows": [
        { "label": "材料費", "level": 0, "values": [30000, 35000] },
        { "label": "  原材料費", "level": 1, "values": [28000, 33000] }
      ]
    }
  ]
}
\`\`\`

## 注意事項:
- isSummary: true は小計・合計行（太字表示にする行）に付ける
- values配列の順序はcolumns配列の順序（勘定科目列を除く）と対応
- 決算書にない項目は出力しない
- 空行や区切り線は省略してよい
- 勘定科目名は決算書に記載されている通りに記載する`;

const USER_MESSAGE_PDF = "添付の決算書PDFを読み取り、すべてのページの表データをJSON形式で出力してください。損益計算書、製造原価報告書、販売費及び一般管理費内訳など、記載されているすべての表を漏れなく抽出してください。";
const USER_MESSAGE_TEXT = (text: string) =>
  `以下の決算書PDFから抽出したテキストを分析し、表データをJSON形式で出力してください。\n\n${text}`;
const USER_MESSAGE_IMAGE = "添付の決算書PDF画像を読み取り、すべてのページの表データをJSON形式で出力してください。画像内の数値を正確に読み取ってください。";

function extractJSON(responseText: string): unknown {
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  return JSON.parse(jsonStr);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, provider = "claude", text, images, pdfBase64, mode } = body as {
      apiKey: string;
      provider: string;
      text?: string;
      images?: string[];
      pdfBase64?: string;
      mode?: "text" | "image" | "pdf";
    };

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "APIキーが提供されていません" }, { status: 400 });
    }

    const usePdfMode = mode === "pdf" && pdfBase64 && pdfBase64.length > 0;
    const useImageMode = mode === "image" && images && images.length > 0;

    if (!usePdfMode && !useImageMode && (!text || typeof text !== "string")) {
      return NextResponse.json({ error: "PDFテキストまたは画像が提供されていません" }, { status: 400 });
    }

    let responseText: string;

    if (usePdfMode) {
      switch (provider) {
        case "openai": {
          // OpenAIはPDF直接送信非対応 → 画像にフォールバック
          if (images && images.length > 0) {
            const client = new OpenAI({ apiKey });
            const imageContent: OpenAI.ChatCompletionContentPart[] = images.map((base64) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" as const },
            }));
            const completion = await client.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 8192,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: [...imageContent, { type: "text", text: USER_MESSAGE_IMAGE }] },
              ],
            });
            responseText = completion.choices[0]?.message?.content || "";
          } else {
            const client = new OpenAI({ apiKey });
            const completion = await client.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 8192,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: USER_MESSAGE_TEXT(text || "") },
              ],
            });
            responseText = completion.choices[0]?.message?.content || "";
          }
          break;
        }
        case "gemini": {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: SYSTEM_PROMPT });
          const result = await model.generateContent([
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
            { text: USER_MESSAGE_PDF },
          ]);
          responseText = result.response.text();
          break;
        }
        default: {
          const client = new Anthropic({ apiKey });
          const message = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
                { type: "text", text: USER_MESSAGE_PDF },
              ],
            }],
          });
          responseText = message.content[0].type === "text" ? message.content[0].text : "";
          break;
        }
      }
    } else if (useImageMode) {
      switch (provider) {
        case "openai": {
          const client = new OpenAI({ apiKey });
          const imageContent: OpenAI.ChatCompletionContentPart[] = images.map((base64) => ({
            type: "image_url" as const,
            image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" as const },
          }));
          const completion = await client.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 8192,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: [...imageContent, { type: "text", text: USER_MESSAGE_IMAGE }] },
            ],
          });
          responseText = completion.choices[0]?.message?.content || "";
          break;
        }
        case "gemini": {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: SYSTEM_PROMPT });
          const imageParts = images.map((base64) => ({
            inlineData: { mimeType: "image/jpeg", data: base64 },
          }));
          const result = await model.generateContent([...imageParts, { text: USER_MESSAGE_IMAGE }]);
          responseText = result.response.text();
          break;
        }
        default: {
          const client = new Anthropic({ apiKey });
          const imageBlocks: Anthropic.ImageBlockParam[] = images.map((base64) => ({
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: base64 },
          }));
          const message = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: USER_MESSAGE_IMAGE }] }],
          });
          responseText = message.content[0].type === "text" ? message.content[0].text : "";
          break;
        }
      }
    } else {
      switch (provider) {
        case "openai": {
          const client = new OpenAI({ apiKey });
          const completion = await client.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 8192,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: USER_MESSAGE_TEXT(text!) },
            ],
          });
          responseText = completion.choices[0]?.message?.content || "";
          break;
        }
        case "gemini": {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction: SYSTEM_PROMPT });
          const result = await model.generateContent(USER_MESSAGE_TEXT(text!));
          responseText = result.response.text();
          break;
        }
        default: {
          const client = new Anthropic({ apiKey });
          const message = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: USER_MESSAGE_TEXT(text!) }],
          });
          responseText = message.content[0].type === "text" ? message.content[0].text : "";
          break;
        }
      }
    }

    const parsed = extractJSON(responseText);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("PDF to Excel error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `決算書の読み取りに失敗しました。\n詳細: ${errMsg}` },
      { status: 500 }
    );
  }
}
