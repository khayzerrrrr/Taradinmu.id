import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  /** Aksi utama halaman (mis. tombol "Tambah Produk"). */
  aksi?: ReactNode;
  className?: string;
};

/**
 * Kepala halaman: judul, penjelasan singkat, dan aksi utama.
 * Satu-satunya tempat di aplikasi yang memakai tingkat judul `text-lg` —
 * halaman-halaman lain merujuk ke sini agar skalanya tidak menyimpang.
 */
export function PageHeader({ title, description, aksi, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {aksi ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{aksi}</div>
      ) : null}
    </div>
  );
}
