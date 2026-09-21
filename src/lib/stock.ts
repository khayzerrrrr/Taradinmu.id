// Helper stok MURNI (aman dipakai client maupun server).
// Ditaruh di src/lib supaya modul inventory & billing bisa memakainya bersama
// tanpa saling mengimpor (PRD Bagian 6).

// Ambang stok menipis (idealnya nanti jadi pengaturan per tenant).
export const LOW_STOCK_THRESHOLD = 10;
// Ambang "hampir kedaluwarsa" dalam hari.
export const EXPIRING_SOON_DAYS = 30;

const SATU_HARI_MS = 24 * 60 * 60 * 1000;

export type StokBatchRingkas = {
  quantity: number;
  expiredDate: Date | string | null;
};

export type RingkasanStok = {
  total: number;
  layak: number;
  kedaluwarsa: number;
  expiryTerdekat: Date | null;
  segeraKedaluwarsa: boolean;
};

function keDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

// Batch dianggap kedaluwarsa bila hari kedaluwarsanya sudah lewat
// (batch yang kedaluwarsa HARI INI masih layak dipakai).
export function isExpired(
  expiredDate: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiredDate) return false;
  const date = keDate(expiredDate);
  if (Number.isNaN(date.getTime())) return false;
  const akhirHari = new Date(date);
  akhirHari.setUTCHours(23, 59, 59, 999);
  return akhirHari.getTime() < now.getTime();
}

export function isExpiringSoon(
  expiredDate: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiredDate) return false;
  const date = keDate(expiredDate);
  if (Number.isNaN(date.getTime())) return false;
  if (isExpired(date, now)) return false;
  return date.getTime() <= now.getTime() + EXPIRING_SOON_DAYS * SATU_HARI_MS;
}

// "YYYY-MM-DD" -> awal hari UTC (konsisten untuk perbandingan tanggal).
export function parseTanggalInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

// Ringkas sekumpulan batch: total, yang layak keluar, yang kedaluwarsa,
// dan kedaluwarsa terdekat (hanya dari batch yang masih layak dan bersisa).
export function ringkasStok(
  batches: StokBatchRingkas[],
  now: Date = new Date(),
): RingkasanStok {
  let total = 0;
  let layak = 0;
  let kedaluwarsa = 0;
  let expiryTerdekat: Date | null = null;
  let segeraKedaluwarsa = false;

  for (const batch of batches) {
    total += batch.quantity;

    if (isExpired(batch.expiredDate, now)) {
      kedaluwarsa += batch.quantity;
      continue;
    }

    layak += batch.quantity;

    if (batch.quantity > 0 && batch.expiredDate) {
      const tanggal = keDate(batch.expiredDate);
      if (!expiryTerdekat || tanggal < expiryTerdekat) expiryTerdekat = tanggal;
      if (isExpiringSoon(tanggal, now)) segeraKedaluwarsa = true;
    }
  }

  return { total, layak, kedaluwarsa, expiryTerdekat, segeraKedaluwarsa };
}
