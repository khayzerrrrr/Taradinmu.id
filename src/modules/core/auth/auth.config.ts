import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
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
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = (token.uid as string) ?? "";
      session.user.role = token.role as Role;
      session.user.tenantId = (token.tenantId as string | null) ?? null;
      return session;
    },
  },
};
