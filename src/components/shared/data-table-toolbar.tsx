import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Kelompok kiri: pencarian, filter, dan penyaring lain. */
  children?: ReactNode;
  /** Kelompok kanan: aksi yang mengubah data. */
  aksi?: ReactNode;
  className?: string;
};

/**
 * Bilah alat di atas tabel. Dipisahkan dari tabel itu sendiri supaya markup
 * tabel tetap murni dan lebar kolomnya tidak terpengaruh oleh kontrol filter.
 */
export function DataTableToolbar({ children, aksi, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {aksi ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{aksi}</div>
      ) : null}
    </div>
  );
}
