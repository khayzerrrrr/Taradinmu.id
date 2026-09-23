"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keluarDariImpersonasi } from "../actions/impersonation-actions";

type Props = {
  /** Nama tenant yang sedang dilihat. */
  tenantName: string;
};

/**
 * Banner peringatan saat Super Admin sedang melihat dashboard sebagai tenant
 * (PRD Bagian 4.B).
 *
 * Sengaja memakai token peringatan (amber), bukan warna merek tenant: banner ini
 * milik platform, dan memakai warna tenant akan mengaburkan batas antara "saya
 * sedang melihat tenant" dan "saya adalah tenant". Tombol keluarnya juga ikut
 * dirender di sini supaya tidak mungkin terjebak di mode ini.
 */
export function ImpersonationBanner({ tenantName }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function keluar() {
    setPending(true);
    const hasil = await keluarDariImpersonasi();
    setPending(false);

    if (!hasil.success) {
      toast.error(hasil.message);
      return;
    }

    toast.success(hasil.message);
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="cetak-sembunyi flex flex-wrap items-center justify-between gap-3 border-b border-warning/30 bg-warning-subtle px-4 py-2.5 text-warning">
      <p className="flex items-start gap-2 text-sm font-medium">
        <Eye aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          Anda masuk sebagai <strong>{tenantName}</strong> (Super Admin). Mode
          pratinjau untuk debugging — hak istimewa Super Admin tetap aktif.
        </span>
      </p>

      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => void keluar()}
      >
        <LogOut />
        {pending ? "Keluar..." : "Keluar dari mode ini"}
      </Button>
    </div>
  );
}
