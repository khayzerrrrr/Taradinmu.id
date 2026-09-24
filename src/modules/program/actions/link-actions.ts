"use server";

import { pesanErrorUmum, pesanValidasi } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import type { ActionResponse } from "@/shared/types";
import { aksesProgram, aksesProgramTulis, programTenant } from "./akses-tenant";
import {
  detailProgramSchema,
  lepasTautanSchema,
  tautInvoiceSchema,
  tautPengeluaranSchema,
} from "../schemas/program-schema";
import type { CalonTautan } from "../types";
import { labelProgram } from "../utils";

// Menaut dan melepas tautan uang ke program (PRD 4.F.2).
//
// Aksi ini sama sekali TIDAK menulis angka uang. Yang berubah hanya kolom
// `programId` pada invoice/pengeluaran yang sudah ada. Itulah sebabnya
// `programId` nullable dan mengapa tidak ada tabel pembayaran di modul ini:
// dua sumber kebenaran angka adalah cara tercepat menghasilkan laporan yang
// berbeda sendiri.

// READ: kandidat tautan — uang tenant yang belum menunjuk program mana pun.
export async function getCalonTautan(
  input: unknown,
): Promise<ActionResponse<CalonTautan>> {
  const akses = await aksesProgram();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = detailProgramSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const program = await programTenant(akses.tenantId, parsed.data.programId);
    if (!program) return { success: false, message: "Program tidak ditemukan." };

    const [invoices, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: { tenantId: akses.tenantId, programId: null },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          status: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.expense.findMany({
        where: { tenantId: akses.tenantId, programId: null },
        orderBy: { expenseDate: "desc" },
        take: 30,
        select: { id: true, description: true, amount: true, category: true },
      }),
    ]);

    return {
      success: true,
      message: "Daftar calon tautan berhasil dimuat.",
      data: {
        invoices: invoices.map((invoice) => ({
          id: invoice.id,
          label: `${invoice.invoiceNumber} · ${invoice.customer?.name ?? "—"} · ${invoice.status}`,
          totalAmount: invoice.totalAmount.toString(),
        })),
        expenses: expenses.map((expense) => ({
          id: expense.id,
          label: `${expense.description} (${expense.category})`,
          amount: expense.amount.toString(),
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat calon tautan.",
      error: pesanErrorUmum(error, {
        aksi: "getCalonTautan",
        tenantId: akses.tenantId,
      }),
    };
  }
}

// Taut invoice. Pindah program diperbolehkan: `updateMany` di bawah tidak
// mensyaratkan `programId: null`, jadi menaut ulang artinya memindah label.
export async function tautkanInvoice(
  input: unknown,
): Promise<ActionResponse<{ invoiceId: string }>> {
  const akses = await aksesProgramTulis();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = tautInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const program = await programTenant(akses.tenantId, parsed.data.programId);
    if (!program) return { success: false, message: "Program tidak ditemukan." };

    const hasil = await prisma.invoice.updateMany({
      where: { id: parsed.data.invoiceId, tenantId: akses.tenantId },
      data: { programId: program.id },
    });
    if (hasil.count === 0) {
      return { success: false, message: "Invoice tidak ditemukan di toko ini." };
    }

    return {
      success: true,
      message: `Invoice ditaut ke ${labelProgram(akses.businessType).program} "${program.name}". Hanya invoice ber-status LUNAS yang menambah dana terkumpul.`,
      data: { invoiceId: parsed.data.invoiceId },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menaut invoice.",
      error: pesanErrorUmum(error, {
        aksi: "tautkanInvoice",
        tenantId: akses.tenantId,
      }),
    };
  }
}

// Taut pengeluaran.
export async function tautkanPengeluaran(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string }>> {
  const akses = await aksesProgramTulis();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = tautPengeluaranSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const program = await programTenant(akses.tenantId, parsed.data.programId);
    if (!program) return { success: false, message: "Program tidak ditemukan." };

    const hasil = await prisma.expense.updateMany({
      where: { id: parsed.data.expenseId, tenantId: akses.tenantId },
      data: { programId: program.id },
    });
    if (hasil.count === 0) {
      return { success: false, message: "Pengeluaran tidak ditemukan di toko ini." };
    }

    return {
      success: true,
      message: `Pengeluaran ditaut ke ${labelProgram(akses.businessType).program} "${program.name}".`,
      data: { expenseId: parsed.data.expenseId },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menaut pengeluaran.",
      error: pesanErrorUmum(error, {
        aksi: "tautkanPengeluaran",
        tenantId: akses.tenantId,
      }),
    };
  }
}

// Lepas tautan beberapa baris sekaligus. Uangnya tetap ada di tempat semula.
export async function lepasTautan(
  input: unknown,
): Promise<ActionResponse<{ lepasInvoice: number; lepasPengeluaran: number }>> {
  const akses = await aksesProgramTulis();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = lepasTautanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const invoiceIds = parsed.data.invoiceIds ?? [];
  const expenseIds = parsed.data.expenseIds ?? [];
  if (invoiceIds.length === 0 && expenseIds.length === 0) {
    return { success: false, message: "Pilih dulu data yang mau dilepas tautannya." };
  }

  try {
    const [lepasInvoice, lepasPengeluaran] = await prisma.$transaction([
      prisma.invoice.updateMany({
        where: {
          tenantId: akses.tenantId,
          programId: parsed.data.programId,
          id: { in: invoiceIds },
        },
        data: { programId: null },
      }),
      prisma.expense.updateMany({
        where: {
          tenantId: akses.tenantId,
          programId: parsed.data.programId,
          id: { in: expenseIds },
        },
        data: { programId: null },
      }),
    ]);

    return {
      success: true,
      message: `Lepas tautan: ${lepasInvoice.count} invoice, ${lepasPengeluaran.count} pengeluaran. Datanya tidak dihapus.`,
      data: {
        lepasInvoice: lepasInvoice.count,
        lepasPengeluaran: lepasPengeluaran.count,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal melepas tautan.",
      error: pesanErrorUmum(error, {
        aksi: "lepasTautan",
        tenantId: akses.tenantId,
      }),
    };
  }
}
