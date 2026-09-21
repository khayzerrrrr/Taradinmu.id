import { Logo } from "@/components/brand/logo";
import type { Branding } from "@/lib/branding";
import { cn } from "@/lib/utils";

type Props = {
  branding: Branding;
  tenantName: string;
  variant?: "mark" | "horizontal";
  tone?: "light" | "dark" | "auto";
  className?: string;
};

// Logo tenant dengan fallback resmi TaradinMu (docs/BRAND.md):
// belum ada logo kustom / plan FREE -> pakai <Logo />.
export function TenantLogo({
  branding,
  tenantName,
  variant = "mark",
  tone = "auto",
  className,
}: Props) {
  if (branding.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo di-host oleh tenant (host dinamis)
      <img
        src={branding.logoUrl}
        alt={`Logo ${tenantName}`}
        className={cn("object-contain", className)}
      />
    );
  }

  return (
    <Logo variant={variant} tone={tone} title={tenantName} className={className} />
  );
}
