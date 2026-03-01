export interface PdfExtractResult {
  text: string;
  images: string[]; // base64 JPEG (data URI なし、純粋なbase64)
  pdfBase64: string; // 元PDFファイルのbase64（直接API送信用）
  hasText: boolean;
}

export async function extractFromPDF(file: File): Promise<PdfExtractResult> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();

  // 元PDFファイルのbase64を生成（Claude/Gemini直接送信用）
  const pdfBytes = new Uint8Array(arrayBuffer);
  let pdfBase64 = "";
  // Uint8Array → base64 変換（ブラウザ環境）
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < pdfBytes.length; i += chunkSize) {
    const chunk = pdfBytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  pdfBase64 = btoa(binary);

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textPages: string[] = [];
  const images: string[] = [];

  // 最大10ページまで処理（決算書は通常数ページ）
  const maxPages = Math.min(pdf.numPages, 10);

  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);

    // テキスト抽出
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str)
      .join(" ");
    textPages.push(`--- Page ${i} ---\n${pageText}`);

    // 画像レンダリング（OpenAI用フォールバック + スキャンPDF対応）
    const viewport = page.getViewport({ scale: 3.0 }); // 高解像度（精度向上のため3.0に引き上げ）
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    // pdfjs-dist v5 では canvas パラメーターが必須
    await page.render({ canvas, viewport }).promise;
    // PNG で高品質を維持（OpenAI Vision用。Claude/GeminiはPDF直接送信）
    const dataUrl = canvas.toDataURL("image/png");
    // "data:image/png;base64," プレフィックスを除去
    const base64 = dataUrl.split(",")[1];
    images.push(base64);
  }

  const fullText = textPages.join("\n\n");
  // テキストが十分にあるか判定（空白除去後50文字以上）
  const cleanText = fullText.replace(/---\s*Page\s*\d+\s*---/g, "").replace(/\s+/g, "").trim();
  const hasText = cleanText.length > 50;

  return { text: fullText, images, pdfBase64, hasText };
}

/** 後方互換: テキストのみ抽出 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const result = await extractFromPDF(file);
  return result.text;
}
