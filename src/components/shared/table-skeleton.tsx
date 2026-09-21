import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = {
  baris?: number;
  kolom?: number;
  className?: string;
};

/**
 * Rangka tabel untuk `loading.tsx`. Tingginya sengaja menyerupai tabel asli
 * (kepala 36px, baris 44px) agar tidak ada lompatan tata letak saat data tiba.
 */
export function TableSkeleton({ baris = 5, kolom = 4, className }: Props) {
  return (
    <div className={cn("flex flex-col", className)} aria-hidden="true">
      <div className="flex h-9 items-center gap-4 border-b border-border px-3">
        {Array.from({ length: kolom }, (_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 flex-1" />
        ))}
      </div>

      {Array.from({ length: baris }, (_, r) => (
        <div
          key={`r-${r}`}
          className="flex h-11 items-center gap-4 border-b border-border px-3 last:border-b-0"
        >
          {Array.from({ length: kolom }, (_, c) => (
            <Skeleton
              key={`c-${r}-${c}`}
              className={cn("h-4 flex-1", c === 0 && "max-w-[40%]")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
