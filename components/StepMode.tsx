"use client";
// Langkah 2: Pilih mode — Otomatis (AI) atau Manual.
import { Alert, Btn, Card } from "./ui";
import type { Mode } from "@/lib/types";

export default function StepMode({
  hasKey,
  mode,
  setMode,
  maxClips,
  setMaxClips,
  onNext,
  onBack,
}: {
  hasKey: boolean | null;
  mode: Mode;
  setMode: (m: Mode) => void;
  maxClips: number;
  setMaxClips: (n: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const autoDisabled = hasKey === false;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h2 className="text-center text-2xl font-bold">Pilih mode kerja</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          className={`cursor-pointer transition ${
            mode === "auto" ? "border-yellow-400 ring-1 ring-yellow-400" : "hover:border-zinc-600"
          } ${autoDisabled ? "opacity-50" : ""}`}
        >
          <button
            className="w-full text-left"
            disabled={autoDisabled}
            onClick={() => setMode("auto")}
          >
            <div className="text-3xl">🤖</div>
            <h3 className="mt-2 font-bold">Otomatis (AI)</h3>
            <p className="mt-1 text-sm text-zinc-400">
              AI mentranskrip videomu, memilih momen-momen terbaik, lalu memberi judul tiap klip.
              Kamu tetap bisa mengedit saran AI sebelum render (hybrid).
            </p>
            {autoDisabled && (
              <p className="mt-2 text-xs text-amber-300">
                Nonaktif — API key dev.meta.ai belum dipasang di server.
              </p>
            )}
          </button>
          {mode === "auto" && !autoDisabled && (
            <label className="mt-3 block" onClick={(e) => e.stopPropagation()}>
              <span className="mb-1 block text-xs text-zinc-400">Jumlah klip yang diminta AI</span>
              <input
                type="number"
                min={1}
                max={10}
                value={maxClips}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!Number.isNaN(v)) setMaxClips(Math.max(1, Math.min(10, v)));
                }}
                className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </label>
          )}
        </Card>

        <Card
          className={`cursor-pointer transition ${
            mode === "manual" ? "border-yellow-400 ring-1 ring-yellow-400" : "hover:border-zinc-600"
          }`}
        >
          <button className="w-full text-left" onClick={() => setMode("manual")}>
            <div className="text-3xl">✋</div>
            <h3 className="mt-2 font-bold">Manual</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Kamu tentukan sendiri potongannya lewat timeline + preview video.
              Jalan penuh tanpa API key.
            </p>
          </button>
        </Card>
      </div>

      {hasKey === false && (
        <Alert tone="info">
          Tanpa API key, mode manual tetap berfungsi 100%: potong, crop 9:16, subtitle
          (dari teks yang kamu ketik sendiri per klip — opsional), dan render.
        </Alert>
      )}

      <div className="flex justify-between">
        <Btn variant="ghost" onClick={onBack}>
          ← Kembali
        </Btn>
        <Btn onClick={onNext} disabled={mode === "auto" && autoDisabled}>
          Lanjut →
        </Btn>
      </div>
    </div>
  );
}
