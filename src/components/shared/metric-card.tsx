import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  /** Sudah diformat di sisi pemanggil (mata uang, jumlah, dll). */
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
  style?: CSSProperties;
};

/**
 * Kartu metrik untuk ringkasan angka. Angka memakai `tabular-nums` supaya
 * digitnya tidak bergeser saat nilai berubah, dan `size-2xl` agar langsung
 * terbaca sebagai informasi utama kartu.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon: Ikon,
  className,
  style,
}: Props) {
  return (
    <Card className={cn("animate-masuk", className)} style={style}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums text-foreground">
            {value}
          </span>
          {hint ? (
            <span className="truncate text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </div>

        {Ikon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Ikon aria-hidden="true" className="size-4" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
