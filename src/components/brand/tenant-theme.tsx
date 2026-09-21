"use client";

import { useEffect } from "react";
import type { Branding } from "@/lib/branding";
import { BRANDING_VAR_KEYS, brandingVars } from "@/lib/branding";

type Props = {
  branding: Branding;
};

// Dialog/Select/AlertDialog dari Radix mem-portal ke document.body, yaitu DI LUAR subtree
// layout tenant, sehingga tidak mewarisi CSS variable dari wrapper. Komponen ini menyalin
// variabel yang sama ke documentElement agar komponen portal ikut berwarna tenant,
// lalu membersihkannya saat unmount.
//
// Nilainya diturunkan langsung dari objek Branding agar tidak bisa menyimpang dari
// nilai yang dipasang lewat brandingStyle() pada wrapper.
export function TenantTheme({ branding }: Props) {
  const { accentColor, solidColor, solidHoverColor, primaryForeground } = branding;

  useEffect(() => {
    const root = document.documentElement;
    const nilaiLama = new Map<string, string>();

    for (const key of BRANDING_VAR_KEYS) {
      nilaiLama.set(key, root.style.getPropertyValue(key));
    }

    const vars = brandingVars({
      ...branding,
    } as Branding);
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    return () => {
      for (const key of BRANDING_VAR_KEYS) {
        const lama = nilaiLama.get(key) ?? "";
        if (lama.length > 0) root.style.setProperty(key, lama);
        else root.style.removeProperty(key);
      }
    };
    // Primitif warna adalah satu-satunya masukan yang berpengaruh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentColor, solidColor, solidHoverColor, primaryForeground]);

  return null;
}
