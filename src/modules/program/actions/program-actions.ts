"use server";

import type { Prisma } from "@/generated/prisma/client";
import { pesanErrorUmum, pesanValidasi } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { parseTanggalInput } from "@/lib/stock";
import type { ActionResponse } from "@/shared/types";
import {
  aksesProgram,
  aksesProgramTulis,
  lepasSemuaTautan,
  programTenant,
} from "./akses-tenant";
import {
  createProgramSchema,
  deleteProgramSchema,
  detailProgramSchema,
  listProgramsSchema,
  updateProgramSchema,
  updateProgramStatusSchema,
} from "../schemas/program-schema";
import type {
  ProgramDetail,
  ProgramItem,
  ProgramListData,
} from "../types";
import {
  LABEL_STATUS,
  statusBolehDipakai,
  tanggalIso,
  tanggalNull,
} from "../utils";

// Server Action modul PROGRAM. Aturan angkanya (PRD 4.F.2): program tidak punya
// tabel pembayaran sendiri. Terkumpul = total invoice PAID yang programId-nya
// menunjuk mari; Terpakai = total Expense yang programId-nya menunjuk mari.

// Decimal -> string. Tidak pernah lewat `Number` untuk perjalanan ke UI, supaya
// presisi kolom Decimal(14,2) tidak hilang di tengah jalan.
function jumlahString(dec: { toString(): string } | null): string {
  return dec ? dec.toString() : "0";
}

// Normalisasi input form: string kosong berarti "tidak dipasang", bukan nol.
function ambilNominal(value: number | undefined): number | null {
  return value === undefined ? null : value;
}

type Agregat = {
  terkumpul: string;
  terpakai: string;
  jumlahPaid: number;
  jumlahTautan: number;
  jumlahPengeluaran: number;
};

const KOSONG: Agregat = {
  terkumpul: "0",
  terpakai: "0",
  jumlahPaid: 0,
  jumlahTautan: 0,
  jumlahPengeluaran: 0,
};

// Total uang per program dalam satu query per tabel — bukan per baris daftar,
// yang akan menjadi N+1 begitu halaman menampilkan 10 program.
async function agregatProgram(
  tenantId: string,
  programIds: string[],
): Promise<Map<string, Agregat>> {
  const peta = new Map<string, Agregat>();
  if (programIds.length === 0) return peta;

  const [invoice, paid, pengeluaran] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["programId"],
      where: { tenantId, programId: { in: programIds } },
      _count: { _all: true },
    }),
    prisma.invoice.groupBy({
      by: ["programId"],
      where: { tenantId, programId: { in: programIds }, status: "PAID" },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.expense.groupBy({
      by: ["programId"],
      where: { tenantId, programId: { in: programIds } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  for (const baris of invoice) {
    const id = baris.programId;
    if (!id) continue;
    const sebelumnya = peta.get(id) ?? KOSONG;
    peta.set(id, {
      ...sebelumnya,
      jumlahTautan: baris._count._all,
    });
  }
  for (const baris of paid) {
    const id = baris.programId;
    if (!id) continue;
    const sebelumnya = peta.get(id) ?? KOSONG;
    peta.set(id, {
      ...sebelumnya,
      terkumpul: jumlahString(baris._sum.totalAmount ?? null),
      jumlahPaid: baris._count._all,
    });
  }
  for (const baris of pengeluaran) {
    const id = baris.programId;
    if (!id) continue;
    const sebelumnya = peta.get(id) ?? KOSONG;
    peta.set(id, {
      ...sebelumnya,
      terpakai: jumlahString(baris._sum.amount ?? null),
      jumlahPengeluaran: baris._count._all,
    });
  }
  return peta;
}

// READ: daftar program + roll-up uang tiap baris.
export async function getPrograms(
  input: unknown,
): Promise<ActionResponse<ProgramListData>> {
  const akses = await aksesProgram();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = listProgramsSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { page, perPage, search, status } = parsed.data;
  const where: Prisma.ProgramWhereInput = {
    tenantId: akses.tenantId,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const programs = await prisma.program.findMany({
      where,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: { _count: { select: { participants: true } } },
    });

    const ids = programs.map((program) => program.id);
    const agregat = await agregatProgram(akses.tenantId, ids);
    const total = await prisma.program.count({ where });

    // Ringkasan seluruh tenant, bukan hanya halaman ini.
    const [terkumpul, terpakai, berjalan] = await Promise.all([
      prisma.invoice.aggregate({
        where: { tenantId: akses.tenantId, status: "PAID", programId: { not: null } },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { tenantId: akses.tenantId, programId: { not: null } },
        _sum: { amount: true },
      }),
      prisma.program.count({
        where: { tenantId: akses.tenantId, status: "ACTIVE" },
      }),
    ]);

    const rows: ProgramItem[] = programs.map((program) => {
      const angka = agregat.get(program.id) ?? KOSONG;
      return {
        id: program.id,
        name: program.name,
        description: program.description,
        status: program.status,
        startDate: tanggalIso(program.startDate),
        endDate: tanggalNull(program.endDate),
        targetAmount: program.targetAmount ? program.targetAmount.toString() : null,
        budgetAmount: program.budgetAmount ? program.budgetAmount.toString() : null,
        collected: angka.terkumpul,
        spent: angka.terpakai,
        paidInvoiceCount: angka.jumlahPaid,
        linkedInvoiceCount: angka.jumlahTautan,
        expenseCount: angka.jumlahPengeluaran,
        participantCount: program._count.participants,
        createdAt: program.createdAt.toISOString(),
      };
    });

    return {
      success: true,
      message: "Daftar program berhasil dimuat.",
      data: {
        programs: rows,
        meta: {
          page,
          perPage,
          total,
          totalPages: Math.max(1, Math.ceil(total / perPage)),
        },
        totalSemua: {
          terkumpul: jumlahString(terkumpul._sum.totalAmount ?? null),
          terpakai: jumlahString(terpakai._sum.amount ?? null),
          berjalan,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat daftar program.",
      error: pesanErrorUmum(error, { aksi: "getPrograms", tenantId: akses.tenantId }),
    };
  }
}

// READ: satu program lengkap dengan pesertanya dan uang yang tertaut.
export async function getProgramDetail(
  input: unknown,
): Promise<ActionResponse<ProgramDetail>> {
  const akses = await aksesProgram();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = detailProgramSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { programId } = parsed.data;

  try {
    const program = await prisma.program.findFirst({
      where: { id: programId, tenantId: akses.tenantId },
      include: {
        participants: {
          orderBy: { joinedAt: "asc" },
          include: {
            customer: { select: { id: true, name: true, phone: true, email: true } },
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { customer: { select: { name: true } } },
        },
        expenses: { orderBy: { expenseDate: "desc" }, take: 50 },
        _count: { select: { participants: true } },
      },
    });

    if (!program) {
      return { success: false, message: "Program tidak ditemukan." };
    }

    const agregat = await agregatProgram(akses.tenantId, [program.id]);
    const angka = agregat.get(program.id) ?? KOSONG;

    // Piutang berjalan per peserta: satu query lalu dihitung di memori, karena
    // jumlahnya dibatasi peserta program ini — bukan seluruh tenant.
    const tagihan = await prisma.invoice.groupBy({
      by: ["customerId"],
      where: {
        tenantId: akses.tenantId,
        programId: program.id,
        status: { in: ["SENT", "OVERDUE"] },
      },
      _count: { _all: true },
    });
    const belumLunas = new Map(
      tagihan
        .filter((baris) => baris.customerId)
        .map((baris) => [baris.customerId as string, baris._count._all]),
    );

    return {
      success: true,
      message: "Detail program berhasil dimuat.",
      data: {
        id: program.id,
        name: program.name,
        description: program.description,
        status: program.status,
        startDate: tanggalIso(program.startDate),
        endDate: tanggalNull(program.endDate),
        targetAmount: program.targetAmount ? program.targetAmount.toString() : null,
        budgetAmount: program.budgetAmount ? program.budgetAmount.toString() : null,
        collected: angka.terkumpul,
        spent: angka.terpakai,
        paidInvoiceCount: angka.jumlahPaid,
        linkedInvoiceCount: angka.jumlahTautan,
        expenseCount: angka.jumlahPengeluaran,
        participantCount: program._count.participants,
        createdAt: program.createdAt.toISOString(),
        peserta: program.participants.map((peserta) => ({
          customerId: peserta.customer.id,
          name: peserta.customer.name,
          phone: peserta.customer.phone,
          email: peserta.customer.email,
          joinedAt: peserta.joinedAt.toISOString(),
          notes: peserta.notes,
          tagihanBelumLunas: belumLunas.get(peserta.customer.id) ?? 0,
        })),
        invoices: program.invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customer?.name ?? "—",
          totalAmount: invoice.totalAmount.toString(),
          status: invoice.status,
        })),
        expenses: program.expenses.map((expense) => ({
          id: expense.id,
          description: expense.description,
          amount: expense.amount.toString(),
          // Timestamp utuh: tanggal lahirnya dibaca klien lewat formatTanggal,
          // sama seperti daftar Pengeluaran. Memotongnya ke UTC di sini akan
          // menampilkan tanggal berbeda untuk transaksi menjelang pagi.
          date: expense.expenseDate.toISOString(),
          category: expense.category,
        })),
        tautanLepas: {
          invoice: await prisma.invoice.count({
            where: { tenantId: akses.tenantId, programId: null },
          }),
          pengeluaran: await prisma.expense.count({
            where: { tenantId: akses.tenantId, programId: null },
          }),
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat detail program.",
      error: pesanErrorUmum(error, {
        aksi: "getProgramDetail",
        tenantId: akses.tenantId,
      }),
    };
  }
}

// CREATE — hanya OWNER/ADMIN/SUPER_ADMIN (PRD 4.F.7).
export async function createProgram(
  input: unknown,
): Promise<ActionResponse<{ programId: string }>> {
  const akses = await aksesProgramTulis();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = createProgramSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const program = await prisma.program.create({
      data: {
        tenantId: akses.tenantId,
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        startDate: parseTanggalInput(parsed.data.startDate),
        endDate: parsed.data.endDate
          ? parseTanggalInput(parsed.data.endDate)
          : null,
        targetAmount: ambilNominal(parsed.data.targetAmount),
        budgetAmount: ambilNominal(parsed.data.budgetAmount),
      },
      select: { id: true },
    });

    return {
      success: true,
      message: `Program "${parsed.data.name}" berhasil dibuat.`,
      data: { programId: program.id },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal membuat program.",
      error: pesanErrorUmum(error, { aksi: "createProgram", tenantId: akses.tenantId }),
    };
  }
}

// UPDATE (dibatasi tenantId) + perubahan status.
export async function updateProgram(
  input: unknown,
): Promise<ActionResponse<{ programId: string }>> {
  const akses = await aksesProgramTulis();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = updateProgramSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const program = await programTenant(akses.tenantId, parsed.data.programId);
  if (!program) return { success: false, message: "Program tidak ditemukan." };

  if (!statusBolehDipakai(program.status, parsed.data.status)) {
    return {
      success: false,
      message: `Status tidak bisa berubah dari ${LABEL_STATUS[program.status]} ke ${LABEL_STATUS[parsed.data.status]}.`,
    };
  }

  try {
    await prisma.program.updateMany({
      where: { id: parsed.data.programId, tenantId: akses.tenantId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        startDate: parseTanggalInput(parsed.data.startDate),
        endDate: parsed.data.endDate
          ? parseTanggalInput(parsed.data.endDate)
          : null,
        targetAmount: ambilNominal(parsed.data.targetAmount),
        budgetAmount: ambilNominal(parsed.data.budgetAmount),
        status: parsed.data.status,
      },
    });

    return {
      success: true,
      message: `Program "${parsed.data.name}" berhasil diperbarui.`,
      data: { programId: parsed.data.programId },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memperbarui program.",
      error: pesanErrorUmum(error, { aksi: "updateProgram", tenantId: akses.tenantId }),
    };
  }
}

// Perubahan status saja — dipakai tombol "Mulai"/"Selesaikan" di daftar.
export async function updateProgramStatus(
  input: unknown,
): Promise<ActionResponse<{ programId: string }>> {
  const akses = await aksesProgramTulis();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = updateProgramStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const program = await programTenant(akses.tenantId, parsed.data.programId);
  if (!program) return { success: false, message: "Program tidak ditemukan." };

  const tujuan = parsed.data.status;
  if (!statusBolehDipakai(program.status, tujuan)) {
    return {
      success: false,
      message: `Status tidak bisa berubah dari ${LABEL_STATUS[program.status]} ke ${LABEL_STATUS[tujuan]}.`,
    };
  }

  try {
    await prisma.program.updateMany({
      where: { id: parsed.data.programId, tenantId: akses.tenantId },
      data: { status: tujuan },
    });
    return {
      success: true,
      message: `Status program berubah menjadi ${LABEL_STATUS[tujuan]}.`,
      data: { programId: parsed.data.programId },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal mengubah status program.",
      error: pesanErrorUmum(error, {
        aksi: "updateProgramStatus",
        tenantId: akses.tenantId,
      }),
    };
  }
}

// DELETE — uangnya tidak ikut terhapus (PRD 4.F.9). Bila masih ada yang tertaut,
// penolakan pertama melaporkan jumlahnya dan pengguna harus mengonfirmasi.
export async function deleteProgram(
  input: unknown,
): Promise<ActionResponse<{ programId: string }>> {
  const akses = await aksesProgramTulis();
  if (!akses.ok) {
    return { success: false, message: akses.message, code: akses.code };
  }

  const parsed = deleteProgramSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { programId, confirmLepas } = parsed.data;
  const program = await programTenant(akses.tenantId, programId);
  if (!program) return { success: false, message: "Program tidak ditemukan." };

  try {
    const [tautanInvoice, tautanPengeluaran] = await Promise.all([
      prisma.invoice.count({ where: { tenantId: akses.tenantId, programId } }),
      prisma.expense.count({ where: { tenantId: akses.tenantId, programId } }),
    ]);

    if ((tautanInvoice > 0 || tautanPengeluaran > 0) && !confirmLepas) {
      return {
        success: false,
        message:
          `Program ini masih menaut ${tautanInvoice} invoice dan ${tautanPengeluaran} pengeluaran. ` +
          "Menghapusnya tidak menghapus uang tersebut — tautannya akan dilepas. Konfirmasi untuk lanjut.",
      };
    }

    await lepasSemuaTautan(akses.tenantId, programId);
    await prisma.program.deleteMany({
      where: { id: programId, tenantId: akses.tenantId },
    });

    return {
      success: true,
      message: `Program "${program.name}" dihapus. ${tautanInvoice} invoice dan ${tautanPengeluaran} pengeluaran dilepas tautannya.`,
      data: { programId },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menghapus program.",
      error: pesanErrorUmum(error, { aksi: "deleteProgram", tenantId: akses.tenantId }),
    };
  }
}
