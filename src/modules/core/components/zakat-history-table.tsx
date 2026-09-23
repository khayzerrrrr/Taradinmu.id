import { Fragment } from "react";
import { History } from "lucide-react";
import type { ZakatType } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRupiah, formatTanggal } from "@/lib/format";
import type { ZakatHistoryItem } from "../types";

const JENIS_LABELS: Record<ZakatType, string> = {
  TRADE: "Perniagaan",
  SAVINGS: "Simpanan",
  GOLD: "Emas & Perak",
  INCOME: "Penghasilan",
  AGRICULTURE: "Pertanian",
  LIVESTOCK: "Peternakan",
};

// Nama bulan ditulis eksplisit, bukan lewat Intl, supaya hasilnya tidak
// bergantung pada kelengkapan data ICU di runtime (server vs browser).
const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/** Judul kelompok periode. Baris lama (sebelum migrasi) belum punya periode. */
function labelPeriode(item: ZakatHistoryItem): string {
  if (item.periodYear === null || item.periodMonth === null) {
    return "Tanpa periode";
  }
  return `${NAMA_BULAN[item.periodMonth - 1]} ${item.periodYear}`;
}

const JUMLAH_KOLOM = 6;

export function ZakatHistoryTable({ items }: { items: ZakatHistoryItem[] }) {
  // Penanda periode terakhir yang sudah diberi judul kelompok. Server sudah
  // mengurutkan baris per periode (menurun), jadi satu kali jalan cukup untuk
  // menyisipkan judul setiap kali periode berubah.
  let periodeSebelumnya: string | null = null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border p-3">
        <h2 className="text-sm font-medium">Riwayat Zakat</h2>
        <p className="text-xs text-muted-foreground">
          Perhitungan yang sudah ditandai dibayar, dikelompokkan per periode
          (maks. 20 terakhir).
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead className="text-right">Harta / Laba Bersih</TableHead>
            <TableHead className="text-right">Nisab</TableHead>
            <TableHead className="text-right">Zakat Terutang</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={JUMLAH_KOLOM}>
                <EmptyState
                  icon={History}
                  title="Belum ada riwayat zakat"
                  description="Tandai zakat sebagai sudah dibayar untuk menyimpan riwayatnya di sini."
                />
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const periode = labelPeriode(item);
              const periodeBaru = periode !== periodeSebelumnya;
              periodeSebelumnya = periode;

              return (
                <Fragment key={item.id}>
                  {periodeBaru ? (
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableCell
                        colSpan={JUMLAH_KOLOM}
                        className="text-xs font-semibold tracking-wide uppercase"
                      >
                        {periode}
                      </TableCell>
                    </TableRow>
                  ) : null}

                  <TableRow>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatTanggal(item.calculationDate)}
                    </TableCell>
                    <TableCell>{JENIS_LABELS[item.type]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah(item.netAssets)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatRupiah(item.nisab)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatRupiah(item.zakatDue)}
                    </TableCell>
                    <TableCell>
                      {item.isPaid ? (
                        <Badge variant="default">Sudah Dibayar</Badge>
                      ) : (
                        <Badge variant="warning">Belum Dibayar</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
