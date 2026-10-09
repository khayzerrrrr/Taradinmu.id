import { AlertTriangle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import type { KelengkapanModal } from "@/lib/hpp";

type Props = {
  kelengkapanModal: KelengkapanModal;
  basePath: string;
};

// Peringatan "angka HPP belum lengkap" (Fase 0.1).
//
// Elemennya dibiarkan mencolok karena memang perlu: kartu metrik di sebelahnya
// menampilkan angka yang terlihat utuh, dan angka itu belum tentu benar.
// Menyembunyikan ketidakpastian di balik angka yang rapi adalah cara tercepat
// merusak kepercayaan orang pada pembukuannya.
//
// Tiga hal wajib ada supaya peringatan ini berguna, bukan sekadar menuduh:
// APA yang terjadi, APA dampaknya, dan APA yang harus dilakukan. Peringatan yang
// hanya menyatakan masalah membuat orang menebak.

/** Jumlah batch lain di rak yang juga belum punya harga modal. */
function capitalize(nilai: string): string {
  return nilai.charAt(0).toUpperCase() + nilai.slice(1).toLowerCase();
}

function susunPesan(kelengkapanModal: KelengkapanModal): {
  judul: string;
  isi: string;
  tambahan: string;
} {
  const { alasan, unitTerjual, unitTanpaModal, batchDiRakTanpaModal } =
    kelengkapanModal;

  switch (alasan) {
    case "TIDAK_ADA_MOVEMENT":
      return {
        judul: "Harga modal barang belum pernah dicatat",
        isi: `Bulan ini ada ${unitTerjual} unit barang yang terjual, tetapi sistem tidak menemukan satu pun catatan stok keluar untuk tagihan itu. Harga pokok penjualan karena itu masih 0, sehingga laba bersih di atas terlihat lebih besar dari kenyataan. Estimasi zakat penghasilan ikut terpengaruh.`,
        tambahan:
          "Isi harga modal barang di menu Stok Masuk. Setelah terisi, laba dan zakat dihitung ulang otomatis.",
      };
    case "MODAL_BELUM_TERCATAT":
      return {
        judul: "Sebagian harga modal belum tercatat",
        isi: `Ada ${unitTanpaModal} unit yang keluar dari batch yang belum punya catatan harga modal, sehingga laba bersih di atas terlalu besar. Estimasi zakat penghasilan ikut terpengaruh.`,
        tambahan:
          batchDiRakTanpaModal > 0
            ? `Selain itu, ${batchDiRakTanpaModal} batch yang masih di rak juga belum punya harga modal. Mengisinya sekarang mencegah masalah yang sama muncul bulan depan.`
            : "Isi harga modal pada batch yang bersangkutan lewat menu Stok Masuk.",
      };
    default:
      // Panggilannya dijaga oleh `kelengkapanModal.lengkap`, jadi tidak akan
      // sampai ke sini; tetap dikembalikan supaya tipe tidak butuh `undefined`.
      return { judul: "", isi: "", tambahan: "" };
  }
}

export function PeringatanModalBelumLengkap({
  kelengkapanModal,
  basePath,
}: Props) {
  if (kelengkapanModal.lengkap) return null;

  const { judul, isi, tambahan } = susunPesan(kelengkapanModal);

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertTriangle aria-hidden="true" className="size-4 text-amber-600" />
      <AlertTitle>{judul}</AlertTitle>
      <AlertDescription className="text-foreground/80">
        <p>{isi}</p>
        <p className="mt-2">
          {tambahan}{" "}
          <a
            href={`${basePath}/dashboard/inventory/stock-in`}
            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
          >
            {capitalize("buka stok masuk")}
          </a>
          .
        </p>
      </AlertDescription>
    </Alert>
  );
}
