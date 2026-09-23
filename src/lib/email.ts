// Pengiriman email — dipakai fitur "Lupa kata sandi".
//
// Proyek ini belum punya transport email dan sengaja menghindari dependensi
// baru. Karena itu pengiriman dilakukan lewat HTTP API Resend memakai `fetch`
// bawaan, dengan dua perilaku cadangan yang jelas:
//
// - Di pengembangan tanpa RESEND_API_KEY: pesan dicetak ke konsol server supaya
//   alur reset bisa diuji ujung ke ujung tanpa penyedia email.
// - Di produksi tanpa RESEND_API_KEY: mengembalikan kegagalan dengan pesan
//   jelas, BUKAN diam-diam sukses — mengirim "berhasil" tanpa benar-benar
//   terkirim akan membuat pengguna menunggu email yang tidak pernah datang.
//
// Pola ini mengikuti src/lib/logo-storage.ts (satu titik tukar bila kelak
// memakai SMTP/nodemailer atau penyedia lain).

export type PesanEmail = {
  to: string;
  subject: string;
  text: string;
};

export type HasilKirimEmail =
  | { ok: true }
  | { ok: false; message: string };

const ENDPOINT_RESEND = "https://api.resend.com/emails";

export async function kirimEmail(pesan: PesanEmail): Promise<HasilKirimEmail> {
  const apiKey = process.env.RESEND_API_KEY;
  const pengirim = process.env.EMAIL_FROM ?? "TaradinMu <no-reply@taradinmu.id>";

  if (apiKey) {
    try {
      const respon = await fetch(ENDPOINT_RESEND, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: pengirim,
          to: [pesan.to],
          subject: pesan.subject,
          text: pesan.text,
        }),
      });

      if (!respon.ok) {
        return {
          ok: false,
          message: `Penyedia email menolak permintaan (HTTP ${respon.status}). Hubungi admin platform.`,
        };
      }
      return { ok: true };
    } catch {
      return {
        ok: false,
        message: "Gagal menghubungi penyedia email. Coba lagi nanti.",
      };
    }
  }

  if (process.env.NODE_ENV !== "production") {
    // Hanya untuk pengembangan: tautan dicetak agar bisa diklik langsung.
    console.info(
      `\n[email:dev] Tujuan: ${pesan.to}\n[email:dev] Subjek: ${pesan.subject}\n${pesan.text}\n`,
    );
    return { ok: true };
  }

  return {
    ok: false,
    message:
      "Pengiriman email belum dikonfigurasi. Hubungi admin platform untuk mengaktifkan fitur ini.",
  };
}
