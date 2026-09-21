"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import type { ShellUser } from "@/components/layout/nav";
import { inisial } from "@/components/layout/nav";

type Props = {
  user: ShellUser;
  basePath: string;
  logoutAction: () => Promise<void>;
};

/**
 * Bilah atas: remah lokasi dan menu pengguna.
 *
 * Pemicu navigasi sengaja TIDAK ada di sini — di layar kecil navigasi ditangani
 * BottomNav, dan di layar besar sidebar selalu terlihat. Identitas tenant juga
 * tidak diulang karena sudah dibawa sidebar/BottomNav.
 */
export function AppTopbar({ user, basePath, logoutAction }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-2 border-b border-border bg-surface px-4 md:gap-3 md:px-6">
      <Breadcrumbs basePath={basePath} />

      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 pl-1.5">
              <Avatar size="sm">
                <AvatarFallback className="bg-muted text-2xs font-medium text-foreground">
                  {inisial(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[9rem] truncate sm:inline">
                {user.name}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href={`${basePath}/dashboard/settings`}>
                <Settings aria-hidden="true" />
                Pengaturan Branding
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Keluar adalah Server Action, sehingga harus dikirim lewat form.
                Item menu tetap menjadi elemen interaktif agar navigasi papan
                tombol dan pembaca layar berperilaku normal. */}
            <form action={logoutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut aria-hidden="true" />
                  Keluar
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
