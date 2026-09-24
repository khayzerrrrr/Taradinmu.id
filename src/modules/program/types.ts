import type { PaginationMeta } from "@/shared/types";

// Tipe internal modul PROGRAM (PRD 4.F). Modul lain tidak boleh mengimpor ini.

export type ProgramStatusValue =
  | "PLANNING"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

/**
 * Semua angka uang dikirim sebagai string: kolomnya Decimal di database, dan
 * `Number` akan membulatkan nominal sebesar Rp 3,2 miliar per jamaah.
 */
export type ProgramItem = {
  id: string;
  name: string;
  description: string | null;
  status: ProgramStatusValue;
  startDate: string;
  endDate: string | null;
  targetAmount: string | null;
  budgetAmount: string | null;
  /** Terkumpul: total invoice ber-status PAID yang menaut program ini. */
  collected: string;
  /** Terpakai: total pengeluaran yang menaut program ini. */
  spent: string;
  paidInvoiceCount: number;
  linkedInvoiceCount: number;
  expenseCount: number;
  participantCount: number;
  createdAt: string;
};

export type ProgramListData = {
  programs: ProgramItem[];
  meta: PaginationMeta;
  /** Ringkasan seluruh program tenant, di luar baris yang tampil di halaman. */
  totalSemua: {
    terkumpul: string;
    terpakai: string;
    berjalan: number;
  };
};

export type ProgramPeserta = {
  customerId: string;
  name: string;
  phone: string | null;
  email: string | null;
  joinedAt: string;
  notes: string | null;
  /** Piutang berjalan peserta ini pada program (invoice PAID tidak dihitung). */
  tagihanBelumLunas: number;
};

export type ProgramTautan = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: string;
  status: string;
};

export type ProgramPengeluaran = {
  id: string;
  description: string;
  amount: string;
  date: string;
  category: string;
};

export type ProgramDetail = ProgramItem & {
  peserta: ProgramPeserta[];
  invoices: ProgramTautan[];
  expenses: ProgramPengeluaran[];
  /** Angka yang belum tertaut — bahan ajakan "ada N invoice belum ditandai". */
  tautanLepas: { invoice: number; pengeluaran: number };
};

/** Opsi invoice/pengeluaran yang belum menaut program mana pun (untuk dialog taut). */
export type CalonTautan = {
  invoices: { id: string; label: string; totalAmount: string }[];
  expenses: { id: string; label: string; amount: string }[];
};

/** Pelanggan yang belum terdaftar sebagai peserta, untuk dialog tambah peserta. */
export type CalonPeserta = {
  id: string;
  name: string;
  phone: string | null;
};

export type LabelProgram = {
  /** Sebutan objeknya per industri, mis. "Kloter" untuk travel umrah. */
  program: string;
  /** Sebutan pesertanya, mis. "Jamaah". */
  peserta: string;
};
