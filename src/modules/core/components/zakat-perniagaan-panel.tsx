"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { BadgeCheck, Calculator } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { formatRupiah } from "@/lib/format";
import {
  calculateZakatPerniagaan,
  tandaiZakatDibayar,
} from "../actions/zakat-actions";
import {
  hitungPerniagaanSchema,
  type HitungPerniagaanFormValues,
} from "../schemas/zakat-schema";
import type { ZakatPerniagaan } from "../types";

type Props = {
  /** Nisab zakat perniagaan (85 gram emas) — dihitung di server. */
  nisab: number;
  rate: number;
};

export function ZakatPerniagaanPanel({ nisab, rate }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [hasil, setHasil] = useState<ZakatPerniagaan | null>(null);

  const form = useForm<HitungPerniagaanFormValues>({
    resolver: zodResolver(hitungPerniagaanSchema),
    defaultValues: { aset: "", hutang: "" },
  });

  const { errors } = form.formState;

  async function onSubmit(values: HitungPerniagaanFormValues) {
    setSubmitting(true);
    const result = await calculateZakatPerniagaan(values);
    setSubmitting(false);

    if (result.success && result.data) {
      setHasil(result.data);
      return;
    }
    toast.error(result.message);
  }

  async function bayar() {
    const nilai = form.getValues();
    setSubmitting(true);
    const result = await tandaiZakatDibayar({
      type: "TRADE",
      aset: nilai.aset ?? 0,
      hutang: nilai.hutang ?? 0,
    });
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="size-4" />
            Hitung Zakat Perniagaan
          </CardTitle>
          <CardDescription>
            Masukkan harta dagang (aset) dan kewajiban (hutang) usaha Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.aset)}>
                  <FieldLabel htmlFor="aset">Total Aset (Rp)</FieldLabel>
                  <Input
                    id="aset"
                    inputMode="decimal"
                    placeholder="500000000"
                    className="tabular-nums"
                    {...form.register("aset")}
                  />
                  <FieldDescription>
                    Kas, stok barang dagang, dan piutang lancar.
                  </FieldDescription>
                  <FieldError errors={[errors.aset]} />
                </Field>

                <Field data-invalid={Boolean(errors.hutang)}>
                  <FieldLabel htmlFor="hutang">Total Hutang (Rp)</FieldLabel>
                  <Input
                    id="hutang"
                    inputMode="decimal"
                    placeholder="150000000"
                    className="tabular-nums"
                    {...form.register("hutang")}
                  />
                  <FieldDescription>
                    Kewajiban jangka pendek yang harus dibayar.
                  </FieldDescription>
                  <FieldError errors={[errors.hutang]} />
                </Field>
              </div>

              <FieldDescription>
                Nisab zakat perniagaan saat ini {formatRupiah(nisab)} (85 gram
                emas). Harta bersih di bawah nisab belum wajib dizakati.
              </FieldDescription>
            </FieldGroup>

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="self-start"
            >
              <Calculator />
              {submitting ? "Menghitung..." : "Hitung Zakat"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {hasil ? (
        <Card className="border-primary bg-primary-subtle max-w-2xl">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
              Hasil Perhitungan
              {hasil.mencapaiNisab ? (
                <Badge variant="default">Mencapai nisab</Badge>
              ) : (
                <Badge variant="warning">Di bawah nisab</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Aset</dt>
                <dd className="tabular-nums">{formatRupiah(hasil.aset)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Hutang</dt>
                <dd className="tabular-nums">{formatRupiah(hasil.hutang)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">
                  Harta Bersih
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatRupiah(hasil.neto)}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">Nisab</dt>
                <dd className="tabular-nums">{formatRupiah(hasil.nisab)}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-1 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">
                Zakat terutang ({rate * 100}% dari harta bersih)
              </span>
              <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
                {formatRupiah(hasil.terutang)}
              </span>
              <span className="text-xs text-muted-foreground">
                Estimasi 2,5%: {formatRupiah(hasil.estimasi)}
              </span>
            </div>

            <Button
              type="button"
              size="lg"
              className="self-start"
              disabled={submitting}
              onClick={() => void bayar()}
            >
              <BadgeCheck />
              {submitting ? "Menyimpan..." : "Tandai Sudah Dibayar"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
