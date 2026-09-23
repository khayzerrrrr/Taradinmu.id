"use server";

import type { ItemKind, Prisma } from "@/generated/prisma/client";
import {
  isRecordNotFoundError,
  isUniqueConstraintError,
  pesanErrorUmum,
  pesanValidasi,
} from "@/lib/action";
import { checkLimit } from "@/lib/feature-guards";
import { prisma } from "@/lib/prisma";
import { parseTanggalInput, ringkasStok } from "@/lib/stock";
import {
  alokasiFefoKeluar,
  kembalikanStokDariReferensi,
  StokBerubahError,
  StokTidakCukupError,
} from "@/lib/stock-allocation";
import type { ActionResponse } from "@/shared/types";
import {
  createInvoiceSchema,
  deleteInvoiceSchema,
  listInvoicesSchema,
  updateInvoiceStatusSchema,
} from "../schemas/invoice-schema";
import type {
  InvoiceDetail,
  InvoiceListData,
  InvoiceListItem,
  InvoiceVariantOption,
} from "../types";
import {
  bolehkanTransisi,
  hitungTotal,
  INVOICE_STATUS_LABELS,
  kodeTenant,
} from "../utils";
import { aksesTenant } from "./akses-tenant";

// Error khusus agar pesan soal stok bisa menyebut varian mana.
class InvoiceStokError extends Error {}

// Nomor invoice unik GLOBAL -> memuat kode tenant + periode.
async function buatNomorInvoice(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tenantSlug: string,
): Promise<string> {
  const kode = kodeTenant(tenantSlug);
  const sekarang = new Date();
  const periode = `${sekarang.getUTCFullYear()}${String(
    sekarang.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
  const awal = `INV-${periode}-${kode}-`;

  const jumlah = await tx.invoice.count({
    where: { tenantId, invoiceNumber: { startsWith: awal } },
  });

  // Cari nomor yang belum dipakai (nomor bisa terpakai ulang setelah penghapusan).
  for (let i = 0; i < 100; i++) {
    const kandidat = `${awal}${String(jumlah + 1 + i).padStart(4, "0")}`;
    const sudahAda = await tx.invoice.findUnique({
      where: { invoiceNumber: kandidat },
      select: { id: true },
    });
    if (!sudahAda) return kandidat;
  }

  return `${awal}${Date.now().toString().slice(-6)}`;
}

function keListItem(invoice: {
  id: string;
  invoiceNumber: string;
  totalAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  status: string;
  dueDate: Date;
  createdAt: Date;
  customer: { name: string };
  _count: { items: number };
}): InvoiceListItem {
  const sekarang = new Date();
  const status = invoice.status as InvoiceListItem["status"];
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customer.name,
    totalAmount: invoice.totalAmount.toString(),
    taxAmount: invoice.taxAmount.toString(),
    status,
    dueDate: invoice.dueDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    itemCount: invoice._count.items,
    isOverdue: status === "SENT" && invoice.dueDate.getTime() < sekarang.getTime(),
  };
}

// ---------------------------------------------------------------------------
// BACA
// ---------------------------------------------------------------------------

// Varian + harga + stok layak, untuk form pembuatan invoice (Prisma langsung).
// Termasuk item JASA (kind = SERVICE): item jasa tetap bisa ditagih, hanya saja
// tidak menyentuh stok, jadi `available` tidak berarti untuknya.
export async function getVariantsForInvoice(): Promise<
  ActionResponse<InvoiceVariantOption[]>
> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  try {
    const variants = await prisma.productVariant.findMany({
      where: { product: { tenantId: akses.tenantId } },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      select: {
        id: true,
        sku: true,
        name: true,
        price: true,
        product: { select: { name: true, kind: true } },
        batches: { select: { quantity: true, expiredDate: true } },
      },
    });

    const now = new Date();
    const data: InvoiceVariantOption[] = variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      productName: variant.product.name,
      price: variant.price.toString(),
      kind: variant.product.kind,
      available: ringkasStok(variant.batches, now).layak,
    }));

    return { success: true, message: "Daftar varian dimuat.", data };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat daftar varian.",
      error: pesanErrorUmum(error),
    };
  }
}

// Daftar invoice tenant (paginasi, pencarian, filter status).
export async function getInvoices(
  input: unknown,
): Promise<ActionResponse<InvoiceListData>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = listInvoicesSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { page, perPage, search, status } = parsed.data;
  const sekarang = new Date();

  const where: Prisma.InvoiceWhereInput = {
    tenantId: akses.tenantId,
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" } },
            { customer: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(status === "OVERDUE"
      ? { status: "SENT", dueDate: { lt: sekarang } }
      : status
        ? { status }
        : {}),
  };

  try {
    const [total, invoices] = await prisma.$transaction([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          customer: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return {
      success: true,
      message: "Daftar invoice berhasil dimuat.",
      data: {
        invoices: invoices.map(keListItem),
        meta: {
          page,
          perPage,
          total,
          totalPages: Math.max(1, Math.ceil(total / perPage)),
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat daftar invoice.",
      error: pesanErrorUmum(error),
    };
  }
}

// Detail invoice + baris item.
export async function getInvoiceDetail(
  invoiceId: string,
): Promise<ActionResponse<InvoiceDetail>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: akses.tenantId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        items: {
          include: {
            variant: {
              select: {
                sku: true,
                name: true,
                product: { select: { name: true } },
              },
            },
          },
        },
        _count: { select: { items: true } },
      },
    });

    if (!invoice) {
      return { success: false, message: "Invoice tidak ditemukan." };
    }

    return {
      success: true,
      message: "Detail invoice dimuat.",
      data: {
        ...keListItem(invoice),
        notes: invoice.notes,
        customer: invoice.customer,
        items: invoice.items.map((item) => ({
          id: item.id,
          variantId: item.variantId,
          sku: item.variant.sku,
          variantName: item.variant.name,
          quantity: item.quantity,
          price: item.price.toString(),
          subtotal: item.subtotal.toString(),
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat detail invoice.",
      error: pesanErrorUmum(error),
    };
  }
}

// ---------------------------------------------------------------------------
// TULIS
// ---------------------------------------------------------------------------

// Membuat invoice + memotong stok (FEFO) dalam SATU transaksi.
export async function createInvoice(input: unknown): Promise<
  ActionResponse<{
    invoiceId: string;
    invoiceNumber: string;
    totalAmount: string;
    allocations: { batchNumber: string; quantity: number }[];
  }>
> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { customerId, dueDate, taxPercent, items, notes } = parsed.data;

  try {
    // Batas paket: jumlah invoice maksimum untuk paket FREE.
    const batas = await checkLimit(akses.tenantId, "INVOICE");
    if (!batas.allowed) {
      return { success: false, message: batas.message, code: batas.code };
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: akses.tenantId },
      select: { id: true },
    });
    if (!customer) {
      return { success: false, message: "Pelanggan tidak ditemukan pada tenant ini." };
    }

    // Harga diambil dari DB (server otoritatif); harga dari client diabaikan.
    // `kind` ikut diambil karena menentukan apakah baris ini memotong stok.
    const variants = await prisma.productVariant.findMany({
      where: {
        id: { in: items.map((item) => item.variantId) },
        product: { tenantId: akses.tenantId },
      },
      select: {
        id: true,
        sku: true,
        name: true,
        price: true,
        product: { select: { kind: true } },
      },
    });
    const petaVarian = new Map(variants.map((variant) => [variant.id, variant]));

    const baris: {
      variantId: string;
      sku: string;
      nama: string;
      quantity: number;
      price: number;
      kind: ItemKind;
    }[] = [];

    for (const item of items) {
      const variant = petaVarian.get(item.variantId);
      if (!variant) {
        return {
          success: false,
          message: "Ada varian yang bukan milik tenant ini pada item invoice.",
        };
      }
      baris.push({
        variantId: variant.id,
        sku: variant.sku,
        nama: variant.name,
        quantity: item.quantity,
        price: Number(variant.price),
        kind: variant.product.kind,
      });
    }

    const total = hitungTotal(
      baris.map((b) => ({ quantity: b.quantity, price: b.price })),
      taxPercent,
    );
    const jatuhTempo = parseTanggalInput(dueDate);

    const hasil = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await buatNomorInvoice(
        tx,
        akses.tenantId,
        akses.tenantSlug,
      );

      const invoice = await tx.invoice.create({
        data: {
          tenantId: akses.tenantId,
          customerId: customer.id,
          invoiceNumber,
          totalAmount: total.totalAmount.toFixed(2),
          taxAmount: total.taxAmount.toFixed(2),
          status: "DRAFT",
          dueDate: jatuhTempo,
          notes: notes && notes.length > 0 ? notes : null,
          items: {
            create: baris.map((b) => ({
              variantId: b.variantId,
              quantity: b.quantity,
              price: b.price.toFixed(2),
              subtotal: (b.price * b.quantity).toFixed(2),
            })),
          },
        },
        select: { id: true, invoiceNumber: true, totalAmount: true },
      });

      // Potong stok per item BARANG dan catat StockMovement OUT (reference =
      // nomor invoice). Item JASA sengaja dilewati: jasa tidak punya stok, dan
      // inilah yang membuat travel, laundry, serta pendidikan bisa menagih tanpa
      // perlu membuat batch stok palsu lebih dulu.
      const allocations: { batchNumber: string; quantity: number }[] = [];
      for (const b of baris) {
        if (b.kind === "SERVICE") continue;

        try {
          const alokasi = await alokasiFefoKeluar(tx, {
            variantId: b.variantId,
            quantity: b.quantity,
            reference: invoice.invoiceNumber,
            notes: `Invoice ${invoice.invoiceNumber}`,
          });
          allocations.push(
            ...alokasi.allocations.map((a) => ({
              batchNumber: a.batchNumber,
              quantity: a.quantity,
            })),
          );
        } catch (error) {
          if (error instanceof StokTidakCukupError) {
            throw new InvoiceStokError(
              `Stok "${b.nama}" (${b.sku}) tidak cukup. ${error.message}`,
            );
          }
          throw error;
        }
      }

      return { invoice, allocations };
    });

    const adaPotongStok = hasil.allocations.length > 0;

    return {
      success: true,
      message: adaPotongStok
        ? `Invoice ${hasil.invoice.invoiceNumber} dibuat; stok sudah dipotong (FEFO).`
        : `Invoice ${hasil.invoice.invoiceNumber} dibuat (semua item jasa, tidak ada stok yang dipotong).`,
      data: {
        invoiceId: hasil.invoice.id,
        invoiceNumber: hasil.invoice.invoiceNumber,
        totalAmount: hasil.invoice.totalAmount.toString(),
        allocations: hasil.allocations,
      },
    };
  } catch (error) {
    if (error instanceof InvoiceStokError) {
      return { success: false, message: error.message };
    }
    if (error instanceof StokBerubahError) {
      return { success: false, message: error.message };
    }
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        message: "Nomor invoice bentrok. Silakan ulangi.",
      };
    }
    return {
      success: false,
      message: "Gagal membuat invoice.",
      error: pesanErrorUmum(error),
    };
  }
}

// Ubah status invoice (maju/mundur satu langkah; tidak mengubah stok).
export async function updateInvoiceStatus(
  input: unknown,
): Promise<ActionResponse<{ invoiceId: string; status: string }>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = updateInvoiceStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { invoiceId, status } = parsed.data;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: akses.tenantId },
      select: { id: true, status: true },
    });
    if (!invoice) {
      return { success: false, message: "Invoice tidak ditemukan." };
    }
    if (invoice.status === status) {
      return { success: false, message: "Status invoice sudah sama." };
    }
    if (!bolehkanTransisi(invoice.status, status)) {
      const dari = INVOICE_STATUS_LABELS[invoice.status as keyof typeof INVOICE_STATUS_LABELS];
      const ke = INVOICE_STATUS_LABELS[status];
      return {
        success: false,
        message: `Perubahan status ${dari} → ${ke} tidak diizinkan.`,
      };
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status,
        // paidAt mengikuti status PAID (dasar "Pendapatan Bulan Ini" di Dashboard Owner).
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
        ...(invoice.status === "PAID" && status !== "PAID" ? { paidAt: null } : {}),
      },
    });

    return {
      success: true,
      message: `Status invoice diubah ke ${INVOICE_STATUS_LABELS[status]}.`,
      data: { invoiceId: invoice.id, status },
    };
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { success: false, message: "Invoice tidak ditemukan." };
    }
    return {
      success: false,
      message: "Gagal mengubah status invoice.",
      error: pesanErrorUmum(error),
    };
  }
}

// Hapus invoice DRAFT + kembalikan stok ke batch asal.
export async function deleteInvoice(
  input: unknown,
): Promise<ActionResponse<{ invoiceId: string; stokDikembalikan: number }>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = deleteInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: parsed.data.invoiceId, tenantId: akses.tenantId },
      select: { id: true, status: true, invoiceNumber: true },
    });
    if (!invoice) {
      return { success: false, message: "Invoice tidak ditemukan." };
    }
    if (invoice.status !== "DRAFT") {
      return {
        success: false,
        message: "Hanya invoice berstatus Draft yang bisa dihapus.",
      };
    }

    const hasil = await prisma.$transaction(async (tx) => {
      const kembali = await kembalikanStokDariReferensi(tx, {
        tenantId: akses.tenantId,
        reference: invoice.invoiceNumber,
        notes: `Pembatalan invoice ${invoice.invoiceNumber}`,
      });
      await tx.invoice.delete({ where: { id: invoice.id } });
      return kembali;
    });

    return {
      success: true,
      message: `Invoice ${invoice.invoiceNumber} dihapus; ${hasil.totalDikembalikan} unit stok dikembalikan ke ${hasil.jumlahBatch} batch.`,
      data: {
        invoiceId: invoice.id,
        stokDikembalikan: hasil.totalDikembalikan,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menghapus invoice.",
      error: pesanErrorUmum(error),
    };
  }
}
