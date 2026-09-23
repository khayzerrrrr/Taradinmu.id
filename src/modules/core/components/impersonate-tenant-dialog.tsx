"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { masukSebagaiTenant } from "../actions/impersonation-actions";
import type { TenantListItem } from "../types";

type Props = {
  tenant: TenantListItem;
};

/**
 * Titik masuk mode "masuk sebagai tenant" dari daftar tenant di /admin (PRD 4.B).
 * Diberi konfirmasi karena mengubah konteks sesi, meski bisa dibatalkan kapan saja.
 */
export function ImpersonateTenantDialog({ tenant }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onConfirm() {
    setPending(true);
    const hasil = await masukSebagaiTenant({ tenantId: tenant.id });
    setPending(false);

    if (!hasil.success || !hasil.data) {
      toast.error(hasil.message);
      return;
    }

    toast.success(hasil.message);
    router.push(`/${hasil.data.slug}/dashboard`);
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <LogIn />
          Masuk sebagai tenant
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Masuk sebagai {tenant.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Dashboard tenant ini akan dibuka dengan konteks tenant tersebut, dan
            banner peringatan akan muncul di bagian atas. Ini mode pratinjau —
            hak istimewa Super Admin tetap aktif dan Anda dapat keluar kapan saja.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>
            Ya, masuk
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
