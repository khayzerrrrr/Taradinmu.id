import { readFileSync } from "node:fs";
import path from "node:path";

// Halaman depan (landing page). Berupa HTML statis mandiri (CSS + JS sendiri)
// di src/landing/index.html, sehingga gayanya tidak bercampur dengan UI aplikasi.
// Dibaca sekali saat build; ubah kontennya dengan mengedit berkas HTML tersebut.
export const dynamic = "force-static";

// Origin absolut hanya untuk gambar Open Graph; di dev cukup path relatif.
const origin =
  process.env.NODE_ENV === "production"
    ? `https://${process.env.ROOT_DOMAIN ?? "taradinmu.id"}`
    : "";

const html = readFileSync(
  path.join(process.cwd(), "src/landing/index.html"),
  "utf8",
).replaceAll("{{ORIGIN}}", origin);

export function GET() {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
