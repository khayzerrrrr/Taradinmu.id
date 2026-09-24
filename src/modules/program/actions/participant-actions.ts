"use server";

import { isUniqueConstraintError, pesanErrorUmum, pesanValidasi } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import type { ActionResponse } from "@/shared/types";
import { aksesProgram, aksesProgramTulis, programTenant } from "./akses-tenant";
import {
  calonPesertaSchema,
  hapusPesertaSchema,
  pesertaSchema,
} from "../schemas/program-schema";
import type { CalonPeserta } from "../types";
import { labelProgram } from "../utils";

// Peserta program = tautan ke Customer yang sudah ada (PRD 4.F.3). Tidak ada
// model Jamaah/Siswa sendiri: di mata tagihan, jamaah umrah dan siswa pesantren
// sama-sama pihak yang ditagih.

// READ: calon peserta — pelanggan tenant yang belum terdaftar di program ini.
export async function getCalonPeserta(
  input: unknown,
): Promise<ActionResponse<CalonPeserta[]>> {
  const akses = await aksesProgram();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = calonPesertaSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }
  const { programId } = parsed.data;
  const cari = parsed.data.search ?? "";

  try {
    const program = await programTenant(akses.tenantId, programId);
    if (!program) return { success: false, message: "Program tidak ditemukan." };

    const terdaftar = await prisma.programParticipant.findMany({
      where: { programId },
      select: { customerId: true },
    });

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: akses.tenantId,
        id: { notIn: terdaftar.map((baris) => baris.customerId) },
        ...(cari
          ? {
              OR: [
                { name: { contains: cari, mode: "insensitive" } },
                { phone: { contains: cari, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 30,
      select: { id: true, name: true, phone: true },
    });

    return {
      success: true,
      message: "Daftar calon peserta dimuat.",
      data: customers,
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat calon peserta.",
      error: pesanErrorUmum(error, {
        aksi: "getCalonPeserta",
        tenantId: akses.tenantId,
      }),
    };
  }
}

// Tambah peserta. Idempoten: mendaftar ulang orang yang sudah ada tidak
// menghasilkan baris ganda.
export async function tambahPeserta(
  input: unknown,
): Promise<ActionResponse<{ programId: string; customerId: string }>> {
  const akses = await aksesProgramTulis();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = pesertaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { programId, customerId, notes } = parsed.data;

  try {
    const program = await programTenant(akses.tenantId, programId);
    if (!program) return { success: false, message: "Program tidak ditemukan." };

    // Batas tenant ditegakkan di sini: tanpa pemeriksaan ini, klien bisa
    // menautkan id pelanggan milik tenant lain.
    const pelanggan = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: akses.tenantId },
      select: { id: true, name: true },
    });
    if (!pelanggan) {
      return { success: false, message: "Pelanggan tidak ditemukan di toko ini." };
    }

    await prisma.programParticipant.create({
      data: {
        programId,
        customerId,
        notes: notes?.trim() || null,
      },
    });

    const sebutan = labelProgram(akses.businessType).peserta;
    return {
      success: true,
      message: `${sebutan} "${pelanggan.name}" berhasil ditambahkan.`,
      data: { programId, customerId },
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { success: false, message: "Peserta sudah terdaftar di program ini." };
    }
    return {
      success: false,
      message: "Gagal menambahkan peserta.",
      error: pesanErrorUmum(error, {
        aksi: "tambahPeserta",
        tenantId: akses.tenantId,
      }),
    };
  }
}

// Keluarkan peserta. Invoice miliknya tidak tersentuh — termasuk yang sudah
// menaut program ini (PRD 4.F.9).
export async function keluarPeserta(
  input: unknown,
): Promise<ActionResponse<{ programId: string; customerId: string }>> {
  const akses = await aksesProgramTulis();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = hapusPesertaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const hasil = await prisma.programParticipant.deleteMany({
      where: {
        programId: parsed.data.programId,
        customerId: parsed.data.customerId,
        program: { tenantId: akses.tenantId },
      },
    });

    if (hasil.count === 0) {
      return { success: false, message: "Peserta tidak terdaftar di program ini." };
    }

    return {
      success: true,
      message: "Peserta berhasil dikeluarkan dari program.",
      data: {
        programId: parsed.data.programId,
        customerId: parsed.data.customerId,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal mengeluarkan peserta.",
      error: pesanErrorUmum(error, {
        aksi: "keluarPeserta",
        tenantId: akses.tenantId,
      }),
    };
  }
}
