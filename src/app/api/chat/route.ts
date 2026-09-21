import { NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getSessionUser } from "@/lib/tenant-access";

export const maxDuration = 30;

/**
 * System prompt Asisten TaradinMu.
 *
 * Sengaja memuat daftar fitur yang BENAR-BENAR ada di aplikasi (lihat modul
 * inventory/billing/keuangan) supaya asisten tidak menjanjikan hal yang belum
 * dibangun, dan menegaskan bahwa ia tidak punya akses ke data usaha pengguna.
 */
export const SYSTEM_PROMPT = `Anda adalah "Asisten TaradinMu", asisten usaha berbahasa Indonesia untuk UMKM.

Anda membantu pemilik usaha memahami dan memakai fitur TaradinMu:
- Inventory: produk, varian (SKU & harga), batch, tanggal kedaluwarsa, stok masuk/keluar memakai FEFO (batch kedaluwarsa terdekat dipakai lebih dulu).
- Billing: pelanggan, invoice, dan statusnya (Draft, Terkirim, Lunas, Jatuh Tempo) serta piutang.
- Keuangan: pencatatan pengeluaran, lalu perhitungan zakat penghasilan (otomatis dari invoice lunas dikurangi pengeluaran) dan zakat perniagaan (manual: aset dikurangi hutang).
- Paket: FREE dibatasi 50 invoice & 100 produk, tanpa fitur batch dan tanpa zakat otomatis; paket PRO membuka semuanya termasuk branding (logo & warna).

Aturan menjawab:
1. Gunakan Bahasa Indonesia yang ringkas, ramah, dan mudah dipahami pengusaha non-teknis.
2. Anda TIDAK punya akses ke data usaha pengguna. Jangan mengarang angka, stok, atau nominal apa pun — arahkan mereka ke halaman yang tepat di aplikasi.
3. Untuk pertanyaan zakat, sebutkan bahwa angkanya estimasi (kadar 2,5%, nisab 85 gram emas) dan keputusan akhir sebaiknya dikonsultasikan kepada amil atau ustaz.
4. Jangan menjanjikan fitur yang tidak ada. Jika pertanyaannya di luar TaradinMu, jawab singkat lalu arahkan kembali.
5. Jangan pernah menampilkan data pribadi atau rahasia.`;

type BodyPermintaan = { messages?: UIMessage[] };

// Klien DeepSeek (API-nya kompatibel dengan OpenAI). Dipakai untuk menekan
// biaya produksi; baseURL bisa diarahkan ke endpoint lain lewat env.
const deepseek = createOpenAI({
  baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

/**
 * POST /api/chat — endpoint chat AI (streaming, protokol UI Message AI SDK).
 *
 * Catatan: rute /api/* tidak melewati proxy tenant, sehingga konteks tenant
 * tidak tersedia di sini. Otorisasi cukup memakai sesi yang sedang aktif.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sesi tidak ditemukan. Silakan masuk terlebih dahulu." },
      { status: 401 },
    );
  }

  // Tanpa kunci API, jangan sampai melempar error mentah ke klien.
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Chat AI belum dikonfigurasi. Isi DEEPSEEK_API_KEY pada file .env untuk mengaktifkannya.",
      },
      { status: 503 },
    );
  }

  let body: BodyPermintaan;
  try {
    body = (await req.json()) as BodyPermintaan;
  } catch {
    return NextResponse.json(
      { error: "Format permintaan tidak valid." },
      { status: 400 },
    );
  }

  const messages = body.messages ?? [];
  if (messages.length === 0) {
    return NextResponse.json(
      { error: "Tidak ada pesan yang dikirim." },
      { status: 400 },
    );
  }

  try {
    const result = streamText({
      // DeepSeek hanya kompatibel dengan Chat Completions API (bukan Responses
      // API), jadi WAJIB lewat .chat() — memanggil provider langsung akan
      // menuju /responses dan gagal.
      model: deepseek.chat(process.env.DEEPSEEK_MODEL || "deepseek-chat"),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse({
      // Pesan error yang aman: detail teknis tidak dibocorkan ke klien.
      onError: () => "Terjadi kesalahan saat memproses pesan. Coba lagi.",
    });
  } catch (error) {
    console.error("Chat AI gagal:", error);
    return NextResponse.json(
      { error: "Gagal memproses pesan." },
      { status: 500 },
    );
  }
}
