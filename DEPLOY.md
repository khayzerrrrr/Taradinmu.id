# DEPLOY.md — Jalur deploy ke produksi (dibaca sebelum menyentuh server)

> Produksi **live dengan tenant nyata**. Berkas ini adalah urutan tindakan yang
> bisa langsung dijalankan; latar belakang dan penjelasan lengkap ada di
> [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) dan status pekerjaan di
> [`docs/ROADMAP.md`](./docs/ROADMAP.md). Tidak ada langkah di sini yang boleh
> diacak urutannya.

## 0. Fakta produksi (diverifikasi terakhir 2026-09-24)

| Hal | Nilai |
|---|---|
| Server | EC2 Ubuntu 22.04 — `ssh taradinmu-ec2` (alias SSH di laptop, `ubuntu@56.10.70.36`) |
| Direktori | `/var/www/taradinmu` |
| Proses | PM2 nama `taradinmu` → `npm start` (`next start`, port 3000, nginx di 80) |
| Database | PostgreSQL 14 di server yang sama (`localhost:5432/taradinmu`), **bukan RDS** |
| Kredensial | `.env` di server (jangan pernah dicetak ke terminal/transkrip) |
| Backup | `~/backup-taradinmu/` — wajib `pg_dump` sebelum tiap deploy |
| Autostart | `pm2-ubuntu.service` + `~/.pm2/dump.pm2` — aman setelah reboot |

## 1. Prasyarat lokal — jangan deploy bila satu pun gagal

Jalankan dari `taradinmu/` (repo di dalam folder ini, bukan folder luarnya):

```bash
npx tsc --noEmit                      # tipe
npm run lint                          # eslint
npm run test                          # semua tes logika murni harus lulus
npm run build                         # build produksi
npx prisma migrate status             # "Database schema is up to date!"
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
                                      # harus "-- This is an empty migration." (tidak ada drift)
git status --short                    # working tree bersih, .env TIDAK boleh muncul
```

Lalu commit (gaya pesan: `feat:` / `fix:` / `docs:` / `test:` + ringkasan bahasa
Indonesia) dan `git push origin main`. Deploy hanya dari kode yang sudah ter-push —
jangan deploy dari working tree yang kotor.

## 2. Urutan deploy di EC2 — jangan dibalik

```bash
ssh taradinmu-ec2
cd /var/www/taradinmu

# 1. Backup database (WAJIB, sebelum apa pun)
DBURL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | sed 's/?schema=public//')
pg_dump "$DBURL" -f ~/backup-taradinmu/taradinmu-$(date +%Y%m%d-%H%M%S).sql

# 2. Tarik kode — aplikasi lama tetap melayani selama langkah ini
git pull --ff-only
npx prisma generate

# 3. Build DULU, sebelum stop
npm run build

# 4. Baru stop -> migrasi -> start (jendela pemeliharaan = durasi migrasi)
pm2 stop taradinmu
npm run db:migrate
npm run db:migrate:status            # harus "Database schema is up to date!"
pm2 start taradinmu

# 5. Verifikasi (lihat §3)
```

**Kenapa build dulu, baru stop:** klien Prisma lama mungkin tidak mengenal
enum/kolom baru; urutan ini memastikan aplikasi yang berjalan selalu cocok dengan
skema, dan waktu henti hanya selama migrasi berjalan.

**Bila rilis ini tidak memuat migrasi baru:** langkah `db:migrate` tetap aman
dijalankan (no-op "already applied"). Jangan dilewati begitu saja — keluarannya
adalah bagian dari verifikasi.

## 3. Verifikasi pasca-deploy — amati, jangan asumsi

```bash
# dari dalam SSH
curl -s -o /dev/null -w 'login HTTP %{http_code}\n' http://localhost:3000/login   # 200
curl -s -o /dev/null -w 'root HTTP %{http_code}\n'   http://localhost:3000/       # 200
pm2 list                              # status online, restart count tidak bertambah
pm2 logs taradinmu --lines 30 --nostream   # tidak ada error/tumpahan stack

# bila rilis memuat migrasi: buktikan skema benar-benar berubah
psql "$DBURL" -c '\dt'                # tabel baru muncul / kolom baru ada
```

Selesai. Catat hasilnya di `docs/ROADMAP.md` bila membuka fase baru.

## 4. Bila gagal di tengah jalan

Urutan kejadian menentukan pemulihan:

- **Gagal sebelum `pm2 stop`** (pull/generate/build): aplikasi lama masih jalan.
  Perbaiki penyebabnya di lokal, push ulang, ulangi dari langkah 2. Server tidak
  dalam keadaan rusak.
- **Gagal saat migrasi** (aplikasi sudah stop): JANGAN `pm2 start` dengan skema
  setengah jalan. Lihat pesan errornya; migrasi di repo ini ditulis idempoten-hati
  (tambah kolom/tabel, tanpa DROP data). Bila perlu pulihkan:
  ```bash
  psql "$DBURL" -f ~/backup-taradinmu/taradinmu-<terbaru>.sql
  pm2 start taradinmu   # aplikasi lama + skema lama = konsisten
  ```
- **Gagal sesudah start**: `pm2 logs taradinmu --lines 50 --nostream` untuk
  diagnosis; roll back kode dengan `git checkout <commit-sebelumnya>` lalu
  `npm run build && pm2 restart taradinmu` — skema baru biasanya kompatibel
  ke belakang (kolom nullable), jadi rollback kode saja cukup.

## 5. Larangan mutlak

- **`prisma db push` bukan jalur rilis.** Migrasi produksi hanya lewat
  `npm run db:migrate` (`migrate deploy`). `prisma migrate dev` juga tidak bisa
  dipakai di repo ini (masalah shadow DB — lihat DEPLOYMENT.md §4.1).
- **Jangan deploy tanpa backup** baru dibuat pada sesi yang sama.
- **Jangan pernah mencetak isi `.env`** (laptop maupun server) ke terminal,
  log, atau transkrip. Sandi, token, dan connection string tidak boleh bocor.
- **Jangan `git push --force`** ke `main`, jangan commit `.env`
  (sudah di-ignore — pastikan tetap begitu lewat `git status`).
- **Jangan menutup/memodifikasi PM2/nginx** tanpa alasan; aplikasi yang melayani
  pengguna nyata.
- `RESEND_API_KEY` belum diisi di server: fitur email menolak dengan pesan jelas —
  bukan bug, jangan "diperbaiki" dari sisi kode.

## 6. Membuat migrasi baru (di lokal, sebelum deploy)

Singkatnya: ubah `prisma/schema.prisma`, tulis SQL sendiri di
`prisma/migrations/<YYYYMMDDHHMMSS>_<nama_snake_case>/migration.sql`, lalu:

```bash
npx prisma db execute --file prisma/migrations/<folder>/migration.sql
npx prisma migrate resolve --applied <nama_folder>
npx prisma generate
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Prosedur lengkap dengan alasan: DEPLOYMENT.md §4.1.
