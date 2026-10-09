"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { updateTenantPlanAndModules } from "@/modules/core/actions/tenant-actions";
import {
  tanggalIsoLokal,
  updateTenantSchema,
  type UpdateTenantInput,
} from "@/modules/core/schemas/tenant-schema";
import {
  MODULE_KEYS,
  type ModuleKey,
  type TenantListItem,
} from "@/modules/core/types";
import { AVAILABLE_MODULES, formatTanggal } from "@/modules/core/utils";
import { formatWaktu } from "@/lib/format";

type Props = {
  tenant: TenantListItem;
};

export function TenantEditDialog({ tenant }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Hanya modul yang dikenal sistem yang dianggap aktif (feature flag).
  const initialModules: ModuleKey[] = tenant.enabledModules.filter(
    (modul): modul is ModuleKey =>
      (MODULE_KEYS as readonly string[]).includes(modul),
  );

  const form = useForm<UpdateTenantInput>({
    resolver: zodResolver(updateTenantSchema),
    defaultValues: {
      tenantId: tenant.id,
      plan: tenant.plan,
      enabledModules: initialModules,
      // Tanggalnya disimpan sebagai Date (UTC tengah malam) dan dikirim ke sini
      // apa adanya: input type="date" hanya menerima YYYY-MM-DD.
      expiresAt: tanggalIsoLokal(tenant.planExpiresAt),
      catatan: "",
    },
  });

  const { errors } = form.formState;
  const plan = useWatch({ control: form.control, name: "plan" });
  const isFree = plan !== "PRO";
  const selectedModules =
    useWatch({ control: form.control, name: "enabledModules" }) ?? [];

  async function onSubmit(values: UpdateTenantInput) {
    setSubmitting(true);
    const result = await updateTenantPlanAndModules(values);
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      setOpen(false);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil />
          Kelola
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kelola Tenant</DialogTitle>
          <DialogDescription>{tenant.name}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FieldSet>
            <FieldLegend variant="label">Paket Langganan</FieldLegend>
            <FieldGroup>
              <Field>
                <FieldLabel>Plan</FieldLabel>
                <Select
                  value={plan}
                  onValueChange={(value) =>
                    form.setValue("plan", value as "FREE" | "PRO", {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">FREE</SelectItem>
                    <SelectItem value="PRO">PRO</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Masa berlaku (PRD 4.D.4): kolomnya hanya berarti selama PRO, jadi
                  ia ikut tidak dapat dipakai saat paketnya FREE — bukan disembunyi-
                  kan, supaya admin masih melihat tanggal yang tersimpan. */}
              <Field data-invalid={Boolean(errors.expiresAt)}>
                <FieldLabel htmlFor={`edit-expires-${tenant.id}`}>
                  Berlaku sampai
                </FieldLabel>
                <Input
                  id={`edit-expires-${tenant.id}`}
                  type="date"
                  disabled={isFree}
                  {...form.register("expiresAt")}
                />
                <FieldDescription>
                  {isFree
                    ? "Tanggal berakhir hanya dipakai pada paket PRO."
                    : "Kosong = tanpa tanggal berakhir. Setelah tanggalnya lewat, aksesnya berjalan sebagai FREE — datanya tidak dihapus."}
                </FieldDescription>
                <FieldError errors={[errors.expiresAt]} />
              </Field>

              <Field data-invalid={Boolean(errors.catatan)}>
                <FieldLabel htmlFor={`edit-catatan-${tenant.id}`}>
                  Catatan perubahan
                </FieldLabel>
                <Input
                  id={`edit-catatan-${tenant.id}`}
                  placeholder="mis. pembayaran 15 Sep via WhatsApp"
                  {...form.register("catatan")}
                />
                <FieldDescription>
                  Hanya tercatat saat paketnya benar-benar berubah, sebagai jejak
                  siapa dan mengapa.
                </FieldDescription>
                <FieldError errors={[errors.catatan]} />
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Modul Aktif</FieldLegend>
            <FieldGroup className="gap-3">
              {AVAILABLE_MODULES.map((modul) => (
                <Field key={modul.key} orientation="horizontal">
                  <Checkbox
                    id={`edit-module-${tenant.id}-${modul.key}`}
                    checked={selectedModules.includes(modul.key)}
                    onCheckedChange={(checked) => {
                      const next =
                        checked === true
                          ? [...selectedModules, modul.key]
                          : selectedModules.filter((key) => key !== modul.key);
                      form.setValue("enabledModules", next, {
                        shouldValidate: true,
                      });
                    }}
                  />
                  <FieldLabel htmlFor={`edit-module-${tenant.id}-${modul.key}`}>
                    {modul.label}
                  </FieldLabel>
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>

          {/* Riwayat paket (PRD 4.D.4): hanya beberapa perubahan terakhir, dan
              hanya dibaca. Barisnya append-only di database — tidak ada tombol
              hapus di sini karena riwayat yang bisa dihapus bukan riwayat. */}
          <FieldSet>
            <FieldLegend variant="label">Riwayat Paket</FieldLegend>
            {tenant.riwayat.length === 0 ? (
              <FieldDescription>
                Belum ada perubahan paket yang tercatat untuk tenant ini.
              </FieldDescription>
            ) : (
              <FieldGroup className="gap-2">
                {tenant.riwayat.map((ubah) => (
                  <div key={ubah.id} className="flex flex-col gap-0.5">
                    <span className="text-sm">
                      {ubah.dari} &rarr; {ubah.ke}
                      {ubah.expiresAt
                        ? ` · berlaku sampai ${formatTanggal(ubah.expiresAt)}`
                        : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatWaktu(ubah.createdAt)}
                      {ubah.oleh ? ` · oleh ${ubah.oleh}` : ""}
                      {ubah.catatan ? ` — ${ubah.catatan}` : ""}
                    </span>
                  </div>
                ))}
              </FieldGroup>
            )}
          </FieldSet>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
