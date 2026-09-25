"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  /**
   * Paket FREE: angkanya tetap tampil (PRD 4.D), hanya penarikan otomatis ke
   * riwayat & tombol "Tandai Sudah Dibayar" yang dikunci PRO.
   */
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="penghasilan">
              Zakat Penghasilan (Otomatis)
            </TabsTrigger>
            <TabsTrigger value="perniagaan">
              Zakat Perniagaan (Manual)
            </TabsTrigger>
          </TabsList>

          {/* Laporan dicetak dari komponen ZakatReport di halaman ini; CSS
              `.cetak-laporan` yang menyembunyikannya di layar (PRD 4.D.3). */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
          >
            <Printer />
            Cetak Laporan Zakat
          </Button>
        </div>

        <TabsContent value="penghasilan" className="pt-4">
          <ZakatPenghasilanPanel
            data={penghasilan}
            pesan={pesanPenghasilan}
            terkunciPro={terkunciPro}
          />
        </TabsContent>

        <TabsContent value="perniagaan" className="pt-4">
          <ZakatPerniagaanPanel nisab={nisabPerdagangan} rate={rate} />
        </TabsContent>
      </Tabs>

      <ZakatHistoryTable items={riwayat} />
    </div>
  );
}
