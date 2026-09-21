import { ALLOWED_LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/branding";

// Penyimpanan logo tenant.
//
// Logo disimpan sebagai **data URI** di kolom `Tenant.customLogoUrl`, bukan
// sebagai berkas di disk. Alasannya: aplikasi di-deploy ke Vercel (serverless)
// yang tidak punya disk permanen, sedangkan batas ukuran logo hanya 512 KB —
// sehingga fitur white-label PRO tetap hidup tanpa storage eksternal.
//
// Bila nanti logo perlu di-host terpisah (banyak tenant atau berkas besar),
// cukup ganti isi `simpanLogo()` ke Vercel Blob / S3: pemanggil dan komponen
// tampilan tidak perlu berubah karena keduanya hanya memakai URL hasilnya.

// Kembalikan pesan error bila berkas tidak valid, atau null bila valid.
export function validasiLogo(file: File): string | null {
  if (file.size === 0) return "Berkas logo kosong.";
  if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    return "Format logo harus PNG, JPEG, WebP, atau SVG.";
  }
  if (file.size > MAX_LOGO_BYTES) {
    return "Ukuran logo maksimal 512 KB.";
  }
  return null;
}

// Ubah berkas logo menjadi data URI, mis. "data:image/png;base64,iVBORw0...".
export async function simpanLogo(file: File): Promise<string> {
  const mime = (ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)
    ? file.type
    : "image/png";
  const isi = Buffer.from(await file.arrayBuffer());
  return `data:${mime};base64,${isi.toString("base64")}`;
}

// Tidak ada berkas fisik yang perlu dihapus pada penyimpanan data URI.
// Fungsi ini sengaja tetap ada sebagai bagian dari antarmuka penyimpanan:
// mengganti ke storage eksternal nanti cukup mengubah isi berkas ini.
export async function hapusLogo(): Promise<void> {
  // sengaja kosong
}
