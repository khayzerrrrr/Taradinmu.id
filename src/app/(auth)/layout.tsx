import { Boxes, LayoutDashboard, ReceiptText, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";

// Layout area autentikasi: panel merek (desktop) + kolom form.
// Route group `(auth)` tidak menambah segmen URL, sehingga `/login` tetap `/login`.

// Cuplikan antarmuka, bukan daftar jualan. Yang ditampilkan hanya permukaan yang
// benar-benar ada di aplikasi — tanpa angka atau klaim karangan, sehingga tidak
// ada janji yang harus ditarik kembali saat produk berubah.
const PERMUKAAN: { icon: LucideIcon; label: string; keterangan: string }[] = [
  { icon: LayoutDashboard, label: "Dashboard", keterangan: "ringkasan usaha" },
  { icon: Boxes, label: "Inventory", keterangan: "stok & batch" },
  { icon: ReceiptText, label: "Billing", keterangan: "invoice & piutang" },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* Permukaan gelap yang sama dengan sidebar aplikasi, supaya perpindahan
          dari layar masuk ke dalam aplikasi terasa menyambung. */}
      <aside className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex xl:p-12">
        <Logo variant="horizontal" tone="dark" className="h-7 w-auto" />

        <div className="flex flex-col gap-8">
          <h2 className="max-w-[15rem] text-3xl leading-tight font-semibold tracking-tight text-balance">
            Semua urusan usaha, di satu tempat.
          </h2>

          <div className="flex max-w-[17rem] flex-col gap-0.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-1.5">
            {PERMUKAAN.map(({ icon: Ikon, label, keterangan }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2"
              >
                <Ikon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-sidebar-foreground/45"
                />
                <span className="text-sm text-sidebar-foreground/90">{label}</span>
                <span className="ml-auto text-2xs text-sidebar-foreground/40">
                  {keterangan}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-sidebar-foreground/50">
          TaradinMu — platform niaga syariah untuk UMKM.
        </p>
      </aside>

      <main
        id="konten-utama"
        className="flex flex-col items-center justify-center bg-background p-6 sm:p-10"
      >
        {children}
      </main>
    </div>
  );
}
