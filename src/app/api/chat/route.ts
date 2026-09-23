import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BATAS_CHAT, periksaBatas } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/tenant-access";

// Asisten AI TaradinMu (PRD Bagian 4.E).
//
// Properti penting:
// - Hanya untuk tenant PRO. Penegakan di sini, bukan hanya di UI.
// - Tanpa DEEPSEEK_API_KEY endpoint membalas 503 dengan pesan jelas, bukan crash.
// - baseURL punya nilai bawaan sehingga hanya kunci API yang wajib diisi.

export const runtime = "nodejs";

// Kepribadian AI. Aturan "jangan mengarang angka" sengaja ditaruh di sini karena
// akses data (RAG) belum dipasang — tanpa aturan itu model cenderung menebak.
const SYSTEM_PROMPT = `
Kamu adalah "Asisten TaradinMu", asisten bisnis digital untuk para pengusaha di lingkungan Serikat Usaha Muhammadiyah (SUMU).

ATURAN UTAMA PERILAKU:
1. Sopan & Islami: gunakan sapaan santun. Awali percakapan pertama dengan "Assalamu'alaikum". Gunakan "Silakan", "Mohon maaf", "Terima kasih". Hindari bahasa gaul.
2. Profesional & Solutif: jawaban ringkas, padat, langsung pada inti. Pakai Markdown (bold, list, tabel) agar mudah dibaca di ponsel.
3. Berbasis Data & Fakta: saat ini kamu BELUM terhubung ke data tenant. JANGAN MENGARANG ANGKA. Bila ditanya data keuangan atau stok, jawab dengan sopan bahwa data belum tersedia di sesi ini dan arahkan pengguna ke halaman terkait (Dashboard, Inventory, Billing, Pengeluaran, atau Zakat).
4. Prinsip Syariah: selaraskan saran bisnis dengan prinsip muamalah (halal, thayyib, saling meridhai/taradin, menghindari riba dan gharar).
5. Bahasa: Bahasa Indonesia yang baik dan mudah dipahami pelaku UMKM.

TUGAS:
- Membantu memahami cara mencatat pengeluaran atau membuat invoice.
- Menjelaskan cara membaca laporan sederhana.
- Membuat draf pesan WhatsApp yang sopan untuk menagih piutang.
- Menjawab pertanyaan seputar hitungan zakat perniagaan dan zakat penghasilan (nisab 85 gram emas, kadar 2,5%).
- Jika pengguna meminta data spesifik miliknya, jelaskan langkah membukanya sendiri di aplikasi.
`.trim();

// PRD Bagian 6: semua input divalidasi Zod sebelum dipakai.
const pesanSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const bodySchema = z.object({
  messages: z.array(pesanSchema).min(1).max(40),
});

function balas(pesan: string, status: number): Response {
  return new Response(pesan, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return balas("Sesi tidak ditemukan. Silakan masuk terlebih dahulu.", 401);

  // Feature gating PRO (PRD 4.E). SUPER_ADMIN tetap boleh untuk keperluan uji.
  const tenant = user.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { plan: true },
      })
    : null;
  const bolehPakai = user.role === "SUPER_ADMIN" || tenant?.plan === "PRO";
  if (!bolehPakai) {
    return balas(
      "Asisten AI hanya tersedia pada paket PRO. Silakan upgrade untuk mengaktifkannya.",
      403,
    );
  }

  // Batas pemakaian asisten (pengerasan produksi). Kunci per pengguna, bukan per
  // IP: endpoint ini selalu berada di belakang sesi, jadi identitas pengguna
  // lebih tepat dan tidak bisa dipalsukan lewat header.
  const batas = await periksaBatas(`chat:${user.id}`, BATAS_CHAT);
  if (!batas.allowed) {
    return balas(
      "Terlalu banyak permintaan ke Asisten AI. Mohon tunggu beberapa menit.",
      429,
    );
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return balas(
      "Asisten AI belum dikonfigurasi: DEEPSEEK_API_KEY kosong. Hubungi admin platform.",
      503,
    );
  }

  let mentah: unknown;
  try {
    mentah = await req.json();
  } catch {
    return balas("Format permintaan tidak valid.", 400);
  }

  const parsed = bodySchema.safeParse(mentah);
  if (!parsed.success) return balas("Format permintaan tidak valid.", 400);

  // Provider dibuat di dalam handler agar variabel lingkungan dibaca saat request,
  // bukan saat build (build produksi tidak punya kunci API).
  const deepseek = createOpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
    apiKey,
  });

  const result = streamText({
    model: deepseek(process.env.DEEPSEEK_MODEL ?? "deepseek-chat"),
    system: SYSTEM_PROMPT,
    messages: parsed.data.messages,
    temperature: 0.7,
    maxOutputTokens: 1024,
  });

  return result.toTextStreamResponse();
}
