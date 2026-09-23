"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
} from "@/components/ui/field";
import { updateUser } from "../actions/user-actions";
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  updateUserSchema,
  type UpdateUserInput,
} from "../schemas/user-schema";
import type { UserListItem } from "../types";

type Props = {
  user: UserListItem;
};

type FormValues = UpdateUserInput;

export function UserEditDialog({ user }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      userId: user.id,
      name: user.name,
      role: user.role as FormValues["role"],
      password: "",
    },
  });

  // useWatch (bukan form.watch) agar React Compiler tidak melewati memo komponen ini.
  const roleTerpilih = useWatch({ control: form.control, name: "role" });
  const { errors } = form.formState;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const result = await updateUser(values);
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
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${user.name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Pengguna</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FieldGroup>
            <input type="hidden" {...form.register("userId")} />

            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor={`user-name-${user.id}`}>Nama</FieldLabel>
              <Input
                id={`user-name-${user.id}`}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.role)}>
              <FieldLabel>Role</FieldLabel>
              <Select
                value={roleTerpilih}
                onValueChange={(value) =>
                  form.setValue("role", value as FormValues["role"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[errors.role]} />
            </Field>

            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor={`user-password-${user.id}`}>
                Kata sandi baru (opsional)
              </FieldLabel>
              <Input
                id={`user-password-${user.id}`}
                type="password"
                autoComplete="new-password"
                placeholder="Kosongkan jika tidak ingin mengubah"
                {...form.register("password")}
              />
              <FieldError errors={[errors.password]} />
              <p className="text-xs text-muted-foreground">
                Kosongkan jika tidak ingin mengubah kata sandi.
              </p>
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
              {submitting ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
