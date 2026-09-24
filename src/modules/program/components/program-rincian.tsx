"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Unlink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { lepasTautan } from "../actions/link-actions";
import type { ProgramDetail } from "../types";
import { PesertaDialog } from "./peserta-dialog";

type Props = {
  detail: ProgramDetail;
  /** Sebutan peserta untuk industri ini (Jamaah / Siswa / Klien / Tamu). */
  sebutan: string;
  /** Sebutan programnya sendiri (Kloter / Proyek / Tahun Ajaran). Teks soal
   *  uang merujuk ke sini, bukan ke peserta — kalau tertukar, hint "dana
   *  terpakai" jadi terdengar seperti menaut orang. */
  sebutanProgram: string;
  bolehMenulis: boolean;
};

export function ProgramRincian({
  detail,
  sebutan,
  sebutanProgram,
  bolehMenulis,
}: Props) {
  const router = useRouter();
  const [sidang, setSidang] = useState<string | null>(null);

  async function onLepas(jenis: "invoice" | "pengeluaran", id: string) {
    setSidang(id);
    const hasil = await lepasTautan({
      programId: detail.id,
      ...(jenis === "invoice" ? { invoiceIds: [id] } : { expenseIds: [id] }),
    });
    setSidang(null);
    if (hasil.success) {
      toast.success(hasil.message);
      router.refresh();
      return;
    }
    toast.error(hasil.message);
  }

  function tombolLepas(jenis: "invoice" | "pengeluaran", id: string) {
    if (!bolehMenulis) return null;
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={sidang === id}
        onClick={() => void onLepas(jenis, id)}
      >
        {sidang === id ? <Loader2 className="animate-spin" /> : <Unlink />}
        Lepas
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">
            {sebutan} ({detail.peserta.length})
          </CardTitle>
          <PesertaDialog
            programId={detail.id}
            peserta={detail.peserta}
            sebutan={sebutan}
            bolehMenulis={bolehMenulis}
          />
        </CardHeader>
        <CardContent className="p-0">
          {detail.peserta.length === 0 ? (
            <EmptyState
              title={`Belum ada ${sebutan.toLowerCase()}`}
              description={`Tambahkan dari daftar Pelanggan — tidak perlu membuat data orang baru.`}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Bergabung</TableHead>
                  <TableHead className="text-right">Tagihan belum lunas</TableHead>
                  <TableHead>Catatan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.peserta.map((orang) => (
                  <TableRow key={orang.customerId}>
                    <TableCell className="font-medium">{orang.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {orang.phone ?? orang.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTanggal(orang.joinedAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {orang.tagihanBelumLunas > 0 ? (
                        <Badge variant="outline">{orang.tagihanBelumLunas}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {orang.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">
            Invoice tertaut ({detail.linkedInvoiceCount})
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Terkumpul {formatRupiah(detail.collected)} dari{" "}
            {detail.paidInvoiceCount} invoice lunas
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {detail.invoices.length === 0 ? (
            <EmptyState
              title="Belum ada invoice tertaut"
              description={`Taut invoice yang sudah ada, atau buat invoice baru untuk ${sebutanProgram.toLowerCase()} ini lalu tautkan.`}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Invoice</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>{invoice.customerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah(invoice.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {tombolLepas("invoice", invoice.id)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">
            Pengeluaran tertaut ({detail.expenseCount})
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Terpakai {formatRupiah(detail.spent)}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {detail.expenses.length === 0 ? (
            <EmptyState
              title="Belum ada pengeluaran tertaut"
              description={`Pengeluaran yang menaut ${sebutanProgram.toLowerCase()} ini dihitung sebagai dana terpakai.`}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">
                      {expense.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{expense.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTanggal(expense.date)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah(expense.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {tombolLepas("pengeluaran", expense.id)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
