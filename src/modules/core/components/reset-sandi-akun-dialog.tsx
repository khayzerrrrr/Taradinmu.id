"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { resetKataSandiAkun } from "../actions/user-actions";
import {
  resetSandiAkunSchema,
  type ResetSandiAkunInput,
} from "../schemas/user-schema";

type FormValues = ResetSandiAkunInput;

/**
 * Pemulihan akun bagi tenant yang tidak bisa memakai /lupa-sandi (PRD 4.B):
 * paket FREE hanya punya satu akun (OWNER), dan tautan reset bergantung pada
 * penyuplai email yang terkonfigurasi.
 */
export function ResetSandiAkunDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(resetSandiAkunSchema),
    defaultValues: { email: "", password: "", konfirmasi: "" },
  });
  const { errors } = form.formState;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const hasil = await resetKataSandiAkun(values);
    setSubmitting(false);

    if (!hasil.success) {
      toast.error(hasil.message);
      return;
    }

    toast.success(hasil.message);
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={submitting}>
          <KeyRound />
          Reset sandi akun
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reset Kata Sandi Akun</DialogTitle>
          <DialogDescription>
            Untuk memulihkan akses akun yang tidak bisa melakukan reset sendiri —
            termasuk akun Pemilik (OWNER). Kata sandi lama tidak diminta, dan
            setiap penggunaan dicatat ke log server.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="reset-sandi-email">Email akun</FieldLabel>
              <Input
                id="reset-sandi-email"
                type="email"
                autoComplete="off"
                placeholder="pemilik@toko.id"
                {...form.register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>

            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="reset-sandi-password">Kata sandi baru</FieldLabel>
              <Input
                id="reset-sandi-password"
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
              <FieldError errors={[errors.password]} />
            </Field>

            <Field data-invalid={Boolean(errors.konfirmasi)}>
              <FieldLabel htmlFor="reset-sandi-konfirmasi">
                Ulangi kata sandi
              </FieldLabel>
              <Input
                id="reset-sandi-konfirmasi"
                type="password"
                autoComplete="new-password"
                {...form.register("konfirmasi")}
              />
              <FieldError errors={[errors.konfirmasi]} />
              <FieldDescription>
                Sesi yang sedang aktif di perangkat pemilik tidak berakhir
                otomatis; minta mereka masuk ulang untuk memastikan.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Reset kata sandi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
