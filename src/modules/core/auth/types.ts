import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/client";

// Tenant yang sedang dilihat saat SUPER_ADMIN memakai mode "masuk sebagai tenant".
export type ImpersonatingTenant = {
  id: string;
  name: string;
  slug: string;
};

// Augmentasi tipe bawaan NextAuth agar `session.user` membawa `id`, `role`, dan `tenantId`.
declare module "next-auth" {
  interface User {
    role: Role;
    tenantId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      tenantId: string | null;
      /**
       * Diisi hanya ketika sesi ini sedang "masuk sebagai tenant". Berisi id
       * SUPER_ADMIN yang memulai mode tersebut; null pada sesi biasa.
       */
      impersonatedBy?: string | null;
      /** Tenant yang sedang dilihat; null di luar mode impersonasi. */
      impersonatingTenant?: ImpersonatingTenant | null;
    } & DefaultSession["user"];
  }
}

// Augmentasi token JWT. Sebelumnya tidak ada, sehingga `token.uid`/`token.role`
// di callback bertipe `any` implisit — dilarang Aturan PRD Bagian 6.
//
// Diambil dari "@auth/core/jwt" (modul aslinya) dan bukan "next-auth/jwt":
// "next-auth/jwt" hanya me-re-export, dan TypeScript menolak blok augmentasi
// terhadap subpath re-export itu (TS2664) tanpa impor tambahan yang menganggur.
declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    tenantId?: string | null;
    impersonatedBy?: string | null;
    impersonatingTenant?: ImpersonatingTenant | null;
  }
}

export {};
