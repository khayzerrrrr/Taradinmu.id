// Kontak admin (murni, client-safe).

/**
 * Normalisasi nomor telepon ke format wa.me: hanya angka, awalan "0" diganti "62"
 * (mis. "08970991994" -> "628970991994"). Nomor yang sudah berawalan 62 dibiarkan.
 */
export function nomorWa(input: string): string {
  const digit = input.replace(/\D/g, "");
  if (digit.startsWith("0")) return `62${digit.slice(1)}`;
  return digit;
}

/** Nomor WhatsApp admin TaradinMu (dapat diatur lewat env). */
export const WA_ADMIN = nomorWa(
  process.env.NEXT_PUBLIC_WHATSAPP_ADMIN ?? "08970991994",
);

/** Tautan chat WhatsApp beserta pesan awal. */
export function tautanWa(pesan: string, nomor: string = WA_ADMIN): string {
  return `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`;
}
