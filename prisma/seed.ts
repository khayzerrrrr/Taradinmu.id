import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Seed: menyiapkan akun awal untuk pengembangan.
//  1) SUPER_ADMIN — platform owner (tanpa tenant).
//  2) OWNER dummy — pemilik sebuah tenant demo, agar dashboard tenant bisa dicoba.
// Semua kredensial dibaca dari .env (lihat SUPER_ADMIN_* / OWNER_* di .env).

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} wajib diisi di file .env`);
  }
  return value;
}

function passwordOf(name: string): string {
  const value = required(name);
  if (value.length < 8) {
    throw new Error(`${name} minimal 8 karakter.`);
  }
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function upsertSuperAdmin(): Promise<void> {
  const email = required("SUPER_ADMIN_EMAIL").trim().toLowerCase();
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";
  const password = await hash(passwordOf("SUPER_ADMIN_PASSWORD"), 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, password, role: "SUPER_ADMIN", tenantId: null },
    create: { name, email, password, role: "SUPER_ADMIN", tenantId: null },
  });

  console.log(`✓ SUPER_ADMIN siap dipakai: ${user.email}`);
}

async function upsertOwnerWithTenant(): Promise<void> {
  const email = required("OWNER_EMAIL").trim().toLowerCase();
  const name = process.env.OWNER_NAME ?? "Owner Demo";
  const password = await hash(passwordOf("OWNER_PASSWORD"), 10);

  const tenantName = process.env.DEMO_TENANT_NAME ?? "Toko Demo TaradinMu";
  const slug = (process.env.DEMO_TENANT_SLUG ?? "toko-demo").trim().toLowerCase();

  // OWNER wajib terikat ke sebuah tenant, jadi buat tenant demo lebih dulu.
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: { name: tenantName },
    create: {
      name: tenantName,
      slug,
      plan: "FREE",
      businessType: "RETAIL_FNB",
      enabledModules: ["INVENTORY", "BILLING"],
    },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, password, role: "OWNER", tenantId: tenant.id },
    create: { name, email, password, role: "OWNER", tenantId: tenant.id },
  });

  console.log(`✓ OWNER demo siap dipakai: ${user.email} (tenant: ${tenant.slug})`);
}

async function main(): Promise<void> {
  await upsertSuperAdmin();
  await upsertOwnerWithTenant();
}

main()
  .catch((error: unknown) => {
    console.error("Gagal menjalankan seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
