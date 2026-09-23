import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResetSandiForm } from "@/modules/core/components/reset-sandi-form";

// Alur "Lupa kata sandi" — langkah 2: simpan kata sandi baru.
// Token diambil dari query string tautan email; validitasnya diperiksa di
// Server Action (bukan di sini), karena halaman ini tidak menyentuh database.
function ambilToken(nilai: string | string[] | undefined): string {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0] ?? "";
  return "";
}

export default async function ResetSandiPage({
  searchParams,
}: PageProps<"/reset-sandi">) {
  const params = await searchParams;
  const token = ambilToken(params.token);

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <Logo
        variant="stacked"
        tone="light"
        className="mx-auto h-28 w-auto lg:hidden"
      />

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold tracking-tight">
            Buat Kata Sandi Baru
          </CardTitle>
          <CardDescription>
            Masukkan kata sandi baru untuk akun Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
            <ResetSandiForm token={token} />
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Tautan tidak lengkap — token reset tidak ditemukan. Silakan minta
                tautan baru.
              </p>
              <Button asChild size="lg" className="w-full">
                <Link href="/lupa-sandi">Minta Tautan Baru</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
