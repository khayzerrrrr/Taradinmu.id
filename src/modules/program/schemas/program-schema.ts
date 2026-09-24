import { z } from "zod";
import { pesanRentangTanggal } from "../utils";

// Validasi input Program (PRD Bagian 6: semua input wajib lewat Zod).

const nama = z
  .string()
  .trim()
  .min(2, "Nama program minimal 2 karakter.")
  .max(120, "Nama program maksimal 120 karakter.");

const keterangan = z
  .string()
  .trim()
  .max(500, "Keterangan maksimal 500 karakter.")
  .optional();

// Sama seperti invoice: tanggal datang sebagai string YYYY-MM-DD dari <input
// type="date">, bukan Date, supaya zona waktu pengguna tidak menggeser tanggal.
const tanggal = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD.");

const tanggalOpsional = z
  .union([z.literal(""), tanggal])
  .optional()
  .transform((value) => (value === "" ? undefined : value));

// Uang: menerima angka maupun string lalu dinormalkan; kosong berarti "tidak
// dipasang target/anggaran", bukan nol.
const nominalOpsional = z
  .union([z.number(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (typeof value === "number") return value;
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    return /^\d+(\.\d{1,2})?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  })
  .pipe(
    z
      .number()
      .min(0, "Nominal tidak boleh negatif.")
      .max(9_999_999_999_999, "Nominal terlalu besar.")
      .optional(),
  );

const statusProgram = z.enum(["PLANNING", "ACTIVE", "COMPLETED", "CANCELLED"]);

// Pasangan startDate/endDate diperiksa bersama-sama; sendirian keduanya sah.
const rentangSah = <T extends { startDate: string; endDate?: string }>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  const pesan = pesanRentangTanggal(value.startDate, value.endDate ?? null);
  if (pesan) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: pesan });
  }
};

export const listProgramsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(100).optional(),
  status: statusProgram.optional(),
});

export const detailProgramSchema = z.object({
  programId: z.string().min(1, "Program tidak valid."),
});

// Dialog calon peserta memakai pencarian, jadi perlu varian sendiri.
export const calonPesertaSchema = detailProgramSchema.extend({
  search: z.string().trim().max(100).optional(),
});

export const createProgramSchema = z
  .object({
    name: nama,
    description: keterangan,
    startDate: tanggal,
    endDate: tanggalOpsional,
    targetAmount: nominalOpsional,
    budgetAmount: nominalOpsional,
  })
  .superRefine(rentangSah);

export const updateProgramSchema = z
  .object({
    programId: z.string().min(1, "Program tidak valid."),
    name: nama,
    description: keterangan,
    startDate: tanggal,
    endDate: tanggalOpsional,
    targetAmount: nominalOpsional,
    budgetAmount: nominalOpsional,
    status: statusProgram,
  })
  .superRefine(rentangSah);

// Perubahan status sendiri (dari daftar/detail) tidak membawa seluruh form.
export const updateProgramStatusSchema = z.object({
  programId: z.string().min(1, "Program tidak valid."),
  status: statusProgram,
});

// `confirmLepas` wajib true bila program masih menaut uang: server menolak
// penghapusan diam-diam dan melaporkan jumlahnya lebih dulu (PRD 4.F.9).
export const deleteProgramSchema = z.object({
  programId: z.string().min(1, "Program tidak valid."),
  confirmLepas: z.boolean().optional().default(false),
});

export const pesertaSchema = z.object({
  programId: z.string().min(1, "Program tidak valid."),
  customerId: z.string().min(1, "Peserta wajib dipilih."),
  notes: z.string().trim().max(200, "Catatan maksimal 200 karakter.").optional(),
});

export const hapusPesertaSchema = z.object({
  programId: z.string().min(1, "Program tidak valid."),
  customerId: z.string().min(1, "Peserta tidak valid."),
});

// Menaut/mengosongkan `programId` pada uang yang SUDAH ada. Program tidak punya
// tabel pembayaran sendiri (PRD 4.F.2), jadi aksi ini hanya memindah label.
export const tautInvoiceSchema = z.object({
  programId: z.string().min(1, "Program tidak valid."),
  invoiceId: z.string().min(1, "Invoice tidak valid."),
});

export const tautPengeluaranSchema = z.object({
  programId: z.string().min(1, "Program tidak valid."),
  expenseId: z.string().min(1, "Pengeluaran tidak valid."),
});

export const lepasTautanSchema = z.object({
  programId: z.string().min(1, "Program tidak valid."),
  invoiceIds: z.array(z.string().min(1)).max(200).optional(),
  expenseIds: z.array(z.string().min(1)).max(200).optional(),
});

export type ListProgramsInput = z.infer<typeof listProgramsSchema>;
export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
export type UpdateProgramStatusInput = z.infer<typeof updateProgramStatusSchema>;
export type PesertaInput = z.infer<typeof pesertaSchema>;
export type TautInvoiceInput = z.infer<typeof tautInvoiceSchema>;
export type CalonTautanInput = z.infer<typeof detailProgramSchema>;
export type CreateProgramFormValues = z.input<typeof createProgramSchema>;
export type UpdateProgramFormValues = z.input<typeof updateProgramSchema>;
