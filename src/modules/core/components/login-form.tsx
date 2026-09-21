"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  loginAction,
  type LoginActionState,
} from "@/modules/core/actions/auth-actions";

const initialState: LoginActionState = { success: false, message: "" };

type Props = {
  /** Path relatif tujuan setelah login berhasil. */
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: Props) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const adaError = Boolean(state.message);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@usaha.id"
            aria-invalid={adaError}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Kata Sandi</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={adaError}
            required
          />
        </Field>
        {adaError ? <FieldError>{state.message}</FieldError> : null}
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Memproses..." : "Masuk"}
      </Button>
    </form>
  );
}
