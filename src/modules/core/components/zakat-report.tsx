import { formatRupiah, formatTanggal } from "@/lib/format";
import { labelPeriode } from "@/lib/periode";
import type { ZakatHistoryItem, ZakatPenghasilan } from "../types";

// Laporan zakat siap cetak (PRD 4.D.3) — diserahkan ke LAZISMU/BAZNAS.
//
// Sengaja komponen server tanpa interaksi: yang menjadikannya "hanya tampil saat
// dicetak" adalah CSS `.cetak-laporan` di src/app/globals.css. Warna ditulis
// hitam-putih eksplisit karena latar gelap aplikasi tidak ikut tercetak.

type Baris = { label: string; nilai: string };

type Props = {
  tenantName: string;
  penghasilan: ZakatPenghasilan | null;
  riwayat: ZakatHistoryItem[];
  nisabPerdagangan: number;
  rate: number;
};

function Tabel({ judul, baris }: { judul: string; baris: Baris[] }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="border-b border-black pb-1 text-sm font-bold uppercase">
        {judul}
      </h2>
      <table className="mt-2 w-full text-sm">
        <tbody>
          {baris.map((b) => (
            <tr key={b.label} className="align-top">
              <td className="w-1/2 py-0.5">{b.label}</td>
              <td className="py-0.5 text-right font-medium tabular-nums">
                {b.nilai}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function ZakatReport({
  tenantName,
  penghasilan,
  riwayat,
  nisabPerdagangan,
  rate,
}: Props) {
  const perniagaanTerakhir =
    riwayat.find((item) => item.type === "TRADE") ?? null;

  const barisPenghasilan: Baris[] = [];
  if (penghasilan) {
    barisPenghasilan.push(
      { label: "Pendapatan diterima (invoice lunas)", nilai: formatRupiah(penghasilan.pendapatan) },
      { label: "Beban usaha", nilai: formatRupiah(penghasilan.bebanOperasional) },
      {
        label: "Harga pokok penjualan (barang terjual)",
        nilai: formatRupiah(penghasilan.hpp),
      },
      ...(penghasilan.unitModalBelumTercatat > 0
        ? [
            {
              label: `Catatan: ${penghasilan.unitModalBelumTercatat} unit keluar tanpa harga modal`,
              nilai: "HPP & laba belum penuh",
            },
          ]
        : []),
      // Dicetak supaya dasar hitungnya bisa ditelusuri: pembelian stok memang
      // sengaja tidak dikurangkan (PRD 4.G.1), bukan hilang dari laporan.
      ...(penghasilan.pembelianStok > 0
        ? [
            {
              label: "Pembelian stok (masih jadi aset, tidak dikurangkan)",
              nilai: formatRupiah(penghasilan.pembelianStok),
            },
          ]
        : []),
      { label: "Laba bersih", nilai: formatRupiah(penghasilan.labaBersih) },
      { label: "Nisab bulan ini", nilai: formatRupiah(penghasilan.nisab) },
      { label: `Kadar zakat (${penghasilan.rate * 100}%)`, nilai: formatRupiah(penghasilan.terutang) },
    );
  }

  const barisPerniagaan: Baris[] = [];
  if (perniagaanTerakhir) {
    barisPerniagaan.push(
      { label: "Total aset (harta dagang)", nilai: formatRupiah(perniagaanTerakhir.totalAssets) },
      { label: "Total kewajiban", nilai: formatRupiah(perniagaanTerakhir.totalLiabilities) },
      { label: "Harta bersih", nilai: formatRupiah(perniagaanTerakhir.netAssets) },
      { label: "Nisab", nilai: formatRupiah(perniagaanTerakhir.nisab) },
      { label: `Kadar zakat (${Number(perniagaanTerakhir.rate) * 100}%)`, nilai: formatRupiah(perniagaanTerakhir.zakatDue) },
      { label: "Status", nilai: perniagaanTerakhir.isPaid ? "Sudah ditunaikan" : "Belum ditunaikan" },
    );
  }

  const belumAdaData = !penghasilan && !perniagaanTerakhir;

  return (
    <div className="cetak-laporan bg-white text-black">
      <header className="border-b-2 border-black pb-3">
        <h1 className="text-lg font-bold">Laporan Zakat</h1>
        <p className="text-sm">{tenantName}</p>
        <p className="mt-1 text-xs">
          Periode: {penghasilan?.periode ?? labelPeriode()} · Dicetak:{" "}
          {formatTanggal(new Date())}
        </p>
        <p className="mt-1 text-xs">
          Nisab zakat perniagaan yang berlaku: {formatRupiah(nisabPerdagangan)}{" "}
          (85 gram emas)
        </p>
      </header>

      {belumAdaData ? (
        <p className="mt-6 text-sm">
          Belum ada perhitungan zakat yang tercatat untuk dilaporkan.
        </p>
      ) : null}

      {/* Angkanya dicetak pada semua paket (PRD 4.D): yang PRO adalah menarik &
          mencatatnya otomatis ke riwayat, bukan melihat hasilnya. */}
      {penghasilan ? (
        <Tabel judul="Zakat Penghasilan" baris={barisPenghasilan} />
      ) : null}

      {perniagaanTerakhir ? (
        <Tabel judul="Zakat Perniagaan (Manual)" baris={barisPerniagaan} />
      ) : null}

      <footer className="mt-12 flex justify-between gap-8 text-sm">
        <div className="flex-1">
          <p>Pengelola Usaha</p>
          <div className="mt-16 border-t border-black pt-1">Nama &amp; tanda tangan</div>
        </div>
        <div className="flex-1">
          <p>Amil / Penerima</p>
          <div className="mt-16 border-t border-black pt-1">Nama &amp; tanda tangan</div>
        </div>
      </footer>

      <p className="mt-8 text-xs">
        Kadar zakat {rate * 100}%. Angka dihitung dari data yang tercatat di
        TaradinMu pada periode tersebut.
      </p>
    </div>
  );
}
