import { z } from "zod";

// Validasi input perhitungan zakat.

// Nominal rupiah: menerima angka/string; kosong dianggap 0; maksimal 2 desimal.
const nominalSchema = z
  .union([z.number(), z.string()])
  .transform((value) => {
    if (typeof value === "number") return value;
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    return /^\d{1,15}(\.\d{1,2})?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  })
  .pipe(
    z
      .number()
      .min(0, "Nilai tidak boleh negatif.")
      .max(1_000_000_000_000_000, "Nilai terlalu besar."),
  );

const optionalText = (maks: number, label: string) =>
  z
    .string()
    .trim()
    .max(maks, `${label} maksimal ${maks} karakter.`)
    .optional();

// Perhitungan zakat perniagaan: aset & hutang diisi manual.
export const hitungPerniagaanSchema = z.object({
  aset: nominalSchema,
  hutang: nominalSchema,
});

// Simpan riwayat zakat sebagai "sudah dibayar".
// INCOME dihitung ulang di server dari data invoice & pengeluaran (angka dari
// client tidak dipercaya); TRADE memakai aset/hutang yang diisi manual.
export const tandaiZakatSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("INCOME"),
    notes: optionalText(300, "Catatan"),
  }),
  z.object({
    type: z.literal("TRADE"),
    aset: nominalSchema,
    hutang: nominalSchema,
    notes: optionalText(300, "Catatan"),
  }),
]);

export type HitungPerniagaanInput = z.infer<typeof hitungPerniagaanSchema>;
export type TandaiZakatInput = z.infer<typeof tandaiZakatSchema>;
export type HitungPerniagaanFormValues = z.input<typeof hitungPerniagaanSchema>;
