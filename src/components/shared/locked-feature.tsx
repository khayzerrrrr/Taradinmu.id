"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { UpgradeModal, type KunciPro } from "./upgrade-modal";

type Props = {
  /** Bila true, konten diburamkan dan ditutup overlay gembok. */
  isLocked: boolean;
  children: ReactNode;
  /** Nama fitur untuk konteks pesan upgrade. */
  fitur?: string;
  /** Kunci gating, untuk daftar manfaat yang sesuai di modal. */
  kunci?: KunciPro;
  judul?: string;
  deskripsi?: string;
};

/**
 * Pembungkus fitur berbayar (PRD Bagian 4.D).
 *
 * Konten tetap dirender sebagai pratinjau (buram) supaya pengguna tahu apa yang
 * mereka dapatkan — bukan sekadar disembunyikan. Seluruh overlay bisa diklik dan
 * langsung membuka modal upgrade; konten di belakangnya tidak bisa dipakai
 * (pointer-events dimatikan). Penegakan sebenarnya tetap di Server Action.
 */
export function LockedFeature({
  isLocked,
  children,
  fitur,
  kunci,
  judul,
  deskripsi,
}: Props) {
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none opacity-60 blur-[3px] select-none"
      >
        {children}
      </div>

      {/* Seluruh area overlay adalah pemicu modal, jadi klik di mana pun bekerja. */}
      <UpgradeModal fitur={fitur} kunci={kunci}>
        <button
          type="button"
          aria-label={`${fitur ?? "Fitur ini"} khusus paket PRO — buka opsi upgrade`}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg p-6 text-center outline-none transition-colors hover:bg-background/40 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-brand-accent shadow-card">
            <Lock aria-hidden="true" className="size-5" />
          </span>

          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium">
              {judul ?? `${fitur ?? "Fitur ini"} khusus paket PRO`}
            </span>
            {deskripsi ? (
              <span className="max-w-sm text-xs text-balance text-muted-foreground">
                {deskripsi}
              </span>
            ) : null}
          </span>

          {/* Tampil seperti tombol; elemen yang benar-benar diklik adalah overlay
              di atasnya, sehingga tidak ada <button> bersarang. */}
          <span className="mt-1 inline-flex h-11 items-center gap-2 rounded-md bg-primary-solid px-5 text-sm font-medium text-primary-foreground">
            <Lock aria-hidden="true" className="size-4" />
            Upgrade ke PRO
          </span>
        </button>
      </UpgradeModal>
    </div>
  );
}
