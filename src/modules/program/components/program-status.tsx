import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProgramStatusValue } from "../types";
import { LABEL_STATUS } from "../utils";

// Tampilan status + kemajuan program. Tanpa "use client": komponen ini ikut
// dipakai Server Component (halaman detail) maupun Client Component (daftar).

const WARNA_STATUS: Record<ProgramStatusValue, string> = {
  PLANNING: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  COMPLETED: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  CANCELLED: "bg-destructive/15 text-destructive",
};

export function ProgramStatusBadge({ status }: { status: ProgramStatusValue }) {
  return (
    <Badge className={cn("border-0", WARNA_STATUS[status])}>
      {LABEL_STATUS[status]}
    </Badge>
  );
}

type PropsProgres = {
  /** 0–100 lebih juga sah; dipotong ke 100 agar bilah tidak meluber. */
  persen: number | null;
  label: string;
  /** true bila angka melebihi target/anggaran — warnanya berubah, bukan angkanya. */
  melewati?: boolean;
};

/**
 * Bilah kemajuan target. `persen === null` berarti targetnya belum dipasang:
 * yang ditampilkan adalah garis kosong bertuliskan "tanpa target", bukan 0% —
 * 0% menyiratkan "belum ada yang masuk", padahal pengguna memang tidak
 * menargetkan angka.
 */
export function ProgramProgres({ persen, label, melewati }: PropsProgres) {
  if (persen === null) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground italic">
          Target belum dipasang
        </span>
      </div>
    );
  }

  const lebar = Math.max(0, Math.min(100, persen));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            melewati ? "text-destructive" : "text-foreground",
          )}
        >
          {persen.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={lebar}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn(
            "h-full rounded-full transition-width",
            melewati ? "bg-destructive" : "bg-primary-solid",
          )}
          style={{ width: `${lebar}%` }}
        />
      </div>
    </div>
  );
}
