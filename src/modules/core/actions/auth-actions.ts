"use server";

import { AuthError } from "next-auth";
import { BATAS_LOGIN_EMAIL, lihatBatas } from "@/lib/rate-limit";
import { rumahUntukEmail } from "@/lib/tenant-access";
import { signIn, signOut } from "@/modules/core/auth";

export type LoginActionState = {
  success: boolean;
  message: string;
};

// Hanya izinkan path relatif (cegah open redirect). `null` berarti pemanggil
// tidak menyebut tujuan, dan rumah pengguna dipakai sebagai gantinya.
function ambilCallbackUrl(formData: FormData): string | null {
  const raw = formData.get("callbackUrl");
  if (typeof raw === "string" && /^\/(?!\/)/.test(raw)) return raw;
  return null;
}

// Server Action login; dipanggil dari <form> via useActionState.
export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  // Penegakan rate limit yang sesungguhnya ada di `authorize()` (satu-satunya
  // jalur yang tidak bisa dilewati). Pemeriksaan di sini hanya MEMBACA hitungan
  // tanpa menambah, supaya pengguna yang terkena batas menerima penjelasan yang
  // jelas — bukan "kata sandi salah" yang menyesatkan.
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email) {
    const batas = await lihatBatas(`login:${email}`, BATAS_LOGIN_EMAIL);
    if (!batas.allowed) {
      return {
        success: false,
        message:
          "Terlalu banyak percobaan masuk. Mohon tunggu beberapa menit sebelum mencoba lagi.",
      };
    }
  }

  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo:
        ambilCallbackUrl(formData) ?? (await rumahUntukEmail(email)),
    });
    return { success: true, message: "Berhasil masuk." };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, message: "Email atau kata sandi salah." };
    }
    // Penting: redirect() dari Next.js dilempar sebagai error khusus.
    // Jangan ditelan, biarkan diproses oleh framework.
    throw error;
  }
}

// Server Action keluar; dipakai tombol "Keluar" di header admin.
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
