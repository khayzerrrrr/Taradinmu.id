import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Aksi pemulihan, mis. tombol "Tambah Produk" atau "Hapus filter". */
  aksi?: ReactNode;
  className?: string;
};

/**
 * Keadaan kosong. Salah satu dari dua tempat yang boleh rata tengah —
 * bersama halaman autentikasi — karena di sini tidak ada aliran teks yang
 * perlu dijaga rata kirinya.
 */
export function EmptyState({ icon: Ikon, title, description, aksi, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {Ikon ? (
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Ikon aria-hidden="true" className="size-5" />
        </span>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-balance text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {aksi ? <div className="mt-1 flex items-center gap-2">{aksi}</div> : null}
    </div>
  );
}
