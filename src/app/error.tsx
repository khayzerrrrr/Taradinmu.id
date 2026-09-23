"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { catatError } from "@/lib/log";

// Pagar error untuk seluruh rute (PRD tidak menyebutnya; ROADMAP §4 P4
// mencantumkannya sebagai syarat rilis). Sebelum berkas ini ada, galat render
// apa pun jatuh ke halaman 500 bawaan framework: pesan teknis berbahasa Inggris
// yang bisa memuat detail internal, tanpa apa pun tercatat di log server.
//
// Next.js 16 memakai `retry` (stabil di v16.3.0), BUKAN `reset` seperti pada
// versi sebelumnya. `retry` mengambil ulang datanya, yang memang yang diperlukan
// di sini: penyebab tersering galat render di aplikasi ini adalah kueri yang
// sementara gagal, dan memuat ulang halaman memang memperbaikinya.
export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    catatError(error, { aksi: "render", digest: error.digest });
  }, [error]);

  // Rincian teknis hanya di pengembangan. Di produksi pengguna cukup melihat
  // kode referensi: `error.message` galat Server Component bisa memuat potongan
  // SQL atau nama tabel, dan `digest` sudah cukup untuk mencocokkannya dengan
  // baris di log server.
  const pengembangan = process.env.NODE_ENV !== "production";

  return (
    <main className="flex flex-1 items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <span className="flex size-11 items-center justify-center rounded-full bg-danger-subtle">
          <CircleAlert aria-hidden="true" className="size-5 text-danger" />
        </span>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Terjadi kesalahan
          </h1>
          <p className="text-sm text-muted-foreground">
            Halaman ini gagal dimuat. Data usaha Anda tetap tersimpan aman —
            silakan coba lagi.
          </p>
        </div>

        {pengembangan ? (
          <details className="w-full rounded-md border border-border bg-muted p-3 text-left">
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              Detail teknis (hanya pengembangan)
            </summary>
            <pre className="mt-2 overflow-x-auto text-xs break-words whitespace-pre-wrap text-muted-foreground">
              {error.stack ?? error.message}
            </pre>
          </details>
        ) : error.digest ? (
          <p className="text-xs text-muted-foreground">
            Kode referensi:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {error.digest}
            </code>
          </p>
        ) : null}

        <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
          <Button onClick={retry} className="flex-1">
            Coba lagi
          </Button>
          <Button variant="outline" asChild className="flex-1">
            <Link href="/">Kembali ke beranda</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
