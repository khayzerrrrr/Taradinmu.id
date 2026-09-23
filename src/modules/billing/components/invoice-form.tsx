"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FilePlus2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { createInvoice } from "../actions/invoice-actions";
import {
  createInvoiceSchema,
  type CreateInvoiceFormValues,
} from "../schemas/invoice-schema";
import type { InvoiceVariantOption } from "../types";
import { formatRupiah, hitungTotal } from "../utils";

type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
};

type Props = {
  customers: CustomerOption[];
  variants: InvoiceVariantOption[];
  defaultDueDate: string;
};

export function InvoiceForm({ customers, variants, defaultDueDate }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      customerId: "",
      dueDate: defaultDueDate,
      taxPercent: "0",
      items: [{ variantId: "", quantity: "1" }],
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const { errors } = form.formState;
  const itemWatch = useWatch({ control: form.control, name: "items" });
  const customerId = useWatch({ control: form.control, name: "customerId" });
  const taxWatch = useWatch({ control: form.control, name: "taxPercent" });

  // Total dihitung dari harga varian di server (di sini hanya pratinjau).
  const rincian = (itemWatch ?? []).map((item) => {
    const variant = variants.find((v) => v.id === item?.variantId);
    const jumlah = Number(item?.quantity ?? 0);
    return {
      quantity: Number.isFinite(jumlah) ? jumlah : 0,
      price: variant ? Number(variant.price) : 0,
    };
  });
  const taxPercent = Number(taxWatch ?? 0);
  const total = hitungTotal(rincian, Number.isFinite(taxPercent) ? taxPercent : 0);

  async function onSubmit(values: CreateInvoiceFormValues) {
    setSubmitting(true);
    const result = await createInvoice(values);
    setSubmitting(false);

    if (result.success && result.data) {
      const rincianAlokasi = result.data.allocations
        .map((alokasi) => `${alokasi.batchNumber}: ${alokasi.quantity}`)
        .join(", ");
      toast.success(
        rincianAlokasi ? `${result.message} Stok: ${rincianAlokasi}` : result.message,
      );
      form.reset({
        customerId: "",
        dueDate: defaultDueDate,
        taxPercent: "0",
        items: [{ variantId: "", quantity: "1" }],
        notes: "",
      });
      router.refresh();
      return;
    }
    if (result.code === "UPGRADE_REQUIRED") {
      toast.error(result.message, { duration: 8000 });
      return;
    }
    toast.error(result.message);
  }

  const siap = customers.length > 0 && variants.length > 0;

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FilePlus2 className="size-4" />
          Buat Invoice Baru
        </CardTitle>
        <CardDescription>
          Invoice disimpan sebagai Draft dan stok langsung dipotong memakai FEFO
          (batch kedaluwarsa terdekat lebih dulu).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!siap ? (
          <p className="text-sm text-muted-foreground">
            {customers.length === 0
              ? "Belum ada pelanggan. Tambahkan pelanggan lebih dulu."
              : "Belum ada varian produk. Tambahkan produk & varian di modul Inventory."}
          </p>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.customerId)}>
                  <FieldLabel>Pelanggan</FieldLabel>
                  <Select
                    value={customerId}
                    onValueChange={(value) =>
                      form.setValue("customerId", value, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih pelanggan" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                          {customer.phone ? ` — ${customer.phone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[errors.customerId]} />
                </Field>

                <Field data-invalid={Boolean(errors.dueDate)}>
                  <FieldLabel htmlFor="dueDate">Jatuh Tempo</FieldLabel>
                  <Input id="dueDate" type="date" {...form.register("dueDate")} />
                  <FieldError errors={[errors.dueDate]} />
                </Field>
              </div>

              <Field data-invalid={Boolean(errors.taxPercent)}>
                <FieldLabel htmlFor="taxPercent">PPN (%) — opsional</FieldLabel>
                <Input
                  id="taxPercent"
                  inputMode="decimal"
                  placeholder="0"
                  className="max-w-32"
                  {...form.register("taxPercent")}
                />
                <FieldDescription>
                  Integrasi pajak penuh ada di Fase 2; di sini hanya menambah
                  nilai pajak ke total.
                </FieldDescription>
                <FieldError errors={[errors.taxPercent]} />
              </Field>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Item Invoice</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ variantId: "", quantity: "1" })}
                  >
                    <Plus />
                    Tambah Item
                  </Button>
                </div>

                <div className="overflow-hidden rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Varian</TableHead>
                        <TableHead className="w-28 text-right">Jumlah</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => {
                        const barisError = errors.items?.[index];
                        const variantDipilih = variants.find(
                          (v) => v.id === itemWatch?.[index]?.variantId,
                        );

                        return (
                          <TableRow key={field.id}>
                            <TableCell>
                              <Field
                                data-invalid={Boolean(barisError?.variantId)}
                              >
                                <FieldLabel className="sr-only">
                                  Varian #{index + 1}
                                </FieldLabel>
                                <Select
                                  value={itemWatch?.[index]?.variantId ?? ""}
                                  onValueChange={(value) =>
                                    form.setValue(
                                      `items.${index}.variantId`,
                                      value,
                                      { shouldValidate: true },
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Pilih varian" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {variants.map((variant) => (
                                      <SelectItem
                                        key={variant.id}
                                        value={variant.id}
                                      >
                                        {variant.productName} · {variant.name} (
                                        {variant.sku}) —{" "}
                                        {formatRupiah(variant.price)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {variantDipilih ? (
                                  <FieldDescription>
                                    {variantDipilih.kind === "SERVICE"
                                      ? "Layanan — tanpa stok, invoice ini tidak memotong stok."
                                      : `Stok layak: ${variantDipilih.available} unit`}
                                  </FieldDescription>
                                ) : null}
                                <FieldError errors={[barisError?.variantId]} />
                              </Field>
                            </TableCell>
                            <TableCell className="text-right">
                              <Field data-invalid={Boolean(barisError?.quantity)}>
                                <FieldLabel className="sr-only">Jumlah</FieldLabel>
                                <Input
                                  inputMode="numeric"
                                  className="tabular-nums"
                                  {...form.register(`items.${index}.quantity`)}
                                />
                                <FieldError errors={[barisError?.quantity]} />
                              </Field>
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={fields.length <= 1}
                                onClick={() => remove(index)}
                                aria-label={`Hapus item ${index + 1}`}
                              >
                                <Trash2 />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <FieldError
                  errors={[
                    typeof errors.items?.message === "string"
                      ? { message: errors.items.message }
                      : undefined,
                  ]}
                />
              </div>

              <Field data-invalid={Boolean(errors.notes)}>
                <FieldLabel htmlFor="invoice-notes">Catatan (opsional)</FieldLabel>
                <Textarea
                  id="invoice-notes"
                  placeholder="Catatan untuk pelanggan / internal"
                  {...form.register("notes")}
                />
                <FieldError errors={[errors.notes]} />
              </Field>

              <div className="flex flex-col items-end gap-1 border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  Subtotal: {formatRupiah(total.subtotal)}
                </span>
                <span className="text-muted-foreground">
                  PPN: {formatRupiah(total.taxAmount)}
                </span>
                <span className="font-medium tabular-nums">
                  Total: {formatRupiah(total.totalAmount)}
                </span>
              </div>
            </FieldGroup>

            <Button type="submit" disabled={submitting} size="lg" className="self-start">
              {submitting ? "Menyimpan..." : "Simpan Invoice (Draft)"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
