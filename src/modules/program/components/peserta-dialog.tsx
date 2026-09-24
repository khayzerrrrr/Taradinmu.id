"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatTanggal } from "@/lib/format";
import {
  getCalonPeserta,
  keluarPeserta,
  tambahPeserta,
} from "../actions/participant-actions";
import type { CalonPeserta, ProgramPeserta } from "../types";

type Props = {
  programId: string;
  peserta: ProgramPeserta[];
  sebutan: string;
  bolehMenulis: boolean;
};

export function PesertaDialog({ programId, peserta, sebutan, bolehMenulis }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kataKunci, setKataKunci] = useState("");
  const [calon, setCalon] = useState<CalonPeserta[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [sidang, setSidang] = useState<string | null>(null);

  async function muatCalon(search: string) {
    setMemuat(true);
    const hasil = await getCalonPeserta({ programId, search });
    setMemuat(false);
    if (hasil.success) {
      setCalon(hasil.data ?? []);
      return;
    }
    // Tanpa gerbang PRO/keanggotaan daftar ini memang kosong; pesan server
    // menjelaskan kenapa, jadi tidak ditelan diam-diam.
    toast.error(hasil.message);
    setCalon([]);
  }

  // Dimuat saat dialog dibuka, bukan sebelumnya: halaman detail tidak perlu
  // membawa seluruh pelanggan tenant di payload awalnya. Sengaja di handler
  // kejadian, bukan `useEffect` — membuka dialog adalah aksi pengguna.
  function ubahOpen(next: boolean) {
    setOpen(next);
    if (next) void muatCalon("");
  }

  async function onTambah(customerId: string) {
    setSidang(customerId);
    const hasil = await tambahPeserta({ programId, customerId });
    setSidang(null);
    if (hasil.success) {
      toast.success(hasil.message);
      router.refresh();
      void muatCalon(kataKunci);
      return;
    }
    toast.error(hasil.message);
  }

  async function onKeluar(customerId: string) {
    setSidang(customerId);
    const hasil = await keluarPeserta({ programId, customerId });
    setSidang(null);
    if (hasil.success) {
      toast.success(hasil.message);
      router.refresh();
      void muatCalon(kataKunci);
      return;
    }
    toast.error(hasil.message);
  }

  return (
    <Dialog open={open} onOpenChange={ubahOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users />
          {sebutan} ({peserta.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kelola {sebutan.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Peserta diambil dari data Pelanggan yang sudah ada — satu orang
            tetap satu catatan di seluruh aplikasi.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Terdaftar ({peserta.length})</h3>
            {peserta.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada {sebutan.toLowerCase()} di sini.
              </p>
            ) : (
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                {peserta.map((orang) => (
                  <li
                    key={orang.customerId}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {orang.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {orang.phone ?? orang.email ?? "tanpa kontak"} · bergabung{" "}
                        {formatTanggal(orang.joinedAt)}
                        {orang.tagihanBelumLunas > 0
                          ? ` · ${orang.tagihanBelumLunas} tagihan belum lunas`
                          : ""}
                      </span>
                    </div>
                    {bolehMenulis ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={sidang === orang.customerId}
                        onClick={() => void onKeluar(orang.customerId)}
                      >
                        <X />
                        Keluar
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {bolehMenulis ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Tambah {sebutan.toLowerCase()}</h3>
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void muatCalon(kataKunci);
                }}
              >
                <Input
                  value={kataKunci}
                  onChange={(event) => setKataKunci(event.target.value)}
                  placeholder="Cari nama pelanggan..."
                  aria-label="Cari calon peserta"
                />
                <Button type="submit" variant="outline" size="sm" disabled={memuat}>
                  {memuat ? <Loader2 className="animate-spin" /> : <Search />}
                  Cari
                </Button>
              </form>

              {calon.length === 0 && !memuat ? (
                <p className="text-sm text-muted-foreground">
                  Tidak ada pelanggan yang belum terdaftar. Tambahkan lewat menu
                  Billing &raquo; Pelanggan bila orangnya baru.
                </p>
              ) : (
                <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                  {calon.map((orang) => (
                    <li
                      key={orang.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {orang.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {orang.phone ?? "tanpa telepon"}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        disabled={sidang === orang.id}
                        onClick={() => void onTambah(orang.id)}
                      >
                        {sidang === orang.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <UserPlus />
                        )}
                        Tambah
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              Hanya pemilik atau admin yang bisa mengubah daftar ini.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
