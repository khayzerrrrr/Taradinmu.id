import { z } from "zod";

// Skema periode akuntansi "YYYY-MM" (ROADMAP F1.12).
//
// Batasnya sengaja sempit: bulan wajib 01-12 dan tahun empat digit. "2026-13"
// atau "2026-1" bukan sekadar salah tulis - keduanya menghasilkan baris
// AccountingPeriod yang tidak akan pernah cocok dengan `JournalEntry.period`
// mana pun, sehingga periode tampak tertutup di UI padahal jurnal tetap masuk.
export const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Periode harus format YYYY-MM");

export type Periode = z.infer<typeof periodSchema>;