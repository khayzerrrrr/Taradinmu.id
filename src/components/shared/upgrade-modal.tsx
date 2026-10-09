"use client";

import type { ReactNode } from "react";
import { Check, Crown, MessageCircle } from "lucide-react";
import { tautanWa } from "@/lib/contact";
import { formatRupiah } from "@/lib/format";
import { HARGA_PRO_BULAN } from "@/lib/plan-limits";
import {
  SUMBER_BAKU,
  type KunciMinat,
  type SumberMinat,
  type TahapMinat,
} from "@/lib/upgrade-interest";
import { catatMinatUpgrade } from "@/modules/core/actions/upgrade-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Harga dibaca dari plan-limits.ts (sumber tunggal), tidak diketik ulang di sini.
const HARGA = `${formatRupiah(HARGA_PRO_BULAN)} per bulan`;

/**
 * Manfaat yang ditawarkan per kunci (PRD 4.D.3): ajakan harus nyambung dengan
 * yang baru saja diklik orang itu. Kuncinya sengaja dibatasi pada fitur yang
 * SUDAH ada — PRD 4.D.2a melarang modal menjual cicilan, multi-gudang, atau
 * Neraca yang belum dibangun.
 *
 * Satu kosakata dengan pencatatan minat: `KunciPro` adalah `KunciMinat`, jadi
 * gembok yang tercatat di dashboard Super Admin pasti punya daftar manfaatnya di
 * sini. `Record<KunciPro, ...>` di bawah membuat kunci baru tanpa manfaat menjadi
 * error kompilasi, bukan modal yang diam-diam jatuh ke daftar umum.
 */
export type KunciPro = KunciMinat;

export const MANFAAT_KUNCI: Record<KunciPro, readonly string[]> = {
  BATCH: [
    "Nomor batch & tanggal kedaluwarsa untuk tiap pembelian",
    "Stok keluar mengambil yang paling cepat kedaluwarsa lebih dulu (FEFO)",
    "Barang yang mendekati kedaluwarsa muncul di dashboard",
  ],
  ZAKAT: [
    "Penghasilan & beban ditarik sendiri dari invoice lunas — angka yang Anda lihat sekarang tidak perlu dihitung ulang",
    "Riwayat zakat per periode, tersimpan dan siap dicetak",
    "Tandai sudah dibayar tanpa membuka spreadsheet",
  ],
  PROGRAM: [
    "Kelompokkan biaya & tagihan per kloter, proyek, pesanan, atau kelas",
    "Laba per kegiatan, bukan hanya laba toko",
    "Piutang ikut terlacak per kegiatan",
  ],
  HPP: [
    "Margin kotor per invoice: pendapatan dikurangi modal barangnya",
    "Kartu Margin Kotor di dashboard",
    "Ketahuan item mana yang harga jualnya belum menutup modal",
  ],
  USERS: [
    "Tambah kasir, admin, atau akuntan dengan akun sendiri",
    "Tidak perlu berbagi password — dan aksi tiap orang tercatat",
    "Toko tetap jalan tanpa Anda berdiri di kasir",
  ],
  INVOICE: [
    "Invoice tanpa batas 50 per bulan",
    "Nomor tetap berurut saat usaha mulai ramai",
    "Piutang & tanggal jatuh tempo untuk semua pelanggan",
  ],
  PRODUCT: [
    "Katalog lebih dari 100 item (barang maupun jasa)",
    "Varian, SKU, dan stok per varian tanpa batas jumlah",
  ],
  BRANDING: [
    "Logo & warna tema toko Anda di seluruh aplikasi",
    "Invoice yang Anda kirim membawa merek Anda",
  ],
  // Sengaja tidak menyebut "terhubung ke data Anda": asisten AI belum punya
  // akses ke tabel tenant (PRD 4.D.2a). Janjinya harus sebatas yang berjalan.
  AI: [
    "Asisten chat di dalam aplikasi, khusus paket PRO",
    "Penjelasan alur kerja & fitur tanpa keluar dari halaman",
  ],
  // Ajakan yang tidak menyebut satu fitur: halaman "Paket Saya" dan gembok yang
  // tidak punya kunci sendiri. Daftar ini dulunya diam-diam dipakai setiap pemicu
  // yang lupa mengirim `kunci` — sekarang harus disebut terang-terangan.
  UMUM: [
    "Invoice, produk, dan pengguna tanpa batas",
    "Batch + tanggal kedaluwarsa (FEFO)",
    "Zakat penghasilan otomatis + riwayat per periode",
    "Program: kloter, proyek & tahun ajaran",
    "Laporan margin & HPP per invoice",
    "Branding kustom (logo & warna)",
  ],
};

type Props = {
  /** Elemen pemicu; modal terbuka saat diklik. */
  children: ReactNode;
  /** Kunci gating; menentukan daftar manfaat yang ditampilkan. */
  kunci: KunciPro;
  /** Nama fitur yang dikunci, untuk konteks pesan ke admin. */
  fitur?: string;
  /**
   * Permukaan UI tempat gemboknya berada, untuk pencatatan minat (PRD 4.D.5).
   * Dari daftar tertutup `SUMBER_MINAT` — bukan teks bebas, supaya tabel minat
   * tidak pernah menampung data tenant.
   */
  sumber?: SumberMinat;
};

/**
 * Catat satu peristiwa minat. `void` + `.catch()` disengaja: pencatatan ini
 * tidak boleh mengubah apa pun yang dilihat pengguna, dan kegagalan Server
 * Action tidak boleh muncul sebagai error konsol di tengah modal upgrade.
 */
function catat(
  kunci: KunciMinat,
  sumber: SumberMinat,
  tahap: TahapMinat,
): void {
  void catatMinatUpgrade({ kunci, sumber, tahap }).catch(() => undefined);
}

/**
 * Modal ajakan upgrade (PRD Bagian 4.D). Sengaja dibuat sebagai "godaan" —
 * mahkota amber, manfaat yang sesuai fitur yang diklik, harga yang jelas, dan
 * satu tombol ke WhatsApp admin — bukan pesan error yang membuat pengguna
 * frustrasi.
 */
export function UpgradeModal({ children, kunci, fitur, sumber }: Props) {
  const manfaat = MANFAAT_KUNCI[kunci];
  const sumberMinat = sumber ?? SUMBER_BAKU;
  const pesan = `Assalamualaikum, saya ingin mengaktifkan TaradinMu PRO (${HARGA})${
    fitur ? ` untuk fitur ${fitur}` : ""
  }. Bagaimana proses pembayarannya?`;
  const waUrl = tautanWa(pesan);

  return (
    <Dialog
      onOpenChange={(terbuka) => {
        if (terbuka) catat(kunci, sumberMinat, "BUKA");
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        overlayClassName="backdrop-blur-sm"
      >
        <DialogHeader>
          <span className="flex size-10 items-center justify-center rounded-lg bg-brand-accent/15 text-brand-accent">
            <Crown aria-hidden="true" className="size-5" />
          </span>
          <DialogTitle className="text-base">
            Buka Fitur TaradinMu PRO
          </DialogTitle>
          <DialogDescription>
            {fitur
              ? `${fitur} tersedia pada paket PRO — ${HARGA}.`
              : `Semua fitur tambahan terbuka pada paket PRO — ${HARGA}.`}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2.5">
          {manfaat.map((manfaat) => (
            <li key={manfaat} className="flex items-start gap-2.5 text-sm">
              <Check
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-primary-solid"
              />
              <span>{manfaat}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild size="lg" className="w-full">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => catat(kunci, sumberMinat, "CTA")}
            >
              <MessageCircle />
              Aktifkan TaradinMu Pro
            </a>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {HARGA}. Anda akan diarahkan ke WhatsApp Admin TaradinMu untuk
            pembayaran dan aktivasi.
          </p>
          <DialogClose asChild>
            <Button variant="ghost" className="w-full">
              Nanti saja
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
