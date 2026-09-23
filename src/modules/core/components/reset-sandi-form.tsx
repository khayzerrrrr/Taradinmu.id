"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { simpanSandiBaru } from "../actions/password-reset-actions";

type Props = {
  /** Token dari tautan email; sudah diverifikasi bentuknya oleh halaman. */
  token: string;
};

type Pesan = { ok: boolean; teks: string };

export function ResetSandiForm({ token }: Props) {
  const [password, setPassword] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [selesai, setSelesai] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const hasil = await simpanSandiBaru({ token, password, konfirmasi });
    setPending(false);
    setPesan({ ok: hasil.success, teks: hasil.message });

    if (hasil.success) {
      setSelesai(true);
      setPassword("");
      setKonfirmasi("");
    }
  }

  if (selesai) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">{pesan?.teks}</p>
        <Button asChild size="lg" className="w-full">
          <Link href="/login">Masuk sekarang</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">Kata Sandi Baru</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <FieldDescription>
            Gunakan minimal 8 karakter yang tidak dipakai di layanan lain.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="konfirmasi">Ulangi Kata Sandi</FieldLabel>
          <Input
            id="konfirmasi"
            name="konfirmasi"
            type="password"
            autoComplete="new-password"
            value={konfirmasi}
            onChange={(event) => setKonfirmasi(event.target.value)}
            required
          />
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan Kata Sandi"}
      </Button>

      {pesan && !pesan.ok ? <FieldError>{pesan.teks}</FieldError> : null}
    </form>
  );
}
