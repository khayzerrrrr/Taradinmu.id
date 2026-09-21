# Aset Brand TaradinMu

Logo resmi: **"Ta Node"** (pita hijau membentuk huruf Ta, dua node emas). Semua aset di bawah adalah
vektor hasil trace dari `logo taradinmu.png`; PNG/ICO dibuat dari SVG tersebut.

## Warna

| Token   | Hex       | Pemakaian                                   |
| ------- | --------- | ------------------------------------------- |
| forest  | `#0b4735` | "Taradin" pada wordmark, theme-color PWA    |
| emerald | `#2d7a61` | Tengah gradien pita                         |
| gold    | `#c38029` | "Mu" pada wordmark, node                    |
| paper   | `#f6f7f1` | Latar ikon aplikasi & gambar sosial         |

Di dalam kode: `BRAND_COLORS` dari `@/components/brand/logo`. Palet UI aplikasi (`--primary` emerald-600 dst.)
tidak diubah secara global — lihat bagian White-label tenant di bawah.

## Berkas

```
public/brand/            SVG master (bisa diunduh/dipakai langsung)
  logo-mark*.svg         ikon saja        (.svg = warna, -dark = latar gelap, -mono, -white)
  logo-horizontal*.svg   ikon + nama      (header, sidebar, email, invoice)
  logo-stacked*.svg      ikon di atas nama (login, splash, cetak)
  logo-wordmark*.svg     nama saja
  app-icon*.svg, og-image.svg   sumber ikon aplikasi & gambar sosial
public/brand/png/        PNG transparan (mark 512/1024, horizontal 1600, stacked 1200)
public/icons/            icon-192, icon-512, icon-maskable-512 (PWA)
src/app/                 favicon.ico (16/32/48), icon.svg, apple-icon.png (180),
                         opengraph-image.png, twitter-image.png (1200x630), manifest.ts
src/components/brand/logo.tsx   <Logo /> (SVG inline)
```

## Pemakaian di kode

```tsx
import { Logo } from "@/components/brand/logo";

<Logo variant="horizontal" className="h-8 w-auto" />   // header/sidebar
<Logo variant="stacked" className="h-36 w-auto" />     // login
<Logo variant="mark" tone="dark" className="size-8" /> // paksa tone (latar gelap)
```

`tone="auto"` (default) menampilkan versi terang/gelap mengikuti kelas `.dark`.

## Aturan pakai

- Latar terang: versi warna. Latar gelap (mis. sidebar `#0f172a`): `-dark`. Satu warna / cetak hitam-putih: `-mono` / `-white`.
- Ruang bebas minimum di sekeliling logo: setinggi satu node emas (≈ 1/6 tinggi ikon).
- Ukuran minimum: ikon 16 px (favicon), logo horizontal 24 px tinggi.
- Jangan memutar, meregangkan, mengganti warna gradien, atau menaruh versi warna di atas latar hijau/gelap.

## Membuat ulang aset raster

```bash
npm run brand:build
```

Membaca SVG di `public/brand` dan `src/app/icon.svg`, lalu menulis ulang semua PNG/ICO (memakai `sharp`).
Mengubah warna/ukuran ikon: edit SVG sumbernya (`app-icon*.svg`, `og-image.svg`), lalu jalankan perintah di atas.

## Catatan

- Wordmark "TaradinMu" dibuat dari **Inter** (bobot 650, lisensi OFL) yang sudah dipakai aplikasi, dikonversi ke outline
  sehingga tidak butuh font terpasang. Logo asli tidak memuat teks.
- `logo.tsx` dan SVG dibuat dari geometri yang sama; jika logo berubah, buat ulang keduanya bersama-sama.
- Fallback logo tenant (belum ada logo custom / plan FREE) di `src/app/(tenant)/layout.tsx` memakai `<Logo variant="mark" />`.

## White-label tenant (fitur PRO)

Tenant berplan **PRO** boleh mengganti logo dan warna utama. Aturannya:

- Logika terpusat di `src/lib/branding.ts` (`resolveBranding`, `brandingVars`, `kontrasPrimary`).
- Warna tenant ditulis sebagai CSS variable (`--primary`, `--primary-foreground`, `--ring`,
  `--sidebar-primary`, `--sidebar-ring`) pada subtree area tenant; `globals.css` global tidak diubah.
- Karena Dialog/Select/AlertDialog Radix mem-portal ke `document.body` (di luar subtree),
  `src/components/brand/tenant-theme.tsx` menyalin variabel yang sama ke `document.documentElement`.
- Tenant FREE selalu memakai palet & logo default TaradinMu (`<Logo />` dari `logo.tsx`).
- Logo tenant diunggah ke `public/uploads/tenants/<slug>/` (penyimpanan lokal). Di lingkungan
  serverless, ganti fungsi penyimpanan di `src/modules/core/actions/branding-actions.ts`
  dengan storage eksternal (S3/Blob) — sisanya tidak perlu berubah.
- Kontras teks tombol dihitung `kontrasPrimary()` agar warna terang tetap terbaca.