import type { BusinessType } from "@/generated/prisma/client";
import { ambilBatasFitur, LIMIT_LABELS } from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantEditor, assertTenantMember } from "@/lib/tenant-access";
import { isModuleEnabled } from "@/shared/modules";
import type { ActionErrorCode } from "@/shared/types";

// Gerbang seragam untuk semua Server Action modul PROGRAM (PRD 4.F.6 dan 4.F.7):
// 1) konteks tenant, 2) feature flag modul PROGRAM, 3) keanggotaan sesi,
// 4) paket PRO, 5) untuk tulisan: hanya OWNER/ADMIN.
//
// Urutan tidak boleh diacak. Gerbang PRO ditaruh SETELAH pemeriksaan anggota
// supaya pesan "upgrade ke PRO" tidak membocorkan status paket ke akun yang
// bukan anggota tenant ini.

export type AksesProgram = {
  ok: true;
  tenantId: string;
  tenantSlug: string;
  /** Label industri (kloter/proyek/tahun ajaran) diambil dari sini. */
  businessType: BusinessType;
  /** Peran penulis pada panggilan ini; hanya terisi lewat aksesProgramTulis(). */
  bolehMenulis: boolean;
};

export type AksesGagal = {
  ok: false;
  message: string;
  /** UPGRADE_REQUIRED bila penolaknya adalah batas paket. */
  code?: ActionErrorCode;
};

type Akses = AksesProgram | AksesGagal;

const PESAN_PERAN_PROGRAM = `Akses ditolak. Hanya pemilik atau admin yang boleh mengubah ${LIMIT_LABELS.PROGRAM}.`;

async function aksesDasar(): Promise<Akses> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { ok: false, message: "Konteks tenant tidak ditemukan." };
  }
  if (!isModuleEnabled(tenant.enabledModules, "PROGRAM")) {
    return { ok: false, message: "Modul Program tidak aktif untuk tenant ini." };
  }

  const anggota = await assertTenantMember(tenant.id);
  if (!anggota.ok) return { ok: false, message: anggota.message };

  // Gating ditegakkan di server, bukan hanya disembunyikan di UI: menutup menu
  // tanpa menutup Server Action-nya hanya menyembunyikan pintunya (PRD 4.F.6).
  if (!ambilBatasFitur(tenant.plan, "PROGRAM")) {
    return {
      ok: false,
      code: "UPGRADE_REQUIRED",
      message: `Paket ${tenant.plan} tidak termasuk ${LIMIT_LABELS.PROGRAM}. Upgrade ke PRO untuk mengaktifkannya.`,
    };
  }

  return {
    ok: true,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    businessType: tenant.businessType,
    bolehMenulis: true,
  };
}

// Baca: semua role anggota tenant (OWNER, ADMIN, STAFF) dan SUPER_ADMIN.
export async function aksesProgram(): Promise<Akses> {
  return aksesDasar();
}

// Tulis: OWNER, ADMIN, SUPER_ADMIN — STAFF hanya membaca (PRD 4.F.7).
export async function aksesProgramTulis(): Promise<Akses> {
  const dasar = await aksesDasar();
  if (!dasar.ok) return dasar;

  const penulis = await assertTenantEditor(dasar.tenantId, PESAN_PERAN_PROGRAM);
  if (!penulis.ok) return { ok: false, message: penulis.message };
  return dasar;
}

// ---------------------------------------------------------------------------
// Helper tautan uang. Dipakai beberapa action sekaligus, jadi diletakkan di
// berkas gerbang ini daripada diduplikasi.
// ---------------------------------------------------------------------------

/**
 * Ambil program milik tenant, atau null. Setiap aksi tulis memakai ini agar
 * `programId` dari klien tidak pernah dipercaya begitu saja.
 */
export async function programTenant(tenantId: string, programId: string) {
  return prisma.program.findFirst({
    where: { id: programId, tenantId },
    select: { id: true, name: true, status: true },
  });
}

/**
 * Lepas seluruh tautan uang dari program. `programId` pada Invoice/Expense
 * bernilai null, jadi uang yang sudah tercatat TIDAK ikut terhapus
 * (PRD 4.F.9: menghapus program tidak boleh menghapus uangnya).
 */
export async function lepasSemuaTautan(tenantId: string, programId: string) {
  const [invoice, pengeluaran] = await prisma.$transaction([
    prisma.invoice.updateMany({
      where: { tenantId, programId },
      data: { programId: null },
    }),
    prisma.expense.updateMany({
      where: { tenantId, programId },
      data: { programId: null },
    }),
  ]);
  return { invoice: invoice.count, pengeluaran: pengeluaran.count };
}
