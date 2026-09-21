// Tipe bersama lintas modul (PRD Bagian 2: src/shared/ untuk shared types).
// Modul tidak boleh mengimpor dari modul lain, jadi kontrak umum ditaruh di sini.

// Kode mesin pada respons gagal, agar UI bisa menanganinya secara khusus.
export type ActionErrorCode = "UPGRADE_REQUIRED";

// Kontrak respons semua Server Action (PRD Bagian 6).
export type ActionResponse<T = undefined> = {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  /** Diisi bila kegagalan punya penanganan khusus, mis. UPGRADE_REQUIRED. */
  code?: ActionErrorCode;
};

export type PaginationMeta = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};
