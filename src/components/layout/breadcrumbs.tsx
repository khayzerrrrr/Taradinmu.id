"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SEGMEN_APLIKASI, SEGMEN_LABEL } from "@/components/layout/nav";
import { cn } from "@/lib/utils";

/**
 * Remah lokasi yang diturunkan dari URL, bukan diketik manual di tiap halaman —
 * sehingga tidak mungkin lagi menyimpang dari rute sebenarnya.
 *
 * Di layar sempit hanya remah terakhir yang tampil: pengguna ponsel butuh tahu
 * "di mana saya", bukan seluruh jalur yang dilalui.
 */
export function Breadcrumbs({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const segmen = pathname.split("/").filter((s) => s.length > 0);

  // Mode path menyisipkan slug tenant di depan (/tokoku/dashboard/...).
  // Segmen yang bukan rute aplikasi dilewati agar slug tidak muncul di UI.
  const mulai = segmen.length > 0 && !SEGMEN_APLIKASI.has(segmen[0]) ? 1 : 0;
  const bermakna = segmen.slice(mulai);

  const remah = bermakna
    .map((seg, i) => ({
      label: SEGMEN_LABEL[seg],
      href: `${basePath}/${bermakna.slice(0, i + 1).join("/")}`,
    }))
    .filter((r): r is { label: string; href: string } => Boolean(r.label));

  if (remah.length === 0) return null;

  return (
    <nav aria-label="Remah lokasi" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {remah.map((r, i) => {
          const terakhir = i === remah.length - 1;
          return (
            <li
              key={r.href}
              className={cn(
                "min-w-0 items-center gap-1.5",
                terakhir ? "flex" : "hidden md:flex",
              )}
            >
              {i > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground/50"
                />
              ) : null}
              {terakhir ? (
                <span
                  aria-current="page"
                  className="truncate font-medium text-foreground"
                >
                  {r.label}
                </span>
              ) : (
                <Link
                  href={r.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {r.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
