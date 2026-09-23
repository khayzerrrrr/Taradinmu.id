"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { mintaResetSandi } from "../actions/password-reset-actions";

type Pesan = { ok: boolean; teks: string };

export function LupaSandiForm() {
  const [email, setEmail] = useState("");
  const [pesan, setPesan] = useState<Pesan | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const hasil = await mintaResetSandi({ email });
    setPending(false);
    setPesan({ ok: hasil.success, teks: hasil.message });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@usaha.id"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Mengirim..." : "Kirim Tautan Reset"}
      </Button>

      {pesan ? (
        pesan.ok ? (
          // Jawaban sengaja netral: tidak memastikan apakah email terdaftar.
          <p className="text-sm text-muted-foreground">{pesan.teks}</p>
        ) : (
          <FieldError>{pesan.teks}</FieldError>
        )
      ) : null}
    </form>
  );
}
