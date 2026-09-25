import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  Calculator,
  Coins,
  Crown,
  HeartHandshake,
  Lock,
  PackageX,
  Percent,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { LockedFeature } from "@/components/shared/locked-feature";
import { MetricCard } from "@/components/shared/metric-card";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RingkasanOwner } from "@/lib/dashboard-summary";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { LIMIT_LABELS } from "@/lib/plan-limits";

type Props = {
  ringkasan: RingkasanOwner;
  basePath: string;
};

// Kartu ringkasan Dashboard Owner. Menerima DATA saja (tidak mengimpor modul lain).
export function OwnerDashboard({ ringkasan, basePath }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Metrik utama: pendapatan, laba, arus kas, piutang, zakat, stok menipis. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              ? `Masuk ${formatRupiah(ringkasan.pendapatanBulanIni)} − keluar ${formatRupiah(ringkasan.pengeluaranBulanIni)}${
                  ringkasan.pembelianStokBulanIni > 0
                    ? ` (beli stok ${formatRupiah(ringkasan.pembelianStokBulanIni)})`
                    : ""
                }`
              : "Modul Akuntansi belum aktif"
          }
          icon={Coins}
          style={{ animationDelay: "40ms" }}
        />

        <MetricCard
          label="Laba Bersih Bulan Ini"
          value={formatRupiah(ringkasan.labaBersihBulanIni)}
          hint={`Pendapatan ${formatRupiah(
            ringkasan.pendapatanBulanIni,
          )} − beban usaha ${formatRupiah(
            ringkasan.bebanOperasionalBulanIni,
          )} − HPP ${formatRupiah(ringkasan.hppBulanIni)}${
            ringkasan.unitModalBelumTercatat > 0
              ? ` · ${ringkasan.unitModalBelumTercatat} unit tanpa modal`
              : ""
          }`}
          icon={Calculator}
          style={{ animationDelay: "80ms" }}
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
          style={{ animationDelay: "120ms" }}
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
          style={{ animationDelay: "160ms" }}
        />

        {/* Angkanya tampil pada semua paket (PRD 4.D): zakat dihitung dari data
            milik tenant sendiri. Yang PRO hanya penarikan otomatis & pencatatan
            riwayat — ditegakkan di Server Action, bukan dengan menihilkan angka. */}
        <MetricCard
          label="Estimasi Zakat"
          value={formatRupiah(ringkasan.estimasiZakat)}
          hint={`2,5% dari laba bersih ${formatRupiah(
            ringkasan.labaBersihBulanIni,
          )}${
            ringkasan.mencapaiNisabZakat
              ? " · mencapai nisab"
              : ` · di bawah nisab ${formatRupiah(ringkasan.nisabZakat)}`
          }${
            ringkasan.zakatOtomatisAktif
              ? ""
              : " · tarik & catat otomatis: PRO"
          }`}
          icon={HeartHandshake}
          style={{ animationDelay: "200ms" }}
        />

        {/* Laporan HPP = satu-satunya bagian yang dikunci PRO (PRD 4.G.5).
            Angka Laba Bersih di atas tetap benar pada semua paket; yang dibatasi
            hanyalah rincian margin-nya. */}
        <LockedFeature
          isLocked={!ringkasan.laporanHppAktif}
          fitur="laporan HPP & margin"
          kunci="HPP"
          deskripsi="Lihat berapa modal yang terpakai untuk setiap rupiah pendapatan bulan ini."
        >
          <MetricCard
            label="Margin Kotor Bulan Ini"
            value={formatRupiah(ringkasan.labaKotorBulanIni)}
            hint={
              ringkasan.inventoryAktif
                ? `Pendapatan ${formatRupiah(
                    ringkasan.pendapatanBulanIni,
                  )} − HPP ${formatRupiah(ringkasan.hppBulanIni)}`
                : "Modul Inventory belum aktif"
            }
            icon={Percent}
            style={{ animationDelay: "240ms" }}
          />
        </LockedFeature>
      </div>

      {/* Kuota yang hampir habis (PRD 4.D.3): tampil mulai 80% terpakai, supaya
          batas tidak menjumpai pemilik usaha saat ia sedang membuat invoice di
          kasir. Di bawah ambang itu strip ini tidak ada sama sekali. */}
      {ringkasan.kuotaMenipis.length > 0 ? (
        <Card className="border-warning/30 bg-warning-subtle">
          <CardContent className="flex flex-col gap-3 pt-6">
            {ringkasan.kuotaMenipis.map((kuota) => {
              const persen = Math.min(
                100,
                Math.round((kuota.terpakai / kuota.batas) * 100),
              );
              return (
                <div
                  key={kuota.key}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <span className="text-sm font-medium">
                    {kuota.terpakai} dari {kuota.batas} {kuota.label} terpakai
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-warning/25"
                  >
                    <span
                      className="block h-full rounded-full bg-warning"
                      style={{ width: `${persen}%` }}
                    />
                  </span>
                  <span className="sr-only">{persen}% kuota terpakai</span>
                  <UpgradeModal
                    fitur={`${LIMIT_LABELS[kuota.key]} tanpa batas`}
                    kunci={kuota.key}
                  >
                    <Button size="sm" variant="outline">
                      <Crown aria-hidden="true" />
                      Naik ke PRO
                    </Button>
                  </UpgradeModal>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

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
