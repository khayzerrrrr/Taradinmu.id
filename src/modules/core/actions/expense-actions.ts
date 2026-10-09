"use server";

import type { Prisma } from "@/generated/prisma/client";
import {
  isRecordNotFoundError,
  pesanErrorUmum,
  pesanValidasi,
} from "@/lib/action";
import { awalBulan } from "@/lib/periode";
import { catatPeringatan } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantMember } from "@/lib/tenant-access";
import { isModuleEnabled } from "@/shared/modules";
import type { ActionResponse } from "@/shared/types";
import {
  catatJurnalPengeluaran,
  hapusJurnalPengeluaran,
  perbaruiJurnalPengeluaran,
  type DataPengeluaran,
  type KategoriPengeluaran,
} from "@/modules/accounting/jurnal-dari-pengeluaran";
import {
  createExpenseSchema,
  deleteExpenseSchema,
  listExpensesSchema,
  updateExpenseSchema,
} from "../schemas/expense-schema";
import type { ExpenseItem, ExpenseListData, ExpenseSummary } from "../types";

// Gerbang seragam untuk semua Server Action pencatatan pengeluaran:
// 1) konteks tenant, 2) feature flag modul ACCOUNTING, 3) keanggotaan sesi.
type AksesKeuangan =
  | { ok: true; tenantId: string; currency: string }
  | { ok: false; message: string };

async function aksesKeuangan(): Promise<AksesKeuangan> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { ok: false, message: "Konteks tenant tidak ditemukan." };
  }
  if (!isModuleEnabled(tenant.enabledModules, "ACCOUNTING")) {
    return { ok: false, message: "Modul Akuntansi tidak aktif untuk tenant ini." };
  }
  const guard = await assertTenantMember(tenant.id);
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }
  return { ok: true, tenantId: tenant.id, currency: tenant.currency };
}

// Menulis jurnal tanpa menggagalkan operasi utama.
//
// Pencatatan pengeluaran adalah operasi yang pengguna minta; kegagalan pembukuan
// tidak boleh membatalkannya, karena penolakan akan membuat pengguna mengulang
// klik pada hal yang sudah berhasil. Jurnal yang gagal dicatat sebagai peringatan
// dan ditutup oleh `rekonsiliasi.ts` — sama dengan kebijakan jurnal invoice.
async function jurnalAman(
  label: string,
  tenantId: string,
  jalankan: () => Promise<{ ok: boolean; alasan?: string }>,
): Promise<void> {
  try {
    const hasil = await jalankan();
    if (!hasil.ok) {
      catatPeringatan(`${label}: ${hasil.alasan ?? "gagal tanpa alasan"}`, {
        aksi: label,
        tenantId,
      });
    }
  } catch (error) {
    catatPeringatan(`${label}: ${pesanErrorUmum(error)}`, {
      aksi: label,
      tenantId,
    });
  }
}

// Rakit data jurnal dari input yang sudah divalidasi.
//
// `reference` jatuh ke keterangan bila nota tidak diisi: nomor dokumen di jurnal
// tidak boleh kosong, karena justru itu yang menghubungkan baris jurnal dengan
// dokumen sumbernya saat rekonsiliasi.
function dataJurnal(
  akses: { tenantId: string; currency: string },
  expenseId: string,
  data: {
    category: KategoriPengeluaran;
    description: string;
    amount: number;
    paymentMethod?: string;
    reference?: string;
  },
  tanggal: Date,
): DataPengeluaran {
  return {
    tenantId: akses.tenantId,
    currency: akses.currency,
    expenseId,
    reference: kosongKeNull(data.reference) ?? data.description,
    amount: data.amount,
    kategori: data.category,
    paymentMethod: kosongKeNull(data.paymentMethod),
    tanggal,
  };
}

// "YYYY-MM-DD" -> Date pada tengah malam UTC (konsisten dengan modul lain).
function keTanggal(nilai: string): Date {
  return new Date(`${nilai}T00:00:00.000Z`);
}

function kosongKeNull(nilai: string | undefined): string | null {
  const trimmed = nilai?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function keItem(expense: {
  id: string;
  category: string;
  description: string;
  amount: Prisma.Decimal;
  expenseDate: Date;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
}): ExpenseItem {
  return {
    id: expense.id,
    category: expense.category as ExpenseItem["category"],
    description: expense.description,
    amount: expense.amount.toString(),
    expenseDate: expense.expenseDate.toISOString(),
    paymentMethod: expense.paymentMethod,
    reference: expense.reference,
    notes: expense.notes,
    createdAt: expense.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// BACA
// ---------------------------------------------------------------------------

// Daftar pengeluaran tenant (paginasi, pencarian, filter kategori).
export async function getExpenses(
  input: unknown,
): Promise<ActionResponse<ExpenseListData>> {
  const akses = await aksesKeuangan();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = listExpensesSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { page, perPage, search, category } = parsed.data;
  // Scoping tenant WAJIB: jangan pernah percaya tenantId dari client.
  const where: Prisma.ExpenseWhereInput = {
    tenantId: akses.tenantId,
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: "insensitive" } },
            { reference: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(category ? { category } : {}),
  };

  try {
    const [total, expenses] = await prisma.$transaction([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return {
      success: true,
      message: "Daftar pengeluaran berhasil dimuat.",
      data: {
        expenses: expenses.map(keItem),
        meta: {
          page,
          perPage,
          total,
          totalPages: Math.max(1, Math.ceil(total / perPage)),
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat daftar pengeluaran.",
      error: pesanErrorUmum(error),
    };
  }
}

// Ringkasan untuk kartu di atas tabel.
export async function getExpenseSummary(): Promise<
  ActionResponse<ExpenseSummary>
> {
  const akses = await aksesKeuangan();
  if (!akses.ok) return { success: false, message: akses.message };

  try {
    const [bulanIni, keseluruhan] = await Promise.all([
      prisma.expense.aggregate({
        where: { tenantId: akses.tenantId, expenseDate: { gte: awalBulan() } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { tenantId: akses.tenantId },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      success: true,
      message: "Ringkasan pengeluaran berhasil dimuat.",
      data: {
        totalBulanIni: Number(bulanIni._sum.amount ?? 0),
        jumlahBulanIni: bulanIni._count,
        totalKeseluruhan: Number(keseluruhan._sum.amount ?? 0),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat ringkasan pengeluaran.",
      error: pesanErrorUmum(error),
    };
  }
}

// ---------------------------------------------------------------------------
// TULIS
// ---------------------------------------------------------------------------

// Catat pengeluaran baru.
export async function createExpense(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string }>> {
  const akses = await aksesKeuangan();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const data = parsed.data;

  try {
    const expense = await prisma.expense.create({
      data: {
        tenantId: akses.tenantId,
        category: data.category,
        description: data.description,
        amount: data.amount.toFixed(2),
        expenseDate: keTanggal(data.expenseDate),
        paymentMethod: kosongKeNull(data.paymentMethod),
        reference: kosongKeNull(data.reference),
        notes: kosongKeNull(data.notes),
      },
      select: { id: true },
    });

    // Jurnal beban dibuat setelah baris pengeluaran tersimpan. Idempoten, jadi
    // klik ganda tidak menggandakan beban; kegagalannya tidak membatalkan
    // pengeluaran (lihat `jurnalAman`).
    await jurnalAman("catatJurnalPengeluaran", akses.tenantId, () =>
      catatJurnalPengeluaran(
        dataJurnal(akses, expense.id, data, keTanggal(data.expenseDate)),
      ),
    );

    return {
      success: true,
      message: `Pengeluaran "${data.description}" berhasil dicatat.`,
      data: { expenseId: expense.id },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menyimpan pengeluaran.",
      error: pesanErrorUmum(error),
    };
  }
}

// Ubah pengeluaran (dibatasi lewat where tenantId).
export async function updateExpense(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string }>> {
  const akses = await aksesKeuangan();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = updateExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const data = parsed.data;

  try {
    const hasil = await prisma.expense.updateMany({
      where: { id: data.expenseId, tenantId: akses.tenantId },
      data: {
        category: data.category,
        description: data.description,
        amount: data.amount.toFixed(2),
        expenseDate: keTanggal(data.expenseDate),
        paymentMethod: kosongKeNull(data.paymentMethod),
        reference: kosongKeNull(data.reference),
        notes: kosongKeNull(data.notes),
      },
    });

    if (hasil.count === 0) {
      return { success: false, message: "Pengeluaran tidak ditemukan." };
    }

    // Jurnal lama dibalik, jurnal baru dicatat dari nilai baru.
    await jurnalAman("perbaruiJurnalPengeluaran", akses.tenantId, () =>
      perbaruiJurnalPengeluaran(
        dataJurnal(akses, data.expenseId, data, keTanggal(data.expenseDate)),
      ),
    );

    return {
      success: true,
      message: "Pengeluaran berhasil diperbarui.",
      data: { expenseId: data.expenseId },
    };
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { success: false, message: "Pengeluaran tidak ditemukan." };
    }
    return {
      success: false,
      message: "Gagal memperbarui pengeluaran.",
      error: pesanErrorUmum(error),
    };
  }
}

// Hapus pengeluaran.
export async function deleteExpense(
  input: unknown,
): Promise<ActionResponse<{ expenseId: string }>> {
  const akses = await aksesKeuangan();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = deleteExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const hasil = await prisma.expense.deleteMany({
      where: { id: parsed.data.expenseId, tenantId: akses.tenantId },
    });

    if (hasil.count === 0) {
      return { success: false, message: "Pengeluaran tidak ditemukan." };
    }

    // Beban dibalik, bukan dihapus: baris pengeluaran boleh hilang, bukti
    // pembukuannya tidak.
    await jurnalAman("hapusJurnalPengeluaran", akses.tenantId, () =>
      hapusJurnalPengeluaran({
        tenantId: akses.tenantId,
        expenseId: parsed.data.expenseId,
        tanggal: new Date(),
      }),
    );

    return {
      success: true,
      message: "Pengeluaran berhasil dihapus.",
      data: { expenseId: parsed.data.expenseId },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menghapus pengeluaran.",
      error: pesanErrorUmum(error),
    };
  }
}
