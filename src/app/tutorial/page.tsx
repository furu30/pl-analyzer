"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileUp,
  ClipboardList,
  BarChart3,
  TrendingUp,
  Calculator,
  Play,
  Save,
  FolderOpen,
  RotateCcw,
  ArrowRight,
  Lightbulb,
  Info,
} from "lucide-react";

function SectionCard({
  step,
  title,
  icon: Icon,
  children,
}: {
  step?: number;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {step !== undefined && (
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#1F4E79] text-white text-sm font-bold shrink-0">
              {step}
            </span>
          )}
          <Icon className="w-5 h-5 text-[#1F4E79]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        {children}
      </CardContent>
    </Card>
  );
}

function ScreenshotImage({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <figure className="my-4">
      <div className="rounded-lg border overflow-hidden shadow-sm">
        <Image
          src={src}
          alt={alt}
          width={1280}
          height={800}
          className="w-full h-auto"
          priority={false}
        />
      </div>
      {caption && (
        <figcaption className="text-xs text-muted-foreground mt-2 text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
      <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

export default function TutorialPage() {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">使い方ガイド</h1>
        <p className="text-muted-foreground mb-6">
          PL Analyzerの基本的な操作方法を、デモデータを使ってご紹介します。
        </p>

        {/* ── はじめに ── */}
        <SectionCard title="はじめに" icon={Info}>
          <p>
            PL Analyzerは、損益計算書（P/L）のデータを入力し、利益構造の分析・可視化・シミュレーションを行うツールです。
            最大5期分のデータを比較分析できます。
          </p>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="font-medium mb-1">まずはデモデータで体験</p>
            <p>
              サイドバー下部の
              <span className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded bg-[#1F4E79] text-white text-xs font-medium">
                <Play className="w-3 h-3" /> デモデータ
              </span>
              ボタンをクリックすると、サンプル製造株式会社の3期分データが読み込まれます。
              実際の操作感を確認しながら、以下の手順に沿ってお試しください。
            </p>
          </div>

          <ScreenshotImage
            src="/tutorial/sidebar.png"
            alt="サイドバーのデモデータボタン"
            caption="サイドバー下部の「デモデータ」ボタンからサンプルデータを読み込めます"
          />
        </SectionCard>

        {/* ── Step 1 ── */}
        <SectionCard step={1} title="データ入力" icon={FileUp}>
          <p>
            最初にデータの入力方法を選択します。2つの方法があります。
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="font-medium flex items-center gap-1">
                <FileUp className="w-4 h-4" /> PDF取込
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                決算書のPDFをドラッグ＆ドロップすると、AIが損益計算書の数値を自動抽出します。
                Claude、Gemini、OpenAIのAPIキーが必要です。
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="font-medium flex items-center gap-1">
                <ClipboardList className="w-4 h-4" /> 手入力
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                損益計算書の数値を手動で入力します。
                PDFがない場合や、数値を直接修正したい場合に使用します。
              </p>
            </div>
          </div>

          <ScreenshotImage
            src="/tutorial/step1-select.png"
            alt="Step 1: データ入力方式の選択"
            caption="PDF取込か手入力かを選択します"
          />

          <TipBox>
            PDF取込を使用する場合は、事前に「APIキー」ボタンからAIサービスのAPIキーを登録してください。
            APIキーはブラウザのローカルストレージに保存され、外部に送信されることはありません。
          </TipBox>
        </SectionCard>

        {/* ── Step 2 ── */}
        <SectionCard step={2} title="実績データ入力・編集" icon={ClipboardList}>
          <p>
            各決算期の損益データを入力・編集します。
            金額はすべて<strong>千円単位</strong>で入力してください。
          </p>

          <div className="space-y-2">
            <p className="font-medium">入力項目：</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">売上高</strong> — 製品・商品の売上合計</li>
              <li><strong className="text-foreground">変動費</strong> — 材料費、外注費、商品仕入、その他変動費</li>
              <li><strong className="text-foreground">固定費</strong> — 人件費、減価償却費、その他経費</li>
              <li><strong className="text-foreground">営業外損益</strong> — 営業外収益と営業外費用の差額</li>
              <li><strong className="text-foreground">従業員数</strong> — 1人当たり指標の算出に使用</li>
            </ul>
          </div>

          <ScreenshotImage
            src="/tutorial/step2-input.png"
            alt="Step 2: 実績データ入力画面"
            caption="期間タブを切り替えて各期のデータを入力します"
          />

          <TipBox>
            画面下部のフッターに「検算」結果が表示されます。
            すべての期が「OK」になっていれば、データの整合性は問題ありません。
          </TipBox>
        </SectionCard>

        {/* ── Step 3 ── */}
        <SectionCard step={3} title="利益バランス図表" icon={BarChart3}>
          <p>
            2つの決算期を比較して、損益構造の変化を一覧で確認できます。
          </p>

          <div className="space-y-2">
            <p className="font-medium">表の見方：</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">金額</strong> — 各項目の絶対額（千円）</li>
              <li><strong className="text-foreground">構成比</strong> — 売上高を100%とした比率</li>
              <li><strong className="text-foreground">前期比（%）</strong> — 前期からの増減率</li>
            </ul>
            <p className="text-muted-foreground">
              行の色分けで変動費（緑系）、固定費（黄系）、利益（ピンク系）を視覚的に区別できます。
            </p>
          </div>

          <ScreenshotImage
            src="/tutorial/step3-balance.png"
            alt="Step 3: 利益バランス図表"
            caption="R4年3月期→R5年3月期の比較例：売上11.5%増、経常利益163.6%増"
          />

          <TipBox>
            ウォーターフォールチャートでは、経常利益の増減要因を
            「①売上高貢献」「②限界利益率貢献」「③固定費貢献」「④営業外損益貢献」の4要因に分解して表示します。
            どの要因が利益改善に最も寄与したかが一目でわかります。
          </TipBox>
        </SectionCard>

        {/* ── Step 4 ── */}
        <SectionCard step={4} title="Growth Chart" icon={TrendingUp}>
          <p>
            企業の成長軌跡を「売上高 × 限界利益率」の2軸グラフで可視化します。
            各期のポイントが矢印で結ばれ、成長の方向性がわかります。
          </p>

          <div className="space-y-2">
            <p className="font-medium">チャートの読み方：</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">右上方向</strong>
                <ArrowRight className="w-3 h-3 inline mx-1 -rotate-45" />
                売上も利益率も向上（理想的な成長）
              </li>
              <li><strong className="text-foreground">右下方向</strong>
                <ArrowRight className="w-3 h-3 inline mx-1 rotate-45" />
                売上は増えたが利益率が低下（コスト増注意）
              </li>
              <li><strong className="text-foreground">左上方向</strong>
                <ArrowRight className="w-3 h-3 inline mx-1 -rotate-[135deg]" />
                売上減だが利益率は改善（選択と集中）
              </li>
            </ul>
            <p className="text-muted-foreground">
              最新期は赤い点で強調表示されます。
            </p>
          </div>

          <ScreenshotImage
            src="/tutorial/step4-growth.png"
            alt="Step 4: Growth Chart"
            caption="売上高と限界利益率の推移を矢印付きで表示"
          />
        </SectionCard>

        {/* ── Step 5 ── */}
        <SectionCard step={5} title="損益シミュレーション" icon={Calculator}>
          <p>
            基準期のデータをもとに、パラメータを変化させた場合の損益を試算します。
            最大5パターンのシナリオを同時に比較できます。
          </p>

          <div className="space-y-2">
            <p className="font-medium">設定できるパラメータ：</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">売上高変化率</strong> — 売上の増減（%）</li>
              <li><strong className="text-foreground">変動費率変化</strong> — 変動費率の増減（%pt）</li>
              <li><strong className="text-foreground">人件費変化率</strong> — 人件費の増減（%）</li>
              <li><strong className="text-foreground">固定費変化率</strong> — その他固定費の増減（%）</li>
              <li><strong className="text-foreground">従業員数</strong> — シナリオでの人数</li>
            </ul>
          </div>

          <ScreenshotImage
            src="/tutorial/step5-simulation.png"
            alt="Step 5: 損益シミュレーション"
            caption="デモデータには5パターンのシナリオ（現状維持・売上拡大・コスト削減・積極投資・悲観）が設定済みです"
          />

          <TipBox>
            デモデータには「現状維持」「売上拡大」「コスト削減」「積極投資」「悲観」の5つのシナリオが用意されています。
            パラメータを変えて結果がどう変わるかを体感してみてください。
          </TipBox>
        </SectionCard>

        {/* ── データ管理 ── */}
        <SectionCard title="データ管理" icon={Save}>
          <p>
            サイドバー下部のボタンでデータの保存・読込・リセットができます。
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Save className="w-5 h-5 text-[#1F4E79] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">データ保存</p>
                <p className="text-xs text-muted-foreground">
                  現在のデータをJSONファイルとしてダウンロードします。
                  PCにファイルが保存されるので、いつでも復元できます。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <FolderOpen className="w-5 h-5 text-[#1F4E79] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">データ読込</p>
                <p className="text-xs text-muted-foreground">
                  保存済みのJSONファイルを選択して読み込みます。
                  別のPCで作業を引き継ぐ場合などに使用します。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Play className="w-5 h-5 text-[#1F4E79] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">デモデータ</p>
                <p className="text-xs text-muted-foreground">
                  サンプル製造株式会社（3期分）のデモデータを読み込みます。
                  アプリの操作を試したいときに使用します。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <RotateCcw className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">データリセット</p>
                <p className="text-xs text-muted-foreground">
                  すべてのデータを初期状態に戻します。
                  この操作は取り消せないのでご注意ください。
                </p>
              </div>
            </div>
          </div>

          <TipBox>
            ブラウザを閉じてもデータは自動保存されます（ローカルストレージ）。
            ただし、ブラウザのキャッシュをクリアするとデータが消えるため、
            大切なデータは「データ保存」でJSONファイルに書き出しておくことをお勧めします。
          </TipBox>
        </SectionCard>

        {/* ── フッター ── */}
        <div className="text-center py-6 text-sm text-muted-foreground">
          <p>
            ご不明な点がございましたら、
            <Link href="/upload" className="text-[#1F4E79] underline hover:no-underline">
              Step 1
            </Link>
            に戻って操作をお試しください。
          </p>
        </div>
      </div>
    </div>
  );
}
