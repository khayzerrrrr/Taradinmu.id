import { notFound } from "next/navigation";
import { Check, Crown, Lock } from "lucide-react";
import { checkLimit } from "@/lib/feature-guards";
import { formatRupiah } from "@/lib/format";
import { HARGA_PRO_BULAN } from "@/lib/plan-limits";
import {
  jumlahFiturTerkunci,
  ringkasBatas,
  susunMasaBerlaku,
  susunStatusPaket,
} from "@/lib/plan-status";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { MasaBerlakuPaketNotice } from "@/components/shared/masa-berlaku-paket";
import { UpgradeModal } from "@/components/shared/upgrade-modal";

// Halaman "Paket & penggunaan" (PRD 4.D.3): satu tempat untuk menjawab
// "saya pakai paket apa, sisa kuota saya berapa, dan apa yang terbuka kalau PRO".
//
// Sebelumnya jawabannya tersebar: meter hanya muncul di dashboard dan hanya saat
// kuota sudah 80%, kuota produk tidak tampil di halaman produknya sendiri. Orang
// yang sedang mempertimbangkan upgrade harus membuka tiga tempat — dan yang
// paling menentukan (berapa yang masih tersisa) justru tidak bisa dilihat sengaja.
//
// Halaman ini boleh dibaca semua paket, jadi SENGAJA tidak digembok: mengukur
// pemakaian sendiri bukan fitur berbayar.

export const dynamic = "force-dynamic";

const HARGA = formatRupiah(HARGA_PRO_BULAN);

function MeterKuota({ persen, menipis }: { persen: number; menipis: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-muted"
    >
      <span
        className={`block h-full rounded-full ${
          menipis ? "bg-warning" : "bg-primary-solid"
        }`}
        style={{ width: `${persen}%` }}
      />
    </span>
  );
}

export default async function PaketPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantMember(tenant);

  // Angka pemakaian diambil dari rules yang sama dengan penegakan tulis, supaya
  // halaman ini tidak pernah menjanjikan kuota yang berbeda dari aksinya.
  const [invoice, produk, pengguna] = await Promise.all([
    checkLimit(tenant.id, "INVOICE"),
    checkLimit(tenant.id, "PRODUCT"),
    checkLimit(tenant.id, "USERS"),
  ]);

  const status = susunStatusPaket(tenant.plan, {
    INVOICE: invoice.used ?? 0,
    PRODUCT: produk.used ?? 0,
    USERS: pengguna.used ?? 0,
  });
  // Semua keputusan di bawah dibaca dari `status`, bukan dari string paket:
  // halaman ini boleh menjanjikan hanya apa yang plan-limits tegakkan di server.
  const terkunci = jumlahFiturTerkunci(status);
  const batas = ringkasBatas(status);
  const berbatas = batas !== null;

  // Masa berlakunya dibaca dari paket yang DI BELI (planTerkontrak), bukan dari
  // paket efektif — yang terakhir justru sudah berubah menjadi FREE saat masanya
  // habis, sehingga pesan "PRO Anda kedaluwarsa" akan hilang persis pada saat ia
  // paling dibutuhkan.
  const masa = susunMasaBerlaku(tenant.planTerkontrak, tenant.planExpiresAt);
  const habis = masa !== null && masa.kedaluwarsa;
  const ajakan = habis ? "Perpanjang PRO" : "Naik ke PRO";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Paket & Penggunaan"
        description={`Paket aktif, sisa kuota, dan apa yang terbuka pada paket PRO untuk ${tenant.name}.`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Paket Anda: {tenant.plan}
            <Badge variant={berbatas ? "secondary" : "default"}>
              {berbatas ? `${terkunci} fitur terkunci` : "Tanpa batas"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {berbatas
              ? `Kuota Anda dibatasi ${batas}.`
              : `Seluruh fitur terbuka dan kuota Anda tidak dibatasi.`}{" "}
            Paket PRO dipatok {HARGA} per bulan.
          </CardDescription>
          <MasaBerlakuPaketNotice masa={masa} />
        </CardHeader>
        {berbatas ? (
          <CardContent className="flex flex-col gap-3">
            <UpgradeModal
              fitur={habis ? "perpanjangan paket PRO" : "seluruh paket PRO"}
              kunci="UMUM"
              sumber="HALAMAN_PAKET"
            >
              <Button size="lg">
                <Crown aria-hidden="true" />
                {ajakan} — {HARGA}/bulan
              </Button>
            </UpgradeModal>
            <p className="text-xs text-muted-foreground">
              Pembayaran dan aktivasi paket PRO dilakukan manual melalui
              WhatsApp admin setelah tombol di atas dibuka — belum ada
              pembayaran otomatis di dalam aplikasi.
            </p>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Penggunaan saat ini</CardTitle>
          <CardDescription>
            Diukur dari data toko Anda sendiri, dengan aturan hitung yang sama
            dipakai saat menolak penulisan data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {status.kuota.map((baris) => (
            <div
              key={baris.key}
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <span className="min-w-40 text-sm font-medium">
                {baris.label}
              </span>
              {baris.batas === null ? (
                <span className="text-sm text-muted-foreground tabular-nums">
                  {baris.terpakai} terpakai — tanpa batas pada paket PRO
                </span>
              ) : (
                <>
                  <span className="text-sm tabular-nums">
                    {baris.terpakai} dari {baris.batas}
                  </span>
                  <MeterKuota persen={baris.persen} menipis={baris.menipis} />
                  <span className="sr-only">{baris.persen}% terpakai</span>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fitur pada tiap paket</CardTitle>
          <CardDescription>
            Yang terbuka di PRO beserta alasan singkatnya. Menu yang masih
            bergembok di bilah kiri adalah fitur pada daftar ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {status.fitur.map((baris) => (
            <div
              key={baris.key}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
            >
              <span className="flex items-center gap-2 text-sm">
                {baris.aktif ? (
                  <Check
                    aria-hidden="true"
                    className="size-4 shrink-0 text-primary-solid"
                  />
                ) : (
                  <Lock
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                )}
                {baris.label}
              </span>
              {baris.aktif ? (
                <Badge variant="outline">Terbuka</Badge>
              ) : (
                <UpgradeModal
                  fitur={baris.label}
                  kunci={baris.key}
                  sumber="HALAMAN_PAKET"
                >
                  <Button size="sm" variant="outline">
                    <Crown aria-hidden="true" />
                    Buka di PRO
                  </Button>
                </UpgradeModal>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
