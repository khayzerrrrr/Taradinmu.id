import { Lock } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

type Props = {
  tenantName: string;
};

// Ditampilkan saat feature flag 'BILLING' tidak aktif untuk tenant.
export function BillingLocked({ tenantName }: Props) {
  return (
    <EmptyState
      icon={Lock}
      title="Modul Billing Tidak Aktif"
      description={`Modul Billing belum diaktifkan untuk ${tenantName}. Hubungi Super Admin TaradinMu untuk mengaktifkannya.`}
    />
  );
}
