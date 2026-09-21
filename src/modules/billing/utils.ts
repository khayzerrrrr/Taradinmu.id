import type { InvoiceStatusValue } from "./types";

// Helper murni modul billing.

export { formatRupiah } from "@/lib/format";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatusValue, string> = {
  DRAFT: "Draft",
  SENT: "Terkirim",
  PAID: "Lunas",
  OVERDUE: "Jatuh Tempo",
};

// Status yang benar-benar disimpan di database.
export type StatusInti = "DRAFT" | "SENT" | "PAID";

// Transisi sah: maju DAN boleh mundur satu langkah (keputusan produk).
// DRAFT boleh langsung ke PAID (invoice dibuat lalu dibayar seketika).
export const TRANSISI_STATUS: Record<StatusInti, readonly StatusInti[]> = {
  DRAFT: ["SENT", "PAID"],
  SENT: ["PAID", "DRAFT"],
  PAID: ["SENT"],
};

export function bolehkanTransisi(dari: string, ke: string): boolean {
  if (dari !== "DRAFT" && dari !== "SENT" && dari !== "PAID") return false;
  return (TRANSISI_STATUS[dari] as readonly string[]).includes(ke);
}

// Aksi yang ditawarkan UI untuk sebuah status.
export function transisiBerikutnya(dari: StatusInti): readonly StatusInti[] {
  return TRANSISI_STATUS[dari];
}

export function round2(nilai: number): number {
  return Math.round(nilai * 100) / 100;
}

// Hitung subtotal, PPN, dan total invoice.
export function hitungTotal(
  items: { quantity: number; price: number }[],
  taxPercent: number,
): { subtotal: number; taxAmount: number; totalAmount: number } {
  const subtotal = round2(
    items.reduce((total, item) => total + item.quantity * item.price, 0),
  );
  const taxAmount = round2((subtotal * taxPercent) / 100);
  return { subtotal, taxAmount, totalAmount: round2(subtotal + taxAmount) };
}

// Kode pendek tenant untuk nomor invoice (invoiceNumber unik GLOBAL).
export function kodeTenant(slug: string): string {
  const kode = slug.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();
  return kode.length > 0 ? kode : "TOKO";
}
