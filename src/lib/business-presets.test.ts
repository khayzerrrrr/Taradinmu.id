import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BusinessType } from "@/generated/prisma/client";
import { ITEM_KINDS } from "@/shared/item-kind";
import { BUSINESS_PRESETS, getPresetConfig } from "./business-presets";

// Latar belakang: preset TRAVEL_UMROH, JASA_ORDER, dan EDUCATION pernah hanya
// memberi modul BILLING, padahal pembuatan item katalog berada di modul
// INVENTORY. Tenant yang mendaftar sebagai usaha jasa jadi buntu total: tidak
// bisa membuat satu pun item yang bisa ditagih. Tes ini mengunci perbaikannya.

const MODUL_WAJIB = ["INVENTORY", "BILLING", "ACCOUNTING"] as const;

describe("preset jenis usaha", () => {
  it("menyalakan INVENTORY, BILLING, dan ACCOUNTING untuk semua jenis usaha", () => {
    for (const preset of BUSINESS_PRESETS) {
      for (const modul of MODUL_WAJIB) {
        assert.ok(
          preset.enabledModules.includes(modul),
          `preset ${preset.businessType} tidak menyalakan ${modul}`,
        );
      }
    }
  });

  it("setiap preset punya jenis item awal yang sah", () => {
    for (const preset of BUSINESS_PRESETS) {
      assert.ok(
        ITEM_KINDS.includes(preset.defaultItemKind),
        `defaultItemKind tidak dikenal pada ${preset.businessType}`,
      );
    }
  });

  it("usaha jasa berawalan jasa, usaha barang berawalan barang", () => {
    assert.equal(getPresetConfig("TRAVEL_UMROH").defaultItemKind, "SERVICE");
    assert.equal(getPresetConfig("JASA_ORDER").defaultItemKind, "SERVICE");
    assert.equal(getPresetConfig("EDUCATION").defaultItemKind, "SERVICE");
    assert.equal(getPresetConfig("PROJECT_BASED").defaultItemKind, "SERVICE");
    assert.equal(getPresetConfig("RETAIL_FNB").defaultItemKind, "GOODS");
    assert.equal(getPresetConfig("TRADING").defaultItemKind, "GOODS");
    assert.equal(getPresetConfig("HEALTH_CLINIC").defaultItemKind, "GOODS");
  });

  it("tetap 8 preset dengan businessType unik", () => {
    const tipe = BUSINESS_PRESETS.map((preset) => preset.businessType);
    assert.equal(tipe.length, 8);
    assert.equal(new Set(tipe).size, 8);
  });

  it("mengembalikan preset yang cocok", () => {
    assert.equal(getPresetConfig("JASA_ORDER").businessType, "JASA_ORDER");
    assert.equal(getPresetConfig("RETAIL_FNB").label, "Toko & Kuliner");
  });

  it("jatuh ke preset cadangan untuk jenis usaha yang tidak dikenal", () => {
    const tidakDikenal = "TIDAK_ADA" as unknown as BusinessType;
    assert.equal(getPresetConfig(tidakDikenal).businessType, "OTHER");
  });

  it("memberi salinan daftar modul sendiri per preset", () => {
    // Kalau daftar ini dibagi bersama (satu referensi), perubahan pada satu
    // preset bisa bocor ke semua preset lain.
    const retail = getPresetConfig("RETAIL_FNB").enabledModules;
    const trading = getPresetConfig("TRADING").enabledModules;
    assert.notEqual(retail, trading);
    assert.deepEqual(trading, [...MODUL_WAJIB]);
  });
});
