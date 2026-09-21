"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { createTenant } from "@/modules/core/actions/tenant-actions";
import {
  createTenantSchema,
  type CreateTenantFormValues,
} from "@/modules/core/schemas/tenant-schema";
import { AVAILABLE_MODULES } from "@/modules/core/utils";

export function TenantFormDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: "",
      slug: "",
      subdomain: "",
      plan: "FREE",
      enabledModules: ["INVENTORY", "BILLING"],
      ownerName: "",
      ownerEmail: "",
      ownerPassword: "",
    },
  });

  const { errors } = form.formState;
  const plan = useWatch({ control: form.control, name: "plan" });
  const selectedModules =
    useWatch({ control: form.control, name: "enabledModules" }) ?? [];

  async function onSubmit(values: CreateTenantFormValues) {
    setSubmitting(true);
    const result = await createTenant(values);
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      form.reset();
      setOpen(false);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Tambah Tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tambah Tenant Baru</DialogTitle>
          <DialogDescription>
            Buat usaha baru sekaligus akun OWNER untuk pengelolanya.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FieldSet>
            <FieldLegend variant="label">Data Usaha</FieldLegend>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="name">Nama Usaha</FieldLabel>
                <Input
                  id="name"
                  placeholder="Klinik Sehat Muhammadiyah"
                  {...form.register("name")}
                />
                <FieldError errors={[errors.name]} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.slug)}>
                  <FieldLabel htmlFor="slug">Slug (opsional)</FieldLabel>
                  <Input
                    id="slug"
                    placeholder="klinik-sehat"
                    {...form.register("slug")}
                  />
                  <FieldError errors={[errors.slug]} />
                </Field>
                <Field data-invalid={Boolean(errors.subdomain)}>
                  <FieldLabel htmlFor="subdomain">
                    Subdomain (opsional)
                  </FieldLabel>
                  <Input
                    id="subdomain"
                    placeholder="klinik-sehat"
                    {...form.register("subdomain")}
                  />
                  <FieldError errors={[errors.subdomain]} />
                </Field>
              </div>

              <Field>
                <FieldLabel>Paket</FieldLabel>
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
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Modul Aktif</FieldLegend>
            <FieldGroup className="gap-3">
              {AVAILABLE_MODULES.map((modul) => (
                <Field key={modul.key} orientation="horizontal">
                  <Checkbox
                    id={`module-${modul.key}`}
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
                  <FieldLabel htmlFor={`module-${modul.key}`}>
                    {modul.label}
                  </FieldLabel>
                </Field>
              ))}
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Akun Pemilik (OWNER)</FieldLegend>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.ownerName)}>
                <FieldLabel htmlFor="ownerName">Nama Pemilik</FieldLabel>
                <Input
                  id="ownerName"
                  placeholder="Nama pengelola usaha"
                  {...form.register("ownerName")}
                />
                <FieldError errors={[errors.ownerName]} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.ownerEmail)}>
                  <FieldLabel htmlFor="ownerEmail">Email Pemilik</FieldLabel>
                  <Input
                    id="ownerEmail"
                    type="email"
                    placeholder="owner@usaha.id"
                    {...form.register("ownerEmail")}
                  />
                  <FieldError errors={[errors.ownerEmail]} />
                </Field>
                <Field data-invalid={Boolean(errors.ownerPassword)}>
                  <FieldLabel htmlFor="ownerPassword">
                    Kata Sandi Awal
                  </FieldLabel>
                  <Input
                    id="ownerPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Minimal 8 karakter"
                    {...form.register("ownerPassword")}
                  />
                  <FieldError errors={[errors.ownerPassword]} />
                </Field>
              </div>
            </FieldGroup>
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
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
