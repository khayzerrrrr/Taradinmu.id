import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./index";

// Data Access Layer (DAL): satu-satunya tempat otorisasi dibaca.
// `cache` memastikan `auth()` hanya dievaluasi sekali per request.

export const getCurrentUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

// Untuk halaman/layout: redirect bila tidak memenuhi syarat.
export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPER_ADMIN") redirect("/");
  return user;
}

export type SuperAdminGuardResult =
  | { ok: true; userId: string }
  | { ok: false; message: string };

// Untuk Server Action: kembalikan status, jangan redirect,
// supaya bisa dibalas sebagai ActionResponse.
export async function assertSuperAdmin(): Promise<SuperAdminGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "Sesi tidak ditemukan. Silakan masuk kembali." };
  }
  if (user.role !== "SUPER_ADMIN") {
    return { ok: false, message: "Akses ditolak. Hanya Super Admin." };
  }
  return { ok: true, userId: user.id };
}
