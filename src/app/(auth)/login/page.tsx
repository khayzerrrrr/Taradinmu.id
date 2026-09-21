import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/modules/core/auth/dal";
import { LoginForm } from "@/modules/core/components/login-form";

// Hanya menerima path relatif (cegah open redirect).
function ambilCallbackUrl(nilai: string | string[] | undefined): string {
  const raw = typeof nilai === "string" ? nilai : Array.isArray(nilai) ? nilai[0] : undefined;
  if (raw && /^\/(?!\/)/.test(raw)) return raw;
  return "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = ambilCallbackUrl(params.callbackUrl);

  const user = await getCurrentUser();
  if (user) redirect(callbackUrl);

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {/* Logo ditampilkan di mobile; di desktop sudah ada di panel kiri. */}
      <Logo
        variant="stacked"
        tone="light"
        className="mx-auto h-28 w-auto lg:hidden"
      />

      <Card className="w-full">
        <CardHeader>
          {/* Pengecualian yang disengaja: di layar autentikasi tidak ada PageHeader,
              jadi judul kartu inilah judul halaman dan naik ke text-lg. */}
          <CardTitle className="text-lg font-semibold tracking-tight">
            Masuk ke TaradinMu
          </CardTitle>
          <CardDescription>
            Gunakan email dan kata sandi akun Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={callbackUrl} />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        {/* text-primary-solid (#078360) — bukan text-primary: emerald-600 hanya
            3.77:1 di atas putih dan gagal WCAG AA untuk teks. */}
        <Link
          href="/register"
          className="font-medium text-primary-solid underline-offset-4 hover:underline"
        >
          Daftar
        </Link>
      </p>
    </div>
  );
}
