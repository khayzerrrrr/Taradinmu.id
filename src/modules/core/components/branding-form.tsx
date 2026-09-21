"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageUp, Palette, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { TenantLogo } from "@/components/brand/tenant-logo";
import { HEX_COLOR_PATTERN, resolveBranding } from "@/lib/branding";
import {
  removeTenantLogo,
  updateTenantBranding,
} from "@/modules/core/actions/branding-actions";

const PRESET_WARNA = [
  "#059669",
  "#0f172a",
  "#d97706",
  "#2563eb",
  "#7c3aed",
  "#dc2626",
] as const;

type Props = {
  isPro: boolean;
  primaryColor: string;
  logoUrl: string | null;
  tenantName: string;
};

export function BrandingForm({
  isPro,
  primaryColor,
  logoUrl,
  tenantName,
}: Props) {
  const router = useRouter();
  const [warna, setWarna] = useState(primaryColor);
  const [pending, setPending] = useState(false);
  const [pesanError, setPesanError] = useState<string | null>(null);

  const brandingPratinjau = resolveBranding({
    plan: isPro ? "PRO" : "FREE",
    primaryColor: warna,
    customLogoUrl: logoUrl,
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPesanError(null);

    if (!HEX_COLOR_PATTERN.test(warna)) {
      setPesanError("Warna harus format hex, contoh #059669.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("primaryColor", warna);

    setPending(true);
    const hasil = await updateTenantBranding(formData);
    setPending(false);

    if (hasil.success) {
      toast.success(hasil.message);
      router.refresh();
      return;
    }
    setPesanError(hasil.message);
    toast.error(hasil.message);
  }

  async function onHapusLogo() {
    setPending(true);
    const hasil = await removeTenantLogo();
    setPending(false);

    if (hasil.success) {
      toast.success(hasil.message);
      router.refresh();
      return;
    }
    toast.error(hasil.message);
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="max-w-3xl flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageUp className="size-4" />
              Logo Toko
              {!isPro ? (
                <Badge className="bg-brand-accent/20 text-brand-accent">
                  PRO
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              PNG, JPEG, WebP, atau SVG. Maksimal 512 KB. Bila tidak diunggah,
              sistem memakai logo TaradinMu.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-lg border bg-muted/30 p-2">
                <TenantLogo
                  branding={brandingPratinjau}
                  tenantName={tenantName}
                  variant="mark"
                  className="max-h-12 w-auto"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={!isPro || pending}
                  className="max-w-xs"
                />
                <FieldDescription>
                  Mengganti logo akan menghapus berkas logo lama.
                </FieldDescription>
              </div>
            </div>

            {logoUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={!isPro || pending}
                onClick={() => void onHapusLogo()}
              >
                <Trash2 />
                Hapus logo kustom
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-4" />
              Warna Utama
              {!isPro ? (
                <Badge className="bg-brand-accent/20 text-brand-accent">
                  PRO
                </Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              Warna ini diterapkan ke tombol utama, sorotan, dan item menu aktif
              di area toko Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field data-invalid={Boolean(pesanError)}>
                <FieldLabel htmlFor="primaryColorHex">
                  Kode warna (hex)
                </FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pilih warna"
                    value={HEX_COLOR_PATTERN.test(warna) ? warna : "#059669"}
                    disabled={!isPro || pending}
                    onChange={(event) => setWarna(event.target.value)}
                    className="h-9 w-14 cursor-pointer rounded-lg border border-input bg-transparent"
                  />
                  <Input
                    id="primaryColorHex"
                    value={warna}
                    disabled={!isPro || pending}
                    onChange={(event) => setWarna(event.target.value)}
                    placeholder="#059669"
                    className="max-w-40 tabular-nums"
                    inputMode="text"
                  />
                  <span
                    className="rounded-lg px-3 py-2 text-sm font-medium"
                    style={{
                      backgroundColor: brandingPratinjau.accentColor,
                      color: brandingPratinjau.primaryForeground,
                    }}
                  >
                    Pratinjau tombol
                  </span>
                </div>
                <FieldError errors={[{ message: pesanError ?? undefined }]} />
              </Field>

              <Field>
                <FieldLabel>Preset</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {PRESET_WARNA.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      aria-label={`Pakai warna ${preset}`}
                      disabled={!isPro || pending}
                      onClick={() => setWarna(preset)}
                      className="size-8 rounded-lg border border-input transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: preset }}
                    />
                  ))}
                </div>
              </Field>
            </FieldGroup>

            <Button
              type="submit"
              className="self-start"
              disabled={!isPro || pending}
            >
              <Save />
              {pending ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
