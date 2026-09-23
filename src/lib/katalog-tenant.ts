import { prisma } from "@/lib/prisma";

// Ringkasan katalog tenant untuk keperluan navigasi.
//
// Ditaruh di src/lib (bukan di dalam modul) supaya layout tenant tetap tipis dan
// tidak perlu tahu soal modul inventory — pola yang sama dengan dashboard-summary.ts.

/**
 * Apakah tenant punya minimal satu item BARANG?
 *
 * Dipakai untuk menyembunyikan menu Stok, Stok Masuk, dan Stok Keluar pada tenant
 * yang hanya menjual jasa (travel umrah, laundry, pendidikan). Menu stok yang
 * selalu kosong membuat aplikasi terasa tidak dirancang untuk mereka, padahal
 * katalog itemnya tetap mereka butuhkan.
 *
 * Katalog sendiri (menu "Produk & Layanan") selalu tampil selama modul aktif.
 */
export async function punyaItemBarang(tenantId: string): Promise<boolean> {
  const jumlah = await prisma.product.count({
    where: { tenantId, kind: "GOODS" },
  });
  return jumlah > 0;
}
