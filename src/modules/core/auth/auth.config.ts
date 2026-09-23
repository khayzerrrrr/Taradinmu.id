import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  BATAS_LOGIN_EMAIL,
  BATAS_LOGIN_IP,
  ipPemanggil,
  periksaBatas,
} from "@/lib/rate-limit";
import type { Role } from "@/generated/prisma/client";

// Skema validasi kredensial (Zod) sebelum menyentuh database.
const credentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  // Sesi tetap JWT: login kredensial tidak kompatibel dengan database session.
  // Adapter di atas dipakai untuk persistensi akun (OAuth) & verifikasi email.
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Kredensial",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata Sandi", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();

        // Rate limit (pengerasan produksi). Ditaruh DI SINI, bukan hanya di
        // Server Action `loginAction`, karena `/api/auth/*` tidak melewati
        // src/proxy.ts sehingga penyerang dapat menembak
        // /api/auth/callback/credentials secara langsung dan melewati UI.
        //
        // Dibatasi dua kunci: per email (menahan tebak-tebakan pada satu akun
        // walau header IP dipalsukan) dan per IP (menahan percobaan menyebar).
        const batasEmail = await periksaBatas(`login:${email}`, BATAS_LOGIN_EMAIL);
        const batasIp = await periksaBatas(
          `login-ip:${ipPemanggil(request)}`,
          BATAS_LOGIN_IP,
        );
        if (!batasEmail.allowed || !batasIp.allowed) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordValid = await compare(parsed.data.password, user.password);
        if (!passwordValid) return null;

        // Hanya kembalikan data yang dibutuhkan session (jangan pernah `password`).
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      // Saat sign-in: salin identitas ke token. Ini satu-satunya cabang yang
      // menetapkan `role`, sehingga role tidak bisa dinaikkan lewat update sesi.
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
      }

      // Perubahan sesi tanpa login ulang — dipakai mode "masuk sebagai tenant"
      // (PRD 4.B). `update({ user: ... })` dari Server Action memicu cabang ini
      // dengan `trigger === "update"`, sebab `user` hanya terisi saat sign-in.
      //
      // Penjaga keamanan: cabang ini HANYA berjalan bila token sudah SUPER_ADMIN.
      // Endpoint sesi NextAuth dapat dipanggil dari klien, jadi tanpa penjaga ini
      // seorang OWNER bisa mengaku `tenantId` tenant lain lalu membaca datanya.
      if (trigger === "update" && token.role === "SUPER_ADMIN" && session?.user) {
        token.tenantId = session.user.tenantId ?? null;
        token.impersonatedBy = session.user.impersonatedBy ?? null;
        token.impersonatingTenant = session.user.impersonatingTenant ?? null;
      }

      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid ?? "";
      session.user.role = token.role as Role;
      session.user.tenantId = token.tenantId ?? null;
      session.user.impersonatedBy = token.impersonatedBy ?? null;
      session.user.impersonatingTenant = token.impersonatingTenant ?? null;
      return session;
    },
  },
};
