import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LupaSandiForm } from "@/modules/core/components/lupa-sandi-form";

// Alur "Lupa kata sandi" — langkah 1: minta tautan reset lewat email.
export default function LupaSandiPage() {
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
            Lupa Kata Sandi
          </CardTitle>
          <CardDescription>
            Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat
            kata sandi baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LupaSandiForm />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Ingat kata sandi Anda?{" "}
        <Link
          href="/login"
          className="font-medium text-primary-solid underline-offset-4 hover:underline"
        >
          Kembali ke halaman masuk
        </Link>
      </p>
    </div>
  );
}
