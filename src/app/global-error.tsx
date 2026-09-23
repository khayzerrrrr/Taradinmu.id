"use client";

import { useEffect } from "react";
import { catatError } from "@/lib/log";

// Pagar error untuk galat di ROOT LAYOUT — kasus yang tidak bisa dijangkau
// `src/app/error.tsx` karena error.tsx hanya membungkus segmen di bawahnya.
//
// Dua hal yang membuat berkas ini wajib berbeda dari halaman lain (dokumentasi
// Next.js, file-conventions/error.md):
// 1. Ia mengganti root layout sepenuhnya, jadi harus menulis tag <html> dan
//    <body> sendiri.
// 2. Ia TIDAK ikut memuat globals.css, jadi kelas Tailwind tidak akan berlaku —
//    seluruh gaya ditulis inline. Warnanya disalin dari token di globals.css
//    agar bahasa visualnya tetap sama.
// Metadata tidak bisa diekspor dari sini, jadi judul diatur lewat <title>.

const WARNA = {
  latar: "#f8fafc", // --background
  teks: "#0f172a", // --foreground
  redup: "#64748b", // --muted-foreground
  kartu: "#ffffff", // --card
  garis: "#e2e8f0", // --border
  merek: "#078360", // --primary-solid
  bahayaLembut: "#fee2e2", // --danger-subtle
  bahaya: "#b91c1c", // --danger
} as const;

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    catatError(error, { aksi: "render-root", digest: error.digest });
  }, [error]);

  const pengembangan = process.env.NODE_ENV !== "production";

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: WARNA.latar,
          color: WARNA.teks,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        {/* React mendukung <title> dari mana pun dalam pohon render. */}
        <title>Terjadi kesalahan — TaradinMu</title>

        <div
          style={{
            width: "100%",
            maxWidth: 420,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            padding: 32,
            textAlign: "center",
            background: WARNA.kartu,
            border: `1px solid ${WARNA.garis}`,
            borderRadius: 8,
            boxShadow: "0 1px 2px 0 rgb(15 23 42 / 0.06)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 9999,
              background: WARNA.bahayaLembut,
              color: WARNA.bahaya,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            !
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>
              Terjadi kesalahan
            </h1>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: WARNA.redup }}>
              Aplikasi gagal dimuat. Data usaha Anda tetap tersimpan aman —
              silakan coba lagi.
            </p>
          </div>

          {pengembangan ? (
            <pre
              style={{
                width: "100%",
                margin: 0,
                padding: 12,
                textAlign: "left",
                fontSize: 12,
                maxHeight: 160,
                overflow: "auto",
                background: "#f1f5f9",
                border: `1px solid ${WARNA.garis}`,
                borderRadius: 6,
                color: WARNA.redup,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {error.stack ?? error.message}
            </pre>
          ) : error.digest ? (
            <p style={{ margin: 0, fontSize: 12, color: WARNA.redup }}>
              Kode referensi:{" "}
              <code
                style={{
                  padding: "2px 6px",
                  background: "#f1f5f9",
                  borderRadius: 4,
                  color: WARNA.teks,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {error.digest}
              </code>
            </p>
          ) : null}

          <button
            type="button"
            onClick={retry}
            style={{
              width: "100%",
              minHeight: 44,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 500,
              color: "#ffffff",
              background: WARNA.merek,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
