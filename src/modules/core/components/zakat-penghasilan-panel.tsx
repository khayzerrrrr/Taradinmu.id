"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/shared/metric-card";
import { LockedFeature } from "@/components/shared/locked-feature";
import { formatRupiah } from "@/lib/format";
import { tandaiZakatDibayar } from "../actions/zakat-actions";
import type { ZakatPenghasilan } from "../types";

type Props = {
  data: ZakatPenghasilan | null;
  pesan?: string;
  /**
   * Paket FREE: semua angka di atas tetap terbaca; yang dikunci hanyalah aksi
   * mencatat ke riwayat (PRD 4.D — kunci kemampuan, bukan kebenaran).
   */
  terkunciPro?: boolean;
};

export function ZakatPenghasilanPanel({
  data,
  pesan,
  terkunciPro = false,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function bayar() {
    setSubmitting(true);
    const result = await tandaiZakatDibayar({ type: "INCOME" });
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      router.refresh();
      return;
    }
    if (result.code === "UPGRADE_REQUIRED") {
      toast.error(result.message, { duration: 8000 });
      return;
    }
    toast.error(result.message);
  }

  if (!data) {
    return (
      <p className="text-sm text-destructive">
        {pesan ?? "Data zakat penghasilan tidak tersedia."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Pendapatan (Invoice Lunas)"
          value={formatRupiah(data.pendapatan)}
          hint={`${data.jumlahInvoice} invoice lunas bulan ini`}
          icon={TrendingUp}
        />
        <MetricCard
          label="Beban Usaha"
          value={formatRupiah(data.bebanOperasional)}
          hint={
            data.pembelianStok > 0
              ? `${data.jumlahPengeluaran} pengeluaran · di luar pembelian stok ${formatRupiah(
                  data.pembelianStok,
                )} yang masih jadi aset`
              : `${data.jumlahPengeluaran} pengeluaran bulan ini`
          }
          icon={TrendingDown}
          style={{ animationDelay: "60ms" }}
        />
        <MetricCard
          label="Laba Bersih"
          value={formatRupiah(data.labaBersih)}
          hint={`Pendapatan − beban usaha − HPP ${formatRupiah(data.hpp)} · periode ${data.periode}`}
          icon={Wallet}
          style={{ animationDelay: "120ms" }}
        />
      </div>

      {/* Highlight: estimasi zakat 2,5% dari laba bersih. */}
      <Card className="border-primary bg-primary-subtle">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            Estimasi Zakat 2,5%
            {data.mencapaiNisab ? (
              <Badge variant="default">Mencapai nisab</Badge>
            ) : (
              <Badge variant="warning">Di bawah nisab</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Zakat terutang
            </span>
            <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
              {formatRupiah(data.terutang)}
            </span>
            <span className="text-xs text-muted-foreground">
              2,5% × laba bersih {formatRupiah(data.labaBersih)} ={" "}
              {formatRupiah(data.estimasi)}
            </span>
          </div>

          {/* Jujur soal data yang belum lengkap: HPP 0 bukan berarti margin 100%. */}
          {data.unitModalBelumTercatat > 0 ? (
            <p className="text-xs text-muted-foreground">
              {data.unitModalBelumTercatat} unit yang sudah keluar belum punya
              catatan harga modal, jadi HPP — dan laba bersih di atas — masih
              kurang besar.
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Nisab bulan ini {formatRupiah(data.nisab)} (setara 85 gram emas per
            tahun ÷ 12).{" "}
            {data.mencapaiNisab
              ? "Laba bersih sudah mencapai nisab, zakat wajib ditunaikan."
              : "Laba bersih belum mencapai nisab, sehingga belum wajib dizakati — angka di atas hanya estimasi."}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <LockedFeature
              isLocked={terkunciPro}
              fitur="Zakat Penghasilan (Otomatis)"
              kunci="ZAKAT"
              judul="Zakat otomatis & riwayat: khusus PRO"
              deskripsi="Angkanya sudah Anda lihat di atas. Yang PRO: data ditarik sendiri dari invoice lunas setiap kali, dan pembayarannya tercatat sebagai riwayat per periode yang siap dicetak."
            >
              <Button
                type="button"
                size="lg"
                disabled={submitting}
                onClick={() => void bayar()}
              >
                <BadgeCheck />
                {submitting ? "Menyimpan..." : "Tandai Sudah Dibayar"}
              </Button>
            </LockedFeature>
            <span className="text-xs text-muted-foreground">
              Menyimpan riwayat ke tabel ZakatCalculation.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
