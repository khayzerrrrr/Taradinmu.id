import { Lock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

type Props = {
  tenantName: string;
};

// Ditampilkan saat feature flag 'ACCOUNTING' tidak aktif untuk tenant (PRD Bagian 6).
export function KeuanganLocked({ tenantName }: Props) {
  return (
    <EmptyState
      icon={Lock}
      title="Modul Akuntansi Tidak Aktif"
      description={`Pencatatan pengeluaran belum diaktifkan untuk ${tenantName}. Hubungi Super Admin TaradinMu untuk mengaktifkannya.`}
    />
  );
}
