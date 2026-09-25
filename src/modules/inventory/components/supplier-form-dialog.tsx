"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Truck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { createSupplier, updateSupplier } from "../actions/supplier-actions";
import {
  createSupplierSchema,
  type CreateSupplierFormValues,
} from "../schemas/supplier-schema";
import type { SupplierItem } from "../types";

type Props = {
  /** Terisi bila dialog dipakai untuk mengubah; kosong berarti tambah baru. */
  supplier?: SupplierItem;
};

// Field tambah dan ubah identik, jadi validasi di sisi klien memakai skema
// tambah saja; skema ubah tetap menegakkan supplierId di server.
type Values = CreateSupplierFormValues;

const KOSONG: Values = { name: "", phone: "", email: "", address: "", notes: "" };

function nilaiAwal(supplier?: SupplierItem): Values {
  if (!supplier) return KOSONG;
  return {
    name: supplier.name,
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    address: supplier.address ?? "",
    notes: supplier.notes ?? "",
  };
}

/**
 * Satu dialog untuk tambah dan ubah: fieldnya identik, jadi menyalin berkas
 * keduanya hanya membuat perubahan wajib terjadi dua kali.
 */
export function SupplierFormDialog({ supplier }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const mengubah = supplier !== undefined;

  const form = useForm<Values>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: nilaiAwal(supplier),
  });

  // Dialog ini dipakai bergantian untuk beberapa baris, jadi isinya harus
  // mengikuti pemasok yang sedang dipilih.
  useEffect(() => {
    if (open) form.reset(nilaiAwal(supplier));
  }, [open, supplier, form]);

  const { errors } = form.formState;

  async function onSubmit(values: Values) {
    setSubmitting(true);
    const result = mengubah
      ? await updateSupplier({ ...values, supplierId: supplier.id })
      : await createSupplier(values);
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
        {mengubah ? (
          <Button variant="outline" size="sm">
            <Pencil />
            Ubah
          </Button>
        ) : (
          <Button>
            <UserPlus />
            Tambah Pemasok
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-4" />
            {mengubah ? "Ubah Pemasok" : "Tambah Pemasok"}
          </DialogTitle>
          <DialogDescription>
            Pemasok dicatat saat stok masuk, supaya diketahui modal siapa yang
            masih tertahan di rak.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="supplier-name">Nama Pemasok</FieldLabel>
              <Input
                id="supplier-name"
                placeholder="Gudang Bulak Ketur / Ibu Siti"
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.phone)}>
                <FieldLabel htmlFor="supplier-phone">
                  Telepon (opsional)
                </FieldLabel>
                <Input
                  id="supplier-phone"
                  placeholder="0812xxxxxxx"
                  {...form.register("phone")}
                />
                <FieldError errors={[errors.phone]} />
              </Field>
              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="supplier-email">
                  Email (opsional)
                </FieldLabel>
                <Input
                  id="supplier-email"
                  type="email"
                  placeholder="pemasok@email.com"
                  {...form.register("email")}
                />
                <FieldError errors={[errors.email]} />
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.address)}>
              <FieldLabel htmlFor="supplier-address">
                Alamat (opsional)
              </FieldLabel>
              <Textarea
                id="supplier-address"
                placeholder="Alamat pengambilan barang"
                {...form.register("address")}
              />
              <FieldError errors={[errors.address]} />
            </Field>

            <Field data-invalid={Boolean(errors.notes)}>
              <FieldLabel htmlFor="supplier-notes">Catatan (opsional)</FieldLabel>
              <Textarea
                id="supplier-notes"
                placeholder="Mis. tempo 7 hari, minimum pembelian 50 kg"
                {...form.register("notes")}
              />
              <FieldError errors={[errors.notes]} />
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
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
