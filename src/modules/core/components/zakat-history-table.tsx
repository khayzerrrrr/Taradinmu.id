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

export function ZakatHistoryTable({ items }: { items: ZakatHistoryItem[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border p-3">
        <h2 className="text-sm font-medium">Riwayat Zakat</h2>
        <p className="text-xs text-muted-foreground">
          Perhitungan yang sudah ditandai dibayar (maks. 20 terakhir).
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
              <TableCell colSpan={6}>
                <EmptyState
                  icon={History}
                  title="Belum ada riwayat zakat"
                  description="Tandai zakat sebagai sudah dibayar untuk menyimpan riwayatnya di sini."
                />
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
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
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
