import { Lock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

type Props = {
  tenantName: string;
};

// Ditampilkan saat feature flag 'INVENTORY' tidak aktif untuk tenant (PRD Bagian 6).
export function InventoryLocked({ tenantName }: Props) {
  return (
    <EmptyState
      icon={Lock}
      title="Modul Inventory Tidak Aktif"
      description={`Modul Inventory belum diaktifkan untuk ${tenantName}. Hubungi Super Admin TaradinMu untuk mengaktifkannya.`}
    />
  );
}
