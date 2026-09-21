"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/modules/core/auth";

export type LoginActionState = {
  success: boolean;
  message: string;
};

// Hanya izinkan path relatif (cegah open redirect).
function ambilCallbackUrl(formData: FormData): string {
  const raw = formData.get("callbackUrl");
  if (typeof raw === "string" && /^\/(?!\/)/.test(raw)) return raw;
  return "/";
}

// Server Action login; dipanggil dari <form> via useActionState.
export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: ambilCallbackUrl(formData),
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
