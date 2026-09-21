"use client";

import { LockedFeature } from "@/components/shared/locked-feature";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { ZakatHistoryItem, ZakatPenghasilan } from "../types";
import { ZakatHistoryTable } from "./zakat-history-table";
import { ZakatPenghasilanPanel } from "./zakat-penghasilan-panel";
import { ZakatPerniagaanPanel } from "./zakat-perniagaan-panel";

type Props = {
  penghasilan: ZakatPenghasilan | null;
  pesanPenghasilan?: string;
  /** Paket FREE: tab Zakat Penghasilan (Otomatis) dikunci. */
  terkunciPro: boolean;
  /** Nisab zakat perniagaan (dihitung di server dari harga emas). */
  nisabPerdagangan: number;
  rate: number;
  riwayat: ZakatHistoryItem[];
  /** Tab yang dibuka pertama kali (dari `?tab=`), agar bisa di-deep-link. */
  tabAwal?: string;
};

export function ZakatTabs({
  penghasilan,
  pesanPenghasilan,
  terkunciPro,
  nisabPerdagangan,
  rate,
  riwayat,
  tabAwal,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <Tabs
        defaultValue={tabAwal === "perniagaan" ? "perniagaan" : "penghasilan"}
      >
        <TabsList>
          <TabsTrigger value="penghasilan">
            Zakat Penghasilan (Otomatis)
          </TabsTrigger>
          <TabsTrigger value="perniagaan">
            Zakat Perniagaan (Manual)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="penghasilan" className="pt-4">
          <LockedFeature
            isLocked={terkunciPro}
            fitur="Zakat Penghasilan (Otomatis)"
            deskripsi="Zakat penghasilan dihitung otomatis dari invoice lunas dan pengeluaran bulan ini. Tersedia pada paket PRO — zakat perniagaan tetap bisa dihitung manual di tab sebelah."
          >
            <ZakatPenghasilanPanel
              data={penghasilan}
              pesan={pesanPenghasilan}
            />
          </LockedFeature>
        </TabsContent>

        <TabsContent value="perniagaan" className="pt-4">
          <ZakatPerniagaanPanel nisab={nisabPerdagangan} rate={rate} />
        </TabsContent>
      </Tabs>

      <ZakatHistoryTable items={riwayat} />
    </div>
  );
}
