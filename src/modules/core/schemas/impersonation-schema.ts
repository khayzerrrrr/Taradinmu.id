import { z } from "zod";

// Validasi input aksi impersonasi (Aturan PRD Bagian 6: semua input divalidasi
// Zod, termasuk yang datang dari komponen klien seperti daftar tenant di /admin).

export const masukSebagaiTenantSchema = z.object({
  tenantId: z.string().min(1, "Tenant tidak valid."),
});

export type MasukSebagaiTenantInput = z.infer<typeof masukSebagaiTenantSchema>;
