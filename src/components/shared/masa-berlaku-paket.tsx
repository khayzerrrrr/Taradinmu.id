import { CalendarClock } from "lucide-react";
import type { MasaBerlakuPaket } from "@/lib/plan-status";

// Kalimat masa berlaku paket (PRD 4.D.4).
//
// Dipakai oleh halaman "Paket Saya" DAN tabel Super Admin, dari berkas yang sama,
// supaya penyewa dan admin tidak pernah membaca tanggal yang sama dengan kata yang
// berbeda. `masa` boleh `null`: FREE tanpa masa berlaku memang tidak punya apa pun
// untuk dikatakan, dan komponen ini yang menutup dirinya — bukan JSX pemanggil.

type Props = {
  masa: MasaBerlakuPaket | null;
  className?: string;
};

export function MasaBerlakuPaketNotice({ masa, className }: Props) {
  if (!masa) return null;
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${
        masa.mendesak ? "font-medium text-warning" : "text-muted-foreground"
      } ${className ?? ""}`}
    >
      <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
      {masa.kalimat}
    </p>
  );
}
