"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { updateTenantPlanAndModules } from "@/modules/core/actions/tenant-actions";
import {
  updateTenantSchema,
  type UpdateTenantInput,
} from "@/modules/core/schemas/tenant-schema";
import {
  MODULE_KEYS,
  type ModuleKey,
  type TenantListItem,
} from "@/modules/core/types";
import { AVAILABLE_MODULES } from "@/modules/core/utils";

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
    },
  });

  const plan = useWatch({ control: form.control, name: "plan" });
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
