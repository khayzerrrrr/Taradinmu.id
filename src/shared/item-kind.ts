import type { ItemKind } from "@/generated/prisma/client";

// Sifat item katalog: barang (punya stok) atau jasa (tanpa stok).
//
// Ditaruh di src/shared karena dipakai lintas modul — katalog inventory, baris
// invoice billing, dan nilai awal preset jenis usaha. Mengimpor ini dari schema
// salah satu modul akan membalik arah dependensi (src/lib → modul).
//
// `satisfies` menjaga daftar ini tetap sinkron dengan `enum ItemKind` di
// prisma/schema.prisma: menambah nilai di schema tanpa menambah di sini akan
// gagal saat typecheck.
export const ITEM_KINDS = [
  "GOODS",
  "SERVICE",
] as const satisfies readonly ItemKind[];

export type ItemKindValue = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABELS: Record<ItemKindValue, string> = {
  GOODS: "Barang",
  SERVICE: "Jasa",
};
