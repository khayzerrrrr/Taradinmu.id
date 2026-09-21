"use server";

import { AuthError } from "next-auth";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  isUniqueConstraintError,
  pesanErrorUmum,
  pesanValidasi,
} from "@/lib/action";
import { getPresetConfig } from "@/lib/business-presets";
import { signIn } from "@/modules/core/auth";
import { registerSchema } from "@/modules/core/schemas/register-schema";
import { slugify } from "@/modules/core/utils";
import { isReservedSlug } from "@/shared/constants";

export type RegisterActionState = {
  success: boolean;
  message: string;
  error?: string;
};

// Cari slug yang belum dipakai. Nama yang menabrak route sistem (mis. "Admin")
// digeser agar tidak menimpa /admin, lalu diberi akhiran angka bila sudah terpakai.
async function cariSlugUnik(nama: string): Promise<string> {
  const dasar = slugify(nama) || "usaha";
  const akar = isReservedSlug(dasar) ? `${dasar}-usaha` : dasar;

  let kandidat = akar;
  for (let urutan = 2; urutan <= 50; urutan += 1) {
    const sudahDipakai = await prisma.tenant.findUnique({
      where: { slug: kandidat },
      select: { id: true },
    });
    if (!sudahDipakai) return kandidat;
    kandidat = `${akar}-${urutan}`;
  }

  return `${akar}-${Date.now().toString(36)}`;
}

// Registrasi mandiri: buat Tenant + akun OWNER, aktifkan modul sesuai preset
// jenis usaha, lalu langsung masuk ke dashboard tenant.
export async function registerTenantWithPreset(
  _prevState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const parsed = registerSchema.safeParse({
    businessName: formData.get("businessName"),
    businessType: formData.get("businessType"),
    ownerName: formData.get("ownerName"),
    ownerEmail: formData.get("ownerEmail"),
    ownerPassword: formData.get("ownerPassword"),
  });

  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const data = parsed.data;
  const preset = getPresetConfig(data.businessType);
  const email = data.ownerEmail.trim().toLowerCase();

  let slug: string;
  try {
    slug = await cariSlugUnik(data.businessName);
    const passwordHash = await hash(data.ownerPassword, 10);

    // Tenant + user OWNER dibuat dalam satu query bersarang (atomik).
    await prisma.tenant.create({
      data: {
        name: data.businessName,
        slug,
        plan: "FREE",
        businessType: preset.businessType,
        enabledModules: [...preset.enabledModules],
        categories: [...preset.categories],
        users: {
          create: {
            name: data.ownerName,
            email,
            password: passwordHash,
            role: "OWNER",
          },
        },
      },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        message: "Email sudah terdaftar. Gunakan email lain atau masuk.",
      };
    }
    return {
      success: false,
      message: "Gagal membuat akun usaha.",
      error: pesanErrorUmum(error),
    };
  }

  try {
    await signIn("credentials", {
      email,
      password: data.ownerPassword,
      redirectTo: `/${slug}/dashboard`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        success: false,
        message: "Usaha berhasil dibuat. Silakan masuk dengan akun Anda.",
      };
    }
    // redirect() dari Next.js dilempar sebagai error khusus — biarkan lewat.
    throw error;
  }

  return { success: true, message: "Akun usaha berhasil dibuat." };
}
