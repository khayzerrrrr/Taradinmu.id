"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Loader2} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRupiah } from "@/lib/format";
import { getCalonTautan, tautkanInvoice, tautkanPengeluaran } from "../actions/link-actions";
import type { CalonTautan } from "../types";

type Props = {
  programId: string;
  sebutan: string;
};

/**
 * Dialog taut: memindah `programId` pada invoice/pengeluaran yang SUDAH ada.
 * Tidak ada kolom nominal di sini — itulah sebabnya (PRD 4.F.2) program tidak
 * bisa menghasilkan angka yang berbeda dari pembukuan.
 */
export function TautanDialog({ programId, sebutan }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<CalonTautan>({ invoices: [], expenses: [] });
  const [memuat, setMemuat] = useState(false);
  const [sidang, setSidang] = useState<string | null>(null);

  async function muat() {
    setMemuat(true);
    const hasil = await getCalonTautan({ programId });
    setMemuat(false);
    if (hasil.success) {
      setData(hasil.data ?? { invoices: [], expenses: [] });
      return;
    }
    toast.error(hasil.message);
  }

  // Muat saat dialog dibuka, di handler kejadian — bukan `useEffect`.
  function ubahOpen(next: boolean) {
    setOpen(next);
    if (next) void muat();
  }

  async function onTautInvoice(invoiceId: string) {
    setSidang(invoiceId);
    const hasil = await tautkanInvoice({ programId, invoiceId });
    setSidang(null);
    if (hasil.success) {
      toast.success(hasil.message);
      router.refresh();
      void muat();
      return;
    }
    toast.error(hasil.message);
  }

  async function onTautPengeluaran(expenseId: string) {
    setSidang(expenseId);
    const hasil = await tautkanPengeluaran({ programId, expenseId });
    setSidang(null);
    if (hasil.success) {
      toast.success(hasil.message);
      router.refresh();
      void muat();
      return;
    }
    toast.error(hasil.message);
  }

  const kosong = !memuat && data.invoices.length === 0 && data.expenses.length === 0;

  return (
    <Dialog open={open} onOpenChange={ubahOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Link2 />
          Taut uang
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Taut invoice atau pengeluaran</DialogTitle>
          <DialogDescription>
            Hanya data yang belum menunjuk {sebutan.toLowerCase()} lain yang
            muncul di bawah. Menaut tidak mengubah nominalnya.
          </DialogDescription>
        </DialogHeader>

        {kosong ? (
          <p className="text-sm text-muted-foreground">
            Semua invoice dan pengeluaran toko ini sudah tertaut ke suatu{" "}
            {sebutan.toLowerCase()}.
          </p>
        ) : (
          <Tabs defaultValue="invoice">
            <TabsList>
              <TabsTrigger value="invoice">
                Invoice ({data.invoices.length})
              </TabsTrigger>
              <TabsTrigger value="pengeluaran">
                Pengeluaran ({data.expenses.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invoice">
              <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {data.invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {invoice.label}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatRupiah(invoice.totalAmount)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sidang === invoice.id}
                      onClick={() => void onTautInvoice(invoice.id)}
                    >
                      {sidang === invoice.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Link2 />
                      )}
                      Taut
                    </Button>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="pengeluaran">
              <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {data.expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {expense.label}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatRupiah(expense.amount)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sidang === expense.id}
                      onClick={() => void onTautPengeluaran(expense.id)}
                    >
                      {sidang === expense.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Link2 />
                      )}
                      Taut
                    </Button>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
