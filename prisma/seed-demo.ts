import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ZAKAT_RATE, round2 } from "../src/lib/zakat";
import { NISAB_PERDAGANGAN } from "../src/lib/zakat-nisab";

/**
 * Seed DATA DEMO untuk presentasi.
 *
 * Aman dijalankan berulang: data milik DUA tenant demo saja yang di-reset,
 * lalu dibuat ulang. Tenant lain — termasuk akun SUPER_ADMIN dan tenant
 * pengembangan `toko-demo` — tidak pernah disentuh.
 *
 * Jalankan: npx prisma db seed   (atau: npm run db:seed:demo)
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// ── Konfigurasi demo ────────────────────────────────────────────────────────
const PASSWORD_DEMO = process.env.DEMO_OWNER_PASSWORD ?? "DemoTaradinMu#2026";

// Enum BusinessType yang tersedia saat ini: RETAIL, FNB, PHARMACY, SERVICE,
// MANUFACTURING, OTHER. PRD menyebut "TRAVEL_UMROH" dan "RETAIL_FNB"; keduanya
// dipetakan ke nilai terdekat di bawah ini (businessType tidak ditampilkan di UI,
// jadi pemetaan ini tidak terlihat pada presentasi). Ubah dua baris ini bila
// nilai enum-nya ditambahkan nanti.
const BT_TRAVEL = "SERVICE" as const; // padanan TRAVEL_UMROH
const BT_MINIMARKET = "RETAIL" as const; // padanan RETAIL_FNB

const SLUG_TRAVEL = "berkah-haramain";
const SLUG_MINIMARKET = "toko-berkah";

const DAY = 24 * 60 * 60 * 1000;

function hariDariSekarang(hari: number): Date {
  return new Date(Date.now() + hari * DAY);
}

/** Awal bulan berjalan (UTC) — dipakai untuk paidAt/expenseDate. */
function bulanIni(hari: number): Date {
  const sekarang = new Date();
  return new Date(
    Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), hari, 9, 0, 0),
  );
}

/** Awal bulan lalu (UTC). */
function bulanLalu(hari: number): Date {
  const sekarang = new Date();
  return new Date(
    Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - 1, hari, 9, 0, 0),
  );
}

/** Nomor invoice mengikuti pola aplikasi: INV-<YYYYMM>-<KODE>-0001. */
function nomorInvoice(kode: string, urut: number): string {
  const d = new Date();
  const periode = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `INV-${periode}-${kode}-${String(urut).padStart(4, "0")}`;
}

// ── Reset data milik tenant demo (tidak menyentuh tenant lain) ──────────────
async function resetDataTenant(tenantId: string): Promise<void> {
  await prisma.stockMovement.deleteMany({
    where: { batch: { variant: { product: { tenantId } } } },
  });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { tenantId } } });
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.inventoryBatch.deleteMany({
    where: { variant: { product: { tenantId } } },
  });
  await prisma.productVariant.deleteMany({ where: { product: { tenantId } } });
  await prisma.product.deleteMany({ where: { tenantId } });
  await prisma.expense.deleteMany({ where: { tenantId } });
  await prisma.zakatCalculation.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
}

type BarisItem = {
  variantId: string;
  quantity: number;
  price: number;
};

async function buatInvoice(params: {
  tenantId: string;
  customerId: string;
  invoiceNumber: string;
  status: "DRAFT" | "SENT" | "PAID";
  dueDate: Date;
  paidAt?: Date;
  taxPercent?: number;
  notes?: string;
  items: BarisItem[];
}): Promise<void> {
  const subtotal = round2(
    params.items.reduce((t, i) => t + i.quantity * i.price, 0),
  );
  const taxAmount = round2((subtotal * (params.taxPercent ?? 0)) / 100);

  await prisma.invoice.create({
    data: {
      tenantId: params.tenantId,
      customerId: params.customerId,
      invoiceNumber: params.invoiceNumber,
      totalAmount: round2(subtotal + taxAmount).toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      status: params.status,
      dueDate: params.dueDate,
      paidAt: params.paidAt ?? null,
      notes: params.notes ?? null,
      items: {
        create: params.items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          price: i.price.toFixed(2),
          subtotal: (i.price * i.quantity).toFixed(2),
        })),
      },
    },
  });
}

// ── Tenant 1: Berkah Haramain Travel (PRO) ──────────────────────────────────
async function seedTravel(): Promise<string> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG_TRAVEL },
    update: {
      name: "Berkah Haramain Travel",
      plan: "PRO",
      businessType: BT_TRAVEL,
      enabledModules: ["INVENTORY", "BILLING", "ACCOUNTING"],
    },
    create: {
      name: "Berkah Haramain Travel",
      slug: SLUG_TRAVEL,
      plan: "PRO",
      businessType: BT_TRAVEL,
      enabledModules: ["INVENTORY", "BILLING", "ACCOUNTING"],
      categories: [
        "Paket Umrah",
        "Paket Haji",
        "Tiket & Visa",
        "Layanan Tambahan",
      ],
    },
  });

  await resetDataTenant(tenant.id);

  await prisma.user.upsert({
    where: { email: "owner@berkah-haramain.id" },
    update: { name: "Pak Reza — Owner", role: "OWNER", tenantId: tenant.id },
    create: {
      name: "Pak Reza — Owner",
      email: "owner@berkah-haramain.id",
      password: await hash(PASSWORD_DEMO, 10),
      role: "OWNER",
      tenantId: tenant.id,
    },
  });

  // Produk = paket umrah. Batch dibuat dengan kuota kursi yang sehat supaya
  // tidak memicu peringatan "stok menipis" palsu pada dashboard.
  const reguler = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      name: "Paket Umrah Reguler 9 Hari",
      description:
        "Penerbangan ekonomi, hotel bintang 4 (Makkah & Madinah), pembimbing ibadah, dan perlengkapan umrah.",
      variants: {
        create: {
          sku: "UMR-REG-9D",
          name: "Umrah Reguler 9 Hari — Kamar Quad",
          price: "28000000",
          batches: {
            create: { batchNumber: "SEAT-REG-2601", quantity: 24, expiredDate: null },
          },
        },
      },
    },
    select: { variants: { select: { id: true, price: true } } },
  });

  const vip = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      name: "Paket Umrah VIP 12 Hari",
      description:
        "Hotel bintang 5 dekat Masjidil Haram, kamar double, kereta cepat, dan city tour.",
      variants: {
        create: {
          sku: "UMR-VIP-12D",
          name: "Umrah VIP 12 Hari — Kamar Double",
          price: "35000000",
          batches: {
            create: { batchNumber: "SEAT-VIP-2601", quantity: 12, expiredDate: null },
          },
        },
      },
    },
    select: { variants: { select: { id: true, price: true } } },
  });

  const varReguler = reguler.variants[0];
  const varVip = vip.variants[0];
  const hargaReguler = Number(varReguler.price);
  const hargaVip = Number(varVip.price);

  const pelanggan = [
    "H. Abdul Rahman",
    "Ibu Siti Khadijah",
    "Rombongan Masjid Al-Hikmah",
    "Bpk. Yusuf Hamdani",
    "Ibu Aisyah Putri",
  ];
  const customerIds: string[] = [];
  for (const nama of pelanggan) {
    const c = await prisma.customer.create({
      data: { tenantId: tenant.id, name: nama, phone: "0812-0000-0000" },
      select: { id: true },
    });
    customerIds.push(c.id);
  }

  // 3 PAID (2 bulan ini, 1 bulan lalu), 1 SENT yang sudah lewat jatuh tempo
  // (tampil sebagai "Jatuh Tempo"), dan 1 DRAFT.
  await buatInvoice({
    tenantId: tenant.id,
    customerId: customerIds[0],
    invoiceNumber: nomorInvoice("BERKAH", 1),
    status: "PAID",
    dueDate: bulanIni(10),
    paidAt: bulanIni(8),
    notes: "Pelunasan paket umrah 2 jamaah.",
    items: [{ variantId: varReguler.id, quantity: 2, price: hargaReguler }],
  });

  await buatInvoice({
    tenantId: tenant.id,
    customerId: customerIds[1],
    invoiceNumber: nomorInvoice("BERKAH", 2),
    status: "PAID",
    dueDate: bulanIni(14),
    paidAt: bulanIni(12),
    notes: "Pelunasan paket VIP 1 jamaah.",
    items: [{ variantId: varVip.id, quantity: 1, price: hargaVip }],
  });

  await buatInvoice({
    tenantId: tenant.id,
    customerId: customerIds[2],
    invoiceNumber: nomorInvoice("BERKAH", 3),
    status: "PAID",
    dueDate: bulanLalu(20),
    paidAt: bulanLalu(18),
    notes: "Pelunasan rombongan 3 jamaah (bulan lalu).",
    items: [{ variantId: varReguler.id, quantity: 3, price: hargaReguler }],
  });

  await buatInvoice({
    tenantId: tenant.id,
    customerId: customerIds[3],
    invoiceNumber: nomorInvoice("BERKAH", 4),
    status: "SENT",
    dueDate: hariDariSekarang(-12), // lewat jatuh tempo -> tampil "Jatuh Tempo"
    notes: "Menunggu pelunasan; sudah lewat jatuh tempo.",
    items: [{ variantId: varReguler.id, quantity: 1, price: hargaReguler }],
  });

  await buatInvoice({
    tenantId: tenant.id,
    customerId: customerIds[4],
    invoiceNumber: nomorInvoice("BERKAH", 5),
    status: "DRAFT",
    dueDate: hariDariSekarang(14),
    notes: "Draft penawaran, menunggu konfirmasi jamaah.",
    items: [{ variantId: varVip.id, quantity: 1, price: hargaVip }],
  });

  // Riwayat zakat: sudah ditunaikan.
  const totalAset = 850_000_000;
  const totalHutang = 120_000_000;
  const neto = round2(totalAset - totalHutang);
  await prisma.zakatCalculation.create({
    data: {
      tenantId: tenant.id,
      type: "TRADE",
      calculationDate: bulanLalu(25),
      totalAssets: totalAset.toFixed(2),
      totalLiabilities: totalHutang.toFixed(2),
      netAssets: neto.toFixed(2),
      nisab: NISAB_PERDAGANGAN.toFixed(2),
      rate: ZAKAT_RATE.toFixed(4),
      zakatDue: round2(neto * ZAKAT_RATE).toFixed(2),
      isPaid: true,
      paidAt: bulanLalu(27),
      notes: "Zakat perniagaan tahun berjalan — sudah ditunaikan.",
    },
  });

  return tenant.id;
}

// ── Tenant 2: Toko Berkah Muhammadiyah (FREE) ───────────────────────────────
async function seedMinimarket(): Promise<string> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG_MINIMARKET },
    update: {
      name: "Toko Berkah Muhammadiyah",
      plan: "FREE",
      businessType: BT_MINIMARKET,
      // ACCOUNTING diaktifkan agar halaman Pengeluaran bisa didemokan.
      enabledModules: ["INVENTORY", "BILLING", "ACCOUNTING"],
    },
    create: {
      name: "Toko Berkah Muhammadiyah",
      slug: SLUG_MINIMARKET,
      plan: "FREE",
      businessType: BT_MINIMARKET,
      enabledModules: ["INVENTORY", "BILLING", "ACCOUNTING"],
      categories: ["Sembako", "Makanan & Minuman", "Perawatan Diri", "Lainnya"],
    },
  });

  await resetDataTenant(tenant.id);

  await prisma.user.upsert({
    where: { email: "owner@toko-berkah.id" },
    update: { name: "Bu Aminah — Owner", role: "OWNER", tenantId: tenant.id },
    create: {
      name: "Bu Aminah — Owner",
      email: "owner@toko-berkah.id",
      password: await hash(PASSWORD_DEMO, 10),
      role: "OWNER",
      tenantId: tenant.id,
    },
  });

  // Stok sengaja tipis (<= 10 unit) dan kedaluwarsa dekat (<= 30 hari) supaya
  // kartu "Stok Menipis" dan "Hampir Kedaluwarsa" terisi saat presentasi.
  const beras = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      name: "Beras Premium 5kg",
      description: "Beras pandan wangi kemasan 5 kg.",
      variants: {
        create: {
          sku: "BRS-PRM-5K",
          name: "Beras Premium 5kg",
          price: "78000",
          batches: {
            create: {
              batchNumber: "BRS-2601",
              quantity: 6,
              expiredDate: hariDariSekarang(12),
            },
          },
        },
      },
    },
    select: { variants: { select: { id: true, price: true } } },
  });

  const minyak = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      name: "Minyak Goreng 2L",
      description: "Minyak goreng sawit kemasan pouch 2 liter.",
      variants: {
        create: {
          sku: "MYK-GRG-2L",
          name: "Minyak Goreng 2L",
          price: "36000",
          batches: {
            create: {
              batchNumber: "MYK-2601",
              quantity: 9,
              expiredDate: hariDariSekarang(25),
            },
          },
        },
      },
    },
    select: { variants: { select: { id: true, price: true } } },
  });

  const varBeras = beras.variants[0];
  const varMinyak = minyak.variants[0];
  const hargaBeras = Number(varBeras.price);
  const hargaMinyak = Number(varMinyak.price);

  const customerIds: string[] = [];
  for (const nama of ["Ibu Ratna", "Warung Bu Yati", "Bpk. Slamet"]) {
    const c = await prisma.customer.create({
      data: { tenantId: tenant.id, name: nama, phone: "0857-0000-0000" },
      select: { id: true },
    });
    customerIds.push(c.id);
  }

  await buatInvoice({
    tenantId: tenant.id,
    customerId: customerIds[0],
    invoiceNumber: nomorInvoice("TOKOB", 1),
    status: "PAID",
    dueDate: bulanIni(5),
    paidAt: bulanIni(4),
    items: [
      { variantId: varBeras.id, quantity: 4, price: hargaBeras },
      { variantId: varMinyak.id, quantity: 6, price: hargaMinyak },
    ],
  });

  await buatInvoice({
    tenantId: tenant.id,
    customerId: customerIds[1],
    invoiceNumber: nomorInvoice("TOKOB", 2),
    status: "PAID",
    dueDate: bulanIni(9),
    paidAt: bulanIni(9),
    items: [
      { variantId: varBeras.id, quantity: 10, price: hargaBeras },
      { variantId: varMinyak.id, quantity: 12, price: hargaMinyak },
    ],
  });

  await buatInvoice({
    tenantId: tenant.id,
    customerId: customerIds[2],
    invoiceNumber: nomorInvoice("TOKOB", 3),
    status: "PAID",
    dueDate: bulanIni(15),
    paidAt: bulanIni(14),
    items: [{ variantId: varMinyak.id, quantity: 6, price: hargaMinyak }],
  });

  // Pengeluaran bulan berjalan.
  await prisma.expense.createMany({
    data: [
      {
        tenantId: tenant.id,
        category: "UTILITIES",
        description: "Tagihan listrik & air toko",
        amount: "850000.00",
        expenseDate: bulanIni(3),
        paymentMethod: "Transfer",
        reference: "PLN-2609",
      },
      {
        tenantId: tenant.id,
        category: "SALARY",
        description: "Gaji karyawan toko",
        amount: "4500000.00",
        expenseDate: bulanIni(1),
        paymentMethod: "Transfer",
      },
    ],
  });

  return tenant.id;
}

async function main(): Promise<void> {
  console.log("Menyiapkan data demo TaradinMu...\n");

  const sebelumnya = await prisma.tenant.findMany({ select: { slug: true } });
  const superAdminSebelum = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });

  const travelId = await seedTravel();
  const minimarketId = await seedMinimarket();

  // ── Ringkasan hasil ───────────────────────────────────────────────────────
  const ringkas = async (tenantId: string, label: string) => {
    const [invoices, expenses, zakat, produk, varian] = await Promise.all([
      prisma.invoice.count({ where: { tenantId } }),
      prisma.expense.count({ where: { tenantId } }),
      prisma.zakatCalculation.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId } }),
      prisma.productVariant.count({ where: { product: { tenantId } } }),
    ]);
    console.log(
      `  ${label.padEnd(26)} produk=${produk} varian=${varian} invoice=${invoices} pengeluaran=${expenses} zakat=${zakat}`,
    );
  };

  console.log("Data demo siap:");
  await ringkas(travelId, "Berkah Haramain (PRO)");
  await ringkas(minimarketId, "Toko Berkah (FREE)");

  const superAdminSesudah = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
  const sesudah = await prisma.tenant.findMany({ select: { slug: true } });

  console.log("\nKeamanan data:");
  console.log(`  Akun SUPER_ADMIN   : ${superAdminSebelum} sebelum -> ${superAdminSesudah} sesudah (tidak diubah)`);
  const slugBaru = sesudah.map((t) => t.slug).filter((s) => !sebelumnya.some((t) => t.slug === s));
  console.log(`  Tenant ditambahkan : ${slugBaru.length === 0 ? "(tidak ada, sudah ada sebelumnya)" : slugBaru.join(", ")}`);
  console.log(`  Total tenant di DB : ${sesudah.length}`);

  console.log("\nAkun untuk presentasi (password sama):");
  console.log(`  owner@berkah-haramain.id  -> tenant PRO  (Berkah Haramain Travel)`);
  console.log(`  owner@toko-berkah.id      -> tenant FREE (Toko Berkah Muhammadiyah)`);
  console.log(`  password: ${PASSWORD_DEMO}`);
}

main()
  .catch((error: unknown) => {
    console.error("Gagal menyiapkan data demo:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
