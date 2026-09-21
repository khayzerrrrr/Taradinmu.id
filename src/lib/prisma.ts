import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton PrismaClient.
// Di mode dev, Next.js melakukan hot-reload sehingga modul ini bisa dievaluasi berkali-kali.
// Menyimpan instance di globalThis mencegah penumpukan koneksi ke database.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Prisma 7 mewajibkan driver adapter untuk koneksi langsung ke PostgreSQL.
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
