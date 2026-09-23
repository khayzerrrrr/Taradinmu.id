"use server";

import { createHash, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { pesanErrorUmum, pesanValidasi } from "@/lib/action";
import { kirimEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { BATAS_RESET, periksaBatas } from "@/lib/rate-limit";
import type { ActionResponse } from "@/shared/types";
import {
  mintaResetSchema,
  simpanSandiSchema,
} from "../schemas/password-reset-schema";

// Alur "Lupa kata sandi".
//
// Token disimpan sebagai HASH (SHA-256) di tabel VerificationToken yang sudah
// disediakan Auth.js — bila isi database bocor, tautan reset yang masih hidup
// tidak bisa dipakai langsung. Token mentah hanya ada di email pengguna.
//
// Batas berlaku 30 menit dan sekali pakai: setelah kata sandi diubah, semua
// token milik pengguna itu dihapus.

const MASA_BERLAKU_MS = 30 * 60 * 1000;
/** Prefix identifier agar token reset tidak tertukar dengan token Auth.js lain. */
const PREFIX = "reset-sandi:";

/** Jawaban netral — tidak membocorkan apakah email terdaftar atau tidak. */
const PESAN_NETRAL =
  "Jika email tersebut terdaftar, kami sudah mengirim tautan untuk mengatur ulang kata sandi.";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function dasarAplikasi(): string {
  if (process.env.NODE_ENV === "production") {
    return `https://${process.env.ROOT_DOMAIN ?? "taradinmu.id"}`;
  }
  return process.env.AUTH_URL ?? "http://localhost:3000";
}

// Minta tautan reset. Selalu membalas pesan netral pada jalur normal.
export async function mintaResetSandi(input: unknown): Promise<ActionResponse> {
  const parsed = mintaResetSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const email = parsed.data.email.toLowerCase();

  // Cegah form ini dipakai membanjiri kotak masuk orang lain.
  const batas = await periksaBatas(`reset:${email}`, BATAS_RESET);
  if (!batas.allowed) {
    return {
      success: false,
      message:
        "Terlalu banyak permintaan tautan. Mohon tunggu beberapa menit sebelum mencoba lagi.",
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });

    // Email tidak terdaftar: balas seolah berhasil supaya halaman ini tidak bisa
    // dipakai menebak email mana yang punya akun.
    if (!user) return { success: true, message: PESAN_NETRAL };

    const token = randomUUID();
    const expires = new Date(Date.now() + MASA_BERLAKU_MS);

    // Satu token aktif per pengguna: permintaan baru membatalkan yang lama.
    await prisma.$transaction([
      prisma.verificationToken.deleteMany({
        where: { identifier: `${PREFIX}${user.id}` },
      }),
      prisma.verificationToken.create({
        data: {
          identifier: `${PREFIX}${user.id}`,
          token: hashToken(token),
          expires,
        },
      }),
    ]);

    const tautan = `${dasarAplikasi()}/reset-sandi?token=${token}`;
    const kirim = await kirimEmail({
      to: email,
      subject: "Atur ulang kata sandi TaradinMu",
      text: [
        `Assalamu'alaikum ${user.name},`,
        "",
        "Kami menerima permintaan mengatur ulang kata sandi akun TaradinMu Anda.",
        "Buka tautan berikut untuk membuat kata sandi baru (berlaku 30 menit):",
        "",
        tautan,
        "",
        "Bila Anda tidak meminta ini, abaikan saja email ini — kata sandi Anda tidak berubah.",
      ].join("\n"),
    });

    if (!kirim.ok) {
      return { success: false, message: kirim.message };
    }

    return { success: true, message: PESAN_NETRAL };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memproses permintaan.",
      error: pesanErrorUmum(error),
    };
  }
}

// Simpan kata sandi baru memakai token dari tautan email.
export async function simpanSandiBaru(input: unknown): Promise<ActionResponse> {
  const parsed = simpanSandiSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const baris = await prisma.verificationToken.findFirst({
      where: {
        token: hashToken(parsed.data.token),
        expires: { gt: new Date() },
        identifier: { startsWith: PREFIX },
      },
      select: { identifier: true },
    });

    if (!baris) {
      return {
        success: false,
        message:
          "Tautan tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.",
      };
    }

    const userId = baris.identifier.slice(PREFIX.length);
    const passwordHash = await hash(parsed.data.password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: passwordHash },
      }),
      // Sekali pakai: bersihkan semua token reset milik pengguna ini.
      prisma.verificationToken.deleteMany({
        where: { identifier: baris.identifier },
      }),
    ]);

    return {
      success: true,
      message: "Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.",
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menyimpan kata sandi baru.",
      error: pesanErrorUmum(error),
    };
  }
}
