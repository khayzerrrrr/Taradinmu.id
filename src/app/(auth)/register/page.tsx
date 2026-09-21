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
import { RegisterForm } from "@/modules/core/components/register-form";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      {/* Logo ditampilkan di mobile; di desktop sudah ada di panel kiri. */}
      <Logo
        variant="stacked"
        tone="light"
        className="mx-auto h-24 w-auto lg:hidden"
      />

      <Card className="w-full">
        <CardHeader>
          {/* Sama seperti /login: di sini judul kartu berperan sebagai judul halaman. */}
          <CardTitle className="text-lg font-semibold tracking-tight">
            Daftar Usaha Baru
          </CardTitle>
          <CardDescription>
            Pilih jenis usaha Anda — modul yang sesuai akan diaktifkan otomatis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        {/* text-primary-solid, bukan text-primary — alasan kontras sama dengan /login. */}
        <Link
          href="/login"
          className="font-medium text-primary-solid underline-offset-4 hover:underline"
        >
          Masuk
        </Link>
      </p>
    </div>
  );
}
