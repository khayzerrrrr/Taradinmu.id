"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Lock, MessageSquare, Send, X } from "lucide-react";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Peran = "user" | "assistant";

type Pesan = {
  id: string;
  peran: Peran;
  isi: string;
};

type Props = {
  /** Paket FREE: tombol tampil dengan gembok dan membuka ajakan upgrade (PRD 4.E). */
  terkunciPro: boolean;
};

/**
 * Asisten AI mengambang (PRD Bagian 4.E).
 *
 * Sengaja TANPA dependensi klien tambahan: protokolnya hanya teks polos yang
 * dialirkan dari /api/chat, sehingga cukup `fetch` + TextDecoder. Ini menghindari
 * paket `@ai-sdk/react` yang belum terpasang.
 */
export function AiAssistantChat({ terkunciPro }: Props) {
  const [terbuka, setTerbuka] = useState(false);
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [input, setInput] = useState("");
  const [memuat, setMemuat] = useState(false);

  const areaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Gulir otomatis ke pesan terbaru.
  useEffect(() => {
    const el = areaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [pesan, memuat]);

  // Fokuskan kolom input begitu panel dibuka.
  useEffect(() => {
    if (terbuka) inputRef.current?.focus();
  }, [terbuka]);

  // Tutup dengan Escape.
  useEffect(() => {
    if (!terbuka) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTerbuka(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [terbuka]);

  const kirim = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const teks = input.trim();
      if (!teks || memuat) return;

      const pesanUser: Pesan = { id: crypto.randomUUID(), peran: "user", isi: teks };
      const idAsisten = crypto.randomUUID();
      const riwayat = [...pesan, pesanUser];
      const riwayatAsisten: Pesan = { id: idAsisten, peran: "assistant", isi: "" };

      setPesan([...riwayat, riwayatAsisten]);
      setInput("");
      setMemuat(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: riwayat.map((p) => ({ role: p.peran, content: p.isi })),
          }),
        });

        if (!res.ok || !res.body) {
          const alasan = await res.text().catch(() => "");
          throw new Error(alasan || "Asisten tidak dapat dihubungi.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let terkumpul = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          terkumpul += decoder.decode(value, { stream: true });
          setPesan((prev) =>
            prev.map((p) => (p.id === idAsisten ? { ...p, isi: terkumpul } : p)),
          );
        }

        if (!terkumpul.trim()) {
          setPesan((prev) =>
            prev.map((p) =>
              p.id === idAsisten
                ? { ...p, isi: "Mohon maaf, tidak ada balasan yang diterima." }
                : p,
            ),
          );
        }
      } catch (err) {
        const alasan =
          err instanceof Error ? err.message : "terjadi gangguan pada sambungan.";
        setPesan((prev) =>
          prev.map((p) =>
            p.id === idAsisten ? { ...p, isi: `Mohon maaf, ${alasan}` } : p,
          ),
        );
      } finally {
        setMemuat(false);
      }
    },
    [input, memuat, pesan],
  );

  // --- Paket FREE: gembok + ajakan upgrade (PRD 4.E) -------------------------
  if (terkunciPro) {
    return (
      <UpgradeModal fitur="Asisten AI">
        <button
          type="button"
          aria-label="Asisten AI khusus paket PRO — buka opsi upgrade"
          className="fixed right-6 bottom-6 z-40 flex size-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-overlay transition-colors hover:text-foreground"
        >
          <Lock aria-hidden="true" className="size-5" />
        </button>
      </UpgradeModal>
    );
  }

  return (
    <>
      {!terbuka ? (
        <button
          type="button"
          onClick={() => setTerbuka(true)}
          aria-label="Buka Asisten AI"
          className="fixed right-6 bottom-6 z-40 flex size-12 items-center justify-center rounded-full bg-primary-solid text-primary-foreground shadow-overlay transition-colors hover:bg-primary-solid-hover"
        >
          <MessageSquare aria-hidden="true" className="size-5" />
        </button>
      ) : null}

      {terbuka ? (
        <section
          aria-label="Asisten AI TaradinMu"
          className="fixed right-6 bottom-6 z-40 flex h-[min(34rem,80svh)] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-overlay"
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-solid">
              <Bot aria-hidden="true" className="size-4" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">Asisten TaradinMu</span>
              <span className="truncate text-xs text-muted-foreground">
                Fitur paket PRO
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setTerbuka(false)}
              aria-label="Tutup Asisten AI"
            >
              <X aria-hidden="true" />
            </Button>
          </header>

          <div
            ref={areaRef}
            className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            {pesan.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Bot aria-hidden="true" className="size-5" />
                </span>
                <p className="text-sm font-medium">Assalamu&apos;alaikum</p>
                <p className="max-w-[16rem] text-balance text-xs text-muted-foreground">
                  Saya bisa membantu soal pencatatan, piutang, draf pesan penagihan,
                  dan hitungan zakat.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {pesan.map((p) => (
                  <div
                    key={p.id}
                    className={cn(
                      "flex",
                      p.peran === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <p
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                        p.peran === "user"
                          ? "bg-primary-solid text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {p.isi || (memuat ? "…" : "")}
                    </p>
                  </div>
                ))}

                {memuat && (pesan.at(-1)?.isi ?? "") === "" ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                    Menyusun balasan
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <form
            onSubmit={kirim}
            className="flex shrink-0 flex-col gap-2 border-t border-border p-3"
          >
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanya soal stok, piutang, atau zakat"
                disabled={memuat}
                aria-label="Pesan untuk Asisten AI"
              />
              <Button
                type="submit"
                size="icon"
                disabled={memuat || input.trim().length === 0}
                aria-label="Kirim pesan"
              >
                <Send aria-hidden="true" />
              </Button>
            </div>
            <p className="text-center text-2xs text-muted-foreground">
              AI dapat keliru. Periksa kembali informasi penting.
            </p>
          </form>
        </section>
      ) : null}
    </>
  );
}
