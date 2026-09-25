"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, Search, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableToolbar } from "@/components/shared/data-table-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { DeleteUserDialog } from "./delete-user-dialog";
import { UserEditDialog } from "./user-edit-dialog";
import { UserFormDialog } from "./user-form-dialog";
import { SEMUA_ROLE_LABELS } from "../schemas/user-schema";
import type { PaginationMeta, UserListItem } from "../types";
import { formatTanggal } from "@/lib/format";

type Props = {
  users: UserListItem[];
  meta: PaginationMeta;
  search: string;
  /** false → tombol "Tambah Pengguna" membuka UpgradeModal, bukan form. */
  bolehTambah: boolean;
};

const ROLE_BADGE_VARIANT: Record<string, "default" | "info" | "success" | "neutral"> = {
  OWNER: "default",
  ADMIN: "info",
  ACCOUNTANT: "success",
  STAFF: "neutral",
};

export function UserTable({ users, meta, search, bolehTambah }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [kataKunci, setKataKunci] = useState(search);

  const bisaSebelumnya = meta.page > 1;
  const bisaBerikutnya = meta.page < meta.totalPages;

  function bukaUrl(next: { page?: number; search?: string }) {
    const params = new URLSearchParams();
    const q = (next.search ?? kataKunci).trim();
    if (q) params.set("search", q);
    const page = next.page ?? 1;
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const tombolTambah = bolehTambah ? (
    <UserFormDialog />
  ) : (
    <UpgradeModal fitur="Pengguna tambahan" kunci="USERS">
      <Button>
        <UserCog />
        Tambah Pengguna
      </Button>
    </UpgradeModal>
  );

  return (
    <Card className="overflow-hidden p-0">
      <DataTableToolbar aksi={tombolTambah}>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            bukaUrl({ search: kataKunci, page: 1 });
          }}
        >
          <Input
            value={kataKunci}
            onChange={(event) => setKataKunci(event.target.value)}
            placeholder="Cari nama / email..."
            className="w-60"
            aria-label="Cari pengguna"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search />
            Cari
          </Button>
        </form>
      </DataTableToolbar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Dibuat</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>
                <EmptyState
                  icon={UserCog}
                  title="Belum ada pengguna"
                  description="Tambahkan pengguna baru untuk mengelola usaha bersama."
                  aksi={tombolTambah}
                />
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={ROLE_BADGE_VARIANT[user.role] ?? "neutral"}
                  >
                    {SEMUA_ROLE_LABELS[user.role]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatTanggal(user.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  {user.tidakDapatDiubah ? (
                    <span
                      className="inline-flex items-center text-muted-foreground"
                      title="Akun pemilik tidak dapat diubah dari halaman ini."
                    >
                      <Lock className="size-4" />
                    </span>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <UserEditDialog user={user} />
                      <DeleteUserDialog user={user} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {meta.total} pengguna · halaman {meta.page} dari {meta.totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!bisaSebelumnya}
            onClick={() => bukaUrl({ page: meta.page - 1 })}
          >
            <ChevronLeft />
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!bisaBerikutnya}
            onClick={() => bukaUrl({ page: meta.page + 1 })}
          >
            Berikutnya
            <ChevronRight />
          </Button>
        </div>
      </div>
    </Card>
  );
}
