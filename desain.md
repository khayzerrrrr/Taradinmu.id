# ROLE & OBJECTIVE
Bertindaklah sebagai Senior UI/UX Designer dan Expert Frontend Engineer. 
Tugas Anda adalah melakukan REDESIGN TOTAL pada seluruh antarmuka (UI) aplikasi TaradinMu (Next.js + Tailwind + shadcn/ui). 

Tujuannya: Mengubah tampilan dari "standar/klise" menjadi aplikasi SaaS Enterprise yang bersih, modern, profesional, dan sangat mudah digunakan (highly usable) oleh pengusaha di Indonesia.

# ATURAN "ANTI-AI SLOP" (SANGAT PENTING - WAJIB DIPATUHI)
1. DILARANG menggunakan Glassmorphism (blur background), gradient pelangi, atau efek 3D yang berlebihan.
2. DILARANG menggunakan shadow yang terlalu tebal/hitam. Gunakan shadow yang sangat halus (misal: `shadow-sm`, `shadow-md`, atau custom shadow dengan opacity rendah).
3. DILARANG membuat layout yang berantakan. Gunakan Grid dan Flexbox yang konsisten. Whitespace (ruang kosong) adalah teman kita.
4. DILARANG menggunakan warna sembarangan. Ikuti palet warna brand secara ketat.
5. Fokus pada TYPOGRAPHY dan HIERARKI VISUAL. Ukuran font, weight, dan warna teks harus membedakan dengan jelas antara Judul, Sub-judul, Body, dan Caption.
6. Gunakan border yang sangat tipis dan halus (misal: `border border-slate-200`) untuk memisahkan area, bukan warna background yang berat.

# BRAND ASSETS & DESIGN SYSTEM
- **Logo & Aset**: Sudah ada di folder `/public/assets/logo/`. Gunakan komponen logo yang ada atau referensi path gambarnya.
- **Color Palette (Strict)**:
  - Primary (Action/Brand): `#059669` (Emerald-600). Gunakan untuk tombol utama, link aktif, indikator sukses.
  - Secondary (Structure): `#0F172A` (Slate-900). Gunakan untuk Sidebar, teks utama, heading.
  - Accent (Warning/Highlight): `#D97706` (Amber-600). Gunakan untuk status 'Pending', 'Overdue', atau notifikasi penting.
  - Background: `#F8FAFC` (Slate-50) untuk halaman, `#FFFFFF` (White) untuk Card/Panel.
  - Borders: `#E2E8F0` (Slate-200).
  - Text Muted: `#64748B` (Slate-500).
- **Typography**: Inter (sans-serif). Gunakan tracking yang sedikit rapat untuk heading (`tracking-tight`) dan normal untuk body.
- **Border Radius**: Konsisten. Gunakan `rounded-lg` (8px) untuk Card, `rounded-md` (6px) untuk Button/Input, `rounded-full` untuk Avatar/Badge.

# STRUKTUR LAYOUT GLOBAL
1. **Desktop**: 
   - Sidebar Kiri (Fixed, width 250px-280px): Background `Slate-900`, teks putih/abu-abu. Logo TaradinMu di atas. Menu navigasi di tengah. Profil user di bawah.
   - Topbar/Header (Sticky, height 64px): Background putih, border bawah tipis. Berisi Breadcrumbs, Search bar (opsional), dan Notifikasi/Profil.
   - Main Content: Background `Slate-50`, padding `p-6` atau `p-8`.
2. **Mobile**:
   - Sidebar berubah menjadi Bottom Navigation Bar (max 5 menu utama) atau Hamburger Menu (Drawer).
   - Topbar tetap ada untuk judul halaman dan aksi utama.

# INSTRUKSI REDESIGN PER HALAMAN

## 1. Halaman Autentikasi (Login & Register)
- **Layout**: Split screen (Desktop). Kiri: Branding TaradinMu, quote/testimoni, atau ilustrasi clean (bukan stock photo). Kanan: Form Login/Register.
- **Form**: Card putih bersih di tengah (Mobile). Input field harus memiliki label yang jelas di atas (bukan di dalam placeholder). 
- **Tombol**: Full width, tinggi minimal 44px. Primary button warna Emerald-600.
- **Detail**: Tambahkan link "Lupa Password?" dan "Belum punya akun? Daftar" dengan warna Slate-500 yang berubah jadi Emerald-600 saat hover.

## 2. Dashboard (Super Admin & Tenant)
- **Metric Cards**: 3-4 kartu di atas. Background putih, border tipis. Tampilkan Label (teks kecil, Slate-500), Nilai (teks besar, bold, Slate-900), dan Indikator tren (hijau/merah kecil).
- **Charts/Grafik**: Jika ada, buat sangat minimalis. Hilangkan grid lines yang berlebihan. Gunakan warna Emerald untuk data utama.
- **Recent Activities/Tables**: Tampilkan tabel ringkas di bawah metrik.

## 3. Data Tables (Inventory, Billing, Customers) - *SANGAT KRITIS*
Ini adalah halaman yang paling sering dipakai. Harus sangat rapi.
- **Toolbar**: Di atas tabel, letakkan Search bar (kiri), Filter/Date Range (tengah), dan Tombol "Tambah Data" (kanan, warna Emerald).
- **Tabel**: 
  - Header tabel: Background Slate-50, teks Slate-600, font-medium, uppercase, text-xs.
  - Baris tabel: Border bawah tipis (Slate-100). Hover effect background Slate-50.
  - Kolom Aksi: Gunakan Dropdown Menu (titik tiga) atau tombol icon kecil (Edit/Delete) agar tidak penuh.
- **Status Badges**: Gunakan `shadcn/ui` Badge. 
  - Sukses/Paid/Active: Background Emerald-100, teks Emerald-700.
  - Pending/Draft: Background Amber-100, teks Amber-700.
  - Gagal/Overdue/Expired: Background Red-100, teks Red-700.

## 4. Forms (Tambah/Edit Data)
- **Layout**: Gunakan layout 1 kolom untuk mobile, 2 kolom untuk desktop (jika field banyak).
- **Input**: Label di atas input. Helper text di bawah input (teks kecil, Slate-500) jika perlu.
- **Error State**: Jika validasi gagal, border input jadi merah, tampilkan pesan error di bawahnya.
- **Action Buttons**: Letakkan di pojok kanan bawah form atau sticky di bawah. Tombol "Simpan" (Emerald) dan "Batal" (Outline/Ghost).

## 5. Empty States & Loading
- **Empty State**: Jangan biarkan tabel kosong putih polos. Tampilkan icon Lucide yang relevan (misal: `Package` untuk inventory kosong), judul "Belum ada data", dan tombol "Tambah Data Pertama".
- **Loading**: Gunakan `Skeleton` dari shadcn/ui yang menyerupai bentuk tabel/kartu, jangan hanya spinner berputar di tengah layar.

# ATURAN TEKNIS IMPLEMENTASI (NEXT.JS + TAILWIND)
1. Gunakan komponen `shadcn/ui` secara maksimal (Card, Button, Input, Table, Badge, Dialog, DropdownMenu, Sheet). Jangan buat komponen dasar dari nol jika shadcn sudah menyediakannya.
2. Ekstrak bagian yang berulang (seperti `PageHeader`, `DataTableToolbar`, `MetricCard`) ke dalam komponen terpisah di `src/components/ui/` atau `src/components/shared/`.
3. Pastikan semua layout menggunakan `flex` atau `grid` dengan `gap` yang konsisten (misal: `gap-4` untuk elemen berdekatan, `gap-6` untuk section).
4. Gunakan class `text-sm` untuk sebagian besar teks UI agar terlihat padat dan profesional, `text-xs` untuk label tabel/caption, dan `text-lg/font-semibold` untuk judul halaman.

# LANGKAH EKSEKUSI (LAKUKAN SECARA BERURUTAN)
1. **Analisis**: Baca struktur folder `src/app` dan `src/components` saat ini.
2. **Setup Global**: Update `src/app/layout.tsx` dan `globals.css` untuk memastikan font, warna background default, dan reset CSS sudah sesuai aturan Anti-Slop.
3. **Redesign Auth**: Buat ulang halaman Login dan Register.
4. **Redesign Layout Shell**: Buat komponen `Sidebar`, `Topbar`, dan `MobileNav` yang baru. Terapkan di `src/app/(dashboard)/layout.tsx`.
5. **Redesign Dashboard Home**: Buat ulang halaman utama dengan Metric Cards dan layout yang bersih.
6. **Redesign Data Tables**: Buat komponen `DataTable` reusable dan terapkan di halaman Inventory/Billing.

Mulai dari Langkah 1 dan 2. Tampilkan perubahan yang akan kamu buat pada `globals.css` dan struktur layout global sebelum mengeksekusi kode.