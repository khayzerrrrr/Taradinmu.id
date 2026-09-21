// Registry modul kini tinggal di src/shared/modules (dipakai lintas modul).
export { AVAILABLE_MODULES } from "@/shared/modules";

// Format tanggal kini tinggal di src/lib/format (helper global).
export { formatTanggal } from "@/lib/format";

// Ubah nama usaha menjadi slug URL, contoh: "Klinik Sehat Muhammadiyah" -> "klinik-sehat-muhammadiyah".
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
