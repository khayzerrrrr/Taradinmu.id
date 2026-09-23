import { z } from "zod";
import { passwordField } from "./user-schema";

// Skema alur lupa kata sandi (Aturan PRD Bagian 6: input divalidasi Zod).

const emailField = z
  .string()
  .trim()
  .min(1, "Email wajib diisi.")
  .max(160, "Email maksimal 160 karakter.")
  .email("Email tidak valid.");

export const mintaResetSchema = z.object({
  email: emailField,
});

export const simpanSandiSchema = z
  .object({
    token: z.string().min(1, "Tautan tidak valid."),
    password: passwordField,
    /** Konfirmasi hanya untuk kenyamanan pengisian, bukan aturan keamanan. */
    konfirmasi: z.string().min(1, "Ulangi kata sandi wajib diisi."),
  })
  .refine((data) => data.password === data.konfirmasi, {
    message: "Ulangi kata sandi tidak sama.",
    path: ["konfirmasi"],
  });

export type MintaResetInput = z.infer<typeof mintaResetSchema>;
export type SimpanSandiInput = z.infer<typeof simpanSandiSchema>;
