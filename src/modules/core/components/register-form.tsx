"use client";

import { useActionState, useState } from "react";
import {
  Factory,
  Pill,
  Shapes,
  Store,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  registerTenantWithPreset,
  type RegisterActionState,
} from "@/modules/core/actions/register-actions";
import { BUSINESS_PRESETS } from "@/lib/business-presets";
import type { BusinessType } from "@/generated/prisma/client";

// Ikon per jenis usaha (dipetakan di UI, bukan di file preset yang murni data).
const PRESET_ICONS: Record<BusinessType, LucideIcon> = {
  RETAIL: Store,
  FNB: UtensilsCrossed,
  PHARMACY: Pill,
  SERVICE: Wrench,
  MANUFACTURING: Factory,
  OTHER: Shapes,
};

const initialState: RegisterActionState = { success: false, message: "" };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerTenantWithPreset,
    initialState,
  );
  const [jenisUsaha, setJenisUsaha] = useState<BusinessType>("RETAIL");
  const adaError = Boolean(state.message);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend variant="label">Jenis Usaha</FieldLegend>
        <div
          role="radiogroup"
          aria-label="Jenis Usaha"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {BUSINESS_PRESETS.map((preset) => {
            const Ikon = PRESET_ICONS[preset.businessType];
            const aktif = jenisUsaha === preset.businessType;

            return (
              <label
                key={preset.businessType}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                  "has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  aktif
                    ? "border-primary bg-primary-subtle"
                    : "border-border bg-card hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="businessType"
                  value={preset.businessType}
                  checked={aktif}
                  onChange={() => setJenisUsaha(preset.businessType)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md",
                    aktif
                      ? "bg-primary-solid text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Ikon className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{preset.label}</span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {preset.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Data Usaha & Pemilik</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="businessName">Nama Usaha</FieldLabel>
            <Input
              id="businessName"
              name="businessName"
              placeholder="Klinik Sehat Muhammadiyah"
              aria-invalid={adaError}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="ownerName">Nama Pemilik</FieldLabel>
            <Input
              id="ownerName"
              name="ownerName"
              autoComplete="name"
              placeholder="Nama lengkap pengelola"
              aria-invalid={adaError}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="ownerEmail">Email</FieldLabel>
            <Input
              id="ownerEmail"
              name="ownerEmail"
              type="email"
              autoComplete="email"
              placeholder="nama@usaha.id"
              aria-invalid={adaError}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="ownerPassword">Kata Sandi</FieldLabel>
            <Input
              id="ownerPassword"
              name="ownerPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              aria-invalid={adaError}
              required
            />
          </Field>

          {adaError ? <FieldError>{state.message}</FieldError> : null}
        </FieldGroup>
      </FieldSet>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Membuat akun..." : "Buat Akun Usaha"}
      </Button>
    </form>
  );
}
