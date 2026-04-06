"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "sans-serif",
          gap: "1rem",
          padding: "1rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          システムエラー
        </h1>
        <p style={{ color: "#666", textAlign: "center" }}>
          アプリケーションで重大なエラーが発生しました。
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1.5rem",
            backgroundColor: "#1F4E79",
            color: "white",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          アプリケーションを再起動
        </button>
      </body>
    </html>
  );
}
