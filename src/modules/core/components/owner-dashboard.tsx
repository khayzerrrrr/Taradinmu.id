import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Coins,
  HeartHandshake,
  Lock,
  PackageX,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RingkasanOwner } from "@/lib/dashboard-summary";
import { formatRupiah, formatTanggal } from "@/lib/format";

type Props = {
  ringkasan: RingkasanOwner;
  basePath: string;
};

// Kartu ringkasan Dashboard Owner. Menerima DATA saja (tidak mengimpor modul lain).
export function OwnerDashboard({ ringkasan, basePath }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Metrik utama: pendapatan, arus kas, piutang, zakat, stok menipis. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label="Total Pendapatan"
          value={
            ringkasan.billingAktif
              ? formatRupiah(ringkasan.totalPendapatan)
              : "—"
          }
          hint={
            ringkasan.billingAktif
              ? `Bulan ini ${formatRupiah(ringkasan.pendapatanBulanIni)} · ${ringkasan.jumlahInvoiceLunasBulanIni} invoice lunas`
              : "Modul Billing belum aktif"
          }
          icon={TrendingUp}
          style={{ animationDelay: "0ms" }}
        />

        <MetricCard
          label="Arus Kas Bulan Ini"
          value={
            ringkasan.accountingAktif
              ? formatRupiah(ringkasan.arusKasBulanIni)
              : "—"
          }
          hint={
            ringkasan.accountingAktif
              ? `Masuk ${formatRupiah(ringkasan.pendapatanBulanIni)} − keluar ${formatRupiah(ringkasan.pengeluaranBulanIni)}`
              : "Modul Akuntansi belum aktif"
          }
          icon={Coins}
          style={{ animationDelay: "40ms" }}
        />

        <MetricCard
          label="Piutang"
          value={ringkasan.billingAktif ? formatRupiah(ringkasan.piutang) : "—"}
          hint={
            ringkasan.billingAktif
              ? `${ringkasan.jumlahInvoiceBelumBayar} invoice terkirim belum dibayar`
              : "Modul Billing belum aktif"
          }
          icon={Wallet}
          style={{ animationDelay: "80ms" }}
        />

        <MetricCard
          label="Stok Menipis"
          value={
            ringkasan.inventoryAktif
              ? String(ringkasan.stokMenipis.length)
              : "—"
          }
          hint={
            ringkasan.inventoryAktif
              ? `Varian pada atau di bawah ${ringkasan.ambangStokMenipis} unit`
              : "Modul Inventory belum aktif"
          }
          icon={PackageX}
          style={{ animationDelay: "120ms" }}
        />

        <MetricCard
          label="Estimasi Zakat"
          value={
            ringkasan.estimasiZakat === null
              ? "—"
              : formatRupiah(ringkasan.estimasiZakat)
          }
          hint={
            ringkasan.estimasiZakat === null
              ? "Fitur PRO: zakat otomatis"
              : `2,5% dari laba bersih bulan ini${
                  ringkasan.mencapaiNisabZakat
                    ? " · mencapai nisab"
                    : ` · di bawah nisab ${formatRupiah(ringkasan.nisabZakat)}`
                }`
          }
          icon={HeartHandshake}
          style={{ animationDelay: "160ms" }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Varian Stok Menipis</CardTitle>
            <CardDescription>
              Perlu segera ditambah agar tidak kehabisan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!ringkasan.inventoryAktif ? (
              <Terkunci modul="Inventory" basePath={basePath} />
            ) : ringkasan.stokMenipis.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="Stok masih aman"
                description="Tidak ada varian yang menyentuh ambang batas."
                className="py-8"
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {ringkasan.stokMenipis.map((item) => (
                  <li
                    key={item.variantId}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{item.variantName}</span>
                      <span className="truncate text-xs tabular-nums text-muted-foreground">
                        {item.sku}
                      </span>
                    </span>
                    <Badge variant="danger" className="shrink-0 tabular-nums">
                      {item.tersedia} unit
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hampir Kedaluwarsa</CardTitle>
            <CardDescription>
              Batch yang kedaluwarsa dalam {ringkasan.ambangHampirKedaluwarsaHari} hari
              ke depan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!ringkasan.inventoryAktif ? (
              <Terkunci modul="Inventory" basePath={basePath} />
            ) : ringkasan.hampirKedaluwarsa.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="Belum ada yang mendekati kedaluwarsa"
                description={`Tidak ada batch dalam ${ringkasan.ambangHampirKedaluwarsaHari} hari ke depan.`}
                className="py-8"
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {ringkasan.hampirKedaluwarsa.map((item) => (
                  <li
                    key={`${item.variantId}-${item.batchNumber}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{item.variantName}</span>
                      <span className="truncate text-xs tabular-nums text-muted-foreground">
                        {item.batchNumber}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="text-xs tabular-nums">
                        {formatTanggal(item.expiredDate)}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {item.quantity} unit
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ringkasan Modul</CardTitle>
            <CardDescription>Jumlah data yang dikelola toko ini.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="flex flex-col gap-2.5 text-sm">
              {[
                { label: "Produk", nilai: ringkasan.jumlahProduk },
                { label: "Varian", nilai: ringkasan.jumlahVarian },
                { label: "Invoice", nilai: ringkasan.jumlahInvoice },
              ].map((baris) => (
                <div
                  key={baris.label}
                  className="flex items-center justify-between gap-3"
                >
                  <dt className="text-muted-foreground">{baris.label}</dt>
                  <dd className="font-medium tabular-nums">{baris.nilai}</dd>
                </div>
              ))}
            </dl>

            {ringkasan.inventoryAktif || ringkasan.billingAktif ? (
              <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">
                {ringkasan.inventoryAktif ? (
                  <Link
                    href={`${basePath}/dashboard/inventory/stock`}
                    className="text-sm text-primary-solid underline-offset-4 hover:underline"
                  >
                    Ringkasan Stok
                  </Link>
                ) : null}
                {ringkasan.billingAktif ? (
                  <Link
                    href={`${basePath}/dashboard/billing`}
                    className="text-sm text-primary-solid underline-offset-4 hover:underline"
                  >
                    Daftar Invoice
                  </Link>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Modul yang belum aktif dijelaskan, bukan sekadar disembunyikan: pengguna perlu
// tahu bahwa datanya memang tidak dihitung, bukan bahwa hasilnya nol.
function Terkunci({ modul, basePath }: { modul: string; basePath: string }) {
  return (
    <EmptyState
      icon={Lock}
      title={`Modul ${modul} belum aktif`}
      description={`Data ${modul} tidak ikut dihitung pada ringkasan ini.`}
      className="py-8"
      aksi={
        <Link
          href={`${basePath}/dashboard/settings`}
          className="text-sm text-primary-solid underline-offset-4 hover:underline"
        >
          Lihat paket & modul
        </Link>
      }
    />
  );
}
