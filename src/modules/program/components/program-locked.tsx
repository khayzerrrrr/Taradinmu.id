"use client";

import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { UpgradeModal } from "@/components/shared/upgrade-modal";

type Props = {
  tenantName: string;
  /**
   * "MODUL" = feature flag PROGRAM belum dinyalakan (hanya Super Admin yang
   * bisa). "PAKET" = tenant FREE; ini bukan salah pengguna, jadi tidak boleh
   * berupa pesan error merah — PRD 4.F.6 meminta ajakan upgrade.
   */
  sebab: "MODUL" | "PAKET";
  /** Sebutan industri untuk program ini, mis. "kloter". */
  sebutan: string;
};

export function ProgramLocked({ tenantName, sebab, sebutan }: Props) {
  if (sebab === "PAKET") {
    return (
      <EmptyState
        icon={Crown}
        title={`Modul ${sebutan} khusus paket PRO`}
        description={`Kelola ${sebutan} ${tenantName} — target dana, peserta, dan pengeluaran per kegiatan — tersedia setelah upgrade ke PRO.`}
        aksi={
          <UpgradeModal fitur={`modul ${sebutan}`} kunci="PROGRAM">
            <Button>
              <Crown />
              Upgrade ke PRO
            </Button>
          </UpgradeModal>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={Lock}
      title={`Modul ${sebutan} Tidak Aktif`}
      description={`Modul ${sebutan} belum diaktifkan untuk ${tenantName}. Hubungi Super Admin TaradinMu untuk mengaktifkannya.`}
    />
  );
}
