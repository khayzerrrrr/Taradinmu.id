"use client";

import type { ReactNode } from "react";
import { Check, Crown, MessageCircle } from "lucide-react";
import { tautanWa } from "@/lib/contact";
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

const MANFAAT = [
  "Invoice & produk tanpa batas",
  "Batch + tanggal kedaluwarsa",
  "Zakat otomatis & laporan keuangan",
  "Branding kustom (logo & warna)",
];

type Props = {
  /** Elemen pemicu; modal terbuka saat diklik. */
  children: ReactNode;
  /** Nama fitur yang dikunci, untuk konteks pesan ke admin. */
  fitur?: string;
};

/**
 * Modal ajakan upgrade (PRD Bagian 4.D). Sengaja dibuat sebagai "godaan" —
 * mahkota amber, daftar manfaat, dan satu tombol jelas ke WhatsApp admin —
 * bukan pesan error yang membuat pengguna frustrasi.
 */
export function UpgradeModal({ children, fitur }: Props) {
  const pesan = `Assalamualaikum, saya ingin mengaktifkan TaradinMu PRO${
    fitur ? ` untuk fitur ${fitur}` : ""
  }. Mohon informasi paket dan harganya.`;
  const waUrl = tautanWa(pesan);

  return (
    <Dialog>
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
              ? `Fitur ${fitur} tersedia pada paket PRO.`
              : "Buka semua fitur TaradinMu untuk usaha Anda."}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2.5">
          {MANFAAT.map((manfaat) => (
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
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              Aktifkan TaradinMu Pro
            </a>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Anda akan diarahkan ke WhatsApp Admin TaradinMu.
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
