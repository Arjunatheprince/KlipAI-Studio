"use client";
// Langkah 3: Proses.
// - Mode otomatis: ekstrak audio (di browser) -> transkripsi per chunk (server)
//   -> analisis AI -> daftar saran klip.
// - Mode manual: hanya baca durasi video, langsung lanjut.
import { useEffect, useRef, useState } from "react";
import { Btn, Card, Progress } from "./ui";
import { extractAudioChunks } from "@/lib/audio";
import { analyzeTranscript, transcribeChunk } from "@/lib/apiClient";
import { formatDuration } from "@/lib/format";
import type { ClipSuggestion, Mode, Turn } from "@/lib/types";

type Phase = "extract" | "transcribe" | "analyze";

export default function StepProcess({
  file,
  videoUrl,
  mode,
  maxClips,
  onDone,
  onFail,
  onBack,
}: {
  file: File;
  videoUrl: string;
  mode: Mode;
  maxClips: number;
  onDone: (turns: Turn[], durationMs: number, clips: ClipSuggestion[]) => void;
  onFail: (msg: string) => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(mode === "auto" ? "extract" : "extract");
  const [extractP, setExtractP] = useState(0);
  const [transcribeP, setTranscribeP] = useState(0);
  const [chunkInfo, setChunkInfo] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;

    (async () => {
      if (mode === "manual") {
        // Tanpa AI: cukup baca durasi video.
        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = videoUrl;
        await new Promise<void>((resolve, reject) => {
          v.onloadedmetadata = () => resolve();
          v.onerror = () => reject(new Error("Gagal membaca file video."));
        });
        const durationMs = Math.round(v.duration * 1000);
        v.src = "";
        if (!Number.isFinite(durationMs) || durationMs <= 0) {
          throw new Error("Durasi video tidak valid atau tidak dapat dibaca.");
        }
        if (!cancelled) onDone([], durationMs, []);
        return;
      }

      // 1) Ekstrak audio di browser -> chunk WAV.
      const { chunks, chunkOffsetsMs, durationMs } = await extractAudioChunks(file, setExtractP);

      // 2) Transkripsi tiap chunk berurutan via server (pakai API key di sana).
      setPhase("transcribe");
      const allTurns: Turn[] = [];
      for (let i = 0; i < chunks.length; i++) {
        setChunkInfo(`Bagian ${i + 1} dari ${chunks.length} (${formatDuration(chunkOffsetsMs[i])}…)`);
        // Beri feedback visual awal agar tidak tampak 0% membeku
        setTranscribeP((i + 0.15) / chunks.length);

        const { turns } = await transcribeChunk(chunks[i]);
        const offset = chunkOffsetsMs[i];
        for (const t of turns) {
          allTurns.push({ ...t, startMs: t.startMs + offset, endMs: t.endMs + offset });
        }
        setTranscribeP((i + 1) / chunks.length);
      }

      // 3) Minta AI memilih momen terbaik.
      setPhase("analyze");
      const clips = await analyzeTranscript({ turns: allTurns, durationMs, maxClips });
      if (!cancelled) onDone(allTurns, durationMs, clips);
    })().catch((e) => {
      if (!cancelled) onFail(e instanceof Error ? e.message : "Terjadi kesalahan saat memproses.");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}d` : `${s} detik`;
  };

  const phaseLabel = {
    extract: "Mengekstrak audio dari video… (di browser, tanpa upload)",
    transcribe: `Mentranskrip audio dengan AI Meta (${formatElapsed(elapsed)} berjalan)…`,
    analyze: `AI sedang memilih momen terbaik (${formatElapsed(elapsed)} berjalan)…`,
  }[phase];

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <h2 className="text-center text-2xl font-bold">Memproses Video</h2>
      <Card className="space-y-5">
        {mode === "auto" ? (
          <>
            <Progress value={extractP} label="1/3 — Ekstrak audio" />
            <Progress
              value={transcribeP}
              label={
                chunkInfo
                  ? `2/3 — Transkripsi ${chunkInfo}`
                  : "2/3 — Transkripsi audio"
              }
            />
            <div>
              <p className="mb-1 text-xs text-zinc-400">3/3 — Analisis AI</p>
              <p className={`text-sm ${phase === "analyze" ? "text-yellow-300 animate-pulse font-medium" : "text-zinc-500"}`}>
                {phase === "analyze" ? "⏳ " + phaseLabel : "Menunggu giliran…"}
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
              <div className="flex items-center gap-2 text-zinc-300 font-medium mb-1">
                <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
                <span>{phaseLabel}</span>
              </div>
              <p className="text-zinc-500 leading-relaxed">
                {phase === "transcribe" &&
                  "Audio dikirim dan diproses oleh Meta Model API (muse-voice-transcribe). Video panjang diproses per bagian (3-4 menit audio per bagian). Mohon jangan menutup tab ini."}
                {phase === "analyze" &&
                  "AI (muse-spark) sedang menganalisis transkrip untuk mencari momen hook dan punchline terbaik."}
                {phase === "extract" &&
                  "Audio sedang di-resample ke 16kHz mono langsung di browser."}
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-400">Membaca durasi video…</p>
        )}
      </Card>
      <div className="flex justify-between items-center">
        <Btn variant="ghost" onClick={onBack}>
          ← Batalkan & Kembali
        </Btn>
        <span className="text-xs text-zinc-500">Waktu berjalan: {formatElapsed(elapsed)}</span>
      </div>
    </div>
  );
}
