import { Package } from "lucide-react";
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
import { formatWaktu } from "@/lib/format";
import type { StockMovementItem } from "../types";

type Props = {
  movements: StockMovementItem[];
  judul?: string;
};

const LABEL: Record<StockMovementItem["type"], string> = {
  IN: "MASUK",
  OUT: "KELUAR",
  ADJUSTMENT: "PENYESUAIAN",
};

// Riwayat pergerakan stok (semua perubahan stok tercatat di StockMovement).
export function MovementTable({ movements, judul }: Props) {
  return (
    <section className="flex flex-col gap-3">
      {judul ? (
        <h2 className="font-heading text-base font-semibold">{judul}</h2>
      ) : null}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Varian</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Referensi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={Package}
                    title="Belum ada pergerakan stok"
                    description="Pergerakan stok akan tercatat di sini."
                  />
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatWaktu(movement.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        movement.type === "IN"
                          ? "default"
                          : movement.type === "OUT"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {LABEL[movement.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">{movement.variantName}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {movement.sku}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {movement.batchNumber}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {movement.type === "OUT" ? "−" : "+"}
                    {movement.quantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {movement.reference ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}
