import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/client";

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
    } & DefaultSession["user"];
  }
}

export {};
