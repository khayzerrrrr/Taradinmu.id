"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Layers, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { DataTableToolbar } from "@/components/shared/data-table-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRupiah, formatTanggal } from "@/lib/format";
import type { PaginationMeta } from "@/shared/types";
import type { ProgramItem, ProgramStatusValue } from "../types";
import { hitungRingkasan, LABEL_STATUS, perluDitinjau, STATUS_PROGRAM } from "../utils";
import { DeleteProgramDialog } from "./delete-program-dialog";
import { ProgramFormDialog } from "./program-form-dialog";
import { ProgramEditDialog } from "./program-edit-dialog";
import { ProgramProgres, ProgramStatusBadge } from "./program-status";

type Props = {
  programs: ProgramItem[];
  meta: PaginationMeta;
  search: string;
  status: ProgramStatusValue | "";
  /** Sebutan industri untuk baris ini, mis. "Kloter". */
  sebutan: string;
  /** STAFF dan paket FREE tidak mendapat tombol tulis (PRD 4.F.7). */
  bolehMenulis: boolean;
  basePath: string;
};

const SEMUA_STATUS = "__semua__";

function barisRingkas(program: ProgramItem) {
  return hitungRingkasan({
    targetAmount: program.targetAmount === null ? null : Number(program.targetAmount),
    budgetAmount: program.budgetAmount === null ? null : Number(program.budgetAmount),
    collected: Number(program.collected),
    spent: Number(program.spent),
  });
}

export function ProgramTable({
  programs,
  meta,
  search,
  status,
  sebutan,
  bolehMenulis,
  basePath,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [kataKunci, setKataKunci] = useState(search);

  function bukaUrl(next: { page?: number; search?: string; status?: string }) {
    const params = new URLSearchParams();
    const q = (next.search ?? kataKunci).trim();
    if (q) params.set("search", q);
    const s = next.status ?? status;
    if (s) params.set("status", s);
    const page = next.page ?? meta.page;
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Card className="overflow-hidden p-0">
      <DataTableToolbar aksi={bolehMenulis ? <ProgramFormDialog sebutan={sebutan} /> : undefined}>
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
            placeholder={`Cari nama ${sebutan.toLowerCase()}...`}
            className="w-56"
            aria-label={`Cari ${sebutan}`}
          />
          <Button type="submit" variant="outline" size="sm">
            <Search />
            Cari
          </Button>
        </form>

        <Select
          value={status || SEMUA_STATUS}
          onValueChange={(value) =>
            bukaUrl({ status: value === SEMUA_STATUS ? "" : value, page: 1 })
          }
        >
          <SelectTrigger className="w-44" aria-label="Saring berdasarkan status">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA_STATUS}>Semua status</SelectItem>
            {STATUS_PROGRAM.map((nilai) => (
              <SelectItem key={nilai} value={nilai}>
                {LABEL_STATUS[nilai]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataTableToolbar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{sebutan}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead className="text-right">Peserta</TableHead>
            <TableHead className="min-w-48">Dana terkumpul</TableHead>
            <TableHead className="text-right">Terpakai</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {programs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <EmptyState
                  icon={Layers}
                  title={`Belum ada ${sebutan.toLowerCase()}`}
                  description={
                    search || status
                      ? "Tidak ada yang cocok dengan pencarian atau filter status ini."
                      : `Buat ${sebutan.toLowerCase()} pertama untuk memisahkan target dana dan pengeluaran per kegiatan.`
                  }
                  aksi={
                    bolehMenulis && !search && !status ? (
                      <ProgramFormDialog sebutan={sebutan} />
                    ) : undefined
                  }
                />
              </TableCell>
            </TableRow>
          ) : (
            programs.map((program) => {
              const ringkas = barisRingkas(program);
              const ditinjau = perluDitinjau(program.status, program.endDate);
              return (
                <TableRow key={program.id}>
                  <TableCell className="max-w-xs">
                    <Link
                      href={`${basePath}/dashboard/program/${program.id}`}
                      className="flex flex-col font-medium hover:underline"
                    >
                      <span className="truncate" title={program.name}>
                        {program.name}
                      </span>
                      {program.description ? (
                        <span className="truncate text-xs font-normal text-muted-foreground">
                          {program.description}
                        </span>
                      ) : null}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <ProgramStatusBadge status={program.status} />
                      {ditinjau ? (
                        <Badge variant="outline" className="text-destructive">
                          Perlu ditinjau
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatTanggal(program.startDate)}
                    <span className="text-xs"> &rarr; </span>
                    {program.endDate ? formatTanggal(program.endDate) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {program.participantCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <span className="font-medium tabular-nums">
                        {formatRupiah(program.collected)}
                        {program.targetAmount ? (
                          <span className="text-xs font-normal text-muted-foreground">
                            {" / "}
                            {formatRupiah(program.targetAmount)}
                          </span>
                        ) : null}
                      </span>
                      <ProgramProgres
                        persen={ringkas.persenTarget}
                        label="dari target"
                      />
                      <span className="text-xs text-muted-foreground">
                        {program.paidInvoiceCount} invoice lunas
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        ringkas.anggaranTerlewat
                          ? "font-medium tabular-nums text-destructive"
                          : "tabular-nums"
                      }
                    >
                      {formatRupiah(program.spent)}
                    </span>
                    {ringkas.anggaranTerlewat ? (
                      <p className="text-xs text-destructive">
                        lewat {formatRupiah(Math.abs(ringkas.sisaAnggaran ?? 0))}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {bolehMenulis ? (
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <ProgramEditDialog program={program} sebutan={sebutan} />
                        <DeleteProgramDialog program={program} sebutan={sebutan} />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        hanya dibaca
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {meta.total} {sebutan.toLowerCase()} · halaman {meta.page} dari{" "}
          {meta.totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => bukaUrl({ page: meta.page - 1 })}
          >
            <ChevronLeft />
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
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
